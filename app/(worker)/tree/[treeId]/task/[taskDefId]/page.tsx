"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { t, taskDisplayName } from "@/lib/i18n/t";
import { WorkerHeader } from "@/components/worker/WorkerHeader";
import { TaskFormRenderer } from "@/components/worker/TaskFormRenderer";
import { PhotoCapture } from "@/components/worker/PhotoCapture";
import { useLang } from "@/lib/i18n/LanguageContext";
import { dict } from "@/lib/i18n/dictionary";
import { varietyName } from "@/lib/i18n/varieties";
import type { DbTaskDefinition, DbTree } from "@/types/database";

interface StartLogResponse {
  logToken: string;
  photoRequired: boolean;
  photoRequirementReason: string;
  formOpenedAt: string;
}

export default function TaskFormPage() {
  const { treeId, taskDefId } = useParams<{ treeId: string; taskDefId: string }>();
  const router = useRouter();
  const { lang } = useLang();

  const [tree, setTree] = useState<DbTree | null>(null);
  const [taskDef, setTaskDef] = useState<DbTaskDefinition | null>(null);
  const [startLog, setStartLog] = useState<StartLogResponse | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const gpsRef = useRef<{ lat: number; long: number } | null>(null);

  const tr = (key: keyof typeof dict) => t(dict[key], lang);

  // Capture GPS on mount
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        gpsRef.current = { lat: pos.coords.latitude, long: pos.coords.longitude };
      },
      () => { /* denied — gps_missing flag raised server-side */ },
      { timeout: 10000, maximumAge: 30000 },
    );
  }, []);

  // Load tree + task def, then call start-log
  useEffect(() => {
    const qrScannedAt = sessionStorage.getItem("qr_scanned_at") ?? new Date().toISOString();

    Promise.all([
      fetch(`/api/trees/${treeId}`).then((r) => r.ok ? r.json() : Promise.reject("tree")),
      fetch(`/api/task-definitions`).then((r) => r.ok ? r.json() : Promise.reject("defs")),
    ])
      .then(async ([treeRes, defsRes]) => {
        setTree(treeRes.tree);
        const def = (defsRes as DbTaskDefinition[]).find((d) => d.task_def_id === taskDefId);
        if (!def) throw new Error("Task definition not found");
        setTaskDef(def);

        // Call start-log to get the photo decision + log token
        const slRes = await fetch("/api/start-log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ treeId, taskDefId, qrScannedAt }),
        });
        if (!slRes.ok) throw new Error("start-log failed");
        const sl: StartLogResponse = await slRes.json();
        setStartLog(sl);
      })
      .catch((err) => {
        console.error(err);
        toast.error(tr("formLoadError"));
        router.back();
      })
      .finally(() => setLoading(false));
  }, [treeId, taskDefId, router]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleBack() {
    const hasInput = Object.keys(formData).length > 0 || photoUrl !== null;
    if (hasInput && !window.confirm(tr("exitFormConfirm"))) return;
    router.back();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!startLog || !taskDef) return;

    if (startLog.photoRequired && !photoUrl) {
      toast.error(tr("photoRequiredError"));
      return;
    }

    // Validate required fields
    for (const field of taskDef.fields) {
      if (field.required && (formData[field.field_id] === undefined || formData[field.field_id] === "")) {
        toast.error(`${tr("fieldRequiredError")}: ${t(field.label, lang)}`);
        return;
      }
    }

    setSubmitting(true);
    const qrValue = sessionStorage.getItem("qr_value") ?? treeId;
    const qrScannedAt = sessionStorage.getItem("qr_scanned_at") ?? new Date().toISOString();

    try {
      const res = await fetch("/api/submit-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logToken: startLog.logToken,
          qrValue,
          qrScannedAt,
          gpsLat: gpsRef.current?.lat ?? null,
          gpsLong: gpsRef.current?.long ?? null,
          formData,
          photoUrl,
          notesText: null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.error === "submission_rejected") {
          toast.error(`${tr("submissionRejected")}: ${data.detail}`);
        } else {
          toast.error(tr("submitError"));
        }
        return;
      }

      if (data.validationFlags?.length > 0) {
        toast.success(tr("submitFlagged"));
      } else {
        toast.success(tr("submitSuccess"));
      }

      router.push(`/tree/${treeId}`);
    } catch {
      toast.error(tr("submitError"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-md px-4 py-6">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      </main>
    );
  }

  if (!taskDef || !tree || !startLog) return null;

  return (
    <div className="flex min-h-dvh flex-col">
      <WorkerHeader
        variant="back"
        title={taskDisplayName(taskDef, lang)}
        onBack={handleBack}
      />

      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-4 pb-32">
      {/* Tree context */}
      <p className="mb-4 flex items-center gap-2 text-sm text-slate-500">
        <span className="text-xl">{taskDef.icon ?? "📋"}</span>
        {tree.tree_id} · {tree.zone}{tree.side} · {varietyName(tree.variety, lang)}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <TaskFormRenderer
          fields={taskDef.fields}
          formData={formData}
          onChange={(field, value) =>
            setFormData((prev) => ({ ...prev, [field]: value }))
          }
        />

        {/* Photo section */}
        {startLog.photoRequired && (
          <div className="rounded-2xl bg-amber-50 p-4">
            <p className="mb-3 text-sm font-medium text-amber-800">
              📸 {startLog.photoRequirementReason === "random_audit"
                ? tr("photoAuditNotice")
                : tr("photoRequiredNotice")}
            </p>
            <PhotoCapture
              photoUrl={photoUrl}
              onChange={setPhotoUrl}
            />
          </div>
        )}

        {/* Sticky submit */}
        <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white p-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
          <div className="mx-auto max-w-md">
            <button
              type="submit"
              disabled={submitting}
              className="h-14 w-full rounded-2xl bg-emerald-600 text-lg font-semibold text-white transition active:bg-emerald-700 disabled:bg-slate-300"
            >
              {submitting ? tr("submitting") : tr("submitButton")}
            </button>
          </div>
        </div>
      </form>
      </main>
    </div>
  );
}
