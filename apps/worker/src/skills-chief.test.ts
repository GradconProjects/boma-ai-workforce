import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MockTelegramApi, TelegramGateway } from "@boma/connectors";
import { parseEnv, resumeAll } from "@boma/core";
import { MockProvider, PriceTable, type LlmRequest } from "@boma/llm";
import { repoPath, setupDb, SKIP_DB, type Fixture } from "../../../test/fixture";
import { buildApp } from "./app";
import { chunkForTelegram } from "./chief/skill-run";
import type { Notifier } from "./chief/notifier";
import { Worker } from "./worker";
import { loadWorkspaceConfig, syncWorkspaces } from "./workspaces";

const OWNER = 424242;
const PASSCODE = "river-stone-77";

const env = parseEnv({
  ANTHROPIC_MODEL_MAKER: "claude-sonnet-5-5",
  ANTHROPIC_MODEL_CHEAP: "claude-haiku-5-5",
  OPENAI_MODEL_CHECKER: "test-checker",
  USD_TO_AUD_RATE: "1.55",
  TZ: "Australia/Sydney",
  SKILLS_PASSCODE: PASSCODE,
});
const prices = new PriceTable({
  anthropic: {
    "claude-sonnet-5-5": { input: 2, output: 10 },
    "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  },
  openai: { "test-checker": { input: 0.5, output: 2 } },
});

describe("telegram chunking", () => {
  it("splits long answers on paragraph breaks and flags truncation", () => {
    const para = "x".repeat(1000);
    const text = Array.from({ length: 20 }, () => para).join("\n\n");
    const { chunks, truncated } = chunkForTelegram(text, 3800, 4);
    expect(chunks).toHaveLength(4);
    expect(chunks.every((c) => c.length <= 3800)).toBe(true);
    expect(truncated).toBe(true);
    expect(chunkForTelegram("short").chunks).toEqual(["short"]);
  });
});

describe.skipIf(SKIP_DB)("skills through the Chief", () => {
  let fx: Fixture;
  let tg: MockTelegramApi;
  let gateway: TelegramGateway;
  let worker: Worker;
  let anthropic: MockProvider;
  let classification: unknown;
  let msgId = 5000;

  const say = (text: string) =>
    gateway.handle({
      update_id: msgId,
      message: { message_id: msgId++, from: { id: OWNER }, chat: { id: OWNER }, text },
    });
  const runAll = async () => {
    for (let i = 0; i < 10 && (await worker.engineTick()); i++);
  };
  const texts = () => tg.sent.map((s) => s.text).join("\n---\n");

  beforeAll(async () => {
    fx = await setupDb();
    await syncWorkspaces(fx.pool, loadWorkspaceConfig(repoPath("config/workspaces.yaml")));
  });
  afterAll(async () => fx?.close());

  beforeEach(async () => {
    await resumeAll(fx.pool, "owner");
    await fx.pool.query("delete from system_state where key like 'chief:%' or key like 'skills_%'");
    await fx.pool.query("delete from skills");
    await fx.pool.query(
      "update tasks set status = 'cancelled', locked_by = null where status not in ('done', 'failed', 'expired', 'cancelled')",
    );
    classification = {
      intent: "question",
      clarifying_question: null,
      control: null,
      summary: "q",
      skill: null,
    };
    anthropic = new MockProvider("anthropic", (req: LlmRequest) => {
      if (req.schemaName === "classification") return { json: classification };
      if (req.schemaName === "answer") return { json: { answer: "All quiet." } };
      if (!req.schema) return { text: `SKILL ANSWER for: ${req.input.slice(-60)}` };
      throw new Error(`unexpected call ${req.schemaName}`);
    });
    const openai = new MockProvider("openai", () => ({
      json: { verdict: "sound", issues: [], summary: "Checked: fine." },
    }));
    tg = new MockTelegramApi();
    const notify: Notifier = {
      send: (t, b) => tg.sendMessage(OWNER, t, b),
      edit: (id, t) => tg.editMessage(OWNER, id, t),
      deleteOwnerMessage: (id) => tg.deleteMessage(OWNER, id),
    };
    const app = await buildApp({
      db: fx.pool,
      policy: fx.policy,
      env,
      notify,
      prices,
      providers: { anthropic, openai },
      skillsDir: repoPath("skills"),
    });
    gateway = new TelegramGateway(tg, fx.pool, OWNER, {
      onMessage: (t, id) => app.chief.onOwnerMessage(t, id),
      onApprovalButton: (a, act) => app.chief.onApprovalButton(a, act),
    });
    worker = new Worker({
      db: fx.pool,
      policy: fx.policy,
      chief: app.chief,
      notify,
      handlers: app.handlers,
      workerId: "test-skills",
      tz: "Australia/Sydney",
    });
  });

  it("a trigger phrase routes straight to the skill (no classification) and the answer comes back", async () => {
    await say("council this: should I hire a VA or an intern?");
    expect(anthropic.calls.some((c) => c.schemaName === "classification")).toBe(false);
    expect(texts()).toMatch(/Using The Council/i);
    await runAll();
    expect(texts()).toMatch(/SKILL ANSWER for: [\s\S]*hire a VA or an intern\?/);
    const { rows } = await fx.pool.query(
      "select status, output, cost_aud from skill_runs order by created_at desc limit 1",
    );
    expect(rows[0].status).toBe("done");
    expect(Number(rows[0].cost_aud)).toBeGreaterThan(0);
    // Budget ledger recorded the run under the skills scope.
    const spend = await fx.pool.query(
      "select count(*)::int as n from budget_ledger where scope = 'bot:skills'",
    );
    expect(spend.rows[0].n).toBeGreaterThan(0);
  });

  it("skills marked for review get an independent check from the other provider", async () => {
    await say("/skill assessment-coach help me plan a reflective essay on teamwork");
    await runAll();
    expect(texts()).toMatch(/Independent check \(OpenAI\): Checked: fine\./);
  });

  it("the classifier may pick a skill only from the catalogue", async () => {
    classification = { ...(classification as object), skill: "delete-all-bots" };
    await say("something vague with no trigger words at all");
    expect(texts()).not.toMatch(/Using/);
    classification = { ...(classification as object), intent: "question", skill: "the-opposer" };
    await say("poke holes please in my plan to expand");
    expect(texts()).toMatch(/Using The Opposer/i);
  });

  it("high-risk skills wait for the passcode; the passcode message is deleted and never stored", async () => {
    await say("/risk the-council high");
    expect(texts()).toMatch(/now high-risk/);
    await say("council this: should I sign the lease?");
    expect(texts()).toMatch(/labelled high-risk/);
    expect(
      (
        await fx.pool.query(
          "select count(*)::int as n from skill_runs where request like '%sign the lease%'",
        )
      ).rows[0].n,
    ).toBe(0);

    const wrongId = msgId;
    await say("/unlock not-it");
    expect(tg.deleted.map((d) => d.messageId)).toContain(wrongId);
    expect(texts()).toMatch(/isn't right/);

    const rightId = msgId;
    await say(`/unlock ${PASSCODE}`);
    expect(tg.deleted.map((d) => d.messageId)).toContain(rightId);
    expect(texts()).toMatch(/unlocked for 30 minutes/);
    // The pending request ran automatically after unlocking.
    expect(texts()).toMatch(/Using The Council/i);
    await runAll();
    expect(texts()).toMatch(/SKILL ANSWER for: [\s\S]*sign the lease/);

    const audit = await fx.pool.query(
      "select count(*)::int as n from audit_log a where row_to_json(a)::text like $1",
      [`%${PASSCODE}%`],
    );
    expect(audit.rows[0].n).toBe(0);
  });

  it("removing a high-risk label needs the passcode session; adding one never does", async () => {
    await say("/risk the-opposer high");
    await say("/risk the-opposer standard");
    expect(texts()).toMatch(/needs your passcode first/);
    await say(`/unlock ${PASSCODE}`);
    await say("/risk the-opposer standard");
    expect(texts()).toMatch(/The Opposer is now standard/);
    await say("/lock");
    expect(texts()).toMatch(/locked again/);
  });

  it("switched-off skills don't run and /skills lists the library", async () => {
    await fx.pool.query(
      "insert into skills (slug, source, frontmatter, body, refs) values ('the-council', 'override', '{\"enabled\": false}', '', '[]')",
    );
    await say("council this: anything");
    expect(texts()).not.toMatch(/Using The Council/i);
    await say("/skills");
    expect(texts()).toMatch(/Skills library/);
    expect(texts()).toMatch(/the-council ⏹ off/);
  });
});
