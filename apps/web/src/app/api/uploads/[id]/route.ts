import { db, isOwner } from "@/lib/server";

/** Serve one uploaded image to the signed-in owner. Uploads are immutable, so cache hard. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isOwner())) return new Response("unauthorised", { status: 401 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("not found", { status: 404 });
  const { rows } = await db().query<{ mime: string; bytes: Buffer }>(
    "select mime, bytes from uploads where id = $1",
    [id],
  );
  const r = rows[0];
  if (!r) return new Response("not found", { status: 404 });
  return new Response(new Uint8Array(r.bytes), {
    headers: {
      "content-type": r.mime,
      "cache-control": "private, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}
