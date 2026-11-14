import { describe, expect, it } from "vitest";
import { FAKE } from "./fixtures";
import { findSecrets, redact } from "./secrets";

describe("secret detection", () => {
  it.each(Object.entries(FAKE))("detects %s", (_name, value) => {
    expect(findSecrets(`note: ${value}`).length).toBeGreaterThan(0);
  });

  it("ignores empty .env.example style lines and env key references", () => {
    const text = [
      "ANTHROPIC_API_KEY=",
      "TELEGRAM_BOT_TOKEN=             # from @BotFather",
      "maker: { provider: anthropic, model_env: ANTHROPIC_MODEL_MAKER }",
      'schedule: ["0 6 * * *"]      # daily token health check',
      "DATABASE_URL=postgres://postgres:postgres@localhost:5432/boma",
    ].join("\n");
    expect(findSecrets(text)).toEqual([]);
  });

  it("reports line numbers, never values", () => {
    const findings = findSecrets(`a\nb\nkey ${FAKE.anthropicKey}`);
    expect(findings[0]).toMatchObject({ line: 3 });
    expect(JSON.stringify(findings)).not.toContain(FAKE.anthropicKey);
  });

  it("redacts secrets from log text", () => {
    const out = redact(`failed with token ${FAKE.telegramToken} and ${FAKE.openaiKey}`);
    expect(out).not.toContain(FAKE.telegramToken);
    expect(out).not.toContain(FAKE.openaiKey);
    expect(out).toContain("[REDACTED:");
  });
});
