"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { replaceQuery } from "@/lib/client/replaceQuery";
import { useT } from "@/lib/i18n/LanguageContext";
import { flagLabel, sortTaskDefs, taskLabel, validationStatusLabel } from "@/lib/i18n/labels";
import { taskDisplayName } from "@/lib/i18n/t";
import { useLogGrades, useLogs, useOverview, useTaskDefs, useWorkers, type LogFilters } from "@/lib/client/queries";
import { formatDateTime, RANGE_KEYS, type RangeKey } from "@/lib/time";
import { parseZoneKey, zoneKey } from "@/lib/treeId";
import { chipClass, validationBadgeClass } from "@/lib/ui/badges";
import { ErrorState, RefreshBar } from "@/components/QueryState";
import type { DictKey } from "@/lib/i18n/dictionary";

const RANGE_LABEL: Record<RangeKey, DictKey> = {
  today: "rangeToday", week: "rangeWeek", month: "rangeMonth", year: "rangeYear", all: "rangeAll",
};
const GRADE_ORDER = ["A", "B", "C", "reject"];

export default function LogsPage() {
  return (
    <Suspense>
      <Logs />
    </Suspense>
  );
}

/**
 * Every task log, filterable by period / zone / task / worker / status. The dashboard's
 * Logs and Fruit-harvested tiles open this page pre-filtered to the slice they counted.
 * Filters live in the URL, so a filtered view can be bookmarked or shared.
 */
