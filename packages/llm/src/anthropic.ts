import Anthropic from "@anthropic-ai/sdk";
import { redact } from "@boma/core";
import { toStrictJsonSchema } from "./schema";
import {
  ProviderError,
  ProviderUnavailableError,
  type LlmProvider,
  type LlmRequest,
  type RawResult,
  type StopReason,
} from "./types";

/** Anthropic Messages API adapter. Only packages/llm may import the SDK (eslint rule). */
export class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic" as const;
  private client: Anthropic;

  constructor(client?: Anthropic) {
    // The SDK reads ANTHROPIC_API_KEY itself; the key never passes through our code.
    this.client = client ?? new Anthropic({ maxRetries: 2 });
  }

  async complete(req: LlmRequest<unknown>): Promise<RawResult> {
    const params = {
      model: req.model,
      max_tokens: req.maxOutputTokens,
      system: req.system,
      messages: [{ role: "user" as const, content: req.input }],
      output_config: {
        ...(req.effort ? { effort: req.effort } : {}),
        ...(req.schema
          ? { format: { type: "json_schema" as const, schema: toStrictJsonSchema(req.schema) } }
          : {}),
      },
    };
    try {
      const msg = req.refusalFallback
        ? await this.client.beta.messages.create({
            ...params,
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
          })
        : await this.client.messages.create(params);
      const text = msg.content
        .flatMap((b) => (b.type === "text" ? [b.text] : []))
        .join("")
        .trim();
      return {
        text,
        model: msg.model,
        usage: { inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens },
        stopReason: mapStop(msg.stop_reason),
      };
    } catch (err) {
      throw mapError(err);
    }
  }
}

function mapStop(s: string | null): StopReason {
  if (s === "end_turn" || s === "stop_sequence") return "end";
  if (s === "max_tokens") return "max_tokens";
  if (s === "refusal") return "refusal";
  return "other";
}

function mapError(err: unknown): Error {
  if (err instanceof Anthropic.APIConnectionError) {
    return new ProviderUnavailableError(`Anthropic unreachable: ${redact(err.message)}`);
  }
  if (err instanceof Anthropic.APIError) {
    const status = err.status ?? 0;
    const msg = `Anthropic API ${status}: ${redact(err.message)}`;
    return status === 429 || status >= 500
      ? new ProviderUnavailableError(msg)
      : new ProviderError(msg);
  }
  return err instanceof Error ? err : new Error(String(err));
}
