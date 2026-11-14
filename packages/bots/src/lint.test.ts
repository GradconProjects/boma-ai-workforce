import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadPolicy } from "@boma/core";
import { FAKE } from "../../core/src/fixtures";
import { lintBot } from "./lint";
import { ROOT, variant } from "./testutil";

const policy = loadPolicy(fileURLToPath(new URL("config/policy.yaml", ROOT)));
const CHIEF = "bots/chief-of-staff.md";
const POSTER = "bots/facebook-page-poster.md";

const rules = (r: ReturnType<typeof lintBot>) => r.errors.map((e) => e.rule);

describe("G0.4 security lint", () => {
  it("rejects a bot granting itself a protected action at level 4", () => {
    const bot = variant(POSTER, (fm) => (fm.actions.edit_live_post = 4));
    const report = lintBot(bot, { policy });
    expect(report.ok).toBe(false);
    expect(rules(report)).toContain("protected_action_above_cap");
  });

  it("allows it only with a live owner unlock for that bot and action", () => {
    const bot = variant(POSTER, (fm) => (fm.actions.edit_live_post = 4));
    const unlock = { action: "edit_live_post", bot_slug: "facebook-page-poster", new_level: 4 };
    expect(lintBot(bot, { policy, unlocks: [unlock] }).ok).toBe(true);
    expect(lintBot(bot, { policy, unlocks: [{ ...unlock, bot_slug: "chief-of-staff" }] }).ok).toBe(false);
    expect(
      lintBot(bot, { policy, unlocks: [{ ...unlock, expires_at: new Date(Date.now() - 1000) }] }).ok,
    ).toBe(false);
  });

  it("R8: rejects same-provider maker and checker when review is required", () => {
    const bot = variant(CHIEF, (fm) => (fm.models.checker = { provider: "anthropic", model_env: "ANTHROPIC_MODEL_CHEAP" }));
    expect(rules(lintBot(bot, { policy }))).toContain("same_provider_review");
  });

  it("R8: also checks the planner role", () => {
    const bot = variant(CHIEF, (fm) => (fm.models.planner = { provider: "openai", model_env: "OPENAI_MODEL_CHECKER_STRONG" }));
    expect(rules(lintBot(bot, { policy }))).toContain("same_provider_review");
  });

  it("rejects review required with no checker", () => {
    const bot = variant(CHIEF, (fm) => delete fm.models.checker);
    expect(rules(lintBot(bot, { policy }))).toContain("review_without_checker");
  });

  it.each(Object.entries(FAKE))("rejects a pasted secret (%s)", (_name, value) => {
    const bot = variant(CHIEF, () => {}, `\nUse this key: ${value}\n`);
    const report = lintBot(bot, { policy });
    expect(rules(report)).toContain("secret_in_file");
    expect(JSON.stringify(report)).not.toContain(value);
  });

  it("rejects tools that are not on the allowed list", () => {
    const bot = variant(CHIEF, (fm) => fm.tools.push("shell_exec"));
    expect(rules(lintBot(bot, { policy }))).toContain("unknown_tool");
  });

  it("rejects a bot-proposed edit that widens its own permissions", () => {
    const before = variant(CHIEF, () => {}).frontmatter;
    const after = variant(CHIEF, (fm) => {
      fm.tools.push("facebook_publish");
      fm.accounts.push("facebook-page-ongroundpm");
      fm.actions.draft_post_text = 4;
      fm.budget.monthly_aud = 10;
    });
    const report = lintBot(after, { policy, previous: before, source: "bot" });
    expect(report.errors.filter((e) => e.rule === "self_escalation")).toHaveLength(4);
    // The same change from the owner path is allowed.
    expect(lintBot(after, { policy, previous: before, source: "owner" }).ok).toBe(true);
  });

  it("rejects a per-task budget above the monthly budget", () => {
    const bot = variant(CHIEF, (fm) => (fm.budget.max_task_aud = 5));
    expect(rules(lintBot(bot, { policy }))).toContain("budget_inconsistent");
  });
});
