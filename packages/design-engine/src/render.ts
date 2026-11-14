import { wrapText } from "./text";
import type { Design, ImageLayer, ShapeLayer, TextLayer } from "./types";

/**
 * Canvas 2D renderer for PNG export and thumbnails. Mirrors the editor's DOM rendering so the
 * exported file matches what the owner sees. Browser-only (needs a 2D context and images).
 */

export type ImageLoader = (
  src: string,
) => Promise<CanvasImageSource & { width: number; height: number }>;

type Ctx = CanvasRenderingContext2D;

function gradient(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  from: string,
  to: string,
  angle: number,
) {
  const rad = ((angle - 90) * Math.PI) / 180;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const len = (Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad))) / 2;
  const g = ctx.createLinearGradient(
    cx - Math.cos(rad) * len,
    cy - Math.sin(rad) * len,
    cx + Math.cos(rad) * len,
    cy + Math.sin(rad) * len,
  );
  g.addColorStop(0, from);
  g.addColorStop(1, to);
  return g;
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, rr);
}

function drawCover(
  ctx: Ctx,
  img: CanvasImageSource & { width: number; height: number },
  x: number,
  y: number,
  w: number,
  h: number,
  fit: "cover" | "contain",
) {
  const s =
    fit === "cover"
      ? Math.max(w / img.width, h / img.height)
      : Math.min(w / img.width, h / img.height);
  const dw = img.width * s;
  const dh = img.height * s;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function withTransform(
  ctx: Ctx,
  l: { x: number; y: number; w: number; h: number; rotation: number; opacity: number },
  draw: () => void,
) {
  ctx.save();
  ctx.globalAlpha = l.opacity;
  ctx.translate(l.x + l.w / 2, l.y + l.h / 2);
  ctx.rotate((l.rotation * Math.PI) / 180);
  ctx.translate(-l.w / 2, -l.h / 2);
  draw();
  ctx.restore();
}

function drawShape(ctx: Ctx, l: ShapeLayer) {
  withTransform(ctx, l, () => {
    ctx.fillStyle = l.fill2
      ? gradient(ctx, 0, 0, l.w, l.h, l.fill, l.fill2, l.gradientAngle)
      : l.fill;
    if (l.shape === "ellipse") {
      ctx.beginPath();
      ctx.ellipse(l.w / 2, l.h / 2, l.w / 2, l.h / 2, 0, 0, Math.PI * 2);
    } else roundRect(ctx, 0, 0, l.w, l.h, l.radius);
    ctx.fill();
    if (l.stroke && l.strokeWidth > 0) {
      ctx.strokeStyle = l.stroke;
      ctx.lineWidth = l.strokeWidth;
      ctx.stroke();
    }
  });
}

export function fontString(
  l: Pick<TextLayer, "italic" | "fontWeight" | "fontSize" | "fontFamily">,
): string {
  return `${l.italic ? "italic " : ""}${l.fontWeight} ${l.fontSize}px ${JSON.stringify(l.fontFamily)}, system-ui, sans-serif`;
}

function drawText(ctx: Ctx, l: TextLayer) {
  withTransform(ctx, l, () => {
    if (l.background) {
      ctx.fillStyle = l.background;
      roundRect(ctx, 0, 0, l.w, l.h, l.radius);
      ctx.fill();
    }
    ctx.font = fontString(l);
    ctx.fillStyle = l.color;
    ctx.textBaseline = "top";
    (ctx as Ctx & { letterSpacing?: string }).letterSpacing = `${l.letterSpacing * l.fontSize}px`;
    const content = l.uppercase ? l.text.toUpperCase() : l.text;
    const inner = l.w - l.padding * 2;
    const lines = wrapText(content, inner, (s) => ctx.measureText(s).width);
    const lh = l.fontSize * l.lineHeight;
    const blockH = lines.length * lh;
    // Buttons (text with a background) centre vertically; plain text starts at the top.
    let y = l.background ? (l.h - blockH) / 2 + (lh - l.fontSize) / 2 : l.padding;
    for (const line of lines) {
      const w = ctx.measureText(line).width;
      const x =
        l.align === "center"
          ? (l.w - w) / 2
          : l.align === "right"
            ? l.w - l.padding - w
            : l.padding;
      ctx.fillText(line, x, y);
      y += lh;
    }
  });
}

async function drawImage(ctx: Ctx, l: ImageLayer, load: ImageLoader) {
  const img = await load(l.src);
  withTransform(ctx, l, () => {
    roundRect(ctx, 0, 0, l.w, l.h, l.radius);
    ctx.clip();
    drawCover(ctx, img, 0, 0, l.w, l.h, l.fit);
  });
}

export async function renderDesign(ctx: Ctx, d: Design, load: ImageLoader): Promise<void> {
  ctx.clearRect(0, 0, d.width, d.height);
  ctx.fillStyle = d.background.color;
  ctx.fillRect(0, 0, d.width, d.height);
  if (d.background.imageUrl) {
    drawCover(ctx, await load(d.background.imageUrl), 0, 0, d.width, d.height, "cover");
  }
  if (d.background.overlay && d.background.overlayOpacity > 0) {
    ctx.globalAlpha = d.background.overlayOpacity;
    ctx.fillStyle = d.background.overlay;
    ctx.fillRect(0, 0, d.width, d.height);
    ctx.globalAlpha = 1;
  }
  for (const l of d.layers) {
    if (l.hidden) continue;
    if (l.type === "shape") drawShape(ctx, l);
    else if (l.type === "text") drawText(ctx, l);
    else await drawImage(ctx, l, load);
  }
}
