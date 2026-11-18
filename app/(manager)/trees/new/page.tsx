"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isValidTreeId } from "@/lib/treeId";
import { downloadTreeQrLabel } from "@/lib/qrLabel";
import { useT } from "@/lib/i18n/LanguageContext";
import { errorMessage } from "@/lib/i18n/labels";
import { api, errorBody } from "@/lib/client/api";
import { qk } from "@/lib/client/queries";
import { KNOWN_VARIETIES } from "@/lib/i18n/varieties";
import type { GpsFix } from "@/lib/geo";
import type { DateInputState } from "@/components/DateInputDMY";
import { FormField, RequiredLegend } from "@/components/FormField";
import { GpsField, PlantedDateField, VarietyField, varietyOf, type VarietyValue } from "@/components/manager/TreeFields";
import type { DbTree } from "@/types/database";

export default function NewTreePage() {
  const router = useRouter();
  const { lang, tr } = useT();
  const queryClient = useQueryClient();

  const [treeId, setTreeId] = useState("");
  const [variety, setVariety] = useState<VarietyValue>({ choice: KNOWN_VARIETIES[0], custom: "" });
  const [planted, setPlanted] = useState<DateInputState>({ iso: null, problem: null });
  const [gps, setGps] = useState<GpsFix | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createdTree, setCreatedTree] = useState<DbTree | null>(null);

  const treeIdTrimmed = treeId.trim().toUpperCase();
  const treeIdValid = treeIdTrimmed.length === 0 || isValidTreeId(treeIdTrimmed);
  const varietyValue = varietyOf(variety);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    // Never a silently-disabled button: submit is always enabled and explains what's missing.
    if (!isValidTreeId(treeIdTrimmed) || !varietyValue || !planted.iso || !gps) {
      toast.error(tr("fixErrorsFirst"));
      return;
    }

    setSubmitting(true);
    try {
      const data = await api<{ tree: DbTree }>("/api/manager/trees", {
        method: "POST",
        json: { treeId: treeIdTrimmed, lat: gps.lat, long: gps.long, variety: varietyValue, plantedDate: planted.iso },
      });
      // A new zone must appear in every zone filter: refresh the cached lists.
      queryClient.invalidateQueries({ queryKey: qk.trees });
      queryClient.invalidateQueries({ queryKey: qk.overview });
      toast.success(tr("treeCreatedToast"));
      setCreatedTree(data.tree);
    } catch (err) {
      toast.error(errorMessage(errorBody(err), lang));
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setTreeId("");
    setVariety({ choice: KNOWN_VARIETIES[0], custom: "" });
    setPlanted({ iso: null, problem: null });
    setGps(null);
    setSubmitted(false);
    setCreatedTree(null);
  }

  if (createdTree) {
    return (
      <div className="mx-auto max-w-md px-4 py-6">
        <div className="rounded-lg bg-surface p-6 text-center border border-line">
          <div className="mb-3 text-5xl">✅</div>
          <h1 className="text-xl font-bold text-ink">{tr("treeCreatedTitle")}</h1>
          <p className="mt-1 font-mono text-lg text-body">{createdTree.tree_id}</p>
          <p className="mt-1 text-sm text-muted">{createdTree.qr_code}</p>

          <button
            onClick={() => downloadTreeQrLabel(createdTree.tree_id, createdTree.qr_code)}
            className="mt-6 h-12 w-full rounded-lg bg-primary text-sm font-semibold text-white active:bg-primary-press"
          >
            📥 {tr("downloadQr")}
          </button>

          <div className="mt-3 flex gap-2">
            <button
              onClick={resetForm}
              className="h-12 flex-1 rounded-lg bg-surface-alt text-sm font-semibold text-body active:bg-surface-press"
            >
              {tr("addAnotherTree")}
            </button>
            <button
              onClick={() => router.push(`/trees/${createdTree.tree_id}`)}
              className="h-12 flex-1 rounded-lg bg-surface-alt text-sm font-semibold text-body active:bg-surface-press"
            >
              {tr("viewDetails")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <div className="mb-4 flex items-center gap-2">
        <Link href="/trees" className="inline-flex min-h-11 items-center text-sm text-muted sm:min-h-0">‹ {tr("back")}</Link>
      </div>
      <h1 className="mb-6 text-2xl font-bold text-ink">{tr("newTreeTitle")}</h1>

      <form onSubmit={handleSubmit} noValidate className="space-y-4 rounded-lg bg-surface p-5 border border-line">
        <RequiredLegend />
        <FormField
          htmlFor="tree-id"
          label={tr("treeIdLabel")}
          required
          hint={tr("treeIdFormatHint")}
          error={!treeIdValid || (submitted && !treeIdTrimmed) ? tr("invalidFormat") : undefined}
        >
          <input
            id="tree-id"
            type="text"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            value={treeId}
            onChange={(e) => setTreeId(e.target.value)}
            placeholder="AL13-7"
            required
            aria-invalid={!treeIdValid || undefined}
            className={`h-12 w-full rounded-lg border px-4 font-mono text-base uppercase focus:outline-none ${
              treeIdValid ? "border-line focus:border-primary" : "border-2 border-warning"
            }`}
          />
        </FormField>

        <VarietyField value={variety} onChange={setVariety} />
        <PlantedDateField initial="" state={planted} onChange={setPlanted} showAllErrors={submitted} />
        <div>
          <GpsField value={gps} onChange={setGps} required buttonLabel={tr("currentLocationButton")} />
          {submitted && !gps && <p role="alert" className="mt-1.5 text-sm font-semibold text-warning-ink">{tr("gpsReadFailedRetry")}</p>}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="h-12 w-full rounded-lg bg-primary text-base font-semibold text-white transition active:bg-primary-press disabled:bg-surface-press"
        >
          {submitting ? tr("submitting") : tr("createTreeButton")}
        </button>
      </form>
    </div>
  );
}
