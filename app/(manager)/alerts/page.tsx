"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
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

const tierBadge: Record<string, string> = {
  tier_1: "bg-red-100 text-red-700 border border-red-200",
  tier_2: "bg-amber-100 text-amber-700 border border-amber-200",
  tier_3: "bg-slate-100 text-slate-600",
};

const tierLabel: Record<string, string> = {
  tier_1: "ด่วน",
  tier_2: "ปานกลาง",
  tier_3: "ข้อมูล",
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"open" | "resolved" | "dismissed">("open");
  const [updating, setUpdating] = useState<string | null>(null);

  const loadAlerts = useCallback(() => {
    setLoading(true);
    fetch(`/api/manager/alerts?status=${statusFilter}`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then(setAlerts)
      .catch(() => toast.error("โหลดการแจ้งเตือนไม่สำเร็จ"))
      .finally(() => setLoading(false));
  }, [statusFilter]);

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
      toast.success(status === "resolved" ? "แก้ไขแล้ว" : "ปิดการแจ้งเตือน");
      loadAlerts();
    } catch {
      toast.error("ดำเนินการไม่สำเร็จ");
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">การแจ้งเตือน</h1>
        <div className="flex gap-2 rounded-xl bg-slate-100 p-1">
          {(["open", "resolved", "dismissed"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                statusFilter === s ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              {s === "open" ? "เปิด" : s === "resolved" ? "แก้ไขแล้ว" : "ปิดแล้ว"}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      )}

      {!loading && alerts.length === 0 && (
        <div className="rounded-2xl bg-white p-10 text-center text-slate-400 shadow-sm">
          ไม่มีการแจ้งเตือน
        </div>
      )}

      <div className="space-y-3">
        {alerts.map((alert) => (
          <div key={alert.alert_id} className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-2xl">{categoryIcon[alert.category] ?? "📌"}</span>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tierBadge[alert.tier]}`}>
                    {tierLabel[alert.tier] ?? alert.tier}
                  </span>
                  <p className="text-sm font-semibold text-slate-800">
                    {alert.subtype.replace(/_/g, " ")}
                  </p>
                </div>

                {alert.trees && (
                  <p className="mt-0.5 text-xs text-slate-500">
                    ต้น {alert.trees.tree_id} · โซน {alert.trees.zone} · {alert.trees.variety}
                  </p>
                )}
                {alert.workers?.users && (
                  <p className="text-xs text-slate-500">คนงาน: {alert.workers.users.display_name}</p>
                )}
                <p className="mt-1 text-xs text-slate-400">
                  {new Date(alert.created_at).toLocaleString("th-TH")}
                </p>
              </div>

              {statusFilter === "open" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => updateAlert(alert.alert_id, "resolved")}
                    disabled={updating === alert.alert_id}
                    className="rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-medium text-emerald-700 active:bg-emerald-200 disabled:opacity-50"
                  >
                    แก้ไขแล้ว
                  </button>
                  <button
                    onClick={() => updateAlert(alert.alert_id, "dismissed")}
                    disabled={updating === alert.alert_id}
                    className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 active:bg-slate-200 disabled:opacity-50"
                  >
                    ปิด
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
