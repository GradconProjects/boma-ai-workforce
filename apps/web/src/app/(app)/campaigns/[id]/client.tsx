"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Check, Download, Loader2, Sparkles, X } from "lucide-react";
import type { Design } from "@boma/design-engine";
import { decideApprovalAction, requestCopyAction } from "@/app/actions";
import { designToPngBlob, downloadBlob, safeFilename } from "@/components/editor/export";

/** Refresh the page every few seconds while the Chief is drafting. */
export function LiveRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), 4_000);
    return () => clearInterval(t);
  }, [active, router]);
  return null;
}

export function CampaignActions({
  campaignId,
  itemId,
  compact,
  disabled,
}: {
  campaignId: string;
  itemId?: string;
  compact?: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = () =>
    start(async () => {
      const r = await requestCopyAction({ campaignId, itemIds: itemId ? [itemId] : undefined });
      setMsg({ ok: r.ok, text: r.message });
      router.refresh();
    });
  return (
    <div className={compact ? "" : "text-right"}>
      <button
        onClick={run}
        disabled={pending || disabled}
        className={compact ? "btn-outline w-full py-2 text-xs" : "btn-primary"}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        {compact ? "Ask the Chief to write copy" : "Ask the Chief to write all copy"}
      </button>
      {msg && (
        <p className={`mt-2 max-w-xs text-xs ${msg.ok ? "text-mist-300" : "text-coral"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}

export function ItemDecision({ approvalId }: { approvalId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const decide = (d: "approved" | "rejected") =>
    start(async () => {
      const r = await decideApprovalAction(approvalId, d);
      setMsg(r.message);
    });
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => decide("approved")}
          disabled={pending}
          className="btn-primary py-2 text-xs"
        >
          <Check className="size-4" /> Approve
        </button>
        <button
          onClick={() => decide("rejected")}
          disabled={pending}
          className="btn-outline py-2 text-xs"
        >
          <X className="size-4" /> Reject
        </button>
      </div>
      {msg && <p className="mt-2 text-xs text-mist-300">{msg}</p>}
    </div>
  );
}

export function ExportAllButton({ designs }: { designs: { doc: Design; title: string }[] }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn-outline text-xs"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          for (const d of designs)
            downloadBlob(await designToPngBlob(d.doc), `${safeFilename(d.title)}.png`);
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Export
      all as PNG
    </button>
  );
}
