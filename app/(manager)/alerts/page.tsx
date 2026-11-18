"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useT } from "@/lib/i18n/LanguageContext";
import { alertSubtypeLabel, errorMessage } from "@/lib/i18n/labels";
import { useAlerts, qk, type AlertRow, type AlertStatusTab } from "@/lib/client/queries";
import { api, errorBody } from "@/lib/client/api";
import { formatDateTime } from "@/lib/time";
import { zoneKey } from "@/lib/treeId";
import { ALERT_CATEGORY_ICON, ALERT_TIER, chipClass } from "@/lib/ui/badges";
import { ErrorState, RefreshBar } from "@/components/QueryState";
import type { DictKey } from "@/lib/i18n/dictionary";

const TABS: { value: AlertStatusTab; key: DictKey }[] = [
  { value: "open", key: "statusOpen" },
  { value: "resolved", key: "statusResolved" },
  { value: "dismissed", key: "statusDismissed" },
];

/** "reviewed" (acknowledged, not resolved) is still something to act on → Open tab. */
const tabOf = (a: AlertRow): AlertStatusTab =>
  a.status === "resolved" ? "resolved" : a.status === "dismissed" ? "dismissed" : "open";

export default function AlertsPage() {
  return (
    <Suspense>
      <Alerts />
    </Suspense>
  );
}

/**
 * Every alert is loaded once and cached; the Open/Resolved/Dismissed tabs filter in
 * memory, so switching is instant and there's no loading gap. Resolve / Dismiss /
 * Reopen update the cache immediately (optimistic) and offer Undo.
 */
function Alerts() {
  const { lang, tr } = useT();
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const alerts = useAlerts();

  const tab = (TABS.find((t) => t.value === params.get("status"))?.value ?? "open") as AlertStatusTab;
  const urgentOnly = params.get("tier") === "tier_1";

  const setParam = (key: string, value: string | null) => {
    const qs = new URLSearchParams(params);
    if (value) qs.set(key, value); else qs.delete(key);
    router.replace(`/alerts?${qs}`, { scroll: false });
  };

  const update = useMutation({
    mutationFn: (v: { alertId: string; status: AlertStatusTab; notes?: string }) =>
      api<{ alert: AlertRow }>("/api/manager/alerts", { method: "PATCH", json: v }),
    onMutate: async (v) => {
      await queryClient.cancelQueries({ queryKey: qk.alerts });
      const previous = queryClient.getQueryData<AlertRow[]>(qk.alerts);
      queryClient.setQueryData<AlertRow[]>(qk.alerts, (rows) =>
        rows?.map((a) => (a.alert_id === v.alertId ? { ...a, status: v.status } : a)),
      );
      return { previous };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(qk.alerts, ctx.previous);
      toast.error(errorMessage(errorBody(err), lang));
    },
    onSuccess: ({ alert }) => {
      queryClient.setQueryData<AlertRow[]>(qk.alerts, (rows) =>
        rows?.map((a) => (a.alert_id === alert.alert_id ? alert : a)),
      );
      // Counts elsewhere (dashboard tiles, tree health) depend on open alerts.
      queryClient.invalidateQueries({ queryKey: qk.overview });
      queryClient.invalidateQueries({ queryKey: qk.trees });
    },
  });

  function act(alert: AlertRow, status: AlertStatusTab) {
    const from = tabOf(alert);
    update.mutate({ alertId: alert.alert_id, status }, {
      onSuccess: () => {
        const msg = status === "open" ? tr("alertReopenedToast")
          : status === "resolved" ? tr("alertResolvedToast") : tr("alertDismissedToast");
        toast.success(msg, {
          action: { label: tr("undoAction"), onClick: () => update.mutate({ alertId: alert.alert_id, status: from }) },
          duration: 6000,
        });
      },
    });
  }

  const all = alerts.data ?? [];
  const counts = Object.fromEntries(TABS.map((t) => [t.value, all.filter((a) => tabOf(a) === t.value).length]));
  const visible = all
    .filter((a) => tabOf(a) === tab && (!urgentOnly || a.tier === "tier_1"))
    .sort((a, b) =>
      tab === "open"
        ? a.tier.localeCompare(b.tier) || b.created_at.localeCompare(a.created_at)
        : (b.resolution_resolved_at ?? b.created_at).localeCompare(a.resolution_resolved_at ?? a.created_at),
    );

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-ink">{tr("navAlerts")}</h1>
        <RefreshBar updatedAt={alerts.dataUpdatedAt || undefined} fetching={alerts.isFetching} onRefresh={() => alerts.refetch()} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => setParam("status", t.value === "open" ? null : t.value)}
            className={chipClass(tab === t.value)}
          >
            {tr(t.key)}{alerts.data ? ` (${counts[t.value]})` : ""}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={urgentOnly}
          onClick={() => setParam("tier", urgentOnly ? null : "tier_1")}
          className={chipClass(urgentOnly)}
        >
          {tr("filterUrgentOnly")}
        </button>
      </div>

      {alerts.isError && !alerts.data && <ErrorState error={alerts.error} onRetry={() => alerts.refetch()} />}

      {/* Skeleton only before the first load — never stacked above a stale list. */}
      {alerts.isPending && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-lg bg-surface-alt" />)}
        </div>
      )}

      {alerts.data && visible.length === 0 && (
        <div className="rounded-lg border border-line bg-surface p-10 text-center text-muted">{tr("noAlertsAtAll")}</div>
      )}

      <ul className="space-y-3">
        {visible.map((alert) => (
          <AlertCard key={alert.alert_id} alert={alert} onAct={(s) => act(alert, s)} />
        ))}
      </ul>
    </div>
  );
}

