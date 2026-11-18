/**
 * Derived state — server-side fetchers over the SQL views (013_views.sql).
 *
 * Nothing derived is stored any more: worker reliability (`worker_stats`) and tree
 * status (`tree_summary`) are computed in Postgres on read. There is no cache to refresh
 * after a write, so the old `refreshTreeDerivedState` call sites are gone.
 */
import type { createAdminClient } from "@/lib/supabase/admin";
import type { WorkerStats } from "@/types/database";
import { reliabilityFromStats, type WorkerReliability } from "./reliability";

type Admin = ReturnType<typeof createAdminClient>;

export * from "./reliability";
export * from "./treeHealth";

/** Reliability for every worker in one query, keyed by worker id. */
export async function reliabilityByWorker(admin: Admin): Promise<Map<string, WorkerReliability>> {
  const { data, error } = await admin.from("worker_stats").select("*").returns<WorkerStats[]>();
  if (error) console.error("worker_stats query failed:", error);
  return new Map((data ?? []).map((row) => [row.worker_id, reliabilityFromStats(row)]));
}

/** Reliability for one worker. */
export async function reliabilityFor(admin: Admin, workerId: string): Promise<WorkerReliability> {
  const { data, error } = await admin
    .from("worker_stats")
    .select("*")
    .eq("worker_id", workerId)
    .maybeSingle<WorkerStats>();
  if (error) console.error("worker_stats query failed:", error);
  return reliabilityFromStats(data);
}
