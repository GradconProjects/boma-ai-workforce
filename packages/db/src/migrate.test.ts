import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appliedVersions, migrateDown, migrateUp, readMigrations } from "./migrate";
import { createTempDb, SKIP_DB } from "./testdb";

const EXPECTED_TABLES = [
  "accounts",
  "approvals",
  "audit_log",
  "bot_account_grants",
  "bot_versions",
  "bots",
  "brands",
  "budget_ledger",
  "budget_limits",
  "campaign_items",
  "campaigns",
  "design_versions",
  "designs",
  "memory",
  "policy_unlocks",
  "publish_packages",
  "reviews",
  "system_state",
  "task_events",
  "tasks",
  "workspaces",
];

async function tables(client: pg.Client): Promise<string[]> {
  const { rows } = await client.query<{ table_name: string }>(
    `select table_name from information_schema.tables
      where table_schema = 'public' and table_name <> 'schema_migrations' order by table_name`,
  );
  return rows.map((r) => r.table_name);
}

describe.skipIf(SKIP_DB)("G0.2 migrations", () => {
  let client: pg.Client;
  let drop: () => Promise<void>;

  beforeAll(async () => {
    const db = await createTempDb();
    drop = db.drop;
    client = new pg.Client({ connectionString: db.url });
    await client.connect();
  });

  afterAll(async () => {
    await client?.end();
    await drop?.();
  });

  it("every migration has a down file", () => {
    expect(readMigrations().length).toBeGreaterThan(0);
  });

  it("apply cleanly to an empty database", async () => {
    expect(await tables(client)).toEqual([]);
    const applied = await migrateUp(client);
    expect(applied).toEqual(readMigrations().map((m) => m.version));
    expect(await tables(client)).toEqual(EXPECTED_TABLES);
    expect(await migrateUp(client)).toEqual([]); // idempotent
  });

  it("enables row level security on every table", async () => {
    const { rows } = await client.query<{ relname: string }>(
      `select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
          and relname <> 'schema_migrations'`,
    );
    expect(rows).toEqual([]);
  });

  it("enforces immutable bot_versions and append-only audit_log", async () => {
    const bot = await client.query<{ id: string }>(
      "insert into bots (slug, department) values ('t-bot', 'command') returning id",
    );
    await client.query(
      `insert into bot_versions (bot_id, version, file_sha, frontmatter, instructions, created_by)
       values ($1, 1, 'sha', '{}', 'x', 'owner')`,
      [bot.rows[0]!.id],
    );
    await expect(client.query("update bot_versions set instructions = 'y'")).rejects.toThrow(
      /immutable/,
    );
    await client.query(
      "insert into audit_log (actor, action, result) values ('system', 't', 'ok')",
    );
    await expect(client.query("delete from audit_log")).rejects.toThrow(/immutable/);
  });

  it("blocks duplicate idempotency keys and same-provider reviews", async () => {
    const { rows } = await client.query<{ bot: string; ver: string }>(
      "select b.id as bot, v.id as ver from bots b join bot_versions v on v.bot_id = b.id limit 1",
    );
    const insertTask = () =>
      client.query(
        "insert into tasks (bot_id, bot_version_id, kind, idempotency_key) values ($1, $2, 'k', 'same-key')",
        [rows[0]!.bot, rows[0]!.ver],
      );
    await insertTask();
    await expect(insertTask()).rejects.toThrow(/duplicate key/);

    const task = await client.query<{ id: string }>("select id from tasks limit 1");
    await expect(
      client.query(
        `insert into reviews (task_id, round, maker_provider, maker_model, checker_provider, checker_model, output_hash, verdict)
         values ($1, 1, 'anthropic', 'm', 'anthropic', 'm', 'h', '{}')`,
        [task.rows[0]!.id],
      ),
    ).rejects.toThrow(/check constraint/);
  });

  it("roll back to an empty database and re-apply", async () => {
    await migrateDown(client, Infinity);
    expect(await tables(client)).toEqual([]);
    expect(await appliedVersions(client)).toEqual([]);
    await migrateUp(client);
    expect(await tables(client)).toEqual(EXPECTED_TABLES);
  });
});
