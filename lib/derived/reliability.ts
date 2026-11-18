/**
 * Worker reliability — the pure half.
 *
 * `workers.reliability_*` was declared in migration 002 with the comment "recomputed
 * by background job". That job was never written, so every column held its SQL default
 * and the manager UI rendered `0 logs / 0.0% flag rate` for every worker regardless of
 * what they had actually submitted. Rather than resurrect the job, reliability is now
 * computed from `task_logs` on read — there are a handful of workers, the aggregate is
 * one query, and a computed number cannot go stale.
 *
 * This file is deliberately free of any Supabase import so client components can share
 * the same shapes and formatting. The fetch lives in `./index.ts`.
 */

/** Rolling window, in days, for the "recent" figures shown beside the all-time ones. */
export const RELIABILITY_WINDOW_DAYS = 90;

export interface ReliabilityWindow {
  logsTotal: number;
  logsFlagged: number;
  /** 0..1. Zero when there are no logs — callers should check `logsTotal` before trusting it. */
  flagRate: number;
  /** Mean seconds between opening the form and submitting it. Zero when there are no logs. */
  avgCompletionSeconds: number;
}

export interface WorkerReliability {
  allTime: ReliabilityWindow;
  /** The trailing `RELIABILITY_WINDOW_DAYS`. A worker who was sloppy once can recover here. */
  recent: ReliabilityWindow;
}

/** The columns `aggregateReliability` needs. Kept narrow so the query stays cheap. */
export interface ReliabilityLogRow {
  worker_id: string;
  validation_status: string;
  submitted_at: string;
  form_opened_at: string;
}

const EMPTY_WINDOW: ReliabilityWindow = {
  logsTotal: 0,
  logsFlagged: 0,
  flagRate: 0,
  avgCompletionSeconds: 0,
};

export function emptyReliability(): WorkerReliability {
  return { allTime: { ...EMPTY_WINDOW }, recent: { ...EMPTY_WINDOW } };
}

/** Running tallies, folded into a `ReliabilityWindow` once every row has been seen. */
interface Tally {
  total: number;
  flagged: number;
  completionSecondsSum: number;
  completionSamples: number;
}

function newTally(): Tally {
  return { total: 0, flagged: 0, completionSecondsSum: 0, completionSamples: 0 };
}

function addRow(tally: Tally, row: ReliabilityLogRow): void {
  tally.total += 1;
  if (row.validation_status === "flagged") tally.flagged += 1;

  const opened = Date.parse(row.form_opened_at);
  const submitted = Date.parse(row.submitted_at);
  // A clock skew or a malformed timestamp shouldn't drag the average negative.
  if (Number.isFinite(opened) && Number.isFinite(submitted) && submitted >= opened) {
    tally.completionSecondsSum += (submitted - opened) / 1000;
    tally.completionSamples += 1;
  }
}

function toWindow(tally: Tally): ReliabilityWindow {
  return {
    logsTotal: tally.total,
    logsFlagged: tally.flagged,
    flagRate: tally.total > 0 ? tally.flagged / tally.total : 0,
    avgCompletionSeconds:
      tally.completionSamples > 0 ? tally.completionSecondsSum / tally.completionSamples : 0,
  };
}

/**
 * Fold raw log rows into per-worker reliability.
 *
 * Pure: same rows and same `now` always give the same answer, which is what makes the
 * whole metric testable without a database.
 */
export function aggregateReliability(
  rows: ReliabilityLogRow[],
  now: Date = new Date(),
): Map<string, WorkerReliability> {
  const cutoff = now.getTime() - RELIABILITY_WINDOW_DAYS * 86_400_000;
  const allTime = new Map<string, Tally>();
  const recent = new Map<string, Tally>();

  for (const row of rows) {
    let all = allTime.get(row.worker_id);
    if (!all) {
      all = newTally();
      allTime.set(row.worker_id, all);
      recent.set(row.worker_id, newTally());
    }
    addRow(all, row);

    if (Date.parse(row.submitted_at) >= cutoff) {
      addRow(recent.get(row.worker_id)!, row);
    }
  }

  const result = new Map<string, WorkerReliability>();
  for (const [workerId, tally] of allTime) {
    result.set(workerId, {
      allTime: toWindow(tally),
      recent: toWindow(recent.get(workerId)!),
    });
  }
  return result;
}

/** `0.0374` → `"3.7%"`. Shared so the list and the detail page can't drift apart. */
export function formatFlagRate(window: ReliabilityWindow): string {
  if (window.logsTotal === 0) return "—";
  return `${(window.flagRate * 100).toFixed(1)}%`;
}

/** `92.4` → `"92s"`. Returns an em dash when there's nothing to average. */
export function formatAvgCompletion(window: ReliabilityWindow): string {
  if (window.avgCompletionSeconds <= 0) return "—";
  return `${Math.round(window.avgCompletionSeconds)}s`;
}
