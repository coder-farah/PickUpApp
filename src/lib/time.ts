import { TZDate } from "@date-fns/tz";
import { addDays, differenceInMinutes, format } from "date-fns";

export const DEFAULT_TZ = "America/Los_Angeles";
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Wall-clock date and time in a timezone, turned into an absolute instant. DST-safe. */
export function zonedInstant(tz: string, y: number, monthIndex: number, d: number, hh: number, mm: number): Date {
  return new Date(new TZDate(y, monthIndex, d, hh, mm, 0, 0, tz).getTime());
}

export function parseHHMM(value: string): { hh: number; mm: number } {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!m) throw new Error(`Invalid time "${value}"`);
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) throw new Error(`Invalid time "${value}"`);
  return { hh, mm };
}

/**
 * Start instants of a weekly rule between `from` and `from + days`, computed on the
 * wall clock of `tz`, so 7:00 PM stays 7:00 PM across daylight saving changes.
 */
export function weeklyOccurrences(opts: {
  weekday: number;
  startTime: string;
  tz: string;
  from: Date;
  days: number;
}): Date[] {
  const { hh, mm } = parseHHMM(opts.startTime);
  const local = new TZDate(opts.from.getTime(), opts.tz);
  const out: Date[] = [];
  for (let i = 0; i <= opts.days; i++) {
    const day = addDays(local, i);
    if (day.getDay() !== opts.weekday) continue;
    const start = zonedInstant(opts.tz, day.getFullYear(), day.getMonth(), day.getDate(), hh, mm);
    if (start.getTime() > opts.from.getTime()) out.push(start);
  }
  return out;
}

export function inZone(date: Date, tz: string) {
  return new TZDate(date.getTime(), tz);
}

/** "Tue, Oct 20" */
export function fmtDay(date: Date, tz: string) {
  return format(inZone(date, tz), "EEE, MMM d");
}

/** "7:00 PM" */
export function fmtTime(date: Date, tz: string) {
  return format(inZone(date, tz), "h:mm a");
}

/** "Tue, Oct 20 · 7:00 PM" */
export function fmtWhen(date: Date, tz: string) {
  return `${fmtDay(date, tz)} · ${fmtTime(date, tz)}`;
}

/** Calendar key "2026-10-20" in the zone, for grouping by day. */
export function dayKey(date: Date, tz: string) {
  return format(inZone(date, tz), "yyyy-MM-dd");
}

/** "in 2h 5m", "in 3 days", "now" */
export function fmtRelative(target: Date, now = new Date()) {
  const mins = differenceInMinutes(target, now);
  if (Math.abs(mins) < 1) return "now";
  const future = mins > 0;
  const m = Math.abs(mins);
  let s: string;
  if (m < 60) s = `${m}m`;
  else if (m < 60 * 24) s = `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}`;
  else {
    const d = Math.round(m / 1440);
    s = `${d} day${d === 1 ? "" : "s"}`;
  }
  return future ? `in ${s}` : `${s} ago`;
}

/** "Thu 7:00 PM" — short form for when RSVPs open. */
export function fmtShortWhen(date: Date, tz: string) {
  return format(inZone(date, tz), "EEE h:mm a");
}

/** Parse an HTML date + time input pair in the given zone. */
export function parseLocalDateTime(dateStr: string, timeStr: string, tz: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) throw new Error("Invalid date");
  const { hh, mm } = parseHHMM(timeStr);
  return zonedInstant(tz, Number(m[1]), Number(m[2]) - 1, Number(m[3]), hh, mm);
}

export function fmtHHMM(value: string) {
  const { hh, mm } = parseHHMM(value);
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${hh < 12 ? "AM" : "PM"}`;
}
