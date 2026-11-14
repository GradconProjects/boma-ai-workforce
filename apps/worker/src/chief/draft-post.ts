import {
  createApproval,
  formatLocal,
  getApproval,
  Halt,
  type Policy,
  type Queryable,
  type TaskHandler,
} from "@boma/core";
import type { ModelRef } from "@boma/llm";
import type { DualReviewer, ReviewOutcome } from "@boma/review";
import { getWorkspaceRules } from "../workspaces";
import type { Notifier } from "./notifier";

/**
 * Option B (spec §5): the Chief drafts post text, the dual review checks it, the owner approves
 * on Telegram. The Chief can never publish; an approved task waits for the publisher bot.
 */

export interface DraftPostDeps {
  db: Queryable;
  policy: Policy;
  reviewer: DualReviewer;
  notify: Notifier;
  models: { planner: ModelRef; checker: ModelRef; checkerStrong?: ModelRef };
  limits: {
    chiefMonthlyAud: number;
    reviewMonthlyAud: number;
    taskMaxAud: number;
    chiefBotId: string;
  };
  tz: string;
}

export interface DraftPostInputs {
  brief: string;
  scheduled_for?: string | null;
  source_material?: { source: string; content: string }[];
}

type ReviewResult =
  | { kind: "ready"; text: string; evidence: string; costAud: number }
  | { kind: "owner_decision"; text: string; report: string; costAud: number };

const totalCost = (o: ReviewOutcome) => o.rounds.reduce((s, r) => s + r.costAud, 0);

export function draftPostHandler(deps: DraftPostDeps): TaskHandler {
  return {
    kind: "draft_post",
    steps: [
      {
        name: "review",
        run: async (ctx) => {
          const inputs = ctx.task.inputs as unknown as DraftPostInputs;
          const workspace = ctx.task.workspace_slug ?? "personal";
          const rules = await getWorkspaceRules(deps.db, workspace);
          await ctx.setStatus("in_review", "dual review started");

          const outcome = await deps.reviewer.run(
            {
              taskId: ctx.task.id,
              workspace,
              targetAccount: null, // the publisher attaches the Page in Phase 2
              brief: inputs.brief,
              untrustedInputs: inputs.source_material ?? [],
              claimRegister: rules.claim_register,
              bannedPatterns: rules.banned_patterns,
              workspaceNotes: rules.notes,
              rubricExtras: [],
              platform: { name: "Facebook Page post", maxChars: 1500 },
              makerGuidance: `Write one Facebook Page post for ${rules.name}. Use a short hook, plain English, and one clear call to action.`,
            },
            {
              maker: deps.models.planner,
              checker: deps.models.checker,
              checkerStrong: deps.models.checkerStrong,
              maxRounds: deps.policy.dual_review.max_revision_rounds,
              deadline: ctx.task.deadline_at ?? new Date(Date.now() + 6 * 3600_000),
              budget: {
                makerScope: "bot:chief-of-staff",
                botId: deps.limits.chiefBotId,
                makerMonthlyAud: deps.limits.chiefMonthlyAud,
                reviewMonthlyAud: deps.limits.reviewMonthlyAud,
                taskMaxAud: deps.limits.taskMaxAud,
                actor: "bot:chief-of-staff",
              },
            },
          );

          switch (outcome.status) {
            case "pass":
              return {
                kind: "ready",
                text: outcome.output.text,
                evidence: outcome.evidenceLine,
                costAud: totalCost(outcome),
              } satisfies ReviewResult;
            case "injection":
              // Spec 02 §5: pause the task, alert the owner, quarantine the content (not stored).
              await deps.notify.send(
                `🚨 Possible prompt injection in material for task "${inputs.brief.slice(0, 80)}".\n${outcome.detail}\nThe task is paused and its content quarantined. Nothing was sent anywhere.`,
              );
              return new Halt("paused", `injection detected: ${outcome.detail}`);
            case "fail":
              return new Halt("failed", `review failed: ${outcome.reason}`, {
                lastError: outcome.reason,
              });
            case "disagreement":
              return {
                kind: "owner_decision",
                text: outcome.output.text,
                report: [
                  "⚠️ Claude and OpenAI did not agree after 2 rounds.",
                  `Checker's view: ${outcome.checkerSummary}`,
                  "Unresolved:",
                  ...outcome.unresolved.map((i) => `• [${i.severity}] ${i.problem}`),
                  "Approve only if you're happy to publish it as it is.",
                ].join("\n"),
                costAud: totalCost(outcome),
              } satisfies ReviewResult;
            case "owner_decision_needed":
              if (!outcome.output)
                return new Halt("failed", outcome.reason, { lastError: outcome.reason });
              return {
                kind: "owner_decision",
                text: outcome.output.text,
                report: `⚠️ ${outcome.reason}. It has NOT been fully dual-reviewed. Approve to accept single review, or reject to cancel.`,
                costAud: totalCost(outcome),
              } satisfies ReviewResult;
          }
        },
      },
      {
        name: "approval",
        run: async (ctx) => {
          const r = ctx.data.review as ReviewResult;
          const inputs = ctx.task.inputs as unknown as DraftPostInputs;
          const workspace = ctx.task.workspace_slug ?? "personal";
          const rules = await getWorkspaceRules(deps.db, workspace);
          const scheduledAt = inputs.scheduled_for ? new Date(inputs.scheduled_for) : null;
          const validSchedule =
            scheduledAt && !Number.isNaN(scheduledAt.getTime()) ? scheduledAt : null;

          const approval = ctx.task.approval_id
            ? (await getApproval(deps.db, ctx.task.approval_id))!
            : await createApproval(deps.db, {
                taskId: ctx.task.id,
                content: { text: r.text, workspace, platform: "facebook_page" },
                preview: {
                  text: r.text,
                  workspace,
                  review: r.kind === "ready" ? r.evidence : r.report,
                  costAud: r.costAud,
                },
                policy: deps.policy,
                scheduledAt: validSchedule,
                actor: "bot:chief-of-staff",
              });
          return new Halt("awaiting_approval", `approval ${approval.id} requested (${rules.name})`);
        },
      },
    ],
  };
}

/** The Telegram message for an approval: exact preview, target, time, cost, reviewers' verdicts. */
export function approvalMessage(
  a: { preview: Record<string, unknown>; scheduled_at: Date | null; expires_at: Date },
  tz: string,
): string {
  const p = a.preview as { text: string; workspace: string; review: string; costAud: number };
  return [
    `📝 Approval needed · ${p.workspace} · Facebook Page post`,
    "",
    p.text,
    "",
    "──────────",
    p.review,
    `When: ${a.scheduled_at ? formatLocal(a.scheduled_at, tz) : "when published (not scheduled)"}`,
    `AI cost so far: A$${Number(p.costAud ?? 0).toFixed(3)} · Expires ${formatLocal(a.expires_at, tz)}`,
  ].join("\n");
}
