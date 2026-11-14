import { z } from "zod";
import { autonomyLevel } from "@boma/core";

export const PROVIDERS = ["anthropic", "openai", "deepseek"] as const;
export const DEPARTMENTS = [
  "marketing",
  "creative",
  "engineering",
  "business",
  "personal-ops",
  "intelligence",
  "command",
] as const;

const slug = z.string().regex(/^[a-z0-9-]+$/, "lowercase letters, digits and hyphens only");
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "must be HH:MM (24h)");
const cron = z
  .string()
  .regex(/^(\S+\s+){4}\S+$/, "must be a 5-field cron expression (Australia/Sydney time)");

export const modelRef = z
  .object({
    provider: z.enum(PROVIDERS),
    model_env: z.string().regex(/^[A-Z][A-Z0-9_]*$/, "must name an env key, not a model ID"),
  })
  .strict();

/**
 * Model roles. `maker` produces, `checker` reviews, `planner` is an optional stronger maker
 * used for multi-step planning/drafting (Chief of Staff). Any non-checker role counts as a
 * maker for the provider-separation rule.
 */
export const MODEL_ROLES = ["maker", "planner", "checker"] as const;

export const botFrontmatterSchema = z
  .object({
    slug,
    name: z.string().min(1),
    department: z.enum(DEPARTMENTS),
    enabled: z.boolean(),
    purpose: z.string().min(1),
    workspaces: z.array(slug).min(1),
    reports_to: z.union([z.literal("owner"), slug]),
    models: z
      .object({ maker: modelRef.optional(), planner: modelRef.optional(), checker: modelRef.optional() })
      .strict(),
    review: z.enum(["required", "optional", "off"]),
    tools: z.array(z.string()),
    accounts: z.array(slug),
    triggers: z
      .object({
        schedule: z.array(cron).default([]),
        events: z.array(z.string().regex(/^[a-z_]+\.[a-z_]+$/)).default([]),
        owner_message: z.boolean(),
      })
      .strict(),
    actions: z.record(z.string().regex(/^[a-z_]+$/), autonomyLevel),
    budget: z
      .object({
        monthly_aud: z.number().min(0),
        max_task_aud: z.number().min(0),
        max_concurrency: z.number().int().min(1).max(10),
        max_retries: z.number().int().min(0).max(5),
      })
      .strict(),
    memory: z
      .object({ scope: z.array(z.enum(["bot", "workspace", "owner-profile"])) })
      .strict(),
    // Publisher-specific settings (optional for other bots).
    posting_window: z
      .object({ start: hhmm, end: hhmm, tz: z.string().min(1) })
      .strict()
      .optional(),
    daily_post_limit: z.number().int().min(1).max(50).optional(),
  })
  .strict();

export type BotFrontmatter = z.infer<typeof botFrontmatterSchema>;

export interface BotDefinition {
  frontmatter: BotFrontmatter;
  instructions: string;
  raw: string;
  fileSha: string;
  path: string;
}
