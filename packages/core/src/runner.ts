import { BudgetBlockedError } from "./budget";
import type { Queryable } from "./db";
import { isPaused } from "./state";
import {
  getTask,
  LostLeaseError,
  releaseLock,
  saveCheckpoint,
  scheduleRetry,
  transition,
  type Checkpoint,
  type TaskRow,
  type TaskStatus,
  type TransitionPatch,
} from "./tasks";

/**
 * Step runner (spec §7.1). Each step's result is checkpointed; after a crash the task resumes
 * at the first unfinished step, so completed steps never run twice. Steps that touch the
 * outside world must still be idempotent (they may be interrupted mid-step).
 */

/** Returned by a step to stop the pipeline and move the task to a resting status. */
export class Halt {
  constructor(
    public status: TaskStatus,
    public note: string,
    public patch: TransitionPatch = {},
  ) {}
}

/** Thrown by a step for a failure that retrying cannot fix. */
export class PermanentError extends Error {}

export interface StepContext {
  db: Queryable;
  task: TaskRow;
  workerId: string;
  /** Results of earlier steps, by step name. */
  data: Record<string, unknown>;
  /** Move the task to an intermediate status (e.g. in_review) without stopping. */
  setStatus(status: TaskStatus, note?: string): Promise<void>;
}

export interface Step {
  name: string;
  run(ctx: StepContext): Promise<unknown>;
}

export interface TaskHandler {
  kind: string;
  steps: Step[];
}

export type TaskEvent =
  | { type: "task.failed"; task: TaskRow; reason: string; attempts: number }
  | { type: "task.retry"; task: TaskRow; reason: string; attempt: number }
  | { type: "task.blocked_budget"; task: TaskRow; reason: string }
  | { type: "task.halted"; task: TaskRow; status: TaskStatus; note: string }
  | { type: "task.done"; task: TaskRow };

export interface RunOptions {
  workerId: string;
  onEvent?: (e: TaskEvent) => Promise<void> | void;
  backoffSeconds?: (attempt: number) => number;
}

export type RunResult = "done" | "halted" | "paused" | "retry" | "failed" | "lost_lease";

const actorFor = (t: TaskRow) => `bot:${t.bot_slug}`;

export async function runTask(
  db: Queryable,
  claimed: TaskRow,
  handler: TaskHandler,
  opts: RunOptions,
): Promise<RunResult> {
  let task = claimed;
  // A failure while announcing an event (e.g. a notification) must never retry or fail the task.
  const emit = async (e: TaskEvent) => {
    try {
      await opts.onEvent?.(e);
    } catch (err) {
      console.error(
        `[runner] event handler failed for ${e.type}:`,
        err instanceof Error ? err.message : err,
      );
    }
  };
  const cp: Checkpoint = task.checkpoint ?? { done: [], data: {} };

  try {
    if (task.status === "queued")
      task = await transition(db, task.id, "running", actorFor(task), "started");

    const ctx: StepContext = {
      db,
      task,
      workerId: opts.workerId,
      data: cp.data,
      setStatus: async (status, note) => {
        const cur = await getTask(db, task.id);
        if (cur.status !== status)
          task = await transition(db, task.id, status, actorFor(task), note);
        ctx.task = task;
      },
    };

    for (const step of handler.steps) {
      if (cp.done.includes(step.name)) continue;
      if (await isPaused(db)) {
        await releaseLock(db, task.id, opts.workerId);
        return "paused";
      }
      const out = await step.run(ctx);
      if (out instanceof Halt) {
        await saveCheckpoint(db, task.id, opts.workerId, cp);
        const current = await getTask(db, task.id);
        task =
          current.status === out.status
            ? current // the step already moved it there (e.g. createApproval)
            : await transition(db, task.id, out.status, actorFor(task), out.note, out.patch);
        await releaseLock(db, task.id, opts.workerId);
        if (out.status === "failed") {
          await emit({ type: "task.failed", task, reason: out.note, attempts: task.attempts });
        } else {
          await emit({ type: "task.halted", task, status: out.status, note: out.note });
        }
        return "halted";
      }
      cp.data[step.name] = out ?? null;
      cp.done.push(step.name);
      await saveCheckpoint(db, task.id, opts.workerId, cp);
    }

    task = await transition(db, task.id, "done", actorFor(task), "all steps complete", {
      outputs: cp.data,
    });
    await releaseLock(db, task.id, opts.workerId);
    await emit({ type: "task.done", task });
    return "done";
  } catch (err) {
    if (err instanceof LostLeaseError) return "lost_lease";
    const reason = err instanceof Error ? err.message : String(err);
    const current = await getTask(db, task.id);

    if (err instanceof BudgetBlockedError) {
      await transition(db, task.id, "failed", "system", `budget: ${reason}`, { lastError: reason });
      await releaseLock(db, task.id, opts.workerId);
      await emit({ type: "task.blocked_budget", task: current, reason });
      return "failed";
    }

    const attempt = current.attempts + 1;
    if (!(err instanceof PermanentError) && attempt <= current.max_retries) {
      const backoff = opts.backoffSeconds?.(attempt) ?? Math.min(30 * 2 ** (attempt - 1), 600);
      await scheduleRetry(db, task.id, opts.workerId, reason, backoff);
      await emit({ type: "task.retry", task: current, reason, attempt });
      return "retry";
    }
    await db.query("update tasks set attempts = $2 where id = $1", [task.id, attempt]);
    const failed = await transition(db, task.id, "failed", "system", reason, { lastError: reason });
    await releaseLock(db, task.id, opts.workerId);
    await emit({ type: "task.failed", task: failed, reason, attempts: attempt });
    return "failed";
  }
}
