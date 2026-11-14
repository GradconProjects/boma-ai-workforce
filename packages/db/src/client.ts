import pg from "pg";
import { loadEnv, redact, requireEnv } from "@boma/core";

/** Connect using DATABASE_URL from .env. Connection errors are redacted before surfacing. */
export async function connect(url?: string): Promise<pg.Client> {
  const connectionString = url ?? requireEnv(loadEnv(), ["DATABASE_URL"]).DATABASE_URL;
  const client = new pg.Client({ connectionString });
  try {
    await client.connect();
  } catch (err) {
    // No `cause`: the raw driver error can echo the connection string; only the redacted text leaves.
    // eslint-disable-next-line preserve-caught-error
    throw new Error(`Database connection failed: ${redact((err as Error).message)}`);
  }
  return client;
}
