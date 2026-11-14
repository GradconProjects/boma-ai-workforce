import { createHash, timingSafeEqual } from "node:crypto";
import { audit, getState, setState, type Queryable } from "@boma/core";

/**
 * Owner passcode for high-risk skills. A correct passcode unlocks a channel (Telegram or web)
 * for a short window; repeated wrong attempts lock the passcode out for a while.
 */
export type UnlockChannel = "telegram" | "web";

export const UNLOCK_MINUTES = 30;
const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60_000;

interface Attempts {
  failures: number;
  windowStart: number;
  lockedUntil: number;
}

export function passcodeConfigured(expected: string | undefined): boolean {
  return Boolean(expected && expected.length >= 6);
}

function same(a: string, b: string): boolean {
  return timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest(),
  );
}

export type UnlockResult =
  | { ok: true; until: Date }
  | { ok: false; reason: "not_configured" | "locked_out" | "wrong"; retryAt?: Date };

export async function tryUnlock(
  db: Queryable,
  channel: UnlockChannel,
  presented: string,
  expected: string | undefined,
  now = new Date(),
): Promise<UnlockResult> {
  if (!passcodeConfigured(expected)) return { ok: false, reason: "not_configured" };
  const a: Attempts = (await getState<Attempts>(db, "skills_passcode_attempts")) ?? {
    failures: 0,
    windowStart: now.getTime(),
    lockedUntil: 0,
  };
  if (a.lockedUntil > now.getTime())
    return { ok: false, reason: "locked_out", retryAt: new Date(a.lockedUntil) };

  if (same(presented.trim(), expected!)) {
    const until = new Date(now.getTime() + UNLOCK_MINUTES * 60_000);
    await setState(db, `skills_unlocked:${channel}`, until.toISOString());
    await setState(db, "skills_passcode_attempts", {
      failures: 0,
      windowStart: now.getTime(),
      lockedUntil: 0,
    });
    await audit(db, {
      actor: "owner",
      action: "skills.unlock",
      target: channel,
      result: `until ${until.toISOString()}`,
    });
    return { ok: true, until };
  }

  const fresh = now.getTime() - a.windowStart > WINDOW_MS;
  const failures = (fresh ? 0 : a.failures) + 1;
  const lockedUntil = failures >= MAX_FAILURES ? now.getTime() + WINDOW_MS : 0;
  await setState(db, "skills_passcode_attempts", {
    failures,
    windowStart: fresh ? now.getTime() : a.windowStart,
    lockedUntil,
  });
  await audit(db, {
    actor: `channel:${channel}`,
    action: "skills.unlock_failed",
    target: channel,
    result: `failure ${failures}`,
  });
  return lockedUntil
    ? { ok: false, reason: "locked_out", retryAt: new Date(lockedUntil) }
    : { ok: false, reason: "wrong" };
}

export async function isUnlocked(
  db: Queryable,
  channel: UnlockChannel,
  now = new Date(),
): Promise<boolean> {
  const until = await getState<string>(db, `skills_unlocked:${channel}`);
  return Boolean(until && new Date(until).getTime() > now.getTime());
}

export async function lockSkills(db: Queryable, channel?: UnlockChannel): Promise<void> {
  for (const c of channel ? [channel] : (["telegram", "web"] as const))
    await setState(db, `skills_unlocked:${c}`, null);
}
