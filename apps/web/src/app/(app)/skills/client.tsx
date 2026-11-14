"use client";

import { useActionState, useState, useTransition } from "react";
import { Lock, ShieldAlert, Sparkles, Trash2, Unlock, Upload } from "lucide-react";
import {
  deleteSkillAction,
  importSkillsAction,
  lockAction,
  runSkillAction,
  setSkillAction,
  unlockAction,
} from "@/app/skills-actions";

export interface SkillView {
  slug: string;
  name: string;
  description: string;
  category: string;
  risk: "standard" | "high";
  enabled: boolean;
  source: "repo" | "import";
  suggestedRisk?: "standard" | "high";
  suggestedReason?: string;
  triggers: string[];
  review: boolean;
}

export function SkillRow({ skill: s }: { skill: SkillView }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const apply = (patch: { risk?: "standard" | "high"; enabled?: boolean }) =>
    start(async () => setError((await setSkillAction(s.slug, patch)).error));
  return (
    <div className={`px-5 py-4 ${s.enabled ? "" : "opacity-60"}`}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{s.name}</span>
            <span className="chip bg-white/5 text-mist-400">{s.category}</span>
            {s.source === "import" && <span className="chip bg-iris/15 text-iris">imported</span>}
            {s.review && <span className="chip bg-sage/10 text-sage">independently checked</span>}
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-mist-400">{s.description}</p>
          {s.triggers.length > 0 && (
            <p className="mt-1 truncate text-xs text-mist-400/80">
              Activates on: {s.triggers.map((t) => `“${t}”`).join(", ")}
            </p>
          )}
          {s.suggestedRisk === "high" && s.risk !== "high" && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-amber">
              <ShieldAlert className="size-3.5" /> Suggestion only: this looks high-risk
              {s.suggestedReason ? ` (${s.suggestedReason})` : ""}. Your call.
            </p>
          )}
          {error && <p className="mt-1.5 text-xs text-coral">{error}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex rounded-xl border border-white/10 p-0.5 text-xs font-semibold">
            {(["standard", "high"] as const).map((r) => (
              <button
                key={r}
                disabled={pending || s.risk === r}
                onClick={() => apply({ risk: r })}
                className={`rounded-lg px-2.5 py-1.5 transition ${s.risk === r ? (r === "high" ? "bg-coral/20 text-coral" : "bg-white/10 text-white") : "text-mist-400 hover:text-white"}`}
              >
                {r === "high" ? "🔒 High-risk" : "Standard"}
              </button>
            ))}
          </div>
          <button
            disabled={pending}
            onClick={() => apply({ enabled: !s.enabled })}
            className="btn-outline px-3 py-1.5 text-xs"
          >
            {s.enabled ? "On" : "Off"}
          </button>
          {s.source === "import" && (
            <button
              disabled={pending}
              title="Delete imported skill"
              onClick={() => confirm(`Delete ${s.name}?`) && start(() => deleteSkillAction(s.slug))}
              className="btn-ghost px-2 py-1.5 text-mist-400"
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function RunForm(p: {
  skills: { slug: string; name: string; high: boolean }[];
  unlocked: boolean;
}) {
  const [state, action, pending] = useActionState(runSkillAction, {});
  const [key] = useState(() => crypto.randomUUID());
  const [slug, setSlug] = useState(p.skills[0]?.slug ?? "");
  const chosen = p.skills.find((s) => s.slug === slug);
  return (
    <form action={action} className="panel rounded-3xl p-6">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold">
        <Sparkles className="size-5 text-amber" /> Use a skill
      </h2>
      <input type="hidden" name="key" value={key} />
      <div className="mt-4 grid gap-3 sm:grid-cols-[220px_1fr]">
        <select
          name="slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="field"
        >
          {p.skills.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.high ? "🔒 " : ""}
              {s.name}
            </option>
          ))}
        </select>
        <textarea
          name="request"
          rows={3}
          required
          className="field"
          placeholder="What do you need? Any topic works, e.g. “Council this: should I take on a second office lease?”"
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-mist-400">
          {chosen?.high && !p.unlocked
            ? "🔒 High-risk: unlock with your passcode first."
            : "Runs on the AI budget for skills. The answer opens on its own page."}
        </span>
        <button className="btn-primary" disabled={pending || !slug}>
          {pending ? "Starting…" : "Run skill"}
        </button>
      </div>
      {state.error && <p className="mt-2 text-sm text-coral">{state.error}</p>}
    </form>
  );
}

export function UnlockPanel({ unlocked, configured }: { unlocked: boolean; configured: boolean }) {
  const [state, action, pending] = useActionState(unlockAction, {});
  const [, start] = useTransition();
  if (!configured)
    return (
      <div className="panel rounded-3xl p-5 text-sm text-mist-400">
        <h3 className="flex items-center gap-2 font-display font-bold text-white">
          <Lock className="size-4" /> Passcode
        </h3>
        <p className="mt-2">
          Set SKILLS_PASSCODE in the environment to lock skills you label high-risk.
        </p>
      </div>
    );
  return (
    <div className="panel rounded-3xl p-5">
      <h3 className="flex items-center gap-2 font-display font-bold">
        {unlocked ? (
          <Unlock className="size-4 text-sage" />
        ) : (
          <Lock className="size-4 text-coral" />
        )}
        {unlocked ? "Unlocked for 30 minutes" : "High-risk skills locked"}
      </h3>
      {unlocked ? (
        <button onClick={() => start(() => lockAction())} className="btn-outline mt-3 w-full">
          Lock now
        </button>
      ) : (
        <form action={action} className="mt-3 flex gap-2">
          <input
            name="passcode"
            type="password"
            autoComplete="off"
            className="field"
            placeholder="Passcode"
            required
          />
          <button className="btn-primary" disabled={pending}>
            Unlock
          </button>
        </form>
      )}
      {state.error && <p className="mt-2 text-xs text-coral">{state.error}</p>}
    </div>
  );
}

export function ImportForm() {
  const [state, action, pending] = useActionState(importSkillsAction, { results: [] });
  return (
    <form action={action} className="panel rounded-3xl p-5">
      <h3 className="flex items-center gap-2 font-display font-bold">
        <Upload className="size-4 text-amber" /> Import skills
      </h3>
      <p className="mt-1 text-xs text-mist-400">
        Choose .md or .skill files (several at once is fine). They are stored privately in your
        database, start as Standard, and are generalised to cover every case of their kind.
      </p>
      <input
        name="files"
        type="file"
        multiple
        accept=".md,.skill,.zip,.txt"
        className="mt-3 block w-full text-xs text-mist-300 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-mist-100"
      />
      <button className="btn-outline mt-3 w-full" disabled={pending}>
        {pending ? "Importing…" : "Import"}
      </button>
      {state.results.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs">
          {state.results.map((r) => (
            <li
              key={r.file}
              className={r.error || r.status === "built_in" ? "text-coral" : "text-sage"}
            >
              {r.file}:{" "}
              {r.error
                ? r.error
                : r.status === "built_in"
                  ? `"${r.slug}" is a built-in skill; kept the built-in`
                  : `${r.status} as ${r.slug}`}
              {r.warnings.length > 0 && (
                <span className="text-mist-400"> · {r.warnings.join("; ")}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
