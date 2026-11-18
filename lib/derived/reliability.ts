/**
 * Worker reliability — shapes and formatting (the pure half).
 *
 * The numbers are computed in Postgres by the `worker_stats` view (013_views.sql) from
 * `effective_task_logs`, so corrected records count once and voided ones not at all.
 * They used to be folded in JS from every task_logs row, which PostgREST silently caps
 * at 1000 rows — so totals stopped growing once a farm had real volume.
 *
 * No Supabase import: client components share these shapes and formatters.
 */
import type { WorkerStats } from "@/types/database";

/** Rolling window, in days, for the "recent" figures. Must match worker_stats. */
export const RELIABILITY_WINDOW_DAYS = 90;

export interface ReliabilityWindow {
  logsTotal: number;
  /** Logs that tripped a check (GPS, timing, out-of-range value…) and need review. */
  logsFlagged: number;
  /** 0..1. Zero when there are no logs — check `logsTotal` before trusting it. */
  flagRate: number;
  /** Mean seconds between opening the form and submitting it. Zero when no logs. */
  avgCompletionSeconds: number;
}

export interface WorkerReliability {
  allTime: ReliabilityWindow;
  /** The trailing `RELIABILITY_WINDOW_DAYS`. A worker who was sloppy once can recover here. */
  recent: ReliabilityWindow;
  lastLogAt: string | null;
}

function windowOf(total: number, flagged: number, avgSeconds: number): ReliabilityWindow {
  return {
    logsTotal: total,
    logsFlagged: flagged,
    flagRate: total > 0 ? flagged / total : 0,
    avgCompletionSeconds: avgSeconds,
  };
}

export function emptyReliability(): WorkerReliability {
  return { allTime: windowOf(0, 0, 0), recent: windowOf(0, 0, 0), lastLogAt: null };
}

export function reliabilityFromStats(row: WorkerStats | null | undefined): WorkerReliability {
  if (!row) return emptyReliability();
  return {
    allTime: windowOf(row.logs_total, row.logs_flagged, Number(row.avg_completion_seconds)),
    recent: windowOf(row.recent_logs_total, row.recent_logs_flagged, Number(row.recent_avg_completion_seconds)),
    lastLogAt: row.last_log_at,
  };
}

/** `0.0374` → `"3.7%"`. Shared so the list and the detail page can't drift apart. */
export function formatFlagRate(window: ReliabilityWindow): string {
  if (window.logsTotal === 0) return "—";
  return `${(window.flagRate * 100).toFixed(1)}%`;
}

/** Seconds, rounded; em dash when there's nothing to average. Unit label is the caller's. */
export function formatAvgCompletion(window: ReliabilityWindow): string {
  if (window.avgCompletionSeconds <= 0) return "—";
  return String(Math.round(window.avgCompletionSeconds));
}
