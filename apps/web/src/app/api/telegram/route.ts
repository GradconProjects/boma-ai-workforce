import { NextResponse } from "next/server";
import type { TgUpdate } from "@boma/connectors";
import { runtime, secretMatches } from "@/lib/runtime";

/**
 * Telegram webhook (hosted mode). Telegram includes the secret we registered with setWebhook in
 * X-Telegram-Bot-Api-Secret-Token; requests without it are refused. The gateway then applies the
 * owner-only rule (C2) and ignores redelivered updates.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  if (
    !secretMatches(
      req.headers.get("x-telegram-bot-api-secret-token"),
      process.env.TELEGRAM_WEBHOOK_SECRET,
    )
  ) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return NextResponse.json({ ok: true }); // malformed: acknowledge so Telegram stops retrying
  }
  if (typeof update?.update_id !== "number") return NextResponse.json({ ok: true });
  try {
    const rt = await runtime();
    if (!rt.gateway) return NextResponse.json({ ok: true, note: "telegram not configured" });
    const result = await rt.gateway.handleWebhook(update);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    // Acknowledge anyway: the update is recorded as seen, and Chief actions are idempotent.
    console.error("[telegram] handling failed:", (err as Error).message);
    return NextResponse.json({ ok: true, error: "handling failed" });
  }
}
