"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUp,
  Brain,
  Check,
  Clock,
  Copy,
  ExternalLink,
  FileText,
  Megaphone,
  Paperclip,
  PanelRightOpen,
  PenTool,
  Plus,
  WifiOff,
  X,
} from "lucide-react";
import { Markdown } from "./markdown";
import { newChatId, refreshRecents, SHORTCUTS } from "./shell";

/**
 * Chat with the Chief: conversations (recents in the sidebar), attachments, and a preview panel
 * for long answers, files and app pages. Works offline: history is cached on this device and
 * messages typed offline wait in an outbox, sent once each (by client id) on reconnect.
 */

interface Button {
  text: string;
  callback_data: string;
}
interface Attachment {
  id: string;
  name: string;
  mime: string;
  size: number;
}
interface Msg {
  id: string;
  conversation_id: string;
  role: "owner" | "chief";
  channel: "app" | "telegram";
  text: string;
  buttons: Button[][] | null;
  attachments: Attachment[] | null;
  client_id: string | null;
  created_at: string;
}
interface Outgoing {
  clientId: string;
  conversationId: string;
  text: string;
  attachments: Attachment[];
  at: string;
}
type Preview =
  | { kind: "text"; title: string; text: string }
  | { kind: "page"; title: string; url: string }
  | { kind: "file"; title: string; url: string; mime: string };

const OUTBOX_KEY = "boma-chat-outbox-v2";
const DECIDED_KEY = "boma-chat-decided-v1";
const historyKey = (c: string) => `boma-chat-v2:${c}`;
const isPasscode = (t: string) => /^\/unlock\b/i.test(t.trim());
const LONG = 1200;

