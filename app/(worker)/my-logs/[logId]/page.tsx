"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { t, taskDisplayName } from "@/lib/i18n/t";
import { WorkerHeader } from "@/components/worker/WorkerHeader";
import { TaskFormRenderer } from "@/components/worker/TaskFormRenderer";
import { FormField } from "@/components/FormField";
import { useT } from "@/lib/i18n/LanguageContext";
import { errorMessage, formValueLabel } from "@/lib/i18n/labels";
import { api, errorBody } from "@/lib/client/api";
import { qk } from "@/lib/client/queries";
import { formatDateTime } from "@/lib/time";
import type { DbTaskLog, DbTaskDefinition, TaskField } from "@/types/database";

/**
 * Fields that identify which set a record belongs to can't be corrected (the server
 * refuses with locked_field) — moving fruit between sets is a void-and-relog. They're
 * shown read-only instead of as editable inputs.
 */
const isLockedField = (taskType: string, f: TaskField) =>
  f.type === "set_picker" || (taskType === "bloom_log" && f.field_id === "color");

type Mode = "view" | "correct" | "void";

export default function MyLogDetailPage() {
  const { logId } = useParams<{ logId: string }>();
  const router = useRouter();
  const { lang, tr } = useT();
  const queryClient = useQueryClient();

  const [trail, setTrail] = useState<DbTaskLog[] | null>(null);
  const [taskDef, setTaskDef] = useState<DbTaskDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("view");
  const [editFormData, setEditFormData] = useState<Record<string, unknown>>({});
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [reasonError, setReasonError] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/my-logs/${logId}`).then((r) => r.ok ? r.json() : Promise.reject()),
      fetch("/api/task-definitions").then((r) => r.ok ? r.json() : Promise.reject()),
    ])
      .then(([logRes, defsRes]: [{ trail: DbTaskLog[] }, DbTaskDefinition[]]) => {
        setTrail(logRes.trail);
        const root = logRes.trail[0];
        const def = defsRes.find((d) => d.task_def_id === root.task_def_id) ?? null;
        setTaskDef(def);
      })
      .catch(() => {
        toast.error(tr("myLogsLoadError"));
        router.push("/my-logs");
      })
      .finally(() => setLoading(false));
  }, [logId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || !trail) {
    return (
      <main className="mx-auto max-w-md px-4 py-6">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-surface-alt" />
          ))}
        </div>
      </main>
    );
  }

  const root = trail[0];
  const latest = trail[trail.length - 1];
  const voided = trail.some((entry) => entry.correction_type === "void");
  const currentFormData = voided
    ? [...trail].reverse().find((e) => e.correction_type !== "void")?.form_data ?? root.form_data
    : latest.form_data;

  function entryLabel(entry: DbTaskLog) {
    if (entry.correction_type === "void") return tr("voidLabel");
    if (entry.correction_type === "correction") return tr("correctionLabel");
    return tr("originalSubmissionLabel");
  }

  async function refreshTrail() {
    const refreshed = await fetch(`/api/my-logs/${logId}`).then((r) => r.json());
    setTrail(refreshed.trail);
    // Corrections/voids change set counts and the records list.
    queryClient.invalidateQueries({ queryKey: qk.myLogs });
    queryClient.invalidateQueries({ queryKey: qk.workerTree(root.tree_id) });
  }

  function startCorrection() {
    setEditFormData({ ...currentFormData });
    setReason("");
    setReasonError(false);
    setMode("correct");
  }

  function startVoid() {
    setReason("");
    setReasonError(false);
    setMode("void");
  }

  async function submitCorrection(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      setReasonError(true);
      document.getElementById("reason")?.focus();
      return;
    }
    setSaving(true);
    try {
      await api(`/api/my-logs/${logId}/correct`, { method: "POST", json: { formData: editFormData, reason } });
      toast.success(tr("correctionSuccessToast"));
      await refreshTrail();
      setMode("view");
    } catch (err) {
      toast.error(errorMessage(errorBody(err), lang, { fields: taskDef?.fields }), { duration: 6000 });
    } finally {
      setSaving(false);
    }
  }

  async function submitVoid(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      setReasonError(true);
      document.getElementById("reason")?.focus();
      return;
    }
    setSaving(true);
    try {
      await api(`/api/my-logs/${logId}/void`, { method: "POST", json: { reason } });
      toast.success(tr("voidSuccessToast"));
      await refreshTrail();
      setMode("view");
    } catch (err) {
      toast.error(errorMessage(errorBody(err), lang), { duration: 6000 });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <WorkerHeader
        variant="back"
        title={taskDef ? taskDisplayName(taskDef, lang) : "—"}
        onBack={() => (mode !== "view" ? setMode("view") : router.push("/my-logs"))}
      />

      <main className="mx-auto w-full max-w-md flex-1 px-4 py-6 pb-32">
        {mode === "view" && (
          <>
            <div className="mb-4 rounded-lg border border-line bg-surface p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-lg font-bold text-ink">{root.tree_id}</p>
                  <p className="text-base text-muted">{formatDateTime(root.submitted_at, lang)}</p>
                </div>
                {voided && (
                  <span className="rounded-full bg-warning-tint px-3 py-1 text-base font-semibold text-warning-ink">
                    {tr("voidedBadge")}
                  </span>
                )}
              </div>
            </div>

            <h2 className="mb-3 text-base font-semibold text-body">{tr("auditTrailTitle")}</h2>
            <div className="mb-6 space-y-3">
              {trail.map((entry) => (
                <div key={entry.log_id} className="rounded-lg border border-line bg-surface p-4">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-base font-semibold ${
                        entry.correction_type === "void"
                          ? "text-warning-ink"
                          : entry.correction_type === "correction"
                          ? "text-caution-ink"
                          : "text-primary-ink"
                      }`}
                    >
                      {entryLabel(entry)}
                    </span>
                    <span className="text-base text-muted">{formatDateTime(entry.submitted_at, lang)}</span>
                  </div>
                  {entry.correction_reason && (
                    <p className="mt-2 text-base text-body">{entry.correction_reason}</p>
                  )}
                  {entry.correction_type !== "void" && taskDef && (
                    // Through the task's own field labels — not raw keys and JSON.
                    <dl className="mt-2 space-y-1">
                      {taskDef.fields.filter((f) => f.type !== "set_picker").map((f) => (
                        <div key={f.field_id} className="flex justify-between gap-3 text-base">
                          <dt className="text-muted">{f.label_icon} {t(f.label, lang)}</dt>
                          <dd className="text-right font-semibold text-body">{formValueLabel(f, entry.form_data[f.field_id], lang)}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              ))}
            </div>

            {!voided && taskDef && (
              <div className="space-y-3">
                <button
                  onClick={startCorrection}
                  className="h-15 w-full rounded-lg border-2 border-primary text-lg font-semibold text-primary-ink active:bg-primary-tint"
                >
                  {tr("correctButton")}
                </button>
                <button
                  onClick={startVoid}
                  className="h-15 w-full rounded-lg border-2 border-warning text-lg font-semibold text-warning-ink active:bg-warning-tint"
                >
                  {tr("voidButton")}
                </button>
              </div>
            )}
          </>
        )}

        {mode === "correct" && taskDef && (
          <form onSubmit={submitCorrection} noValidate className="space-y-4">
            {taskDef.fields.filter((f) => isLockedField(root.task_type, f)).map((f) => (
              <div key={f.field_id} className="rounded-lg border border-line bg-surface-alt p-4 text-base text-muted">
                🔒 {t(f.label, lang)}{f.type !== "set_picker" && `: ${formValueLabel(f, editFormData[f.field_id], lang)}`}
              </div>
            ))}
            <TaskFormRenderer
              fields={taskDef.fields.filter((f) => !isLockedField(root.task_type, f))}
              formData={editFormData}
              onChange={(field, value) => setEditFormData((prev) => ({ ...prev, [field]: value }))}
            />

            <ReasonField
              label={tr("correctReasonLabel")}
              placeholder={tr("correctReasonPlaceholder")}
              value={reason}
              onChange={(v) => { setReason(v); if (v.trim()) setReasonError(false); }}
              error={reasonError ? tr("reasonRequiredError") : undefined}
            />

            <div className="fixed inset-x-0 bottom-0 border-t border-line bg-surface p-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
              <div className="mx-auto max-w-md">
                <button
                  type="submit"
                  disabled={saving}
                  className="h-15 w-full rounded-lg bg-primary text-lg font-semibold text-white active:bg-primary-press disabled:bg-surface-press"
                >
                  {saving ? tr("submitting") : tr("saveCorrectionButton")}
                </button>
              </div>
            </div>
          </form>
        )}

        {mode === "void" && (
          <form onSubmit={submitVoid} noValidate className="space-y-4">
            <div className="rounded-lg border border-warning bg-warning-tint p-4">
              <p className="text-lg font-semibold text-warning-ink">{tr("voidConfirmTitle")}</p>
              <p className="mt-1 text-base text-body">{tr("voidConfirmMessage")}</p>
            </div>

            <ReasonField
              label={tr("voidReasonLabel")}
              placeholder={tr("voidReasonPlaceholder")}
              value={reason}
              onChange={(v) => { setReason(v); if (v.trim()) setReasonError(false); }}
              error={reasonError ? tr("reasonRequiredError") : undefined}
            />

            <div className="fixed inset-x-0 bottom-0 border-t border-line bg-surface p-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
              <div className="mx-auto max-w-md">
                <button
                  type="submit"
                  disabled={saving}
                  className="h-15 w-full rounded-lg bg-warning text-lg font-semibold text-white active:bg-warning-press disabled:bg-surface-press"
                >
                  {saving ? tr("submitting") : tr("voidButton")}
                </button>
              </div>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}

/** The required reason box, with the red * and an inline error (not just a toast). */
function ReasonField({
  label, placeholder, value, onChange, error,
}: { label: string; placeholder: string; value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <div className={`rounded-lg bg-surface p-4 ${error ? "border-2 border-warning" : "border border-line"}`}>
      <FormField htmlFor="reason" label={<span className="text-lg">{label}</span>} required error={error}>
        <textarea
          id="reason"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          required
          aria-invalid={!!error || undefined}
          aria-describedby={error ? "reason-error" : undefined}
          className="w-full rounded-lg border border-line px-3 py-2 text-base focus:border-primary focus:outline-none"
        />
      </FormField>
    </div>
  );
}
