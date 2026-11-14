import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getRun } from "@boma/skills";
import { db } from "@/lib/server";
import { AutoRefresh } from "@/components/auto-refresh";

const UUID = /^[0-9a-f-]{36}$/i;

export default async function SkillRun({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const run = await getRun(db(), id);
  if (!run) notFound();
  const working = run.status === "queued" || run.status === "running";
  return (
    <div className="mx-auto max-w-4xl px-6 py-8 lg:px-10">
      {working && <AutoRefresh seconds={4} />}
      <Link href="/skills" className="btn-ghost -ml-3 px-3 text-mist-400">
        <ArrowLeft className="size-4" /> Skills
      </Link>
      <div className="mt-4 text-xs font-semibold tracking-[0.2em] text-amber uppercase">
        {run.slug}
      </div>
      <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight">
        {run.request.slice(0, 140)}
      </h1>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-mist-400">
        <span>
          {run.created_at.toLocaleString("en-AU", {
            timeZone: "Australia/Sydney",
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </span>
        <span>via {run.channel}</span>
        {run.cost_aud !== null && <span>AI cost A${Number(run.cost_aud).toFixed(3)}</span>}
      </div>
      <article className="panel mt-6 rounded-3xl p-6">
        {working && (
          <p className="animate-pulse text-sm text-mist-300">
            Working on it… this page updates by itself.
          </p>
        )}
        {run.status === "failed" && <p className="text-sm text-coral">Failed: {run.error}</p>}
        {run.output && (
          <pre className="font-sans text-[15px] leading-relaxed whitespace-pre-wrap text-mist-100">
            {run.output}
          </pre>
        )}
      </article>
    </div>
  );
}
