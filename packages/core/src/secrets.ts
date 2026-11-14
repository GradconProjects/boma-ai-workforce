/**
 * Secret detection shared by the bot security lint and the repo secret scan (G0.5).
 * Patterns target real credential shapes; empty `KEY=` lines in .env.example never match.
 */
export interface SecretPattern {
  name: string;
  re: RegExp;
}

export const SECRET_PATTERNS: SecretPattern[] = [
  { name: "anthropic_api_key", re: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: "openai_api_key", re: /sk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{32,}/ },
  { name: "telegram_bot_token", re: /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/ },
  { name: "facebook_access_token", re: /\bEAA[A-Za-z0-9]{40,}/ },
  { name: "jwt", re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { name: "private_key_block", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "github_token", re: /\bgh[pousr]_[A-Za-z0-9]{36,}/ },
  { name: "aws_access_key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  // Connection string with an inline password, ignoring local-dev hosts.
  {
    name: "db_url_with_password",
    re: /postgres(?:ql)?:\/\/[^:\s/]+:[^@\s]{6,}@(?!localhost|127\.0\.0\.1)/,
  },
  // A long opaque value assigned to a secret-looking name: api_key: "...", TOKEN=...
  {
    name: "generic_secret_assignment",
    re: /\b[A-Za-z_]*(?:SECRET|TOKEN|API_KEY|PASSWORD|PRIVATE_KEY)[A-Za-z_]*\s*[:=]\s*["']?[A-Za-z0-9+/_.-]{24,}/i,
  },
];

export interface SecretFinding {
  pattern: string;
  line: number;
}

/** Returns pattern names and line numbers only — never the matched value. */
export function findSecrets(text: string): SecretFinding[] {
  const findings: SecretFinding[] = [];
  text.split(/\r?\n/).forEach((line, i) => {
    for (const p of SECRET_PATTERNS) {
      if (p.re.test(line)) findings.push({ pattern: p.name, line: i + 1 });
    }
  });
  return findings;
}

/** Replace secret-shaped substrings, for safe logging of errors. */
export function redact(text: string): string {
  let out = text;
  for (const p of SECRET_PATTERNS) {
    out = out.replace(new RegExp(p.re.source, p.re.flags + "g"), `[REDACTED:${p.name}]`);
  }
  return out;
}
