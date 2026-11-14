import { existsSync } from "node:fs";
import { hostname } from "node:os";
import { dirname, join } from "node:path";
import pg from "pg";
import { listBotFiles, loadBotFile, syncBot } from "@boma/bots";
import { HttpTelegramApi, TelegramGateway } from "@boma/connectors";
import { loadEnv, loadPolicy, parseEnv, redact, requireEnv } from "@boma/core";
import { createPool, migrateUp } from "@boma/db";
import { PriceTable } from "@boma/llm";
import { seedBrands } from "@boma/studio";
import { buildApp } from "./app";
import { ConsoleNotifier, type Notifier } from "./chief/notifier";
import { SIM_MODELS, simulationPrices, simulationProviders } from "./simulation";
import { Worker } from "./worker";
import { loadWorkspaceConfig, syncWorkspaces } from "./workspaces";

/**
 * Worker entry point.
 *   pnpm worker     — real providers + Telegram (needs keys in .env)
 *   pnpm simulate   — labelled simulation: scripted AI, A$0, Telegram optional
 */
/** Run from the repo root so .env, config/ and bots/ resolve however the worker is started. */
function chdirToRepoRoot() {
  let dir = process.cwd();
  while (!existsSync(join(dir, "pnpm-workspace.yaml"))) {
    const up = dirname(dir);
    if (up === dir) return;
    dir = up;
  }
  process.chdir(dir);
}

async function main() {
  chdirToRepoRoot();
  const simulated = process.env.BOMA_SIMULATION === "1";
  const loaded = loadEnv();
  const env = simulated
    ? parseEnv({
        ...process.env,
        ...SIM_MODELS,
        USD_TO_AUD_RATE: process.env.USD_TO_AUD_RATE || "1.5",
      })
    : requireEnv(loaded, [
        "DATABASE_URL",
        "TELEGRAM_BOT_TOKEN",
        "TELEGRAM_OWNER_USER_ID",
        "ANTHROPIC_API_KEY",
        "ANTHROPIC_MODEL_MAKER",
        "ANTHROPIC_MODEL_CHEAP",
        "USD_TO_AUD_RATE",
      ]);
  if (
    !simulated &&
    !(env.OPENAI_API_KEY && env.OPENAI_MODEL_CHECKER) &&
    !(env.DEEPSEEK_API_KEY && env.DEEPSEEK_MODEL)
  ) {
    throw new Error(
      "Set OPENAI_API_KEY + OPENAI_MODEL_CHECKER, or DEEPSEEK_API_KEY + DEEPSEEK_MODEL, for the review checker",
    );
  }
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is not set in .env");
  const policy = loadPolicy();
  const db = createPool(env.DATABASE_URL, 5);

  const client = await db.connect();
  try {
    await migrateUp(client);
    for (const f of listBotFiles()) {
      const r = await syncBot(client as unknown as pg.Client, loadBotFile(f), policy);
      if (r.status === "rejected")
        throw new Error(`Bot ${r.slug} failed lint: ${r.errors.join("; ")}`);
    }
  } finally {
    client.release();
  }
  await syncWorkspaces(db, loadWorkspaceConfig());
  await seedBrands(db);

  const useTelegram = Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_OWNER_USER_ID);
  const ownerId = Number(env.TELEGRAM_OWNER_USER_ID);
  const api = useTelegram ? new HttpTelegramApi(env.TELEGRAM_BOT_TOKEN!) : null;
  const notify: Notifier = api
    ? {
        send: (text, buttons) => api.sendMessage(ownerId, text, buttons),
        edit: (id, text) => api.editMessage(ownerId, id, text),
      }
    : new ConsoleNotifier();

  const app = await buildApp({
    db,
    policy,
    env,
    notify,
    prices: simulated ? simulationPrices() : PriceTable.load(),
    providers: simulated ? simulationProviders() : undefined,
    simulated,
  });
  const gateway = api
    ? new TelegramGateway(api, db, ownerId, {
        onMessage: (text, id) => app.chief.onOwnerMessage(text, id),
        onApprovalButton: (approvalId, action) => app.chief.onApprovalButton(approvalId, action),
      })
    : undefined;
  const worker = new Worker({
    db,
    policy,
    chief: app.chief,
    notify,
    handlers: app.handlers,
    gateway,
    workerId: `${hostname()}-${process.pid}`,
    tz: app.tz,
  });

  const shutdown = () => {
    console.log("Stopping worker…");
    worker.stop();
    setTimeout(() => process.exit(0), 3_000).unref();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  const mode = simulated
    ? "🧪 SIMULATION mode (scripted AI, A$0, outputs labelled)"
    : "live providers";
  console.log(
    `Boma AI Workforce worker running — ${mode}. Telegram: ${gateway ? "on" : "off (console)"}`,
  );
  await notify.send(`👋 Worker started — ${mode}. Send /help for commands.`);
  await worker.start();
  await db.end();
}

main().catch((err) => {
  console.error(redact(err instanceof Error ? err.message : String(err)));
  process.exit(1);
});
