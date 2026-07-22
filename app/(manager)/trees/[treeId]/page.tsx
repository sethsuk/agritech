"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { downloadTreeQrLabel } from "@/lib/qrLabel";
import { t, type Lang } from "@/lib/i18n/t";
import { useLang } from "@/lib/i18n/LanguageContext";
import { dict, type DictKey } from "@/lib/i18n/dictionary";
import type { DbTree, DbAlert } from "@/types/database";

const KNOWN_VARIETIES = ["Monthong", "Chanee", "Puangmanee"];

interface LogRow {
  log_id: string;
  task_type: string;
  worker_id: string;
  submitted_at: string;
  validation_status: string;
  validation_flags: string[];
  workers?: { users: { display_name: string } };
}

interface DetailData {
  tree: DbTree;
  recentLogs: LogRow[];
  openAlerts: Pick<DbAlert, "alert_id" | "tier" | "category" | "subtype" | "created_at">[];
}

const statusColor: Record<string, string> = {
  passed: "text-emerald-600",
  flagged: "text-amber-600",
  rejected: "text-red-600",
};

const retireConfirmText: Record<Lang, (treeId: string) => string> = {
  th: (id) => `ปลดระวางต้น ${id}? คนงานจะสแกน QR ต้นนี้ไม่ได้อีก`,
  my: (id) => `${id} ကို ပယ်ဖျက်မလား? အလုပ်သမားများ ဤပင်၏ QR ကို စကင်ဖတ်နိုင်တော့မည် မဟုတ်ပါ`,
  en: (id) => `Retire tree ${id}? Workers will no longer be able to scan its QR code`,
};
const reactivateConfirmText: Record<Lang, (treeId: string) => string> = {
  th: (id) => `เปิดใช้งานต้น ${id} อีกครั้ง?`,
  my: (id) => `${id} ကို ပြန်လည်အသုံးပြုမလား?`,
  en: (id) => `Reactivate tree ${id}?`,
};

