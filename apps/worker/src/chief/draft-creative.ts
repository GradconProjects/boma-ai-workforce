import {
  createApproval,
  getApproval,
  Halt,
  type Policy,
  type Queryable,
  type TaskHandler,
} from "@boma/core";
import type { ModelRef } from "@boma/llm";
import type { DualReviewer, ReviewOutcome } from "@boma/review";
import {
  applyItemCopy,
  copyProblems,
  COPY_LIMITS,
  formatCopy,
  getBrand,
  parseCopy,
  setItemStatus,
} from "@boma/studio";
import { getWorkspaceRules, type WorkspaceRules } from "../workspaces";
import type { Notifier } from "./notifier";

/**
 * Campaign copy (Creative Studio ↔ Chief): the Chief writes copy for one campaign deliverable,
 * the dual review checks it, the copy is applied to the design, and the owner approves it on
 * Telegram or in the web Approval Centre.
 */

export interface DraftCreativeInputs {
  campaign_item_id: string;
  brand_id: string;
  format_title: string;
  channel: string;
  objective: string;
  audience: string;
  cta: string;
  owner_notes?: string;
}

export interface DraftCreativeDeps {
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
  simulated: boolean;
}

const EMPTY_RULES: WorkspaceRules = {
  name: "",
  notes: [],
  banned_patterns: [],
  style: "standard",
  general_knowledge: false,
  claim_register: [],
};
const cost = (o: ReviewOutcome) => o.rounds.reduce((s, r) => s + r.costAud, 0);

export function draftCreativeHandler(deps: DraftCreativeDeps): TaskHandler {
  return {
    kind: "draft_creative",
    steps: [
      {
        name: "review",
        run: async (ctx) => {
          const i = ctx.task.inputs as unknown as DraftCreativeInputs;
          const { brand, workspace } = await getBrand(deps.db, i.brand_id);
          const rules = workspace
            ? await getWorkspaceRules(deps.db, workspace)
            : { ...EMPTY_RULES, name: brand.name };
          await ctx.setStatus("in_review", "dual review started");

          const outcome = await deps.reviewer.run(
            {
              taskId: ctx.task.id,
              workspace: workspace ?? brand.name,
              brief: `Write on-design marketing copy for a ${i.format_title} (${i.channel}) for ${brand.name}. Campaign objective: ${i.objective}. Audience: ${i.audience}. Call to action: ${i.cta || "your choice"}.${i.owner_notes ? ` Owner's notes: ${i.owner_notes}` : ""}`,
              targetAccount: null,
              untrustedInputs: [],
              claimRegister: rules.claim_register,
              bannedPatterns: rules.banned_patterns,
              workspaceNotes: [
                ...rules.notes,
                `Brand tone: ${brand.tone}.`,
                `Brand tagline: ${brand.tagline}`,
              ],
              rubricExtras: [
                "Each line must fit its character limit and read well as large type on a design.",
              ],
              platform: { name: `${i.format_title} design`, maxChars: 600 },
              makerGuidance: [
                `You write short, striking copy for ${brand.name} (${brand.industry}).`,
                "Put the copy in `text` as exactly these labelled lines, nothing else:",
                ...Object.entries(COPY_LIMITS).map(
                  ([k, n]) => `${k.toUpperCase()}: (max ${n} characters)`,
                ),
                "EYEBROW is a short category label. HEADLINE is the hook. CTA is 2–4 words.",
              ].join("\n"),
              extraChecks: (text) => copyProblems(parseCopy(text)),
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

          if (outcome.status === "injection") {
            await setItemStatus(deps.db, i.campaign_item_id, "failed");
            await deps.notify.send(
              `🚨 Possible prompt injection while writing campaign copy. Task paused; content quarantined.\n${outcome.detail}`,
            );
            return new Halt("paused", `injection detected: ${outcome.detail}`);
          }
          if (
            outcome.status === "fail" ||
            (outcome.status === "owner_decision_needed" && !outcome.output)
          ) {
            await setItemStatus(deps.db, i.campaign_item_id, "failed");
            return new Halt("failed", `copy review failed: ${outcome.reason}`, {
              lastError: outcome.reason,
            });
          }
          const text = outcome.output!.text;
          const copy = parseCopy(text);
          const ready = outcome.status === "pass";
          await applyItemCopy(deps.db, {
            itemId: i.campaign_item_id,
            copy,
            status: ready ? "awaiting_approval" : "needs_decision",
            simulated: deps.simulated,
            actor: "bot:chief-of-staff",
          });
          const review = deps.simulated
            ? "🧪 Simulated review: no AI model wrote or checked this."
            : outcome.status === "pass"
              ? outcome.evidenceLine
              : outcome.status === "disagreement"
                ? `⚠️ Reviewers did not agree after 2 rounds. Unresolved: ${outcome.unresolved.map((x) => x.problem).join("; ")}`
                : `⚠️ ${outcome.reason}. Not fully dual-reviewed.`;
          return { text: formatCopy(copy), review, costAud: cost(outcome), brandName: brand.name };
        },
      },
      {
        name: "approval",
        run: async (ctx) => {
          const r = ctx.data.review as {
            text: string;
            review: string;
            costAud: number;
            brandName: string;
          };
          const i = ctx.task.inputs as unknown as DraftCreativeInputs;
          const approval = ctx.task.approval_id
            ? (await getApproval(deps.db, ctx.task.approval_id))!
            : await createApproval(deps.db, {
                taskId: ctx.task.id,
                content: { copy: r.text, campaign_item_id: i.campaign_item_id },
                preview: {
                  text: r.text,
                  workspace: r.brandName,
                  label: `${i.format_title} copy`,
                  review: r.review,
                  costAud: r.costAud,
                  simulated: deps.simulated,
                },
                policy: deps.policy,
                actor: "bot:chief-of-staff",
              });
          return new Halt("awaiting_approval", `approval ${approval.id} requested`);
        },
      },
    ],
  };
}
