/**
 * Tree health — the pure half.
 *
 * `trees.derived_health_score` was declared as a 0..1 number with no formula anywhere in
 * the codebase, so every tree rendered a green 100% badge. Inventing a horticultural
 * health formula is a farm decision, not a code decision, so health is now stated only
 * in terms of something the system actually knows: how many alerts are open against the
 * tree, and whether any of them is tier 1.
 *
 * `derived_health_score` is consequently no longer read anywhere. It remains in the
 * schema (dropping a column would break other branches mid-flight) but it is dead —
 * see CONTEXT.md.
 *
 * No Supabase import here: client components share these functions with the server.
 */

/** ปกติ / เฝ้าระวัง / ต้องดูแลด่วน. Ordered by increasing concern. */
export type TreeHealth = "ok" | "watch" | "attention";

export interface TreeAlertSummary {
  openAlerts: number;
  hasTier1Alert: boolean;
}

/**
 * A tier-1 alert means "act now" regardless of count, so it short-circuits. Otherwise
 * the thresholds are deliberately coarse — they describe how many open items a manager
 * is looking at, and nothing more.
 */
export function treeHealthFrom({ openAlerts, hasTier1Alert }: TreeAlertSummary): TreeHealth {
  if (hasTier1Alert || openAlerts >= 3) return "attention";
  if (openAlerts >= 1) return "watch";
  return "ok";
}

/**
 * Days since the tree was last logged, derived from a stored timestamp.
 *
 * The old `derived_days_since_last_log` column stored the integer `0` on every submit and
 * never counted up, so a tree logged six months ago still read "0 days ago". A day count
 * is a function of *when you ask*, so it cannot be cached as an integer at all — only the
 * timestamp can. Returns null for a tree that has never been logged.
 */
export function daysSinceLastLog(
  lastUpdated: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!lastUpdated) return null;
  const then = Date.parse(lastUpdated);
  if (!Number.isFinite(then)) return null;
  const days = Math.floor((now.getTime() - then) / 86_400_000);
  return days < 0 ? 0 : days;
}
