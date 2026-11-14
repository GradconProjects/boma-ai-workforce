import pg from "pg";
import { loadEnv, redact, requireEnv } from "@boma/core";

/**
 * TLS settings for a connection string. Local databases (localhost) connect without TLS. Hosted
 * databases always use TLS; DATABASE_SSL=no-verify keeps encryption but skips certificate
 * checks (only for providers whose certificate chain isn't in the system store).
 */
export function sslFor(connectionString: string): pg.ClientConfig["ssl"] {
  const host = (() => {
    try {
      return new URL(connectionString).hostname;
    } catch {
      return "";
    }
  })();
  if (!host || host === "localhost" || host === "127.0.0.1") return undefined;
  const mode = process.env.DATABASE_SSL ?? "verify";
  if (mode === "off") return undefined;
  return mode === "no-verify" ? { rejectUnauthorized: false } : { rejectUnauthorized: true };
}

/** Strip sslmode from the URL so `sslFor` alone decides TLS (pg's own parsing would override it). */
function cleanUrl(connectionString: string): string {
  try {
    const u = new URL(connectionString);
    u.searchParams.delete("sslmode");
    return u.toString();
  } catch {
    return connectionString;
  }
}

export function createPool(connectionString: string, max = 5): pg.Pool {
  return new pg.Pool({
    connectionString: cleanUrl(connectionString),
    ssl: sslFor(connectionString),
    max,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
}

/** Connect using DATABASE_URL from .env. Connection errors are redacted before surfacing. */
export async function connect(url?: string): Promise<pg.Client> {
  const connectionString = url ?? requireEnv(loadEnv(), ["DATABASE_URL"]).DATABASE_URL;
  const client = new pg.Client({
    connectionString: cleanUrl(connectionString),
    ssl: sslFor(connectionString),
  });
  try {
    await client.connect();
  } catch (err) {
    // No `cause`: the raw driver error can echo the connection string; only the redacted text leaves.
    // eslint-disable-next-line preserve-caught-error
    throw new Error(`Database connection failed: ${redact((err as Error).message)}`);
  }
  return client;
}
