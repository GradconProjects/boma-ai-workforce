import { z } from "zod";
import { withWireSchema } from "@boma/llm";

/** What a maker returns: the output plus every factual claim with its source (spec 02 §4.2). */
export const makerOutputSchema = z.object({
  text: z.string().min(1),
  claims: z.array(
    z.object({
      claim: z.string(),
      /** Claim-register ID (e.g. "C1") or a URL from the provided sources. */
      source: z.string(),
    }),
  ),
});
export type MakerOutput = z.infer<typeof makerOutputSchema>;

export const ISSUE_CATEGORIES = [
  "accuracy",
  "unsupported_claim",
  "compliance",
  "brand",
  "injection",
  "privacy",
  "wrong_target",
  "quality",
] as const;

// The strict shape the checker is asked to return (sent to the model as JSON Schema).
const issueWireSchema = z.object({
  id: z.string(),
  severity: z.enum(["critical", "major", "minor"]),
  category: z.enum(ISSUE_CATEGORIES),
  location: z.string(),
  problem: z.string(),
  fix: z.string(),
});
const verdictWireSchema = z.object({
  verdict: z.enum(["pass", "revise", "fail"]),
  score: z.number().int().min(0).max(100),
  issues: z.array(issueWireSchema),
  claims_checked: z.array(
    z.object({ claim: z.string(), supported: z.boolean(), source: z.string().nullable() }),
  ),
  injection_detected: z.boolean(),
  summary: z.string(),
});

const SEVERITY_ALIASES: Record<string, "critical" | "major" | "minor"> = {
  critical: "critical",
  blocker: "critical",
  severe: "critical",
  high: "major",
  major: "major",
  medium: "major", // a middling finding counts as major, never minor
  moderate: "major",
  minor: "minor",
  low: "minor",
  trivial: "minor",
};
const lower = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase() : v);

export const issueSchema = z.object({
  id: z.preprocess((v) => (v == null ? "" : String(v)), z.string()),
  // Unknown severities are treated as major (stricter than minor).
  severity: z.preprocess(
    (v) => SEVERITY_ALIASES[String(lower(v))] ?? "major",
    z.enum(["critical", "major", "minor"]),
  ),
  category: z.preprocess((v) => {
    const c = String(lower(v)).replace(/[\s-]+/g, "_");
    return (ISSUE_CATEGORIES as readonly string[]).includes(c) ? c : "quality";
  }, z.enum(ISSUE_CATEGORIES)),
  location: z.preprocess((v) => (v == null ? "" : String(v)), z.string()),
  problem: z.string(),
  fix: z.preprocess((v) => (v == null ? "" : String(v)), z.string()),
});
export type Issue = z.infer<typeof issueSchema>;

/** Checker verdict (spec 02 §5). */
export const verdictSchema = withWireSchema(
  z.object({
    verdict: z.preprocess(lower, z.enum(["pass", "revise", "fail"])),
    score: z.preprocess(
      (v) => (typeof v === "string" ? Number(v) : v),
      z
        .number()
        .min(0)
        .max(100)
        .transform((n) => Math.round(n)),
    ),
    issues: z.array(issueSchema),
    claims_checked: z.array(
      z.object({
        claim: z.string(),
        supported: z.boolean(),
        source: z.preprocess((v) => (v === undefined ? null : v), z.string().nullable()),
      }),
    ),
    injection_detected: z.boolean(),
    summary: z.string(),
  }),
  verdictWireSchema,
);
export type Verdict = z.infer<typeof verdictSchema>;
