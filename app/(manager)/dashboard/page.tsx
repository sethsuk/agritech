"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import type { DbAlert, DbTaskLog } from "@/types/database";

interface OverviewData {
  openAlertsCount: number;
  tier1AlertsCount: number;
  logsToday: number;
  logsThisWeek: number;
  recentAlerts: (DbAlert & { trees?: { tree_id: string; zone: string }; workers?: { users: { display_name: string } } })[];
  recentLogs: Pick<DbTaskLog, "log_id" | "tree_id" | "task_type" | "worker_id" | "submitted_at" | "validation_status" | "validation_flags">[];
}

const tierLabel: Record<string, { label: string; color: string }> = {
  tier_1: { label: "ด่วน", color: "bg-red-100 text-red-700" },
  tier_2: { label: "ปานกลาง", color: "bg-amber-100 text-amber-700" },
  tier_3: { label: "ข้อมูล", color: "bg-slate-100 text-slate-600" },
};

const categoryIcon: Record<string, string> = {
  farm_health: "🌿",
  fraud_signal: "⚠️",
  inactivity: "😴",
  compliance: "📋",
};

export default function ManagerDashboard() {
  const [data, setData] = useState<OverviewData | null>(null);

  useEffect(() => {
    fetch("/api/manager/overview")
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then(setData)
      .catch(() => toast.error("โหลดข้อมูลไม่สำเร็จ"));
  }, []);

  const statCards = data
    ? [
        { label: "การแจ้งเตือนที่เปิดอยู่", value: data.openAlertsCount, color: "text-red-600", href: "/alerts" },
        { label: "การแจ้งเตือนด่วน", value: data.tier1AlertsCount, color: "text-amber-600", href: "/alerts" },
        { label: "บันทึกวันนี้", value: data.logsToday, color: "text-emerald-600", href: null },
        { label: "บันทึกสัปดาห์นี้", value: data.logsThisWeek, color: "text-blue-600", href: null },
      ]
    : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">ภาพรวมฟาร์ม</h1>

      {/* Stat tiles */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {data === null
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
            ))
          : statCards.map(({ label, value, color, href }) => {
              const inner = (
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className={`mt-1 text-3xl font-bold ${color}`}>{value}</p>
                </div>
              );
              return href ? (
                <Link key={label} href={href}>{inner}</Link>
              ) : (
                <div key={label}>{inner}</div>
              );
            })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent alerts */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">การแจ้งเตือนล่าสุด</h2>
            <Link href="/alerts" className="text-sm text-emerald-600 hover:underline">
              ดูทั้งหมด →
            </Link>
          </div>
          <div className="space-y-2">
            {data === null && (
              <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />
            )}
            {data?.recentAlerts.length === 0 && (
              <div className="rounded-2xl bg-white p-6 text-center text-sm text-slate-400 shadow-sm">
                ไม่มีการแจ้งเตือนที่เปิดอยู่
              </div>
            )}
            {data?.recentAlerts.map((alert) => {
              const tier = tierLabel[alert.tier] ?? { label: alert.tier, color: "bg-slate-100 text-slate-600" };
              return (
                <div
                  key={alert.alert_id}
                  className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm"
                >
                  <span className="text-xl">{categoryIcon[alert.category] ?? "📌"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {alert.subtype.replace(/_/g, " ")}
                      {alert.tree_id && ` · ${alert.tree_id}`}
                    </p>
                    <p className="text-xs text-slate-400">
                      {new Date(alert.created_at).toLocaleString("th-TH")}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tier.color}`}>
                    {tier.label}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Recent logs */}
        <section>
          <h2 className="mb-3 font-semibold text-slate-800">บันทึกล่าสุด</h2>
          <div className="space-y-2">
            {data === null && (
              <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />
            )}
            {data?.recentLogs.length === 0 && (
              <div className="rounded-2xl bg-white p-6 text-center text-sm text-slate-400 shadow-sm">
                ยังไม่มีบันทึก
              </div>
            )}
            {data?.recentLogs.map((log) => (
              <div
                key={log.log_id}
                className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm"
              >
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {log.tree_id} · {log.task_type}
                  </p>
                  <p className="text-xs text-slate-400">
                    {new Date(log.submitted_at).toLocaleString("th-TH")}
                  </p>
                </div>
                {log.validation_status !== "passed" && (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    log.validation_status === "flagged"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-red-100 text-red-700"
                  }`}>
                    {log.validation_flags?.[0] ?? log.validation_status}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
