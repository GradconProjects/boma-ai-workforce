import type { Copy } from "@boma/design-engine";

/**
 * Creative copy travels through the dual review as labelled plain text, so the checker reviews
 * exactly what will appear on the design. These helpers write and read that format.
 */
export const COPY_FIELDS = ["eyebrow", "headline", "subhead", "body", "cta"] as const;

export function formatCopy(c: Copy): string {
  return COPY_FIELDS.filter((k) => c[k])
    .map((k) => `${k.toUpperCase()}: ${c[k]}`)
    .join("\n");
}

export function parseCopy(text: string): Copy {
  const out: Copy = {};
  let current: (typeof COPY_FIELDS)[number] | null = null;
  for (const raw of text.split("\n")) {
    const m = /^\s*(EYEBROW|HEADLINE|SUBHEAD|BODY|CTA)\s*:\s*(.*)$/i.exec(raw);
    if (m) {
      current = m[1]!.toLowerCase() as (typeof COPY_FIELDS)[number];
      out[current] = m[2]!.trim();
    } else if (current && raw.trim()) {
      out[current] = `${out[current] ?? ""} ${raw.trim()}`.trim();
    }
  }
  return out;
}

/** Length limits per field so copy fits the templates (characters). */
export const COPY_LIMITS: Record<(typeof COPY_FIELDS)[number], number> = {
  eyebrow: 32,
  headline: 60,
  subhead: 120,
  body: 220,
  cta: 24,
};

export function copyProblems(c: Copy): string[] {
  const problems: string[] = [];
  if (!c.headline) problems.push("HEADLINE is missing");
  if (!c.cta) problems.push("CTA is missing");
  for (const k of COPY_FIELDS) {
    const v = c[k];
    if (v && v.length > COPY_LIMITS[k])
      problems.push(`${k.toUpperCase()} is ${v.length} characters; the limit is ${COPY_LIMITS[k]}`);
  }
  return problems;
}
