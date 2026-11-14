import { randomBytes } from "node:crypto";
import pg from "pg";

/**
 * Test helper: creates a throwaway database on the server in TEST_DATABASE_URL and drops it
 * afterwards. In CI a missing TEST_DATABASE_URL is a failure, not a skip.
 */
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
export const SKIP_DB = !TEST_DATABASE_URL && !process.env.CI;

export async function createTempDb(): Promise<{ url: string; drop: () => Promise<void> }> {
  if (!TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL is required for database tests");
  const name = `boma_test_${randomBytes(4).toString("hex")}`;
  const admin = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await admin.connect();
  await admin.query(`create database ${name}`);
  await admin.end();

  const url = new URL(TEST_DATABASE_URL);
  url.pathname = `/${name}`;
  return {
    url: url.toString(),
    drop: async () => {
      const a = new pg.Client({ connectionString: TEST_DATABASE_URL });
      await a.connect();
      await a.query(`drop database if exists ${name} with (force)`);
      await a.end();
    },
  };
}
