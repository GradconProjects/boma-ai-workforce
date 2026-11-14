import { hostname } from "node:os";
import pg from "pg";
import { listBotFiles, loadBotFile, syncBot } from "@boma/bots";
import { HttpTelegramApi, TelegramGateway } from "@boma/connectors";
import { loadEnv, loadPolicy, redact, requireEnv } from "@boma/core";
import { migrateUp } from "@boma/db";
import { PriceTable } from "@boma/llm";
import { buildApp } from "./app";
import type { Notifier } from "./chief/notifier";
import { Worker } from "./worker";
import { loadWorkspaceConfig, syncWorkspaces } from "./workspaces";

/** Worker entry point: pnpm worker. Runs on the owner's PC first (hybrid plan). */
async function main() {
  const env = requireEnv(loadEnv(), [
    "DATABASE_URL",
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_OWNER_USER_ID",
    "ANTHROPIC_API_KEY",
    "ANTHROPIC_MODEL_MAKER",
    "ANTHROPIC_MODEL_CHEAP",
    "OPENAI_API_KEY",
    "OPENAI_MODEL_CHECKER",
    "USD_TO_AUD_RATE",
  ]);
  const policy = loadPolicy();
  const db = new pg.Pool({ connectionString: env.DATABASE_URL, max: 5 });

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

  const ownerId = Number(env.TELEGRAM_OWNER_USER_ID);
  const api = new HttpTelegramApi(env.TELEGRAM_BOT_TOKEN);
  const notify: Notifier = {
    send: (text, buttons) => api.sendMessage(ownerId, text, buttons),
    edit: (id, text) => api.editMessage(ownerId, id, text),
  };
  const app = await buildApp({ db, policy, env, notify, prices: PriceTable.load() });
  const gateway = new TelegramGateway(api, db, ownerId, {
    onMessage: (text, id) => app.chief.onOwnerMessage(text, id),
    onApprovalButton: (approvalId, action) => app.chief.onApprovalButton(approvalId, action),
  });
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
  console.log("Boma AI Workforce worker running. Send /help to your bot on Telegram.");
  await notify.send("👋 Worker started. Send /help for commands.");
  await worker.start();
  await db.end();
}

main().catch((err) => {
  console.error(redact(err instanceof Error ? err.message : String(err)));
  process.exit(1);
});
