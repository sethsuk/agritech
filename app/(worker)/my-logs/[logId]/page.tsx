"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { t, taskDisplayName } from "@/lib/i18n/t";
import { WorkerHeader } from "@/components/worker/WorkerHeader";
import { TaskFormRenderer } from "@/components/worker/TaskFormRenderer";
import { useLang } from "@/lib/i18n/LanguageContext";
import { dict } from "@/lib/i18n/dictionary";
import type { DbTaskLog, DbTaskDefinition } from "@/types/database";

type Mode = "view" | "correct" | "void";

export default function MyLogDetailPage() {
  const { logId } = useParams<{ logId: string }>();
  const router = useRouter();
  const { lang } = useLang();

  const [trail, setTrail] = useState<DbTaskLog[] | null>(null);
  const [taskDef, setTaskDef] = useState<DbTaskDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("view");
  const [editFormData, setEditFormData] = useState<Record<string, unknown>>({});
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const tr = (key: keyof typeof dict) => t(dict[key], lang);

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
  }

  function startCorrection() {
    setEditFormData({ ...currentFormData });
    setReason("");
    setMode("correct");
  }

  function startVoid() {
    setReason("");
    setMode("void");
  }

  async function submitCorrection(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error(tr("reasonRequiredError"));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/my-logs/${logId}/correct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formData: editFormData, reason }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error === "log_already_voided" ? tr("alreadyVoidedError") : tr("correctionFailedToast"));
        return;
      }
      toast.success(tr("correctionSuccessToast"));
      await refreshTrail();
      setMode("view");
    } catch {
      toast.error(tr("correctionFailedToast"));
    } finally {
      setSaving(false);
    }
  }

  async function submitVoid(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error(tr("reasonRequiredError"));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/my-logs/${logId}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error === "log_already_voided" ? tr("alreadyVoidedError") : tr("voidFailedToast"));
        return;
      }
      toast.success(tr("voidSuccessToast"));
      await refreshTrail();
      setMode("view");
    } catch {
      toast.error(tr("voidFailedToast"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <WorkerHeader
        variant="back"
        title={taskDef ? taskDisplayName(taskDef, lang) : root.task_type}
        onBack={() => (mode !== "view" ? setMode("view") : router.push("/my-logs"))}
      />

      <main className="mx-auto w-full max-w-md flex-1 px-4 py-6 pb-32">
        {mode === "view" && (
          <>
            <div className="mb-4 rounded-lg border border-line bg-surface p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-lg font-bold text-ink">{root.tree_id}</p>
                  <p className="text-base text-muted">{new Date(root.submitted_at).toLocaleString("th-TH")}</p>
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
                    <span className="text-base text-muted">{new Date(entry.submitted_at).toLocaleString("th-TH")}</span>
                  </div>
                  {entry.correction_reason && (
                    <p className="mt-2 text-base text-body">{entry.correction_reason}</p>
                  )}
                  {entry.correction_type !== "void" && (
                    <dl className="mt-2 space-y-1">
                      {Object.entries(entry.form_data).map(([k, v]) => (
                        <div key={k} className="flex justify-between text-base">
                          <dt className="text-muted">{k}</dt>
                          <dd className="text-body">{typeof v === "object" ? JSON.stringify(v) : String(v)}</dd>
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
          <form onSubmit={submitCorrection} className="space-y-4">
            <TaskFormRenderer
              fields={taskDef.fields}
              formData={editFormData}
              onChange={(field, value) => setEditFormData((prev) => ({ ...prev, [field]: value }))}
            />

            <div className="rounded-lg border border-line bg-surface p-4">
              <label className="mb-2 block text-lg font-semibold text-body">{tr("correctReasonLabel")}</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={tr("correctReasonPlaceholder")}
                rows={3}
                className="w-full rounded-lg border border-line px-3 py-2 text-base focus:border-primary focus:outline-none"
              />
            </div>

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
          <form onSubmit={submitVoid} className="space-y-4">
            <div className="rounded-lg border border-line bg-surface p-4">
              <p className="text-base text-body">{tr("voidConfirmMessage")}</p>
            </div>

            <div className="rounded-lg border border-line bg-surface p-4">
              <label className="mb-2 block text-lg font-semibold text-body">{tr("voidReasonLabel")}</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={tr("voidReasonPlaceholder")}
                rows={3}
                className="w-full rounded-lg border border-line px-3 py-2 text-base focus:border-primary focus:outline-none"
              />
            </div>

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
