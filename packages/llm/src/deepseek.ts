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

/**
 * DeepSeek adapter. DeepSeek's API is OpenAI-compatible (Chat Completions at
 * https://api.deepseek.com) but only offers JSON mode (`response_format: json_object`), not
 * schema-enforced output. So the schema goes in the system prompt (the docs require the word
 * "json" and an example), and every reply is still validated by the gateway with zod; blank or
 * invalid JSON becomes a MalformedOutputError that the review's one-retry rule handles.
 *
 * Data note: DeepSeek processes requests on its own servers outside Australia. Keep it out of
 * personal/finance workflows unless the owner opts in.
 */
export const DEEPSEEK_BASE_URL = "https://api.deepseek.com";

export class DeepSeekProvider implements LlmProvider {
  readonly name = "deepseek" as const;
  private client: OpenAI;

  constructor(client?: OpenAI) {
    // Reads DEEPSEEK_API_KEY from the environment; the key never passes through our code.
    this.client =
      client ??
      new OpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: DEEPSEEK_BASE_URL,
        maxRetries: 2,
      });
  }

  async complete(req: LlmRequest<unknown>): Promise<RawResult> {
    const system = req.schema
      ? `${req.system}\n\nRespond with a single json object only, no prose, matching this JSON Schema exactly:\n${JSON.stringify(toStrictJsonSchema(req.schema))}`
      : req.system;
    try {
      const r = await this.client.chat.completions.create({
        model: req.model,
        max_tokens: req.maxOutputTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: req.input },
        ],
        ...(req.schema ? { response_format: { type: "json_object" as const } } : {}),
      });
      const choice = r.choices[0];
      const finish = choice?.finish_reason;
      return {
        text: (choice?.message?.content ?? "").trim(),
        model: r.model,
        usage: {
          inputTokens: r.usage?.prompt_tokens ?? 0,
          outputTokens: r.usage?.completion_tokens ?? 0,
        },
        stopReason:
          finish === "stop"
            ? "end"
            : finish === "length"
              ? "max_tokens"
              : finish === "content_filter"
                ? "refusal"
                : "other",
      };
    } catch (err) {
      if (err instanceof OpenAI.APIConnectionError) {
        throw new ProviderUnavailableError(`DeepSeek unreachable: ${redact(err.message)}`);
      }
      if (err instanceof OpenAI.APIError) {
        const status = err.status ?? 0;
        const msg = `DeepSeek API ${status}: ${redact(err.message)}`;
        throw status === 429 || status >= 500
          ? new ProviderUnavailableError(msg)
          : new ProviderError(msg);
      }
      throw err;
    }
  }
}
