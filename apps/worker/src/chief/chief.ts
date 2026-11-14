import {
  audit,
  budgetStatus,
  BudgetBlockedError,
  createTask,
  decide,
  decideApproval,
  getApproval,
  getState,
  isPaused,
  listTasks,
  pauseAll,
  pendingApprovals,
  resumeAll,
  setState,
  setTelegramMessageId,
  type Policy,
  type Queryable,
  type TaskEvent,
} from "@boma/core";
import { listBots, loadBotSettings, type BotSettings } from "@boma/bots";
import { approvalButtons, type ApprovalAction } from "@boma/connectors";
import { FxRateMissingError, type BudgetedLlm, type ModelRef } from "@boma/llm";
import {
  dispatchSkill,
  estimateSkillAud,
  isUnlocked,
  loadAllSkills,
  loadRepoSkills,
  lockSkills,
  matchSkills,
  passcodeConfigured,
  setSkillSettings,
  tryUnlock,
  type Skill,
} from "@boma/skills";
import { approvalMessage } from "./draft-post";
import type { Notifier } from "./notifier";
import { answerSchema, classifySchema, planSchema, type Classification } from "./schemas";

/**
 * Chief of Staff (spec §5, bots/chief-of-staff.md). Coordinates; never acts on external
 * accounts. Every decision about what may run goes through the policy engine.
 */

export interface ChiefDeps {
  db: Queryable;
  policy: Policy;
  llm: BudgetedLlm;
  notify: Notifier;
  models: { cheap: ModelRef; planner: ModelRef };
  tz: string;
  /** Rough A$ cost of one draft_post task (maker + checker), for the pre-dispatch budget check. */
  draftPostEstimateAud?: number;
  /** Skills library: where the built-in skills live and the owner's passcode for high-risk ones. */
  skills?: { dir: string; passcode?: string };
}

const PENDING_CLARIFICATION = "chief:pending_clarification";
const PENDING_EDIT = "chief:pending_edit";
const PENDING_SKILL = "chief:pending_skill";

/** Never store a typed passcode (audit log, chat history). */
export const redactPasscode = (text: string) =>
  /^\/unlock\b/i.test(text.trim()) ? "/unlock ••••••" : text;

const HELP = [
  "I'm your Chief of Staff. Tell me what you need in plain English, e.g.",
  '"Write a Facebook post for OnGroundPM about our inspection reports."',
  "",
  "Commands:",
  "/status – what's running and waiting",
  "/approvals – posts waiting for your approval",
  "/budget – AI spend this month",
  "/bots – bots and their versions",
  "/pause_all – stop all new work immediately",
  "/resume – carry on",
  "/edit <bot> – how to change a bot",
  "",
  "Skills (used automatically when your request fits one):",
  "/skills – the skills library",
  "/skill <name> <request> – use a specific skill",
  "/unlock <passcode> – unlock high-risk skills for 30 minutes",
  "/lock – lock them again",
  "/risk <name> high|standard – label a skill's risk",
].join("\n");

export class ChiefOfStaff {
  constructor(private deps: ChiefDeps) {}

  private bot(): Promise<BotSettings> {
    return loadBotSettings(this.deps.db, "chief-of-staff");
  }

  private async policyCheck(
    action: string,
    effect: "none" | "internal" | "external",
    workspace?: string,
  ) {
    const bot = await this.bot();
    return decide({
      policy: this.deps.policy,
      bot: {
        slug: bot.slug,
        workspaces: bot.frontmatter.workspaces,
        accounts: bot.frontmatter.accounts,
        actions: bot.frontmatter.actions,
      },
      action,
      effect,
      workspace,
      paused: await isPaused(this.deps.db),
    });
  }

  // ───────────────────────── owner messages ─────────────────────────