function AlertCard({ alert, onAct }: { alert: AlertRow; onAct: (s: AlertStatusTab) => void }) {
  const { lang, tr } = useT();
  const tier = ALERT_TIER[alert.tier];
  const tab = tabOf(alert);
  const [confirming, setConfirming] = useState(false);

  return (
    <li className="rounded-lg border border-line bg-surface p-4">
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-0.5 text-2xl">{ALERT_CATEGORY_ICON[alert.category] ?? "📌"}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {tier && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tier.className}`}>{tr(tier.key)}</span>}
            <p className="text-sm font-semibold text-ink">{alertSubtypeLabel(alert.subtype, lang)}</p>
          </div>
          {alert.trees && (
            <p className="mt-0.5 text-xs text-muted">
              <Link href={`/trees/${alert.trees.tree_id}`} className="underline-offset-2 hover:underline">
                {tr("treeTitlePrefix")} {alert.trees.tree_id}
              </Link>
              {" · "}{tr("zoneLabel")} {zoneKey(alert.trees.zone, alert.trees.side)}
            </p>
          )}
          {alert.workers?.users && (
            <p className="text-xs text-muted">{tr("navWorkers")}: {alert.workers.users.display_name}</p>
          )}
          <p className="mt-1 text-xs text-muted">{formatDateTime(alert.created_at, lang)}</p>
          {alert.resolution_notes && <p className="mt-1 text-xs italic text-body">“{alert.resolution_notes}”</p>}
          {alert.triggered_by_log_id && (
            <Link href={`/logs/${alert.triggered_by_log_id}`} className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-primary-ink hover:underline sm:min-h-0">
              {tr("viewLogLink")} →
            </Link>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {tab === "open" ? (
          <>
            <button
              type="button"
              onClick={() => onAct("resolved")}
              className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-white active:bg-primary-press"
            >
              {tr("statusResolved")}
            </button>
            {confirming ? (
              <button
                type="button"
                onClick={() => { setConfirming(false); onAct("dismissed"); }}
                className="inline-flex min-h-11 items-center rounded-lg border border-warning bg-warning-tint px-4 text-sm font-semibold text-warning-ink"
              >
                {tr("confirmAction")}: {tr("dismissAction")}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="inline-flex min-h-11 items-center rounded-lg border border-line bg-surface-alt px-4 text-sm font-semibold text-body active:bg-surface-press"
              >
                {tr("dismissAction")}
              </button>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={() => onAct("open")}
            className="inline-flex min-h-11 items-center rounded-lg border border-line bg-surface px-4 text-sm font-semibold text-body active:bg-surface-alt"
          >
            ↺ {tr("reopenAction")}
          </button>
        )}
      </div>
    </li>
  );
}
