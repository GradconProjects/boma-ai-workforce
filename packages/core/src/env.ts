import { existsSync } from "node:fs";
import { z } from "zod";

/**
 * Environment settings (names mirror .env.example). Everything is optional at load time;
 * each phase calls requireEnv() for the keys it needs. Errors name keys, never values
 * (CLAUDE.md rule 3).
 */
const blankToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : typeof v === "string" ? v.trim() : v;

const str = () => z.preprocess(blankToUndefined, z.string().optional());

function decodedKeyLength(v: string): number {
  if (/^[0-9a-fA-F]{64}$/.test(v)) return 32;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(v)) return -1;
  return Buffer.from(v, "base64").length;
}

export const envSchema = z.object({
  DATABASE_URL: str(),
  SUPABASE_URL: z.preprocess(blankToUndefined, z.url().optional()),
  SUPABASE_SERVICE_ROLE_KEY: str(),

  ANTHROPIC_API_KEY: str(),
  ANTHROPIC_MODEL_MAKER: str(),
  ANTHROPIC_MODEL_CHEAP: str(),

  OPENAI_API_KEY: str(),
  OPENAI_MODEL_CHECKER: str(),
  OPENAI_MODEL_CHECKER_STRONG: str(),

  TELEGRAM_BOT_TOKEN: str(),
  TELEGRAM_OWNER_USER_ID: z.preprocess(
    blankToUndefined,
    z.string().regex(/^\d+$/, "must be numeric").optional(),
  ),

  META_APP_ID: str(),
  META_APP_SECRET: str(),
  FACEBOOK_PAGE_ID: str(),
  FACEBOOK_PAGE_ACCESS_TOKEN: str(),
  FACEBOOK_GRAPH_VERSION: z.preprocess(
    blankToUndefined,
    z
      .string()
      .regex(/^v\d+\.\d+$/, "must look like v21.0")
      .optional(),
  ),

  USD_TO_AUD_RATE: z.preprocess(
    blankToUndefined,
    z.coerce.number().positive().max(5, "looks wrong (USD to AUD should be about 1.5)").optional(),
  ),
  SECRETS_ENCRYPTION_KEY: z.preprocess(
    blankToUndefined,
    z
      .string()
      .refine((v) => decodedKeyLength(v) === 32, "must decode to exactly 32 bytes (hex or base64)")
      .optional(),
  ),
  TZ: z.preprocess(blankToUndefined, z.string().default("Australia/Sydney")),

  OWNER_PASSWORD: z.preprocess(
    blankToUndefined,
    z.string().min(12, "must be at least 12 characters").optional(),
  ),
});

export type Env = z.infer<typeof envSchema>;
export type EnvKey = keyof Env;

export class EnvError extends Error {}

/** Parse an env record. Issues list key names and reasons only. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const picked: Record<string, string | undefined> = {};
  for (const key of Object.keys(envSchema.shape)) picked[key] = source[key];
  const result = envSchema.safeParse(picked);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new EnvError(`Invalid environment settings:\n  ${problems.join("\n  ")}`);
  }
  return result.data;
}

/** Load .env (if present) into process.env, then parse. */
export function loadEnv(path = ".env"): Env {
  if (existsSync(path)) process.loadEnvFile(path);
  return parseEnv(process.env);
}

export function requireEnv<K extends EnvKey>(env: Env, keys: K[]): Env & Required<Pick<Env, K>> {
  const missing = keys.filter((k) => env[k] === undefined);
  if (missing.length > 0) {
    throw new EnvError(`Missing required settings in .env: ${missing.join(", ")}`);
  }
  return env as Env & Required<Pick<Env, K>>;
}
