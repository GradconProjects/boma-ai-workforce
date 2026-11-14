import Link from "next/link";
import { Megaphone, Plus } from "lucide-react";
import { listCampaigns } from "@boma/studio";
import { db } from "@/lib/server";

const STATUS: Record<string, string> = {
  draft: "bg-white/5 text-mist-300",
  in_production: "bg-iris/15 text-iris",
  ready: "bg-sage/15 text-sage",
};

export default async function Campaigns() {
  const campaigns = await listCampaigns(db());
  return (
    <div className="mx-auto max-w-6xl px-6 py-8 lg:px-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-semibold tracking-[0.2em] text-amber uppercase">
            Campaigns
          </div>
          <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight">
            One brief, every deliverable
          </h1>
        </div>
        <Link href="/campaigns/new" className="btn-primary">
          <Plus className="size-4" /> New campaign
        </Link>
      </header>
      {campaigns.length === 0 ? (
        <div className="panel grid place-items-center rounded-3xl px-6 py-16 text-center">
          <Megaphone className="size-8 text-amber" />
          <h3 className="mt-4 font-display text-lg font-bold">No campaigns yet</h3>
          <p className="mt-1 max-w-sm text-sm text-mist-400">
            Write one brief and get a feed post, square post, story, link ad and flyer, all on brand
            and ready for the Chief&apos;s copy.
          </p>
          <Link href="/campaigns/new" className="btn-primary mt-6">
            Create your first campaign
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {campaigns.map((c) => (
            <Link
              key={c.id}
              href={`/campaigns/${c.id}`}
              className="panel rise group rounded-2xl p-6 transition hover:border-white/15"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-mist-400">{c.brand_name}</div>
                  <h2 className="mt-1 truncate font-display text-lg font-bold group-hover:text-amber">
                    {c.name}
                  </h2>
                </div>
                <span className={`chip ${STATUS[c.status] ?? STATUS.draft}`}>
                  {c.status.replace("_", " ")}
                </span>
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-mist-300">{c.objective}</p>
              <div className="mt-5 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sage to-amber"
                    style={{ width: `${c.items ? (c.approved / c.items) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-xs text-mist-400">
                  {c.approved}/{c.items} approved
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
