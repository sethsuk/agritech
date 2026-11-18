"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/LanguageContext";
import { alertSubtypeLabel, flagLabel, formValueLabel, taskLabel, validationStatusLabel } from "@/lib/i18n/labels";
import { t } from "@/lib/i18n/t";
import { useLogDetail, useTaskDefs } from "@/lib/client/queries";
import { formatDateTime } from "@/lib/time";
import { ALERT_TIER, validationBadgeClass } from "@/lib/ui/badges";
import { ErrorState } from "@/components/QueryState";

/**
 * One log as a manager sees it: current values (corrections applied), who/when/where,
 * distance from the tree, photo, flags, the alerts it raised, and its full change
 * history. Alerts link here so a manager can see the evidence before resolving.
 */
export default function LogDetailPage() {
  const { logId } = useParams<{ logId: string }>();
  const router = useRouter();
  const { lang, tr } = useT();
  const detail = useLogDetail(logId);
  const taskDefs = useTaskDefs();

  if (detail.isPending) {
    return <div className="mx-auto max-w-2xl px-4 py-6"><div className="h-48 animate-pulse rounded-lg bg-surface-alt" /></div>;
  }
  if (detail.isError || !detail.data?.root) {
    return <div className="mx-auto max-w-2xl px-4 py-6"><ErrorState error={detail.error} onRetry={() => detail.refetch()} /></div>;
  }

  const { effective, root, trail, alerts } = detail.data;
  const def = taskDefs.data?.find((d) => d.task_def_id === root.task_def_id);
  const values = effective?.form_data ?? root.form_data;
  const status = effective?.validation_status ?? "passed";
  const flags = effective?.validation_flags ?? root.validation_flags;
  const voided = effective === null;
  const distance = root.gps_delta_meters !== null ? Math.round(Number(root.gps_delta_meters)) : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <button type="button" onClick={() => router.back()} className="mb-4 inline-flex min-h-11 items-center text-sm text-muted sm:min-h-0">
        ‹ {tr("back")}
      </button>

      <div className="mb-4 rounded-lg border border-line bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-ink">{def?.icon} {taskLabel(root.task_def_id, taskDefs.data, lang)}</h1>
            <p className="mt-1 text-sm text-muted">
              <Link href={`/trees/${root.tree_id}`} className="font-mono font-semibold text-primary-ink hover:underline">{root.tree_id}</Link>
              {" · "}{formatDateTime(root.submitted_at, lang)}
            </p>
          </div>
          {voided ? (
            <span className="rounded-full bg-surface-press px-2 py-0.5 text-xs font-semibold text-body">{tr("voidedBadge")}</span>
          ) : (
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${validationBadgeClass(status)}`}>
              {validationStatusLabel(status, lang)}
            </span>
          )}
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-3 border-t border-line pt-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted">{tr("submittedByLabel")}</dt>
            <dd className="font-semibold text-ink">
              <Link href={`/workers/${root.worker_id}`} className="hover:underline">{root.users?.display_name ?? "—"}</Link>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{tr("gpsDistanceLabel")}</dt>
            <dd className="font-semibold text-ink">{distance !== null ? `${distance} ${tr("metersUnit")}` : "—"}</dd>
          </div>
          {def?.fields.map((field) => (
            <div key={field.field_id}>
              <dt className="text-xs text-muted">{field.label_icon} {t(field.label, lang)}</dt>
              <dd className="font-semibold text-ink">
                {field.type === "set_picker" ? "🎗️" : formValueLabel(field, values[field.field_id], lang)}
              </dd>
            </div>
          ))}
        </dl>

        {flags.length > 0 && (
          <div className="mt-4 border-t border-line pt-4">
            <p className="mb-2 text-xs text-muted">{tr("flagsLabel")}</p>
            <div className="flex flex-wrap gap-2">
              {flags.map((f) => (
                <span key={f} className="rounded-full bg-caution-tint px-2 py-1 text-xs font-semibold text-caution-ink">{flagLabel(f, lang)}</span>
              ))}
            </div>
          </div>
        )}

        {root.photo_url && (
          <div className="mt-4 border-t border-line pt-4">
            <p className="mb-2 text-xs text-muted">{tr("photoLabel")}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={root.photo_url} alt={tr("photoAlt")} className="max-h-80 w-full rounded-lg object-cover" />
          </div>
        )}
      </div>

      {alerts.length > 0 && (
        <div className="mb-4 rounded-lg border border-line bg-surface p-5">
          <h2 className="mb-3 text-sm font-semibold text-body">{tr("navAlerts")}</h2>
          <ul className="space-y-2">
            {alerts.map((a) => (
              <li key={a.alert_id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-ink">{alertSubtypeLabel(a.subtype, lang)}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ALERT_TIER[a.tier]?.className ?? ""}`}>
                  {ALERT_TIER[a.tier] ? tr(ALERT_TIER[a.tier].key) : a.tier}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {trail.length > 1 && (
        <div className="rounded-lg border border-line bg-surface p-5">
          <h2 className="mb-3 text-sm font-semibold text-body">{tr("auditTrailTitle")}</h2>
          <ol className="space-y-3">
            {trail.map((row) => (
              <li key={row.log_id} className="border-l-2 border-line pl-3 text-sm">
                <p className="font-semibold text-ink">
                  {row.correction_type === "void" ? tr("voidLabel") : row.correction_type === "correction" ? tr("correctionLabel") : tr("originalSubmissionLabel")}
                  <span className="ml-2 text-xs font-normal text-muted">{formatDateTime(row.submitted_at, lang)}</span>
                </p>
                {row.correction_reason && <p className="text-xs italic text-body">“{row.correction_reason}”</p>}
                {row.correction_type !== "void" && def && (
                  <p className="text-xs text-muted">
                    {def.fields.filter((f) => f.type !== "set_picker").map((f) => `${t(f.label, lang)}: ${formValueLabel(f, row.form_data[f.field_id], lang)}`).join(" · ")}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
