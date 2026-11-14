import type { Issue, MakerOutput } from "./schemas";

/**
 * Deterministic pre-checks (spec 02 §4.1): free, run before any checker spend.
 * Failures go straight back to the maker with the exact errors.
 */

export interface BannedPattern {
  pattern: string;
  reason: string;
}

export interface ClaimRegisterEntry {
  id: string;
  claim: string;
  source: string;
}

export interface PrecheckConfig {
  maxChars: number;
  bannedPatterns: BannedPattern[];
  claimRegister: ClaimRegisterEntry[];
  /** URLs present in the task's sources; claims may cite these too. */
  sourceUrls?: string[];
}

export function precheck(out: MakerOutput, cfg: PrecheckConfig): Issue[] {
  const issues: Issue[] = [];
  const add = (i: Omit<Issue, "id">) => issues.push({ id: `P${issues.length + 1}`, ...i });
  const text = out.text.trim();

  if (!text)
    add({
      severity: "critical",
      category: "quality",
      location: "text",
      problem: "Output is empty.",
      fix: "Write the requested content.",
    });
  if (text.length > cfg.maxChars) {
    add({
      severity: "major",
      category: "quality",
      location: "text",
      problem: `Output is ${text.length} characters; the limit is ${cfg.maxChars}.`,
      fix: `Shorten to at most ${cfg.maxChars} characters.`,
    });
  }

  for (const b of cfg.bannedPatterns) {
    const m = new RegExp(b.pattern, "i").exec(text);
    if (m) {
      add({
        severity: "critical",
        category: "compliance",
        location: m[0],
        problem: `Breaks a workspace rule: ${b.reason}`,
        fix: "Remove or rephrase this statement so it complies with the workspace rules.",
      });
    }
  }

  const registerIds = new Set(cfg.claimRegister.map((c) => c.id));
  const urls = new Set(cfg.sourceUrls ?? []);
  for (const c of out.claims) {
    if (!registerIds.has(c.source) && !urls.has(c.source)) {
      add({
        severity: "major",
        category: "unsupported_claim",
        location: c.claim,
        problem: `Claim cites "${c.source}", which is not in the claim register or the provided sources.`,
        fix: "Remove the claim or support it with a claim-register ID or a provided source.",
      });
    }
  }

  for (const link of text.match(/\bhttps?:\/\/\S+/gi) ?? []) {
    if (!link.startsWith("https://")) {
      add({
        severity: "minor",
        category: "quality",
        location: link,
        problem: "Link is not HTTPS.",
        fix: "Use an https:// link.",
      });
    }
  }
  return issues;
}
