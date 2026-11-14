import {
  budgetStatus,
  createTask,
  decide,
  isPaused,
  type Policy,
  type Queryable,
} from "@boma/core";
import { isUnlocked, type UnlockChannel } from "./passcode";
import { attachRunTask, createRun } from "./repo";
import type { Skill } from "./schema";

/** Rough upper estimate of one skill run in A$ (full output allowance, incl. FX margin). */
export function estimateSkillAud(skill: Skill): number {
  const perKOut = skill.fm.model === "cheap" ? 0.0008 : 0.016; // A$ per 1K output tokens
  return Math.round((0.04 + (skill.fm.max_output_tokens / 1000) * perKOut) * 100) / 100;
}

export type DispatchResult =
  | { ok: true; runId: string; taskId: string; estimateAud: number; duplicate?: boolean }
  | { ok: false; reason: "locked" | "disabled" | "paused" | "budget"; message: string };

/**
 * Queue a skill run for the worker, after the same checks every other job gets: skill enabled,
 * system not paused, passcode unlocked for skills the owner labelled high-risk, enough budget.
 */
export async function dispatchSkill(
  db: Queryable,
  policy: Policy,
  o: {
    skill: Skill;
    request: string;
    channel: UnlockChannel;
    idempotencyKey: string;
    actor: string;
    /** Follow-up work for other bots once this skill has answered (Chief-led teamwork). */
    handoff?: unknown[];
    workspace?: string | null;
  },
): Promise<DispatchResult> {
  const { skill } = o;
  if (!skill.fm.enabled)
    return { ok: false, reason: "disabled", message: `${skill.fm.name} is switched off.` };
  const d = decide({
    policy,
    bot: { slug: "chief-of-staff", workspaces: [], accounts: [], actions: { run_skill: 2 } },
    action: "run_skill",
    effect: "internal",
    paused: await isPaused(db),
  });
  if (!d.allowed) return { ok: false, reason: "paused", message: `Not now: ${d.reason}.` };
  if (skill.fm.risk === "high" && !(await isUnlocked(db, o.channel))) {
    return {
      ok: false,
      reason: "locked",
      message: `🔒 ${skill.fm.name} is labelled high-risk. Unlock skills with your passcode first.`,
    };
  }
  const estimateAud = estimateSkillAud(skill);
  const b = await budgetStatus(db, policy);
  if (b.spentAud + estimateAud > b.hardStopAud) {
    return {
      ok: false,
      reason: "budget",
      message: `⛔ Budget: this needs about A$${estimateAud.toFixed(2)}; only A$${Math.max(0, b.hardStopAud - b.spentAud).toFixed(2)} is left this month.`,
    };
  }
  const runId = await createRun(db, {
    slug: skill.fm.slug,
    request: o.request,
    channel: o.channel,
  });
  const { task, created } = await createTask(db, {
    bot: "chief-of-staff",
    kind: "skill_run",
    workspace: o.workspace ?? null,
    inputs: {
      run_id: runId,
      slug: skill.fm.slug,
      request: o.request,
      channel: o.channel,
      ...(o.handoff?.length ? { handoff: o.handoff } : {}),
    },
    idempotencyKey: o.idempotencyKey,
    estCostAud: estimateAud,
    actor: o.actor,
  });
  if (!created) {
    // Replayed request (same idempotency key): keep the original run, drop the spare row.
    await db.query("delete from skill_runs where id = $1 and task_id is null", [runId]);
    return {
      ok: true,
      runId: String(task.inputs.run_id),
      taskId: task.id,
      estimateAud,
      duplicate: true,
    };
  }
  await attachRunTask(db, runId, task.id);
  return { ok: true, runId, taskId: task.id, estimateAud };
}
