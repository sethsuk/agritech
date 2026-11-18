"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { t, taskDisplayName } from "@/lib/i18n/t";
import { useT } from "@/lib/i18n/LanguageContext";
import { errorMessage, rejectionMessage } from "@/lib/i18n/labels";
import { varietyName } from "@/lib/i18n/varieties";
import { firstMissingRequiredField } from "@/lib/validation/fields";
import { api, ApiError, errorBody } from "@/lib/client/api";
import { qk, useTaskDefs, useWorkerTree } from "@/lib/client/queries";
import { zoneKey } from "@/lib/treeId";
import { WorkerHeader } from "@/components/worker/WorkerHeader";
import { TaskFormRenderer, fieldDomId } from "@/components/worker/TaskFormRenderer";
import { PhotoCapture } from "@/components/worker/PhotoCapture";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { RequiredLegend } from "@/components/FormField";
import { ErrorState } from "@/components/QueryState";

interface StartLogResponse {
  logToken: string;
  photoRequired: boolean;
  photoRequirementReason: string;
}

type GpsState = { status: "reading" } | { status: "ok"; lat: number; long: number; accuracy: number } | { status: "off" };

export default function TaskFormPage() {
  const { treeId, taskDefId } = useParams<{ treeId: string; taskDefId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { lang, tr } = useT();
  const treeQuery = useWorkerTree(treeId);
  const defsQuery = useTaskDefs();
  const taskDef = defsQuery.data?.find((d) => d.task_def_id === taskDefId);

  const [startLog, setStartLog] = useState<StartLogResponse | null>(null);
  const [startError, setStartError] = useState<unknown>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null);
  const [gps, setGps] = useState<GpsState>({ status: "reading" });
  const submittedRef = useRef(false);

  const dirty = Object.keys(formData).length > 0 || photoUrl !== null;

  // --- GPS: read on open, show the result, allow retry (it used to fail silently and
  // quietly flag the log as gps_missing). ---
  const readGps = useCallback(() => {
    if (!navigator.geolocation) { setGps({ status: "off" }); return; }
    setGps({ status: "reading" });
    navigator.geolocation.getCurrentPosition(
      (pos) => setGps({ status: "ok", lat: pos.coords.latitude, long: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) }),
      () => setGps({ status: "off" }),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  }, []);
  useEffect(readGps, [readGps]);

  // --- Signed token + photo decision. Re-callable: an expired token is replaced
  // without losing what the worker has entered. ---
  const openForm = useCallback(async () => {
    setStartError(null);
    try {
      const qrScannedAt = sessionStorage.getItem("qr_scanned_at") ?? new Date().toISOString();
      setStartLog(await api<StartLogResponse>("/api/start-log", { method: "POST", json: { treeId, taskDefId, qrScannedAt } }));
    } catch (err) {
      setStartError(err);
    }
  }, [treeId, taskDefId]);
  useEffect(() => { openForm(); }, [openForm]);

  // --- Unsaved-input protection for reload / closing the tab. ---
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { if (!submittedRef.current) e.preventDefault(); };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const goToTree = () => router.replace(`/tree/${treeId}`);

  function handleBack() {
    if (dirty) setConfirmExit(true);
    else goToTree();
  }

  function showFieldError(field: string, message: string) {
    setFieldError({ field, message });
    requestAnimationFrame(() =>
      document.getElementById(fieldDomId(field))?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!startLog || !taskDef) return;
    setFieldError(null);

    const missing = firstMissingRequiredField(formData, taskDef.fields);
    if (missing) {
      showFieldError(missing.field_id, tr("rej_field_required", { field: t(missing.label, lang) }));
      return;
    }
    if (startLog.photoRequired && !photoUrl) {
      toast.error(tr("err_photo_required"));
      return;
    }

    setSubmitting(true);
    try {
      const data = await api<{ validationFlags: string[] }>("/api/submit-log", {
        method: "POST",
        json: {
          logToken: startLog.logToken,
          qrValue: sessionStorage.getItem("qr_value") ?? treeId,
          gpsLat: gps.status === "ok" ? gps.lat : null,
          gpsLong: gps.status === "ok" ? gps.long : null,
          formData,
          photoUrl,
          notesText: null,
        },
      });
      submittedRef.current = true;
      toast.success(data.validationFlags?.length ? tr("submitFlagged") : tr("submitSuccess"));
      queryClient.invalidateQueries({ queryKey: qk.workerTree(treeId) });
      queryClient.invalidateQueries({ queryKey: qk.myLogs });
      // replace, not push: Back from the tree screen shouldn't reopen a submitted form.
      goToTree();
    } catch (err) {
      const body = errorBody(err);
      if (body.error === "submission_rejected" && typeof body.field === "string") {
        showFieldError(body.field, rejectionMessage(body as never, taskDef.fields, lang));
      } else if (body.error === "token_expired") {
        await openForm(); // fresh token; entries are kept
        toast.error(tr("err_token_expired"), { duration: 8000 });
      } else if (["ribbon_in_use", "set_not_open", "fruit_count_exceeds_remaining", "empty_harvest"].includes(body.error)) {
        const field = body.error === "ribbon_in_use" ? "color"
          : body.error === "fruit_count_exceeds_remaining" ? "fruit_count"
          : body.error === "empty_harvest" ? "grade_counts" : "set_id";
        showFieldError(field, errorMessage(body, lang));
        if (body.error === "set_not_open") queryClient.invalidateQueries({ queryKey: qk.workerTree(treeId) });
      } else {
        toast.error(errorMessage(body, lang), { duration: 6000 });
      }
    } finally {
      setSubmitting(false);
    }
  }

  // --- Render ---

  const loadError = treeQuery.error ?? defsQuery.error ?? startError ?? (defsQuery.data && !taskDef ? new ApiError(404, { error: "task_not_found" }) : null);
  if (loadError) {
    return (
      <div className="flex min-h-dvh flex-col">
        <WorkerHeader variant="back" title={tr("formLoadError")} onBack={goToTree} hideLogout />
        <main className="mx-auto w-full max-w-md px-4 py-6">
          <ErrorState error={loadError} onRetry={() => { treeQuery.refetch(); defsQuery.refetch(); openForm(); }} />
        </main>
      </div>
    );
  }

  const tree = treeQuery.data?.tree;
  if (!tree || !taskDef || !startLog) {
    return (
      <div className="flex min-h-dvh flex-col">
        <WorkerHeader variant="back" title="…" onBack={goToTree} hideLogout />
        <main className="mx-auto w-full max-w-md px-4 py-6" aria-busy>
          <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-lg bg-surface-alt" />)}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {/* No logout on the form: it sat one mis-tap away and discarded the entries. */}
      <WorkerHeader variant="back" title={taskDisplayName(taskDef, lang)} onBack={handleBack} hideLogout />

      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-4 pb-36">
        <p className="mb-2 flex items-center gap-2 text-lg text-muted">
          <span aria-hidden className="text-xl">{taskDef.icon ?? "📋"}</span>
          {tree.tree_id} · {zoneKey(tree.zone, tree.side)} · {varietyName(tree.variety, lang)}
        </p>

        <GpsChip gps={gps} onRetry={readGps} />

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <RequiredLegend />
          <TaskFormRenderer
            fields={taskDef.fields}
            formData={formData}
            openSets={treeQuery.data?.sets ?? []}
            errorField={fieldError?.field}
            errorMessage={fieldError?.message}
            onChange={(field, value) => {
              setFormData((prev) => ({ ...prev, [field]: value }));
              if (fieldError?.field === field) setFieldError(null);
            }}
          />

          <div className={`rounded-lg p-4 ${startLog.photoRequired ? "bg-caution-tint" : "bg-surface-alt"}`}>
            <p className={`mb-3 text-lg font-semibold ${startLog.photoRequired ? "text-caution-ink" : "text-body"}`}>
              📸 {startLog.photoRequired
                ? (startLog.photoRequirementReason === "random_audit" ? tr("photoAuditNotice") : tr("photoRequiredNotice"))
                : tr("photoOptionalNotice")}
            </p>
            <PhotoCapture photoUrl={photoUrl} onChange={setPhotoUrl} />
          </div>

          <div className="fixed inset-x-0 bottom-0 border-t border-line bg-surface p-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
            <div className="mx-auto max-w-md">
              <button
                type="submit"
                disabled={submitting}
                className="h-15 w-full rounded-lg bg-primary text-lg font-semibold text-white transition active:bg-primary-press disabled:bg-surface-press"
              >
                {submitting ? tr("submitting") : tr("submitButton")}
              </button>
            </div>
          </div>
        </form>
      </main>

      <ConfirmDialog
        open={confirmExit}
        title={tr("exitFormTitle")}
        message={tr("exitFormConfirm")}
        confirmLabel={tr("exitFormDiscard")}
        destructive
        onConfirm={() => { setConfirmExit(false); submittedRef.current = true; goToTree(); }}
        onCancel={() => setConfirmExit(false)}
      />
    </div>
  );
}

function GpsChip({ gps, onRetry }: { gps: GpsState; onRetry: () => void }) {
  const { tr } = useT();
  if (gps.status === "ok") {
    return (
      <p role="status" className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary-tint px-3 py-1.5 text-sm font-semibold text-primary-ink">
        📍 {tr("gpsFound", { m: gps.accuracy })}
      </p>
    );
  }
  if (gps.status === "reading") {
    return <p role="status" className="mb-4 inline-flex items-center gap-2 rounded-full bg-surface-alt px-3 py-1.5 text-sm text-muted">📍 {tr("readingLocation")}</p>;
  }
  return (
    <div role="alert" className="mb-4 flex items-center justify-between gap-2 rounded-lg border border-caution bg-caution-tint p-3 text-sm text-caution-ink">
      <span>📍 {tr("gpsOffWarning")}</span>
      <button type="button" onClick={onRetry} className="min-h-11 flex-shrink-0 rounded-lg bg-surface px-3 font-semibold text-body border border-line">
        {tr("retryButton")}
      </button>
    </div>
  );
}
