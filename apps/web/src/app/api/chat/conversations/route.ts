import { NextResponse } from "next/server";
import { isUuid, listConversations, updateConversation } from "@boma/worker/hosted";
import { runtime } from "@/lib/runtime";
import { db, isOwner } from "@/lib/server";

/** Recents: list, search, rename, pin and archive conversations. */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await isOwner())) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  await runtime(); // a fresh deploy applies its database updates first
  const search = new URL(req.url).searchParams.get("q") ?? undefined;
  return NextResponse.json({ conversations: await listConversations(db(), { search, limit: 80 }) });
}

export async function PATCH(req: Request) {
  if (!(await isOwner())) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!isUuid(b.id)) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  await updateConversation(db(), b.id, {
    title: typeof b.title === "string" ? b.title : undefined,
    pinned: typeof b.pinned === "boolean" ? b.pinned : undefined,
    archived: typeof b.archived === "boolean" ? b.archived : undefined,
  });
  return NextResponse.json({ ok: true });
}
