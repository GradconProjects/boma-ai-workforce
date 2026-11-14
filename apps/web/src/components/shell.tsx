"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  Trash2,
  Bot,
  Brain,
  CheckCircle2,
  ChevronDown,
  Clapperboard,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  MoreHorizontal,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  PenTool,
  Pin,
  Rocket,
  Search,
  Settings,
  Wallet,
  SquarePen,
  X,
  type LucideIcon,
} from "lucide-react";
import { logoutAction } from "@/app/actions";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  hint: string;
}

/** Everything other than the chat, grouped and folded away in the sidebar. */
export const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Create",
    items: [
      { href: "/studio", label: "Design studio", icon: PenTool, hint: "Posts, stories, flyers" },
      { href: "/campaigns", label: "Campaigns", icon: Megaphone, hint: "One brief, every format" },
      { href: "/brands", label: "Brand kits", icon: Palette, hint: "Colours, fonts, voice" },
    ],
  },
  {
    title: "Workforce",
    items: [
      { href: "/bots", label: "Bots", icon: Bot, hint: "Who's connected and working" },
      { href: "/skills", label: "Skills", icon: Brain, hint: "Expert methods on call" },
      {
        href: "/approvals",
        label: "Approvals",
        icon: CheckCircle2,
        hint: "Nothing goes out without you",
      },
    ],
  },
];
export const SHORTCUTS = NAV_GROUPS.flatMap((g) => g.items);

const SOON: { label: string; icon: LucideIcon }[] = [
  { label: "Ads Manager", icon: Rocket },
  { label: "Film Studio", icon: Clapperboard },
];

export interface Recent {
  id: string;
  title: string;
  channel: "app" | "telegram";
  pinned: boolean;
  updated_at: string;
}

const RECENTS_KEY = "boma-recents-v1";
const COLLAPSE_KEY = "boma-sidebar-collapsed";
const GROUPS_KEY = "boma-sidebar-groups-open";

const store = {
  get<T>(k: string, d: T): T {
    try {
      const v = localStorage.getItem(k);
      return v ? (JSON.parse(v) as T) : d;
    } catch {
      return d;
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* ignore */
    }
  },
};

/** Ask the sidebar to refresh its recents (fired by the chat after sending). */
export const refreshRecents = () => window.dispatchEvent(new Event("boma:recents"));

export function newChatId(): string {
  return crypto.randomUUID();
}

function useRecents() {
  const [recents, setRecents] = useState<Recent[]>([]);
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/conversations", { cache: "no-store" });
      if (!res.ok) return;
      const { conversations } = (await res.json()) as { conversations: Recent[] };
      setRecents(conversations);
      store.set(RECENTS_KEY, conversations);
    } catch {
      /* offline: keep the cached list */
    }
  }, []);
  useEffect(() => {
    setRecents(store.get<Recent[]>(RECENTS_KEY, []));
    load();
    const t = setInterval(load, 30_000);
    window.addEventListener("boma:recents", load);
    window.addEventListener("online", load);
    return () => {
      clearInterval(t);
      window.removeEventListener("boma:recents", load);
      window.removeEventListener("online", load);
    };
  }, [load]);
  return { recents, setRecents, reload: load };
}

