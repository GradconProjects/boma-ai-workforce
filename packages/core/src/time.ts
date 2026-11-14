/**
 * Time helpers. Everything is stored in UTC; schedules and month boundaries are evaluated in
 * the owner's timezone (Australia/Sydney) so daylight saving is handled by the platform's tz
 * database rather than by fixed offsets.
 */
export const DEFAULT_TZ = "Australia/Sydney";

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0 = Sunday
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const fmtCache = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
    });
    fmtCache.set(tz, f);
  }
  return f;
}

export function zonedParts(date: Date, tz = DEFAULT_TZ): ZonedParts {
  const parts = Object.fromEntries(
    formatter(tz)
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: WEEKDAYS.indexOf(String(parts.weekday)),
  };
}

/** Offset of tz from UTC at the given instant, in milliseconds. */
function tzOffsetMs(date: Date, tz: string): number {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return asUtc - Math.floor(date.getTime() / 60000) * 60000;
}

/** The UTC instant of local midnight on the 1st of the current month in tz. */
export function monthStartUtc(now: Date, tz = DEFAULT_TZ): Date {
  const p = zonedParts(now, tz);
  const guess = Date.UTC(p.year, p.month - 1, 1);
  let instant = guess - tzOffsetMs(new Date(guess), tz);
  instant = guess - tzOffsetMs(new Date(instant), tz); // correct across a DST change
  return new Date(instant);
}

/** "YYYY-MM" for the current month in tz. */
export function monthKey(now: Date, tz = DEFAULT_TZ): string {
  const p = zonedParts(now, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}`;
}

/** "YYYY-MM-DD HH:MM" in tz, used as a once-per-minute key for schedules. */
export function minuteKey(now: Date, tz = DEFAULT_TZ): string {
  const p = zonedParts(now, tz);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}`;
}

/** Human-friendly local time for messages, e.g. "Sat 14 Nov, 7:30 am". */
export function formatLocal(date: Date, tz = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function parseField(field: string, min: number, max: number): Set<number> {
  const out = new Set<number>();
  for (const part of field.split(",")) {
    const [range, stepStr] = part.split("/");
    const step = stepStr === undefined ? 1 : Number(stepStr);
    let lo: number;
    let hi: number;
    if (range === "*") [lo, hi] = [min, max];
    else if (range!.includes("-")) [lo, hi] = range!.split("-").map(Number) as [number, number];
    else {
      lo = Number(range);
      hi = stepStr === undefined ? lo : max;
    }
    if (![lo, hi, step].every(Number.isInteger) || lo < min || hi > max || step < 1 || lo > hi) {
      throw new Error(`Invalid cron field "${field}"`);
    }
    for (let v = lo; v <= hi; v += step) out.add(v);
  }
  return out;
}

/** Does a 5-field cron expression match the given instant (minute resolution) in tz? */
export function cronMatches(expr: string, date: Date, tz = DEFAULT_TZ): boolean {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) throw new Error(`Cron needs 5 fields: "${expr}"`);
  const [mi, ho, dom, mo, dow] = fields as [string, string, string, string, string];
  const p = zonedParts(date, tz);
  const dows = parseField(dow, 0, 7);
  if (dows.has(7)) dows.add(0);
  const domMatch = parseField(dom, 1, 31).has(p.day);
  const dowMatch = dows.has(p.weekday);
  // Standard cron: when both day fields are restricted, either may match.
  const dayOk = dom !== "*" && dow !== "*" ? domMatch || dowMatch : domMatch && dowMatch;
  return (
    parseField(mi, 0, 59).has(p.minute) &&
    parseField(ho, 0, 23).has(p.hour) &&
    parseField(mo, 1, 12).has(p.month) &&
    dayOk
  );
}
