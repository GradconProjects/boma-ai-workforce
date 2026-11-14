import Link from "next/link";
import { notFound } from "next/navigation";
import { getApproval } from "@boma/core";
import { getFormat } from "@boma/design-engine";
import { getBrand, getCampaign } from "@boma/studio";
import { DesignView } from "@/components/design-view";
import { db } from "@/lib/server";
import { CampaignActions, ExportAllButton, ItemDecision, LiveRefresh } from "./client";
import { DeleteButton } from "@/components/delete-button";
import { deleteCampaignAction } from "@/app/delete-actions";

const COPY_STATUS: Record<string, { label: string; cls: string }> = {
  none: { label: "No copy yet", cls: "bg-white/5 text-mist-300" },
  drafting: { label: "Chief is writing…", cls: "bg-iris/15 text-iris" },
  awaiting_approval: { label: "Ready for approval", cls: "bg-amber/15 text-amber" },
  needs_decision: { label: "Reviewers disagreed", cls: "bg-coral/15 text-coral" },
  approved: { label: "Approved", cls: "bg-sage/15 text-sage" },
  rejected: { label: "Rejected", cls: "bg-white/5 text-mist-400" },
  failed: { label: "Failed", cls: "bg-coral/15 text-coral" },
};

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getCampaign(db(), id).catch(() => null);
  if (!data) notFound();
  const { campaign, items } = data;
  const { brand } = await getBrand(db(), campaign.brand_id);
  const approvals = await Promise.all(
    items.map((i) =>
      i.approval_id ? getApproval(db(), i.approval_id) : Promise.resolve(undefined),
    ),
  );
  const drafting = items.some((i) => i.copy_status === "drafting");

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
      <LiveRefresh active={drafting} />
      <Link href="/campaigns" className="text-sm text-mist-400 hover:text-white">
        ← Campaigns
      </Link>
      <header className="mt-3 flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.15em] text-amber uppercase">
            <span className="size-2 rounded-full" style={{ background: brand.accent }} />{" "}
            {brand.name}
          </div>
          <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight">
            {campaign.name}
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-mist-300">{campaign.objective}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-mist-400">
            {campaign.audience && (
              <span className="chip bg-white/5">Audience: {campaign.audience}</span>
            )}
            {campaign.cta && <span className="chip bg-white/5">CTA: {campaign.cta}</span>}
            {campaign.channels.map((c) => (
              <span key={c} className="chip bg-white/5 capitalize">
                {c}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <CampaignActions campaignId={campaign.id} />
          <ExportAllButton
            designs={items.map((i) => ({ doc: i.design.doc, title: i.design.title }))}
          />
          <DeleteButton
            action={deleteCampaignAction.bind(null, campaign.id)}
            label="Delete campaign"
            confirmText="Delete this campaign and its designs? This can't be undone."
          />
        </div>
      </header>

      <div className="mt-10 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item, i) => {
          const status = COPY_STATUS[item.copy_status] ?? COPY_STATUS.none!;
          const a = approvals[i];
          const preview = a?.preview as { review?: string } | undefined;
          const d = item.design.doc;
          return (
            <article
              key={item.id}
              className="panel rise flex flex-col overflow-hidden rounded-3xl"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <Link
                href={`/studio/${item.design_id}`}
                className="stage-bg group relative grid aspect-[4/3.4] place-items-center p-5"
              >
                <DesignView
                  design={d}
                  width={d.width / d.height > 1.1 ? 300 : Math.round((240 * d.width) / d.height)}
                  className="rounded-md shadow-2xl shadow-black/60 transition group-hover:scale-[1.02]"
                />
                {item.copy_status === "drafting" && <div className="shimmer absolute inset-0" />}
                <span className="absolute top-3 right-3 rounded-full bg-ink-950/80 px-3 py-1 text-[11px] font-semibold text-white opacity-0 transition group-hover:opacity-100">
                  Open in editor
                </span>
              </Link>
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold">
                      {getFormat(item.design.format_id).title}
                    </div>
                    <div className="text-xs text-mist-400">
                      {getFormat(item.design.format_id).subtitle}
                    </div>
                  </div>
                  <span className={`chip ${status.cls}`}>{status.label}</span>
                </div>
                {item.simulated && (
                  <div className="mt-3 rounded-lg border border-iris/25 bg-iris/10 px-3 py-1.5 text-[11px] text-iris">
                    🧪 Simulated copy: not written or checked by any AI model.
                  </div>
                )}
                {preview?.review && (
                  <div className="mt-3 text-[11px] leading-relaxed text-mist-400">
                    {preview.review}
                  </div>
                )}
                {item.copy_status === "failed" && item.task_error && (
                  <div className="mt-3 text-[11px] text-coral">{item.task_error}</div>
                )}
                <div className="mt-auto pt-4">
                  {a?.status === "pending" ? (
                    <ItemDecision approvalId={a.id} />
                  ) : (
                    <CampaignActions
                      campaignId={campaign.id}
                      itemId={item.id}
                      compact
                      disabled={item.copy_status === "drafting"}
                    />
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
