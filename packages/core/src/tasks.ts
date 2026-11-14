import { audit, withTx, type Queryable } from "./db";

/** Task lifecycle (spec §7.1). */
export const TASK_STATUSES = [
  "queued",
  "planned",
  "running",
  "in_review",
  "revise",
  "awaiting_approval",
  "approved",
  "executing",
  "verifying",
  "done",
  "failed",
  "expired",
  "paused",
  "cancelled",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TERMINAL: ReadonlySet<TaskStatus> = new Set([
  "done",
  "failed",
  "expired",
  "cancelled",
]);

/** Statuses a worker may pick up and continue. */
export const CLAIMABLE: TaskStatus[] = [
  "queued",
  "running",
  "in_review",
  "revise",
  "approved",
  "executing",
  "verifying",
];

const ACTIVE: TaskStatus[] = [
  "queued",
  "planned",
  "running",
  "in_review",
  "revise",
  "awaiting_approval",
  "approved",
  "executing",
  "verifying",
];

const T: Record<TaskStatus, TaskStatus[]> = {
  queued: ["planned", "running", "failed", "cancelled", "paused"],
  planned: ["running", "queued", "cancelled", "paused"],
  running: [
    "in_review",
    "awaiting_approval",
    "verifying",
    "done",
    "failed",
    "queued",
    "cancelled",
    "paused",
  ],
  in_review: [
    "revise",
    "awaiting_approval",
    "running",
    "done",
    "failed",
    "queued",
    "cancelled",
    "paused",
  ],
  revise: ["running", "in_review", "failed", "queued", "cancelled", "paused"],
  awaiting_approval: ["approved", "expired", "cancelled", "failed", "paused"],
  approved: ["executing", "done", "expired", "cancelled", "paused"],
  executing: ["verifying", "done", "failed", "queued", "cancelled", "paused"],
  verifying: ["done", "failed", "queued", "paused"],
  paused: [...ACTIVE, "cancelled"],
  done: [],
  failed: [],
  expired: [],
  cancelled: [],
};

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return T[from].includes(to);
}

export class InvalidTransitionError extends Error {}
export class LostLeaseError extends Error {}

export interface Checkpoint {
  done: string[];
  data: Record<string, unknown>;
}

export interface TaskRow {
  id: string;
  parent_task_id: string | null;
  workspace_id: string | null;
  bot_id: string;
  bot_version_id: string;
  from_bot_id: string | null;
  kind: string;
  status: TaskStatus;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown> | null;
  evidence: Record<string, unknown> | null;
  checkpoint: Checkpoint | null;
  attempts: number;
  max_retries: number;
  deadline_at: Date | null;
  est_cost_aud: string;
  actual_cost_aud: string;
  approval_id: string | null;
  idempotency_key: string;
  locked_by: string | null;
  locked_at: Date | null;
  next_attempt_at: Date | null;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
  // joined
  bot_slug: string;
  workspace_slug: string | null;
}

const SELECT = `select t.*, b.slug as bot_slug, w.slug as workspace_slug
  from tasks t join bots b on b.id = t.bot_id left join workspaces w on w.id = t.workspace_id`;

export interface NewTask {
  bot: string;
  kind: string;
  inputs?: Record<string, unknown>;
  workspace?: string | null;
  parentTaskId?: string | null;
  fromBot?: string | null;
  idempotencyKey: string;
  deadlineAt?: Date | null;
  estCostAud?: number;
  maxRetries?: number;
  actor: string;
}

export async function getTask(db: Queryable, id: string): Promise<TaskRow> {
  const { rows } = await db.query<TaskRow>(`${SELECT} where t.id = $1`, [id]);
  if (!rows[0]) throw new Error(`Task ${id} not found`);
  return rows[0];
}

/**
 * Create a task pinned to the bot's current version. Idempotent: the same key returns the
 * existing task instead of creating a second one.
 */
export async function createTask(
  db: Queryable,
  t: NewTask,
): Promise<{ task: TaskRow; created: boolean }> {
  return withTx(db, async (c) => {
    const bot = await c.query<{
      id: string;
      current_version_id: string | null;
      enabled: boolean;
      max_retries: number;
    }>(
      `select b.id, b.current_version_id, b.enabled,
              coalesce((v.frontmatter->'budget'->>'max_retries')::int, 2) as max_retries
         from bots b left join bot_versions v on v.id = b.current_version_id where b.slug = $1`,
      [t.bot],
    );
    const b = bot.rows[0];
    if (!b?.current_version_id) throw new Error(`Bot "${t.bot}" is not synced`);
    if (!b.enabled) throw new Error(`Bot "${t.bot}" is disabled`);

    let workspaceId: string | null = null;
    if (t.workspace) {
      const ws = await c.query<{ id: string }>("select id from workspaces where slug = $1", [
        t.workspace,
      ]);
      if (!ws.rows[0]) throw new Error(`Workspace "${t.workspace}" does not exist`);
      workspaceId = ws.rows[0].id;
    }
    let fromBotId: string | null = null;
    if (t.fromBot) {
      const fb = await c.query<{ id: string }>("select id from bots where slug = $1", [t.fromBot]);
      fromBotId = fb.rows[0]?.id ?? null;
    }

    const ins = await c.query<{ id: string }>(
      `insert into tasks (parent_task_id, workspace_id, bot_id, bot_version_id, from_bot_id, kind,
                          inputs, idempotency_key, deadline_at, est_cost_aud, max_retries)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       on conflict (idempotency_key) do nothing returning id`,
      [
        t.parentTaskId ?? null,
        workspaceId,
        b.id,
        b.current_version_id,
        fromBotId,
        t.kind,
        t.inputs ?? {},
        t.idempotencyKey,
        t.deadlineAt ?? null,
        t.estCostAud ?? 0,
        t.maxRetries ?? b.max_retries,
      ],
    );
    if (!ins.rows[0]) {
      const existing = await c.query<TaskRow>(`${SELECT} where t.idempotency_key = $1`, [
        t.idempotencyKey,
      ]);
      return { task: existing.rows[0]!, created: false };
    }
    const id = ins.rows[0].id;
    await c.query(
      "insert into task_events (task_id, from_status, to_status, actor, note) values ($1, null, 'queued', $2, $3)",
      [id, t.actor, `created ${t.kind}`],
    );
    await audit(c, {
      actor: t.actor,
      action: "task.create",
      target: `task:${id}`,
      inputs: t.inputs ?? {},
      result: "ok",
    });
    return { task: await getTask(c, id), created: true };
  });
}

