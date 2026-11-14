import { z } from "zod";

/**
 * A skill: a reusable method the Chief applies when a request matches it. Repo skills live in
 * skills/<slug>/SKILL.md; owner-imported skills live in the database.
 */
export const SKILL_CATEGORIES = [
  "strategy",
  "critical-review",
  "academic",
  "marketing",
  "production",
  "legal",
  "medical",
  "finance",
  "tax",
  "careers",
  "construction",
  "development",
  "personal",
  "general",
] as const;

export const SAFETY_TAGS = [
  "illustrative_personas",
  "legal_information",
  "medical_information",
  "financial_information",
  "tax_information",
  "academic_integrity",
  "lawful_only",
  "no_fabricated_facts",
  "original_work_only",
  "budget_first",
  "personal_data",
] as const;

export const skillFrontmatterSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(80),
  category: z.enum(SKILL_CATEGORIES).default("general"),
  description: z.string().min(10).max(1200),
  triggers: z.array(z.string().min(2).max(120)).max(60).default([]),
  keywords: z.array(z.string().min(2).max(60)).max(60).default([]),
  model: z.enum(["planner", "cheap"]).default("planner"),
  max_output_tokens: z.number().int().min(500).max(16000).default(6000),
  review: z.boolean().default(false),
  safety: z.array(z.enum(SAFETY_TAGS)).default([]),
  references: z.array(z.string()).default([]),
  /** high = locked behind the owner's skills passcode. */
  risk: z.enum(["standard", "high"]).default("standard"),
  /** The importer's hint only. The owner decides the actual `risk` label. */
  suggested_risk: z.enum(["standard", "high"]).optional(),
  suggested_reason: z.string().max(120).optional(),
  enabled: z.boolean().default(true),
});
export type SkillFrontmatter = z.infer<typeof skillFrontmatterSchema>;

export interface SkillReference {
  name: string;
  text: string;
}

export interface Skill {
  fm: SkillFrontmatter;
  body: string;
  references: SkillReference[];
  source: "repo" | "import";
}
