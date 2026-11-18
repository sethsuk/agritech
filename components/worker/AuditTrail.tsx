"use client";

import { t } from "@/lib/i18n/t";
import { useT } from "@/lib/i18n/LanguageContext";
import { formValueLabel } from "@/lib/i18n/labels";
import { formatDateTime } from "@/lib/time";
import type { DbTaskDefinition, DbTaskLog } from "@/types/database";

/** A record's history — original, corrections, void — shown through the task's own field labels. */
export function AuditTrail({ trail, taskDef }: { trail: DbTaskLog[]; taskDef: DbTaskDefinition | undefined }) {
  const { lang, tr } = useT();
  return (
    <ol className="space-y-3">
      {trail.map((entry) => {
        const kind = entry.correction_type;
        return (
          <li key={entry.log_id} className="rounded-lg border border-line bg-surface p-4">
            <div className="flex items-center justify-between gap-2">
              <span className={`text-base font-semibold ${
                kind === "void" ? "text-warning-ink" : kind === "correction" ? "text-caution-ink" : "text-primary-ink"
              }`}>
                {tr(kind === "void" ? "voidLabel" : kind === "correction" ? "correctionLabel" : "originalSubmissionLabel")}
              </span>
              <span className="text-base text-muted">{formatDateTime(entry.submitted_at, lang)}</span>
            </div>
            {entry.correction_reason && <p className="mt-2 text-base text-body">“{entry.correction_reason}”</p>}
            {kind !== "void" && taskDef && (
              <dl className="mt-2 space-y-1">
                {taskDef.fields.filter((f) => f.type !== "set_picker").map((f) => (
                  <div key={f.field_id} className="flex justify-between gap-3 text-base">
                    <dt className="text-muted">{f.label_icon} {t(f.label, lang)}</dt>
                    <dd className="text-right font-semibold text-body">{formValueLabel(f, entry.form_data[f.field_id], lang)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        );
      })}
    </ol>
  );
}