function RecentItem({ r, active, onChange }: { r: Recent; active: boolean; onChange: () => void }) {
  const [menu, setMenu] = useState(false);
  const patch = async (body: Record<string, unknown>) => {
    setMenu(false);
    await fetch("/api/chat/conversations", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: r.id, ...body }),
    }).catch(() => undefined);
    onChange();
  };
  return (
    <div className="group relative">
      <Link
        href={`/?c=${r.id}`}
        className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] ${active ? "bg-white/[0.08] text-white" : "text-mist-300 hover:bg-white/[0.04] hover:text-white"}`}
      >
        {r.pinned && <Pin className="size-3 shrink-0 text-mist-400" />}
        <span className="truncate">{r.title}</span>
      </Link>
      <button
        onClick={() => setMenu((m) => !m)}
        className={`absolute top-1/2 right-1 -translate-y-1/2 rounded-md p-1 text-mist-400 hover:bg-white/10 hover:text-white ${menu ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus:opacity-100"}`}
        aria-label="Conversation options"
      >
        <MoreHorizontal className="size-3.5" />
      </button>
      {menu && (
        <div className="absolute top-8 right-0 z-20 w-40 rounded-xl border border-white/10 bg-ink-900 p-1 text-sm shadow-xl">
          <button
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-white/5"
            onClick={() => {
              const title = prompt("Rename conversation", r.title);
              if (title?.trim()) patch({ title });
              else setMenu(false);
            }}
          >
            <SquarePen className="size-3.5" /> Rename
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 hover:bg-white/5"
            onClick={() => patch({ pinned: !r.pinned })}
          >
            <Pin className="size-3.5" /> {r.pinned ? "Unpin" : "Pin"}
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-coral hover:bg-white/5"
            onClick={() => patch({ archived: true })}
          >
            <Archive className="size-3.5" /> Archive
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-coral hover:bg-white/5"
            onClick={async () => {
              if (!confirm(`Delete "${r.title}" permanently?`)) return setMenu(false);
              setMenu(false);
              await fetch("/api/chat/conversations", {
                method: "DELETE",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ id: r.id }),
              }).catch(() => undefined);
              try {
                localStorage.removeItem(`boma-chat-v2:${r.id}`);
              } catch {
                /* ignore */
              }
              onChange();
            }}
          >
            <Trash2 className="size-3.5" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

function Sidebar({
  pending,
  simulation,
  collapsed,
  onCollapse,
  onClose,
}: {
  pending: number;
  simulation: boolean;
  collapsed: boolean;
  onCollapse?: () => void;
  onClose?: () => void;
}) {
  const path = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const { recents, reload } = useRecents();
  const [query, setQuery] = useState("");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [settings, setSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  useEffect(() => setOpenGroups(store.get(GROUPS_KEY, { Create: true, Workforce: true })), []);
  useEffect(() => {
    if (!settings) return;
    const close = (e: MouseEvent) =>
      settingsRef.current && !settingsRef.current.contains(e.target as Node) && setSettings(false);
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [settings]);

  const toggleGroup = (t: string) =>
    setOpenGroups((g) => {
      const next = { ...g, [t]: !g[t] };
      store.set(GROUPS_KEY, next);
      return next;
    });
  const activeChat = path === "/" ? params.get("c") : null;
  const shown = query
    ? recents.filter((r) => r.title.toLowerCase().includes(query.toLowerCase()))
    : recents;

  if (collapsed) {
    return (
      <div className="flex h-full flex-col items-center gap-1 py-3">
        <button onClick={onCollapse} className="btn-ghost p-2" aria-label="Open sidebar">
          <PanelLeftOpen className="size-5" />
        </button>
        <button
          onClick={() => router.push(`/?c=${newChatId()}`)}
          className="btn-ghost p-2"
          aria-label="New chat"
          title="New chat"
        >
          <SquarePen className="size-5" />
        </button>
        {SHORTCUTS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            title={label}
            className={`relative rounded-xl p-2 ${path.startsWith(href) ? "bg-white/[0.08] text-white" : "text-mist-400 hover:bg-white/5 hover:text-white"}`}
          >
            <Icon className="size-5" />
            {href === "/approvals" && pending > 0 && (
              <span className="absolute top-1 right-1 size-2 rounded-full bg-amber" />
            )}
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col px-3 py-3">
      <div className="mb-3 flex items-center justify-between px-1">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="grid size-8 place-items-center rounded-xl bg-gradient-to-br from-amber to-coral font-display text-sm font-extrabold text-ink-950">
            B
          </div>
          <span className="font-display text-[15px] font-bold">Boma Bot Pro</span>
        </Link>
        {onCollapse && (
          <button onClick={onCollapse} className="btn-ghost p-2" aria-label="Collapse sidebar">
            <PanelLeftClose className="size-[18px]" />
          </button>
        )}
        {onClose && (
          <button onClick={onClose} className="btn-ghost p-2" aria-label="Close">
            <X className="size-5" />
          </button>
        )}
      </div>

      <button
        onClick={() => router.push(`/?c=${newChatId()}`)}
        className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium text-mist-100 hover:bg-white/[0.05]"
      >
        <SquarePen className="size-[18px]" /> New chat
      </button>
      <label className="mt-1 flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm text-mist-400 focus-within:bg-white/[0.04]">
        <Search className="size-[18px]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search chats"
          className="w-full bg-transparent outline-none placeholder:text-mist-400"
        />
      </label>

      <div className="scroll-thin mt-3 min-h-0 flex-1 overflow-y-auto">
        {NAV_GROUPS.map((g) => (
          <div key={g.title} className="mb-2">
            <button
              onClick={() => toggleGroup(g.title)}
              className="flex w-full items-center justify-between px-2.5 py-1 text-[11px] font-semibold tracking-wider text-mist-400/80 uppercase hover:text-mist-200"
            >
              {g.title}
              <ChevronDown
                className={`size-3.5 transition ${openGroups[g.title] ? "" : "-rotate-90"}`}
              />
            </button>
            {openGroups[g.title] &&
              g.items.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] ${path.startsWith(href) ? "bg-white/[0.08] text-white" : "text-mist-300 hover:bg-white/[0.04] hover:text-white"}`}
                >
                  <Icon className="size-4 text-mist-400" />
                  <span className="flex-1">{label}</span>
                  {href === "/approvals" && pending > 0 && (
                    <span className="rounded-full bg-amber/15 px-1.5 text-[11px] font-semibold text-amber">
                      {pending}
                    </span>
                  )}
                </Link>
              ))}
          </div>
        ))}

        <div className="mt-4 px-2.5 pb-1 text-[11px] font-semibold tracking-wider text-mist-400/80 uppercase">
          Recents
        </div>
        {shown.length === 0 && (
          <p className="px-2.5 text-xs text-mist-400/70">
            {query ? "No chats match." : "Your conversations will appear here."}
          </p>
        )}
        <div className="space-y-px">
          {shown.map((r) => (
            <RecentItem key={r.id} r={r} active={activeChat === r.id} onChange={reload} />
          ))}
        </div>
      </div>

      <div ref={settingsRef} className="relative border-t border-white/5 pt-2">
        {settings && (
          <div className="absolute right-0 bottom-12 left-0 z-20 rounded-2xl border border-white/10 bg-ink-900 p-1.5 text-sm shadow-2xl">
            <Link
              href="/overview"
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-white/5"
            >
              <LayoutDashboard className="size-4" /> Overview
            </Link>
            <Link
              href="/spend"
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 hover:bg-white/5"
            >
              <Wallet className="size-4" /> Spend: AI costs
            </Link>
            {SOON.map(({ label, icon: Icon }) => (
              <div
                key={label}
                className="flex items-center gap-2.5 px-2.5 py-2 text-mist-400/60"
                title="Coming next"
              >
                <Icon className="size-4" /> {label}{" "}
                <span className="ml-auto text-[10px]">soon</span>
              </div>
            ))}
            {simulation && (
              <div className="m-1 rounded-lg border border-iris/25 bg-iris/10 p-2.5 text-xs text-iris">
                Simulation mode: no AI keys yet, answers are labelled samples.
              </div>
            )}
            <form action={logoutAction}>
              <button className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-mist-300 hover:bg-white/5">
                <LogOut className="size-4" /> Sign out
              </button>
            </form>
          </div>
        )}
        <button
          onClick={() => setSettings((s) => !s)}
          className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm text-mist-300 hover:bg-white/[0.05]"
        >
          <span className="grid size-7 place-items-center rounded-full bg-white/10 text-xs font-bold text-white">
            B
          </span>
          <span className="flex-1 text-left">Boma</span>
          <Settings className="size-4 text-mist-400" />
        </button>
      </div>
    </div>
  );
}

function NewChatButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push(`/?c=${newChatId()}`)}
      className="btn-ghost ml-auto p-2"
      aria-label="New chat"
    >
      <SquarePen className="size-5" />
    </button>
  );
}

export function Shell({
  children,
  pending,
  simulation,
}: {
  children: React.ReactNode;
  pending: number;
  simulation: boolean;
}) {
  const path = usePathname();
  const params = useSearchParams();
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => setCollapsed(store.get(COLLAPSE_KEY, false)), []);
  useEffect(() => setDrawer(false), [path, params]);
  const collapse = () =>
    setCollapsed((c) => {
      store.set(COLLAPSE_KEY, !c);
      return !c;
    });

  // Pages shown inside the chat's preview panel, and the full-screen design editor, have no chrome.
  if (params.get("embed") === "1" || /^\/studio\/(?!new$)[^/]+$/.test(path)) return <>{children}</>;

  return (
    <div className="flex h-dvh overflow-hidden">
      <aside
        className={`hidden shrink-0 border-r border-white/5 bg-ink-950/80 backdrop-blur-xl transition-[width] lg:block ${collapsed ? "w-[60px]" : "w-[264px]"}`}
      >
        <Sidebar
          pending={pending}
          simulation={simulation}
          collapsed={collapsed}
          onCollapse={collapse}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 px-3 lg:hidden">
          <button onClick={() => setDrawer(true)} className="btn-ghost p-2" aria-label="Menu">
            <Menu className="size-5" />
          </button>
          <span className="font-display font-bold">Boma Bot Pro</span>
          <NewChatButton />
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>

      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <button
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            aria-label="Close menu"
            onClick={() => setDrawer(false)}
          />
          <aside className="absolute top-0 left-0 h-full w-[min(300px,85vw)] border-r border-white/5 bg-ink-950 shadow-2xl">
            <Sidebar
              pending={pending}
              simulation={simulation}
              collapsed={false}
              onClose={() => setDrawer(false)}
            />
          </aside>
        </div>
      )}
    </div>
  );
}