  async onOwnerMessage(text: string, messageId: number): Promise<void> {
    await audit(this.deps.db, {
      actor: "owner",
      action: "telegram.message",
      inputs: redactPasscode(text),
      result: "received",
    });
    if (text.startsWith("/")) return this.command(text, messageId);

    const pendingEdit = await getState<{ approvalId: string } | null>(this.deps.db, PENDING_EDIT);
    if (pendingEdit) return this.applyOwnerEdit(pendingEdit.approvalId, text, messageId);

    const pending = await getState<{ original: string; question: string } | null>(
      this.deps.db,
      PENDING_CLARIFICATION,
    );
    const request = pending
      ? `${pending.original}\n\nYou asked: ${pending.question}\nOwner answered: ${text}`
      : text;
    if (pending) await setState(this.deps.db, PENDING_CLARIFICATION, null);

    try {
      await this.handleRequest(request, messageId, Boolean(pending));
    } catch (err) {
      if (err instanceof BudgetBlockedError) {
        await this.deps.notify.send(
          `⛔ I can't take on paid work right now: ${err.message}.\nCommands like /status, /approvals and /pause_all still work.`,
        );
        return;
      }
      if (err instanceof FxRateMissingError) {
        await this.deps.notify.send(
          "⚙️ USD_TO_AUD_RATE isn't set in .env, so I can't track spend. Paid work is off until it's set.",
        );
        return;
      }
      throw err;
    }
  }

  private async handleRequest(request: string, messageId: number, alreadyClarified: boolean) {
    const bot = await this.bot();
    const dispatch = await this.policyCheck("plan_and_dispatch", "internal");
    if (!dispatch.allowed) {
      await this.deps.notify.send(`⏸ ${dispatch.reason}. Send /resume to carry on.`);
      return;
    }

    // Skills: a clear trigger phrase routes straight to the skill (no classification call).
    const skills = await this.enabledSkills();
    const strong = matchSkills(request, skills, 1)[0];
    if (strong?.strong) {
      return this.runSkill(
        skills.find((s) => s.fm.slug === strong.slug)!,
        request,
        messageId,
      );
    }

    const c = await this.classify(request, alreadyClarified, bot, skills);
    // The model may only name a skill from the catalogue; anything else is ignored.
    const picked = c.skill ? skills.find((s) => s.fm.slug === c.skill) : undefined;
    if (picked && (c.intent === "new_job" || c.intent === "question" || c.intent === "unclear")) {
      return this.runSkill(picked, request, messageId);
    }
    // C3: exactly one clarifying question, never a second.
    const intent: Classification["intent"] =
      c.intent === "unclear" && alreadyClarified ? "new_job" : c.intent;

    if (intent === "unclear") {
      const question =
        c.clarifying_question?.trim() || "Could you tell me a bit more about what you'd like?";
      await setState(this.deps.db, PENDING_CLARIFICATION, { original: request, question });
      await this.deps.notify.send(`❓ ${question}`);
      return;
    }
    if (intent === "control" && c.control) return this.command(`/${c.control}`);
    if (intent === "approval") {
      await this.deps.notify.send(
        "Use the ✅ / ✏️ / ❌ buttons under each approval message, or /approvals to see them again.",
      );
      return;
    }
    if (intent === "bot_edit") return this.command("/edit");
    if (intent === "question") return this.answer(request, bot);
    return this.planAndDispatch(request, messageId, bot);
  }

  private async classify(
    request: string,
    alreadyClarified: boolean,
    bot: BotSettings,
    skills: Skill[] = [],
  ): Promise<Classification> {
    const system = [
      "You classify messages from the business owner to his Chief of Staff bot.",
      "intent: new_job (asks for work to be done, e.g. write or prepare content), question (asks for information about the system or its work), control (pause, resume, status, budget, approvals, bots), bot_edit (wants a bot's behaviour or permissions changed), approval (about approving or rejecting something), unclear (cannot tell what is wanted, or a required detail like which business is missing).",
      "Workspaces (businesses): ongroundpm, boma-scans, mypadiforum, personal.",
      alreadyClarified
        ? "The owner has already answered one clarifying question. Do not ask another: choose the most reasonable interpretation."
        : "If intent is unclear, write exactly one short clarifying question.",
      ...(skills.length
        ? [
            "Skills library (expert methods that apply to ANY topic of their kind, not only the examples in their descriptions):",
            ...skills.map((s) => `- ${s.fm.slug}: ${s.fm.description.slice(0, 220)}`),
            "skill: the slug of the one skill that best fits the request, or null if none clearly fits or the request is about posting content for a business (that is new_job without a skill).",
          ]
        : ["skill: null"]),
    ].join("\n");
    const r = await this.deps.llm.call(
      this.deps.models.cheap.provider,
      {
        model: this.deps.models.cheap.model,
        system,
        input: request,
        maxOutputTokens: 600,
        schema: classifySchema,
        schemaName: "classification",
        effort: "low",
      },
      {
        scope: "bot:chief-of-staff",
        actor: "bot:chief-of-staff",
        botId: bot.id,
        scopeMonthlyAud: await this.chiefMonthly(bot),
      },
    );
    return r.parsed;
  }

