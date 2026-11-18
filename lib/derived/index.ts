/**
 * Derived state — the write/fetch half. Server-only: it takes a service-role client.
 *
 * Two concepts that previously had no module at all:
 *
 *   - Worker reliability, computed live from `task_logs` (see ./reliability.ts for why
 *     the cached columns are ignored rather than repaired).
 *   - Tree alert state, cached in `trees.derived_*` because there are ~1000 trees and
 *     the list page would otherwise aggregate per row.
 *
 * The split matters: reliability has a handful of subjects and can be recomputed on every
 * read, trees have a thousand and cannot. Callers don't need to know which is which —
 * that choice is exactly what these interfaces hide.
 */
import type { createAdminClient } from "@/lib/supabase/admin";
import {
  aggregateReliability,
  emptyReliability,
  type ReliabilityLogRow,
  type WorkerReliability,
} from "./reliability";
import type { TreeAlertSummary } from "./treeHealth";

type Admin = ReturnType<typeof createAdminClient>;

export * from "./reliability";
export * from "./treeHealth";

/**
 * Reliability for every worker, in one query.
 *
 * Returns a Map keyed by worker id; workers with no logs are simply absent, so callers
 * should fall back to `emptyReliability()`. Deliberately one round trip rather than one
 * per worker — the manager list renders every worker at once.
 */
export async function reliabilityByWorker(
  admin: Admin,
  now: Date = new Date(),
): Promise<Map<string, WorkerReliability>> {
  const { data, error } = await admin
    .from("task_logs")
    .select("worker_id, validation_status, submitted_at, form_opened_at");

  if (error) {
    console.error("reliabilityByWorker query failed:", error);
    return new Map();
  }

  return aggregateReliability((data ?? []) as ReliabilityLogRow[], now);
}

/** Reliability for one worker. Same aggregation, scoped by the query. */
export async function reliabilityFor(
  admin: Admin,
  workerId: string,
  now: Date = new Date(),
): Promise<WorkerReliability> {
  const { data, error } = await admin
    .from("task_logs")
    .select("worker_id, validation_status, submitted_at, form_opened_at")
    .eq("worker_id", workerId);

  if (error) {
    console.error("reliabilityFor query failed:", error);
    return emptyReliability();
  }

  return aggregateReliability((data ?? []) as ReliabilityLogRow[], now).get(workerId)
    ?? emptyReliability();
}

/** Open alerts against a tree, in the shape `treeHealthFrom` wants. */
export async function treeAlertSummary(admin: Admin, treeId: string): Promise<TreeAlertSummary> {
  const { data, error } = await admin
    .from("alerts")
    .select("tier")
    .eq("tree_id", treeId)
    .eq("status", "open");

  if (error) {
    console.error("treeAlertSummary query failed:", error);
    return { openAlerts: 0, hasTier1Alert: false };
  }

  const rows = data ?? [];
  return {
    openAlerts: rows.length,
    hasTier1Alert: rows.some((r) => r.tier === "tier_1"),
  };
}

/**
 * Recompute and persist a tree's cached derived state.
 *
 * Call this after anything that could change it: a submitted log, an alert raised, an
 * alert resolved or dismissed. It is idempotent and reads the truth back out of
 * `task_logs`/`alerts` rather than incrementing counters, so a missed call self-heals on
 * the next one.
 *
 * `derived_last_updated` holds the last log's `submitted_at` — the day count shown in the
 * UI is derived from it at render time (see `daysSinceLastLog`), never stored.
 */
export async function refreshTreeDerivedState(admin: Admin, treeId: string): Promise<void> {
  const [summary, { data: lastLog }] = await Promise.all([
    treeAlertSummary(admin, treeId),
    admin
      .from("task_logs")
      .select("submitted_at")
      .eq("tree_id", treeId)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const { error } = await admin
    .from("trees")
    .update({
      derived_open_alerts: summary.openAlerts,
      derived_last_updated: lastLog?.submitted_at ?? null,
    })
    .eq("tree_id", treeId);

  if (error) console.error("refreshTreeDerivedState update failed:", error);
}
