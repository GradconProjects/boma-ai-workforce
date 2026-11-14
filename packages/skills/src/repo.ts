import { audit, type Queryable } from "@boma/core";
import { skillFrontmatterSchema, type Skill, type SkillFrontmatter } from "./schema";

/** Skill storage: repo skills come from files; imports and owner overrides live in the database. */

export async function loadAllSkills(db: Queryable, repo: Skill[]): Promise<Skill[]> {
  const { rows } = await db.query<{
    slug: string;
    source: string;
    frontmatter: unknown;
    body: string;
    refs: { name: string; text: string }[];
  }>("select slug, source, frontmatter, body, refs from skills order by slug");
  const overrides = new Map(
    rows
      .filter((r) => r.source === "override")
      .map((r) => [r.slug, r.frontmatter as Partial<SkillFrontmatter>]),
  );
  const out: Skill[] = repo.map((s) => {
    const o = overrides.get(s.fm.slug);
    return o ? { ...s, fm: { ...s.fm, ...pick(o) } } : s;
  });
  const repoSlugs = new Set(repo.map((s) => s.fm.slug));
  for (const r of rows) {
    if (r.source !== "import" || repoSlugs.has(r.slug)) continue;
    const fm = skillFrontmatterSchema.safeParse(r.frontmatter);
    if (fm.success)
      out.push({ fm: fm.data, body: r.body, references: r.refs ?? [], source: "import" });
  }
  return out;
}

/** Only risk and enabled can be overridden from the owner's UI. */
function pick(o: Partial<SkillFrontmatter>): Partial<SkillFrontmatter> {
  const p: Partial<SkillFrontmatter> = {};
  if (o.risk === "high" || o.risk === "standard") p.risk = o.risk;
  if (typeof o.enabled === "boolean") p.enabled = o.enabled;
  return p;
}

export type ImportOutcome = {
  slug: string;
  status: "imported" | "updated" | "built_in";
  warnings: string[];
};

export async function saveImportedSkill(
  db: Queryable,
  skill: Skill & { warnings?: string[] },
  repoSlugs: Set<string>,
): Promise<ImportOutcome> {
  const slug = skill.fm.slug;
  if (repoSlugs.has(slug))
    return {
      slug,
      status: "built_in",
      warnings: [
        "a curated built-in skill with this name already exists; kept the built-in version",
      ],
    };
  const r = await db.query<{ inserted: boolean }>(
    `insert into skills (slug, source, frontmatter, body, refs) values ($1, 'import', $2, $3, $4)
     on conflict (slug) do update set frontmatter = excluded.frontmatter, body = excluded.body, refs = excluded.refs, updated_at = now()
     returning (xmax = 0) as inserted`,
    [slug, skill.fm, skill.body, JSON.stringify(skill.references)],
  );
  await audit(db, {
    actor: "owner",
    action: "skills.import",
    target: `skill:${slug}`,
    inputs: skill.fm,
    result: skill.fm.risk,
  });
  return {
    slug,
    status: r.rows[0]?.inserted ? "imported" : "updated",
    warnings: skill.warnings ?? [],
  };
}

export async function setSkillSettings(
  db: Queryable,
  slug: string,
  patch: { risk?: "standard" | "high"; enabled?: boolean },
  isRepo: boolean,
): Promise<void> {
  if (isRepo) {
    await db.query(
      `insert into skills (slug, source, frontmatter) values ($1, 'override', $2)
       on conflict (slug) do update set frontmatter = skills.frontmatter || excluded.frontmatter, updated_at = now()`,
      [slug, patch],
    );
  } else {
    await db.query(
      "update skills set frontmatter = frontmatter || $2::jsonb, updated_at = now() where slug = $1 and source = 'import'",
      [slug, JSON.stringify(patch)],
    );
  }
  await audit(db, {
    actor: "owner",
    action: "skills.settings",
    target: `skill:${slug}`,
    inputs: patch,
    result: "ok",
  });
}

export async function deleteImportedSkill(db: Queryable, slug: string): Promise<void> {
  await db.query("delete from skills where slug = $1 and source = 'import'", [slug]);
  await audit(db, {
    actor: "owner",
    action: "skills.delete",
    target: `skill:${slug}`,
    result: "ok",
  });
}

// ───────────── runs ─────────────

export interface SkillRunRow {
  id: string;
  task_id: string | null;
  slug: string;
  request: string;
  output: string | null;
  status: "queued" | "running" | "done" | "failed";
  channel: "web" | "telegram";
  simulated: boolean;
  cost_aud: string;
  error: string | null;
  created_at: Date;
  finished_at: Date | null;
}

export async function createRun(
  db: Queryable,
  r: { slug: string; request: string; channel: "web" | "telegram" },
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    "insert into skill_runs (slug, request, channel) values ($1, $2, $3) returning id",
    [r.slug, r.request, r.channel],
  );
  return rows[0]!.id;
}

export async function attachRunTask(db: Queryable, runId: string, taskId: string) {
  await db.query("update skill_runs set task_id = $2 where id = $1", [runId, taskId]);
}

export async function finishRun(
  db: Queryable,
  runId: string,
  r: { output?: string; error?: string; costAud?: number; simulated?: boolean },
) {
  await db.query(
    `update skill_runs set status = $2, output = coalesce($3, output), error = $4, cost_aud = cost_aud + $5,
       simulated = $6, finished_at = now() where id = $1`,
    [
      runId,
      r.error ? "failed" : "done",
      r.output ?? null,
      r.error ?? null,
      r.costAud ?? 0,
      Boolean(r.simulated),
    ],
  );
}

export async function listRuns(db: Queryable, limit = 30): Promise<SkillRunRow[]> {
  const { rows } = await db.query<SkillRunRow>(
    "select * from skill_runs order by created_at desc limit $1",
    [limit],
  );
  return rows;
}

export async function getRun(db: Queryable, id: string): Promise<SkillRunRow | undefined> {
  const { rows } = await db.query<SkillRunRow>("select * from skill_runs where id = $1", [id]);
  return rows[0];
}
