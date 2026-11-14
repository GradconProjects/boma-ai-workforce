import { NextResponse } from "next/server";
import { cronTick } from "@boma/worker/hosted";
import { runtime, secretMatches } from "@/lib/runtime";

/**
 * Vercel Cron, every minute (vercel.json): expire approvals, send pending approval cards, fire
 * Sydney-time briefs, then run queued tasks for up to 4 minutes. Vercel sends
 * `Authorization: Bearer $CRON_SECRET`; anything else is refused.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secretMatches(auth, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  try {
    const result = await cronTick(await runtime());
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron] tick failed:", (err as Error).message);
    return NextResponse.json({ ok: false, error: "tick failed" }, { status: 500 });
  }
}
