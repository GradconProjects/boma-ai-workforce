import type { Skill } from "./schema";

/**
 * Deterministic skill matching. A trigger phrase found in the request is a strong match; shared
 * keywords are weak evidence. The Chief combines this with its own classification.
 */
export interface SkillMatch {
  slug: string;
  score: number;
  strong: boolean;
  reason: string;
}

const norm = (s: string) =>
  ` ${s
    .toLowerCase()
    .replace(/[^a-z0-9#+ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;

export function matchSkills(request: string, skills: Skill[], limit = 3): SkillMatch[] {
  const text = norm(request);
  const words = new Set(text.trim().split(" "));
  const out: SkillMatch[] = [];
  for (const s of skills) {
    if (!s.fm.enabled) continue;
    const trigger = s.fm.triggers.find((t) => text.includes(norm(t)));
    let score = trigger ? 10 + norm(trigger).length / 10 : 0;
    const hits = s.fm.keywords.filter((k) =>
      k.includes(" ") ? text.includes(norm(k)) : words.has(k.toLowerCase()),
    );
    score += hits.length * 1.5;
    if (text.includes(norm(s.fm.name))) score += 8;
    if (score > 0) {
      out.push({
        slug: s.fm.slug,
        score,
        strong: Boolean(trigger) || text.includes(norm(s.fm.name)) || hits.length >= 3,
        reason: trigger
          ? `trigger "${trigger}"`
          : hits.length
            ? `keywords: ${hits.slice(0, 4).join(", ")}`
            : "name",
      });
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}
