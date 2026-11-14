import { z } from "zod";

export const classifySchema = z.object({
  intent: z.enum(["new_job", "question", "control", "bot_edit", "approval", "unclear"]),
  clarifying_question: z.string().nullable(),
  control: z.enum(["pause_all", "resume", "status", "budget", "approvals", "bots"]).nullable(),
  summary: z.string(),
  /** Slug of a library skill that fits the request, if any (validated against the catalogue in code). */
  skill: z.string().nullable().optional(),
});
export type Classification = z.infer<typeof classifySchema>;

/** Task kinds the Chief can dispatch in this release. */
export const DISPATCHABLE_KINDS = ["draft_post", "skill_run"] as const;

export const planSchema = z.object({
  reply: z.string(),
  tasks: z.array(
    z.object({
      kind: z.enum(DISPATCHABLE_KINDS),
      workspace: z.string(),
      brief: z.string(),
      scheduled_for: z.string().nullable(),
      /** skill_run only: which library skill. */
      skill: z.string().nullable().optional(),
      /** Index of an earlier skill_run task in this plan whose answer this task builds on. */
      uses_output_of: z.number().int().nullable().optional(),
    }),
  ),
  /** Parts of the request no available bot can do yet. */
  unsupported: z.array(z.string()),
  /** New workspaces (businesses, pages, projects) the owner asked for by name. */
  new_workspaces: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        /** bold when he wants drama, controversy, debate or rapid growth. */
        style: z.enum(["standard", "bold"]).nullable().optional(),
      }),
    )
    .optional()
    .default([]),
  /** Any request to change a bot's permissions, tools, accounts, autonomy or budget. */
  permission_changes_requested: z.array(z.string()),
});
export type Plan = z.infer<typeof planSchema>;

export const answerSchema = z.object({ answer: z.string() });
