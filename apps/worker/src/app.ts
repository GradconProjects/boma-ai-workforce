import type pg from "pg";
import { loadBotSettings } from "@boma/bots";
import { DEFAULT_TZ, scopeLimit, type Env, type Policy } from "@boma/core";
import {
  AnthropicProvider,
  BudgetedLlm,
  DeepSeekProvider,
  MockProvider,
  OpenAIProvider,
  PriceTable,
  type LlmProvider,
  type ModelRef,
} from "@boma/llm";
import { DualReviewer } from "@boma/review";
import { ChiefOfStaff } from "./chief/chief";
import { draftCreativeHandler } from "./chief/draft-creative";
import { draftPostHandler } from "./chief/draft-post";
import { skillRunHandler } from "./chief/skill-run";
import type { Notifier } from "./chief/notifier";

/** Builds the Chief, reviewer and task handlers from env + database. Shared by worker and web. */

export interface AppOptions {
  db: pg.Pool;
  policy: Policy;
  env: Env;
  notify: Notifier;
  prices: PriceTable;
  /** Simulation: scripted providers, no network, no spend recorded against real APIs. */
  providers?: Partial<Record<"anthropic" | "openai" | "deepseek", LlmProvider>>;
  /** True when providers are the labelled simulation set. */
  simulated?: boolean;
  /** Absolute path of the built-in skills folder (default: ./skills). */
  skillsDir?: string;
  /** Public URL of the web app, for links in Telegram. */
  appUrl?: string;
}

/**
 * Which AI does which job (owner's routing, 14 Nov 2026):
 * - easy work (understanding messages, quick answers, simple skills) → DeepSeek
 * - deep reasoning (plans, strategy, drafting, most skills) → OpenAI
 * - checking the other AIs' work, and document formatting → Claude
 * Each role falls back to Claude when its provider isn't configured. Maker and checker are
 * always different providers, as the dual review requires.
 */
export function modelsFromEnv(env: Env) {
  const need = (v: string | undefined, name: string) => {
    if (!v) throw new Error(`${name} is not set in .env`);
    return v;
  };
  const claudeMaker: ModelRef = {
    provider: "anthropic",
    model: need(env.ANTHROPIC_MODEL_MAKER, "ANTHROPIC_MODEL_MAKER"),
  };
  const claudeCheap: ModelRef = {
    provider: "anthropic",
    model: need(env.ANTHROPIC_MODEL_CHEAP, "ANTHROPIC_MODEL_CHEAP"),
  };
  const on = (v?: string) => (v && !/^(off|none|disabled)$/i.test(v) ? v : undefined);
  const deepseek: ModelRef | undefined =
    env.DEEPSEEK_API_KEY && on(env.DEEPSEEK_MODEL)
      ? { provider: "deepseek", model: env.DEEPSEEK_MODEL! }
      : undefined;
  const openaiReasoning: ModelRef | undefined =
    env.OPENAI_API_KEY && on(env.OPENAI_MODEL_REASONING)
      ? { provider: "openai", model: env.OPENAI_MODEL_REASONING! }
      : undefined;

  const cheap = deepseek ?? claudeCheap;
  const planner = openaiReasoning ?? claudeMaker;
  const formatter = claudeMaker;

  let checker: ModelRef;
  let checkerStrong: ModelRef | undefined;
  if (planner.provider !== "anthropic") {
    checker = { provider: "anthropic", model: env.ANTHROPIC_MODEL_CHECKER ?? claudeMaker.model };
  } else if (env.OPENAI_MODEL_CHECKER) {
    checker = { provider: "openai", model: env.OPENAI_MODEL_CHECKER };
    checkerStrong = env.OPENAI_MODEL_CHECKER_STRONG
      ? { provider: "openai", model: env.OPENAI_MODEL_CHECKER_STRONG }
      : undefined;
  } else if (deepseek) {
    checker = deepseek;
  } else if (env.DEEPSEEK_MODEL) {
    checker = { provider: "deepseek", model: env.DEEPSEEK_MODEL };
  } else {
    throw new Error(
      "Set OPENAI_MODEL_REASONING, OPENAI_MODEL_CHECKER or DEEPSEEK_MODEL in .env so the dual review has a second AI",
    );
  }
  return { cheap, planner, checker, checkerStrong, formatter };
}

export async function buildApp(o: AppOptions) {
  const tz = o.env.TZ ?? DEFAULT_TZ;
  const models = modelsFromEnv(o.env);
  const providers = o.providers ?? {
    anthropic: new AnthropicProvider(),
    ...(o.env.OPENAI_API_KEY ? { openai: new OpenAIProvider() } : {}),
    ...(o.env.DEEPSEEK_API_KEY ? { deepseek: new DeepSeekProvider() } : {}),
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
  const skillsDir = o.skillsDir ?? "skills";
  const chief = new ChiefOfStaff({
    db: o.db,
    policy: o.policy,
    llm,
    notify: o.notify,
    models,
    tz,
    skills: { dir: skillsDir, passcode: o.env.SKILLS_PASSCODE },
  });
  const limits = {
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
  };
  const draftPost = draftPostHandler({
    db: o.db,
    policy: o.policy,
    reviewer,
    notify: o.notify,
    models,
    tz,
    limits,
    simulated: Boolean(o.simulated),
  });
  const draftCreative = draftCreativeHandler({
    db: o.db,
    policy: o.policy,
    reviewer,
    notify: o.notify,
    models,
    limits,
    simulated: Boolean(o.simulated),
  });
  const skillRun = skillRunHandler({
    db: o.db,
    policy: o.policy,
    llm,
    notify: o.notify,
    models,
    skillsDir,
    simulated: Boolean(o.simulated),
    limits: {
      chiefBotId: chiefBot.id,
      skillsMonthlyAud: await scopeLimit(
        o.db,
        "bot:skills",
        o.policy.budget.allocations.skills ?? 8,
      ),
    },
    appUrl: o.appUrl,
  });
  return { chief, llm, reviewer, handlers: [draftPost, draftCreative, skillRun], models, tz };
}

export { MockProvider };
