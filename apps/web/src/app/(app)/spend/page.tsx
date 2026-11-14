import { Wallet } from "lucide-react";
import { budgetStatus } from "@boma/core";
import { db, policy } from "@/lib/server";

/** AI spend lives here (not in the chat): month total, by area, by AI provider, recent calls. */

const SCOPE_LABEL: Record<string, string> = {
  "bot:chief-of-staff": "Chief of Staff",
  "bot:skills": "Skills",
  "dual-review": "Independent checks",
  unallocated: "Other",
};
const PROVIDER_LABEL: Record<string, string> = {
  anthropic: "Claude",
  openai: "OpenAI",
  deepseek: "DeepSeek",
};

export default async function Spend() {
  const pool = db();
  const b = await budgetStatus(pool, policy());
  const { rows: byProvider } = await pool.query<{ provider: string; aud: string; calls: number }>(
    `select provider, sum(amount_aud) as aud, count(*)::int as calls from budget_ledger
      where kind = 'actual' and created_at >= date_trunc('month', now() at time zone 'Australia/Sydney') at time zone 'Australia/Sydney'
      group by provider order by 2 desc`,
  );
  const { rows: recent } = await pool.query<{
    created_at: Date;
    provider: string;
    scope: string;
    amount_aud: string;
    tokens_in: number | null;
    tokens_out: number | null;
    kind: string | null;
  }>(
    `select l.created_at, l.provider, l.scope, l.amount_aud, l.tokens_in, l.tokens_out, t.kind
       from budget_ledger l left join tasks t on t.id = l.task_id
      where l.kind = 'actual' order by l.created_at desc limit 40`,
  );
  const pct = Math.min(100, (b.spentAud / b.hardStopAud) * 100);
  const money = (n: number) => `A$${n.toFixed(n < 1 ? 3 : 2)}`;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8 lg:px-10">
      <div className="text-xs font-semibold tracking-[0.2em] text-amber uppercase">Spend</div>
      <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight">
        AI spend this month
      </h1>
      <p className="mt-2 text-sm text-mist-400">
        Every AI call is estimated, reserved and reconciled against your monthly cap. Paid work
        stops automatically at the cap. Advertising spend is separate and always needs your
        approval.
      </p>

      <section className="panel mt-8 rounded-3xl p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm text-mist-400">
              <Wallet className="size-4" /> {b.month}
            </div>
            <div className="mt-1 font-display text-4xl font-extrabold">{money(b.spentAud)}</div>
          </div>
          <div className="text-right text-sm text-mist-400">
            of {money(b.hardStopAud)} cap
            <div className="text-xs">warning at {money(b.warnAud)}</div>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5">
          <div
            className={`h-full rounded-full ${b.stopped ? "bg-coral" : b.warn ? "bg-amber" : "bg-sage"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {b.stopped && (
          <p className="mt-3 text-sm text-coral">
            Budget stop reached: no new paid AI work this month.
          </p>
        )}
      </section>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section className="panel rounded-3xl p-5">
          <h2 className="font-display font-bold">By area</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {Object.entries(b.byScope).length === 0 && (
              <li className="text-mist-400">Nothing yet.</li>
            )}
            {Object.entries(b.byScope)
              .sort((x, y) => y[1] - x[1])
              .map(([scope, v]) => (
                <li key={scope} className="flex justify-between">
                  <span>{SCOPE_LABEL[scope] ?? scope.replace("bot:", "")}</span>
                  <span className="text-mist-300">{money(v)}</span>
                </li>
              ))}
          </ul>
        </section>
        <section className="panel rounded-3xl p-5">
          <h2 className="font-display font-bold">By AI</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {byProvider.length === 0 && <li className="text-mist-400">Nothing yet.</li>}
            {byProvider.map((p) => (
              <li key={p.provider} className="flex justify-between">
                <span>
                  {PROVIDER_LABEL[p.provider] ?? p.provider}
                  <span className="ml-2 text-xs text-mist-400">{p.calls} calls</span>
                </span>
                <span className="text-mist-300">{money(Number(p.aud))}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="panel mt-6 overflow-hidden rounded-3xl">
        <h2 className="px-5 pt-5 font-display font-bold">Recent AI calls</h2>
        <div className="scroll-thin mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-mist-400">
              <tr>
                <th className="px-5 py-2 font-medium">When</th>
                <th className="px-2 py-2 font-medium">Job</th>
                <th className="px-2 py-2 font-medium">AI</th>
                <th className="px-2 py-2 text-right font-medium">Tokens</th>
                <th className="px-5 py-2 text-right font-medium">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {recent.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-4 text-mist-400">
                    No AI calls yet this month.
                  </td>
                </tr>
              )}
              {recent.map((r, i) => (
                <tr key={i}>
                  <td className="px-5 py-2 text-mist-400">
                    {r.created_at.toLocaleString("en-AU", {
                      timeZone: "Australia/Sydney",
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="px-2 py-2">
                    {(r.kind ?? SCOPE_LABEL[r.scope] ?? r.scope).replaceAll("_", " ")}
                  </td>
                  <td className="px-2 py-2">{PROVIDER_LABEL[r.provider] ?? r.provider}</td>
                  <td className="px-2 py-2 text-right text-mist-400">
                    {(r.tokens_in ?? 0) + (r.tokens_out ?? 0)}
                  </td>
                  <td className="px-5 py-2 text-right">{money(Number(r.amount_aud))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
