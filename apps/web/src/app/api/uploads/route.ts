import { NextResponse } from "next/server";
import { db, isOwner } from "@/lib/server";

/**
 * Owner image uploads for the editor's image library, stored in Postgres so they work on
 * serverless hosting (no local disk) without extra storage credentials.
 */
const MAX_BYTES = 10 * 1024 * 1024;

// Magic numbers: never trust the declared content type alone.
function sniff(buf: Buffer): string | null {
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP")
    return "image/webp";
  if (buf.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  return null;
}

const TEXT_TYPES: Record<string, string> = {
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  csv: "text/csv",
  json: "application/json",
};

/** Plain-text documents have no magic number: accept by extension only if the bytes are UTF-8 text. */
function textType(name: string, buf: Buffer): string | null {
  const type = TEXT_TYPES[name.split(".").pop()?.toLowerCase() ?? ""];
  if (!type || buf.includes(0)) return null;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buf);
    return type;
  } catch {
    return null;
  }
}

export async function GET() {
  if (!(await isOwner())) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const { rows } = await db().query<{ id: string; filename: string }>(
    "select id, filename from uploads where purpose = 'library' and mime like 'image/%' order by created_at desc limit 200",
  );
  return NextResponse.json({
    images: rows.map((r) => ({ src: `/api/uploads/${r.id}`, label: r.filename })),
  });
}

export async function POST(req: Request) {
  if (!(await isOwner())) return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > MAX_BYTES)
    return NextResponse.json({ error: "Images must be 10 MB or smaller" }, { status: 413 });
  const purpose = form.get("purpose") === "chat" ? "chat" : "library";
  const buf = Buffer.from(await file.arrayBuffer());
  const name = file.name.replace(/[^\w.\- ]+/g, "").slice(0, 120) || "file";
  const sniffed = sniff(buf);
  const mime =
    purpose === "chat"
      ? (sniffed ?? textType(name, buf))
      : sniffed?.startsWith("image/")
        ? sniffed
        : null;
  if (!mime)
    return NextResponse.json(
      {
        error:
          purpose === "chat"
            ? "Attach images (PNG, JPEG, WebP), PDFs or text files (.txt, .md, .csv, .json)"
            : "Only PNG, JPEG or WebP images",
      },
      { status: 415 },
    );
  const { rows } = await db().query<{ id: string }>(
    "insert into uploads (filename, mime, size_bytes, bytes, purpose) values ($1, $2, $3, $4, $5) returning id",
    [name, mime, buf.length, buf, purpose],
  );
  const id = rows[0]!.id;
  return NextResponse.json({ src: `/api/uploads/${id}`, id, name, mime, size: buf.length });
}
