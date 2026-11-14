import { describe, expect, it } from "vitest";
import { parseEnv } from "@boma/core";
import { modelsFromEnv } from "./app";

const base = {
  ANTHROPIC_API_KEY: "x",
  ANTHROPIC_MODEL_MAKER: "claude-sonnet-5-5",
  ANTHROPIC_MODEL_CHEAP: "claude-haiku-5-5",
};

describe("AI role routing", () => {
  it("easy → DeepSeek, deep reasoning → OpenAI, checking + formatting → Claude", () => {
    const m = modelsFromEnv(
      parseEnv({
        ...base,
        ANTHROPIC_MODEL_CHECKER: "claude-opus-5-5",
        OPENAI_API_KEY: "x",
        OPENAI_MODEL_REASONING: "gpt-6.1-sol",
        DEEPSEEK_API_KEY: "x",
        DEEPSEEK_MODEL: "deepseek-flash",
      }),
    );
    expect(m.cheap).toEqual({ provider: "deepseek", model: "deepseek-flash" });
    expect(m.planner).toEqual({ provider: "openai", model: "gpt-6.1-sol" });
    expect(m.checker).toEqual({ provider: "anthropic", model: "claude-opus-5-5" });
    expect(m.formatter.provider).toBe("anthropic");
  });

  it("maker and checker are never the same provider", () => {
    const onlyDeepseek = modelsFromEnv(
      parseEnv({ ...base, DEEPSEEK_API_KEY: "x", DEEPSEEK_MODEL: "deepseek-flash" }),
    );
    expect(onlyDeepseek.planner.provider).toBe("anthropic");
    expect(onlyDeepseek.checker.provider).toBe("deepseek");
    const openaiChecker = modelsFromEnv(parseEnv({ ...base, OPENAI_MODEL_CHECKER: "gpt-6-luna" }));
    expect(openaiChecker.checker.provider).toBe("openai");
    expect(openaiChecker.planner.provider).toBe("anthropic");
  });

  it("a configured model without its key is not used", () => {
    const m = modelsFromEnv(
      parseEnv({
        ...base,
        OPENAI_MODEL_REASONING: "gpt-6.1-sol",
        DEEPSEEK_MODEL: "deepseek-flash",
      }),
    );
    expect(m.planner.provider).toBe("anthropic");
    expect(m.cheap.provider).toBe("anthropic");
  });
});
