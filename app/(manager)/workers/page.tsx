"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { replaceQuery } from "@/lib/client/replaceQuery";
import { useT } from "@/lib/i18n/LanguageContext";
import { useWorkers, type WorkerRow } from "@/lib/client/queries";
import { formatAvgCompletion, formatFlagRate, type ReliabilityWindow } from "@/lib/derived/reliability";
import { chipClass, TRUST_TIER } from "@/lib/ui/badges";
import { InfoTip } from "@/components/InfoTip";
import { ErrorState, RefreshBar } from "@/components/QueryState";

export default function WorkersPage() {
  return (
    <Suspense>
      <Workers />
    </Suspense>
  );
}

/**
 * Every worker with live reliability (worker_stats view), loaded once and cached.
 * Deactivated workers are kept (their history matters) behind a filter, so they can be
 * found and reactivated — they used to vanish from the UI entirely.
 */
function Workers() {
  const { tr } = useT();
  const params = useSearchParams();
  const workers = useWorkers();
  const showInactive = params.get("inactive") === "1";

  const all = workers.data ?? [];
  const visible = all.filter((w) => w.active !== showInactive);
  const inactiveCount = all.filter((w) => !w.active).length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">{tr("navWorkers")}{workers.data ? ` (${visible.length})` : ""}</h1>
          <RefreshBar updatedAt={workers.dataUpdatedAt || undefined} fetching={workers.isFetching} onRefresh={() => workers.refetch()} />
        </div>
        <Link
          href="/workers/new"
          className="flex h-11 flex-shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-white active:bg-primary-press"
        >
          {tr("addWorkerButton")}
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button type="button" aria-pressed={!showInactive} onClick={() => replaceQuery("")} className={chipClass(!showInactive)}>
          {tr("filterActive")}
        </button>
        <button type="button" aria-pressed={showInactive} onClick={() => replaceQuery("inactive=1")} className={chipClass(showInactive)}>
          {tr("filterInactive")}{workers.data ? ` (${inactiveCount})` : ""}
        </button>
      </div>

      {workers.isError && !workers.data && <ErrorState error={workers.error} onRetry={() => workers.refetch()} />}
      {workers.isPending && (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-lg bg-surface-alt" />)}</div>
      )}
      {workers.data && visible.length === 0 && (
        <div className="rounded-lg border border-line bg-surface p-8 text-center text-muted">{tr("noWorkersYet")}</div>
      )}

      {/* Mobile: cards */}
      <ul className="space-y-3 sm:hidden">
        {visible.map((w) => (
          <li key={w.worker_id}>
            <Link href={`/workers/${w.worker_id}`} className="block rounded-lg border border-line bg-surface p-4 active:bg-surface-alt">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-ink">{w.users?.display_name ?? "—"}</p>
                <TierBadge w={w} />
              </div>
              {w.reliability.allTime.logsTotal === 0 ? (
                <p className="mt-2 text-xs text-muted">{tr("noDataYet")}</p>
              ) : (
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <Metric label={tr("totalLogsPrefix")} value={String(w.reliability.recent.logsTotal)} sub={String(w.reliability.allTime.logsTotal)} />
                  <Metric label={tr("flagRatePrefix")} value={formatFlagRate(w.reliability.recent)} sub={formatFlagRate(w.reliability.allTime)} />
                  <Metric label={tr("avgPrefix")} value={secs(w.reliability.recent, tr("secondsUnit"))} sub={secs(w.reliability.allTime, tr("secondsUnit"))} />
                </dl>
              )}
            </Link>
          </li>
        ))}
      </ul>
      {visible.length > 0 && (
        <p className="mt-2 text-xs text-muted sm:hidden">
          {tr("reliabilityRecent")} · <span className="opacity-70">({tr("reliabilityAllTime")})</span>
        </p>
      )}

      {/* Desktop: table */}
      {visible.length > 0 && (
        <div className="hidden overflow-hidden rounded-lg border border-line bg-surface sm:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-4 py-3 font-semibold">{tr("colName")}</th>
                <Th label={tr("colTotalLogs")} />
                <Th label={tr("colFlagRate")} help={tr("help_flagRate")} />
                <Th label={tr("colAvgTime")} help={tr("help_avgTime")} />
                <th className="px-4 py-3 font-semibold">
                  <span className="inline-flex items-center gap-1">{tr("colTrustTier")} <InfoTip text={tr("help_trustTier")} /></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((w) => (
                <tr key={w.worker_id} className="border-b border-line last:border-0 hover:bg-surface-alt">
                  <td className="px-4 py-3 font-semibold text-ink">
                    <Link href={`/workers/${w.worker_id}`} className="block hover:underline">{w.users?.display_name ?? "—"}</Link>
                  </td>
                  <Pair a={String(w.reliability.recent.logsTotal)} b={String(w.reliability.allTime.logsTotal)} />
                  <Pair a={formatFlagRate(w.reliability.recent)} b={formatFlagRate(w.reliability.allTime)} />
                  <Pair a={secs(w.reliability.recent, tr("secondsUnit"))} b={secs(w.reliability.allTime, tr("secondsUnit"))} />
                  <td className="px-4 py-3"><TierBadge w={w} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const secs = (w: ReliabilityWindow, unit: string) => {
  const v = formatAvgCompletion(w);
  return v === "—" ? v : `${v} ${unit}`;
};

function TierBadge({ w }: { w: WorkerRow }) {
  const { tr } = useT();
  const tier = TRUST_TIER[w.trust_tier];
  return tier ? <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tier.className}`}>{tr(tier.key)}</span> : null;
}

function Th({ label, help }: { label: string; help?: string }) {
  const { tr } = useT();
  return (
    <th className="px-4 py-3 font-semibold">
      <span className="inline-flex items-center gap-1">{label}{help && <InfoTip text={help} label={label} />}</span>
      <span className="block font-normal opacity-70">{tr("reliabilityRecent")} / {tr("reliabilityAllTime")}</span>
    </th>
  );
}

function Pair({ a, b }: { a: string; b: string }) {
  return (
    <td className="px-4 py-3 text-muted">
      <span className="text-ink">{a}</span>
      <span className="ml-1.5 text-xs opacity-70">/ {b}</span>
    </td>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg bg-surface-alt px-2 py-2">
      <dt className="text-[11px] leading-tight text-muted">{label}</dt>
      <dd className="mt-0.5 text-base font-bold text-ink">{value}</dd>
      <dd className="text-[11px] text-muted opacity-80">({sub})</dd>
    </div>
  );
}
