import { join } from "node:path";
import Link from "next/link";
import { ArrowRight, Bot, Brain, Crown, Link2, Plug } from "lucide-react";
import type { BotFrontmatter } from "@boma/bots";
import { budgetStatus } from "@boma/core";
import { loadAllSkills, loadRepoSkills } from "@boma/skills";
import { db, env, policy, ROOT } from "@/lib/server";
import { DeleteButton } from "@/components/delete-button";
import { deleteWorkspaceAction } from "@/app/delete-actions";

/** Every bot the Chief can call, what it may do, what it's connected to, and how busy it is. */

const LEVEL = ["", "Never", "Asks first", "Asks first", "Acts, then reports", "Acts on its own"];

export default async function Bots() {
  const pool = db();
  const { rows: bots } = await pool.query<{
    id: string;
    slug: string;
    enabled: boolean;
    department: string;
    version: number;
    frontmatter: BotFrontmatter;
  }>(
    `select b.id, b.slug, b.enabled, b.department, v.version, v.frontmatter
       from bots b join bot_versions v on v.id = b.current_version_id order by b.slug`,
  );
  const { rows: work } = await pool.query<{ slug: string; status: string; n: number }>(
    `select b.slug, t.status, count(*)::int as n from tasks t join bots b on b.id = t.bot_id
      where t.created_at > now() - interval '30 days' group by 1, 2`,
  );
  const { rows: accounts } = await pool.query<{
    slug: string;
    kind: string;
    label: string;
    status: string;
    workspace: string | null;
  }>(
    "select a.slug, a.kind, a.label, a.status, w.slug as workspace from accounts a left join workspaces w on w.id = a.workspace_id order by a.kind, a.label",
  );
  const { rows: grants } = await pool.query<{ bot: string; account: string }>(
    "select b.slug as bot, a.slug as account from bot_account_grants g join bots b on b.id = g.bot_id join accounts a on a.id = g.account_id",
  );
  const skills = (await loadAllSkills(pool, loadRepoSkills(join(ROOT, "skills")))).filter(
    (s) => s.fm.enabled,
  );
  const budget = await budgetStatus(pool, policy());
  const { rows: workspaces } = await pool.query<{ slug: string; name: string; owner_added: boolean }>(
    "select slug, name, owner_added from workspaces where owner_added or slug in ('personal','ongroundpm','mypadiforum','boma-scans') order by owner_added desc, name",
  );
  const e = env();

  const connections = [
    {
      name: "Telegram",
      ok: Boolean(e.TELEGRAM_BOT_TOKEN && e.TELEGRAM_OWNER_USER_ID),
      note: "Chat with the Chief on your phone",
    },
    { name: "App chat", ok: true, note: "This app, online or offline" },
    {
      name: "Claude (Anthropic)",
      ok: Boolean(e.ANTHROPIC_API_KEY),
      note: "Writes, plans and runs skills",
    },
    { name: "OpenAI", ok: Boolean(e.OPENAI_API_KEY), note: "Independent checker" },
    { name: "DeepSeek", ok: Boolean(e.DEEPSEEK_API_KEY), note: "Backup checker" },
  ];
  const tally = (slug: string) =>
    work
      .filter((w) => w.slug === slug)
      .reduce<Record<string, number>>((m, w) => ((m[w.status] = w.n), m), {});
  const chief = bots.find((b) => b.slug === "chief-of-staff");
  const team = bots.filter((b) => b.slug !== "chief-of-staff");

  const card = (b: (typeof bots)[number], lead = false) => {
    const fm = b.frontmatter;
    const t = tally(b.slug);
    const myAccounts = grants.filter((g) => g.bot === b.slug).map((g) => g.account);
    const actions = Object.entries(fm.actions ?? {}).filter(([, lvl]) => Number(lvl) > 1);
    return (
      <article key={b.slug} className={`panel rounded-3xl p-5 ${lead ? "border-amber/25" : ""}`}>
        <div className="flex items-start gap-3">
          <div
            className={`grid size-10 place-items-center rounded-2xl ${lead ? "bg-amber/15 text-amber" : "bg-white/5 text-mist-200"}`}
          >
            {lead ? <Crown className="size-5" /> : <Bot className="size-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-lg font-bold">{fm.name ?? b.slug}</h3>
              <span
                className={`chip ${b.enabled ? "bg-sage/15 text-sage" : "bg-white/5 text-mist-400"}`}
              >
                {b.enabled ? "active" : "off"}
              </span>
              <span className="chip bg-white/5 text-mist-400">v{b.version}</span>
            </div>
            <p className="mt-1 text-sm text-mist-400">{fm.purpose}</p>
          </div>
        </div>
        <details className="group mt-4">
          <summary className="flex cursor-pointer list-none items-center justify-between text-xs text-mist-300">
            <span>
              30 days: {t.done ?? 0} done ·{" "}
              {(t.queued ?? 0) + (t.running ?? 0) + (t.in_review ?? 0)} in progress ·{" "}
              {t.awaiting_approval ?? 0} awaiting you
            </span>
            <span className="text-mist-400 group-open:rotate-90">›</span>
          </summary>
          <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-mist-400">Businesses</dt>
              <dd>{fm.workspaces?.join(", ") || "none"}</dd>
            </div>
            <div>
              <dt className="text-mist-400">Accounts</dt>
              <dd>{[...new Set([...(fm.accounts ?? []), ...myAccounts])].join(", ") || "none"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-mist-400">May do</dt>
              <dd className="mt-1 flex flex-wrap gap-1">
                {actions.map(([a, lvl]) => (
                  <span
                    key={a}
                    className="chip bg-white/5 text-mist-300"
                    title={`Autonomy level ${lvl}`}
                  >
                    {a.replaceAll("_", " ")} · {LEVEL[Number(lvl)]}
                  </span>
                ))}
              </dd>
            </div>
            <div>
              <dt className="text-mist-400">Budget</dt>
              <dd>
                A${fm.budget?.monthly_aud}/month · max A${fm.budget?.max_task_aud} per job
              </dd>
            </div>
            <div>
              <dt className="text-mist-400">Reports to</dt>
              <dd>{fm.reports_to}</dd>
            </div>
          </dl>
          <p className="mt-3 text-[11px] text-mist-400">
            Permissions change only through you (owner CLI). No bot can raise its own or another
            bot&apos;s permissions.
          </p>
        </details>
      </article>
    );
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 lg:px-10">
      <div className="text-xs font-semibold tracking-[0.2em] text-amber uppercase">Bots</div>
      <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight">Your workforce</h1>
      <p className="mt-2 max-w-2xl text-sm text-mist-400">
        Ask the Chief and it splits the job across the team: a skill can research or plan first,
        then hand its answer to a drafting bot, with every public post coming back to you.
      </p>

      <section className="mt-8">
        {chief && card(chief, true)}
        <div className="mx-auto h-6 w-px bg-white/10" />
        <div className="grid gap-4 md:grid-cols-2">
          {team.map((b) => card(b))}
          <article className="panel rounded-3xl p-5">
            <div className="flex items-start gap-3">
              <div className="grid size-10 place-items-center rounded-2xl bg-iris/15 text-iris">
                <Brain className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-lg font-bold">Skills team</h3>
                <p className="mt-1 text-sm text-mist-400">
                  {skills.length} expert methods the Chief calls on:{" "}
                  {skills
                    .slice(0, 5)
                    .map((s) => s.fm.name)
                    .join(", ")}
                  {skills.length > 5 ? "…" : ""}
                </p>
                <Link
                  href="/skills"
                  className="mt-3 inline-flex items-center gap-1 text-xs text-amber"
                >
                  Manage skills <ArrowRight className="size-3" />
                </Link>
              </div>
            </div>
          </article>
        </div>
      </section>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <section className="panel rounded-3xl p-5">
          <h2 className="flex items-center gap-2 font-display font-bold">
            <Plug className="size-4 text-amber" /> Connections
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {connections.map((c) => (
              <li key={c.name} className="flex items-center gap-3">
                <span className={`size-2 rounded-full ${c.ok ? "bg-sage" : "bg-mist-400/40"}`} />
                <span className="flex-1">
                  {c.name}
                  <span className="block text-xs text-mist-400">{c.note}</span>
                </span>
                <span className="text-xs text-mist-400">{c.ok ? "connected" : "not set"}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel rounded-3xl p-5 md:col-span-2">
          <h2 className="font-display font-bold">Workspaces</h2>
          <p className="mt-1 text-xs text-mist-400">
            Businesses and pages the bots work for. Ask the Chief to create one any time.
          </p>
          <ul className="mt-3 divide-y divide-white/5 text-sm">
            {workspaces.map((w) => (
              <li key={w.slug} className="flex items-center justify-between gap-3 py-2">
                <span>
                  {w.name}
                  <span className="ml-2 text-xs text-mist-400">
                    {w.owner_added ? "created by you" : "built in"}
                  </span>
                </span>
                {w.owner_added && (
                  <DeleteButton
                    action={deleteWorkspaceAction.bind(null, w.slug)}
                    confirmText={`Delete the workspace "${w.name}"?`}
                  />
                )}
              </li>
            ))}
          </ul>
        </section>
        <section className="panel rounded-3xl p-5">
          <h2 className="flex items-center gap-2 font-display font-bold">
            <Link2 className="size-4 text-amber" /> Accounts
          </h2>
          {accounts.length === 0 ? (
            <p className="mt-3 text-sm text-mist-400">
              No social accounts yet. Facebook Pages are added through the owner CLI (pnpm owner
              account add) when publishing goes live.
            </p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {accounts.map((a) => (
                <li key={a.slug} className="flex items-center gap-3">
                  <span
                    className={`size-2 rounded-full ${a.status === "ok" ? "bg-sage" : "bg-coral"}`}
                  />
                  <span className="flex-1">
                    {a.label}
                    <span className="block text-xs text-mist-400">
                      {a.kind.replace("_", " ")}
                      {a.workspace ? ` · ${a.workspace}` : ""}
                    </span>
                  </span>
                  <span className="text-xs text-mist-400">{a.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
