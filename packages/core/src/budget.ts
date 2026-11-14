import { audit, withTx, type Queryable } from "./db";
import type { Policy } from "./policy";
import { DEFAULT_TZ, monthKey, monthStartUtc } from "./time";

/**
 * Budget ledger (spec §10). Every paid call: estimate → reserve → call → reconcile.
 * Committed spend = actual + open reservations. A reservation that would push the company
 * past the hard stop, or a scope/task past its limit, is refused before any call is made.
 */

export type BudgetScope = "dual-review" | `bot:${string}`;

export type BlockReason = "company_hard_stop" | "scope_monthly" | "task_max";

export class BudgetBlockedError extends Error {
  constructor(
    public reason: BlockReason,
    message: string,
  ) {
    super(message);
  }
}

export interface BudgetLimits {
  hardStopAud: number;
  warnAud: number;
  /** Monthly limit for the scope being charged (bot allocation or dual-review). */
  scopeMonthlyAud?: number;
  /** Per-task maximum for the bot (frontmatter budget.max_task_aud). */
  taskMaxAud?: number;
}

export interface Reservation {
  id: string;
  scope: BudgetScope;
  taskId: string | null;
  botId: string | null;
  provider: string;
  amountAud: number;
}

const round4 = (n: number) => Math.round(n * 10000) / 10000;

export async function committedAud(
  db: Queryable,
  opts: { since: Date; scope?: BudgetScope; taskId?: string },
): Promise<number> {
  const conds = ["created_at >= $1"];
  const args: unknown[] = [opts.since];
  if (opts.scope) {
    args.push(opts.scope);
    conds.push(`scope = $${args.length}`);
  }
  if (opts.taskId) {
    args.push(opts.taskId);
    conds.push(`task_id = $${args.length}`);
  }
  const { rows } = await db.query<{ total: string }>(
    `select coalesce(sum(case kind when 'release' then -amount_aud else amount_aud end), 0) as total
       from budget_ledger where ${conds.join(" and ")}`,
    args,
  );
  return Number(rows[0]!.total);
}

/** Company limits: policy.yaml, optionally lowered by the owner via budget_limits. */
export async function companyLimits(
  db: Queryable,
  policy: Policy,
): Promise<{ hardStopAud: number; warnAud: number }> {
  const { rows } = await db.query<{ monthly_aud: string; warn_aud: string | null }>(
    "select monthly_aud, warn_aud from budget_limits where scope = 'company'",
  );
  const owner = rows[0];
  const ceiling = policy.budget.safety_buffer_below;
  const hardStop = Math.min(
    owner ? Number(owner.monthly_aud) : policy.budget.hard_stop_at,
    ceiling - 0.01,
  );
  const warn = owner?.warn_aud != null ? Number(owner.warn_aud) : policy.budget.warn_at;
  return { hardStopAud: hardStop, warnAud: Math.min(warn, hardStop) };
}

/** Monthly limit for a scope: owner override in budget_limits, else the given default. */
export async function scopeLimit(
  db: Queryable,
  scope: BudgetScope,
  fallback: number,
): Promise<number> {
  const { rows } = await db.query<{ monthly_aud: string }>(
    "select monthly_aud from budget_limits where scope = $1",
    [scope === "dual-review" ? "bot:dual-review" : scope],
  );
  return rows[0] ? Number(rows[0].monthly_aud) : fallback;
}