  private async planAndDispatch(request: string, messageId: number, bot: BotSettings) {
    const fm = bot.frontmatter;
    const skillCatalogue = (await this.enabledSkills()).map(
      (s) => `- ${s.fm.slug}: ${s.fm.description.slice(0, 160)}`,
    );
    const system = [
      "You are the business owner's Chief of Staff. Turn the request into a plan of tasks for the available bots.",
      "Available task kinds:",
      "- draft_post: draft one Facebook Page post for a workspace (it is reviewed and sent to the owner for approval; nothing is published by this task). One task per post.",
      "- skill_run: ask one expert skill from the library (set `skill` to its slug; `brief` is the full question). Its answer goes to the owner.",
      ...(skillCatalogue.length
        ? ["Skills library:", ...skillCatalogue]
        : ["(No skills are available: do not plan skill_run.)"]),
      "Teamwork: when a post should build on a skill's answer (e.g. research or a strategy first, then posts), plan the skill_run first and set the draft_post's uses_output_of to the skill_run's index (0-based) in tasks. Otherwise uses_output_of is null. skill is null for draft_post.",
      `Workspaces you may use: ${fm.workspaces.join(", ")}.`,
      "If part of the request needs something no task kind covers (sending email, posting directly, spending money, other platforms), list it in `unsupported`.",
      "If the request asks to change any bot's permissions, tools, accounts, autonomy level or budget, list it in `permission_changes_requested` and do not plan tasks for it.",
      "scheduled_for: ISO 8601 date-time with Australia/Sydney offset if the owner gave a time, else null.",
      "reply: one or two friendly sentences to the owner summarising the plan, in Australian English.",
    ].join("\n");
    const r = await this.deps.llm.call(
      this.deps.models.planner.provider,
      {
        model: this.deps.models.planner.model,
        system,
        input: request,
        maxOutputTokens: 2000,
        schema: planSchema,
        schemaName: "plan",
        effort: "medium",
        refusalFallback: this.deps.models.planner.provider === "anthropic",
      },
      {
        scope: "bot:chief-of-staff",
        actor: "bot:chief-of-staff",
        botId: bot.id,
        scopeMonthlyAud: await this.chiefMonthly(bot),
      },
    );
    const plan = r.parsed;
    const lines: string[] = [];

    // C7: permission changes are owner-only. The LLM can only report the request; code denies it.
    for (const change of plan.permission_changes_requested) {
      const d = await this.policyCheck("change_bot_permissions", "internal");
      await audit(this.deps.db, {
        actor: "bot:chief-of-staff",
        action: "policy.denied",
        target: "change_bot_permissions",
        inputs: change,
        result: d.reason,
      });
      lines.push(
        `🔒 "${change}" — I can't change permissions or budgets. Only you can, on your computer: pnpm owner …`,
      );
    }

    // Validate every proposed task in code before creating anything.
    const skills = await this.enabledSkills();
    type Step = (typeof plan.tasks)[number] & { index: number; skillDef?: Skill };
    const accepted: Step[] = [];
    for (const [index, t] of plan.tasks.entries()) {
      if (t.kind === "skill_run") {
        const skillDef = skills.find((s) => s.fm.slug === t.skill);
        if (!skillDef) {
          lines.push(`🚫 Skipped a step: "${t.skill ?? "?"}" isn't an available skill.`);
          continue;
        }
        accepted.push({ ...t, index, skillDef });
        continue;
      }
      const d = await this.policyCheck("draft_post_text", "internal", t.workspace);
      if (!d.allowed) {
        lines.push(`🚫 Skipped "${t.brief.slice(0, 60)}": ${d.reason}.`);
        continue;
      }
      accepted.push({ ...t, index });
    }
    // Teamwork: a step may build on an earlier skill's answer. Anything else runs on its own.
    const upstreamOf = (t: Step) => {
      const u = t.uses_output_of;
      return u !== null && u !== undefined && u < t.index
        ? accepted.find((a) => a.index === u && a.kind === "skill_run")
        : undefined;
    };

    // C5: refuse work that would exceed the budget before dispatching any of it.
    const postEst = this.deps.draftPostEstimateAud ?? 0.08;
    const estimate = accepted.reduce(
      (sum, t) => sum + (t.skillDef ? estimateSkillAud(t.skillDef) : postEst),
      0,
    );
    const budget = await budgetStatus(this.deps.db, this.deps.policy, new Date(), this.deps.tz);
    if (accepted.length && budget.spentAud + estimate > budget.hardStopAud) {
      await this.deps.notify.send(
        `⛔ Blocked by budget: this plan needs about A$${estimate.toFixed(2)} but only A$${Math.max(0, budget.hardStopAud - budget.spentAud).toFixed(2)} is left this month. Nothing was started.`,
      );
      return;
    }

    const taskLines: string[] = [];
    let n = 0;
    for (const t of accepted) {
      if (t.kind === "skill_run") {
        const handoff = accepted
          .filter((d) => d.kind === "draft_post" && upstreamOf(d) === t)
          .map((d) => ({
            kind: "draft_post",
            workspace: d.workspace,
            brief: d.brief,
            scheduled_for: d.scheduled_for,
          }));
        const r = await dispatchSkill(this.deps.db, this.deps.policy, {
          skill: t.skillDef!,
          request: t.brief,
          channel: "telegram",
          idempotencyKey: `tg:${messageId}:${t.index}`,
          actor: "bot:chief-of-staff",
          handoff,
          conversationId: await this.conversationOf(messageId),
        });
        if (!r.ok) {
          lines.push(
            `${r.message}${handoff.length ? ` (${handoff.length} follow-up step(s) wait on it, so they didn't start either.)` : ""}`,
          );
          continue;
        }
        taskLines.push(`${++n}. 🧠 ${t.skillDef!.fm.name} — ${t.brief.slice(0, 80)}`);
        for (const h of handoff)
          taskLines.push(`   ↳ then Draft post · ${h.workspace}, using that answer`);
        continue;
      }
      if (upstreamOf(t)) continue; // created by the skill run when it finishes
      const { task } = await createTask(this.deps.db, {
        bot: "chief-of-staff",
        kind: t.kind,
        workspace: t.workspace,
        inputs: { brief: t.brief, scheduled_for: t.scheduled_for },
        idempotencyKey: `tg:${messageId}:${t.index}`, // a replayed message never dispatches twice
        estCostAud: postEst,
        actor: "bot:chief-of-staff",
      });
      taskLines.push(
        `${++n}. Draft post · ${task.workspace_slug} — ${(task.inputs.brief as string).slice(0, 90)}`,
      );
    }

    for (const u of plan.unsupported) lines.push(`⏳ Not available yet: ${u}`);
    await this.deps.notify.send(
      [
        plan.reply,
        ...(taskLines.length
          ? ["", "Plan:", ...taskLines, `Answers come back here; posts come back for approval.`]
          : []),
        ...(lines.length ? ["", ...lines] : []),
      ].join("\n"),
    );
  }

  private async answer(question: string, bot: BotSettings) {
    const snapshot = await this.statusText();
    const r = await this.deps.llm.call(
      this.deps.models.cheap.provider,
      {
        model: this.deps.models.cheap.model,
        system:
          "Answer the owner's question about his AI workforce using only the status snapshot. Be brief. If the snapshot doesn't say, say you don't know.",
        input: `Status snapshot:\n${snapshot}\n\nQuestion: ${question}`,
        maxOutputTokens: 600,
        schema: answerSchema,
        schemaName: "answer",
        effort: "low",
      },
      {
        scope: "bot:chief-of-staff",
        actor: "bot:chief-of-staff",
        botId: bot.id,
        scopeMonthlyAud: await this.chiefMonthly(bot),
      },
    );
    await this.deps.notify.send(r.parsed.answer);
  }

  private async chiefMonthly(bot: BotSettings): Promise<number> {
    const allocation =
      this.deps.policy.budget.allocations["chief-of-staff"] ?? bot.frontmatter.budget.monthly_aud;
    const { rows } = await this.deps.db.query<{ monthly_aud: string }>(
      "select monthly_aud from budget_limits where scope = 'bot:chief-of-staff'",
    );
    return rows[0] ? Number(rows[0].monthly_aud) : allocation;
  }

  // ───────────────────────── commands (no LLM, A$0) ─────────────────────────

  async command(raw: string, messageId = 0): Promise<void> {
    const [cmd, ...args] = raw.trim().split(/\s+/);
    const db = this.deps.db;
    switch (cmd?.toLowerCase()) {
      case "/start":
      case "/help":
        await this.deps.notify.send(HELP);
        return;
      case "/status":
        await this.deps.notify.send(await this.statusText());
        return;
      case "/budget": {
        const b = await budgetStatus(db, this.deps.policy, new Date(), this.deps.tz);
        const scopes = Object.entries(b.byScope).map(([s, v]) => `• ${s}: A$${v.toFixed(3)}`);
        await this.deps.notify.send(
          [
            `💰 ${b.month}: A$${b.spentAud.toFixed(2)} of A$${b.hardStopAud.toFixed(2)} (warn at A$${b.warnAud.toFixed(2)})`,
            ...scopes,
            b.stopped ? "⛔ Budget stop: no new paid work." : "",
          ]
            .filter(Boolean)
            .join("\n"),
        );
        return;
      }
      case "/approvals":
        await this.resendApprovals();
        return;
      case "/bots": {
        const bots = await listBots(db);
        await this.deps.notify.send(
          [
            "🤖 Bots:",
            ...bots.map((b) => `• ${b.slug} v${b.version} ${b.enabled ? "✅" : "⏹ disabled"}`),
          ].join("\n"),
        );
        return;
      }
      case "/pause_all": {
        const n = await pauseAll(db, "owner");
        await this.deps.notify.send(
          `⏸ Paused. ${n} task(s) stopped. No new actions will start. Send /resume to carry on.`,
        );
        return;
      }
      case "/resume": {
        const n = await resumeAll(db, "owner");
        await this.deps.notify.send(`▶️ Resumed. ${n} task(s) back in the queue.`);
        return;
      }
      case "/edit":
        await this.deps.notify.send(
          `To change ${args[0] ? `"${args[0]}"` : "a bot"}: edit bots/${args[0] ?? "<bot>"}.md on your computer and run pnpm bots:sync. Permission, budget and protected-action changes are owner-only (pnpm owner …); I can't make them.`,
        );
        return;
      case "/skills":
        await this.deps.notify.send(await this.skillsText());
        return;
      case "/skill": {
        const all = await this.allSkills();
        const skill = all.find((s) => s.fm.slug === args[0]?.toLowerCase());
        const request = args.slice(1).join(" ").trim();
        if (!skill || !request) {
          await this.deps.notify.send(
            "Usage: /skill <name> <your request>, e.g. /skill the-council should I hire a VA?\nSend /skills for the names.",
          );
          return;
        }
        await this.runSkill(skill, request, messageId);
        return;
      }
      case "/unlock":
        await this.unlock(args.join(" "), messageId);
        return;
      case "/lock":
        await lockSkills(db);
        await this.deps.notify.send("🔒 High-risk skills are locked again.");
        return;
      case "/risk":
        await this.setRisk(args[0]?.toLowerCase(), args[1]?.toLowerCase());
        return;
      default:
        await this.deps.notify.send(`I don't know ${cmd}. Send /help for commands.`);
    }
  }

  // ───────────────────────── skills ─────────────────────────

  private async allSkills(): Promise<Skill[]> {
    if (!this.deps.skills) return [];
    return loadAllSkills(this.deps.db, loadRepoSkills(this.deps.skills.dir));
  }

  private async enabledSkills(): Promise<Skill[]> {
    return (await this.allSkills()).filter((s) => s.fm.enabled);
  }

  private async skillsText(): Promise<string> {
    const all = await this.allSkills();
    if (!all.length) return "No skills are installed.";
    const unlocked = await isUnlocked(this.deps.db, "telegram");
    return [
      "🧠 Skills library (used automatically when a request fits):",
      ...all.map(
        (s) =>
          `• ${s.fm.slug}${s.fm.risk === "high" ? " 🔒" : ""}${s.fm.enabled ? "" : " ⏹ off"} — ${s.fm.description.slice(0, 90)}`,
      ),
      "",
      all.some((s) => s.fm.risk === "high")
        ? `🔒 = high-risk, needs /unlock <passcode> (${unlocked ? "unlocked now" : "locked now"}).`
        : "No skills are labelled high-risk. Use /risk <name> high to lock one behind the passcode.",
    ].join("\n");
  }

  /** Queue a skill run after the code checks (enabled, pause, passcode, budget). */
  /** The app conversation an owner message came from (app messages have negative ids). */
  private async conversationOf(messageId: number): Promise<string | null> {
    if (messageId >= 0) return null;
    const { rows } = await this.deps.db.query<{ conversation_id: string | null }>(
      "select conversation_id from chat_messages where id = $1",
      [-messageId],
    );
    return rows[0]?.conversation_id ?? null;
  }

  private async runSkill(skill: Skill, request: string, messageId: number): Promise<void> {
    const r = await dispatchSkill(this.deps.db, this.deps.policy, {
      skill,
      request,
      channel: "telegram",
      idempotencyKey: `tg:${messageId}:skill`,
      actor: "owner",
      conversationId: await this.conversationOf(messageId),
    });
    if (r.ok) {
      if (!r.duplicate)
        await this.deps.notify.send(
          `🧠 Using ${skill.fm.name}. I'll send the answer here shortly.`,
        );
      return;
    }
    if (r.reason === "locked") {
      if (!passcodeConfigured(this.deps.skills?.passcode)) {
        await this.deps.notify.send(
          `🔒 ${skill.fm.name} is labelled high-risk, but SKILLS_PASSCODE isn't set, so it can't be unlocked. Add it to the environment, or relabel the skill with /risk ${skill.fm.slug} standard after setting a passcode.`,
        );
        return;
      }
      await setState(this.deps.db, PENDING_SKILL, { slug: skill.fm.slug, request, messageId });
      await this.deps.notify.send(
        `${r.message}\nSend /unlock <passcode> and I'll run it straight away. (I delete the message with your passcode.)`,
      );
      return;
    }
    await this.deps.notify.send(r.message);
  }

  private async unlock(presented: string, messageId: number): Promise<void> {
    // Remove the passcode from the chat whatever the outcome.
    if (messageId && this.deps.notify.deleteOwnerMessage) {
      await this.deps.notify.deleteOwnerMessage(messageId).catch(() => undefined);
    }
    if (!presented.trim()) {
      await this.deps.notify.send("Usage: /unlock <passcode>");
      return;
    }
    const r = await tryUnlock(this.deps.db, "telegram", presented, this.deps.skills?.passcode);
    if (!r.ok) {
      const msg = {
        not_configured: "⚙️ No SKILLS_PASSCODE is set, so there's nothing to unlock.",
        wrong: "❌ That passcode isn't right.",
        locked_out: `⛔ Too many wrong attempts. Try again after ${r.retryAt?.toLocaleTimeString("en-AU", { timeZone: this.deps.tz, hour: "numeric", minute: "2-digit" }) ?? "15 minutes"}.`,
      }[r.reason];
      await this.deps.notify.send(msg);
      return;
    }
    await this.deps.notify.send(
      "🔓 High-risk skills unlocked for 30 minutes. /lock to lock them now.",
    );
    const pending = await getState<{ slug: string; request: string; messageId: number } | null>(
      this.deps.db,
      PENDING_SKILL,
    );
    if (pending) {
      await setState(this.deps.db, PENDING_SKILL, null);
      const skill = (await this.allSkills()).find((s) => s.fm.slug === pending.slug);
      if (skill) await this.runSkill(skill, pending.request, pending.messageId);
    }
  }

  /**
   * Owner labels a skill's risk. Locking (high) is always allowed; unlocking a skill (standard)
   * weakens a protection, so it needs the passcode session first.
   */
  private async setRisk(slug: string | undefined, level: string | undefined): Promise<void> {
    if (!slug || (level !== "high" && level !== "standard")) {
      await this.deps.notify.send("Usage: /risk <skill name> high|standard");
      return;
    }
    const all = await this.allSkills();
    const skill = all.find((s) => s.fm.slug === slug);
    if (!skill) {
      await this.deps.notify.send(`No skill called "${slug}". Send /skills for the list.`);
      return;
    }
    if (
      level === "standard" &&
      skill.fm.risk === "high" &&
      !(await isUnlocked(this.deps.db, "telegram"))
    ) {
      await this.deps.notify.send(
        "🔒 Removing the high-risk label needs your passcode first: /unlock <passcode>, then send this again.",
      );
      return;
    }
    const isRepo = skill.source === "repo";
    await setSkillSettings(this.deps.db, slug, { risk: level }, isRepo);
    await audit(this.deps.db, {
      actor: "owner",
      action: "skills.set_risk",
      target: slug,
      result: level,
    });
    await this.deps.notify.send(
      level === "high"
        ? `🔒 ${skill.fm.name} is now high-risk: it needs /unlock <passcode> before it runs.`
        : `✅ ${skill.fm.name} is now standard: it runs without the passcode.`,
    );
  }

  private async statusText(): Promise<string> {
    const db = this.deps.db;
    const paused = await isPaused(db);
    const active = await listTasks(
      db,
      ["queued", "running", "in_review", "revise", "awaiting_approval", "approved", "paused"],
      50,
    );
    const byStatus = active.reduce<Record<string, number>>(
      (m, t) => ((m[t.status] = (m[t.status] ?? 0) + 1), m),
      {},
    );
    const approvals = await pendingApprovals(db);
    const b = await budgetStatus(db, this.deps.policy, new Date(), this.deps.tz);
    return [
      paused ? "⏸ PAUSED — no new actions start until /resume." : "▶️ Running.",
      `Tasks: ${
        Object.entries(byStatus)
          .map(([s, n]) => `${s} ${n}`)
          .join(", ") || "none active"
      }`,
      `Waiting for approval: ${approvals.length}`,
      `Spend: A$${b.spentAud.toFixed(2)} of A$${b.hardStopAud.toFixed(2)} this month`,
    ].join("\n");
  }

  // ───────────────────────── approvals ─────────────────────────

  /** Send every pending approval that has not reached Telegram yet (idempotent). */
  async sendUnsentApprovals(): Promise<number> {
    const { rows } = await this.deps.db.query<{ id: string }>(
      "select id from approvals where status = 'pending' and telegram_message_id is null order by expires_at",
    );
    for (const { id } of rows) {
      const a = (await getApproval(this.deps.db, id))!;
      const messageId = await this.deps.notify.send(
        approvalMessage(a, this.deps.tz),
        approvalButtons(a.id),
      );
      await setTelegramMessageId(this.deps.db, a.id, messageId);
    }
    return rows.length;
  }

  private async resendApprovals() {
    const list = await pendingApprovals(this.deps.db);
    if (!list.length) {
      await this.deps.notify.send("Nothing is waiting for your approval.");
      return;
    }
    for (const a of list) {
      const messageId = await this.deps.notify.send(
        approvalMessage(a, this.deps.tz),
        approvalButtons(a.id),
      );
      await setTelegramMessageId(this.deps.db, a.id, messageId);
    }
  }

  /** Called only by the Telegram gateway after it has verified the press came from the owner. */
  async onApprovalButton(approvalId: string, action: ApprovalAction): Promise<string> {
    const a = await getApproval(this.deps.db, approvalId);
    if (!a) return "That approval no longer exists.";
    if (action === "edit") {
      if (a.status !== "pending") return `Already ${a.status}.`;
      await setState(this.deps.db, PENDING_EDIT, { approvalId });
      await this.deps.notify.send(
        "✏️ Reply with the changes you want. I'll redraft it and run the review again before it comes back to you.",
      );
      return "Send your changes";
    }
    const result = await decideApproval(
      this.deps.db,
      approvalId,
      action === "approve" ? "approved" : "rejected",
    );
    const label: Record<string, string> = {
      approved: "✅ Approved. It's queued for the publisher (live publishing arrives in Phase 2).",
      rejected: "❌ Rejected. Nothing will be published.",
      expired: "⌛ This approval had expired. Ask me to redraft it.",
      already_decided: `Already ${a.status}.`,
      not_found: "That approval no longer exists.",
    };
    if (
      a.telegram_message_id &&
      (result === "approved" || result === "rejected" || result === "expired")
    ) {
      await this.deps.notify.edit(
        Number(a.telegram_message_id),
        `${approvalMessage(a, this.deps.tz)}\n\n${label[result]}`,
      );
    }
    return label[result]!.slice(0, 190);
  }

  /** Owner pressed Edit then sent changes: reject the old approval, redraft through the full review. */
  private async applyOwnerEdit(approvalId: string, changes: string, messageId: number) {
    await setState(this.deps.db, PENDING_EDIT, null);
    const a = await getApproval(this.deps.db, approvalId);
    if (!a || a.status !== "pending") {
      await this.deps.notify.send("That approval is no longer pending, so I didn't change it.");
      return;
    }
    await decideApproval(this.deps.db, approvalId, "rejected");
    const old = await this.deps.db.query<{
      inputs: Record<string, unknown>;
      workspace: string | null;
    }>(
      "select t.inputs, w.slug as workspace from tasks t left join workspaces w on w.id = t.workspace_id where t.id = $1",
      [a.task_id],
    );
    const prev = old.rows[0]!;
    const { task } = await createTask(this.deps.db, {
      bot: "chief-of-staff",
      kind: "draft_post",
      workspace: prev.workspace,
      parentTaskId: a.task_id,
      inputs: {
        brief: `${prev.inputs.brief as string}\n\nPrevious draft:\n${(a.preview as { text: string }).text}\n\nOwner's requested changes: ${changes}`,
        scheduled_for: prev.inputs.scheduled_for ?? null,
      },
      idempotencyKey: `tg:${messageId}:edit`,
      actor: "owner",
    });
    await this.deps.notify.send(
      `✏️ Got it. Redrafting (task ${task.id.slice(0, 8)}); it goes through review again before it comes back to you.`,
    );
  }

  // ───────────────────────── events ─────────────────────────

  async onTaskEvent(e: TaskEvent): Promise<void> {
    switch (e.type) {
      case "task.failed":
        if (e.task.kind === "skill_run" && e.task.inputs.run_id) {
          await this.deps.db.query(
            "update skill_runs set status = 'failed', error = coalesce(error, $2), finished_at = coalesce(finished_at, now()) where id = $1",
            [e.task.inputs.run_id, e.reason],
          );
        }
        await this.deps.notify.send(
          `❌ Task failed after ${e.attempts} attempt(s): ${e.task.kind}${e.task.workspace_slug ? ` · ${e.task.workspace_slug}` : ""}\nReason: ${e.reason}`,
        );
        return;
      case "task.blocked_budget":
        await this.deps.notify.send(
          `⛔ Task stopped by the budget gateway: ${e.task.kind}\n${e.reason}`,
        );
        return;
      case "task.halted":
        if (e.status === "awaiting_approval") await this.sendUnsentApprovals();
        return;
      default:
        return;
    }
  }

  async onExpiredApprovals(count: number): Promise<void> {
    if (count)
      await this.deps.notify.send(
        `⌛ ${count} approval(s) expired without a decision. Ask me to redraft if you still want them.`,
      );
  }
}
