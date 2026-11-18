"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useT } from "@/lib/i18n/LanguageContext";
import { errorMessage, flagLabel, taskLabel, validationStatusLabel } from "@/lib/i18n/labels";
import { useTaskDefs, useWorkerDetail, qk } from "@/lib/client/queries";
import { api, errorBody } from "@/lib/client/api";
import { LANGUAGES } from "@/lib/client/languages";
import { formatAvgCompletion, formatFlagRate } from "@/lib/derived/reliability";
import { formatDateTime } from "@/lib/time";
import { TRUST_TIER, validationBadgeClass } from "@/lib/ui/badges";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FormField } from "@/components/FormField";
import { InfoTip } from "@/components/InfoTip";
import { ErrorState } from "@/components/QueryState";
import type { WorkerLanguage, WorkerTrustTier } from "@/types/database";

type Patch = Partial<{ displayName: string; language: WorkerLanguage; active: boolean; trustTier: WorkerTrustTier; pin: string }>;

export default function ManagerWorkerDetailPage() {
  const { workerId } = useParams<{ workerId: string }>();
  const { lang, tr } = useT();
  const queryClient = useQueryClient();
  const detail = useWorkerDetail(workerId);
  const taskDefs = useTaskDefs();

  const [displayName, setDisplayName] = useState("");
  const [language, setLanguage] = useState<WorkerLanguage>("my");
  const [pin, setPin] = useState("");
  const [confirmToggle, setConfirmToggle] = useState(false);

  useEffect(() => {
    if (detail.data) {
      setDisplayName(detail.data.worker.users?.display_name ?? "");
      setLanguage(detail.data.worker.language);
    }
  }, [detail.data]);

  const patch = useMutation({
    mutationFn: (body: Patch) => api(`/api/manager/workers/${workerId}`, { method: "PATCH", json: body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.worker(workerId) });
      queryClient.invalidateQueries({ queryKey: qk.workers });
    },
  });

  const run = (body: Patch, successKey: Parameters<typeof tr>[0]) =>
    patch.mutate(body, {
      onSuccess: () => toast.success(tr(successKey)),
      onError: (err) => toast.error(errorMessage(errorBody(err), lang)),
    });

  if (detail.isPending) {
    return <div className="mx-auto max-w-2xl px-4 py-6"><div className="h-40 animate-pulse rounded-lg bg-surface-alt" /></div>;
  }
  if (detail.isError || !detail.data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
      </div>
    );
  }

  const { worker, recentLogs, reliability } = detail.data;
  const name = worker.users?.display_name ?? "—";
  const tier = TRUST_TIER[worker.trust_tier];
  const pinValid = /^\d{4,6}$/.test(pin);
  const dirty = displayName.trim() !== name || language !== worker.language;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <Link href={worker.active ? "/workers" : "/workers?inactive=1"} className="inline-flex min-h-11 items-center text-sm text-muted sm:min-h-0">
          ‹ {tr("back")}
        </Link>
        {!worker.active && (
          <span className="rounded-full bg-surface-press px-3 py-1 text-xs font-semibold text-body">{tr("inactiveBadge")}</span>
        )}
      </div>

      <div className="mb-4 rounded-lg border border-line bg-surface p-5">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-2xl font-bold text-ink">{name}</h1>
          {tier && <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tier.className}`}>{tr(tier.key)}</span>}
        </div>

        <div className="mt-3 border-t border-line pt-3">
          {reliability.allTime.logsTotal === 0 ? (
            <p className="text-xs text-muted">{tr("noDataYet")}</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: tr("reliabilityRecent"), w: reliability.recent },
                { label: tr("reliabilityAllTime"), w: reliability.allTime },
              ].map(({ label, w }) => (
                <div key={label} className="rounded-lg bg-surface-alt p-3">
                  <p className="text-xs font-semibold text-muted">{label}</p>
                  <dl className="mt-1.5 space-y-1.5 text-xs text-muted">
                    <div className="flex items-center justify-between gap-2">
                      <dt>{tr("totalLogsPrefix")}</dt>
                      <dd className="font-semibold text-ink">{w.logsTotal}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="inline-flex items-center gap-1">{tr("flagRatePrefix")} <InfoTip text={tr("help_flagRate")} /></dt>
                      <dd className="font-semibold text-ink">{formatFlagRate(w)}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="inline-flex items-center gap-1">{tr("avgPrefix")} <InfoTip text={tr("help_avgTime")} /></dt>
                      <dd className="font-semibold text-ink">
                        {formatAvgCompletion(w) === "—" ? "—" : `${formatAvgCompletion(w)} ${tr("secondsUnit")}`}
                      </dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          )}
          {reliability.lastLogAt && (
            <p className="mt-2 text-xs text-muted">{tr("lastLogLabel")}: {formatDateTime(reliability.lastLogAt, lang)}</p>
          )}
        </div>
      </div>

      {/* Trust tier */}
      <div className="mb-4 rounded-lg border border-line bg-surface p-5">
        <h2 className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-body">
          {tr("trustTierLabel")} <InfoTip text={tr("help_trustTier")} />
        </h2>
        <div className="flex gap-2" role="group" aria-label={tr("trustTierLabel")}>
          {(["trusted", "standard", "audit"] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={worker.trust_tier === t}
              disabled={patch.isPending}
              onClick={() => t !== worker.trust_tier && run({ trustTier: t }, "trustTierUpdatedToast")}
              className={`h-12 flex-1 rounded-lg text-sm font-semibold disabled:opacity-50 ${
                worker.trust_tier === t ? "bg-primary text-white" : "border border-line bg-surface-alt text-body"
              }`}
            >
              {worker.trust_tier === t && "✓ "}{tr(TRUST_TIER[t].key)}
            </button>
          ))}
        </div>
      </div>

      {/* Edit form */}
      <form
        onSubmit={(e) => { e.preventDefault(); if (displayName.trim()) run({ displayName: displayName.trim(), language }, "savedToast"); }}
        className="mb-4 space-y-4 rounded-lg border border-line bg-surface p-5"
      >
        <h2 className="text-sm font-semibold text-body">{tr("editInfoTitle")}</h2>
        <FormField htmlFor="worker-name" label={tr("colName")} required>
          <input
            id="worker-name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            className="h-12 w-full rounded-lg border border-line px-4 text-base focus:border-primary focus:outline-none"
          />
        </FormField>
        <div>
          <p className="mb-1.5 text-sm font-semibold text-ink">{tr("languageFieldLabel")}</p>
          <div className="flex gap-2" role="group" aria-label={tr("languageFieldLabel")}>
            {LANGUAGES.map((l) => (
              <button
                key={l.value}
                type="button"
                aria-pressed={language === l.value}
                onClick={() => setLanguage(l.value)}
                className={`h-12 flex-1 rounded-lg text-sm font-semibold ${
                  language === l.value ? "bg-primary text-white" : "border border-line bg-surface-alt text-body"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
        <button
          type="submit"
          disabled={patch.isPending || !displayName.trim() || !dirty}
          className="h-12 w-full rounded-lg bg-primary text-base font-semibold text-white active:bg-primary-press disabled:bg-surface-press disabled:text-muted"
        >
          {patch.isPending ? tr("submitting") : tr("saveEditsButton")}
        </button>
      </form>

      {/* Reset PIN — PINs are stored hashed, so a forgotten one can only be replaced. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!pinValid) return;
          patch.mutate({ pin }, {
            onSuccess: () => { toast.success(tr("pinResetToast")); setPin(""); },
            onError: (err) => toast.error(errorMessage(errorBody(err), lang)),
          });
        }}
        className="mb-4 space-y-3 rounded-lg border border-line bg-surface p-5"
      >
        <FormField
          htmlFor="worker-pin"
          label={tr("newPinLabel")}
          required
          hint={tr("minPasswordHint")}
          error={pin && !pinValid ? tr("err_weak_pin") : undefined}
        >
          <input
            id="worker-pin"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            className="h-12 w-full rounded-lg border border-line px-4 font-mono text-lg tracking-widest focus:border-primary focus:outline-none"
          />
        </FormField>
        <button
          type="submit"
          disabled={!pinValid || patch.isPending}
          className="h-12 w-full rounded-lg border border-line bg-surface-alt text-sm font-semibold text-body disabled:opacity-50"
        >
          {tr("resetPinButton")}
        </button>
      </form>

      {/* Recent logs */}
      <div className="mb-4 rounded-lg border border-line bg-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-body">{tr("recentLogsTitle")}</h2>
          <Link href={`/logs?worker=${workerId}`} className="inline-flex min-h-11 items-center text-sm text-primary-ink hover:underline sm:min-h-0">
            {tr("viewAll")} →
          </Link>
        </div>
        {recentLogs.length === 0 ? (
          <p className="text-sm text-muted">{tr("noLogsYet")}</p>
        ) : (
          <ul className="divide-y divide-line">
            {recentLogs.map((log) => (
              <li key={log.log_id}>
                <Link href={`/logs/${log.log_id}`} className="flex min-h-14 items-center justify-between gap-2 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{taskLabel(log.task_def_id, taskDefs.data, lang)}</p>
                    <p className="text-xs text-muted">{log.tree_id} · {formatDateTime(log.submitted_at, lang)}</p>
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
        onClick={() => setConfirmToggle(true)}
        disabled={patch.isPending}
        className={`h-12 w-full rounded-lg text-sm font-semibold disabled:opacity-50 ${
          worker.active ? "border border-warning bg-warning-tint text-warning-ink" : "bg-primary text-white"
        }`}
      >
        {worker.active ? tr("deactivateWorkerButton") : tr("reactivateWorkerButton")}
      </button>

      <ConfirmDialog
        open={confirmToggle}
        title={worker.active ? tr("deactivateWorkerTitle") : tr("reactivateWorkerTitle")}
        message={tr(worker.active ? "deactivateWorkerMsg" : "reactivateWorkerMsg", { name })}
        confirmLabel={worker.active ? tr("deactivateWorkerButton") : tr("reactivateWorkerButton")}
        destructive={worker.active}
        onConfirm={() => {
          setConfirmToggle(false);
          run({ active: !worker.active }, worker.active ? "deactivatedWorkerToast" : "reactivatedWorkerToast");
        }}
        onCancel={() => setConfirmToggle(false)}
      />
    </div>
  );
}
