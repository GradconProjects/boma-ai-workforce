import { describe, expect, it } from "vitest";
import { cronMatches, minuteKey, monthStartUtc } from "./time";

const at = (iso: string) => new Date(iso);
const BRIEF = "30 7 * * *";

describe("Sydney schedules (E4 / T25 daylight saving)", () => {
  it("07:30 brief fires at 07:30 Sydney before daylight saving starts (AEST, UTC+10)", () => {
    // Sat 3 Oct 2026, 07:30 AEST = Fri 2 Oct 21:30 UTC
    expect(cronMatches(BRIEF, at("2026-10-02T21:30:00Z"))).toBe(true);
    expect(cronMatches(BRIEF, at("2026-10-02T20:30:00Z"))).toBe(false);
  });

  it("07:30 brief fires at 07:30 Sydney after daylight saving starts (AEDT, UTC+11)", () => {
    // DST starts Sun 4 Oct 2026 02:00. Mon 5 Oct 07:30 AEDT = Sun 4 Oct 20:30 UTC
    expect(cronMatches(BRIEF, at("2026-10-04T20:30:00Z"))).toBe(true);
    expect(cronMatches(BRIEF, at("2026-10-04T21:30:00Z"))).toBe(false);
  });

  it("fires exactly once on the changeover day itself", () => {
    // Sun 4 Oct 2026: scan every minute of the UTC day around the change.
    let hits = 0;
    for (
      let t = at("2026-10-03T12:00:00Z").getTime();
      t < at("2026-10-04T12:00:00Z").getTime();
      t += 60_000
    ) {
      if (cronMatches(BRIEF, new Date(t))) hits++;
    }
    expect(hits).toBe(1);
  });

  it("handles the end of daylight saving (April) too", () => {
    // DST ends Sun 5 Apr 2026 03:00 → 02:00. Mon 6 Apr 07:30 AEST = Sun 5 Apr 21:30 UTC
    expect(cronMatches(BRIEF, at("2026-04-05T21:30:00Z"))).toBe(true);
    expect(cronMatches("0 18 * * *", at("2026-04-06T08:00:00Z"))).toBe(true);
  });

  it("supports lists, ranges, steps and weekdays", () => {
    expect(cronMatches("*/15 9-17 * * 1-5", at("2026-11-16T03:45:00Z"))).toBe(true); // Mon 14:45 AEDT
    expect(cronMatches("*/15 9-17 * * 1-5", at("2026-11-15T03:45:00Z"))).toBe(false); // Sunday
    expect(() => cronMatches("61 * * * *", new Date())).toThrow();
  });

  it("month boundaries follow Sydney time, not UTC", () => {
    // 1 Nov 2026 00:00 AEDT = 31 Oct 13:00 UTC
    expect(monthStartUtc(at("2026-11-14T00:00:00Z")).toISOString()).toBe(
      "2026-10-31T13:00:00.000Z",
    );
    // 1 Jul 2026 00:00 AEST = 30 Jun 14:00 UTC
    expect(monthStartUtc(at("2026-07-20T00:00:00Z")).toISOString()).toBe(
      "2026-06-30T14:00:00.000Z",
    );
    expect(minuteKey(at("2026-10-04T20:30:00Z"))).toBe("2026-10-05 07:30");
  });
});
