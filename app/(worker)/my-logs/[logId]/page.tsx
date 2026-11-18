"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { t, taskDisplayName } from "@/lib/i18n/t";
import { useT } from "@/lib/i18n/LanguageContext";
import { errorMessage, formValueLabel } from "@/lib/i18n/labels";
import { api, errorBody } from "@/lib/client/api";
import { qk, useMyLogTrail, useTaskDefs } from "@/lib/client/queries";
import { formatDateTime } from "@/lib/time";
import { WorkerHeader } from "@/components/worker/WorkerHeader";
import { TaskFormRenderer } from "@/components/worker/TaskFormRenderer";
import { AuditTrail } from "@/components/worker/AuditTrail";
import { ReasonField } from "@/components/worker/ReasonField";
import { ErrorState } from "@/components/QueryState";
import type { TaskField } from "@/types/database";

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
  const trailQuery = useMyLogTrail(logId);
  const defs = useTaskDefs();

  const [mode, setMode] = useState<Mode>("view");
  const [editFormData, setEditFormData] = useState<Record<string, unknown>>({});
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(false);
  const [saving, setSaving] = useState(false);

  const back = () => (mode !== "view" ? setMode("view") : router.push("/my-logs"));

  if (trailQuery.isError) {
    return (
      <div className="flex min-h-dvh flex-col">
        <WorkerHeader variant="back" title={tr("myLogsTitle")} onBack={back} />
        <main className="mx-auto w-full max-w-md px-4 py-6"><ErrorState error={trailQuery.error} onRetry={() => trailQuery.refetch()} /></main>
      </div>
    );
  }
  if (!trailQuery.data) {
    return (
      <div className="flex min-h-dvh flex-col">
        <WorkerHeader variant="back" title="…" onBack={back} />
        <main className="mx-auto w-full max-w-md px-4 py-6" aria-busy>
          <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-surface-alt" />)}</div>
        </main>
      </div>
    );
  }

  const trail = trailQuery.data.trail;
  const root = trail[0];
  const taskDef = defs.data?.find((d) => d.task_def_id === root.task_def_id);
  const voided = trail.some((e) => e.correction_type === "void");
  const currentFormData = [...trail].reverse().find((e) => e.correction_type !== "void")?.form_data ?? root.form_data;

  function start(next: Mode) {
    if (next === "correct") setEditFormData({ ...currentFormData });
    setReason("");
    setReasonError(false);
    setMode(next);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      setReasonError(true);
      document.getElementById("reason")?.focus();
      return;
    }
    setSaving(true);
    try {
      if (mode === "correct") {
        await api(`/api/my-logs/${logId}/correct`, { method: "POST", json: { formData: editFormData, reason } });
        toast.success(tr("correctionSuccessToast"));
      } else {
        await api(`/api/my-logs/${logId}/void`, { method: "POST", json: { reason } });
        toast.success(tr("voidSuccessToast"));
      }
      // Corrections/voids change this record, the records list and the tree's set counts.
      queryClient.invalidateQueries({ queryKey: qk.myLog(logId) });
      queryClient.invalidateQueries({ queryKey: qk.myLogs });
      queryClient.invalidateQueries({ queryKey: qk.workerTree(root.tree_id) });
      setMode("view");
    } catch (err) {
      toast.error(errorMessage(errorBody(err), lang, { fields: taskDef?.fields }), { duration: 6000 });
    } finally {
      setSaving(false);
    }
  }

  const reasonProps = {
    value: reason,
    onChange: (v: string) => { setReason(v); if (v.trim()) setReasonError(false); },
    error: reasonError ? tr("reasonRequiredError") : undefined,
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <WorkerHeader variant="back" title={taskDef ? taskDisplayName(taskDef, lang) : "—"} onBack={back} hideLogout={mode !== "view"} />

      <main className="mx-auto w-full max-w-md flex-1 px-4 py-6 pb-32">
        {mode === "view" && (
          <>
            <div className="mb-4 flex items-start justify-between rounded-lg border border-line bg-surface p-4">
              <div>
                <p className="text-lg font-bold text-ink">{root.tree_id}</p>
                <p className="text-base text-muted">{formatDateTime(root.submitted_at, lang)}</p>
              </div>
              {voided && <span className="rounded-full bg-warning-tint px-3 py-1 text-base font-semibold text-warning-ink">{tr("voidedBadge")}</span>}
            </div>

            <h2 className="mb-3 text-base font-semibold text-body">{tr("auditTrailTitle")}</h2>
            <div className="mb-6"><AuditTrail trail={trail} taskDef={taskDef} /></div>

            {!voided && taskDef && (
              <div className="space-y-3">
                <button type="button" onClick={() => start("correct")} className="h-15 w-full rounded-lg border-2 border-primary text-lg font-semibold text-primary-ink active:bg-primary-tint">
                  {tr("correctButton")}
                </button>
                <button type="button" onClick={() => start("void")} className="h-15 w-full rounded-lg border-2 border-warning text-lg font-semibold text-warning-ink active:bg-warning-tint">
                  {tr("voidButton")}
                </button>
              </div>
            )}
          </>
        )}

        {mode === "correct" && taskDef && (
          <form onSubmit={submit} noValidate className="space-y-4">
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
            <ReasonField label={tr("correctReasonLabel")} placeholder={tr("correctReasonPlaceholder")} {...reasonProps} />
            <StickySubmit label={saving ? tr("submitting") : tr("saveCorrectionButton")} disabled={saving} />
          </form>
        )}

        {mode === "void" && (
          <form onSubmit={submit} noValidate className="space-y-4">
            <div className="rounded-lg border border-warning bg-warning-tint p-4">
              <p className="text-lg font-semibold text-warning-ink">{tr("voidConfirmTitle")}</p>
              <p className="mt-1 text-base text-body">{tr("voidConfirmMessage")}</p>
            </div>
            <ReasonField label={tr("voidReasonLabel")} placeholder={tr("voidReasonPlaceholder")} {...reasonProps} />
            <StickySubmit label={saving ? tr("submitting") : tr("voidButton")} disabled={saving} destructive />
          </form>
        )}
      </main>
    </div>
  );
}

function StickySubmit({ label, disabled, destructive }: { label: string; disabled: boolean; destructive?: boolean }) {
  return (
    <div className="fixed inset-x-0 bottom-0 border-t border-line bg-surface p-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
      <div className="mx-auto max-w-md">
        <button
          type="submit"
          disabled={disabled}
          className={`h-15 w-full rounded-lg text-lg font-semibold text-white disabled:bg-surface-press ${
            destructive ? "bg-warning active:bg-warning-press" : "bg-primary active:bg-primary-press"
          }`}
        >
          {label}
        </button>
      </div>
    </div>
  );
}
