import { randomUUID } from "node:crypto";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { isOwner } from "@/lib/server";

/**
 * Owner image uploads for the editor's image library. Stored under public/uploads (git-ignored)
 * in local-first mode; swap for Supabase Storage when hosted.
 */
const DIR = join(process.cwd(), "public", "uploads");
const TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const MAX_BYTES = 10 * 1024 * 1024;

// Magic numbers: never trust the declared content type alone.
function sniff(buf: Buffer): string | null {
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP")
    return "image/webp";
  return null;
}

export async function GET() {
  if (!(await isOwner())) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  await mkdir(DIR, { recursive: true });
  const names = (await readdir(DIR)).filter((n) => /\.(png|jpe?g|webp)$/i.test(n));
  const files = await Promise.all(
    names.map(async (n) => ({ n, t: (await stat(join(DIR, n))).mtimeMs })),
  );
  return NextResponse.json({
    images: files.sort((a, b) => b.t - a.t).map((f) => ({ src: `/uploads/${f.n}`, label: f.n })),
  });
}

export async function POST(req: Request) {
  if (!(await isOwner())) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > MAX_BYTES)
    return NextResponse.json({ error: "Images must be 10 MB or smaller" }, { status: 413 });
  const buf = Buffer.from(await file.arrayBuffer());
  const type = sniff(buf);
  if (!type || !TYPES[type])
    return NextResponse.json({ error: "Only PNG, JPEG or WebP images" }, { status: 415 });
  await mkdir(DIR, { recursive: true });
  const name = `${randomUUID()}.${TYPES[type]}`;
  await writeFile(join(DIR, name), buf);
  return NextResponse.json({ src: `/uploads/${name}` });
}
