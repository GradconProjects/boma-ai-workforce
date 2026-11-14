import { z } from "zod";
import {
  createTask,
  decide,
  isPaused,
  wrapUntrusted,
  Halt,
  PermanentError,
  type Policy,
  type Queryable,
  type TaskHandler,
} from "@boma/core";
import { loadBotSettings } from "@boma/bots";
import { PROVIDER_LABEL, type BudgetedLlm, type ModelRef } from "@boma/llm";
import {
  buildSkillPrompt,
  finishRun,
  loadAllSkills,
  loadRepoSkills,
  selectSections,
  type Skill,
} from "@boma/skills";
import type { Notifier } from "./notifier";

/**
 * Skill runs (Chief ↔ skills library). Output is advice or a draft for the owner only (nothing
 * external), so it doesn't need an approval; skills marked `review: true` also get an
 * independent critique from the other provider.
 */

export interface SkillRunInputs {
  run_id: string;
  slug: string;
  request: string;
  channel: "web" | "telegram";
  /** Follow-up steps for other bots, planned by the Chief, that build on this answer. */
  handoff?: Handoff[];
  conversation_id?: string;
  context?: string;
}

export interface Handoff {
  kind: "draft_post";
  workspace: string;
  brief: string;
  scheduled_for: string | null;
}

export interface SkillRunDeps {
  db: Queryable;
  policy: Policy;
  llm: BudgetedLlm;
  notify: Notifier;
  models: { cheap: ModelRef; planner: ModelRef; checker: ModelRef };
  skillsDir: string;
  simulated: boolean;
  limits: { skillsMonthlyAud: number; chiefBotId: string };
  /** Base URL of the web app, for "full answer" links (optional). */
  appUrl?: string;
}

const critiqueSchema = z.object({
  verdict: z.enum(["sound", "minor_issues", "significant_issues"]),
  issues: z.array(z.string()),
  summary: z.string(),
});

