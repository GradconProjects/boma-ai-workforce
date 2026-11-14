import { join } from "node:path";
import Link from "next/link";
import { Brain, Lock, Unlock } from "lucide-react";
import {
  isUnlocked,
  listRuns,
  loadAllSkills,
  loadRepoSkills,
  passcodeConfigured,
} from "@boma/skills";
import { db, env, ROOT } from "@/lib/server";
import { ImportForm, RunForm, SkillRow, UnlockPanel } from "./client";

export default async function Skills() {
  const skills = await loadAllSkills(db(), loadRepoSkills(join(ROOT, "skills")));
  const unlocked = await isUnlocked(db(), "web");
  const runs = await listRuns(db(), 15);
  const configured = passcodeConfigured(env().SKILLS_PASSCODE);
  return (
    <div className="mx-auto max-w-6xl px-6 py-8 lg:px-10">
      <div className="text-xs font-semibold tracking-[0.2em] text-amber uppercase">
        Skills library
      </div>
      <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight">
        Expert methods, on call
      </h1>
      <p className="mt-2 max-w-3xl text-sm text-mist-400">
        The Chief uses a skill automatically when your request fits it, on Telegram or in the app
        chat. Each skill works for any topic of its kind, not just the examples it was written with.
        You decide which skills are high-risk: those need your passcode before they run.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="space-y-6">
          <RunForm
            skills={skills
              .filter((s) => s.fm.enabled)
              .map((s) => ({ slug: s.fm.slug, name: s.fm.name, high: s.fm.risk === "high" }))}
            unlocked={unlocked}
          />

          <div className="panel overflow-hidden rounded-3xl">
            <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                <Brain className="size-5 text-amber" /> {skills.length} skills
              </h2>
              <span className="text-xs text-mist-400">Risk labels are yours to set</span>
            </div>
            <div className="divide-y divide-white/5">
              {skills.map((s) => (
                <SkillRow
                  key={s.fm.slug}
                  skill={{
                    slug: s.fm.slug,
                    name: s.fm.name,
                    description: s.fm.description,
                    category: s.fm.category,
                    risk: s.fm.risk,
                    enabled: s.fm.enabled,
                    source: s.source,
                    suggestedRisk: s.fm.suggested_risk,
                    suggestedReason: s.fm.suggested_reason,
                    triggers: s.fm.triggers.slice(0, 4),
                    review: s.fm.review,
                  }}
                />
              ))}
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <UnlockPanel unlocked={unlocked} configured={configured} />
          <ImportForm />
          <div className="panel rounded-3xl p-5">
            <h3 className="font-display font-bold">Recent runs</h3>
            {runs.length === 0 && <p className="mt-2 text-sm text-mist-400">No runs yet.</p>}
            <ul className="mt-3 space-y-2">
              {runs.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/skills/runs/${r.id}`}
                    className="block rounded-xl px-3 py-2 text-sm hover:bg-white/5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{r.slug}</span>
                      <span
                        className={`chip ${r.status === "done" ? "bg-sage/15 text-sage" : r.status === "failed" ? "bg-coral/15 text-coral" : "bg-iris/15 text-iris"}`}
                      >
                        {r.status}
                      </span>
                    </div>
                    <div className="truncate text-xs text-mist-400">{r.request}</div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <p className="flex items-start gap-2 px-1 text-xs text-mist-400">
            {unlocked ? (
              <Unlock className="mt-0.5 size-3.5" />
            ) : (
              <Lock className="mt-0.5 size-3.5" />
            )}
            Telegram and this page unlock separately. Telegram: /unlock &lt;passcode&gt; (the
            message is deleted).
          </p>
        </aside>
      </div>
    </div>
  );
}
