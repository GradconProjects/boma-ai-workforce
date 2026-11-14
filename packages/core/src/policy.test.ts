import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse, stringify } from "yaml";
import { parsePolicy } from "./policy";

const text = readFileSync(new URL("../../../config/policy.yaml", import.meta.url), "utf8");

function withChange(mutate: (p: Record<string, any>) => void): string {
  const p = parse(text);
  mutate(p);
  return stringify(p);
}

describe("config/policy.yaml", () => {
  it("loads and validates", () => {
    const p = parsePolicy(text);
    expect(p.budget.hard_stop_at).toBe(45);
    expect(p.protected_actions).toContain("change_bot_permissions");
  });

  it("rejects warn threshold at or above the hard stop", () => {
    expect(() => parsePolicy(withChange((p) => (p.budget.warn_at = 45)))).toThrow(/warn_at/);
  });

  it("rejects a cap at or above the A$50 ceiling", () => {
    expect(() =>
      parsePolicy(
        withChange((p) => ((p.budget.company_monthly_cap = 50), (p.budget.hard_stop_at = 50))),
      ),
    ).toThrow(/safety_buffer_below/);
  });

  it("rejects allocations that exceed the cap", () => {
    expect(() => parsePolicy(withChange((p) => (p.budget.allocations.extra = 40)))).toThrow(
      /allocations/,
    );
  });

  it("refuses to disable maker/checker provider separation", () => {
    expect(() =>
      parsePolicy(
        withChange((p) => (p.dual_review.makers_and_checkers_must_differ_by_provider = false)),
      ),
    ).toThrow(/provider separation/);
  });
});
