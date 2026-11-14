import { NextResponse } from "next/server";
import { redact } from "@boma/core";
import { isSimulated } from "@boma/worker/hosted";
import { db, env } from "@/lib/server";

/** Public health check: is the database reachable, and which mode is the platform in? No secrets. */
export const dynamic = "force-dynamic";

export async function GET() {
  const e = env();
  const out: Record<string, unknown> = {
    ok: false,
    mode: isSimulated(e) ? "simulation" : "live",
    telegram: Boolean(e.TELEGRAM_BOT_TOKEN && e.TELEGRAM_OWNER_USER_ID),
    login: Boolean(e.OWNER_PASSWORD),
  };
  try {
    const { rows } = await db().query<{ v: string; schema: string }>(
      "select coalesce((select max(version) from schema_migrations), 'none') as v, current_schema() as schema",
    );
    out.ok = true;
    out.db = { schema: rows[0]!.schema, migration: rows[0]!.v };
  } catch (err) {
    out.db = { error: redact((err as Error).message).slice(0, 200) };
  }
  return NextResponse.json(out, { status: out.ok ? 200 : 503 });
}
