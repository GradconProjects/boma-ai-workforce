/**
 * G0.5 — fail if any tracked (or about-to-be-tracked) file contains a secret.
 * Prints file, line and pattern name only; never the matched value.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { findSecrets } from "../packages/core/src/secrets";

const SKIP = [/^pnpm-lock\.yaml$/, /(^|\/)node_modules\//, /\.(png|jpe?g|gif|webp|ico|pdf|zip)$/i];

export function filesToScan(): string[] {
  const out = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
    encoding: "utf8",
  });
  return out
    .split("\n")
    .filter(Boolean)
    .filter((f) => !SKIP.some((re) => re.test(f)));
}

export function scan(files: string[]): string[] {
  const hits: string[] = [];
  for (const file of files) {
    let text: string;
    try {
      if (statSync(file).size > 2_000_000) continue;
      text = readFileSync(file, "utf8");
    } catch {
      continue; // deleted in working tree
    }
    for (const f of findSecrets(text)) hits.push(`${file}:${f.line}  ${f.pattern}`);
  }
  return hits;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = filesToScan();
  const hits = scan(files);
  if (hits.length) {
    console.error(`✗ Possible secrets found:\n  ${hits.join("\n  ")}`);
    process.exitCode = 1;
  } else {
    console.log(`✓ No secrets found in ${files.length} files.`);
  }
}
