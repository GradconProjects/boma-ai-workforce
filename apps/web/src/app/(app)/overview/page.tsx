import Link from "next/link";
import { ArrowRight, CheckCircle2, Megaphone, PenTool, Sparkles, Wallet } from "lucide-react";
import { budgetStatus, pendingApprovals } from "@boma/core";
import { listBrands, listCampaigns, listDesigns } from "@boma/studio";
import { DesignView } from "@/components/design-view";
import { db, policy } from "@/lib/server";

export default async function Dashboard() {
  const [designs, campaigns, approvals, brands, budget] = await Promise.all([
    listDesigns(db(), { limit: 8 }),
    listCampaigns(db()),
    pendingApprovals(db()),
    listBrands(db()),
    budgetStatus(db(), policy()),
  ]);
  const brandName = new Map(brands.map((b) => [b.id, b.brand.name]));
  const pct = Math.min(100, (budget.spentAud / budget.hardStopAud) * 100);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
      {/* Hero */}
      <section className="rise relative overflow-hidden rounded-[28px] border border-white/[0.06]">
        <div className="absolute inset-0 grid grid-cols-3 gap-0 opacity-70">
          <img src="/templates/property.webp" alt="" className="h-full w-full object-cover" />
          <img src="/templates/abstract-story.webp" alt="" className="h-full w-full object-cover" />
          <img src="/templates/food.webp" alt="" className="h-full w-full object-cover" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/90 to-ink-950/30" />
        <div className="relative px-8 py-12 md:px-12 md:py-16">
          <span className="chip border border-amber/30 bg-amber/10 text-amber">
            <Sparkles className="size-3" /> Creative Studio
          </span>
          <h1 className="mt-5 max-w-2xl font-display text-4xl leading-[1.05] font-extrabold tracking-tight md:text-[54px]">
            One brief.
            <br />
            <span className="bg-gradient-to-r from-amber via-coral to-iris bg-clip-text text-transparent">
              Every format, on brand.
            </span>
          </h1>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-mist-300">
            Design it yourself, or hand the brief to your Chief of Staff. Claude writes, OpenAI
            checks, and nothing goes anywhere until you approve it.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/campaigns/new" className="btn-primary">
              <Megaphone className="size-4" /> Start a campaign
            </Link>
            <Link href="/studio/new" className="btn-outline">
              <PenTool className="size-4" /> New design
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={PenTool}
          label="Designs"
          value={designs.length >= 8 ? "8+" : String(designs.length)}
          href="/studio"
        />
        <Stat
          icon={Megaphone}
          label="Active campaigns"
          value={String(campaigns.length)}
          href="/campaigns"
        />
        <Stat
          icon={CheckCircle2}
          label="Waiting for you"
          value={String(approvals.length)}
          href="/approvals"
          accent={approvals.length > 0}
        />
        <Link
          href="/approvals"
          className="panel rise rounded-2xl p-5 transition hover:border-white/10"
        >
          <div className="flex items-center justify-between text-xs font-semibold tracking-wide text-mist-400 uppercase">
            AI spend · {budget.month}
            <Wallet className="size-4 text-mist-400" />
          </div>
          <div className="mt-3 font-display text-3xl font-bold">
            A${budget.spentAud.toFixed(2)}
            <span className="ml-1 text-base font-medium text-mist-400">
              / {budget.hardStopAud.toFixed(0)}
            </span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
            <div
              className={`h-full rounded-full ${budget.warn ? "bg-coral" : "bg-gradient-to-r from-sage to-amber"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </Link>
      </section>

      {/* Recent designs */}
      <section className="mt-12">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h2 className="font-display text-xl font-bold">Recent designs</h2>
            <p className="text-sm text-mist-400">Pick up where you left off.</p>
          </div>
          <Link href="/studio" className="btn-ghost text-sm">
            All designs <ArrowRight className="size-4" />
          </Link>
        </div>
        {designs.length ? (
          <div className="grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-4">
            {designs.map((d) => (
              <Link key={d.id} href={`/studio/${d.id}`} className="group rise">
                <div className="grid aspect-square place-items-center overflow-hidden rounded-2xl border border-white/[0.06] bg-ink-900 p-4 transition group-hover:border-amber/30 group-hover:shadow-[0_20px_50px_-20px_rgba(244,184,96,0.35)]">
                  <DesignView
                    design={d.doc}
                    width={
                      d.doc.width >= d.doc.height
                        ? 230
                        : Math.round((230 * d.doc.width) / d.doc.height)
                    }
                    className="rounded-md shadow-2xl shadow-black/50"
                  />
                </div>
                <div className="mt-3 truncate text-sm font-semibold">{d.title}</div>
                <div className="text-xs text-mist-400">{brandName.get(d.brand_id)}</div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState />
        )}
      </section>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  href,
  accent,
}: {
  icon: typeof PenTool;
  label: string;
  value: string;
  href: string;
  accent?: boolean;
}) {
  return (
    <Link href={href} className="panel rise rounded-2xl p-5 transition hover:border-white/10">
      <div className="flex items-center justify-between text-xs font-semibold tracking-wide text-mist-400 uppercase">
        {label}
        <Icon className={`size-4 ${accent ? "text-amber" : "text-mist-400"}`} />
      </div>
      <div className={`mt-3 font-display text-3xl font-bold ${accent ? "text-amber" : ""}`}>
        {value}
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="panel grid place-items-center rounded-3xl px-6 py-16 text-center">
      <PenTool className="size-8 text-amber" />
      <h3 className="mt-4 font-display text-lg font-bold">No designs yet</h3>
      <p className="mt-1 max-w-sm text-sm text-mist-400">
        Start with a campaign to get every format at once, or open a single design.
      </p>
      <Link href="/campaigns/new" className="btn-primary mt-6">
        Start a campaign
      </Link>
    </div>
  );
}