export interface TransitionPatch {
  outputs?: Record<string, unknown>;
  evidence?: Record<string, unknown>;
  lastError?: string | null;
  approvalId?: string;
}

export async function transition(
  db: Queryable,
  id: string,
  to: TaskStatus,
  actor: string,
  note?: string,
  patch: TransitionPatch = {},
): Promise<TaskRow> {
  return withTx(db, async (c) => {
    const cur = await c.query<{ status: TaskStatus }>(
      "select status from tasks where id = $1 for update",
      [id],
    );
    const from = cur.rows[0]?.status;
    if (!from) throw new Error(`Task ${id} not found`);
    if (!canTransition(from, to))
      throw new InvalidTransitionError(`Task ${id}: ${from} → ${to} is not allowed`);
    await c.query(
      `update tasks set status = $2, updated_at = now(),
         outputs = coalesce($3, outputs), evidence = coalesce($4, evidence),
         last_error = case when $5::boolean then $6 else last_error end,
         approval_id = coalesce($7, approval_id)
       where id = $1`,
      [
        id,
        to,
        patch.outputs ?? null,
        patch.evidence ?? null,
        patch.lastError !== undefined,
        patch.lastError ?? null,
        patch.approvalId ?? null,
      ],
    );
    await c.query(
      "insert into task_events (task_id, from_status, to_status, actor, note) values ($1, $2, $3, $4, $5)",
      [id, from, to, actor, note ?? null],
    );
    await audit(c, { actor, action: `task.${to}`, target: `task:${id}`, result: note ?? "ok" });
    return getTask(c, id);
  });
}

/**
 * Claim one task. Tasks whose lease has lapsed (worker crashed) are reclaimed, whatever
 * status they were in, and resume from their checkpoint (E1).
 */
export async function claimTask(
  db: Queryable,
  workerId: string,
  kinds: string[],
  leaseSeconds = 600,
): Promise<TaskRow | null> {
  const { rows } = await db.query<{ id: string }>(
    `update tasks set locked_by = $1, locked_at = now(), updated_at = now()
      where id = (
        select id from tasks
         where status = any($2::text[]) and kind = any($3::text[])
           and (next_attempt_at is null or next_attempt_at <= now())
           and (locked_at is null or locked_at < now() - make_interval(secs => $4))
         order by created_at
         for update skip locked limit 1)
      returning id`,
    [workerId, CLAIMABLE, kinds, leaseSeconds],
  );
  return rows[0] ? getTask(db, rows[0].id) : null;
}

/** Save progress and renew the lease. Fails if another worker has taken the task over. */
export async function saveCheckpoint(
  db: Queryable,
  id: string,
  workerId: string,
  cp: Checkpoint,
): Promise<void> {
  const r = await db.query(
    "update tasks set checkpoint = $3, locked_at = now(), updated_at = now() where id = $1 and locked_by = $2",
    [id, workerId, cp],
  );
  if (r.rowCount === 0) throw new LostLeaseError(`Lost lease on task ${id}`);
}

export async function releaseLock(db: Queryable, id: string, workerId: string): Promise<void> {
  await db.query(
    "update tasks set locked_by = null, locked_at = null where id = $1 and locked_by = $2",
    [id, workerId],
  );
}

/** Put a failed attempt back in the queue with exponential backoff. */
export async function scheduleRetry(
  db: Queryable,
  id: string,
  workerId: string,
  error: string,
  backoffSeconds: number,
) {
  await transition(db, id, "queued", "system", `retry after error: ${error}`, { lastError: error });
  await db.query(
    `update tasks set attempts = attempts + 1, next_attempt_at = now() + make_interval(secs => $3),
       locked_by = null, locked_at = null where id = $1 and (locked_by = $2 or locked_by is null)`,
    [id, workerId, backoffSeconds],
  );
}

export async function listTasks(
  db: Queryable,
  statuses: TaskStatus[],
  limit = 20,
): Promise<TaskRow[]> {
  const { rows } = await db.query<TaskRow>(
    `${SELECT} where t.status = any($1::text[]) order by t.updated_at desc limit $2`,
    [statuses, limit],
  );
  return rows;
}
