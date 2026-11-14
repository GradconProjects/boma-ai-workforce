import { parse as parseYaml } from "yaml";
import {
  skillFrontmatterSchema,
  type Skill,
  type SkillFrontmatter,
  type SkillReference,
} from "./schema";
import { readZip } from "./zip";

/**
 * Turn any uploaded skill file (.md with or without frontmatter, or a .skill/.zip package)
 * into a Skill. Metadata the file doesn't provide is inferred: category, risk level, triggers
 * (quoted phrases in the description) and keywords.
 */

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/\.(md|skill|zip)$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "skill";

interface RiskRule {
  category: SkillFrontmatter["category"];
  risk: "standard" | "high";
  safety: SkillFrontmatter["safety"];
  re: RegExp;
}

/**
 * Order matters: the first match wins. These only produce a *suggestion*: every import starts
 * as standard risk and the owner labels high-risk skills himself.
 */
const RULES: RiskRule[] = [
  // Strategy tools stay standard even though they discuss legal disputes (owner's decision).
  {
    category: "strategy",
    risk: "standard",
    safety: ["lawful_only"],
    re: /\b(tactician|tacticians|opposer|council|board of directors|advisory board)/i,
  },
  {
    category: "medical",
    risk: "high",
    safety: ["medical_information"],
    re: /\b(medic(ine|al)|prescri|herbal|symptom|diagnos|dosage|clinical|natural remed|patient|triage)/i,
  },
  {
    category: "finance",
    risk: "high",
    safety: ["financial_information"],
    re: /\b(trading|trader|crypto|futures|forex|bybit|binance|kelly criterion|stock pick|investment advice|leverage|signals?\b)/i,
  },
  {
    category: "tax",
    risk: "high",
    safety: ["tax_information"],
    re: /\b(tax return|\bato\b|tax matters|deduction|lodg(e|ement))/i,
  },
  {
    category: "legal",
    risk: "high",
    safety: ["legal_information"],
    re: /\b(court|tribunal|litigation|legal guide|lawyer|solicitor|worksafe|visa|immigration|appeal|vcat)/i,
  },
  {
    category: "personal",
    risk: "high",
    safety: ["personal_data"],
    re: /\b(application master|applicant|resume|cv\b|cover letter|profile\.md|personal profile|candidate profile)/i,
  },
  {
    category: "academic",
    risk: "standard",
    safety: ["academic_integrity"],
    re: /\b(assessment|assignment|rubric|academic|university|deakin|exam coach|apa ?7|referenc)/i,
  },
  {
    category: "construction",
    risk: "standard",
    safety: [],
    re: /\b(estimat|quantity survey|construction|tender|aiqs|boq|site)/i,
  },
  {
    category: "marketing",
    risk: "standard",
    safety: ["no_fabricated_facts"],
    re: /\b(marketing|social media|content|youtube|tiktok|ad(vert)?s?\b|campaign|brand|channel)/i,
  },
  {
    category: "development",
    risk: "standard",
    safety: [],
    re: /\b(website|frontend|full[- ]stack|app\b|react|next\.js|ui\b|ux\b|code)/i,
  },
  {
    category: "strategy",
    risk: "standard",
    safety: [],
    re: /\b(strateg|board|council|opposer|tactic|business)/i,
  },
];

const STOP = new Set(
  "the and for with this that from your into when what will have their they them then than about after before over under also only very most more such each every other any use using used skill user users".split(
    " ",
  ),
);

function extractTriggers(description: string): string[] {
  const quoted = [...description.matchAll(/["“]([^"”]{2,80})["”]/g)].map((m) =>
    m[1]!.trim().toLowerCase(),
  );
  return [...new Set(quoted)].slice(0, 40);
}

function extractKeywords(text: string): string[] {
  const counts = new Map<string, number>();
  for (const w of text.toLowerCase().match(/[a-z][a-z0-9-]{3,}/g) ?? []) {
    if (STOP.has(w)) continue;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([w]) => w);
}

function firstParagraph(body: string): string {
  const para = body
    .split(/\n\s*\n/)
    .map((p) => p.replace(/^#+\s.*$/gm, "").trim())
    .find((p) => p.length > 40);
  return (para ?? body.slice(0, 300)).replace(/\s+/g, " ").slice(0, 600);
}

export interface ParsedSkill extends Skill {
  warnings: string[];
}

/** Parse one SKILL.md-style text. `fallbackName` comes from the file name. */
export function parseSkillText(
  text: string,
  fallbackName: string,
  extraRefs: SkillReference[] = [],
): ParsedSkill {
  const warnings: string[] = [];
  const m = FM_RE.exec(text);
  let meta: Record<string, unknown> = {};
  let body = text;
  if (m) {
    try {
      meta = (parseYaml(m[1] ?? "") as Record<string, unknown>) ?? {};
    } catch {
      warnings.push("frontmatter could not be read; metadata inferred");
    }
    body = m[2] ?? "";
  }
  const name = String(meta.name ?? fallbackName)
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  const description = String(meta.description ?? firstParagraph(body))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1200);
  const haystack = `${name} ${description}`;
  const rule = RULES.find((r) => r.re.test(haystack));
  const fm = skillFrontmatterSchema.parse({
    slug: slugify(String(meta.slug ?? meta.name ?? fallbackName)),
    name: name || fallbackName,
    category: rule?.category ?? "general",
    description: description.length >= 10 ? description : `${name}: imported skill`,
    triggers: extractTriggers(description),
    keywords: extractKeywords(`${name} ${description}`),
    model: "planner",
    max_output_tokens: 8000,
    review: false,
    safety: rule?.safety ?? [],
    references: ["original.md", ...extraRefs.map((r) => r.name)],
    risk: "standard",
    suggested_risk: rule?.risk ?? "standard",
    suggested_reason: rule?.risk === "high" ? `looks like a ${rule.category} skill` : undefined,
    enabled: true,
  });
  if (!fm.triggers.length)
    warnings.push(
      "no trigger phrases found; it will be matched by keywords and the Chief's judgement",
    );
  return {
    fm,
    // Imported skills keep their full original text as the reference; the body is a short
    // generalised instruction so the original's specifics are treated as examples.
    body: `# ${fm.name}\n\n${fm.description}\n\nApply the method in the reference material to the owner's actual request.`,
    references: [{ name: "original.md", text }, ...extraRefs],
    source: "import",
    warnings,
  };
}

/** Parse an uploaded file: .md / .txt text, or a .skill / .zip package containing SKILL.md. */
export function parseSkillFile(filename: string, data: Buffer): ParsedSkill {
  const base = filename.split(/[\\/]/).pop() ?? filename;
  const isZip = data.length > 4 && data.readUInt32LE(0) === 0x04034b50;
  if (!isZip) return parseSkillText(data.toString("utf8"), base.replace(/\.[^.]+$/, ""));

  const entries = readZip(data).filter((e) => /\.(md|txt)$/i.test(e.name));
  const main =
    entries.find((e) => /(^|\/)SKILL\.md$/i.test(e.name)) ??
    entries.find((e) => /\.md$/i.test(e.name));
  if (!main) throw new Error(`${base}: no SKILL.md inside the package`);
  const refs = entries
    .filter((e) => e !== main)
    .map((e) => ({ name: e.name.split("/").pop()!, text: e.data.toString("utf8") }))
    .slice(0, 30);
  return parseSkillText(main.data.toString("utf8"), base.replace(/\.[^.]+$/, ""), refs);
}
