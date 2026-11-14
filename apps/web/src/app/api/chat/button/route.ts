import { after, NextResponse } from "next/server";
import { appButton, cronTick } from "@boma/worker/hosted";
import { runtime } from "@/lib/runtime";
import { isOwner } from "@/lib/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  if (!(await isOwner()))
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const { data, conversationId } = (await req.json().catch(() => ({}))) as {
    data?: unknown;
    conversationId?: string;
  };
  if (typeof data !== "string") return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const rt = await runtime();
  const result = await appButton(rt, data, conversationId);
  after(() => cronTick(rt, 60_000).catch(() => undefined));
  return NextResponse.json({ ok: true, result });
}
