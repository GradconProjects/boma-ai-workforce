import {
  budgetStatus,
  formatLocal,
  pendingApprovals,
  type Policy,
  type Queryable,
} from "@boma/core";

/**
 * Morning brief (07:30) and evening report (18:00). Templated from the database: no LLM, A$0,
 * so they keep working even when the budget stop is reached.
 */

async function taskCounts(db: Queryable, since: Date) {
  const { rows } = await db.query<{ status: string; n: string }>(
    `select to_status as status, count(distinct task_id) as n from task_events
      where created_at >= $1 and to_status in ('done', 'failed', 'expired', 'approved', 'cancelled')
      group by to_status`,
    [since],
  );
  return Object.fromEntries(rows.map((r) => [r.status, Number(r.n)])) as Record<string, number>;
}

async function recentFailures(db: Queryable, since: Date) {
  const { rows } = await db.query<{ kind: string; last_error: string | null }>(
    "select kind, last_error from tasks where status = 'failed' and updated_at >= $1 order by updated_at desc limit 5",
    [since],
  );
  return rows;
}

export async function morningBrief(
  db: Queryable,
  policy: Policy,
  tz: string,
  now = new Date(),
): Promise<string> {
  const since = new Date(now.getTime() - 24 * 3600_000);
  const counts = await taskCounts(db, since);
  const failures = await recentFailures(db, since);
  const approvals = await pendingApprovals(db);
  const budget = await budgetStatus(db, policy, now, tz);
  return [
    `☀️ Morning brief · ${formatLocal(now, tz)}`,
    `Done yesterday: ${counts.done ?? 0} · Approved: ${counts.approved ?? 0} · Failed: ${counts.failed ?? 0} · Expired: ${counts.expired ?? 0}`,
    `Waiting for your approval: ${approvals.length}${approvals.length ? " (/approvals)" : ""}`,
    ...failures.map((f) => `❌ ${f.kind}: ${f.last_error ?? "unknown error"}`),
    budget.stopped
      ? "⛔ AI budget stop reached: no new paid work this month (see Spend)."
      : budget.warn
        ? "⚠️ AI spend has passed the warning level (see Spend)."
        : "",
    "Scheduled today: nothing scheduled (publishing arrives in Phase 2).",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function eveningReport(
  db: Queryable,
  policy: Policy,
  tz: string,
  now = new Date(),
): Promise<string> {
  const since = new Date(now.getTime() - 12 * 3600_000);
  const counts = await taskCounts(db, since);
  const approvals = await pendingApprovals(db);
  const budget = await budgetStatus(db, policy, now, tz);
  return [
    `🌙 Evening report · ${formatLocal(now, tz)}`,
    `Today: ${counts.done ?? 0} done, ${counts.approved ?? 0} approved, ${counts.failed ?? 0} failed.`,
    approvals.length
      ? `Needs a decision: ${approvals.length} approval(s) — /approvals`
      : "Nothing needs a decision.",
    budget.stopped ? "⛔ AI budget stop reached (see Spend)." : "",
  ]
    .filter(Boolean)
    .join("\n");
}
