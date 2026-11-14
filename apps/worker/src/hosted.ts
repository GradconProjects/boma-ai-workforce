import { join } from "node:path";
import type pg from "pg";
import { listBotFiles, loadBotFile, syncBot } from "@boma/bots";
import { HttpTelegramApi, TelegramGateway } from "@boma/connectors";
import { loadPolicy, parseEnv, setStateOnce, type Env, type Policy } from "@boma/core";
import { migrateUp, readMigrations } from "@boma/db";
import { PriceTable } from "@boma/llm";
import { seedBrands } from "@boma/studio";
import { buildApp } from "./app";
import type { Notifier } from "./chief/notifier";
import { SIM_MODELS, simulationPrices, simulationProviders } from "./simulation";
import { Worker } from "./worker";
import { loadWorkspaceConfig, syncWorkspaces } from "./workspaces";

/**
 * Hosted (serverless) runtime: the same Chief, engine and handlers as the long-running worker,
 * driven by a Telegram webhook and a once-a-minute cron instead of loops. All file paths are
 * absolute from `root` because serverless functions don't run from the repo root.
 */

export interface HostedRuntime {
  policy: Policy;
  simulated: boolean;
  telegram: boolean;
  worker: Worker;
  gateway?: TelegramGateway;
  chief: Awaited<ReturnType<typeof buildApp>>["chief"];
}

export function isSimulated(env: Env): boolean {
  if (process.env.BOMA_SIMULATION === "1") return true;
  const checker =
    (env.OPENAI_API_KEY && env.OPENAI_MODEL_CHECKER) ||
    (env.DEEPSEEK_API_KEY && env.DEEPSEEK_MODEL);
  return !(
    env.ANTHROPIC_API_KEY &&
    env.ANTHROPIC_MODEL_MAKER &&
    env.ANTHROPIC_MODEL_CHEAP &&
    env.USD_TO_AUD_RATE &&
    checker
  );
}

/**
 * Once per deployment (keyed by commit): apply new migrations, sync bot files, workspace rules
 * and starter brands. Guarded by an advisory lock so concurrent cold starts don't race.
 */
export async function syncDeployment(db: pg.Pool, root: string, policy: Policy): Promise<boolean> {
  const client = await db.connect();
  try {
    await client.query("select pg_advisory_lock(7243002)");
    await migrateUp(client, readMigrations(join(root, "packages/db/migrations")));
    const key = `deploy_sync:${process.env.VERCEL_GIT_COMMIT_SHA ?? "local"}`;
    if (!(await setStateOnce(client, key, new Date().toISOString()))) return false;
    for (const f of listBotFiles(join(root, "bots"))) {
      const r = await syncBot(client as unknown as pg.Client, loadBotFile(f), policy);
      if (r.status === "rejected")
        throw new Error(`Bot ${r.slug} failed lint: ${r.errors.join("; ")}`);
    }
    await syncWorkspaces(client, loadWorkspaceConfig(join(root, "config/workspaces.yaml")));
    await seedBrands(client);
    return true;
  } finally {
    await client.query("select pg_advisory_unlock(7243002)").catch(() => undefined);
    client.release();
  }
}

export async function createHostedRuntime(
  db: pg.Pool,
  root: string,
  env: Env,
): Promise<HostedRuntime> {
  const policy = loadPolicy(join(root, "config/policy.yaml"));
  await syncDeployment(db, root, policy);
  const simulated = isSimulated(env);
  const runEnv = simulated
    ? parseEnv({
        ...process.env,
        ...SIM_MODELS,
        USD_TO_AUD_RATE: env.USD_TO_AUD_RATE ? String(env.USD_TO_AUD_RATE) : "1.5",
      })
    : env;

  const telegram = Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_OWNER_USER_ID);
  const ownerId = Number(env.TELEGRAM_OWNER_USER_ID);
  const api = telegram ? new HttpTelegramApi(env.TELEGRAM_BOT_TOKEN!) : null;
  // Without Telegram, messages are only logged; approvals still appear in the web Approval Centre.
  const notify: Notifier = api
    ? {
        send: (t, b) => api.sendMessage(ownerId, t, b),
        edit: (id, t) => api.editMessage(ownerId, id, t),
        deleteOwnerMessage: (id) => api.deleteMessage(ownerId, id),
      }
    : {
        send: async (t) => (console.log(`[owner] ${t.split("\n")[0]}`), 0),
        edit: async () => undefined,
      };

  const app = await buildApp({
    db,
    policy,
    env: runEnv,
    notify,
    prices: simulated ? simulationPrices() : PriceTable.load(join(root, "config/prices.yaml")),
    providers: simulated ? simulationProviders() : undefined,
    simulated,
    skillsDir: join(root, "skills"),
    appUrl:
      process.env.APP_URL ??
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : undefined),
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
    workerId: `vercel-${process.env.VERCEL_REGION ?? "local"}-${process.pid}`,
    tz: app.tz,
  });
  return { policy, simulated, telegram, worker, gateway, chief: app.chief };
}

/** One cron tick: maintenance, schedules, then run queued tasks until the time budget is spent. */
export async function cronTick(rt: HostedRuntime, budgetMs = 240_000) {
  const started = Date.now();
  await rt.worker.maintenanceTick();
  const fired = await rt.worker.scheduleTick();
  let ran = 0;
  while (Date.now() - started < budgetMs && (await rt.worker.engineTick())) ran++;
  return { ran, fired, simulated: rt.simulated, ms: Date.now() - started };
}
