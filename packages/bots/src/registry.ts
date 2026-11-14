import type { Queryable } from "@boma/core";
import type { BotFrontmatter } from "./schema";

export interface BotSettings {
  id: string;
  slug: string;
  enabled: boolean;
  versionId: string;
  version: number;
  frontmatter: BotFrontmatter;
}

/** Current synced settings for a bot (what new tasks will pin). */
export async function loadBotSettings(db: Queryable, slug: string): Promise<BotSettings> {
  const { rows } = await db.query<{
    id: string;
    slug: string;
    enabled: boolean;
    version_id: string;
    version: number;
    frontmatter: BotFrontmatter;
  }>(
    `select b.id, b.slug, b.enabled, v.id as version_id, v.version, v.frontmatter
       from bots b join bot_versions v on v.id = b.current_version_id where b.slug = $1`,
    [slug],
  );
  const r = rows[0];
  if (!r) throw new Error(`Bot "${slug}" is not synced`);
  return { id: r.id, slug: r.slug, enabled: r.enabled, versionId: r.version_id, version: r.version, frontmatter: r.frontmatter };
}

/** Settings of the exact version a task pinned (T22: edits mid-task don't affect it). */
export async function loadPinnedSettings(db: Queryable, versionId: string): Promise<BotFrontmatter> {
  const { rows } = await db.query<{ frontmatter: BotFrontmatter }>("select frontmatter from bot_versions where id = $1", [versionId]);
  if (!rows[0]) throw new Error(`Bot version ${versionId} not found`);
  return rows[0].frontmatter;
}

export async function listBots(db: Queryable): Promise<{ slug: string; enabled: boolean; version: number; department: string }[]> {
  const { rows } = await db.query(
    `select b.slug, b.enabled, v.version, b.department
       from bots b join bot_versions v on v.id = b.current_version_id order by b.slug`,
  );
  return rows;
}
