"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { downloadTreeQrLabel } from "@/lib/qrLabel";
import { useT } from "@/lib/i18n/LanguageContext";
import { alertSubtypeLabel, colorName, COLOR_ICON, errorMessage, flagLabel, taskLabel, validationStatusLabel } from "@/lib/i18n/labels";
import { useTaskDefs, useTreeDetail, qk } from "@/lib/client/queries";
import { api, errorBody } from "@/lib/client/api";
import { formatDate, formatDateTime } from "@/lib/time";
import { validationBadgeClass } from "@/lib/ui/badges";
import { zoneKey } from "@/lib/treeId";
import type { GpsFix } from "@/lib/geo";
import type { DateInputState } from "@/components/DateInputDMY";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { RequiredLegend } from "@/components/FormField";
import { InfoTip } from "@/components/InfoTip";
import { ErrorState } from "@/components/QueryState";
import { TreeHealthBadge } from "@/components/manager/TreeHealthBadge";
import { GpsField, PlantedDateField, VarietyField, varietyFromStored, varietyOf, type VarietyValue } from "@/components/manager/TreeFields";
import type { SetState } from "@/types/database";

export default function ManagerTreeDetailPage() {
  const { treeId } = useParams<{ treeId: string }>();
  const { lang, tr } = useT();
  const queryClient = useQueryClient();
  const detail = useTreeDetail(treeId);
  const taskDefs = useTaskDefs();

  const [variety, setVariety] = useState<VarietyValue>({ choice: "", custom: "" });
  const [planted, setPlanted] = useState<DateInputState>({ iso: null, problem: null });
  const [gps, setGps] = useState<GpsFix | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [confirmRetire, setConfirmRetire] = useState(false);

  const tree = detail.data?.tree;
  useEffect(() => {
    if (tree) {
      setVariety(varietyFromStored(tree.variety));
      setPlanted({ iso: tree.planted_date, problem: null });
      setGps(null);
      setSubmitted(false);
    }
  }, [tree]);

  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api(`/api/manager/trees/${encodeURIComponent(treeId)}`, { method: "PATCH", json: body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.tree(treeId) });
      queryClient.invalidateQueries({ queryKey: qk.trees });
      queryClient.invalidateQueries({ queryKey: qk.overview });
    },
    onError: (err) => toast.error(errorMessage(errorBody(err), lang)),
  });

  if (detail.isPending) {
    return <div className="mx-auto max-w-2xl px-4 py-6"><div className="h-40 animate-pulse rounded-lg bg-surface-alt" /></div>;
  }
  if (detail.isError || !detail.data || !tree) {
    return <div className="mx-auto max-w-2xl px-4 py-6"><ErrorState error={detail.error} onRetry={() => detail.refetch()} /></div>;
  }

  const { sets, recentLogs, openAlerts } = detail.data;
  const varietyValue = varietyOf(variety);
  const dirty =
    varietyValue !== tree.variety || (planted.iso !== null && planted.iso !== tree.planted_date) || gps !== null;

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    // Never fail silently: invalid fields are highlighted by their own components.
    if (!varietyValue || !planted.iso) {
      toast.error(tr("fixErrorsFirst"));
      return;
    }
    patch.mutate(
      { variety: varietyValue, plantedDate: planted.iso, ...(gps ? { lat: gps.lat, long: gps.long } : {}) },
      { onSuccess: () => toast.success(tr("savedToast")) },
    );
  }

  const openSets = sets.filter((s) => s.closed_at === null);
  const closedSets = sets.filter((s) => s.closed_at !== null);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/trees" className="inline-flex min-h-11 items-center text-sm text-muted sm:min-h-0">‹ {tr("back")}</Link>
        {tree.status === "retired" && (
          <span className="rounded-full bg-surface-press px-3 py-1 text-xs font-semibold text-body">{tr("retiredBadge")}</span>
        )}
      </div>

      <div className="mb-4 rounded-lg border border-line bg-surface p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="font-mono text-2xl font-bold text-ink">{tree.tree_id}</h1>
            <p className="mt-1 text-sm text-muted">
              {tr("zoneLabel")} {zoneKey(tree.zone, tree.side)} · {tr("rowLabel")} {tree.row_num} · {tr("columnLabel")} {tree.position}
            </p>
          </div>
          <span className="inline-flex items-center gap-1">
            <TreeHealthBadge openAlerts={openAlerts.length} hasTier1Alert={openAlerts.some((a) => a.tier === "tier_1")} className="px-3 py-1" />
            <InfoTip text={tr("help_health")} />
          </span>
        </div>

        {openAlerts.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
            {openAlerts.map((a) => (
              <Link key={a.alert_id} href="/alerts" className="rounded-full bg-warning-tint px-2 py-1 text-xs font-semibold text-warning-ink">
                🔔 {alertSubtypeLabel(a.subtype, lang)}
              </Link>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => downloadTreeQrLabel(tree.tree_id, tree.qr_code)}
          className="mt-4 h-11 w-full rounded-lg border border-line bg-surface-alt text-sm font-semibold text-body active:bg-surface-press"
        >
          📥 {tr("downloadQr")}
        </button>
      </div>

      {/* Sets — bloom → fruit count → harvest, with derived counts */}
      <div className="mb-4 rounded-lg border border-line bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold text-body">{tr("setsTitle")}</h2>
        {sets.length === 0 ? (
          <p className="text-sm text-muted">{tr("noSetsYet")}</p>
        ) : (
          <ul className="space-y-3">
            {[...openSets, ...closedSets].map((s) => <SetCard key={s.set_id} set={s} />)}
          </ul>
        )}
      </div>

      {/* Edit form */}
      <form onSubmit={handleSave} noValidate className="mb-4 space-y-4 rounded-lg border border-line bg-surface p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-body">{tr("editInfoTitle")}</h2>
          <RequiredLegend />
        </div>
        <VarietyField value={variety} onChange={setVariety} />
        <PlantedDateField initial={tree.planted_date} state={planted} onChange={setPlanted} showAllErrors={submitted} />
        <GpsField
          value={gps}
          onChange={setGps}
          current={{ lat: Number(tree.lat), long: Number(tree.long) }}
          buttonLabel={tr("recaptureLocation")}
        />
        {dirty && <p className="text-xs font-semibold text-caution-ink" role="status">● {tr("unsavedChanges")}</p>}
        <button
          type="submit"
          disabled={patch.isPending || !dirty}
          className="h-12 w-full rounded-lg bg-primary text-base font-semibold text-white active:bg-primary-press disabled:bg-surface-press disabled:text-muted"
        >
          {patch.isPending ? tr("submitting") : tr("saveEditsButton")}
        </button>
      </form>

      {/* Recent logs */}
      <div className="mb-4 rounded-lg border border-line bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold text-body">{tr("recentLogsTitle")}</h2>
        {recentLogs.length === 0 ? (
          <p className="text-sm text-muted">{tr("noLogsYet")}</p>
        ) : (
          <ul className="divide-y divide-line">
            {recentLogs.map((log) => (
              <li key={log.log_id}>
                <Link href={`/logs/${log.log_id}`} className="flex min-h-14 items-center justify-between gap-2 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{taskLabel(log.task_def_id, taskDefs.data, lang)}</p>
                    <p className="text-xs text-muted">{log.worker_name ?? "—"} · {formatDateTime(log.submitted_at, lang)}</p>
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
        )}
      </div>

      <button
        type="button"
        onClick={() => setConfirmRetire(true)}
        disabled={patch.isPending}
        className={`h-12 w-full rounded-lg text-sm font-semibold disabled:opacity-50 ${
          tree.status === "active" ? "border border-warning bg-warning-tint text-warning-ink" : "bg-primary text-white"
        }`}
      >
        {tree.status === "active" ? tr("retireTreeButton") : tr("reactivateTreeButton")}
      </button>

      <ConfirmDialog
        open={confirmRetire}
        title={tree.status === "active" ? tr("retireTreeTitle") : tr("reactivateTreeTitle")}
        message={tr(tree.status === "active" ? "retireTreeMsg" : "reactivateTreeMsg", { id: tree.tree_id })}
        confirmLabel={tree.status === "active" ? tr("retireTreeButton") : tr("reactivateTreeButton")}
        destructive={tree.status === "active"}
        onConfirm={() => {
          setConfirmRetire(false);
          const retiring = tree.status === "active";
          patch.mutate(
            { status: retiring ? "retired" : "active" },
            { onSuccess: () => toast.success(tr(retiring ? "retiredToast" : "reactivatedToast")) },
          );
        }}
        onCancel={() => setConfirmRetire(false)}
      />
    </div>
  );
}

function SetCard({ set }: { set: SetState }) {
  const { lang, tr } = useT();
  return (
    <li className={`rounded-lg border border-line p-3 ${set.closed_at ? "bg-surface-alt/60" : "bg-surface-alt"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-ink">
          {COLOR_ICON[set.color]} {colorName(set.color, lang)}
          <span className="ml-2 text-xs font-normal text-muted">{tr("setBloomedOn", { date: formatDate(set.bloom_date, lang) })}</span>
        </p>
        <span className="rounded-full border border-line bg-surface px-2 py-0.5 text-xs font-semibold text-body">
          {tr(`stage_${set.stage}` as Parameters<typeof tr>[0])}
        </span>
      </div>
      <dl className="mt-2 grid grid-cols-4 gap-2 text-center text-xs">
        <Stat label={tr("setFlowers")} value={set.bloom_flowers ?? "—"} />
        <Stat label={tr("setLatestCount")} value={set.latest_fruit_count ?? "—"} />
        <Stat label={tr("setHarvested")} value={set.harvested_total} />
        <Stat label={tr("setRemainingLabel")} value={Math.max(set.remaining, 0)} strong={!set.closed_at} />
      </dl>
      <p className="mt-2 text-xs text-muted">
        {tr("setHarvestWindow", { start: formatDate(set.harvest_window_start, lang), end: formatDate(set.harvest_window_end, lang) })}
      </p>
    </li>
  );
}

function Stat({ label, value, strong }: { label: string; value: number | string; strong?: boolean }) {
  return (
    <div className="rounded bg-surface px-1 py-1.5">
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className={`text-sm font-bold ${strong ? "text-primary-ink" : "text-ink"}`}>{value}</dd>
    </div>
  );
}
