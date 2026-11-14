import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { createHostedRuntime, type HostedRuntime } from "@boma/worker/hosted";
import { db, env, ROOT } from "./server";

/** One hosted runtime per serverless instance (reused across warm invocations). */
const g = globalThis as unknown as { __bomaRuntime?: Promise<HostedRuntime> };

export function runtime(): Promise<HostedRuntime> {
  g.__bomaRuntime ??= createHostedRuntime(db(), ROOT, env()).catch((err) => {
    g.__bomaRuntime = undefined; // retry on the next request
    throw err;
  });
  return g.__bomaRuntime;
}

/** Constant-time comparison of a presented secret with the expected one. */
export function secretMatches(
  presented: string | null | undefined,
  expected: string | undefined,
): boolean {
  if (!presented || !expected) return false;
  const a = createHash("sha256").update(presented).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
