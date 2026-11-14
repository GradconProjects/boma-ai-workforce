import { after, NextResponse } from "next/server";
import { appChat, chatHistory, cronTick, isUuid, type Attachment } from "@boma/worker/hosted";
import { runtime } from "@/lib/runtime";
import { db, isOwner } from "@/lib/server";

/** The app's chat with the Chief. Owner session required; messages are idempotent by clientId. */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const unauthorised = () => NextResponse.json({ error: "Please sign in again." }, { status: 401 });

export async function GET(req: Request) {
  if (!(await isOwner())) return unauthorised();
  await runtime(); // a fresh deploy applies its database updates first
  const q = new URL(req.url).searchParams;
  const conversationId = q.get("c") ?? undefined;
  if (!isUuid(conversationId)) return NextResponse.json({ messages: [] });
  const messages = await chatHistory(db(), {
    conversationId,
    afterId: q.get("after") ?? undefined,
    limit: 200,
  });
  return NextResponse.json({ messages });
}

export async function POST(req: Request) {
  if (!(await isOwner())) return unauthorised();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 8000) : "";
  const clientId = typeof body.clientId === "string" ? body.clientId.slice(0, 80) : "";
  const conversationId = body.conversationId;
  const attachments = Array.isArray(body.attachments)
    ? (body.attachments as Attachment[]).slice(0, 10)
    : [];
  if (
    (!text && !attachments.length) ||
    !/^[A-Za-z0-9_-]{8,80}$/.test(clientId) ||
    !isUuid(conversationId)
  ) {
    return NextResponse.json({ error: "Empty message." }, { status: 400 });
  }
  const rt = await runtime();
  try {
    const r = await appChat(rt, {
      text: text || "(see attached)",
      clientId,
      conversationId,
      attachments,
    });
    // Run any work the message queued now, rather than at the next minute's cron.
    after(() => cronTick(rt, 200_000).catch((e) => console.error("chat kick:", e.message)));
    return NextResponse.json({ ok: true, id: r.id, duplicate: r.duplicate });
  } catch (err) {
    console.error("[chat] failed:", (err as Error).message);
    return NextResponse.json(
      { error: "The Chief couldn't handle that just now." },
      { status: 500 },
    );
  }
}