export default function ManagerTreeDetailPage() {
  const { treeId } = useParams<{ treeId: string }>();
  const router = useRouter();
  const { lang } = useLang();

  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit form state
  const [varietyChoice, setVarietyChoice] = useState(KNOWN_VARIETIES[0]);
  const [customVariety, setCustomVariety] = useState("");
  const [plantedDate, setPlantedDate] = useState("");
  const [gpsOverride, setGpsOverride] = useState<{ lat: number; long: number } | null>(null);
  const [capturingGps, setCapturingGps] = useState(false);
  const [saving, setSaving] = useState(false);
  const [retiring, setRetiring] = useState(false);

  const tr = (key: DictKey) => t(dict[key], lang);

  const load = useCallback(() => {
    fetch(`/api/manager/trees/${treeId}`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((d: DetailData) => {
        setData(d);
        const known = KNOWN_VARIETIES.includes(d.tree.variety);
        setVarietyChoice(known ? d.tree.variety : "other");
        setCustomVariety(known ? "" : d.tree.variety);
        setPlantedDate(d.tree.planted_date);
        setGpsOverride(null);
      })
      .catch(() => toast.error(tr("treeLoadError")))
      .finally(() => setLoading(false));
  }, [treeId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  function captureGps() {
    if (!navigator.geolocation) {
      toast.error(tr("gpsUnsupported"));
      return;
    }
    setCapturingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsOverride({ lat: pos.coords.latitude, long: pos.coords.longitude });
        setCapturingGps(false);
      },
      () => {
        toast.error(tr("gpsReadFailed"));
        setCapturingGps(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;
    const variety = varietyChoice === "other" ? customVariety.trim() : varietyChoice;
    if (!variety || !plantedDate) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/manager/trees/${treeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variety,
          plantedDate,
          ...(gpsOverride ? { lat: gpsOverride.lat, long: gpsOverride.long } : {}),
        }),
      });
      if (!res.ok) {
        toast.error(tr("saveFailedToast"));
        return;
      }
      toast.success(tr("savedToast"));
      load();
    } catch {
      toast.error(tr("genericErrorToast"));
    } finally {
      setSaving(false);
    }
  }

  async function handleRetireToggle() {
    if (!data) return;
    const retiring_ = data.tree.status === "active";
    const message = retiring_
      ? retireConfirmText[lang](treeId)
      : reactivateConfirmText[lang](treeId);
    if (!window.confirm(message)) return;

    setRetiring(true);
    try {
      const res = await fetch(`/api/manager/trees/${treeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: retiring_ ? "retired" : "active" }),
      });
      if (!res.ok) {
        toast.error(tr("actionFailedToast"));
        return;
      }
      toast.success(retiring_ ? tr("retiredToast") : tr("reactivatedToast"));
      load();
    } catch {
      toast.error(tr("genericErrorToast"));
    } finally {
      setRetiring(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6 text-center text-slate-400">
        {tr("treeNotFound")}
      </div>
    );
  }

  const { tree, recentLogs, openAlerts } = data;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/trees" className="text-sm text-slate-400">‹ {tr("back")}</Link>
        {tree.status === "retired" && (
          <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-600">
            {tr("retiredBadge")}
          </span>
        )}
      </div>

      <div className="mb-4 rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-mono text-2xl font-bold text-slate-900">{tree.tree_id}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {tr("zoneLabel")} {tree.zone}{tree.side} · {tr("rowLabel")} {tree.row_num} · {tr("columnLabel")} {tree.position}
            </p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            {Math.round(Number(tree.derived_health_score) * 100)}%
          </span>
        </div>

        {openAlerts.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            {openAlerts.map((a) => (
              <span key={a.alert_id} className="rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
                🔔 {a.subtype}
              </span>
            ))}
          </div>
        )}

        <button
          onClick={() => downloadTreeQrLabel(tree.tree_id, tree.qr_code)}
          className="mt-4 h-11 w-full rounded-xl bg-slate-100 text-sm font-medium text-slate-700 active:bg-slate-200"
        >
          📥 {tr("downloadQr")}
        </button>
      </div>

      {/* Edit form */}
      <form onSubmit={handleSave} className="mb-4 space-y-4 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">{tr("editInfoTitle")}</h2>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">{tr("colVariety")}</label>
          <select
            value={varietyChoice}
            onChange={(e) => setVarietyChoice(e.target.value)}
            className="h-12 w-full rounded-xl border border-slate-300 px-4 text-base focus:border-emerald-500 focus:outline-none"
          >
            {KNOWN_VARIETIES.map((v) => (
              <option key={v} value={v}>{v}</option>
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
              className="mt-2 h-12 w-full rounded-xl border border-slate-300 px-4 text-base focus:border-emerald-500 focus:outline-none"
            />
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">{tr("plantedDateLabel")}</label>
          <input
            type="date"
            value={plantedDate}
            onChange={(e) => setPlantedDate(e.target.value)}
            required
            className="h-12 w-full rounded-xl border border-slate-300 px-4 text-base focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">{tr("gpsLocationLabel")}</label>
          <p className="mb-2 text-xs text-slate-400">
            {tr("currentPrefix")}: {Number(tree.lat).toFixed(6)}, {Number(tree.long).toFixed(6)}
          </p>
          <button
            type="button"
            onClick={captureGps}
            disabled={capturingGps}
            className={`h-12 w-full rounded-xl text-sm font-medium ${
              gpsOverride ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
            } disabled:opacity-50`}
          >
            {capturingGps
              ? tr("readingLocation")
              : gpsOverride
              ? `✓ ${gpsOverride.lat.toFixed(6)}, ${gpsOverride.long.toFixed(6)}`
              : tr("recaptureLocation")}
          </button>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="h-12 w-full rounded-xl bg-emerald-600 text-base font-semibold text-white active:bg-emerald-700 disabled:bg-slate-300"
        >
          {saving ? tr("submitting") : tr("saveEditsButton")}
        </button>
      </form>

      {/* Recent logs */}
      <div className="mb-4 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">{tr("recentLogsTitle")}</h2>
        {recentLogs.length === 0 ? (
          <p className="text-sm text-slate-400">{tr("noLogsYet")}</p>
        ) : (
          <div className="space-y-2">
            {recentLogs.map((log) => (
              <div key={log.log_id} className="flex items-center justify-between border-b border-slate-50 pb-2 text-sm last:border-0">
                <div>
                  <p className="font-medium text-slate-800">{log.task_type}</p>
                  <p className="text-xs text-slate-400">
                    {log.workers?.users?.display_name ?? "—"} · {new Date(log.submitted_at).toLocaleString("th-TH")}
                  </p>
                </div>
                <span className={`text-xs font-medium ${statusColor[log.validation_status] ?? "text-slate-400"}`}>
                  {log.validation_status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Retire / unretire */}
      <button
        onClick={handleRetireToggle}
        disabled={retiring}
        className={`h-12 w-full rounded-xl text-sm font-medium ${
          tree.status === "active"
            ? "bg-red-50 text-red-600 active:bg-red-100"
            : "bg-emerald-50 text-emerald-700 active:bg-emerald-100"
        } disabled:opacity-50`}
      >
        {tree.status === "active" ? tr("retireTreeButton") : tr("reactivateTreeButton")}
      </button>
    </div>
  );
}
