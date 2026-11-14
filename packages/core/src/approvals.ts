import { audit, hashOf, withTx, type Queryable } from "./db";
import type { Policy } from "./policy";
import { transition } from "./tasks";

/**
 * Approvals (spec §9). An approval binds to content_hash + target + scheduled_at; any change
 * needs a new approval. Approvals expire.
 */

export interface ApprovalRow {
  id: string;
  task_id: string;
  content_hash: string;
  target_account_id: string | null;
  scheduled_at: Date | null;
  preview: Record<string, unknown>;
  status: "pending" | "approved" | "rejected" | "expired";
  decided_at: Date | null;
  expires_at: Date;
  telegram_message_id: string | null;
}

/** Canonical hash of the exact content being approved (text, media, link, ...). */
export function contentHash(content: Record<string, unknown>): string {
  return hashOf(content);
}

export function approvalExpiry(policy: Policy, now: Date, scheduledAt?: Date | null): Date {
  const h = 3600_000;
  return scheduledAt
    ? new Date(scheduledAt.getTime() + policy.approvals.expire_after_scheduled_hours * h)
    : new Date(now.getTime() + policy.approvals.expire_unscheduled_hours * h);
}

export async function createApproval(
  db: Queryable,
  a: {
    taskId: string;
    content: Record<string, unknown>;
    preview: Record<string, unknown>;
    policy: Policy;
    targetAccountId?: string | null;
    scheduledAt?: Date | null;
    actor: string;
    now?: Date;
  },
): Promise<ApprovalRow> {
  const now = a.now ?? new Date();
  const hash = contentHash(a.content);
  const { rows } = await db.query<ApprovalRow>(
    `insert into approvals (task_id, content_hash, target_account_id, scheduled_at, preview, expires_at)
     values ($1, $2, $3, $4, $5, $6) returning *`,
    [
      a.taskId,
      hash,
      a.targetAccountId ?? null,
      a.scheduledAt ?? null,
      a.preview,
      approvalExpiry(a.policy, now, a.scheduledAt),
    ],
  );
  const approval = rows[0]!;
  await transition(db, a.taskId, "awaiting_approval", a.actor, "approval requested", {
    approvalId: approval.id,
  });
  await audit(db, {
    actor: a.actor,
    action: "approval.request",
    target: `approval:${approval.id}`,
    outputs: hash,
    result: "ok",
  });
  return approval;
}

export async function getApproval(db: Queryable, id: string): Promise<ApprovalRow | undefined> {
  const { rows } = await db.query<ApprovalRow>("select * from approvals where id = $1", [id]);
  return rows[0];
}

export type DecisionResult = "approved" | "rejected" | "expired" | "already_decided" | "not_found";

/**
 * Record the owner's decision. Callers must already have verified the decision came from the
 * owner (Telegram owner ID check); `actor` is recorded as "owner".
 */
export async function decideApproval(
  db: Queryable,
  id: string,
  decision: "approved" | "rejected",
  now = new Date(),
  by: { actor: string; note: string } = { actor: "owner", note: "on Telegram" },
): Promise<DecisionResult> {
  const result = await withTx(db, async (c) => {
    const { rows } = await c.query<ApprovalRow>(
      "select * from approvals where id = $1 for update",
      [id],
    );
    const a = rows[0];
    if (!a) return "not_found" as const;
    if (a.status !== "pending") return "already_decided" as const;
    if (a.expires_at <= now) {
      await c.query("update approvals set status = 'expired', decided_at = $2 where id = $1", [
        id,
        now,
      ]);
      return "expired" as const;
    }
    await c.query("update approvals set status = $2, decided_at = $3 where id = $1", [
      id,
      decision,
      now,
    ]);
    return decision;
  });
  const approval = await getApproval(db, id);
  // Task history accepts owner/system/bot actors; an owner-set rule is recorded as system.
  const eventActor = by.actor.startsWith("policy:") ? "system" : by.actor;
  if (approval) {
    if (result === "approved")
      await transition(db, approval.task_id, "approved", eventActor, `approved ${by.note}`);
    if (result === "rejected")
      await transition(db, approval.task_id, "cancelled", eventActor, `rejected ${by.note}`);
    if (result === "expired")
      await transition(db, approval.task_id, "expired", "system", "approval expired");
  }
  await audit(db, {
    actor: by.actor,
    action: `approval.${decision}`,
    target: `approval:${id}`,
    result,
  });
  return result;
}

/** Expire every pending approval past its expiry; their tasks become `expired`. */
export async function expireDueApprovals(db: Queryable, now = new Date()): Promise<number> {
  const { rows } = await db.query<{ id: string; task_id: string }>(
    "update approvals set status = 'expired', decided_at = $1 where status = 'pending' and expires_at <= $1 returning id, task_id",
    [now],
  );
  for (const r of rows) {
    const t = await db.query<{ status: string }>("select status from tasks where id = $1", [
      r.task_id,
    ]);
    if (t.rows[0]?.status === "awaiting_approval")
      await transition(db, r.task_id, "expired", "system", "approval expired");
  }
  return rows.length;
}

export async function setTelegramMessageId(
  db: Queryable,
  id: string,
  messageId: number,
): Promise<void> {
  await db.query("update approvals set telegram_message_id = $2 where id = $1", [id, messageId]);
}

export async function pendingApprovals(db: Queryable): Promise<ApprovalRow[]> {
  const { rows } = await db.query<ApprovalRow>(
    "select * from approvals where status = 'pending' order by expires_at",
  );
  return rows;
}
