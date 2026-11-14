import { z } from "zod";

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

export const issueSchema = z.object({
  id: z.string(),
  severity: z.enum(["critical", "major", "minor"]),
  category: z.enum(ISSUE_CATEGORIES),
  location: z.string(),
  problem: z.string(),
  fix: z.string(),
});
export type Issue = z.infer<typeof issueSchema>;

/** Checker verdict (spec 02 §5). */
export const verdictSchema = z.object({
  verdict: z.enum(["pass", "revise", "fail"]),
  score: z.number().int().min(0).max(100),
  issues: z.array(issueSchema),
  claims_checked: z.array(
    z.object({ claim: z.string(), supported: z.boolean(), source: z.string().nullable() }),
  ),
  injection_detected: z.boolean(),
  summary: z.string(),
});
export type Verdict = z.infer<typeof verdictSchema>;
