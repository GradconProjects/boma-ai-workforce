"use client";

import { useEffect, useRef, useState } from "react";
import {
  Circle,
  Eye,
  EyeOff,
  ImageIcon,
  Layers,
  Loader2,
  Lock,
  Square,
  Type,
  Upload,
} from "lucide-react";
import { newId, type Brand, type Design, type Layer, type TextLayer } from "@boma/design-engine";

export type Tab = "add" | "images" | "layers";

export interface PanelsProps {
  tab: Tab;
  setTab(t: Tab): void;
  design: Design;
  brand: Brand;
  stockImages: { src: string; label: string }[];
  selectedId: string | null;
  onSelect(id: string): void;
  onAdd(layer: Layer): void;
  onBackground(src: string): void;
  onLayer(id: string, patch: Partial<Layer>): void;
}

export function Panels(p: PanelsProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-ink-950/60 p-1">
        {(
          [
            ["add", "Add", Type],
            ["images", "Images", ImageIcon],
            ["layers", "Layers", Layers],
          ] as const
        ).map(([t, label, Icon]) => (
          <button
            key={t}
            onClick={() => p.setTab(t)}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${p.tab === t ? "bg-white/10 text-white" : "text-mist-400 hover:text-white"}`}
          >
            <Icon className="size-3.5" /> {label}
          </button>
        ))}
      </div>
      <div className="scroll-thin mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
        {p.tab === "add" && <AddPanel {...p} />}
        {p.tab === "images" && <ImagesPanel {...p} />}
        {p.tab === "layers" && <LayersPanel {...p} />}
      </div>
    </div>
  );
}

function textPreset(
  d: Design,
  brand: Brand,
  kind: "heading" | "subheading" | "body" | "button",
): TextLayer {
  const u = Math.min(d.width, d.height) / 100;
  const base = {
    id: newId(),
    type: "text" as const,
    role: "free" as const,
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    italic: false,
    letterSpacing: 0,
    uppercase: false,
    background: null as string | null,
    padding: 0,
    radius: 0,
  };
  const w = Math.round(d.width * 0.7);
  const x = Math.round((d.width - w) / 2);
  const y = Math.round(d.height * 0.4);
  switch (kind) {
    case "heading":
      return {
        ...base,
        name: "Heading",
        text: "Add a heading",
        x,
        y,
        w,
        h: Math.round(12 * u),
        fontSize: Math.round(9 * u),
        fontWeight: 800,
        fontFamily: brand.headingFont,
        color: "#FFFFFF",
        align: "center",
        lineHeight: 1.05,
      };
    case "subheading":
      return {
        ...base,
        name: "Subheading",
        text: "Add a subheading",
        x,
        y,
        w,
        h: Math.round(7 * u),
        fontSize: Math.round(4.5 * u),
        fontWeight: 600,
        fontFamily: brand.headingFont,
        color: "#E8ECF4",
        align: "center",
        lineHeight: 1.2,
      };
    case "body":
      return {
        ...base,
        name: "Body text",
        text: "Add a little body text",
        x,
        y,
        w,
        h: Math.round(10 * u),
        fontSize: Math.round(3 * u),
        fontWeight: 400,
        fontFamily: brand.bodyFont,
        color: "#DDE3EE",
        align: "center",
        lineHeight: 1.45,
      };
    case "button":
      return {
        ...base,
        name: "Button",
        text: "Get in touch",
        x: Math.round((d.width - 32 * u) / 2),
        y,
        w: Math.round(32 * u),
        h: Math.round(8 * u),
        fontSize: Math.round(3.1 * u),
        fontWeight: 700,
        fontFamily: brand.headingFont,
        color: brand.primary,
        align: "center",
        lineHeight: 1,
        background: brand.accent,
        radius: Math.round(4 * u),
        padding: Math.round(2 * u),
      };
  }
}

function AddPanel(p: PanelsProps) {
  const d = p.design;
  const u = Math.min(d.width, d.height) / 100;
  const shape = (kind: "rect" | "ellipse"): Layer => ({
    id: newId(),
    name: kind === "rect" ? "Rectangle" : "Circle",
    type: "shape",
    shape: kind,
    x: Math.round(d.width / 2 - 15 * u),
    y: Math.round(d.height / 2 - 15 * u),
    w: Math.round(30 * u),
    h: Math.round(30 * u),
    rotation: 0,
    opacity: 1,
    locked: false,
    hidden: false,
    fill: p.brand.accent,
    fill2: null,
    gradientAngle: 180,
    radius: kind === "rect" ? Math.round(2 * u) : 0,
    stroke: null,
    strokeWidth: 0,
  });
  return (
    <div className="space-y-5">
      <div>
        <div className="label">Text</div>
        <div className="space-y-2">
          <button
            onClick={() => p.onAdd(textPreset(d, p.brand, "heading"))}
            className="w-full rounded-xl border border-white/[0.07] bg-ink-900/60 px-4 py-3 text-left font-display text-xl font-extrabold transition hover:border-amber/40"
          >
            Add a heading
          </button>
          <button
            onClick={() => p.onAdd(textPreset(d, p.brand, "subheading"))}
            className="w-full rounded-xl border border-white/[0.07] bg-ink-900/60 px-4 py-2.5 text-left font-display text-base font-semibold transition hover:border-amber/40"
          >
            Add a subheading
          </button>
          <button
            onClick={() => p.onAdd(textPreset(d, p.brand, "body"))}
            className="w-full rounded-xl border border-white/[0.07] bg-ink-900/60 px-4 py-2.5 text-left text-sm transition hover:border-amber/40"
          >
            Add body text
          </button>
          <button
            onClick={() => p.onAdd(textPreset(d, p.brand, "button"))}
            className="w-full rounded-xl border border-white/[0.07] bg-ink-900/60 px-4 py-2.5 text-left transition hover:border-amber/40"
          >
            <span
              className="rounded-full px-3 py-1 text-xs font-bold"
              style={{ background: p.brand.accent, color: p.brand.primary }}
            >
              Add a button
            </span>
          </button>
        </div>
      </div>
      <div>
        <div className="label">Shapes</div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => p.onAdd(shape("rect"))}
            className="grid h-20 place-items-center rounded-xl border border-white/[0.07] bg-ink-900/60 transition hover:border-amber/40"
          >
            <Square className="size-8" style={{ color: p.brand.accent }} />
          </button>
          <button
            onClick={() => p.onAdd(shape("ellipse"))}
            className="grid h-20 place-items-center rounded-xl border border-white/[0.07] bg-ink-900/60 transition hover:border-amber/40"
          >
            <Circle className="size-8" style={{ color: p.brand.accent }} />
          </button>
        </div>
      </div>
      <div>
        <div className="label">Brand colours</div>
        <div className="flex gap-2">
          {[p.brand.primary, p.brand.secondary, p.brand.accent].map((c) => (
            <div
              key={c}
              className="h-10 flex-1 rounded-xl ring-1 ring-white/10"
              style={{ background: c }}
              title={c}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ImagesPanel(p: PanelsProps) {
  const [uploads, setUploads] = useState<{ src: string; label: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/uploads")
      .then((r) => (r.ok ? r.json() : { images: [] }))
      .then((j) => setUploads(j.images ?? []))
      .catch(() => undefined);
  }, []);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/uploads", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) setError(j.error ?? "Upload failed");
      else setUploads((u) => [{ src: j.src, label: file.name }, ...u]);
    }
    setBusy(false);
  };

  const addImage = (src: string) =>
    p.onAdd({
      id: newId(),
      name: "Image",
      type: "image",
      src,
      fit: "cover",
      radius: 0,
      x: Math.round(p.design.width * 0.2),
      y: Math.round(p.design.height * 0.2),
      w: Math.round(p.design.width * 0.6),
      h: Math.round(p.design.width * 0.6),
      rotation: 0,
      opacity: 1,
      locked: false,
      hidden: false,
    });

  const Grid = ({ items }: { items: { src: string; label: string }[] }) => (
    <div className="grid grid-cols-2 gap-2">
      {items.map((img) => (
        <div
          key={img.src}
          className="group relative overflow-hidden rounded-xl ring-1 ring-white/10"
        >
          <img src={img.src} alt={img.label} className="aspect-square w-full object-cover" />
          <div className="absolute inset-0 flex flex-col justify-end gap-1 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-1.5 opacity-0 transition group-hover:opacity-100">
            <button
              onClick={() => p.onBackground(img.src)}
              className="rounded-md bg-white/90 py-1 text-[10px] font-bold text-ink-950"
            >
              Set as background
            </button>
            <button
              onClick={() => addImage(img.src)}
              className="rounded-md bg-ink-950/80 py-1 text-[10px] font-bold text-white"
            >
              Add as layer
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          hidden
          onChange={(e) => upload(e.target.files)}
        />
        <button
          onClick={() => input.current?.click()}
          disabled={busy}
          className="btn-outline w-full border-dashed py-4"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {busy ? "Uploading…" : "Upload your images"}
        </button>
        <p className="mt-1.5 text-[11px] text-mist-400">PNG, JPEG or WebP up to 10 MB.</p>
        {error && <p className="mt-1 text-xs text-coral">{error}</p>}
      </div>
      {uploads.length > 0 && (
        <div>
          <div className="label">Your uploads</div>
          <Grid items={uploads} />
        </div>
      )}
      <div>
        <div className="label">Placeholders</div>
        <Grid items={p.stockImages} />
      </div>
    </div>
  );
}

function LayersPanel(p: PanelsProps) {
  const layers = [...p.design.layers].reverse(); // top of the stack first
  return (
    <div className="space-y-1">
      {layers.map((l) => (
        <div
          key={l.id}
          onClick={() => p.onSelect(l.id)}
          className={`group flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition ${p.selectedId === l.id ? "bg-amber/10 text-white ring-1 ring-amber/30" : "text-mist-300 hover:bg-white/5"}`}
        >
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-ink-950/70 text-mist-400">
            {l.type === "text" ? (
              <Type className="size-3.5" />
            ) : l.type === "image" ? (
              <ImageIcon className="size-3.5" />
            ) : l.shape === "ellipse" ? (
              <Circle className="size-3.5" />
            ) : (
              <Square className="size-3.5" />
            )}
          </span>
          <span className="min-w-0 flex-1 truncate">
            {l.type === "text" ? l.text || l.name : l.name}
          </span>
          {l.locked && <Lock className="size-3 text-mist-400" />}
          <button
            onClick={(e) => {
              e.stopPropagation();
              p.onLayer(l.id, { hidden: !l.hidden });
            }}
            className="text-mist-400 opacity-60 hover:text-white group-hover:opacity-100"
            title={l.hidden ? "Show" : "Hide"}
          >
            {l.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </button>
        </div>
      ))}
    </div>
  );
}
