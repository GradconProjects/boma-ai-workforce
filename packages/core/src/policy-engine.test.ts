import { describe, expect, it } from "vitest";
import { repoPath } from "../../../test/fixture";
import { loadPolicy } from "./policy";
import { decide, type PolicyRequest } from "./policy-engine";

const policy = loadPolicy(repoPath("config/policy.yaml"));
const chief = {
  slug: "chief-of-staff",
  workspaces: ["personal", "ongroundpm"],
  accounts: ["telegram-owner"],
  actions: {
    plan_and_dispatch: 5,
    message_owner: 5,
    draft_post_text: 2,
    propose_bot_edit: 2,
    apply_bot_edit: 1,
  },
};
const poster = {
  slug: "facebook-page-poster",
  workspaces: ["ongroundpm"],
  accounts: ["facebook-page-ongroundpm"],
  actions: { publish_post: 3, edit_live_post: 4, pull_insights: 5 },
};
const base = (over: Partial<PolicyRequest>): PolicyRequest => ({
  policy,
  bot: chief,
  action: "plan_and_dispatch",
  effect: "internal",
  paused: false,
  ...over,
});

describe("policy engine", () => {
  it("C7: denies any bot changing permissions, even its own, at any level", () => {
    for (const action of [
      "change_bot_permissions",
      "apply_bot_edit",
      "raise_budget",
      "grant_account",
    ]) {
      const bot = { ...chief, actions: { ...chief.actions, [action]: 5 } };
      const d = decide(base({ bot, action }));
      expect(d.allowed, action).toBe(false);
      expect(d.reason).toMatch(/owner-only/);
    }
  });

  it("C4/E2: denies new actions while paused, but still lets the Chief talk to the owner", () => {
    expect(decide(base({ paused: true })).allowed).toBe(false);
    expect(decide(base({ paused: true, action: "message_owner" })).allowed).toBe(true);
  });

  it("enforces workspace and account grants", () => {
    expect(decide(base({ workspace: "boma-scans" })).allowed).toBe(false);
    expect(
      decide(
        base({ bot: poster, action: "publish_post", effect: "external", account: "x-account" }),
      ).allowed,
    ).toBe(false);
  });

  it("level 2 may prepare but never act externally; new actions default to 2", () => {
    expect(decide(base({ action: "draft_post_text", effect: "internal" })).allowed).toBe(true);
    expect(decide(base({ action: "draft_post_text", effect: "external" })).allowed).toBe(false);
    const d = decide(base({ action: "never_configured", effect: "external" }));
    expect(d).toMatchObject({ allowed: false, level: 2 });
  });

  it("level 3 external actions stop at the approval checkpoint", () => {
    const d = decide(
      base({ bot: poster, action: "publish_post", effect: "external", workspace: "ongroundpm" }),
    );
    expect(d).toMatchObject({ allowed: true, requiresApproval: true, level: 3 });
  });

  it("caps protected actions at 3 unless the owner unlocked them", () => {
    const req = base({
      bot: poster,
      action: "edit_live_post",
      effect: "external",
      workspace: "ongroundpm",
    });
    expect(decide(req)).toMatchObject({ level: 3, requiresApproval: true });
    const unlock = { action: "edit_live_post", bot_slug: "facebook-page-poster", new_level: 4 };
    expect(decide({ ...req, unlocks: [unlock] })).toMatchObject({
      level: 4,
      requiresApproval: false,
      notifyOwner: true,
    });
    const expired = { ...unlock, expires_at: new Date(Date.now() - 1) };
    expect(decide({ ...req, unlocks: [expired] }).level).toBe(3);
    const otherWs = { ...unlock, workspace_slug: "boma-scans" };
    expect(decide({ ...req, unlocks: [otherWs] }).level).toBe(3);
  });
});
