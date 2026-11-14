import "server-only";
import { createHmac, timingSafeEqual, createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import pg from "pg";
import { loadPolicy, parseEnv, type Env, type Policy } from "@boma/core";

/** Server-only helpers: env (repo-root .env), database pool, policy, owner session. */

const ROOT = resolve(
  process.cwd(),
  existsSync(resolve(process.cwd(), "config/policy.yaml")) ? "." : "../..",
);

let envCache: Env | undefined;
export function env(): Env {
  if (!envCache) {
    const file = resolve(ROOT, ".env");
    if (existsSync(file)) process.loadEnvFile(file);
    envCache = parseEnv(process.env);
  }
  return envCache;
}

const g = globalThis as unknown as { __bomaPool?: pg.Pool; __bomaPolicy?: Policy };

export function db(): pg.Pool {
  if (!g.__bomaPool) {
    const url = env().DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set in .env");
    g.__bomaPool = new pg.Pool({ connectionString: url, max: 5 });
  }
  return g.__bomaPool;
}

export function policy(): Policy {
  g.__bomaPolicy ??= loadPolicy(resolve(ROOT, "config/policy.yaml"));
  return g.__bomaPolicy;
}

// ───────────── owner session ─────────────

const COOKIE = "boma_session";
const MAX_AGE_S = 60 * 60 * 24 * 14;

function sessionKey(): Buffer {
  const e = env();
  const base = e.SECRETS_ENCRYPTION_KEY ?? e.OWNER_PASSWORD;
  if (!base) throw new Error("OWNER_PASSWORD is not set in .env");
  return createHash("sha256").update(`boma-session:${base}`).digest();
}

function sign(payload: string): string {
  return createHmac("sha256", sessionKey()).update(payload).digest("base64url");
}

export function passwordConfigured(): boolean {
  return Boolean(env().OWNER_PASSWORD);
}

export function checkPassword(input: string): boolean {
  const expected = env().OWNER_PASSWORD;
  if (!expected) return false;
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function startSession(): Promise<void> {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_S;
  const payload = `owner.${exp}`;
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_S,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export async function isOwner(): Promise<boolean> {
  if (!passwordConfigured()) return false;
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return false;
  const i = raw.lastIndexOf(".");
  const payload = raw.slice(0, i);
  const sig = raw.slice(i + 1);
  const expected = sign(payload);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected)))
    return false;
  const exp = Number(payload.split(".")[1]);
  return Number.isFinite(exp) && exp > Date.now() / 1000;
}

/** Use at the top of every page and server action that touches owner data. */
export async function requireOwner(): Promise<void> {
  if (!(await isOwner())) redirect("/login");
}
