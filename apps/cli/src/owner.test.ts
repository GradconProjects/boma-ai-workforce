import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { decide, type OwnerUnlock } from "@boma/core";
import { loadBotSettings, loadUnlocks } from "@boma/bots";
import { setupDb, SKIP_DB, type Fixture } from "../../../test/fixture";
import { OwnerCliError, parseArgs, runOwnerCommand } from "./owner";

describe("parseArgs", () => {
  it("splits positionals and flags", () => {
    expect(
      parseArgs(["unlock", "bot", "edit_live_post", "4", "--reason", "pilot", "--yes"]),
    ).toEqual({
      positional: ["unlock", "bot", "edit_live_post", "4"],
      flags: { reason: "pilot", yes: true },
    });
  });
});

describe.skipIf(SKIP_DB)("owner CLI (the only path that changes permissions)", () => {
  let fx: Fixture;
  const out: string[] = [];
  const run = (...argv: string[]) =>
    runOwnerCommand(fx.pool, fx.policy, [...argv, "--yes"], (s) => out.push(s));

  beforeAll(async () => {
    fx = await setupDb();
    await fx.pool.query(
      "insert into workspaces (slug, name) values ('ongroundpm', 'OnGroundPM') on conflict do nothing",
    );
  });
  afterAll(async () => fx?.close());

  it("unlocks a protected action, which the policy engine then honours, and can lock it again", async () => {
    await run(
      "unlock",
      "facebook-page-poster",
      "edit_live_post",
      "4",
      "--reason",
      "fix typo in pilot post",
      "--days",
      "2",
    );
    const unlocks: OwnerUnlock[] = await loadUnlocks(fx.pool);
    const poster = await loadBotSettings(fx.pool, "facebook-page-poster");
    const req = {
      policy: fx.policy,
      bot: {
        slug: poster.slug,
        workspaces: poster.frontmatter.workspaces,
        accounts: poster.frontmatter.accounts,
        actions: { ...poster.frontmatter.actions, edit_live_post: 4 },
      },
      action: "edit_live_post",
      effect: "external" as const,
      paused: false,
    };
    expect(decide({ ...req, unlocks }).level).toBe(4);
    await run("lock", "facebook-page-poster", "edit_live_post");
    expect(decide({ ...req, unlocks: await loadUnlocks(fx.pool) }).level).toBe(3);
    const { rows } = await fx.pool.query(
      "select action from audit_log where actor = 'owner' and action like 'policy.%' order by id",
    );
    expect(rows.map((r) => r.action)).toEqual(["policy.unlock", "policy.lock"]);
  });

  it("refuses unlocks without a reason or for non-protected actions", async () => {
    await expect(run("unlock", "chief-of-staff", "change_bot_permissions", "4")).rejects.toThrow(
      /--reason/,
    );
    await expect(
      run("unlock", "chief-of-staff", "message_owner", "5", "--reason", "x"),
    ).rejects.toThrow(/not a protected action/);
  });

  it("adds accounts and grants/revokes them", async () => {
    await run(
      "account",
      "add",
      "facebook-page-ongroundpm",
      "facebook_page",
      "OnGroundPM Page",
      "--workspace",
      "ongroundpm",
    );
    await run("grant", "facebook-page-poster", "facebook-page-ongroundpm");
    expect(
      (await fx.pool.query("select count(*)::int as n from bot_account_grants")).rows[0].n,
    ).toBe(1);
    await run("revoke", "facebook-page-poster", "facebook-page-ongroundpm");
    expect(
      (await fx.pool.query("select count(*)::int as n from bot_account_grants")).rows[0].n,
    ).toBe(0);
  });

  it("sets budgets but never at or above the A$50 safety ceiling", async () => {
    await run("budget", "set", "company", "30", "--warn", "20");
    const { rows } = await fx.pool.query(
      "select monthly_aud, warn_aud from budget_limits where scope = 'company'",
    );
    expect(Number(rows[0].monthly_aud)).toBe(30);
    await expect(run("budget", "set", "company", "50")).rejects.toThrow(OwnerCliError);
    await run("budget", "set", "dual-review", "4");
    expect(
      (await fx.pool.query("select 1 from budget_limits where scope = 'bot:dual-review'")).rowCount,
    ).toBe(1);
  });

  it("pause and resume work from the CLI", async () => {
    await run("pause");
    expect(
      (await fx.pool.query("select value from system_state where key = 'paused'")).rows[0].value,
    ).toBe(true);
    await run("resume");
    expect(
      (await fx.pool.query("select value from system_state where key = 'paused'")).rows[0].value,
    ).toBe(false);
  });
});
