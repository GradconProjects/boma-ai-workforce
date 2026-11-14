import { fontString, renderDesign, type Design } from "@boma/design-engine";

/** Render a design to PNG in the browser at its full export size. */
export async function designToPngBlob(design: Design, scale = 1): Promise<Blob> {
  // Make sure every font used is loaded before drawing, or the canvas falls back silently.
  const fonts = new Set(design.layers.flatMap((l) => (l.type === "text" ? [fontString(l)] : [])));
  await Promise.all([...fonts].map((f) => document.fonts.load(f).catch(() => undefined)));
  await document.fonts.ready;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(design.width * scale);
  canvas.height = Math.round(design.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser");
  ctx.scale(scale, scale);

  const cache = new Map<string, Promise<HTMLImageElement>>();
  const load = (src: string) => {
    if (!cache.has(src)) {
      cache.set(
        src,
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error(`Could not load image ${src}`));
          img.src = src;
        }),
      );
    }
    return cache.get(src)!;
  };
  await renderDesign(ctx, design, load);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Export failed"))), "image/png"),
  );
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

export const safeFilename = (s: string) =>
  s
    .replace(/[^\w\- ]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80) || "design";
