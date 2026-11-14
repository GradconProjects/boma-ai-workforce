import type { z } from "zod";

export type ProviderName = "anthropic" | "openai";
export type Effort = "low" | "medium" | "high";

export const PROVIDER_LABEL: Record<ProviderName, string> = {
  anthropic: "Claude",
  openai: "OpenAI",
};

export interface ModelRef {
  provider: ProviderName;
  model: string;
}

export interface LlmRequest<T = unknown> {
  model: string;
  system: string;
  input: string;
  maxOutputTokens: number;
  /** When set, the provider is asked for JSON matching this schema and the result is validated. */
  schema?: z.ZodType<T>;
  schemaName?: string;
  effort?: Effort;
  /** Anthropic only: ask the API to re-run a declined request on a fallback model. */
  refusalFallback?: boolean;
}

export type StopReason = "end" | "max_tokens" | "refusal" | "other";

export interface RawResult {
  text: string;
  model: string;
  usage: { inputTokens: number; outputTokens: number };
  stopReason: StopReason;
}

export interface LlmProvider {
  readonly name: ProviderName;
  complete(req: LlmRequest<unknown>): Promise<RawResult>;
}

/** Temporary: rate limit, overload, 5xx, network or timeout. Safe to retry later. */
export class ProviderUnavailableError extends Error {}
/** Request rejected for a reason retrying will not fix (bad request, auth, ...). */
export class ProviderError extends Error {}
/** The model declined the request. */
export class RefusalError extends Error {}
/** Output was not valid JSON for the requested schema (or was cut off). */
export class MalformedOutputError extends Error {}
/** No price on file for this model: the gateway will not call it. */
export class UnpricedModelError extends Error {}
