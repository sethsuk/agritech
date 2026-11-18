/**
 * The ONE place dates and times are formatted or bucketed.
 *
 * The farm is in Thailand, so every date the app shows or computes is Bangkok time —
 * regardless of the viewer's device timezone (a manager travelling abroad) or the
 * server's (Vercel runs in UTC, which used to make "today" start at 07:00 Bangkok and
 * stamp dawn-shift blooms with yesterday's date).
 *
 * Thailand has no daylight saving: Bangkok is always UTC+7, which is what makes the
 * plain-arithmetic helpers below exact.
 *
 * Safe on client and server. Never call `toLocaleString()` / `toISOString().slice(0,10)`
 * / `setHours(0)` on a date elsewhere — add a helper here instead.
 */
import type { Lang } from "@/lib/i18n/t";

export const BKK_TZ = "Asia/Bangkok";
const BKK_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Thai uses the Buddhist-era year (2569); Burmese and English use Gregorian. */
const LOCALE: Record<Lang, string> = { th: "th-TH", my: "my-MM", en: "en-GB" };

type DateLike = string | number | Date;
const toDate = (d: DateLike) => (d instanceof Date ? d : new Date(d));

/** "17 พ.ย. 2569 14:05" — date + time, Bangkok. */
export function formatDateTime(d: DateLike, lang: Lang): string {
  return new Intl.DateTimeFormat(LOCALE[lang], {
    timeZone: BKK_TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(toDate(d));
}

/**
 * "17 พ.ย. 2569" — date only. Accepts a timestamp, or a plain `yyyy-mm-dd` DATE column
 * value, which is treated as a Bangkok calendar date (not shifted by any timezone).
 */
export function formatDate(d: DateLike, lang: Lang): string {
  const date = typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)
    ? new Date(`${d}T12:00:00+07:00`) // noon Bangkok: unambiguous calendar day
    : toDate(d);
  return new Intl.DateTimeFormat(LOCALE[lang], {
    timeZone: BKK_TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/** Bangkok calendar date of an instant, as `yyyy-mm-dd`. */
export function bkkDate(d: DateLike = new Date()): string {
  return new Date(toDate(d).getTime() + BKK_OFFSET_MS).toISOString().slice(0, 10);
}

/** Today in Bangkok, `yyyy-mm-dd`. */
export function todayBkk(): string {
  return bkkDate();
}

/** `yyyy-mm-dd` + n days → `yyyy-mm-dd` (pure calendar arithmetic). */
export function addDays(isoDate: string, n: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Whole days between an instant and now (never negative). Null for null input. */
export function daysSince(d: DateLike | null | undefined, now: Date = new Date()): number | null {
  if (d === null || d === undefined) return null;
  const then = toDate(d).getTime();
  if (!Number.isFinite(then)) return null;
  return Math.max(0, Math.floor((now.getTime() - then) / 86_400_000));
}

export type RangeKey = "today" | "week" | "month" | "year" | "all";
export const RANGE_KEYS: RangeKey[] = ["today", "week", "month", "year", "all"];

/**
 * Start of a Bangkok calendar period as an instant: today 00:00, this week's Monday
 * 00:00, the 1st of this month, Jan 1. `all` → null (no lower bound).
 *
 * Mirrors the bounds computed in SQL by dashboard_snapshot(); the dashboard uses the
 * server's values, this is for pages that filter client-side or build queries.
 */
export function rangeStart(range: RangeKey, now: Date = new Date()): Date | null {
  if (range === "all") return null;
  // Shift into "Bangkok wall clock as if it were UTC", truncate, shift back.
  const local = new Date(now.getTime() + BKK_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const d = local.getUTCDate();
  let startLocal: number;
  if (range === "today") startLocal = Date.UTC(y, m, d);
  else if (range === "month") startLocal = Date.UTC(y, m, 1);
  else if (range === "year") startLocal = Date.UTC(y, 0, 1);
  else {
    const dow = (local.getUTCDay() + 6) % 7; // Monday = 0
    startLocal = Date.UTC(y, m, d - dow);
  }
  return new Date(startLocal - BKK_OFFSET_MS);
}

/** Bangkok calendar year of an instant. */
export function bkkYear(d: DateLike = new Date()): number {
  return Number(bkkDate(d).slice(0, 4));
}

export type PlantedDateProblem = "dateNotReal" | "dateInFuture" | "dateTooOld";

/**
 * Validate a planted date (`yyyy-mm-dd`). Shared by the tree forms and the API so the
 * browser and server agree. Returns a dictionary key naming the problem, or null.
 */
export function plantedDateProblem(iso: string, today: string = todayBkk()): PlantedDateProblem | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return "dateNotReal";
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) {
    return "dateNotReal";
  }
  if (y < 1950) return "dateTooOld";
  if (iso > today) return "dateInFuture";
  return null;
}
