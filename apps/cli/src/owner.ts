import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";
import type pg from "pg";
import { createPool } from "@boma/db";
import { HttpTelegramApi } from "@boma/connectors";
import {
  audit,
  budgetStatus,
  loadEnv,
  loadPolicy,
  pauseAll,
  redact,
  requireEnv,
  resumeAll,
  type Policy,
} from "@boma/core";

/**
 * Owner path (CLAUDE.md rule 6): the only code that changes permissions, unlocks protected
 * actions or sets budgets. It runs on the owner's own computer; bots have no route to it.
 *
 *   pnpm owner status
 *   pnpm owner pause | resume
 *   pnpm owner unlock <bot> <action> <level> --reason "…" [--workspace <ws>] [--days <n>]
 *   pnpm owner lock <bot> <action>
 *   pnpm owner account add <slug> <kind> "<label>" [--workspace <ws>]
 *   pnpm owner grant <bot> <account>
 *   pnpm owner revoke <bot> <account>
 *   pnpm owner budget set <company|bot:<slug>|dual-review> <aud> [--warn <aud>]
 *
 * Changes ask for confirmation; add --yes to skip.
 */

function chdirToRepoRoot() {
  let dir = process.cwd();
  while (!existsSync(join(dir, "pnpm-workspace.yaml"))) {
    const up = dirname(dir);
    if (up === dir) return;
    dir = up;
  }
  process.chdir(dir);
}

export function parseArgs(argv: string[]) {
  const positional: string[] = [];
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--")) {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[a.slice(2)] = next;
        i++;
      } else flags[a.slice(2)] = true;
    } else positional.push(a);
  }
  return { positional, flags };
}

export class OwnerCliError extends Error {}

async function confirm(question: string, yes: boolean): Promise<void> {
  if (yes) return;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(`${question} Type "yes" to confirm: `)).trim().toLowerCase();
  rl.close();
  if (answer !== "yes") throw new OwnerCliError("Cancelled.");
}

async function botId(db: pg.Pool, slug: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>("select id from bots where slug = $1", [slug]);
  if (!rows[0]) throw new OwnerCliError(`No bot "${slug}". Run pnpm bots:sync first.`);
  return rows[0].id;
}

