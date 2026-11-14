import { PROTECTED_ACTION_CAP, type Policy } from "./policy";

/**
 * The policy engine (CLAUDE.md rule 4): an LLM may propose, this code decides.
 * Pure function: callers load bot settings, unlocks and the pause flag, then ask.
 */

export interface OwnerUnlock {
  action: string;
  bot_slug: string;
  workspace_slug?: string | null;
  new_level: number;
  expires_at?: Date | null;
}

/** none = read/observe only; internal = drafts/tasks/messages to owner; external = touches the outside world. */
export type ActionEffect = "none" | "internal" | "external";

/** Actions no bot can ever take: they belong to the owner path (`pnpm owner ...`). */
export const OWNER_ONLY_ACTIONS = new Set([
  "change_bot_permissions",
  "raise_budget",
  "apply_bot_edit",
  "grant_account",
  "unlock_protected_action",
]);

/** Still allowed while /pause_all is in force, so the owner can see status and resume. */
export const ALLOWED_WHILE_PAUSED = new Set(["message_owner", "task_read"]);

export interface PolicyBot {
  slug: string;
  workspaces: string[];
  accounts: string[];
  actions: Record<string, number>;
}

export interface PolicyRequest {
  policy: Policy;
  bot: PolicyBot;
  action: string;
  effect: ActionEffect;
  workspace?: string | null;
  account?: string | null;
  unlocks?: OwnerUnlock[];
  paused: boolean;
  now?: Date;
}

export interface PolicyDecision {
  allowed: boolean;
  /** Level 3: may proceed only up to an approval checkpoint. */
  requiresApproval: boolean;
  /** Level 4: act, then tell the owner. */
  notifyOwner: boolean;
  level: number;
  reason: string;
}

const deny = (level: number, reason: string): PolicyDecision => ({
  allowed: false,
  requiresApproval: false,
  notifyOwner: false,
  level,
  reason,
});

export function effectiveLevel(req: PolicyRequest): number {
  const { policy, bot, action } = req;
  const now = req.now ?? new Date();
  const configured = bot.actions[action] ?? policy.defaults.new_action_level;
  if (!policy.protected_actions.includes(action)) return configured;
  const unlocked = (req.unlocks ?? []).some(
    (u) =>
      u.bot_slug === bot.slug &&
      u.action === action &&
      (u.workspace_slug == null || u.workspace_slug === req.workspace) &&
      (!u.expires_at || u.expires_at > now) &&
      u.new_level >= configured,
  );
  return unlocked ? configured : Math.min(configured, PROTECTED_ACTION_CAP);
}

export function decide(req: PolicyRequest): PolicyDecision {
  const { bot, action } = req;

  if (OWNER_ONLY_ACTIONS.has(action)) {
    return deny(0, `"${action}" is owner-only; bots can never do it (use pnpm owner)`);
  }
  if (req.paused && !ALLOWED_WHILE_PAUSED.has(action)) {
    return deny(0, "all work is paused (/pause_all)");
  }
  if (req.workspace && !bot.workspaces.includes(req.workspace)) {
    return deny(0, `${bot.slug} may not work in workspace "${req.workspace}"`);
  }
  if (req.account && !bot.accounts.includes(req.account)) {
    return deny(0, `${bot.slug} has no grant for account "${req.account}"`);
  }

  const level = effectiveLevel(req);
  if (level <= 1 && req.effect !== "none")
    return deny(level, `"${action}" is observe-only (level 1)`);
  if (level === 2 && req.effect === "external") {
    return deny(level, `"${action}" is prepare-only (level 2): drafts allowed, no external effect`);
  }
  const external = req.effect === "external";
  return {
    allowed: true,
    requiresApproval: external && level === 3,
    notifyOwner: level === 4,
    level,
    reason: external && level === 3 ? "allowed up to the approval checkpoint" : "allowed",
  };
}
