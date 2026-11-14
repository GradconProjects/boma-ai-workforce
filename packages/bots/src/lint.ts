import { findSecrets, PROTECTED_ACTION_CAP, type OwnerUnlock, type Policy } from "@boma/core";
import type { BotDefinition, BotFrontmatter } from "./schema";
import { KNOWN_TOOLS } from "./tools";

export type { OwnerUnlock };

/** Who produced this version. Only "owner" and "git-sync" may widen permissions. */
export type EditSource = "owner" | "git-sync" | "bot";

export interface LintContext {
  policy: Policy;
  unlocks?: OwnerUnlock[];
  previous?: BotFrontmatter;
  source?: EditSource;
  now?: Date;
}

export interface LintIssue {
  rule: string;
  message: string;
}

export interface LintReport {
  ok: boolean;
  errors: LintIssue[];
}

export function lintBot(bot: BotDefinition, ctx: LintContext): LintReport {
  const fm = bot.frontmatter;
  const errors: LintIssue[] = [];
  const now = ctx.now ?? new Date();
  const protectedSet = new Set(ctx.policy.protected_actions);

  // L1 — protected actions above level 3 need a live owner unlock (spec §8).
  for (const [action, level] of Object.entries(fm.actions)) {
    if (!protectedSet.has(action) || level <= PROTECTED_ACTION_CAP) continue;
    const unlocked = (ctx.unlocks ?? []).some(
      (u) =>
        u.action === action &&
        u.bot_slug === fm.slug &&
        u.new_level >= level &&
        (!u.expires_at || u.expires_at > now),
    );
    if (!unlocked) {
      errors.push({
        rule: "protected_action_above_cap",
        message: `"${action}" is protected and set to level ${level}; max is ${PROTECTED_ACTION_CAP} without an owner unlock`,
      });
    }
  }

  // L2 — review required ⇒ a checker exists and differs by provider from every maker role (R8).
  if (fm.review === "required") {
    const { checker, ...makers } = fm.models;
    const makerEntries = Object.entries(makers).filter(([, m]) => m !== undefined);
    if (makerEntries.length > 0 && !checker) {
      errors.push({ rule: "review_without_checker", message: "review is required but no checker model is set" });
    }
    if (checker) {
      for (const [role, m] of makerEntries) {
        if (m!.provider === checker.provider) {
          errors.push({
            rule: "same_provider_review",
            message: `${role} and checker both use "${checker.provider}"; dual review needs different providers`,
          });
        }
      }
    }
  }

  // L3 — no secrets in bot files.
  for (const f of findSecrets(bot.raw)) {
    errors.push({ rule: "secret_in_file", message: `line ${f.line}: looks like a ${f.pattern}; secrets belong in .env` });
  }

  // L4 — tools must be on the allow-list.
  for (const tool of fm.tools) {
    if (!KNOWN_TOOLS.has(tool)) {
      errors.push({ rule: "unknown_tool", message: `tool "${tool}" is not on the allowed list` });
    }
  }

  // L5 — a bot-proposed edit can never widen permissions (CLAUDE.md rule 6).
  if (ctx.source === "bot" && ctx.previous) {
    const prev = ctx.previous;
    const added = (now: string[], before: string[]) => now.filter((x) => !before.includes(x));
    for (const t of added(fm.tools, prev.tools))
      errors.push({ rule: "self_escalation", message: `bot edit adds tool "${t}"` });
    for (const a of added(fm.accounts, prev.accounts))
      errors.push({ rule: "self_escalation", message: `bot edit adds account "${a}"` });
    for (const w of added(fm.workspaces, prev.workspaces))
      errors.push({ rule: "self_escalation", message: `bot edit adds workspace "${w}"` });
    for (const [action, level] of Object.entries(fm.actions)) {
      const before = prev.actions[action] ?? ctx.policy.defaults.new_action_level;
      if (level > before)
        errors.push({ rule: "self_escalation", message: `bot edit raises "${action}" from ${before} to ${level}` });
    }
    for (const k of ["monthly_aud", "max_task_aud", "max_concurrency", "max_retries"] as const) {
      if (fm.budget[k] > prev.budget[k])
        errors.push({ rule: "self_escalation", message: `bot edit raises budget.${k}` });
    }
    if (fm.enabled && !prev.enabled)
      errors.push({ rule: "self_escalation", message: "bot edit enables the bot" });
  }

  // L6 — budget sanity.
  if (fm.budget.max_task_aud > fm.budget.monthly_aud) {
    errors.push({ rule: "budget_inconsistent", message: "max_task_aud exceeds monthly_aud" });
  }

  return { ok: errors.length === 0, errors };
}
