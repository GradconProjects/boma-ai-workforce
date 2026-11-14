/**
 * Shared test fixture: a throwaway database with all migrations applied and the repo's bot
 * files synced, plus the real policy. Each test file gets its own database.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { loadPolicy, type Policy } from "../packages/core/src";
import { listBotFiles, loadBotFile, syncBot } from "../packages/bots/src";
import { migrateUp } from "../packages/db/src/migrate";
import { createTempDb, SKIP_DB } from "../packages/db/src/testdb";

export { SKIP_DB };

export const repoPath = (rel: string) => fileURLToPath(new URL(`../${rel}`, import.meta.url));
export const readFileSyncRepo = (rel: string) => readFileSync(repoPath(rel), "utf8");

export interface Fixture {
  pool: pg.Pool;
  policy: Policy;
  close: () => Promise<void>;
}

export async function setupDb(): Promise<Fixture> {
  const db = await createTempDb();
  const pool = new pg.Pool({ connectionString: db.url, max: 5 });
  const policy = loadPolicy(repoPath("config/policy.yaml"));
  const client = await pool.connect();
  try {
    await migrateUp(client);
    for (const file of listBotFiles(repoPath("bots"))) {
      const r = await syncBot(client as unknown as pg.Client, loadBotFile(file), policy);
      if (r.status === "rejected") throw new Error(`fixture bot rejected: ${r.errors.join("; ")}`);
    }
  } finally {
    client.release();
  }
  return {
    pool,
    policy,
    close: async () => {
      await pool.end();
      await db.drop();
    },
  };
}

let seq = 0;
export const key = (prefix = "t") => `${prefix}-${Date.now()}-${++seq}`;
