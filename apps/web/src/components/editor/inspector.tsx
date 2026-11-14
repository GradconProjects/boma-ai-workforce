"use client";

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowUpToLine,
  Bold,
  Copy,
  Italic,
  Lock,
  Trash2,
  Unlock,
} from "lucide-react";
import type { Alignment, Brand, Design, Layer, TextLayer } from "@boma/design-engine";

export const FONTS = [
  "Manrope",
  "DM Sans",
  "Fraunces",
  "Playfair Display",
  "Space Grotesk",
  "Bebas Neue",
];

export interface InspectorProps {
  design: Design;
  layer: Layer | null;
  brand: Brand;
  onLayer(patch: Partial<Layer>): void;
  onDesign(next: Design): void;
  onAction(a: "duplicate" | "delete" | "front" | "back" | Alignment): void;
}

export function Inspector(p: InspectorProps) {
  const swatches = [
    p.brand.primary,
    p.brand.secondary,
    p.brand.accent,
    "#FFFFFF",
    "#0B0F19",
    "#E8ECF4",
  ];
  if (!p.layer) {
    const b = p.design.background;
    const setBg = (patch: Partial<Design["background"]>) =>
      p.onDesign({ ...p.design, background: { ...b, ...patch } });
    return (
      <Panel title="Page">
        <Row label="Size">
          <div className="text-sm text-mist-300">
            {p.design.width} × {p.design.height} px
          </div>
        </Row>
        <Row label="Background">
          <ColorField value={b.color} swatches={swatches} onChange={(color) => setBg({ color })} />
        </Row>
        {b.imageUrl && (
          <>
            <Row label="Photo">
              <button
                className="btn-outline w-full py-1.5 text-xs"
                onClick={() => setBg({ imageUrl: null })}
              >
                Remove background photo
              </button>
            </Row>
            <Row label="Tint">
              <ColorField
                value={b.overlay ?? "#000000"}
                swatches={swatches}
                onChange={(overlay) => setBg({ overlay, overlayOpacity: b.overlayOpacity || 0.35 })}
              />
            </Row>
            <Row label={`Tint strength ${Math.round(b.overlayOpacity * 100)}%`}>
              <input
                type="range"
                min={0}
                max={0.9}
                step={0.05}
                value={b.overlayOpacity}
                onChange={(e) =>
                  setBg({ overlayOpacity: Number(e.target.value), overlay: b.overlay ?? "#000000" })
                }
                className="w-full accent-amber"
              />
            </Row>
          </>
        )}
        <p className="mt-4 text-xs leading-relaxed text-mist-400">
          Select a layer to edit it. Double-click text to type. Drag to move, Alt to skip snapping,
          Shift to keep proportions.
        </p>
      </Panel>
    );
  }

  const l = p.layer;
  return (
    <div className="space-y-4">
      <Panel
        title={l.name}
        actions={
          <>
            <IconBtn
              title={l.locked ? "Unlock" : "Lock"}
              onClick={() => p.onLayer({ locked: !l.locked })}
            >
              {l.locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
            </IconBtn>
            <IconBtn title="Duplicate (⌘D)" onClick={() => p.onAction("duplicate")}>
              <Copy className="size-3.5" />
            </IconBtn>
            <IconBtn title="Delete (Del)" onClick={() => p.onAction("delete")}>
              <Trash2 className="size-3.5 text-coral" />
            </IconBtn>
          </>
        }
      >
        <div className="grid grid-cols-4 gap-2">
          {(["x", "y", "w", "h"] as const).map((k) => (
            <NumField
              key={k}
              label={k.toUpperCase()}
              value={Math.round(l[k])}
              onChange={(v) => p.onLayer({ [k]: k === "w" || k === "h" ? Math.max(10, v) : v })}
            />
          ))}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <NumField
            label="Rotate°"
            value={l.rotation}
            onChange={(v) => p.onLayer({ rotation: v })}
          />
          <NumField
            label="Opacity %"
            value={Math.round(l.opacity * 100)}
            onChange={(v) => p.onLayer({ opacity: Math.min(1, Math.max(0, v / 100)) })}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          {(["left", "hcenter", "right", "top", "vcenter", "bottom"] as Alignment[]).map((a) => (
            <button
              key={a}
              className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-mist-300 hover:border-white/20 hover:text-white"
              onClick={() => p.onAction(a)}
            >
              {
                {
                  left: "Left",
                  hcenter: "Centre",
                  right: "Right",
                  top: "Top",
                  vcenter: "Middle",
                  bottom: "Bottom",
                }[a]
              }
            </button>
          ))}
          <button
            className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-mist-300 hover:text-white"
            title="Bring to front"
            onClick={() => p.onAction("front")}
          >
            <ArrowUpToLine className="inline size-3" /> Front
          </button>
          <button
            className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-mist-300 hover:text-white"
            title="Send to back"
            onClick={() => p.onAction("back")}
          >
            <ArrowDownToLine className="inline size-3" /> Back
          </button>
        </div>
      </Panel>

      {l.type === "text" && <TextProps layer={l} swatches={swatches} onLayer={p.onLayer} />}

      {l.type === "shape" && (
        <Panel title="Fill">
          <Row label="Colour">
            <ColorField
              value={l.fill}
              swatches={swatches}
              onChange={(fill) => p.onLayer({ fill })}
            />
          </Row>
          <Row label="Gradient to">
            <div className="flex items-center gap-2">
              <ColorField
                value={l.fill2 ?? l.fill}
                swatches={swatches}
                onChange={(fill2) => p.onLayer({ fill2 })}
              />
              {l.fill2 && (
                <button
                  className="text-xs text-mist-400 hover:text-white"
                  onClick={() => p.onLayer({ fill2: null })}
                >
                  Solid
                </button>
              )}
            </div>
          </Row>
          {l.fill2 && (
            <Row label={`Angle ${l.gradientAngle}°`}>
              <input
                type="range"
                min={0}
                max={360}
                value={l.gradientAngle}
                onChange={(e) => p.onLayer({ gradientAngle: Number(e.target.value) })}
                className="w-full accent-amber"
              />
            </Row>
          )}
          {l.shape === "rect" && (
            <Row label={`Corner radius ${l.radius}`}>
              <input
                type="range"
                min={0}
                max={Math.round(Math.min(l.w, l.h) / 2)}
                value={l.radius}
                onChange={(e) => p.onLayer({ radius: Number(e.target.value) })}
                className="w-full accent-amber"
              />
            </Row>
          )}
          <Row label="Outline">
            <div className="flex items-center gap-2">
              <ColorField
                value={l.stroke ?? "#FFFFFF"}
                swatches={swatches}
                onChange={(stroke) => p.onLayer({ stroke, strokeWidth: l.strokeWidth || 4 })}
              />
              <NumField
                label="px"
                value={l.strokeWidth}
                onChange={(v) => p.onLayer({ strokeWidth: Math.max(0, v) })}
              />
            </div>
          </Row>
        </Panel>
      )}

      {l.type === "image" && (
        <Panel title="Image">
          <Row label="Fit">
            <div className="flex gap-1">
              {(["cover", "contain"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => p.onLayer({ fit: f })}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-xs ${l.fit === f ? "border-amber/50 bg-amber/10 text-amber" : "border-white/10 text-mist-300"}`}
                >
                  {f === "cover" ? "Fill frame" : "Fit inside"}
                </button>
              ))}
            </div>
          </Row>
          <Row label={`Corner radius ${l.radius}`}>
            <input
              type="range"
              min={0}
              max={Math.round(Math.min(l.w, l.h) / 2)}
              value={l.radius}
              onChange={(e) => p.onLayer({ radius: Number(e.target.value) })}
              className="w-full accent-amber"
            />
          </Row>
        </Panel>
      )}
    </div>
  );
}

function TextProps({
  layer: l,
  swatches,
  onLayer,
}: {
  layer: TextLayer;
  swatches: string[];
  onLayer(p: Partial<TextLayer>): void;
}) {
  return (
    <Panel title="Text">
      <textarea
        className="field min-h-20 resize-y text-[13px]"
        value={l.text}
        onChange={(e) => onLayer({ text: e.target.value })}
      />
      <div className="mt-3 grid grid-cols-[1fr_84px] gap-2">
        <select
          className="field py-2"
          value={l.fontFamily}
          onChange={(e) => onLayer({ fontFamily: e.target.value })}
          style={{ fontFamily: l.fontFamily }}
        >
          {FONTS.map((f) => (
            <option key={f} value={f} style={{ fontFamily: f }}>
              {f}
            </option>
          ))}
        </select>
        <NumField
          label="Size"
          value={l.fontSize}
          onChange={(v) => onLayer({ fontSize: Math.max(6, v) })}
        />
      </div>
      <div className="mt-2 flex items-center gap-1">
        <IconBtn
          active={l.fontWeight >= 700}
          title="Bold"
          onClick={() => onLayer({ fontWeight: l.fontWeight >= 700 ? 400 : 800 })}
        >
          <Bold className="size-3.5" />
        </IconBtn>
        <IconBtn active={l.italic} title="Italic" onClick={() => onLayer({ italic: !l.italic })}>
          <Italic className="size-3.5" />
        </IconBtn>
        <IconBtn
          active={l.uppercase}
          title="Capitals"
          onClick={() => onLayer({ uppercase: !l.uppercase })}
        >
          <span className="text-[10px] font-bold">AA</span>
        </IconBtn>
        <span className="mx-1 h-5 w-px bg-white/10" />
        {(["left", "center", "right"] as const).map((a) => (
          <IconBtn
            key={a}
            active={l.align === a}
            title={`Align ${a}`}
            onClick={() => onLayer({ align: a })}
          >
            {a === "left" ? (
              <AlignLeft className="size-3.5" />
            ) : a === "center" ? (
              <AlignCenter className="size-3.5" />
            ) : (
              <AlignRight className="size-3.5" />
            )}
          </IconBtn>
        ))}
        <select
          className="ml-auto rounded-lg border border-white/10 bg-transparent px-1.5 py-1 text-xs text-mist-300"
          value={l.fontWeight}
          onChange={(e) => onLayer({ fontWeight: Number(e.target.value) })}
        >
          {[300, 400, 500, 600, 700, 800, 900].map((w) => (
            <option key={w} value={w} className="bg-ink-900">
              {w}
            </option>
          ))}
        </select>
      </div>
      <Row label="Colour">
        <ColorField value={l.color} swatches={swatches} onChange={(color) => onLayer({ color })} />
      </Row>
      <div className="grid grid-cols-2 gap-2">
        <NumField
          label="Line height"
          step={0.05}
          value={l.lineHeight}
          onChange={(v) => onLayer({ lineHeight: Math.max(0.6, v) })}
        />
        <NumField
          label="Spacing"
          step={0.01}
          value={l.letterSpacing}
          onChange={(v) => onLayer({ letterSpacing: v })}
        />
      </div>
      <Row label="Button / highlight">
        <div className="flex items-center gap-2">
          <ColorField
            value={l.background ?? "#00000000"}
            swatches={swatches}
            onChange={(background) =>
              onLayer({
                background,
                radius: l.radius || Math.round(l.h / 2),
                padding: l.padding || 12,
              })
            }
          />
          {l.background && (
            <button
              className="text-xs text-mist-400 hover:text-white"
              onClick={() => onLayer({ background: null })}
            >
              None
            </button>
          )}
        </div>
      </Row>
      {l.role !== "free" && (
        <p className="mt-3 text-[11px] text-mist-400">
          Role: {l.role}. The Chief fills this when it writes copy.
        </p>
      )}
    </Panel>
  );
}

// ───────────── small controls ─────────────

export function Panel({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/[0.06] bg-ink-900/60 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="truncate text-xs font-bold tracking-wider text-mist-300 uppercase">
          {title}
        </h3>
        <div className="flex gap-1">{actions}</div>
      </div>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <div className="mb-1.5 text-[11px] font-semibold text-mist-400">{label}</div>
      {children}
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  active,
}: {
  children: React.ReactNode;
  onClick(): void;
  title: string;
  active?: boolean;
}) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`grid size-7 place-items-center rounded-lg transition ${active ? "bg-amber/15 text-amber" : "text-mist-300 hover:bg-white/5 hover:text-white"}`}
    >
      {children}
    </button>
  );
}

function NumField({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange(v: number): void;
  step?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold text-mist-400">{label}</span>
      <input
        type="number"
        step={step}
        value={Number.isFinite(value) ? Number(value.toFixed(2)) : 0}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
        className="w-full rounded-lg border border-white/10 bg-ink-950/60 px-2 py-1.5 font-mono text-xs text-mist-100 outline-none focus:border-amber/50"
      />
    </label>
  );
}

function ColorField({
  value,
  onChange,
  swatches,
}: {
  value: string;
  onChange(v: string): void;
  swatches: string[];
}) {
  const hex = /^#[0-9a-fA-F]{6}/.test(value) ? value.slice(0, 7) : "#000000";
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <label
        className="relative size-7 cursor-pointer overflow-hidden rounded-lg ring-1 ring-white/15"
        style={{ background: value }}
      >
        <input
          type="color"
          value={hex}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
      {swatches.map((s) => (
        <button
          key={s}
          title={s}
          onClick={() => onChange(s)}
          className="size-5 rounded-md ring-1 ring-white/15 transition hover:scale-110"
          style={{ background: s }}
        />
      ))}
    </div>
  );
}
