"use client";

import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { snap, type Design, type Layer, type TextLayer } from "@boma/design-engine";
import { Backdrop, layerBox, LayerContent, textStyle } from "../design-view";

/**
 * Interactive stage. All geometry is in design pixels; pointer deltas are divided by `scale`.
 * During a gesture the editor previews changes (no undo step) and commits once on release.
 */

type Handle = "nw" | "ne" | "sw" | "se" | "e" | "w" | "n" | "s";

interface Gesture {
  kind: "move" | "resize" | "rotate";
  id: string;
  handle?: Handle;
  startX: number;
  startY: number;
  orig: Layer;
  base: Design;
}

export interface CanvasProps {
  design: Design;
  scale: number;
  selectedId: string | null;
  onSelect(id: string | null): void;
  /** Live update during a gesture (no undo entry). */
  onPreview(next: Design): void;
  /** Final result of a gesture: one undo entry relative to `base`. */
  onCommit(base: Design, next: Design): void;
  onTextCommit(id: string, text: string): void;
}

const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const cursorFor: Record<Handle, string> = {
  nw: "nwse-resize",
  se: "nwse-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
};

export function Canvas(p: CanvasProps) {
  const gesture = useRef<Gesture | null>(null);
  const latest = useRef<Design>(p.design);
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({
    x: null,
    y: null,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  latest.current = p.design;

  const selected = p.design.layers.find((l) => l.id === p.selectedId) ?? null;

  const patchLayer = (base: Design, id: string, patch: Partial<Layer>): Design => ({
    ...base,
    layers: base.layers.map((l) => (l.id === id ? ({ ...l, ...patch } as Layer) : l)),
  });

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const g = gesture.current;
      if (!g) return;
      const dx = (e.clientX - g.startX) / p.scale;
      const dy = (e.clientY - g.startY) / p.scale;
      const o = g.orig;
      const d = g.base;
      if (g.kind === "move") {
        const sx = snap(o.x + dx, o.w, d.width, 10 / p.scale);
        const sy = snap(o.y + dy, o.h, d.height, 10 / p.scale);
        const x = e.altKey ? Math.round(o.x + dx) : sx.value;
        const y = e.altKey ? Math.round(o.y + dy) : sy.value;
        setGuides({ x: e.altKey ? null : sx.guide, y: e.altKey ? null : sy.guide });
        p.onPreview(patchLayer(d, o.id, { x, y }));
      } else if (g.kind === "resize" && g.handle) {
        const h = g.handle;
        let { x, y, w, h: ht } = o;
        if (h.includes("e")) w = o.w + dx;
        if (h.includes("s")) ht = o.h + dy;
        if (h.includes("w")) {
          w = o.w - dx;
          x = o.x + dx;
        }
        if (h.includes("n")) {
          ht = o.h - dy;
          y = o.y + dy;
        }
        // Keep proportions for images and shapes when Shift is held (corner handles).
        if (e.shiftKey && h.length === 2) {
          const ratio = o.w / o.h;
          if (Math.abs(w - o.w) > Math.abs(ht - o.h) * ratio) ht = w / ratio;
          else w = ht * ratio;
          if (h.includes("w")) x = o.x + o.w - w;
          if (h.includes("n")) y = o.y + o.h - ht;
        }
        w = Math.max(20, w);
        ht = Math.max(20, ht);
        p.onPreview(
          patchLayer(d, o.id, {
            x: Math.round(x),
            y: Math.round(y),
            w: Math.round(w),
            h: Math.round(ht),
          }),
        );
      } else if (g.kind === "rotate") {
        const stage = document.getElementById("boma-stage")!.getBoundingClientRect();
        const cx = stage.left + (o.x + o.w / 2) * p.scale;
        const cy = stage.top + (o.y + o.h / 2) * p.scale;
        let deg = (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI + 90;
        deg = e.shiftKey ? Math.round(deg / 15) * 15 : Math.round(deg);
        if (Math.abs(deg) < 3 || Math.abs(deg - 360) < 3) deg = 0;
        p.onPreview(patchLayer(d, o.id, { rotation: ((deg + 540) % 360) - 180 }));
      }
    };
    const up = () => {
      const g = gesture.current;
      if (!g) return;
      gesture.current = null;
      setGuides({ x: null, y: null });
      p.onCommit(g.base, latest.current);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [p]);

  const begin = (e: RPointerEvent, kind: Gesture["kind"], layer: Layer, handle?: Handle) => {
    if (layer.locked || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    gesture.current = {
      kind,
      id: layer.id,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      orig: layer,
      base: p.design,
    };
  };

  const W = p.design.width * p.scale;
  const H = p.design.height * p.scale;

  return (
    <div
      id="boma-stage"
      className="relative shadow-[0_30px_80px_-20px_rgba(0,0,0,0.75)] ring-1 ring-white/10"
      style={{ width: W, height: H }}
      onPointerDown={() => {
        setEditingId(null);
        p.onSelect(null);
      }}
    >
      <div
        style={{
          width: p.design.width,
          height: p.design.height,
          transform: `scale(${p.scale})`,
          transformOrigin: "0 0",
          position: "absolute",
          overflow: "hidden",
        }}
      >
        <Backdrop design={p.design} />
        {p.design.layers.map((l) =>
          editingId === l.id && l.type === "text" ? (
            <TextEditor
              key={l.id}
              layer={l}
              onDone={(text) => {
                setEditingId(null);
                if (text !== l.text) p.onTextCommit(l.id, text);
              }}
            />
          ) : (
            <div
              key={l.id}
              data-layer={l.id}
              style={{ ...layerBox(l), cursor: l.locked ? "default" : "move" }}
              onPointerDown={(e) => {
                p.onSelect(l.id);
                begin(e, "move", l);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                if (l.type === "text" && !l.locked) setEditingId(l.id);
              }}
            >
              <LayerContent layer={l} />
            </div>
          ),
        )}
      </div>

      {/* Snap guides */}
      {guides.x !== null && (
        <div
          className="pointer-events-none absolute top-0 bottom-0 w-px bg-coral"
          style={{ left: guides.x * p.scale }}
        />
      )}
      {guides.y !== null && (
        <div
          className="pointer-events-none absolute right-0 left-0 h-px bg-coral"
          style={{ top: guides.y * p.scale }}
        />
      )}

      {/* Selection frame + handles, drawn in screen space so they stay crisp at any zoom */}
      {selected && !selected.hidden && editingId !== selected.id && (
        <div
          className="pointer-events-none absolute"
          style={{
            left: selected.x * p.scale,
            top: selected.y * p.scale,
            width: selected.w * p.scale,
            height: selected.h * p.scale,
            transform: selected.rotation ? `rotate(${selected.rotation}deg)` : undefined,
          }}
        >
          <div
            className={`absolute inset-0 rounded-[2px] border-[1.5px] ${selected.locked ? "border-dashed border-mist-400" : "border-amber"}`}
          />
          {!selected.locked && (
            <>
              {HANDLES.filter((h) => selected.type !== "text" || h !== "n").map((h) => (
                <div
                  key={h}
                  className="pointer-events-auto absolute size-3 rounded-full border-2 border-amber bg-ink-950 shadow"
                  style={{
                    cursor: cursorFor[h],
                    left: h.includes("w")
                      ? -6
                      : h.includes("e")
                        ? "calc(100% - 6px)"
                        : "calc(50% - 6px)",
                    top: h.includes("n")
                      ? -6
                      : h.includes("s")
                        ? "calc(100% - 6px)"
                        : "calc(50% - 6px)",
                  }}
                  onPointerDown={(e) => begin(e, "resize", selected, h)}
                />
              ))}
              <div className="absolute left-1/2 -top-8 h-6 w-px -translate-x-1/2 bg-amber/70" />
              <div
                title="Rotate (Shift: 15° steps)"
                className="pointer-events-auto absolute left-1/2 -top-10 size-4 -translate-x-1/2 cursor-grab rounded-full border-2 border-amber bg-ink-950"
                onPointerDown={(e) => begin(e, "rotate", selected)}
              />
              <div className="absolute -bottom-7 left-0 rounded-md bg-ink-950/90 px-1.5 py-0.5 font-mono text-[10px] whitespace-nowrap text-mist-200">
                {Math.round(selected.w)} × {Math.round(selected.h)}
                {selected.rotation ? ` · ${selected.rotation}°` : ""}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function TextEditor({ layer, onDone }: { layer: TextLayer; onDone(text: string): void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const s = textStyle(layer);
  return (
    <textarea
      ref={ref}
      defaultValue={layer.text}
      onPointerDown={(e) => e.stopPropagation()}
      onBlur={(e) => onDone(e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === "Escape" || (e.key === "Enter" && (e.metaKey || e.ctrlKey)))
          e.currentTarget.blur();
        e.stopPropagation();
      }}
      style={{
        ...layerBox(layer),
        ...s,
        display: "block",
        resize: "none",
        outline: "3px solid rgba(244,184,96,0.85)",
        outlineOffset: 2,
        overflow: "hidden",
        border: "none",
        background: layer.background ?? "rgba(0,0,0,0.15)",
      }}
    />
  );
}
