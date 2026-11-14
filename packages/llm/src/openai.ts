import OpenAI from "openai";
import { redact } from "@boma/core";
import { toStrictJsonSchema } from "./schema";
import {
  ProviderError,
  ProviderUnavailableError,
  type LlmProvider,
  type LlmRequest,
  type RawResult,
} from "./types";

/** OpenAI Responses API adapter. Only packages/llm may import the SDK (eslint rule). */
export class OpenAIProvider implements LlmProvider {
  readonly name = "openai" as const;
  private client: OpenAI;

  constructor(client?: OpenAI) {
    // The SDK reads OPENAI_API_KEY itself; the key never passes through our code.
    this.client = client ?? new OpenAI({ maxRetries: 2 });
  }

  async complete(req: LlmRequest<unknown>): Promise<RawResult> {
    try {
      const r = await this.client.responses.create({
        model: req.model,
        instructions: req.system,
        input: req.input,
        max_output_tokens: req.maxOutputTokens,
        store: false, // do not keep owner content on the provider side
        ...(req.schema
          ? {
              text: {
                format: {
                  type: "json_schema" as const,
                  name: req.schemaName ?? "output",
                  schema: toStrictJsonSchema(req.schema),
                  strict: true,
                },
              },
            }
          : {}),
      });
      const refused = r.output.some(
        (item) => item.type === "message" && item.content.some((c) => c.type === "refusal"),
      );
      const truncated =
        r.status === "incomplete" && r.incomplete_details?.reason === "max_output_tokens";
      return {
        text: (r.output_text ?? "").trim(),
        model: r.model,
        usage: {
          inputTokens: r.usage?.input_tokens ?? 0,
          outputTokens: r.usage?.output_tokens ?? 0,
        },
        stopReason: refused
          ? "refusal"
          : truncated
            ? "max_tokens"
            : r.status === "completed"
              ? "end"
              : "other",
      };
    } catch (err) {
      throw mapError(err);
    }
  }
}

function mapError(err: unknown): Error {
  if (err instanceof OpenAI.APIConnectionError) {
    return new ProviderUnavailableError(`OpenAI unreachable: ${redact(err.message)}`);
  }
  if (err instanceof OpenAI.APIError) {
    const status = err.status ?? 0;
    const msg = `OpenAI API ${status}: ${redact(err.message)}`;
    return status === 429 || status >= 500
      ? new ProviderUnavailableError(msg)
      : new ProviderError(msg);
  }
  return err instanceof Error ? err : new Error(String(err));
}
