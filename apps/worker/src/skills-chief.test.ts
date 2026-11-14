import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MockTelegramApi, TelegramGateway } from "@boma/connectors";
import { parseEnv, resumeAll, setState } from "@boma/core";
import { MockProvider, PriceTable, type LlmRequest } from "@boma/llm";
import { repoPath, setupDb, SKIP_DB, type Fixture } from "../../../test/fixture";
import { buildApp } from "./app";
import { chunkForTelegram } from "./chief/skill-run";
import { chatHistory, logChat, withTranscript } from "./chief/transcript";
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
  let plan: unknown;
  let chief: Awaited<ReturnType<typeof buildApp>>["chief"];
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
      if (req.schemaName === "plan") return { json: plan };
      if (req.schemaName === "maker_output")
        return {
          json: { text: "Spring is inspection season. Book a same-day photo report.", claims: [] },
        };
      if (!req.schema) return { text: `SKILL ANSWER for: ${req.input.slice(-60)}` };
      throw new Error(`unexpected call ${req.schemaName}`);
    });
    const openai = new MockProvider("openai", (req: LlmRequest) =>
      req.schemaName === "critique"
        ? { json: { verdict: "sound", issues: [], summary: "Checked: fine." } }
        : {
            json: {
              verdict: "pass",
              score: 90,
              issues: [],
              claims_checked: [],
              injection_detected: false,
              summary: "Good.",
            },
          },
    );
    tg = new MockTelegramApi();
    const notify: Notifier = withTranscript(fx.pool, {
      send: (t, b) => tg.sendMessage(OWNER, t, b),
      edit: (id, t) => tg.editMessage(OWNER, id, t),
      deleteOwnerMessage: (id) => tg.deleteMessage(OWNER, id),
    });
    const app = await buildApp({
      db: fx.pool,
      policy: fx.policy,
      env,
      notify,
      prices,
      providers: { anthropic, openai },
      skillsDir: repoPath("skills"),
    });
    chief = app.chief;
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

  it("Chief-led teamwork: a skill answers first, then hands its answer to the post drafter", async () => {
    classification = { ...(classification as object), intent: "new_job" };
    plan = {
      reply: "Strategy first, then a post built on it.",
      tasks: [
        {
          kind: "skill_run",
          skill: "content-strategist",
          workspace: "ongroundpm",
          brief: "Spring content angles for landlords who live away",
          scheduled_for: null,
          uses_output_of: null,
        },
        {
          kind: "draft_post",
          skill: null,
          workspace: "ongroundpm",
          brief: "One Facebook post using the best angle",
          scheduled_for: null,
          uses_output_of: 0,
        },
        {
          kind: "skill_run",
          skill: "make-everyone-admin",
          workspace: "ongroundpm",
          brief: "x",
          scheduled_for: null,
          uses_output_of: null,
        },
      ],
      unsupported: [],
      permission_changes_requested: [],
    };
    await say("Plan some spring content for OnGroundPM and then draft a post from it");
    expect(texts()).toMatch(/Content Strategist/);
    expect(texts()).toMatch(/↳ then Draft post · ongroundpm/);
    expect(texts()).toMatch(/isn't an available skill/);
    // The post isn't created until the skill has answered.
    const before = await fx.pool.query(
      "select count(*)::int as n from tasks where kind = 'draft_post' and status not in ('cancelled')",
    );
    await runAll();
    expect(texts()).toMatch(/handed its answer to the post drafter: ongroundpm/);
    const child = await fx.pool.query(
      "select t.inputs, t.status, p.kind as parent_kind from tasks t join tasks p on p.id = t.parent_task_id where t.kind = 'draft_post' order by t.created_at desc limit 1",
    );
    expect(child.rows[0].parent_kind).toBe("skill_run");
    expect(child.rows[0].inputs.brief).toContain("<untrusted_data");
    expect(child.rows[0].status).toBe("awaiting_approval");
    const after = await fx.pool.query(
      "select count(*)::int as n from tasks where kind = 'draft_post' and status not in ('cancelled')",
    );
    expect(after.rows[0].n).toBe(before.rows[0].n + 1);
  });

  it("the handoff is re-checked by the policy engine when it happens", async () => {
    classification = { ...(classification as object), intent: "new_job" };
    plan = {
      reply: "ok",
      tasks: [
        {
          kind: "skill_run",
          skill: "the-council",
          workspace: "ongroundpm",
          brief: "angles?",
          scheduled_for: null,
          uses_output_of: null,
        },
        {
          kind: "draft_post",
          skill: null,
          workspace: "ongroundpm",
          brief: "post",
          scheduled_for: null,
          uses_output_of: 0,
        },
      ],
      unsupported: [],
      permission_changes_requested: [],
    };
    await say("think it through and then write the post");
    // The owner pauses everything while the skill is still answering.
    anthropic.setHandler(async (req: LlmRequest) => {
      if (!req.schema) {
        await setState(fx.pool, "paused", true);
        return { text: "Council verdict: go." };
      }
      throw new Error(`unexpected call ${req.schemaName}`);
    });
    await runAll();
    await setState(fx.pool, "paused", false);
    expect(texts()).toMatch(/Didn't hand off to ongroundpm/);
    const kids = await fx.pool.query(
      "select count(*)::int as n from tasks t join tasks p on p.id = t.parent_task_id where p.inputs->>'request' = 'angles?'",
    );
    expect(kids.rows[0].n).toBe(0);
  });
  it("a late skill answer lands in the app conversation it was asked in", async () => {
    const asked = "11111111-1111-4111-8111-111111111111";
    const later = "22222222-2222-4222-8222-222222222222";
    const m = await logChat(fx.pool, {
      role: "owner",
      channel: "app",
      text: "council this: lease or buy the ute?",
      clientId: "client-late-1",
      conversationId: asked,
    });
    await chief.onOwnerMessage("council this: lease or buy the ute?", -Number(m.id));
    // The owner moves on to another conversation before the answer is ready.
    await logChat(fx.pool, {
      role: "owner",
      channel: "app",
      text: "something else",
      clientId: "client-late-2",
      conversationId: later,
    });
    await runAll();
    const inAsked = (await chatHistory(fx.pool, { conversationId: asked })).map((x) => x.text);
    const inLater = (await chatHistory(fx.pool, { conversationId: later })).map((x) => x.text);
    expect(inAsked.some((t) => t.includes("SKILL ANSWER"))).toBe(true);
    expect(inLater.some((t) => t.includes("SKILL ANSWER"))).toBe(false);
  });
  it("creates a workspace Boma names, and plans work in it straight away", async () => {
    classification = { ...(classification as object), intent: "new_job" };
    plan = {
      reply: "Done: I've set up Shadow Aussie Page and drafted the first post.",
      tasks: [
        {
          kind: "draft_post",
          skill: null,
          workspace: "Shadow Aussie Page",
          brief: "Welcome post for an Australian everything blog",
          scheduled_for: null,
          uses_output_of: null,
        },
      ],
      new_workspaces: [
        {
          name: "Shadow Aussie Page",
          description: "Blog and Facebook page about everything Australian",
        },
        { name: "Sneaky Crypto Pump", description: "not requested" },
      ],
      unsupported: [],
      permission_changes_requested: [],
    };
    await say("Set up my Shadow Aussie Page and write the first Facebook post for it");
    expect(texts()).toMatch(/Created the workspace "Shadow Aussie Page"/);
    expect(texts()).toMatch(/didn't create "Sneaky Crypto Pump"/);
    const ws = await fx.pool.query(
      "select slug, owner_added from workspaces where slug = 'shadow-aussie-page'",
    );
    expect(ws.rows[0]).toEqual({ slug: "shadow-aussie-page", owner_added: true });
    expect(
      (
        await fx.pool.query(
          "select count(*)::int as n from workspaces where slug = 'sneaky-crypto-pump'",
        )
      ).rows[0].n,
    ).toBe(0);
    const task = await fx.pool.query(
      "select t.kind from tasks t join workspaces w on w.id = t.workspace_id where w.slug = 'shadow-aussie-page' and t.status <> 'cancelled'",
    );
    expect(task.rows.map((r) => r.kind)).toContain("draft_post");
  });

  it("reads the conversation so a follow-up like 'do it' makes sense", async () => {
    const conv = "44444444-4444-4444-8444-444444444444";
    await logChat(fx.pool, {
      role: "owner",
      channel: "app",
      text: "I want a blog about everything Australian, linked to my Facebook page",
      clientId: "client-hist-1",
      conversationId: conv,
    });
    await logChat(fx.pool, {
      role: "owner",
      channel: "app",
      text: "do it",
      clientId: "client-hist-2",
      conversationId: conv,
    });
    await chief.onOwnerMessage("do it", -1);
    const call = anthropic.calls.find((c) => c.schemaName === "classification")!;
    expect(call.input).toContain("blog about everything Australian");
    expect(call.input).toMatch(/Newest message from Boma:\ndo it$/);
  });

  it("always answers, even when something breaks", async () => {
    anthropic.setHandler(() => ({ error: new Error("upstream exploded") }));
    await say("write something for ongroundpm");
    expect(texts()).toMatch(/couldn't finish that: upstream exploded/);
  });
  it("autopilot approves clean reviewed posts itself; off means they come to Boma again", async () => {
    await fx.pool.query("delete from system_state where key like 'autopilot:%'");
    classification = { ...(classification as object), intent: "new_job" };
    const onePost = (brief: string) => ({
      reply: "On it.",
      tasks: [
        {
          kind: "draft_post",
          skill: null,
          workspace: "ongroundpm",
          brief,
          scheduled_for: null,
          uses_output_of: null,
        },
      ],
      unsupported: [],
      permission_changes_requested: [],
    });

    await say("autopilot ongroundpm");
    expect(texts()).toMatch(/Autopilot is on for OnGroundPM/);
    plan = onePost("autopilot post one");
    await say("write a quick post about inspections");
    await runAll();
    const auto = await fx.pool.query(
      "select status from tasks where kind = 'draft_post' and inputs->>'brief' = 'autopilot post one'",
    );
    expect(auto.rows[0].status).toBe("approved");
    expect(texts()).not.toMatch(/Approval needed[\s\S]*autopilot post one/);
    const audited = await fx.pool.query(
      "select count(*)::int as n from audit_log where actor = 'policy:autopilot' and action = 'approval.approved'",
    );
    expect(audited.rows[0].n).toBeGreaterThan(0);

    await say("/autopilot ongroundpm off");
    expect(texts()).toMatch(/Autopilot is off for OnGroundPM/);
    plan = onePost("manual post two");
    await say("write another post about inspections");
    await runAll();
    const manual = await fx.pool.query(
      "select status from tasks where kind = 'draft_post' and inputs->>'brief' = 'manual post two'",
    );
    expect(manual.rows[0].status).toBe("awaiting_approval");
  });
  it("writes a blog article, publishes it once approved, and drafts the Facebook post linking to it", async () => {
    await fx.pool.query(
      `insert into workspaces (slug, name, rules, owner_added) values ('aussie-blog', 'Aussie Blog', '{"name":"Aussie Blog","general_knowledge":true}', true)
       on conflict (slug) do nothing`,
    );
    classification = { ...(classification as object), intent: "new_job" };
    plan = {
      reply: "Writing it now.",
      tasks: [
        {
          kind: "write_article",
          skill: null,
          workspace: "aussie-blog",
          brief: "Why magpies swoop",
          scheduled_for: null,
          uses_output_of: null,
        },
      ],
      unsupported: [],
      permission_changes_requested: [],
    };
    anthropic.setHandler((req: LlmRequest) => {
      if (req.schemaName === "classification") return { json: classification };
      if (req.schemaName === "plan") return { json: plan };
      if (req.schemaName === "maker_output")
        return /Blog article/.test(req.system)
          ? {
              json: {
                text: "# Why Magpies Swoop\n\nSpring means helmets with cable ties.\n\n## The reason\n\nThey guard their nests.",
                claims: [
                  { claim: "Magpies swoop to guard nests in spring", source: "general knowledge" },
                ],
              },
            }
          : { json: { text: "Magpie season is here. Read why they swoop 👇", claims: [] } };
      throw new Error(`unexpected call ${req.schemaName}`);
    });
    await say("write a blog article about why magpies swoop for Aussie Blog");
    await runAll();
    const appr = await fx.pool.query(
      "select a.id from approvals a join tasks t on t.id = a.task_id where t.kind = 'write_article' and a.status = 'pending' order by a.created_at desc limit 1",
    );
    expect(appr.rows).toHaveLength(1);
    expect((await fx.pool.query("select count(*)::int as n from blog_posts")).rows[0].n).toBe(0);
    await chief.onApprovalButton(appr.rows[0].id, "approve");
    const post = await fx.pool.query("select slug, title, body_md from blog_posts");
    expect(post.rows[0]).toMatchObject({ slug: "why-magpies-swoop", title: "Why Magpies Swoop" });
    expect(post.rows[0].body_md).not.toMatch(/^# /);
    expect(texts()).toMatch(
      /Published on the Aussie Blog blog[\s\S]*\/blog\/aussie-blog\/why-magpies-swoop/,
    );
    const fb = await fx.pool.query(
      "select inputs->>'brief' as brief from tasks where kind = 'draft_post' and idempotency_key like '%:facebook'",
    );
    expect(fb.rows[0].brief).toContain("/blog/aussie-blog/why-magpies-swoop");
    // Publishing twice changes nothing.
    expect(await chief.publishApproved()).toBe(0);
  });
});
