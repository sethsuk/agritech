"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { t, type Lang } from "@/lib/i18n/t";
import { useLang } from "@/lib/i18n/LanguageContext";
import { dict, type DictKey } from "@/lib/i18n/dictionary";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { DbWorkerWithUser } from "@/types/database";

interface LogRow {
  log_id: string;
  task_type: string;
  tree_id: string;
  submitted_at: string;
  validation_status: string;
}

interface DetailData {
  worker: DbWorkerWithUser;
  recentLogs: LogRow[];
}

const LANGUAGES: { value: "my" | "th" | "en"; label: string }[] = [
  { value: "my", label: "မြန်မာ" },
  { value: "th", label: "ไทย" },
  { value: "en", label: "English" },
];

const tierLabelKey: Record<string, DictKey> = {
  trusted: "tierTrusted",
  standard: "tierStandard",
  audit: "tierAudit",
};
const tierColor: Record<string, string> = {
  trusted: "bg-primary-tint text-primary-ink",
  standard: "bg-surface-alt text-body",
  audit: "bg-caution-tint text-caution-ink",
};
const statusColor: Record<string, string> = {
  passed: "text-primary-ink",
  flagged: "text-caution-ink",
  rejected: "text-warning-ink",
};

const deactivateConfirmText: Record<Lang, (name: string) => string> = {
  th: (name) => `ปิดใช้งาน ${name}? คนงานคนนี้จะเข้าสู่ระบบไม่ได้อีก`,
  my: (name) => `${name} ကို ပိတ်မလား? ဤအလုပ်သမားသည် နောက်ထပ် လော့ဂ်အင်ဝင်နိုင်တော့မည် မဟုတ်ပါ`,
  en: (name) => `Deactivate ${name}? They will no longer be able to log in`,
};
const reactivateConfirmText: Record<Lang, (name: string) => string> = {
  th: (name) => `เปิดใช้งาน ${name} อีกครั้ง?`,
  my: (name) => `${name} ကို ပြန်လည်အသုံးပြုမလား?`,
  en: (name) => `Reactivate ${name}?`,
};