function Logs() {
  const { lang, tr } = useT();
  const params = useSearchParams();
  const taskDefs = useTaskDefs();
  const workers = useWorkers();
  const overview = useOverview(); // cached — only for the zone list

  const filters: LogFilters = {
    range: (RANGE_KEYS as string[]).includes(params.get("range") ?? "") ? params.get("range")! : "all",
    zone: parseZoneKey(params.get("zone")) ? params.get("zone")! : "",
    task: params.get("task") ?? "",
    worker: params.get("worker") ?? "",
    status: ["passed", "flagged"].includes(params.get("status") ?? "") ? params.get("status")! : "",
    page: Math.max(0, Number(params.get("page") ?? 0) || 0),
  };
  const logs = useLogs(filters);
  const gradeFilters = { range: filters.range, zone: filters.zone, task: filters.task, worker: filters.worker, status: filters.status };
  const grades = useLogGrades(gradeFilters, filters.task === "harvest");

  const setFilter = (key: keyof LogFilters, value: string) => {
    const qs = new URLSearchParams(params);
    if (value) qs.set(key, value); else qs.delete(key);
    if (key !== "page") qs.delete("page");
    replaceQuery(qs, { scrollTop: key === "page" });
  };

  const totalPages = logs.data ? Math.max(1, Math.ceil(logs.data.total / logs.data.pageSize)) : 1;
  const tasks = sortTaskDefs(taskDefs.data ?? []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-ink">
          {tr("logsTitle")}{logs.data ? ` (${logs.data.total})` : ""}
        </h1>
        <RefreshBar updatedAt={logs.dataUpdatedAt || undefined} fetching={logs.isFetching} onRefresh={() => logs.refetch()} />
      </div>

      <div className="mb-4 space-y-2">
        <div className="flex flex-wrap gap-2" role="group" aria-label={tr("filterRange")}>
          {RANGE_KEYS.map((r) => (
            <button key={r} type="button" aria-pressed={filters.range === r} onClick={() => setFilter("range", r === "all" ? "" : r)} className={chipClass(filters.range === r)}>
              {tr(RANGE_LABEL[r])}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label={tr("zoneLabel")}>
          <button type="button" aria-pressed={!filters.zone} onClick={() => setFilter("zone", "")} className={chipClass(!filters.zone)}>
            {tr("filterZoneAll")}
          </button>
          {overview.data?.zones.map((z) => {
            const key = zoneKey(z.zone, z.side);
            return (
              <button key={key} type="button" aria-pressed={filters.zone === key} onClick={() => setFilter("zone", key)} className={chipClass(filters.zone === key)}>
                {key}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Select id="f-task" label={tr("filterTask")} value={filters.task} onChange={(v) => setFilter("task", v)}>
            <option value="">{tr("allOption")}</option>
            {tasks.map((d) => <option key={d.task_def_id} value={d.task_type}>{d.icon} {taskDisplayName(d, lang)}</option>)}
          </Select>
          <Select id="f-worker" label={tr("filterWorker")} value={filters.worker} onChange={(v) => setFilter("worker", v)}>
            <option value="">{tr("allOption")}</option>
            {(workers.data ?? []).map((w) => <option key={w.worker_id} value={w.worker_id}>{w.users?.display_name ?? "—"}</option>)}
          </Select>
          <Select id="f-status" label={tr("filterStatus")} value={filters.status} onChange={(v) => setFilter("status", v)}>
            <option value="">{tr("allOption")}</option>
            <option value="passed">{tr("validationPassed")}</option>
            <option value="flagged">{tr("validationFlagged")}</option>
          </Select>
        </div>
      </div>

      {grades.data && (
        <section className="mb-4 rounded-lg border border-line bg-surface p-4" aria-label={tr("gradeSummaryTitle")}>
          <h2 className="mb-2 text-sm font-semibold text-body">
            {tr("gradeSummaryTitle")} · {Object.values(grades.data).reduce((a, b) => a + b, 0)} {tr("fruitCountUnit")}
          </h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(grades.data)
              .sort((a, b) => GRADE_ORDER.indexOf(a[0]) - GRADE_ORDER.indexOf(b[0]))
              .map(([g, n]) => (
                <span key={g} className="rounded-full border border-line bg-surface-alt px-3 py-1.5 text-xs font-semibold text-body">
                  {g === "reject" ? tr("gradeLabelReject") : g}: {n}
                </span>
              ))}
          </div>
        </section>
      )}

      {logs.isError && !logs.data && <ErrorState error={logs.error} onRetry={() => logs.refetch()} />}
      {logs.isPending && (
        <div className="space-y-2">{[1, 2, 3, 4].map((i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-surface-alt" />)}</div>
      )}
      {logs.data && logs.data.logs.length === 0 && (
        <div className="rounded-lg border border-line bg-surface p-8 text-center text-muted">{tr("noLogsYet")}</div>
      )}

      <ul className={`space-y-2 transition-opacity ${logs.isPlaceholderData ? "opacity-60" : ""}`}>
        {logs.data?.logs.map((log) => (
          <li key={log.log_id}>
            <Link href={`/logs/${log.log_id}`} className="flex min-h-14 items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3 active:bg-surface-alt">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">
                  {log.tree_id} · {taskLabel(log.task_def_id, taskDefs.data, lang)}
                  {log.latest_correction_id && <span className="ml-1.5 text-xs font-normal text-muted">({tr("correctedBadge")})</span>}
                </p>
                <p className="truncate text-xs text-muted">
                  {formatDateTime(log.submitted_at, lang)} · {log.worker_name ?? "—"} · {zoneKey(log.zone, log.side)}
                </p>
              </div>
              <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${validationBadgeClass(log.validation_status)}`}>
                {log.validation_status === "flagged" && log.validation_flags[0]
                  ? flagLabel(log.validation_flags[0], lang)
                  : validationStatusLabel(log.validation_status, lang)}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {logs.data && totalPages > 1 && (
        <nav className="mt-4 flex items-center justify-center gap-3" aria-label="pagination">
          <button
            type="button"
            disabled={filters.page === 0}
            onClick={() => setFilter("page", String(filters.page - 1))}
            className="inline-flex min-h-11 items-center rounded-lg border border-line bg-surface px-4 text-sm font-semibold text-body disabled:opacity-40"
          >
            ‹
          </button>
          <span className="text-sm text-muted">{filters.page + 1} / {totalPages}</span>
          <button
            type="button"
            disabled={filters.page + 1 >= totalPages}
            onClick={() => setFilter("page", String(filters.page + 1))}
            className="inline-flex min-h-11 items-center rounded-lg border border-line bg-surface px-4 text-sm font-semibold text-body disabled:opacity-40"
          >
            ›
          </button>
        </nav>
      )}
    </div>
  );
}

function Select({
  id, label, value, onChange, children,
}: { id: string; label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-muted">{label}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink"
      >
        {children}
      </select>
    </div>
  );
}
