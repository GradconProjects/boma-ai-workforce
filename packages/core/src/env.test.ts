import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { envSchema, EnvError, parseEnv, requireEnv } from "./env";
import { FAKE } from "./fixtures";

describe("env loading", () => {
  it("accepts an empty environment (every phase opts in to what it needs)", () => {
    const env = parseEnv({});
    expect(env.TZ).toBe("Australia/Sydney");
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
  });

  it("treats blank values as unset", () => {
    expect(parseEnv({ OPENAI_API_KEY: "   " }).OPENAI_API_KEY).toBeUndefined();
  });

  it("validates formats", () => {
    expect(() => parseEnv({ TELEGRAM_OWNER_USER_ID: "@boma" })).toThrow(/TELEGRAM_OWNER_USER_ID/);
    expect(() => parseEnv({ USD_TO_AUD_RATE: "150" })).toThrow(/USD_TO_AUD_RATE/);
    expect(() => parseEnv({ SECRETS_ENCRYPTION_KEY: "short" })).toThrow(/SECRETS_ENCRYPTION_KEY/);
    expect(() => parseEnv({ FACEBOOK_GRAPH_VERSION: "21" })).toThrow(/FACEBOOK_GRAPH_VERSION/);
    const ok = parseEnv({
      SECRETS_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
      USD_TO_AUD_RATE: "1.53",
      TELEGRAM_OWNER_USER_ID: "123456",
      FACEBOOK_GRAPH_VERSION: "v21.0",
    });
    expect(ok.USD_TO_AUD_RATE).toBe(1.53);
  });

  it("never puts a secret value in an error message", () => {
    const bad = {
      SECRETS_ENCRYPTION_KEY: FAKE.openaiKey,
      TELEGRAM_OWNER_USER_ID: FAKE.telegramToken,
    };
    try {
      parseEnv(bad);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(EnvError);
      const msg = (err as Error).message;
      expect(msg).not.toContain(FAKE.openaiKey);
      expect(msg).not.toContain(FAKE.telegramToken);
    }
  });

  it("requireEnv lists missing key names", () => {
    expect(() => requireEnv(parseEnv({}), ["DATABASE_URL", "ANTHROPIC_API_KEY"])).toThrow(
      "Missing required settings in .env: DATABASE_URL, ANTHROPIC_API_KEY",
    );
  });

  it("schema and .env.example list exactly the same keys", () => {
    const example = readFileSync(new URL("../../../.env.example", import.meta.url), "utf8");
    const keys = [...example.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]).sort();
    expect(keys).toEqual(Object.keys(envSchema.shape).sort());
  });
  it("ignores a host-set TZ that isn't a real time zone (Vercel sets :UTC)", () => {
    expect(parseEnv({ TZ: ":UTC" }).TZ).toBe("Australia/Sydney");
    expect(parseEnv({ TZ: "Australia/Melbourne" }).TZ).toBe("Australia/Melbourne");
  });
});