const load = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const save = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: the chat still works without the offline cache */
  }
};
const clientId = () => crypto.randomUUID().replace(/-/g, "");
const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });
const kb = (n: number) =>
  n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.ceil(n / 1000)} KB`;

function AttachmentChip({
  a,
  onOpen,
  onRemove,
}: {
  a: Attachment;
  onOpen?: () => void;
  onRemove?: () => void;
}) {
  const image = a.mime.startsWith("image/");
  return (
    <div className="group relative flex max-w-[220px] items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-1.5 pr-3">
      <button onClick={onOpen} className="flex min-w-0 items-center gap-2 text-left" type="button">
        {image ? (
          <img src={`/api/uploads/${a.id}`} alt="" className="size-9 rounded-lg object-cover" />
        ) : (
          <span className="grid size-9 place-items-center rounded-lg bg-white/5">
            <FileText className="size-4 text-mist-300" />
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate text-xs font-medium">{a.name}</span>
          <span className="block text-[11px] text-mist-400">{kb(a.size)}</span>
        </span>
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-ink-800 text-mist-300 ring-1 ring-white/10 hover:text-white"
          aria-label={`Remove ${a.name}`}
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}

function PreviewPanel({ p, onClose }: { p: Preview; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-ink-950 lg:static lg:z-auto lg:w-[min(560px,45vw)] lg:shrink-0 lg:border-l lg:border-white/5">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-white/5 px-3">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.title}</span>
        {p.kind === "text" && (
          <button
            className="btn-ghost p-2"
            title="Copy"
            onClick={() => {
              navigator.clipboard.writeText(p.text).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              });
            }}
          >
            {copied ? <Check className="size-4 text-sage" /> : <Copy className="size-4" />}
          </button>
        )}
        {p.kind !== "text" && (
          <a
            href={p.url}
            target="_blank"
            rel="noreferrer"
            className="btn-ghost p-2"
            title="Open in new tab"
          >
            <ExternalLink className="size-4" />
          </a>
        )}
        <button onClick={onClose} className="btn-ghost p-2" aria-label="Close preview">
          <X className="size-4" />
        </button>
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        {p.kind === "text" && (
          <div className="px-6 py-5 text-[15px] leading-relaxed text-mist-100">
            <Markdown text={p.text} />
          </div>
        )}
        {p.kind === "page" && (
          <iframe
            src={`${p.url}${p.url.includes("?") ? "&" : "?"}embed=1`}
            title={p.title}
            className="h-full w-full bg-transparent"
          />
        )}
        {p.kind === "file" &&
          (p.mime.startsWith("image/") ? (
            <img src={p.url} alt={p.title} className="mx-auto max-h-full p-4" />
          ) : (
            <iframe src={p.url} title={p.title} className="h-full w-full bg-white" />
          ))}
      </div>
    </div>
  );
}

export function Chat({ simulation }: { simulation: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [conversationId, setConversationId] = useState<string>("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [outbox, setOutbox] = useState<Outgoing[]>([]);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(0);
  const [online, setOnline] = useState(true);
  const [thinking, setThinking] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [note, setNote] = useState<string>();
  const [plusOpen, setPlusOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<Preview>();
  const [decided, setDecided] = useState<Set<string>>(new Set());
  useEffect(() => setDecided(new Set(load<string[]>(DECIDED_KEY, []))), []);
  const endRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastId = useRef<string | undefined>(undefined);
  const convRef = useRef("");
  const flushing = useRef(false);

  // Which conversation: ?c=<id>, or a fresh one (created on the server with the first message).
  useEffect(() => {
    const c = params.get("c");
    const id = c && /^[0-9a-f-]{36}$/i.test(c) ? c : newChatId();
    if (!c) router.replace(`/?c=${id}`, { scroll: false });
    convRef.current = id;
    setConversationId(id);
    const cached = load<Msg[]>(historyKey(id), []);
    setMessages(cached);
    lastId.current = cached.at(-1)?.id;
    setOutbox(load<Outgoing[]>(OUTBOX_KEY, []));
    setThinking(false);
    setPreview(undefined);
    setNote(undefined);
    setOnline(navigator.onLine);
    boxRef.current?.focus();
  }, [params, router]);

  const merge = useCallback((cid: string, incoming: Msg[]) => {
    if (!incoming.length || cid !== convRef.current) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const next = [...prev, ...incoming.filter((m) => !seen.has(m.id))].slice(-300);
      save(historyKey(cid), next);
      lastId.current = next.at(-1)?.id;
      return next;
    });
  }, []);

  const poll = useCallback(async () => {
    const cid = convRef.current;
    if (!cid) return;
    try {
      const q = `c=${cid}${lastId.current ? `&after=${lastId.current}` : ""}`;
      const res = await fetch(`/api/chat?${q}`, { cache: "no-store" });
      if (res.status === 401) return setSignedOut(true);
      if (!res.ok) return;
      const { messages: m } = (await res.json()) as { messages: Msg[] };
      setOnline(true);
      merge(cid, m);
      if (m.some((x) => x.role === "chief")) setThinking(false);
    } catch {
      setOnline(false);
    }
  }, [merge]);

  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      for (const item of load<Outgoing[]>(OUTBOX_KEY, [])) {
        if (item.conversationId === convRef.current) setThinking(true);
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(item),
        });
        if (res.status === 401) {
          setSignedOut(true);
          break;
        }
        if (!res.ok && res.status !== 400) {
          const { error } = (await res.json().catch(() => ({}))) as { error?: string };
          setNote(error ?? "Couldn't reach the Chief. I'll retry.");
          break;
        }
        const rest = load<Outgoing[]>(OUTBOX_KEY, []).filter((o) => o.clientId !== item.clientId);
        save(OUTBOX_KEY, rest);
        setOutbox(rest);
        refreshRecents();
        await poll();
      }
    } catch {
      setOnline(false);
    } finally {
      flushing.current = false;
    }
  }, [poll]);

  // Stay in step: poll briskly while open, slowly in the background; flush on reconnect.
  useEffect(() => {
    if (!conversationId) return;
    poll().then(flush);
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      t = setTimeout(
        async () => {
          await poll();
          if (load<Outgoing[]>(OUTBOX_KEY, []).length) await flush();
          loop();
        },
        document.hidden ? 15_000 : thinking ? 2_000 : 4_000,
      );
    };
    loop();
    const up = () => {
      setOnline(true);
      flush();
    };
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      clearTimeout(t);
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, [conversationId, poll, flush, thinking]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, outbox.length, thinking]);

  const upload = async (list: FileList | File[]) => {
    if (!navigator.onLine) return setNote("Attachments need a connection.");
    for (const f of Array.from(list).slice(0, 10)) {
      if (f.size > 10 * 1024 * 1024) {
        setNote(`${f.name} is over 10 MB.`);
        continue;
      }
      setUploading((n) => n + 1);
      try {
        const form = new FormData();
        form.set("file", f);
        form.set("purpose", "chat");
        const res = await fetch("/api/uploads", { method: "POST", body: form });
        const body = (await res.json()) as Attachment & { error?: string };
        if (!res.ok) setNote(body.error ?? `Couldn't attach ${f.name}.`);
        else
          setFiles((prev) => [
            ...prev,
            { id: body.id, name: body.name, mime: body.mime, size: body.size },
          ]);
      } catch {
        setNote(`Couldn't attach ${f.name}.`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const send = async () => {
    const value = text.trim();
    if ((!value && !files.length) || uploading) return;
    setNote(undefined);
    const cid = convRef.current;
    if (isPasscode(value)) {
      // Passcodes never wait in the outbox or the device cache.
      if (!navigator.onLine) return setNote("Unlocking needs a connection.");
      setText("");
      setThinking(true);
      await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: value, clientId: clientId(), conversationId: cid }),
      }).catch(() => setNote("Couldn't send. Try again."));
      refreshRecents();
      await poll();
      return;
    }
    const item: Outgoing = {
      clientId: clientId(),
      conversationId: cid,
      text: value,
      attachments: files,
      at: new Date().toISOString(),
    };
    const next = [...load<Outgoing[]>(OUTBOX_KEY, []), item];
    save(OUTBOX_KEY, next);
    setOutbox(next);
    setText("");
    setFiles([]);
    if (boxRef.current) boxRef.current.style.height = "";
    if (navigator.onLine) flush();
  };

  const press = async (messageId: string, b: Button) => {
    if (decided.has(messageId)) return;
    setDecided((d) => {
      const next = new Set(d).add(messageId);
      save(DECIDED_KEY, [...next].slice(-500));
      return next;
    });
    setThinking(true);
    try {
      const res = await fetch("/api/chat/button", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ data: b.callback_data, conversationId: convRef.current }),
      });
      if (!res.ok) throw new Error("failed");
    } catch {
      setDecided((d) => {
        const next = new Set(d);
        next.delete(messageId);
        return next;
      });
      setNote("You're offline. Try again when you're connected.");
    }
    await poll();
    setThinking(false);
  };

  const openLink = (href: string, label: string) =>
    setPreview({ kind: "page", title: label, url: href });
  const openFile = (a: Attachment) =>
    setPreview({ kind: "file", title: a.name, url: `/api/uploads/${a.id}`, mime: a.mime });
  const insert = (prefix: string) => {
    setPlusOpen(false);
    setText((t) => (t ? t : prefix));
    boxRef.current?.focus();
  };

  const sentIds = new Set(messages.map((m) => m.client_id).filter(Boolean));
  const waiting = outbox.filter(
    (o) => o.conversationId === conversationId && !sentIds.has(o.clientId),
  );
  const empty = messages.length === 0 && waiting.length === 0;

  const composer = (
    <div className="w-full">
      {(!online || signedOut || note || (simulation && empty)) && (
        <div className="mb-2 flex flex-wrap items-center gap-2 px-1 text-xs">
          {!online && (
            <span className="chip bg-white/5 text-mist-300">
              <WifiOff className="size-3" /> Offline: messages send when you reconnect
            </span>
          )}
          {signedOut && (
            <Link href="/login" className="chip bg-coral/15 text-coral">
              Signed out: sign in again
            </Link>
          )}
          {note && <span className="text-mist-400">{note}</span>}
          {simulation && empty && (
            <span className="chip bg-iris/10 text-iris">🧪 Simulation mode</span>
          )}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length) upload(e.dataTransfer.files);
        }}
        className={`relative rounded-[26px] border bg-ink-900/90 p-2 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] transition ${dragging ? "border-amber/60" : "border-white/10 focus-within:border-white/20"}`}
      >
        {(files.length > 0 || uploading > 0) && (
          <div className="flex flex-wrap gap-2 px-2 pt-1 pb-2">
            {files.map((a) => (
              <AttachmentChip
                key={a.id}
                a={a}
                onOpen={() => openFile(a)}
                onRemove={() => setFiles((f) => f.filter((x) => x.id !== a.id))}
              />
            ))}
            {uploading > 0 && <span className="self-center text-xs text-mist-400">Uploading…</span>}
          </div>
        )}
        <textarea
          ref={boxRef}
          value={text}
          rows={1}
          onChange={(e) => {
            setText(e.target.value);
            e.target.style.height = "";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 240)}px`;
          }}
          onPaste={(e) => {
            const pasted = Array.from(e.clipboardData.files);
            if (pasted.length) {
              e.preventDefault();
              upload(pasted);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={empty ? "Ask the Chief anything…" : "Reply to the Chief…"}
          className="max-h-[240px] w-full resize-none bg-transparent px-3 pt-2 pb-1 text-[15px] outline-none placeholder:text-mist-400/60"
          aria-label="Message"
        />
        <div className="flex items-center gap-1 px-1">
          <div className="relative">
            <button
              type="button"
              onClick={() => setPlusOpen((o) => !o)}
              className="grid size-9 place-items-center rounded-full text-mist-300 hover:bg-white/[0.06] hover:text-white"
              aria-label="Add"
            >
              <Plus className={`size-5 transition ${plusOpen ? "rotate-45" : ""}`} />
            </button>
            {plusOpen && (
              <div className="absolute bottom-11 left-0 z-20 w-60 rounded-2xl border border-white/10 bg-ink-900 p-1.5 text-sm shadow-2xl">
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-white/5"
                  onClick={() => {
                    setPlusOpen(false);
                    fileRef.current?.click();
                  }}
                >
                  <Paperclip className="size-4" /> Add photos and files
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-white/5"
                  onClick={() => insert("/skill ")}
                >
                  <Brain className="size-4" /> Use a skill
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-white/5"
                  onClick={() => insert("Write a Facebook post for ")}
                >
                  <Megaphone className="size-4" /> Draft a post
                </button>
                <Link
                  href="/studio/new"
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-white/5"
                >
                  <PenTool className="size-4" /> Open the design studio
                </Link>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              multiple
              hidden
              accept="image/png,image/jpeg,image/webp,application/pdf,.txt,.md,.csv,.json"
              onChange={(e) => {
                if (e.target.files) upload(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
          <span className="ml-auto" />
          <button
            type="submit"
            disabled={(!text.trim() && !files.length) || uploading > 0}
            className="grid size-9 shrink-0 place-items-center rounded-full bg-mist-100 text-ink-950 transition hover:bg-white disabled:opacity-25"
            aria-label="Send"
          >
            <ArrowUp className="size-[18px]" />
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        {empty ? (
          <div className="flex flex-1 flex-col items-center justify-center px-4 pb-[10vh]">
            <h1 className="mb-6 text-center font-display text-3xl font-bold tracking-tight sm:text-4xl">
              What can the team do for you?
            </h1>
            <div className="w-full max-w-3xl">{composer}</div>
            <div className="mt-5 flex max-w-3xl flex-wrap justify-center gap-2">
              {SHORTCUTS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-1.5 rounded-full border border-white/10 px-3.5 py-1.5 text-[13px] text-mist-300 transition hover:border-white/20 hover:bg-white/[0.03] hover:text-white"
                >
                  <Icon className="size-4" /> {label}
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
              <ol className="mx-auto max-w-3xl space-y-6 px-4 py-6">
                {messages.map((m) =>
                  m.role === "owner" ? (
                    <li key={m.id} className="flex flex-col items-end gap-1.5">
                      {m.attachments && m.attachments.length > 0 && (
                        <div className="flex flex-wrap justify-end gap-2">
                          {m.attachments.map((a) => (
                            <AttachmentChip key={a.id} a={a} onOpen={() => openFile(a)} />
                          ))}
                        </div>
                      )}
                      <div className="max-w-[85%] rounded-3xl bg-white/[0.08] px-4 py-2.5 text-[15px] whitespace-pre-wrap">
                        {m.text}
                      </div>
                      <div className="text-[11px] text-mist-400/70">
                        {time(m.created_at)}
                        {m.channel === "telegram" ? " · Telegram" : ""}
                      </div>
                    </li>
                  ) : (
                    <li key={m.id} className="group">
                      <div className="text-[15px] leading-relaxed text-mist-100">
                        {m.text.length > LONG ? (
                          <>
                            <div className="relative max-h-72 overflow-hidden">
                              <Markdown text={m.text.slice(0, LONG + 400)} onLink={openLink} />
                              <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-ink-950 to-transparent" />
                            </div>
                            <button
                              onClick={() =>
                                setPreview({
                                  kind: "text",
                                  title: m.text.split("\n")[0]!.slice(0, 80),
                                  text: m.text,
                                })
                              }
                              className="mt-2 flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 text-left hover:border-white/20"
                            >
                              <FileText className="size-5 text-amber" />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium">
                                  {m.text.split("\n")[0]!.slice(0, 80)}
                                </span>
                                <span className="text-xs text-mist-400">
                                  Open the full answer in preview
                                </span>
                              </span>
                              <PanelRightOpen className="size-4 text-mist-400" />
                            </button>
                          </>
                        ) : (
                          <Markdown text={m.text} onLink={openLink} />
                        )}
                      </div>
                      {m.buttons && m.buttons.length > 0 && !decided.has(m.id) && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {m.buttons.flat().map((b) => (
                            <button
                              key={b.callback_data}
                              onClick={() => press(m.id, b)}
                              className="btn-outline rounded-full px-3.5 py-1.5 text-xs"
                            >
                              {b.text}
                            </button>
                          ))}
                        </div>
                      )}
                      <div className="mt-1.5 flex items-center gap-1 text-[11px] text-mist-400/70 opacity-0 transition group-hover:opacity-100">
                        <span>{time(m.created_at)}</span>
                        <button
                          className="rounded p-1 hover:bg-white/5 hover:text-white"
                          title="Copy"
                          onClick={() => navigator.clipboard.writeText(m.text)}
                        >
                          <Copy className="size-3.5" />
                        </button>
                        <button
                          className="rounded p-1 hover:bg-white/5 hover:text-white"
                          title="Open in preview"
                          onClick={() => setPreview({ kind: "text", title: "Chief", text: m.text })}
                        >
                          <PanelRightOpen className="size-3.5" />
                        </button>
                      </div>
                    </li>
                  ),
                )}
                {waiting.map((o) => (
                  <li key={o.clientId} className="flex flex-col items-end gap-1.5">
                    {o.attachments.length > 0 && (
                      <div className="flex flex-wrap justify-end gap-2">
                        {o.attachments.map((a) => (
                          <AttachmentChip key={a.id} a={a} />
                        ))}
                      </div>
                    )}
                    {o.text && (
                      <div className="max-w-[85%] rounded-3xl bg-white/[0.05] px-4 py-2.5 text-[15px] whitespace-pre-wrap text-mist-300">
                        {o.text}
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-[11px] text-mist-400/70">
                      <Clock className="size-3" /> {online ? "Sending…" : "Waiting for connection"}
                    </div>
                  </li>
                ))}
                {thinking && waiting.length === 0 && (
                  <li className="flex items-center gap-1.5 py-1" aria-label="The Chief is working">
                    <span className="size-2 animate-pulse rounded-full bg-mist-400" />
                    <span className="size-2 animate-pulse rounded-full bg-mist-400 [animation-delay:150ms]" />
                    <span className="size-2 animate-pulse rounded-full bg-mist-400 [animation-delay:300ms]" />
                  </li>
                )}
              </ol>
              <div ref={endRef} />
            </div>
            <div className="mx-auto w-full max-w-3xl px-4 pb-4">{composer}</div>
          </>
        )}
      </div>
      {preview && <PreviewPanel p={preview} onClose={() => setPreview(undefined)} />}
    </div>
  );
}
