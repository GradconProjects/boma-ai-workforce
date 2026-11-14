import {
  audit,
  budgetStatus,
  companyLimits,
  reconcile,
  releaseReservation,
  reserve,
  setStateOnce,
  type BudgetScope,
  type BudgetStatus,
  type Policy,
  type Queryable,
} from "@boma/core";
import { estimateTokens, type PriceTable } from "./prices";
import { parseStructured } from "./schema";
import {
  MalformedOutputError,
  RefusalError,
  type LlmProvider,
  type LlmRequest,
  type ProviderName,
  type RawResult,
} from "./types";

/**
 * Budget gateway (CLAUDE.md rule 8): estimate → reserve → call → reconcile.
 * This is the only path from the system to a paid model call.
 */

export interface GatewayDeps {
  db: Queryable;
  policy: Policy;
  prices: PriceTable;
  /** USD→AUD rate. Undefined means billable calls are refused (cannot enforce an AUD budget). */
  fxUsdToAud: number | undefined;
  providers: Partial<Record<ProviderName, LlmProvider>>;
  tz?: string;
  /** Called once per month when spend crosses the warning threshold. */
  onWarn?: (status: BudgetStatus) => Promise<void> | void;
}

export interface CallContext {
  scope: BudgetScope;
  /** Who is calling, for the audit log, e.g. "bot:chief-of-staff". */
  actor: string;
  botId?: string | null;
  taskId?: string | null;
  scopeMonthlyAud?: number;
  taskMaxAud?: number;
}

export interface GatewayResult<T> {
  raw: RawResult;
  parsed: T;
  costAud: number;
}

export class FxRateMissingError extends Error {}

export class BudgetedLlm {
  constructor(private deps: GatewayDeps) {}

  hasProvider(name: ProviderName): boolean {
    return Boolean(this.deps.providers[name]);
  }

  async call<T>(
    providerName: ProviderName,
    req: LlmRequest<T>,
    ctx: CallContext,
  ): Promise<GatewayResult<T>> {
    const { db, prices, policy } = this.deps;
    const provider = this.deps.providers[providerName];
    if (!provider) throw new Error(`Provider ${providerName} is not configured`);
    const fx = this.deps.fxUsdToAud;
    if (!fx) throw new FxRateMissingError("USD_TO_AUD_RATE is not set; refusing billable calls");

    // 1. Estimate (worst case: full output allowance).
    const estAud = prices.costAud(
      providerName,
      req.model,
      estimateTokens(req.system + req.input),
      req.maxOutputTokens,
      fx,
    );

    // 2. Reserve against company, scope and task limits (throws BudgetBlockedError).
    const company = await companyLimits(db, policy);
    const reservation = await reserve(db, {
      scope: ctx.scope,
      botId: ctx.botId,
      taskId: ctx.taskId,
      provider: providerName,
      amountAud: estAud,
      limits: { ...company, scopeMonthlyAud: ctx.scopeMonthlyAud, taskMaxAud: ctx.taskMaxAud },
      tz: this.deps.tz,
    });

    // 3. Call.
    let raw: RawResult;
    try {
      raw = await provider.complete(req as LlmRequest<unknown>);
    } catch (err) {
      await releaseReservation(db, reservation);
      throw err;
    }

    // 4. Reconcile with actual usage (billed even if the output later fails validation).
    const costAud = prices.costAud(
      providerName,
      req.model,
      raw.usage.inputTokens,
      raw.usage.outputTokens,
      fx,
    );
    await reconcile(db, reservation, {
      amountAud: costAud,
      tokensIn: raw.usage.inputTokens,
      tokensOut: raw.usage.outputTokens,
    });
    await audit(db, {
      actor: ctx.actor,
      action: "llm.call",
      target: `${providerName}/${req.model}`,
      inputs: { system: req.system, input: req.input },
      outputs: raw.text,
      costAud,
      result: raw.stopReason,
    });
    await this.checkWarn();

    if (raw.stopReason === "refusal")
      throw new RefusalError(`${providerName} declined the request`);
    if (req.schema && raw.stopReason === "max_tokens")
      throw new MalformedOutputError(
        `${providerName} reply was cut off at the ${req.maxOutputTokens}-token limit`,
      );
    const parsed = req.schema ? parseStructured(raw.text, req.schema) : (raw.text as T);
    return { raw, parsed, costAud };
  }

  private async checkWarn() {
    if (!this.deps.onWarn) return;
    const status = await budgetStatus(this.deps.db, this.deps.policy, new Date(), this.deps.tz);
    if (status.warn && (await setStateOnce(this.deps.db, `budget_warn:${status.month}`, true))) {
      await this.deps.onWarn(status);
    }
  }
}