export default function ManagerWorkerDetailPage() {
  const { workerId } = useParams<{ workerId: string }>();
  const { lang } = useLang();

  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);

  const [displayName, setDisplayName] = useState("");
  const [language, setLanguage] = useState<"my" | "th" | "en">("my");
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState(false);

  const tr = (key: DictKey) => t(dict[key], lang);

  const load = useCallback(() => {
    fetch(`/api/manager/workers/${workerId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: DetailData) => {
        setData(d);
        setDisplayName(d.worker.users.display_name);
        setLanguage(d.worker.language);
      })
      .catch(() => toast.error(tr("workerLoadError")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workerId]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!data || !displayName.trim()) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/manager/workers/${workerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: displayName.trim(), language }),
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

  async function doToggleActive() {
    if (!data) return;
    const deactivating = data.worker.active;
    setConfirmToggle(false);
    setToggling(true);
    try {
      const res = await fetch(`/api/manager/workers/${workerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !deactivating }),
      });
      if (!res.ok) {
        toast.error(tr("actionFailedToast"));
        return;
      }
      toast.success(deactivating ? tr("deactivatedWorkerToast") : tr("reactivatedWorkerToast"));
      load();
    } catch {
      toast.error(tr("genericErrorToast"));
    } finally {
      setToggling(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="h-40 animate-pulse rounded-lg bg-surface-alt" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6 text-center text-muted">
        {tr("workerNotFound")}
      </div>
    );
  }

  const { worker, recentLogs } = data;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/workers" className="inline-flex min-h-11 items-center text-sm text-muted sm:min-h-0">‹ {tr("back")}</Link>
        {!worker.active && (
          <span className="rounded-full bg-surface-press px-3 py-1 text-xs font-semibold text-body">
            {tr("inactiveBadge")}
          </span>
        )}
      </div>

      <div className="mb-4 rounded-lg bg-surface p-5 border border-line">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-ink">{worker.users.display_name}</h1>
          </div>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tierColor[worker.trust_tier] ?? ""}`}>
            {tierLabelKey[worker.trust_tier] ? tr(tierLabelKey[worker.trust_tier]) : worker.trust_tier}
          </span>
        </div>

        <div className="mt-3 flex gap-4 border-t border-line pt-3 text-xs text-muted">
          <span>{tr("totalLogsPrefix")} {worker.reliability_logs_total}</span>
          <span>{tr("flagRatePrefix")} {(Number(worker.reliability_flag_rate) * 100).toFixed(1)}%</span>
          <span>
            {worker.reliability_avg_completion_seconds > 0
              ? `${tr("avgPrefix")} ${Math.round(Number(worker.reliability_avg_completion_seconds))}s`
              : tr("noDataYet")}
          </span>
        </div>
      </div>

      {/* Edit form */}
      <form onSubmit={handleSave} className="mb-4 space-y-4 rounded-lg bg-surface p-5 border border-line">
        <h2 className="text-sm font-semibold text-body">{tr("editInfoTitle")}</h2>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-body">{tr("colName")}</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            className="h-12 w-full rounded-lg border border-line px-4 text-base focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-body">{tr("languageFieldLabel")}</label>
          <div className="flex gap-2">
            {LANGUAGES.map((l) => (
              <button
                key={l.value}
                type="button"
                onClick={() => setLanguage(l.value)}
                className={`h-12 flex-1 rounded-lg text-sm font-semibold ${
                  language === l.value ? "bg-primary text-white" : "bg-surface-alt text-body"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={saving || !displayName.trim()}
          className="h-12 w-full rounded-lg bg-primary text-base font-semibold text-white active:bg-primary-press disabled:bg-surface-press"
        >
          {saving ? tr("submitting") : tr("saveEditsButton")}
        </button>
      </form>

      {/* Recent logs */}
      <div className="mb-4 rounded-lg bg-surface p-5 border border-line">
        <h2 className="mb-3 text-sm font-semibold text-body">{tr("recentLogsTitle")}</h2>
        {recentLogs.length === 0 ? (
          <p className="text-sm text-muted">{tr("noLogsYet")}</p>
        ) : (
          <div className="space-y-2">
            {recentLogs.map((log) => (
              <div key={log.log_id} className="flex items-center justify-between border-b border-line pb-2 text-sm last:border-0">
                <div>
                  <p className="font-semibold text-ink">{log.task_type}</p>
                  <p className="text-xs text-muted">
                    {log.tree_id} · {new Date(log.submitted_at).toLocaleString("th-TH")}
                  </p>
                </div>
                <span className={`text-xs font-semibold ${statusColor[log.validation_status] ?? "text-muted"}`}>
                  {log.validation_status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Deactivate / reactivate */}
      <button
        onClick={() => setConfirmToggle(true)}
        disabled={toggling}
        className={`h-12 w-full rounded-lg text-sm font-semibold ${
          worker.active
            ? "bg-warning-tint text-warning-ink active:bg-warning-tint"
            : "bg-primary-tint text-primary-ink active:bg-primary-tint"
        } disabled:opacity-50`}
      >
        {worker.active ? tr("deactivateWorkerButton") : tr("reactivateWorkerButton")}
      </button>

      <ConfirmDialog
        open={confirmToggle}
        title={worker.active ? tr("deactivateWorkerTitle") : tr("reactivateWorkerTitle")}
        message={
          worker.active
            ? deactivateConfirmText[lang](worker.users.display_name)
            : reactivateConfirmText[lang](worker.users.display_name)
        }
        confirmLabel={worker.active ? tr("deactivateWorkerButton") : tr("reactivateWorkerButton")}
        destructive={worker.active}
        onConfirm={doToggleActive}
        onCancel={() => setConfirmToggle(false)}
      />
    </div>
  );
}
