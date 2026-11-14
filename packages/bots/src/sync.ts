import type { Client } from "pg";
import type { Policy } from "@boma/core";
import { lintBot, type OwnerUnlock } from "./lint";
import type { BotDefinition } from "./schema";

export type SyncResult =
  | { slug: string; status: "unchanged"; version: number }
  | { slug: string; status: "created" | "updated"; version: number }
  | { slug: string; status: "rejected"; errors: string[] };

export async function loadUnlocks(client: Client): Promise<OwnerUnlock[]> {
  const { rows } = await client.query<OwnerUnlock>(
    `select u.action, b.slug as bot_slug, u.new_level, u.expires_at
       from policy_unlocks u join bots b on b.id = u.bot_id
      where u.expires_at is null or u.expires_at > now()`,
  );
  return rows;
}

/**
 * Sync one bot file into bots / bot_versions. A new immutable version is inserted only when
 * the file content changed. A file that fails lint is never synced.
 */
export async function syncBot(client: Client, bot: BotDefinition, policy: Policy): Promise<SyncResult> {
  const fm = bot.frontmatter;
  const report = lintBot(bot, { policy, unlocks: await loadUnlocks(client), source: "git-sync" });
  if (!report.ok) {
    return { slug: fm.slug, status: "rejected", errors: report.errors.map((e) => `${e.rule}: ${e.message}`) };
  }

  await client.query("begin");
  try {
    const existing = await client.query<{ id: string; file_sha: string | null; version: number | null }>(
      `select b.id, v.file_sha, v.version
         from bots b left join bot_versions v on v.id = b.current_version_id
        where b.slug = $1 for update of b`,
      [fm.slug],
    );
    let botId = existing.rows[0]?.id;
    if (existing.rows[0]?.file_sha === bot.fileSha) {
      await client.query("commit");
      return { slug: fm.slug, status: "unchanged", version: existing.rows[0].version ?? 0 };
    }

    if (!botId) {
      const ins = await client.query<{ id: string }>(
        "insert into bots (slug, enabled, department) values ($1, $2, $3) returning id",
        [fm.slug, fm.enabled, fm.department],
      );
      botId = ins.rows[0]!.id;
    } else {
      await client.query("update bots set enabled = $2, department = $3 where id = $1", [
        botId,
        fm.enabled,
        fm.department,
      ]);
    }

    const next = await client.query<{ v: number }>(
      "select coalesce(max(version), 0) + 1 as v from bot_versions where bot_id = $1",
      [botId],
    );
    const version = next.rows[0]!.v;
    const ver = await client.query<{ id: string }>(
      `insert into bot_versions (bot_id, version, file_sha, frontmatter, instructions, lint_report, created_by)
       values ($1, $2, $3, $4, $5, $6, 'git-sync') returning id`,
      [botId, version, bot.fileSha, fm, bot.instructions, report],
    );
    await client.query("update bots set current_version_id = $2 where id = $1", [botId, ver.rows[0]!.id]);
    await client.query(
      `insert into audit_log (actor, action, target, outputs_hash, result)
       values ('system', 'bot.sync', $1, $2, 'ok')`,
      [`bot:${fm.slug}`, bot.fileSha],
    );
    await client.query("commit");
    return { slug: fm.slug, status: existing.rows[0] ? "updated" : "created", version };
  } catch (err) {
    await client.query("rollback");
    throw err;
  }
}
