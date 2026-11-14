import OpenAI from "openai";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { DeepSeekProvider } from "./deepseek";
import { parseStructured } from "./schema";
import { MalformedOutputError, ProviderUnavailableError } from "./types";

/** A stand-in for the OpenAI SDK client pointed at DeepSeek: records requests, never networks. */
function fakeClient(reply: { content: string | null; finish?: string } | Error) {
  const calls: Record<string, unknown>[] = [];
  const client = {
    chat: {
      completions: {
        create: async (body: Record<string, unknown>) => {
          calls.push(body);
          if (reply instanceof Error) throw reply;
          return {
            model: body.model,
            choices: [
              { message: { content: reply.content }, finish_reason: reply.finish ?? "stop" },
            ],
            usage: { prompt_tokens: 120, completion_tokens: 40 },
          };
        },
      },
    },
  };
  return { client: client as unknown as OpenAI, calls };
}

const schema = z.object({ verdict: z.enum(["pass", "revise"]), score: z.number() });

describe("DeepSeek adapter", () => {
  it("uses JSON mode with the schema in the system prompt (DeepSeek has no json_schema mode)", async () => {
    const { client, calls } = fakeClient({ content: '{"verdict":"pass","score":90}' });
    const r = await new DeepSeekProvider(client).complete({
      model: "deepseek-flash",
      system: "Review it.",
      input: "x",
      maxOutputTokens: 500,
      schema,
      schemaName: "v",
    });
    expect(calls[0]).toMatchObject({
      model: "deepseek-flash",
      max_tokens: 500,
      response_format: { type: "json_object" },
    });
    const sys = (calls[0]!.messages as { content: string }[])[0]!.content;
    expect(sys).toContain("json object");
    expect(sys).toContain('"verdict"');
    expect(r).toMatchObject({ stopReason: "end", usage: { inputTokens: 120, outputTokens: 40 } });
    expect(parseStructured(r.text, schema)).toEqual({ verdict: "pass", score: 90 });
  });

  it("blank content (DeepSeek's response when output isn't JSON) is treated as malformed", async () => {
    const { client } = fakeClient({ content: "   " });
    const r = await new DeepSeekProvider(client).complete({
      model: "deepseek-flash",
      system: "s",
      input: "i",
      maxOutputTokens: 100,
      schema,
    });
    expect(() => parseStructured(r.text, schema)).toThrow(MalformedOutputError);
  });

  it("maps truncation and rate limits", async () => {
    const t = await new DeepSeekProvider(
      fakeClient({ content: "{", finish: "length" }).client,
    ).complete({ model: "m", system: "s", input: "i", maxOutputTokens: 10 });
    expect(t.stopReason).toBe("max_tokens");
    const limited = new OpenAI.RateLimitError(
      429,
      { message: "slow down" },
      "slow down",
      new Headers(),
    );
    await expect(
      new DeepSeekProvider(fakeClient(limited).client).complete({
        model: "m",
        system: "s",
        input: "i",
        maxOutputTokens: 10,
      }),
    ).rejects.toThrow(ProviderUnavailableError);
  });
});
