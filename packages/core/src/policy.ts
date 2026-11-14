import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { z } from "zod";

export const autonomyLevel = z.number().int().min(1).max(5);
export type AutonomyLevel = z.infer<typeof autonomyLevel>;

/** Max level a protected action may have without an owner unlock (spec §8). */
export const PROTECTED_ACTION_CAP = 3;

export const policySchema = z
  .object({
    autonomy_levels: z.record(z.string(), z.string()),
    defaults: z.object({
      new_action_level: autonomyLevel,
      external_action_level: autonomyLevel,
    }),
    protected_actions: z.array(z.string().regex(/^[a-z_]+$/)).min(1),
    approvals: z.object({
      expire_after_scheduled_hours: z.number().positive(),
      expire_unscheduled_hours: z.number().positive(),
      owner_telegram_user_id_env: z.string(),
    }),
    dual_review: z.object({
      required_for: z.array(z.string()),
      max_revision_rounds: z.number().int().min(0).max(5),
      makers_and_checkers_must_differ_by_provider: z.boolean(),
    }),
    budget: z.object({
      currency: z.literal("AUD"),
      company_monthly_cap: z.number().positive(),
      warn_at: z.number().positive(),
      hard_stop_at: z.number().positive(),
      /** Absolute ceiling the cap must stay below (A$50). */
      safety_buffer_below: z.number().positive(),
      allocations: z.record(z.string(), z.number().min(0)),
    }),
    system: z.object({
      timezone: z.string(),
      kill_switch_command: z.string().startsWith("/"),
    }),
  })
  .superRefine((p, ctx) => {
    const b = p.budget;
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: "custom", path, message });

    if (b.warn_at >= b.hard_stop_at) issue(["budget", "warn_at"], "must be below hard_stop_at");
    if (b.hard_stop_at > b.company_monthly_cap)
      issue(["budget", "hard_stop_at"], "must not exceed company_monthly_cap");
    if (b.company_monthly_cap >= b.safety_buffer_below)
      issue(["budget", "company_monthly_cap"], "must be below safety_buffer_below");
    const allocated = Object.values(b.allocations).reduce((a, n) => a + n, 0);
    if (allocated > b.company_monthly_cap)
      issue(
        ["budget", "allocations"],
        `allocations total A$${allocated} exceeds company cap A$${b.company_monthly_cap}`,
      );
    if (p.defaults.external_action_level > PROTECTED_ACTION_CAP)
      issue(["defaults", "external_action_level"], `must be ≤ ${PROTECTED_ACTION_CAP}`);
    if (!p.dual_review.makers_and_checkers_must_differ_by_provider)
      issue(["dual_review"], "maker/checker provider separation cannot be disabled (spec 02 §2)");
  });

export type Policy = z.infer<typeof policySchema>;

export function parsePolicy(yamlText: string): Policy {
  return policySchema.parse(parse(yamlText));
}

export function loadPolicy(path = "config/policy.yaml"): Policy {
  return parsePolicy(readFileSync(/*turbopackIgnore: true*/ path, "utf8"));
}
