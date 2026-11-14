import type pg from "pg";
import { loadBotSettings } from "@boma/bots";
import { DEFAULT_TZ, scopeLimit, type Env, type Policy } from "@boma/core";
import {
  AnthropicProvider,
  BudgetedLlm,
  MockProvider,
  OpenAIProvider,
  PriceTable,
  type LlmProvider,
  type ModelRef,
} from "@boma/llm";
import { DualReviewer } from "@boma/review";
import { ChiefOfStaff } from "./chief/chief";
import { draftPostHandler } from "./chief/draft-post";
import type { Notifier } from "./chief/notifier";

/** Builds the Chief, reviewer and task handlers from env + database. Shared by worker and web. */

export interface AppOptions {
  db: pg.Pool;
  policy: Policy;
  env: Env;
  notify: Notifier;
  prices: PriceTable;
  /** Simulation: scripted providers, no network, no spend recorded against real APIs. */
  providers?: Partial<Record<"anthropic" | "openai", LlmProvider>>;
}

export function modelsFromEnv(env: Env) {
  const need = (v: string | undefined, name: string) => {
    if (!v) throw new Error(`${name} is not set in .env`);
    return v;
  };
  const cheap: ModelRef = {
    provider: "anthropic",
    model: need(env.ANTHROPIC_MODEL_CHEAP, "ANTHROPIC_MODEL_CHEAP"),
  };
  const planner: ModelRef = {
    provider: "anthropic",
    model: need(env.ANTHROPIC_MODEL_MAKER, "ANTHROPIC_MODEL_MAKER"),
  };
  const checker: ModelRef = {
    provider: "openai",
    model: need(env.OPENAI_MODEL_CHECKER, "OPENAI_MODEL_CHECKER"),
  };
  const checkerStrong: ModelRef | undefined = env.OPENAI_MODEL_CHECKER_STRONG
    ? { provider: "openai", model: env.OPENAI_MODEL_CHECKER_STRONG }
    : undefined;
  return { cheap, planner, checker, checkerStrong };
}

export async function buildApp(o: AppOptions) {
  const tz = o.env.TZ ?? DEFAULT_TZ;
  const models = modelsFromEnv(o.env);
  const providers = o.providers ?? {
    anthropic: new AnthropicProvider(),
    openai: new OpenAIProvider(),
  };
  const llm = new BudgetedLlm({
    db: o.db,
    policy: o.policy,
    prices: o.prices,
    fxUsdToAud: o.env.USD_TO_AUD_RATE,
    providers,
    tz,
    onWarn: async (s) => {
      await o.notify.send(
        `⚠️ AI spend has reached A$${s.spentAud.toFixed(2)} this month (warning level A$${s.warnAud.toFixed(2)}, stop at A$${s.hardStopAud.toFixed(2)}).`,
      );
    },
  });
  const reviewer = new DualReviewer(o.db, llm);
  const chiefBot = await loadBotSettings(o.db, "chief-of-staff");
  const chief = new ChiefOfStaff({ db: o.db, policy: o.policy, llm, notify: o.notify, models, tz });
  const draftPost = draftPostHandler({
    db: o.db,
    policy: o.policy,
    reviewer,
    notify: o.notify,
    models,
    tz,
    limits: {
      chiefBotId: chiefBot.id,
      chiefMonthlyAud: await scopeLimit(
        o.db,
        "bot:chief-of-staff",
        o.policy.budget.allocations["chief-of-staff"] ?? chiefBot.frontmatter.budget.monthly_aud,
      ),
      reviewMonthlyAud: await scopeLimit(
        o.db,
        "dual-review",
        o.policy.budget.allocations["dual-review"] ?? 5,
      ),
      taskMaxAud: chiefBot.frontmatter.budget.max_task_aud,
    },
  });
  return { chief, llm, reviewer, handlers: [draftPost], models, tz };
}

export { MockProvider };
