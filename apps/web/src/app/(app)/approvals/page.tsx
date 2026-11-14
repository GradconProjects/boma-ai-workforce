import { CheckCircle2, ShieldCheck } from "lucide-react";
import { pendingApprovals } from "@boma/core";
import { db } from "@/lib/server";
import { ItemDecision } from "../campaigns/[id]/client";

export default async function Approvals() {
  const approvals = await pendingApprovals(db());
  const { rows: recent } = await db().query<{
    id: string;
    status: string;
    decided_at: Date;
    preview: Record<string, unknown>;
  }>(
    "select id, status, decided_at, preview from approvals where status <> 'pending' order by decided_at desc nulls last limit 10",
  );
  return (
    <div className="mx-auto max-w-4xl px-6 py-8 lg:px-10">
      <div className="text-xs font-semibold tracking-[0.2em] text-amber uppercase">
        Approval centre
      </div>
      <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight">
        Nothing goes out without you
      </h1>
      <p className="mt-2 flex items-center gap-2 text-sm text-mist-400">
        <ShieldCheck className="size-4 text-sage" /> Each approval is tied to the exact content
        shown. Any change needs a new approval. The same items appear on Telegram.
      </p>

      <section className="mt-8 space-y-4">
        {approvals.length === 0 && (
          <div className="panel grid place-items-center rounded-3xl px-6 py-14 text-center">
            <CheckCircle2 className="size-8 text-sage" />
            <h3 className="mt-3 font-display text-lg font-bold">All clear</h3>
            <p className="text-sm text-mist-400">Nothing is waiting for your approval.</p>
          </div>
        )}
        {approvals.map((a) => {
          const p = a.preview as {
            text?: string;
            workspace?: string;
            label?: string;
            review?: string;
            costAud?: number;
            simulated?: boolean;
          };
          return (
            <article key={a.id} className="panel rise rounded-3xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold tracking-wider text-mist-400 uppercase">
                  {p.workspace} · {p.label ?? "Facebook Page post"}
                </div>
                <div className="text-xs text-mist-400">
                  Expires{" "}
                  {a.expires_at.toLocaleString("en-AU", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </div>
              </div>
              {p.simulated && (
                <div className="mt-3 rounded-lg border border-iris/25 bg-iris/10 px-3 py-1.5 text-xs text-iris">
                  🧪 Simulation: not real AI output.
                </div>
              )}
              <pre className="mt-4 rounded-2xl bg-ink-950/60 p-4 font-sans text-[15px] leading-relaxed whitespace-pre-wrap text-mist-100">
                {p.text}
              </pre>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-mist-400">
                <span>{p.review}</span>
              </div>
              <div className="mt-4 max-w-xs">
                <ItemDecision approvalId={a.id} />
              </div>
            </article>
          );
        })}
      </section>

      {recent.length > 0 && (
        <section className="mt-12">
          <h2 className="label">Recently decided</h2>
          <div className="panel divide-y divide-white/5 rounded-2xl">
            {recent.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span
                  className={`chip ${r.status === "approved" ? "bg-sage/15 text-sage" : "bg-white/5 text-mist-400"}`}
                >
                  {r.status}
                </span>
                <span className="min-w-0 flex-1 truncate text-mist-300">
                  {String((r.preview as { text?: string }).text ?? "").split("\n")[0]}
                </span>
                <span className="text-xs text-mist-400">
                  {r.decided_at?.toLocaleDateString("en-AU")}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
