"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { t } from "@/lib/i18n/t";
import { useLang } from "@/lib/i18n/LanguageContext";
import { dict, type DictKey } from "@/lib/i18n/dictionary";
import { varietyName } from "@/lib/i18n/varieties";
import type { DbAlert } from "@/types/database";

type AlertWithRelations = DbAlert & {
  trees?: { tree_id: string; zone: string; variety: string } | null;
  workers?: { users: { display_name: string } } | null;
};

const categoryIcon: Record<string, string> = {
  farm_health: "🌿",
  fraud_signal: "⚠️",
  inactivity: "😴",
  compliance: "📋",
};

// Solid fills for tier 1 and 2. They sit close in hue, so the icon and label —
// not the colour — are what actually distinguish urgent from moderate.
const tierBadge: Record<string, string> = {
  tier_1: "bg-warning text-white",
  tier_2: "bg-caution text-white",
  tier_3: "bg-surface-alt text-body border border-line",
};

const tierLabelKey: Record<string, DictKey> = {
  tier_1: "alertTierUrgent",
  tier_2: "alertTierModerate",
  tier_3: "alertTierInfo",
};

const statusLabelKey: Record<"open" | "resolved" | "dismissed", DictKey> = {
  open: "statusOpen",
  resolved: "statusResolved",
  dismissed: "statusDismissed",
};

export default function AlertsPage() {
  const { lang } = useLang();
  const [alerts, setAlerts] = useState<AlertWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"open" | "resolved" | "dismissed">("open");
  const [updating, setUpdating] = useState<string | null>(null);

  const tr = (key: DictKey) => t(dict[key], lang);

  const loadAlerts = useCallback(() => {
    setLoading(true);
    fetch(`/api/manager/alerts?status=${statusFilter}`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then(setAlerts)
      .catch(() => toast.error(tr("loadAlertsError")))
      .finally(() => setLoading(false));
  }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  async function updateAlert(alertId: string, status: "reviewed" | "resolved" | "dismissed") {
    setUpdating(alertId);
    try {
      const res = await fetch("/api/manager/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertId, status }),
      });
      if (!res.ok) throw new Error();
      toast.success(status === "resolved" ? tr("statusResolved") : tr("alertDismissedToast"));
      loadAlerts();
    } catch {
      toast.error(tr("actionFailedToast"));
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">{tr("navAlerts")}</h1>
        <div className="flex gap-2 rounded-lg bg-surface-alt p-1">
          {(["open", "resolved", "dismissed"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold transition sm:min-h-0 sm:py-1.5 ${
                statusFilter === s ? "bg-surface text-ink border border-line" : "text-muted"
              }`}
            >
              {tr(statusLabelKey[s])}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-surface-alt" />
          ))}
        </div>
      )}

      {!loading && alerts.length === 0 && (
        <div className="rounded-lg bg-surface p-10 text-center text-muted border border-line">
          {tr("noAlertsAtAll")}
        </div>
      )}

      <div className="space-y-3">
        {alerts.map((alert) => (
          <div key={alert.alert_id} className="rounded-lg bg-surface p-4 border border-line">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-2xl">{categoryIcon[alert.category] ?? "📌"}</span>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tierBadge[alert.tier]}`}>
                    {tierLabelKey[alert.tier] ? tr(tierLabelKey[alert.tier]) : alert.tier}
                  </span>
                  <p className="text-sm font-semibold text-ink">
                    {alert.subtype.replace(/_/g, " ")}
                  </p>
                </div>

                {alert.trees && (
                  <p className="mt-0.5 text-xs text-muted">
                    {tr("treeTitlePrefix")} {alert.trees.tree_id} · {tr("zoneLabel")} {alert.trees.zone} · {varietyName(alert.trees.variety, lang)}
                  </p>
                )}
                {alert.workers?.users && (
                  <p className="text-xs text-muted">{tr("navWorkers")}: {alert.workers.users.display_name}</p>
                )}
                <p className="mt-1 text-xs text-muted">
                  {new Date(alert.created_at).toLocaleString("th-TH")}
                </p>
              </div>

              {statusFilter === "open" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => updateAlert(alert.alert_id, "resolved")}
                    disabled={updating === alert.alert_id}
                    className="min-h-11 rounded-lg bg-primary-tint px-3 text-xs sm:min-h-0 sm:py-1.5 font-semibold text-primary-ink active:bg-primary-tint disabled:opacity-50"
                  >
                    {tr("statusResolved")}
                  </button>
                  <button
                    onClick={() => updateAlert(alert.alert_id, "dismissed")}
                    disabled={updating === alert.alert_id}
                    className="min-h-11 rounded-lg bg-surface-alt px-3 text-xs sm:min-h-0 sm:py-1.5 font-semibold text-body active:bg-surface-press disabled:opacity-50"
                  >
                    {tr("dismissAction")}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
