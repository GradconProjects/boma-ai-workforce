import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { skillFrontmatterSchema, type Skill } from "./schema";

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

/** Load the curated skills shipped in the repo (skills/<slug>/SKILL.md + skills/_reference). */
export function loadRepoSkills(dir: string): Skill[] {
  if (!existsSync(/*turbopackIgnore: true*/ dir)) return [];
  const refDir = join(/*turbopackIgnore: true*/ dir, "_reference");
  const out: Skill[] = [];
  for (const entry of readdirSync(/*turbopackIgnore: true*/ dir).sort()) {
    if (entry.startsWith("_") || entry.startsWith(".")) continue;
    const file = join(/*turbopackIgnore: true*/ dir, entry, "SKILL.md");
    if (!existsSync(/*turbopackIgnore: true*/ file)) continue;
    const raw = readFileSync(/*turbopackIgnore: true*/ file, "utf8");
    const m = FM_RE.exec(raw);
    if (!m) throw new Error(`${file}: missing frontmatter`);
    const fm = skillFrontmatterSchema.parse(parseYaml(m[1]!));
    if (fm.slug !== entry)
      throw new Error(`${file}: slug "${fm.slug}" must match folder "${entry}"`);
    const references = fm.references.map((name) => {
      const p = join(/*turbopackIgnore: true*/ refDir, name);
      if (!existsSync(/*turbopackIgnore: true*/ p))
        throw new Error(`${file}: reference ${name} not found in skills/_reference`);
      return { name, text: readFileSync(/*turbopackIgnore: true*/ p, "utf8") };
    });
    out.push({ fm, body: (m[2] ?? "").trim(), references, source: "repo" });
  }
  return out;
}
