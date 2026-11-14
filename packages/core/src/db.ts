import { createHash } from "node:crypto";
import pg from "pg";

/** Anything that can run a query: a pool, a pooled client, or a single client. */
export type Queryable = pg.Pool | pg.PoolClient | pg.Client;

/**
 * Run fn inside a transaction. With a Pool, a dedicated client is checked out; with a client,
 * the transaction runs on it directly (do not nest).
 */
export async function withTx<T>(
  db: Queryable,
  fn: (c: pg.PoolClient | pg.Client) => Promise<T>,
): Promise<T> {
  const isPool = db instanceof pg.Pool;
  const client = isPool ? await (db as pg.Pool).connect() : (db as pg.PoolClient | pg.Client);
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    if (isPool) (client as pg.PoolClient).release();
  }
}

/** Stable JSON: object keys sorted recursively, so equal content always hashes the same. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`;
}

export function sha256Hex(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function hashOf(value: unknown): string {
  return sha256Hex(typeof value === "string" ? value : canonicalJson(value));
}

export interface AuditEntry {
  actor: string;
  action: string;
  target?: string | null;
  inputs?: unknown;
  outputs?: unknown;
  costAud?: number;
  result: string;
}

/** Append to the audit log. Only hashes of inputs/outputs are stored, never raw content. */
export async function audit(db: Queryable, e: AuditEntry): Promise<void> {
  await db.query(
    `insert into audit_log (actor, action, target, inputs_hash, outputs_hash, cost_aud, result)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      e.actor,
      e.action,
      e.target ?? null,
      e.inputs === undefined ? null : hashOf(e.inputs),
      e.outputs === undefined ? null : hashOf(e.outputs),
      e.costAud ?? 0,
      e.result,
    ],
  );
}
