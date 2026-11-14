"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CheckCircle2,
  Clapperboard,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Palette,
  PenTool,
  Rocket,
  type LucideIcon,
} from "lucide-react";
import { logoutAction } from "@/app/actions";

const NAV: { href: string; label: string; icon: LucideIcon; soon?: boolean }[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/studio", label: "Design studio", icon: PenTool },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/brands", label: "Brand kits", icon: Palette },
  { href: "/approvals", label: "Approval centre", icon: CheckCircle2 },
];

const SOON: { label: string; icon: LucideIcon }[] = [
  { label: "Ads Manager", icon: Rocket },
  { label: "Film Studio", icon: Clapperboard },
];

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
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-white/5 bg-ink-950/70 px-4 py-6 backdrop-blur-xl lg:flex">
        <Link href="/" className="mb-9 flex items-center gap-3 px-2">
          <div className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-amber to-coral font-display text-lg font-extrabold text-ink-950 shadow-lg shadow-amber/20">
            B
          </div>
          <div className="leading-tight">
            <div className="font-display text-[15px] font-bold">Boma Studio</div>
            <div className="text-[11px] tracking-wider text-mist-400 uppercase">
              Creative · Workforce
            </div>
          </div>
        </Link>
        <nav className="space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                active(href)
                  ? "bg-white/[0.07] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                  : "text-mist-300 hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              <Icon
                className={`size-[18px] ${active(href) ? "text-amber" : "text-mist-400 group-hover:text-mist-200"}`}
              />
              <span className="flex-1">{label}</span>
              {href === "/approvals" && pending > 0 && (
                <span className="chip bg-amber/15 px-2 py-0.5 text-amber">{pending}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="mt-8 px-3 text-[11px] font-semibold tracking-wider text-mist-400/70 uppercase">
          Coming next
        </div>
        <div className="mt-2 space-y-1">
          {SOON.map(({ label, icon: Icon }) => (
            <div
              key={label}
              className="flex cursor-default items-center gap-3 rounded-xl px-3 py-2 text-sm text-mist-400/60"
            >
              <Icon className="size-[18px]" />
              {label}
            </div>
          ))}
        </div>
        <div className="mt-auto space-y-3">
          {simulation && (
            <div className="rounded-xl border border-iris/25 bg-iris/10 p-3 text-xs leading-relaxed text-iris">
              <b className="block">No AI keys yet</b>
              Copy requests run in labelled simulation until keys are added.
            </div>
          )}
          <form action={logoutAction}>
            <button className="btn-ghost w-full justify-start px-3 text-mist-400">
              <LogOut className="size-4" /> Sign out
            </button>
          </form>
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