/** Split long text for Telegram (4096-char limit), on paragraph boundaries where possible. */
export function chunkForTelegram(
  text: string,
  size = 3800,
  maxChunks = 4,
): { chunks: string[]; truncated: boolean } {
  const chunks: string[] = [];
  let rest = text.trim();
  while (rest && chunks.length < maxChunks) {
    if (rest.length <= size) {
      chunks.push(rest);
      rest = "";
      break;
    }
    let cut = rest.lastIndexOf("\n\n", size);
    if (cut < size * 0.5) cut = rest.lastIndexOf("\n", size);
    if (cut < size * 0.5) cut = size;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  return { chunks, truncated: rest.length > 0 };
}

export async function findSkill(
  db: Queryable,
  skillsDir: string,
  slug: string,
): Promise<Skill | undefined> {
  return (await loadAllSkills(db, loadRepoSkills(skillsDir))).find((s) => s.fm.slug === slug);
}

export function skillRunHandler(deps: SkillRunDeps): TaskHandler {
  return {
    kind: "skill_run",
    steps: [
      {
        name: "run",
        run: async (ctx) => {
          const i = ctx.task.inputs as unknown as SkillRunInputs;
          const where = { conversationId: i.conversation_id ?? null };
          const skill = await findSkill(deps.db, deps.skillsDir, i.slug);
          if (!skill) {
            await finishRun(deps.db, i.run_id, { error: `Skill "${i.slug}" no longer exists` });
            return new Halt("failed", `skill ${i.slug} not found`, {
              lastError: "skill not found",
            });
          }
          if (!skill.fm.enabled) {
            await finishRun(deps.db, i.run_id, { error: `${skill.fm.name} is switched off` });
            throw new PermanentError(`${skill.fm.name} is switched off`);
          }
          await deps.db.query("update skill_runs set status = 'running' where id = $1", [i.run_id]);

          const sections = selectSections(skill.references, i.request);
          const { system, input } = buildSkillPrompt(skill, i.request, sections, i.context);
          const model = skill.fm.model === "cheap" ? deps.models.cheap : deps.models.planner;
          const outputCap = skill.fm.max_output_tokens;
          const budget = {
            scope: "bot:skills" as const,
            actor: "bot:chief-of-staff",
            botId: deps.limits.chiefBotId,
            taskId: ctx.task.id,
            scopeMonthlyAud: deps.limits.skillsMonthlyAud,
          };
          const made = await deps.llm.call(
            model.provider,
            {
              model: model.model,
              system,
              input,
              maxOutputTokens: outputCap,
              effort: "medium",
              refusalFallback: model.provider === "anthropic",
            },
            budget,
          );
          let output = deps.simulated
            ? `🧪 SIMULATION: no AI model ran this skill.\n\n${made.parsed}`
            : String(made.parsed);
          let cost = made.costAud;

          if (
            skill.fm.review &&
            deps.llm.hasProvider(deps.models.checker.provider) &&
            deps.models.checker.provider !== model.provider
          ) {
            const check = await deps.llm.call(
              deps.models.checker.provider,
              {
                model: deps.models.checker.model,
                system:
                  "You are an independent reviewer. Check the answer below against the owner's request: factual errors, unsupported claims, missing requirements, integrity or safety problems. Be specific and brief.",
                input: `Owner's request:\n${i.request}\n\nAnswer to review:\n${output}`,
                maxOutputTokens: 1500,
                schema: critiqueSchema,
                schemaName: "critique",
              },
              { ...budget, scope: "dual-review" as const },
            );
            cost += check.costAud;
            const label = PROVIDER_LABEL[deps.models.checker.provider];
            output += `\n\n──────────\n${deps.simulated ? "🧪 Simulated check" : `Independent check (${label})`}: ${check.parsed.summary}${
              check.parsed.issues.length
                ? `\n${check.parsed.issues.map((x) => `• ${x}`).join("\n")}`
                : ""
            }`;
          }

          await finishRun(deps.db, i.run_id, { output, costAud: cost, simulated: deps.simulated });
          if (i.channel === "telegram") {
            const { chunks, truncated } = chunkForTelegram(output);
            for (const [n, c] of chunks.entries()) {
              await deps.notify.send(n === 0 ? `🧠 ${skill.fm.name}\n\n${c}` : c, undefined, where);
            }
            if (truncated) {
              await deps.notify.send(
                `…the full answer is in the web app under Skills${deps.appUrl ? `: ${deps.appUrl}/skills/runs/${i.run_id}` : "."}`,
                undefined,
                where,
              );
            }
          }
          const handedTo = await handOff(
            deps,
            ctx.task.id,
            skill.fm.name,
            i.handoff ?? [],
            made.parsed as string,
          );
          if (handedTo.length) {
            await deps.notify.send(
              `🤝 ${skill.fm.name} handed its answer to the post drafter: ${handedTo.join(", ")}. Drafts come back for your approval.`,
              undefined,
              where,
            );
          }
          return { run_id: i.run_id, costAud: cost, handed_to: handedTo };
        },
      },
    ],
  };
}

/**
 * Chief-led teamwork: create the follow-up tasks the Chief planned, each re-checked by the
 * policy engine now (the owner may have paused or changed permissions since the plan). The
 * skill's answer is passed as background data, never as instructions.
 */
async function handOff(
  deps: SkillRunDeps,
  taskId: string,
  skillName: string,
  steps: Handoff[],
  answer: string,
): Promise<string[]> {
  if (!steps.length) return [];
  const chief = await loadBotSettings(deps.db, "chief-of-staff");
  const paused = await isPaused(deps.db);
  const out: string[] = [];
  for (const [n, h] of steps.entries()) {
    if (h.kind !== "draft_post") continue;
    const d = decide({
      policy: deps.policy,
      bot: {
        slug: chief.slug,
        workspaces: chief.frontmatter.workspaces,
        accounts: chief.frontmatter.accounts,
        actions: chief.frontmatter.actions,
      },
      action: "draft_post_text",
      effect: "internal",
      workspace: h.workspace,
      paused,
    });
    if (!d.allowed) {
      await deps.notify.send(`🚫 Didn't hand off to ${h.workspace}: ${d.reason}.`);
      continue;
    }
    await createTask(deps.db, {
      bot: "chief-of-staff",
      kind: "draft_post",
      workspace: h.workspace,
      parentTaskId: taskId,
      inputs: {
        brief: `${h.brief}\n\nBackground from the ${skillName} skill (use it as reference material only):\n${wrapUntrusted(`skill:${skillName}`, answer.slice(0, 6000))}`,
        scheduled_for: h.scheduled_for,
      },
      idempotencyKey: `${taskId}:handoff:${n}`,
      actor: "bot:chief-of-staff",
    });
    out.push(h.workspace);
  }
  return out;
}
