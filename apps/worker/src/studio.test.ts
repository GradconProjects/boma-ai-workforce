import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { decideApproval, parseEnv } from "@boma/core";
import { extractCopy } from "@boma/design-engine";
import { MockProvider, PriceTable, type LlmRequest } from "@boma/llm";
import {
  createCampaign,
  getCampaign,
  listBrands,
  listVersions,
  requestCampaignCopy,
  saveDesign,
  seedBrands,
  StaleRevisionError,
  syncItemStatusesFromApprovals,
} from "@boma/studio";
import { repoPath, setupDb, SKIP_DB, type Fixture } from "../../../test/fixture";
import { buildApp } from "./app";
import { MockTelegramApi } from "@boma/connectors";
import type { Notifier } from "./chief/notifier";
import { simulationPrices, simulationProviders, SIM_MODELS } from "./simulation";
import { Worker } from "./worker";
import { loadWorkspaceConfig, syncWorkspaces } from "./workspaces";

const env = parseEnv({
  ANTHROPIC_MODEL_MAKER: "claude-sonnet-5-5",
  ANTHROPIC_MODEL_CHEAP: "claude-haiku-5-5",
  OPENAI_MODEL_CHECKER: "test-checker",
  USD_TO_AUD_RATE: "1.55",
});
const prices = new PriceTable({
  anthropic: {
    "claude-sonnet-5-5": { input: 2, output: 10 },
    "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  },
  openai: { "test-checker": { input: 0.5, output: 2 } },
});

const copyText = [
  "EYEBROW: Property management",
  "HEADLINE: Away from Melbourne? We're on the ground.",
  "SUBHEAD: In-person inspections with photo reports.",
  "BODY: Local eyes on your investment.",
  "CTA: Book an inspection",
].join("\n");

describe.skipIf(SKIP_DB)("Creative Studio ↔ Chief: campaign copy", () => {
  let fx: Fixture;
  let tg: MockTelegramApi;
  let notify: Notifier;
  let brandId: string;

  beforeAll(async () => {
    fx = await setupDb();
    await syncWorkspaces(fx.pool, loadWorkspaceConfig(repoPath("config/workspaces.yaml")));
    await seedBrands(fx.pool);
    brandId = (await listBrands(fx.pool)).find((b) => b.slug === "ongroundpm")!.id;
    tg = new MockTelegramApi();
    notify = { send: (t, b) => tg.sendMessage(1, t, b), edit: (id, t) => tg.editMessage(1, id, t) };
  });
  afterAll(async () => fx?.close());

  const worker = async (opts: { simulated?: boolean; maker?: () => string } = {}) => {
    const providers = opts.simulated
      ? simulationProviders()
      : {
          anthropic: new MockProvider("anthropic", (_req: LlmRequest) => ({
            json: { text: opts.maker ? opts.maker() : copyText, claims: [] },
          })),
          openai: new MockProvider("openai", () => ({
            json: {
              verdict: "pass",
              score: 88,
              issues: [],
              claims_checked: [],
              injection_detected: false,
              summary: "ok",
            },
          })),
        };
    const app = await buildApp({
      db: fx.pool,
      policy: fx.policy,
      env: opts.simulated ? parseEnv({ ...SIM_MODELS, USD_TO_AUD_RATE: "1.5" }) : env,
      notify,
      prices: opts.simulated ? simulationPrices() : prices,
      providers,
      simulated: opts.simulated,
    });
    const w = new Worker({
      db: fx.pool,
      policy: fx.policy,
      chief: app.chief,
      notify,
      handlers: app.handlers,
      workerId: "w",
      tz: "Australia/Sydney",
    });
    return { w, providers };
  };

  it("a campaign creates one editable design per deliverable", async () => {
    const c = await createCampaign(fx.pool, {
      brandId,
      name: "Spring landlords",
      objective: "Get landlords to book an inspection",
      audience: "Melbourne landlords",
      cta: "Book now",
      channels: ["facebook"],
      actor: "owner",
    });
    const { items } = await getCampaign(fx.pool, c.id);
    expect(items.map((i) => i.design.format_id)).toEqual([
      "social-portrait",
      "social-square",
      "story",
      "ad-landscape",
      "flyer-a4",
    ]);
    expect(extractCopy(items[0]!.design.doc).cta).toBe("Book now");
  });

  it("Chief writes reviewed copy into every design, then approval marks the campaign ready", async () => {
    const c = await createCampaign(fx.pool, {
      brandId,
      name: "Inspections",
      objective: "Promote same-day photo reports",
      audience: "Interstate investors",
      cta: "Book an inspection",
      channels: ["facebook"],
      deliverables: [
        { formatId: "social-square", template: "bold" },
        { formatId: "story", template: "editorial" },
      ],
      actor: "owner",
    });
    expect(
      await requestCampaignCopy(fx.pool, fx.policy, { campaignId: c.id, actor: "owner" }),
    ).toEqual({ ok: true, queued: 2 });
    // A second request while drafting does nothing (no duplicate spend).
    expect(
      (await requestCampaignCopy(fx.pool, fx.policy, { campaignId: c.id, actor: "owner" })).ok,
    ).toBe(false);

    const { w, providers } = await worker();
    while (await w.engineTick());
    let { items } = await getCampaign(fx.pool, c.id);
    for (const it of items) {
      expect(it.copy_status).toBe("awaiting_approval");
      expect(extractCopy(it.design.doc).headline).toBe("Away from Melbourne? We're on the ground.");
      expect(it.design.revision).toBe(2);
    }
    // Both providers were used: Claude made, OpenAI checked.
    expect((providers.anthropic as MockProvider).calls.length).toBe(2);
    expect((providers.openai as MockProvider).calls.length).toBe(2);
    // The owner got Telegram approval cards for each.
    expect(
      tg.sent.filter(
        (s) =>
          s.text.includes("· Social post copy") ||
          s.text.includes("· Story / Reel / TikTok cover copy"),
      ),
    ).toHaveLength(2);

    for (const it of items) await decideApproval(fx.pool, it.approval_id!, "approved");
    await syncItemStatusesFromApprovals(fx.pool);
    ({ items } = await getCampaign(fx.pool, c.id));
    expect(items.every((i) => i.copy_status === "approved")).toBe(true);
    expect((await getCampaign(fx.pool, c.id)).campaign.status).toBe("ready");

    // Version history records who changed the design.
    const versions = await listVersions(fx.pool, items[0]!.design_id);
    expect(versions.map((v) => v.actor)).toEqual(["bot:chief-of-staff", "owner"]);
  });

  it("copy missing a required field goes back to the maker before any checker spend", async () => {
    const c = await createCampaign(fx.pool, {
      brandId,
      name: "Bad copy",
      objective: "x",
      audience: "y",
      cta: "",
      channels: [],
      deliverables: [{ formatId: "social-square", template: "bold" }],
      actor: "owner",
    });
    await requestCampaignCopy(fx.pool, fx.policy, { campaignId: c.id, actor: "owner" });
    const { w, providers } = await worker({ maker: () => "HEADLINE: Only a headline" });
    while (await w.engineTick());
    const { items } = await getCampaign(fx.pool, c.id);
    expect(items[0]!.copy_status).toBe("needs_decision"); // disagreement → owner decides
    expect((providers.openai as MockProvider).calls).toHaveLength(0);
  });

  it("simulation mode works with no keys, costs A$0 and is labelled everywhere", async () => {
    const c = await createCampaign(fx.pool, {
      brandId,
      name: "Sim",
      objective: "Show the studio",
      audience: "Owner",
      cta: "Try it",
      channels: [],
      deliverables: [{ formatId: "social-square", template: "bold" }],
      actor: "owner",
    });
    await requestCampaignCopy(fx.pool, fx.policy, { campaignId: c.id, actor: "owner" });
    const before = tg.sent.length;
    const { w } = await worker({ simulated: true });
    while (await w.engineTick());
    const { items } = await getCampaign(fx.pool, c.id);
    expect(items[0]!.simulated).toBe(true);
    expect(extractCopy(items[0]!.design.doc).subhead).toMatch(/Simulated copy/);
    expect(tg.sent.slice(before).some((s) => s.text.startsWith("🧪 SIMULATION"))).toBe(true);
    const { rows } = await fx.pool.query(
      "select coalesce(sum(amount_aud),0)::float as s from budget_ledger where kind = 'actual' and task_id = $1",
      [items[0]!.task_id],
    );
    expect(rows[0].s).toBe(0);
  });

  it("saving a design that changed underneath is refused, never overwritten", async () => {
    const c = await createCampaign(fx.pool, {
      brandId,
      name: "Conflict",
      objective: "x",
      audience: "y",
      cta: "Go",
      channels: [],
      deliverables: [{ formatId: "story", template: "bold" }],
      actor: "owner",
    });
    const d = (await getCampaign(fx.pool, c.id)).items[0]!.design;
    await saveDesign(fx.pool, {
      id: d.id,
      doc: d.doc,
      baseRevision: d.revision,
      note: "edit",
      actor: "owner",
    });
    await expect(
      saveDesign(fx.pool, {
        id: d.id,
        doc: d.doc,
        baseRevision: d.revision,
        note: "stale",
        actor: "owner",
      }),
    ).rejects.toThrow(StaleRevisionError);
  });
});