export async function runOwnerCommand(
  db: pg.Pool,
  policy: Policy,
  argv: string[],
  out: (s: string) => void = console.log,
): Promise<void> {
  const { positional: p, flags } = parseArgs(argv);
  const yes = flags.yes === true;
  const [cmd, sub] = p;

  switch (cmd) {
    case "status": {
      const b = await budgetStatus(db, policy);
      const paused =
        (await db.query("select value from system_state where key = 'paused'")).rows[0]?.value ===
        true;
      const unlocks = await db.query(
        `select b.slug, u.action, u.new_level, u.expires_at from policy_unlocks u join bots b on b.id = u.bot_id
          where u.expires_at is null or u.expires_at > now() order by b.slug`,
      );
      out(
        `${paused ? "PAUSED" : "Running"} · spend A$${b.spentAud.toFixed(2)} of A$${b.hardStopAud.toFixed(2)} (${b.month})`,
      );
      for (const u of unlocks.rows)
        out(
          `  unlock: ${u.slug} ${u.action} → level ${u.new_level}${u.expires_at ? ` until ${u.expires_at.toISOString()}` : ""}`,
        );
      return;
    }
    case "pause":
      out(`Paused ${await pauseAll(db, "owner")} task(s).`);
      return;
    case "resume":
      out(`Resumed ${await resumeAll(db, "owner")} task(s).`);
      return;

    case "unlock": {
      const [, bot, action, levelStr] = p;
      const level = Number(levelStr);
      if (!bot || !action || !Number.isInteger(level) || level < 1 || level > 5) {
        throw new OwnerCliError(
          'Usage: owner unlock <bot> <action> <level 1-5> --reason "…" [--workspace ws] [--days n]',
        );
      }
      if (!policy.protected_actions.includes(action))
        throw new OwnerCliError(
          `"${action}" is not a protected action; set its level in the bot file instead.`,
        );
      const reason = typeof flags.reason === "string" ? flags.reason.trim() : "";
      if (!reason) throw new OwnerCliError("An unlock needs --reason.");
      const days = flags.days === undefined ? 30 : Number(flags.days);
      if (!Number.isFinite(days) || days <= 0 || days > 365)
        throw new OwnerCliError("--days must be between 1 and 365.");
      const id = await botId(db, bot);
      const ws = typeof flags.workspace === "string" ? flags.workspace : null;
      await confirm(
        `Unlock "${action}" for ${bot} at level ${level}${ws ? ` in ${ws}` : " in all its workspaces"} for ${days} days?`,
        yes,
      );
      await db.query(
        `insert into policy_unlocks (action, bot_id, workspace_id, new_level, reason, expires_at)
         values ($1, $2, (select id from workspaces where slug = $3), $4, $5, now() + make_interval(days => $6))`,
        [action, id, ws, level, reason, days],
      );
      await audit(db, {
        actor: "owner",
        action: "policy.unlock",
        target: `bot:${bot}`,
        inputs: { action, level, ws, days, reason },
        result: "ok",
      });
      out(`Unlocked ${action} for ${bot} at level ${level} for ${days} days.`);
      return;
    }
    case "lock": {
      const [, bot, action] = p;
      if (!bot || !action) throw new OwnerCliError("Usage: owner lock <bot> <action>");
      const id = await botId(db, bot);
      const r = await db.query(
        "update policy_unlocks set expires_at = now() where bot_id = $1 and action = $2 and (expires_at is null or expires_at > now())",
        [id, action],
      );
      await audit(db, {
        actor: "owner",
        action: "policy.lock",
        target: `bot:${bot}`,
        inputs: { action },
        result: `${r.rowCount} unlock(s) ended`,
      });
      out(`Ended ${r.rowCount} unlock(s).`);
      return;
    }

    case "account": {
      if (sub !== "add")
        throw new OwnerCliError(
          'Usage: owner account add <slug> <kind> "<label>" [--workspace ws]',
        );
      const [, , slug, kind, label] = p;
      if (!slug || !kind || !label)
        throw new OwnerCliError(
          'Usage: owner account add <slug> <kind> "<label>" [--workspace ws]',
        );
      const ws = typeof flags.workspace === "string" ? flags.workspace : null;
      await db.query(
        `insert into accounts (slug, kind, label, workspace_id) values ($1, $2, $3, (select id from workspaces where slug = $4))`,
        [slug, kind, label, ws],
      );
      await audit(db, {
        actor: "owner",
        action: "account.add",
        target: `account:${slug}`,
        inputs: { kind, ws },
        result: "ok",
      });
      out(
        `Added account ${slug} (${kind}). Its secret stays in .env / encrypted storage, never here.`,
      );
      return;
    }
    case "grant":
    case "revoke": {
      const [, bot, account] = p;
      if (!bot || !account) throw new OwnerCliError(`Usage: owner ${cmd} <bot> <account>`);
      const id = await botId(db, bot);
      const acc = await db.query<{ id: string }>("select id from accounts where slug = $1", [
        account,
      ]);
      if (!acc.rows[0])
        throw new OwnerCliError(`No account "${account}". Add it with: owner account add …`);
      await confirm(`${cmd === "grant" ? "Grant" : "Revoke"} ${bot} access to ${account}?`, yes);
      if (cmd === "grant") {
        await db.query(
          "insert into bot_account_grants (bot_id, account_id) values ($1, $2) on conflict do nothing",
          [id, acc.rows[0].id],
        );
      } else {
        await db.query("delete from bot_account_grants where bot_id = $1 and account_id = $2", [
          id,
          acc.rows[0].id,
        ]);
      }
      await audit(db, {
        actor: "owner",
        action: `account.${cmd}`,
        target: `bot:${bot}`,
        inputs: { account },
        result: "ok",
      });
      out(`${cmd === "grant" ? "Granted" : "Revoked"}: ${bot} → ${account}.`);
      return;
    }

    case "budget": {
      if (sub !== "set")
        throw new OwnerCliError(
          "Usage: owner budget set <company|bot:<slug>|dual-review> <aud> [--warn aud]",
        );
      const [, , scopeArg, audStr] = p;
      const aud = Number(audStr);
      if (!scopeArg || !Number.isFinite(aud) || aud < 0)
        throw new OwnerCliError("Usage: owner budget set <scope> <aud> [--warn aud]");
      const scope = scopeArg === "dual-review" ? "bot:dual-review" : scopeArg;
      if (scope !== "company" && !/^bot:[a-z0-9-]+$/.test(scope))
        throw new OwnerCliError("Scope must be company, dual-review or bot:<slug>.");
      if (scope === "company" && aud >= policy.budget.safety_buffer_below) {
        throw new OwnerCliError(
          `The company cap must stay below A$${policy.budget.safety_buffer_below} (policy safety buffer).`,
        );
      }
      const warn = flags.warn === undefined ? null : Number(flags.warn);
      if (warn !== null && (!Number.isFinite(warn) || warn > aud))
        throw new OwnerCliError("--warn must be a number no higher than the limit.");
      await confirm(
        `Set the ${scopeArg} monthly budget to A$${aud.toFixed(2)}${warn !== null ? ` (warn at A$${warn.toFixed(2)})` : ""}?`,
        yes,
      );
      await db.query(
        `insert into budget_limits (scope, monthly_aud, warn_aud) values ($1, $2, $3)
         on conflict (scope) do update set monthly_aud = excluded.monthly_aud, warn_aud = excluded.warn_aud, set_by_owner_at = now()`,
        [scope, aud, warn],
      );
      await audit(db, {
        actor: "owner",
        action: "budget.set",
        target: scope,
        inputs: { aud, warn },
        result: "ok",
      });
      out(`Budget for ${scopeArg} set to A$${aud.toFixed(2)}.`);
      return;
    }

    case "telegram": {
      // owner telegram webhook <https://your-app.vercel.app>   |   owner telegram polling
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token) throw new OwnerCliError("TELEGRAM_BOT_TOKEN is not set in your local .env");
      const api = new HttpTelegramApi(token);
      if (sub === "webhook") {
        const base = p[2]?.replace(/\/$/, "");
        const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
        if (!base || !/^https:\/\//.test(base))
          throw new OwnerCliError("Usage: owner telegram webhook https://<your-app>.vercel.app");
        if (!secret)
          throw new OwnerCliError(
            "TELEGRAM_WEBHOOK_SECRET must be set locally to the same value as on Vercel",
          );
        await api.setWebhook(`${base}/api/telegram`, secret);
        out(`Telegram now delivers to ${base}/api/telegram (hosted mode). Stop any local worker.`);
      } else if (sub === "polling") {
        await api.deleteWebhook();
        out("Webhook removed: the local worker (pnpm worker) can long-poll Telegram again.");
      } else
        throw new OwnerCliError(
          "Usage: owner telegram webhook <https-url> | owner telegram polling",
        );
      return;
    }

    default:
      out(
        [
          "Owner commands:",
          "  status | pause | resume",
          '  unlock <bot> <action> <level> --reason "…" [--workspace ws] [--days n]',
          "  lock <bot> <action>",
          '  account add <slug> <kind> "<label>" [--workspace ws]',
          "  grant <bot> <account> | revoke <bot> <account>",
          "  budget set <company|bot:<slug>|dual-review> <aud> [--warn aud]",
          "  telegram webhook <https-url> | telegram polling",
          "Add --yes to skip confirmation.",
        ].join("\n"),
      );
  }
}

async function main() {
  chdirToRepoRoot();
  const env = requireEnv(loadEnv(), ["DATABASE_URL"]);
  const db = createPool(env.DATABASE_URL, 2);
  try {
    await runOwnerCommand(db, loadPolicy(), process.argv.slice(2));
  } catch (err) {
    console.error(err instanceof OwnerCliError ? err.message : redact((err as Error).message));
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) void main();
