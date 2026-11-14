"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Cloud,
  Download,
  History as HistoryIcon,
  Loader2,
  Minus,
  Plus,
  Redo2,
  Sparkles,
  Undo2,
} from "lucide-react";
import {
  addLayer,
  alignLayer,
  duplicateLayer,
  growToFit,
  History,
  removeLayer,
  reorderLayer,
  updateLayer,
  type Alignment,
  type Brand,
  type Design,
  type Layer,
} from "@boma/design-engine";
import { requestCopyAction, restoreVersionAction, saveDesignAction } from "@/app/actions";
import { Canvas } from "./canvas";
import { designToPngBlob, downloadBlob, safeFilename } from "./export";
import { Inspector } from "./inspector";
import { Panels, type Tab } from "./panels";

type SaveState = "saved" | "dirty" | "saving" | "conflict" | "error";

export interface EditorProps {
  designId: string;
  initialDoc: Design;
  initialRevision: number;
  initialTitle: string;
  brand: Brand & { image?: string };
  stockImages: { src: string; label: string }[];
  versions: { revision: number; note: string; actor: string; created_at: string }[];
  campaignItem: {
    id: string;
    campaign_id: string;
    copy_status: string;
    simulated: boolean;
    campaign_name: string;
  } | null;
}

export function Editor(p: EditorProps) {
  const router = useRouter();
  const history = useRef(new History(p.initialDoc));
  const [doc, setDoc] = useState<Design>(p.initialDoc);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState(p.initialTitle);
  const [tab, setTab] = useState<Tab>("add");
  const [zoom, setZoom] = useState<number | null>(null); // null = fit
  const [fit, setFit] = useState(0.4);
  const [save, setSave] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [chiefMsg, setChiefMsg] = useState<string | null>(null);
  const [chiefNotes, setChiefNotes] = useState("");
  const revision = useRef(p.initialRevision);
  const stageWrap = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  // ───────── history-aware updates ─────────
  const commit = useCallback((next: Design) => {
    setDoc(history.current.push(next));
  }, []);
  const preview = useCallback((next: Design) => setDoc(history.current.replace(next)), []);
  const commitFrom = useCallback((base: Design, next: Design) => {
    history.current.replace(base);
    setDoc(history.current.push(next));
  }, []);
  const undo = () => setDoc(history.current.undo());
  const redo = () => setDoc(history.current.redo());

  const selected = doc.layers.find((l) => l.id === selectedId) ?? null;
  const patchSelected = (patch: Partial<Layer>) => {
    if (!selected) return;
    let next = updateLayer(doc, selected.id, patch);
    // Typing more text (or a bigger font) grows the box instead of overflowing it.
    if (
      selected.type === "text" &&
      ("text" in patch || "fontSize" in patch || "lineHeight" in patch)
    ) {
      const l = next.layers.find((x) => x.id === selected.id);
      if (l?.type === "text") next = updateLayer(next, l.id, { h: growToFit(l).h });
    }
    commit(next);
  };

  const action = (a: "duplicate" | "delete" | "front" | "back" | Alignment) => {
    if (!selected) return;
    if (a === "duplicate") {
      const r = duplicateLayer(doc, selected.id);
      commit(r.design);
      setSelectedId(r.newId);
    } else if (a === "delete") {
      commit(removeLayer(doc, selected.id));
      setSelectedId(null);
    } else if (a === "front" || a === "back") commit(reorderLayer(doc, selected.id, a));
    else commit(alignLayer(doc, selected.id, a));
  };

  // ───────── fit to screen ─────────
  useLayoutEffect(() => {
    const el = stageWrap.current;
    if (!el) return;
    const measure = () => {
      const pad = 80;
      setFit(Math.min((el.clientWidth - pad) / doc.width, (el.clientHeight - pad) / doc.height, 1));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [doc.width, doc.height]);
  const scale = zoom ?? fit;

  // ───────── autosave (serialised, optimistic locking) ─────────
  const saving = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef<{ doc: Design; title: string } | null>(null);
  const flush = useCallback(
    (snapshot = false, note?: string) => {
      saving.current = saving.current.then(async () => {
        const job = pending.current;
        if (!job && !snapshot) return;
        pending.current = null;
        setSave("saving");
        const r = await saveDesignAction({
          id: p.designId,
          doc: job?.doc ?? history.current.present,
          title: job?.title,
          baseRevision: revision.current,
          snapshot,
          note,
        });
        if (r.ok) {
          revision.current = r.revision;
          setSave(pending.current ? "dirty" : "saved");
        } else {
          setSave(r.conflict ? "conflict" : "error");
          setSaveError(r.error);
        }
      });
      return saving.current;
    },
    [p.designId],
  );

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (save === "conflict") return;
    pending.current = { doc, title };
    setSave("dirty");
    const t = setTimeout(() => void flush(), 900);
    return () => clearTimeout(t);
  }, [doc, title]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (save === "dirty" || save === "saving") e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [save]);

  // ───────── keyboard ─────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable=true]")) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (mod && e.key.toLowerCase() === "d" && selected) {
        e.preventDefault();
        action("duplicate");
      } else if ((e.key === "Delete" || e.key === "Backspace") && selected && !selected.locked) {
        e.preventDefault();
        action("delete");
      } else if (e.key === "Escape") setSelectedId(null);
      else if (selected && !selected.locked && e.key.startsWith("Arrow")) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        commit(updateLayer(doc, selected.id, { x: selected.x + dx, y: selected.y + dy }));
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  const exportPng = async () => {
    setExporting(true);
    try {
      downloadBlob(await designToPngBlob(doc), `${safeFilename(title)}.png`);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const askChief = async () => {
    if (!p.campaignItem) return;
    await flush();
    const r = await requestCopyAction({
      campaignId: p.campaignItem.campaign_id,
      itemIds: [p.campaignItem.id],
      notes: chiefNotes || undefined,
    });
    setChiefMsg(r.message);
  };

  return (
    <div className="flex h-screen flex-col">
      {/* Top bar */}
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-white/5 bg-ink-950/80 px-4 backdrop-blur-xl">
        <Link
          href={p.campaignItem ? `/campaigns/${p.campaignItem.campaign_id}` : "/studio"}
          className="btn-ghost px-2.5"
          title="Back"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-[min(40vw,360px)] truncate rounded-lg bg-transparent px-2 py-1 font-display text-[15px] font-bold outline-none hover:bg-white/5 focus:bg-white/5"
            aria-label="Design title"
          />
          <div className="px-2 text-[11px] text-mist-400">
            {p.brand.name} · {doc.width}×{doc.height}
            {p.campaignItem && <> · {p.campaignItem.campaign_name}</>}
          </div>
        </div>
        <div className="mx-auto flex items-center gap-1">
          <button
            className="btn-ghost px-2.5"
            onClick={undo}
            disabled={!history.current.canUndo}
            title="Undo (⌘Z)"
          >
            <Undo2 className="size-4" />
          </button>
          <button
            className="btn-ghost px-2.5"
            onClick={redo}
            disabled={!history.current.canRedo}
            title="Redo (⇧⌘Z)"
          >
            <Redo2 className="size-4" />
          </button>
          <span className="mx-2 h-6 w-px bg-white/10" />
          <button
            className="btn-ghost px-2"
            onClick={() => setZoom(Math.max(0.1, scale - 0.1))}
            title="Zoom out"
          >
            <Minus className="size-4" />
          </button>
          <button
            className="w-14 rounded-lg py-1 text-center font-mono text-xs text-mist-300 hover:bg-white/5"
            onClick={() => setZoom(null)}
            title="Fit to screen"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            className="btn-ghost px-2"
            onClick={() => setZoom(Math.min(3, scale + 0.1))}
            title="Zoom in"
          >
            <Plus className="size-4" />
          </button>
        </div>
        <SaveBadge state={save} />
        <div className="relative">
          <button
            className="btn-ghost px-2.5"
            onClick={() => setShowHistory((s) => !s)}
            title="Version history"
          >
            <HistoryIcon className="size-4" />
          </button>
          {showHistory && (
            <div className="panel absolute top-11 right-0 z-30 w-80 rounded-2xl p-3">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-xs font-bold tracking-wider text-mist-300 uppercase">
                  Versions
                </span>
                <button
                  className="text-xs text-amber hover:underline"
                  onClick={() => flush(true, "saved version").then(() => router.refresh())}
                >
                  Save a version now
                </button>
              </div>
              <div className="scroll-thin max-h-80 space-y-1 overflow-y-auto">
                {p.versions.map((v) => (
                  <div
                    key={v.revision}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-white/5"
                  >
                    <span className="font-mono text-mist-400">r{v.revision}</span>
                    <span className="min-w-0 flex-1 truncate" title={v.note}>
                      {v.note}
                      <span className="block text-[10px] text-mist-400">
                        {v.actor === "owner" ? "You" : v.actor.replace("bot:", "")} ·{" "}
                        {new Date(v.created_at).toLocaleString("en-AU", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                    </span>
                    <button
                      className="text-amber hover:underline"
                      onClick={() =>
                        restoreVersionAction(p.designId, v.revision).then(() => router.refresh())
                      }
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <button className="btn-primary" onClick={exportPng} disabled={exporting}>
          {exporting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}{" "}
          Export PNG
        </button>
      </header>

      {save === "conflict" && (
        <div className="flex items-center gap-3 border-b border-amber/30 bg-amber/10 px-5 py-2.5 text-sm text-amber">
          <AlertTriangle className="size-4" />
          {saveError || "This design changed elsewhere (perhaps the Chief applied new copy)."} Your
          latest edits were not saved.
          <button className="ml-auto font-semibold underline" onClick={() => router.refresh()}>
            Load the latest version
          </button>
        </div>
      )}
      {save === "error" && (
        <div className="border-b border-coral/30 bg-coral/10 px-5 py-2 text-sm text-coral">
          Couldn&apos;t save: {saveError}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Left panels */}
        <aside className="w-72 shrink-0 border-r border-white/5 bg-ink-950/50 p-4">
          <Panels
            tab={tab}
            setTab={setTab}
            design={doc}
            brand={p.brand}
            stockImages={p.stockImages}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onAdd={(l) => {
              commit(addLayer(doc, l));
              setSelectedId(l.id);
            }}
            onBackground={(src) =>
              commit({ ...doc, background: { ...doc.background, imageUrl: src } })
            }
            onLayer={(id, patch) => commit(updateLayer(doc, id, patch))}
          />
        </aside>

        {/* Stage */}
        <main
          ref={stageWrap}
          className="stage-bg relative grid min-w-0 flex-1 place-items-center overflow-auto"
        >
          <div className="p-10">
            <Canvas
              design={doc}
              scale={scale}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onPreview={preview}
              onCommit={commitFrom}
              onTextCommit={(id, text) => {
                const next = updateLayer(doc, id, { text });
                const l = next.layers.find((x) => x.id === id);
                commit(l?.type === "text" ? updateLayer(next, id, { h: growToFit(l).h }) : next);
              }}
            />
          </div>
        </main>

        {/* Inspector */}
        <aside className="scroll-thin w-80 shrink-0 space-y-4 overflow-y-auto border-l border-white/5 bg-ink-950/50 p-4">
          {p.campaignItem && (
            <section className="rounded-2xl border border-amber/20 bg-gradient-to-b from-amber/[0.08] to-transparent p-4">
              <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-amber uppercase">
                <Sparkles className="size-3.5" /> Chief of Staff
              </div>
              <p className="mt-2 text-xs leading-relaxed text-mist-300">
                Copy status:{" "}
                <b className="text-white">{p.campaignItem.copy_status.replace("_", " ")}</b>
                {p.campaignItem.simulated && (
                  <span className="ml-1 chip bg-iris/15 px-1.5 py-0 text-iris">simulated</span>
                )}
              </p>
              <textarea
                value={chiefNotes}
                onChange={(e) => setChiefNotes(e.target.value)}
                placeholder="Notes for the Chief (optional), e.g. 'mention free first inspection'"
                className="field mt-3 min-h-16 text-xs"
              />
              <button className="btn-primary mt-2 w-full py-2 text-xs" onClick={askChief}>
                <Sparkles className="size-3.5" /> Ask the Chief to write copy
              </button>
              {chiefMsg && <p className="mt-2 text-xs text-mist-300">{chiefMsg}</p>}
            </section>
          )}
          <Inspector
            design={doc}
            layer={selected}
            brand={p.brand}
            onLayer={patchSelected}
            onDesign={commit}
            onAction={action}
          />
        </aside>
      </div>
    </div>
  );
}

function SaveBadge({ state }: { state: SaveState }) {
  const map: Record<SaveState, { icon: React.ReactNode; text: string; cls: string }> = {
    saved: { icon: <Check className="size-3.5" />, text: "Saved", cls: "text-sage" },
    dirty: { icon: <Cloud className="size-3.5" />, text: "Unsaved", cls: "text-mist-400" },
    saving: {
      icon: <Loader2 className="size-3.5 animate-spin" />,
      text: "Saving…",
      cls: "text-mist-300",
    },
    conflict: {
      icon: <AlertTriangle className="size-3.5" />,
      text: "Out of date",
      cls: "text-amber",
    },
    error: { icon: <AlertTriangle className="size-3.5" />, text: "Not saved", cls: "text-coral" },
  };
  const s = map[state];
  return (
    <span className={`flex items-center gap-1.5 text-xs font-medium ${s.cls}`}>
      {s.icon} {s.text}
    </span>
  );
}
