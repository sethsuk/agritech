"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { isValidTreeId } from "@/lib/treeId";
import { downloadTreeQrLabel } from "@/lib/qrLabel";
import { t } from "@/lib/i18n/t";
import { useLang } from "@/lib/i18n/LanguageContext";
import { dict, type DictKey } from "@/lib/i18n/dictionary";
import { KNOWN_VARIETIES, varietyName } from "@/lib/i18n/varieties";
import { DateInputDMY } from "@/components/DateInputDMY";
import type { DbTree } from "@/types/database";

export default function NewTreePage() {
  const router = useRouter();
  const { lang } = useLang();

  const [treeId, setTreeId] = useState("");
  const [varietyChoice, setVarietyChoice] = useState(KNOWN_VARIETIES[0]);
  const [customVariety, setCustomVariety] = useState("");
  const [plantedDate, setPlantedDate] = useState("");
  const [gps, setGps] = useState<{ lat: number; long: number } | null>(null);
  const [capturingGps, setCapturingGps] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createdTree, setCreatedTree] = useState<DbTree | null>(null);

  const tr = (key: DictKey) => t(dict[key], lang);

  const treeIdTrimmed = treeId.trim().toUpperCase();
  const treeIdValid = treeIdTrimmed.length === 0 || isValidTreeId(treeIdTrimmed);
  const variety = varietyChoice === "other" ? customVariety.trim() : varietyChoice;

  const canSubmit =
    isValidTreeId(treeIdTrimmed) &&
    variety.length > 0 &&
    plantedDate.length > 0 &&
    gps !== null &&
    !submitting;

  function captureGps() {
    if (!navigator.geolocation) {
      toast.error(tr("gpsUnsupported"));
      return;
    }
    setCapturingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, long: pos.coords.longitude });
        setCapturingGps(false);
      },
      () => {
        toast.error(tr("gpsReadFailedRetry"));
        setCapturingGps(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !gps) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/manager/trees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          treeId: treeIdTrimmed,
          lat: gps.lat,
          long: gps.long,
          variety,
          plantedDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.detail ?? tr("createTreeFailedToast"));
        return;
      }
      toast.success(tr("treeCreatedToast"));
      setCreatedTree(data.tree);
    } catch {
      toast.error(tr("scanError"));
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setTreeId("");
    setVarietyChoice(KNOWN_VARIETIES[0]);
    setCustomVariety("");
    setPlantedDate("");
    setGps(null);
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

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg bg-surface p-5 border border-line">
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-body">
            {tr("treeIdLabel")}
          </label>
          <input
            type="text"
            value={treeId}
            onChange={(e) => setTreeId(e.target.value)}
            placeholder="AL13-7"
            required
            className={`h-12 w-full rounded-lg border px-4 text-base uppercase focus:outline-none ${
              treeIdValid ? "border-line focus:border-primary" : "border-warning"
            }`}
          />
          <p className="mt-1 text-xs text-muted">
            {tr("treeIdFormatHint")}
          </p>
          {!treeIdValid && (
            <p className="mt-1 text-xs text-warning-ink">{tr("invalidFormat")}</p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-body">{tr("colVariety")}</label>
          <select
            value={varietyChoice}
            onChange={(e) => setVarietyChoice(e.target.value)}
            className="h-12 w-full rounded-lg border border-line px-4 text-base focus:border-primary focus:outline-none"
          >
            {/* value stays the canonical romanized name; only the label is translated */}
            {KNOWN_VARIETIES.map((v) => (
              <option key={v} value={v}>{varietyName(v, lang)}</option>
            ))}
            <option value="other">{tr("otherOption")}</option>
          </select>
          {varietyChoice === "other" && (
            <input
              type="text"
              value={customVariety}
              onChange={(e) => setCustomVariety(e.target.value)}
              placeholder={tr("customVarietyPlaceholder")}
              required
              className="mt-2 h-12 w-full rounded-lg border border-line px-4 text-base focus:border-primary focus:outline-none"
            />
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-body">{tr("plantedDateLabel")}</label>
          <DateInputDMY value={plantedDate} onChange={setPlantedDate} required />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-body">{tr("gpsLocationLabel")}</label>
          <button
            type="button"
            onClick={captureGps}
            disabled={capturingGps}
            className={`h-12 w-full rounded-lg text-sm font-semibold ${
              gps ? "bg-primary-tint text-primary-ink" : "bg-surface-alt text-body"
            } disabled:opacity-50`}
          >
            {capturingGps
              ? tr("readingLocation")
              : gps
              ? `✓ ${gps.lat.toFixed(6)}, ${gps.long.toFixed(6)}`
              : tr("currentLocationButton")}
          </button>
          <p className="mt-1 text-xs text-muted">{tr("gpsStandHint")}</p>
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="h-12 w-full rounded-lg bg-primary text-base font-semibold text-white transition active:bg-primary-press disabled:bg-surface-press"
        >
          {submitting ? tr("submitting") : tr("createTreeButton")}
        </button>
      </form>
    </div>
  );
}
