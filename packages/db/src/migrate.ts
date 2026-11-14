import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Client } from "pg";

export const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

export interface Migration {
  version: string;
  up: string;
  down: string;
}

/** Reads NNNN_name.up.sql / NNNN_name.down.sql pairs. Every up must have a down. */
export function readMigrations(dir = MIGRATIONS_DIR): Migration[] {
  const files = readdirSync(dir);
  const versions = [
    ...new Set(
      files.filter((f) => f.endsWith(".up.sql")).map((f) => f.slice(0, -".up.sql".length)),
    ),
  ].sort();
  return versions.map((version) => {
    const downFile = `${version}.down.sql`;
    if (!files.includes(downFile)) throw new Error(`Migration ${version} has no ${downFile}`);
    return {
      version,
      up: readFileSync(join(dir, `${version}.up.sql`), "utf8"),
      down: readFileSync(join(dir, downFile), "utf8"),
    };
  });
}

async function ensureTable(client: Client) {
  await client.query(`create table if not exists schema_migrations (
    version text primary key, applied_at timestamptz not null default now())`);
}

export async function appliedVersions(client: Client): Promise<string[]> {
  await ensureTable(client);
  const { rows } = await client.query<{ version: string }>(
    "select version from schema_migrations order by version",
  );
  return rows.map((r) => r.version);
}

/** Apply all pending migrations, each in its own transaction. Returns versions applied. */
export async function migrateUp(client: Client, migrations = readMigrations()): Promise<string[]> {
  const done = new Set(await appliedVersions(client));
  const applied: string[] = [];
  for (const m of migrations) {
    if (done.has(m.version)) continue;
    await client.query("begin");
    try {
      await client.query(m.up);
      await client.query("insert into schema_migrations (version) values ($1)", [m.version]);
      await client.query("commit");
      applied.push(m.version);
    } catch (err) {
      await client.query("rollback");
      throw new Error(`Migration ${m.version} failed: ${(err as Error).message}`, { cause: err });
    }
  }
  return applied;
}

/** Roll back the last `steps` applied migrations (default 1; Infinity = all). */
export async function migrateDown(
  client: Client,
  steps = 1,
  migrations = readMigrations(),
): Promise<string[]> {
  const byVersion = new Map(migrations.map((m) => [m.version, m]));
  const toUndo = (await appliedVersions(client)).reverse().slice(0, steps);
  const undone: string[] = [];
  for (const version of toUndo) {
    const m = byVersion.get(version);
    if (!m) throw new Error(`No migration file for applied version ${version}`);
    await client.query("begin");
    try {
      await client.query(m.down);
      await client.query("delete from schema_migrations where version = $1", [version]);
      await client.query("commit");
      undone.push(version);
    } catch (err) {
      await client.query("rollback");
      throw new Error(`Rollback of ${version} failed: ${(err as Error).message}`, { cause: err });
    }
  }
  return undone;
}
