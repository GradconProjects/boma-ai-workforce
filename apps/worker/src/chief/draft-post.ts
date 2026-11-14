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
  /** Simulation mode: outputs are labelled and never described as AI-reviewed. */
  simulated?: boolean;
}

export interface DraftPostInputs {
  brief: string;
  scheduled_for?: string | null;
  source_material?: { source: string; content: string }[];
}

type ReviewResult =
  | {
      kind: "ready";
      text: string;
      evidence: string;
      costAud: number;
      /** Clean pass: score and no major/critical issues (autopilot may approve it). */
      score?: number;
      clean?: boolean;
    }
  | { kind: "owner_decision"; text: string; report: string; costAud: number };

const totalCost = (o: ReviewOutcome) => o.rounds.reduce((s, r) => s + r.costAud, 0);

/** What kind of piece is being written (same review and approval flow for each). */
export interface ContentVariant {
  kind: string;
  platform: { name: string; maxChars: number };
  contentPlatform: string;
  label: string;
  guidance: (name: string, style: "standard" | "bold") => string;
  rubric: (style: "standard" | "bold") => string[];
  extraChecks?: (text: string) => string[];
}

export const FACEBOOK_POST: ContentVariant = {
  kind: "draft_post",
  platform: { name: "Facebook Page post", maxChars: 1500 },
  contentPlatform: "facebook_page",
  label: "Facebook Page post",
  guidance: (n, s) => postGuidance(n, s),
  rubric: (s) => postRubric(s),
};

export const BLOG_ARTICLE: ContentVariant = {
  kind: "write_article",
  platform: { name: "Blog article", maxChars: 9000 },
  contentPlatform: "blog",
  label: "Blog article",
  guidance: (n, s) => articleGuidance(n, s),
  rubric: (s) => [
    "Reads like a good blog article: a strong title, an opening that hooks, clear sections, a satisfying ending.",
    ...(s === "bold"
      ? [
          "Opinionated and provocative is WANTED: do not mark it down for taking a side on everyday topics. Fail it for invented facts, defamation, attacks on private people or protected groups, or exploiting tragedies.",
        ]
      : []),
  ],
  extraChecks: (text) =>
    /^#\s+\S/.test(text.trim())
      ? []
      : ["The first line must be the title as a Markdown heading: # Title"],
};

export function draftPostHandler(
  deps: DraftPostDeps,
  v: ContentVariant = FACEBOOK_POST,
): TaskHandler {
  return {
    kind: v.kind,
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
              rubricExtras: v.rubric(rules.style),
              platform: v.platform,
              makerGuidance: v.guidance(rules.name, rules.style),
              generalKnowledge: rules.general_knowledge,
              extraChecks: v.extraChecks,
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
                evidence: deps.simulated
                  ? "🧪 Simulated review: no AI model wrote or checked this."
                  : outcome.evidenceLine,
                costAud: totalCost(outcome),
                score: outcome.verdict.score,
                clean:
                  !deps.simulated &&
                  outcome.verdict.issues.every((i) => i.severity === "minor") &&
                  !outcome.verdict.injection_detected,
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
                content: { text: r.text, workspace, platform: v.contentPlatform },
                preview: {
                  text: r.text,
                  workspace,
                  label: v.label,
                  review: r.kind === "ready" ? r.evidence : r.report,
                  simulated: Boolean(deps.simulated),
                  costAud: r.costAud,
                  autopilot: r.kind === "ready" && r.clean ? { score: r.score ?? 0 } : null,
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
  const p = a.preview as {
    text: string;
    workspace: string;
    review: string;
    costAud: number;
    label?: string;
    simulated?: boolean;
  };
  return [
    ...(p.simulated
      ? [
          "🧪 SIMULATION — not real AI output; nothing here was written or checked by Claude or OpenAI.",
        ]
      : []),
    `📝 Approval needed · ${p.workspace} · ${p.label ?? "Facebook Page post"}`,
    "",
    p.text,
    "",
    "──────────",
    p.review,
    `When: ${a.scheduled_at ? formatLocal(a.scheduled_at, tz) : "when published (not scheduled)"}`,
    `Expires ${formatLocal(a.expires_at, tz)}`,
  ].join("\n");
}

/** How the maker writes posts: built to stop the scroll, start conversations and convert. */
export function postGuidance(name: string, style: "standard" | "bold" = "standard"): string {
  return [
    `Write one Facebook Page post for ${name}. Goal: engagement and conversion.`,
    "First line: a scroll-stopping hook (a surprising fact, a bold claim you can back up, a question, or a mini cliffhanger). Keep it under 15 words.",
    "Voice: write like a creator, not a corporate brand. Casual, witty and relatable for a younger audience (Gen Z and millennials): short punchy lines, current internet culture and meme formats where they fit, Aussie slang used naturally, emojis that add meaning (not a wall of them). Never stiff, salesy or 'LinkedIn'.",
    "Body: one idea, real specifics, give value or a laugh before asking for anything.",
    "End with a comment call to action: a genuine question people will want to answer (pick a side, share their experience, name their favourite). Then, if the brief includes a link, invite them to read more at the link.",
    "Never use engagement bait Facebook demotes ('comment YES', 'tag 5 friends', 'share if you agree').",
    ...(style === "bold"
      ? [
          "Style: BOLD. Take a clear, provocative stance; hot takes, 'unpopular opinion', myth-busting and this-vs-that debates are encouraged. Friendly rivalry (states, cities, food, sport) is fair game.",
          "Drama must be honest: no invented facts, statistics or quotes; no fake outrage; no attacks on real private people; nothing demeaning about race, religion, gender, disability or sexuality; no exploiting tragedies.",
        ]
      : []),
  ].join("\n");
}

/** Extra checks the reviewer applies to posts (the base rubric covers accuracy and claims). */
export function postRubric(style: "standard" | "bold" = "standard"): string[] {
  return [
    "Opens with a strong hook and ends with a genuine comment call to action (a question people want to answer).",
    "No engagement bait Facebook demotes ('comment YES', 'tag friends', 'share if you agree').",
    ...(style === "bold"
      ? [
          "Bold and provocative is WANTED here: do not mark a post down for being opinionated, cheeky or divisive about everyday topics.",
          "Fail it if the drama relies on invented facts, defamation, targeting a real private person, demeaning a protected group, or exploiting a tragedy.",
        ]
      : []),
  ];
}

/** How the maker writes blog articles. */
export function articleGuidance(name: string, style: "standard" | "bold" = "standard"): string {
  return [
    `Write one blog article for ${name}'s public blog, in Markdown.`,
    "First line: the title as '# Title' (curiosity-driven, under 70 characters, no clickbait lies). Then a 1-2 sentence hook, 3-5 sections with '## ' headings, and a short ending.",
    "Length: 500 to 800 words. Voice: a sharp, funny Australian creator writing for 18-35s: conversational, specific, a few well-placed jokes, no corporate filler.",
    "End with a question that invites readers to have their say on the Facebook page.",
    ...(style === "bold"
      ? [
          "Style: BOLD. Take a clear side, bust myths, compare and rank things, stir friendly rivalry. Honest drama only: no invented facts, statistics or quotes; no attacks on private people or protected groups; no exploiting tragedies.",
        ]
      : []),
  ].join("\n");
}
