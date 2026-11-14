import type { Brand, Copy, Design, Layer, TextLayer } from "./types";

/** Pure, immutable editing operations. Every editor action is one of these, so undo is trivial. */

let counter = 0;
export const newId = (prefix = "l") =>
  `${prefix}_${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function addLayer(d: Design, layer: Layer): Design {
  return { ...d, layers: [...d.layers, layer] };
}

export function updateLayer<T extends Layer>(d: Design, id: string, patch: Partial<T>): Design {
  return { ...d, layers: d.layers.map((l) => (l.id === id ? ({ ...l, ...patch } as Layer) : l)) };
}

export function removeLayer(d: Design, id: string): Design {
  return { ...d, layers: d.layers.filter((l) => l.id !== id) };
}

export function duplicateLayer(d: Design, id: string): { design: Design; newId: string } {
  const src = d.layers.find((l) => l.id === id);
  if (!src) return { design: d, newId: id };
  const copy = {
    ...src,
    id: newId(),
    name: `${src.name} copy`,
    x: src.x + 24,
    y: src.y + 24,
  } as Layer;
  const idx = d.layers.indexOf(src);
  const layers = [...d.layers.slice(0, idx + 1), copy, ...d.layers.slice(idx + 1)];
  return { design: { ...d, layers }, newId: copy.id };
}

/** Layer order: index 0 is at the back. */
export function reorderLayer(
  d: Design,
  id: string,
  to: "front" | "back" | "forward" | "backward",
): Design {
  const idx = d.layers.findIndex((l) => l.id === id);
  if (idx < 0) return d;
  const layers = [...d.layers];
  const [layer] = layers.splice(idx, 1);
  const target =
    to === "front"
      ? layers.length
      : to === "back"
        ? 0
        : to === "forward"
          ? Math.min(idx + 1, layers.length)
          : Math.max(idx - 1, 0);
  layers.splice(target, 0, layer!);
  return { ...d, layers };
}

export type Alignment = "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom";

/** Align a layer to the canvas. */
export function alignLayer(d: Design, id: string, a: Alignment): Design {
  const l = d.layers.find((x) => x.id === id);
  if (!l) return d;
  const pos: Partial<Layer> = {
    left: { x: 0 },
    hcenter: { x: Math.round((d.width - l.w) / 2) },
    right: { x: d.width - l.w },
    top: { y: 0 },
    vcenter: { y: Math.round((d.height - l.h) / 2) },
    bottom: { y: d.height - l.h },
  }[a];
  return updateLayer(d, id, pos);
}

/** Keep a layer at least partly on the canvas after a drag. */
export function clampToCanvas(
  d: Design,
  l: Pick<Layer, "x" | "y" | "w" | "h">,
): { x: number; y: number } {
  const margin = 24;
  return {
    x: Math.min(Math.max(l.x, -l.w + margin), d.width - margin),
    y: Math.min(Math.max(l.y, -l.h + margin), d.height - margin),
  };
}

/** Snap a value to guide lines (canvas edges and centre) within a threshold. */
export function snap(
  value: number,
  size: number,
  canvas: number,
  threshold = 8,
): { value: number; guide: number | null } {
  const candidates = [
    { at: 0, v: 0 },
    { at: canvas / 2, v: canvas / 2 - size / 2 },
    { at: canvas, v: canvas - size },
  ];
  for (const c of candidates) {
    if (Math.abs(value - c.v) <= threshold) return { value: Math.round(c.v), guide: c.at };
  }
  return { value: Math.round(value), guide: null };
}

/** Put copy into the text layers that carry the matching role. Unmatched roles are ignored. */
export function applyCopy(d: Design, copy: Copy): Design {
  return {
    ...d,
    layers: d.layers.map((l) => {
      if (l.type !== "text" || l.role === "free") return l;
      const value = copy[l.role as keyof Copy];
      return value === undefined || value === "" ? l : fitText({ ...l, text: value });
    }),
  };
}

/**
 * Estimated rendered height of a text layer. Uses an average glyph width (0.56em, bolder and
 * uppercase text wider) so it runs without a browser; deliberately conservative.
 */
export function estimateTextHeight(l: TextLayer, fontSize = l.fontSize): number {
  const glyph =
    fontSize * (0.5 + (l.fontWeight >= 700 ? 0.06 : 0) + (l.uppercase ? 0.08 : 0)) +
    fontSize * l.letterSpacing;
  const perLine = Math.max(1, Math.floor((l.w - l.padding * 2) / glyph));
  const lines = l.text.split("\n").reduce((n, para) => {
    let count = 1;
    let len = 0;
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const add = (len ? 1 : 0) + word.length;
      if (len + add > perLine && len > 0) {
        count++;
        len = word.length;
      } else len += add;
    }
    return n + count;
  }, 0);
  return lines * fontSize * l.lineHeight + l.padding * 2;
}

/** Grow a text box downwards so typed text never overflows (font size is kept). */
export function growToFit(l: TextLayer): TextLayer {
  const need = Math.ceil(estimateTextHeight(l));
  return need > l.h ? { ...l, h: need } : l;
}

/** Shrink a text layer's font (down to 45% of its size) until its text fits the box height. */
export function fitText(l: TextLayer): TextLayer {
  if (l.background) return l; // buttons keep their size; their text is short by design
  let size = l.fontSize;
  const min = Math.max(8, Math.round(l.fontSize * 0.45));
  while (size > min && estimateTextHeight(l, size) > l.h)
    size = Math.max(min, Math.floor(size * 0.94));
  return size === l.fontSize ? l : { ...l, fontSize: size };
}

/** Read the copy currently in a design, by role. */
export function extractCopy(d: Design): Copy {
  const out: Copy = {};
  for (const l of d.layers) {
    if (l.type === "text" && l.role !== "free" && !(l.role in out))
      out[l.role as keyof Copy] = l.text;
  }
  return out;
}

/**
 * Re-colour a design to a brand: layers tagged with the old brand colours move to the new ones,
 * fonts follow the brand's heading/body fonts.
 */
export function applyBrand(
  d: Design,
  from: Pick<Brand, "primary" | "secondary" | "accent">,
  to: Brand,
): Design {
  const map = new Map([
    [from.primary.toLowerCase(), to.primary],
    [from.secondary.toLowerCase(), to.secondary],
    [from.accent.toLowerCase(), to.accent],
  ]);
  const swap = (c: string | null) => (c ? (map.get(c.toLowerCase()) ?? c) : c);
  return {
    ...d,
    background: {
      ...d.background,
      color: swap(d.background.color)!,
      overlay: swap(d.background.overlay),
    },
    layers: d.layers.map((l) => {
      if (l.type === "text") {
        const heading = l.role === "headline" || l.role === "eyebrow" || l.role === "cta";
        return {
          ...l,
          color: swap(l.color)!,
          background: swap(l.background),
          fontFamily: heading ? to.headingFont : to.bodyFont,
        } as TextLayer;
      }
      if (l.type === "shape")
        return { ...l, fill: swap(l.fill)!, fill2: swap(l.fill2), stroke: swap(l.stroke) };
      return l;
    }),
  };
}

/** Undo/redo history over immutable designs. */
export class History {
  private past: Design[] = [];
  private future: Design[] = [];
  constructor(
    public present: Design,
    private limit = 100,
  ) {}

  push(next: Design): Design {
    if (next === this.present) return next;
    this.past.push(this.present);
    if (this.past.length > this.limit) this.past.shift();
    this.present = next;
    this.future = [];
    return next;
  }

  /** Replace the present without a new undo step (e.g. continuous drag). */
  replace(next: Design): Design {
    this.present = next;
    return next;
  }

  undo(): Design {
    const prev = this.past.pop();
    if (!prev) return this.present;
    this.future.push(this.present);
    this.present = prev;
    return prev;
  }

  redo(): Design {
    const next = this.future.pop();
    if (!next) return this.present;
    this.past.push(this.present);
    this.present = next;
    return next;
  }

  get canUndo() {
    return this.past.length > 0;
  }
  get canRedo() {
    return this.future.length > 0;
  }
}