export async function reserve(
  db: Queryable,
  r: {
    scope: BudgetScope;
    botId?: string | null;
    taskId?: string | null;
    provider: string;
    amountAud: number;
    limits: BudgetLimits;
    now?: Date;
    tz?: string;
  },
): Promise<Reservation> {
  const amount = round4(r.amountAud);
  const since = monthStartUtc(r.now ?? new Date(), r.tz ?? DEFAULT_TZ);
  return withTx(db, async (c) => {
    // Serialise reservations so two concurrent calls can't both squeeze under the cap.
    await c.query("select pg_advisory_xact_lock(7243001)");
    const company = await committedAud(c, { since });
    if (company + amount > r.limits.hardStopAud) {
      throw new BudgetBlockedError(
        "company_hard_stop",
        `Monthly budget stop: A$${company.toFixed(2)} committed of A$${r.limits.hardStopAud.toFixed(2)}`,
      );
    }
    if (r.limits.scopeMonthlyAud !== undefined) {
      const scoped = await committedAud(c, { since, scope: r.scope });
      if (scoped + amount > r.limits.scopeMonthlyAud) {
        throw new BudgetBlockedError(
          "scope_monthly",
          `${r.scope} monthly budget: A$${scoped.toFixed(2)} committed of A$${r.limits.scopeMonthlyAud.toFixed(2)}`,
        );
      }
    }
    if (r.taskId && r.limits.taskMaxAud !== undefined) {
      const taskSpend = await committedAud(c, { since: new Date(0), taskId: r.taskId });
      if (taskSpend + amount > r.limits.taskMaxAud) {
        throw new BudgetBlockedError(
          "task_max",
          `Task budget: A$${(taskSpend + amount).toFixed(2)} would exceed A$${r.limits.taskMaxAud.toFixed(2)}`,
        );
      }
    }
    const ins = await c.query<{ id: string }>(
      `insert into budget_ledger (task_id, bot_id, provider, kind, amount_aud, scope)
       values ($1, $2, $3, 'reserve', $4, $5) returning id`,
      [r.taskId ?? null, r.botId ?? null, r.provider, amount, r.scope],
    );
    return {
      id: ins.rows[0]!.id,
      scope: r.scope,
      taskId: r.taskId ?? null,
      botId: r.botId ?? null,
      provider: r.provider,
      amountAud: amount,
    };
  });
}

/** Swap a reservation for the actual cost. */
export async function reconcile(
  db: Queryable,
  res: Reservation,
  actual: { amountAud: number; tokensIn: number; tokensOut: number },
): Promise<void> {
  await withTx(db, async (c) => {
    const base = [res.taskId, res.botId, res.provider, res.scope];
    await c.query(
      `insert into budget_ledger (task_id, bot_id, provider, kind, amount_aud, scope) values ($1, $2, $3, 'release', $5, $4)`,
      [...base, res.amountAud],
    );
    await c.query(
      `insert into budget_ledger (task_id, bot_id, provider, kind, amount_aud, tokens_in, tokens_out, scope)
       values ($1, $2, $3, 'actual', $5, $6, $7, $4)`,
      [...base, round4(actual.amountAud), actual.tokensIn, actual.tokensOut],
    );
    if (res.taskId) {
      await c.query("update tasks set actual_cost_aud = actual_cost_aud + $2 where id = $1", [
        res.taskId,
        round4(actual.amountAud),
      ]);
    }
  });
}

/** Give a reservation back unused (the call never happened or failed before billing). */
export async function releaseReservation(db: Queryable, res: Reservation): Promise<void> {
  await db.query(
    `insert into budget_ledger (task_id, bot_id, provider, kind, amount_aud, scope) values ($1, $2, $3, 'release', $4, $5)`,
    [res.taskId, res.botId, res.provider, res.amountAud, res.scope],
  );
}

export interface BudgetStatus {
  month: string;
  spentAud: number;
  hardStopAud: number;
  warnAud: number;
  warn: boolean;
  stopped: boolean;
  byScope: Record<string, number>;
}

export async function budgetStatus(
  db: Queryable,
  policy: Policy,
  now = new Date(),
  tz = DEFAULT_TZ,
): Promise<BudgetStatus> {
  const since = monthStartUtc(now, tz);
  const limits = await companyLimits(db, policy);
  const spent = await committedAud(db, { since });
  const { rows } = await db.query<{ scope: string; total: string }>(
    `select scope, sum(case kind when 'release' then -amount_aud else amount_aud end) as total
       from budget_ledger where created_at >= $1 group by scope order by scope`,
    [since],
  );
  return {
    month: monthKey(now, tz),
    spentAud: spent,
    hardStopAud: limits.hardStopAud,
    warnAud: limits.warnAud,
    warn: spent >= limits.warnAud,
    stopped: spent >= limits.hardStopAud,
    byScope: Object.fromEntries(rows.map((r) => [r.scope, Number(r.total)])),
  };
}

/** Record a ledger adjustment made by the owner (e.g. seeding a test month). */
export async function recordOwnerAdjustment(
  db: Queryable,
  scope: BudgetScope,
  amountAud: number,
  note: string,
) {
  await db.query(
    `insert into budget_ledger (provider, kind, amount_aud, scope) values ('owner-adjustment', 'actual', $1, $2)`,
    [amountAud, scope],
  );
  await audit(db, {
    actor: "owner",
    action: "budget.adjust",
    target: scope,
    result: note,
    costAud: amountAud,
  });
}
