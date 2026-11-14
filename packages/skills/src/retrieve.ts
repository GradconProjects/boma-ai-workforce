import type { SkillReference } from "./schema";

/**
 * Pick the reference sections most relevant to a request, within a character budget, so a large
 * skill library doesn't blow the token budget. Sections are split on Markdown headings.
 */
export interface Section {
  ref: string;
  heading: string;
  text: string;
}

export function splitSections(ref: SkillReference, maxLen = 6000): Section[] {
  const lines = ref.text.split("\n");
  const sections: Section[] = [];
  let heading = ref.name;
  let buf: string[] = [];
  const flush = () => {
    const text = buf.join("\n").trim();
    if (text) {
      for (let i = 0; i < text.length; i += maxLen)
        sections.push({ ref: ref.name, heading, text: text.slice(i, i + maxLen) });
    }
    buf = [];
  };
  for (const line of lines) {
    if (/^#{1,3}\s/.test(line)) {
      flush();
      heading = line.replace(/^#+\s*/, "").slice(0, 120);
    }
    buf.push(line);
  }
  flush();
  return sections;
}

const terms = (s: string) => new Set(s.toLowerCase().match(/[a-z][a-z0-9]{2,}/g) ?? []);

export function selectSections(
  refs: SkillReference[],
  request: string,
  budgetChars = 24_000,
): Section[] {
  const all = refs.flatMap((r) => splitSections(r));
  const total = all.reduce((n, s) => n + s.text.length, 0);
  if (total <= budgetChars) return all; // small skill: send everything
  const q = terms(request);
  const scored = all.map((s, i) => {
    const t = s.text.toLowerCase();
    let score = 0;
    for (const w of q) if (t.includes(w)) score += s.heading.toLowerCase().includes(w) ? 3 : 1;
    // Opening sections usually hold the core method: keep a small preference for them.
    if (i < 3) score += 2;
    return { s, score, i };
  });
  const picked: { s: Section; i: number }[] = [];
  let used = 0;
  for (const x of scored.sort((a, b) => b.score - a.score)) {
    if (used + x.s.text.length > budgetChars) continue;
    picked.push(x);
    used += x.s.text.length;
  }
  return picked.sort((a, b) => a.i - b.i).map((x) => x.s); // keep original order
}
