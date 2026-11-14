import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { z } from "zod";
import type { Queryable } from "@boma/core";

const rulesSchema = z.object({
  name: z.string(),
  notes: z.array(z.string()).default([]),
  banned_patterns: z
    .array(z.object({ pattern: z.string(), reason: z.string() }))
    .default([])
    .refine(
      (list) => list.every((b) => isValidRegex(b.pattern)),
      "every pattern must be a valid regex",
    ),
  claim_register: z
    .array(z.object({ id: z.string(), claim: z.string(), source: z.string() }))
    .default([]),
});
export type WorkspaceRules = z.infer<typeof rulesSchema>;

function isValidRegex(p: string): boolean {
  try {
    new RegExp(p, "i");
    return true;
  } catch {
    return false;
  }
}

export function loadWorkspaceConfig(
  path = "config/workspaces.yaml",
): Record<string, WorkspaceRules> {
  const raw = parse(readFileSync(/*turbopackIgnore: true*/ path, "utf8")) ?? {};
  return z.record(z.string().regex(/^[a-z0-9-]+$/), rulesSchema).parse(raw);
}

/** Upsert workspace names and rules from config into the database. */
export async function syncWorkspaces(
  db: Queryable,
  config: Record<string, WorkspaceRules>,
): Promise<void> {
  for (const [slug, rules] of Object.entries(config)) {
    await db.query(
      `insert into workspaces (slug, name, rules) values ($1, $2, $3)
       on conflict (slug) do update set name = excluded.name, rules = excluded.rules`,
      [slug, rules.name, rules],
    );
  }
}

export async function getWorkspaceRules(db: Queryable, slug: string): Promise<WorkspaceRules> {
  const { rows } = await db.query<{ name: string; rules: unknown }>(
    "select name, rules from workspaces where slug = $1",
    [slug],
  );
  if (!rows[0]) throw new Error(`Workspace "${slug}" not found`);
  const parsed = rulesSchema.safeParse({ name: rows[0].name, ...(rows[0].rules as object) });
  return parsed.success
    ? parsed.data
    : { name: rows[0].name, notes: [], banned_patterns: [], claim_register: [] };
}
