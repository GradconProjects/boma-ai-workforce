import { audit, type Queryable } from "./db";
import { TERMINAL, transition, type TaskStatus } from "./tasks";

export async function getState<T = unknown>(db: Queryable, key: string): Promise<T | undefined> {
  const { rows } = await db.query<{ value: T }>("select value from system_state where key = $1", [
    key,
  ]);
  return rows[0]?.value;
}

export async function setState(db: Queryable, key: string, value: unknown): Promise<void> {
  await db.query(
    `insert into system_state (key, value, updated_at) values ($1, $2, now())
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [key, JSON.stringify(value)],
  );
}

/** Set a key only if it is not set yet. Returns true if this call set it (once-only guard). */
export async function setStateOnce(db: Queryable, key: string, value: unknown): Promise<boolean> {
  const r = await db.query(
    "insert into system_state (key, value) values ($1, $2) on conflict (key) do nothing",
    [key, JSON.stringify(value)],
  );
  return r.rowCount === 1;
}

export async function isPaused(db: Queryable): Promise<boolean> {
  return (await getState<boolean>(db, "paused")) === true;
}

/**
 * Kill switch. Always works, regardless of budget: sets the global flag (workers stop claiming
 * and stop between steps) and moves every active task to `paused`.
 */
export async function pauseAll(db: Queryable, actor: string): Promise<number> {
  await setState(db, "paused", true);
  const { rows } = await db.query<{ id: string; status: TaskStatus }>(
    "select id, status from tasks where status <> all($1::text[]) and status <> 'paused'",
    [[...TERMINAL]],
  );
  for (const t of rows) await transition(db, t.id, "paused", actor, `/pause_all (was ${t.status})`);
  await audit(db, { actor, action: "system.pause_all", result: `${rows.length} tasks paused` });
  return rows.length;
}

/** Clear the flag and return each paused task to the status it had before the pause. */
export async function resumeAll(db: Queryable, actor: string): Promise<number> {
  await setState(db, "paused", false);
  const { rows } = await db.query<{ id: string; prev: TaskStatus | null }>(
    `select t.id,
            (select e.from_status from task_events e
              where e.task_id = t.id and e.to_status = 'paused' order by e.id desc limit 1) as prev
       from tasks t where t.status = 'paused'`,
  );
  for (const t of rows) await transition(db, t.id, t.prev ?? "queued", actor, "/resume");
  await audit(db, { actor, action: "system.resume", result: `${rows.length} tasks resumed` });
  return rows.length;
}
