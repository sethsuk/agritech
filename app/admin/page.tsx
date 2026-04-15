"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { StatCard } from "@/components/StatCard";
import { ZoneHealthBars } from "@/components/ZoneHealthBars";
import { IssueFrequencyList } from "@/components/IssueFrequencyList";
import { AlertRow } from "@/components/AlertRow";
import type { Notification } from "@/lib/notifications";
import type { MapTree } from "@/components/FarmMap";

const FarmMap = dynamic(() => import("@/components/FarmMap"), {
  ssr: false,
  loading: () => (
    <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
  ),
});

type Stats = {
  totalTrees: number;
  inspectionsToday: number;
  inspectionsThisWeek: number;
  percentGradeCWeek: number;
  byZone: Record<string, { A: number; B: number; C: number }>;
  topIssues: Array<{ issue: string; count: number }>;
  workerActivity: Array<{ id: string; name: string; count: number; lastActive: string | null }>;
};

type TreeRow = {
  id: string;
  zone: string;
  variety: string;
  latitude: number | null;
  longitude: number | null;
  latestGrade: string | null;
};

type WeeklyUnhealthy = {
  id: string;
  treeId: string;
  tree: { zone: string };
  worker: { name: string };
  healthGrade: string;
  photoUrls: string[];
  createdAt: string;
};

function fmtRelative(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
  if (days === 0) return "วันนี้";
  if (days === 1) return "เมื่อวาน";
  if (days < 7) return `${days} วันที่แล้ว`;
  return d.toLocaleDateString("th-TH");
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [trees, setTrees] = useState<TreeRow[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unhealthy, setUnhealthy] = useState<WeeklyUnhealthy[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/stats/summary").then((r) => r.json()),
      fetch("/api/trees").then((r) => r.json()),
      fetch("/api/notifications").then((r) => r.json()),
      fetch("/api/inspections?date=week&healthGrade=C&limit=10").then((r) => r.json()),
    ])
      .then(([s, t, n, u]) => {
        setStats(s);
        setTrees(t);
        setNotifications(n);
        setUnhealthy(u);
      })
      .catch(() => toast.error("โหลดข้อมูลแดชบอร์ดไม่สำเร็จ"));
  }, []);

  const treesWithCoords: MapTree[] = trees
    .filter((t): t is TreeRow & { latitude: number; longitude: number } =>
      t.latitude != null && t.longitude != null,
    )
    .map((t) => ({
      id: t.id,
      zone: t.zone,
      variety: t.variety,
      latitude: t.latitude,
      longitude: t.longitude,
      latestGrade: t.latestGrade,
      hasAlert: notifications.some((n) => n.treeId === t.id),
    }));

  const activeAlerts = notifications.filter(
    (n) => n.severity === "high" || n.severity === "medium",
  );

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 lg:px-8">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 lg:text-3xl">
          แดชบอร์ดผู้ดูแลสวน
        </h1>
        <p className="mt-1 text-sm text-slate-600">ภาพรวมการตรวจและการแจ้งเตือน</p>
      </header>

      {/* Summary tiles */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="ต้นไม้ทั้งหมด" value={stats?.totalTrees ?? "—"} />
        <StatCard label="ตรวจวันนี้" value={stats?.inspectionsToday ?? "—"} />
        <StatCard label="ตรวจ 7 วัน" value={stats?.inspectionsThisWeek ?? "—"} />
        <StatCard
          label="% เกรด C สัปดาห์นี้"
          value={stats ? `${stats.percentGradeCWeek}%` : "—"}
          tone={stats && stats.percentGradeCWeek >= 20 ? "danger" : "default"}
        />
        <StatCard
          label="แจ้งเตือน"
          value={activeAlerts.length}
          tone={activeAlerts.length > 0 ? "warning" : "default"}
        />
      </section>

      {/* Farm map */}
      <section>
        <h2 className="mb-3 text-lg font-bold text-slate-900">แผนที่สวน</h2>
        <FarmMap trees={treesWithCoords} />
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-full bg-emerald-500" />
            เกรด A
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-full bg-amber-500" />
            เกรด B
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
            เกรด C
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-full bg-slate-400" />
            ยังไม่ตรวจ
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-full bg-red-600 ring-2 ring-white" />
            มีแจ้งเตือน
          </span>
        </div>
      </section>

      {/* Active alerts */}
      <section>
        <h2 className="mb-3 text-lg font-bold text-slate-900">
          🔔 ต้องดำเนินการ ({activeAlerts.length})
        </h2>
        {activeAlerts.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            ไม่มีรายการที่ต้องดำเนินการ 🎉
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {activeAlerts.slice(0, 10).map((n) => (
              <AlertRow key={n.id} n={n} />
            ))}
          </div>
        )}
      </section>

      {/* Zone health + Top issues */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-lg font-bold text-slate-900">สุขภาพต้นรายโซน (7 วัน)</h2>
          <div className="rounded-2xl border-2 border-slate-200 bg-white p-4">
            {stats ? (
              <ZoneHealthBars data={stats.byZone} />
            ) : (
              <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
            )}
          </div>
        </div>
        <div>
          <h2 className="mb-3 text-lg font-bold text-slate-900">ปัญหาที่พบบ่อย (7 วัน)</h2>
          <div className="rounded-2xl border-2 border-slate-200 bg-white p-4">
            {stats ? (
              <IssueFrequencyList items={stats.topIssues} />
            ) : (
              <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
            )}
          </div>
        </div>
      </section>

      {/* Worker activity */}
      <section>
        <h2 className="mb-3 text-lg font-bold text-slate-900">กิจกรรมคนงาน (7 วัน)</h2>
        <div className="overflow-hidden rounded-2xl border-2 border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">คนงาน</th>
                <th className="px-4 py-2">การตรวจ</th>
                <th className="px-4 py-2">ใช้งานล่าสุด</th>
              </tr>
            </thead>
            <tbody>
              {stats?.workerActivity.map((w) => (
                <tr key={w.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-800">{w.name}</td>
                  <td className="px-4 py-3 text-slate-700">{w.count}</td>
                  <td className="px-4 py-3 text-slate-500">{fmtRelative(w.lastActive)}</td>
                </tr>
              ))}
              {!stats && (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-400" colSpan={3}>
                    กำลังโหลด...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent grade C */}
      <section>
        <h2 className="mb-3 text-lg font-bold text-slate-900">ต้นเกรด C ล่าสุด</h2>
        {unhealthy.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            ไม่มีต้นเกรด C ในสัปดาห์นี้
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {unhealthy.map((u) => (
              <div
                key={u.id}
                className="overflow-hidden rounded-2xl border-2 border-red-200 bg-white"
              >
                {u.photoUrls[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.photoUrls[0]} alt="" className="aspect-video w-full object-cover" />
                ) : (
                  <div className="flex aspect-video items-center justify-center bg-slate-100 text-3xl">
                    🌳
                  </div>
                )}
                <div className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-slate-900">{u.treeId}</div>
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                      C
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    โซน {u.tree.zone} · {u.worker.name} · {fmtRelative(u.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <footer className="pt-6 text-center text-xs text-slate-400">
        แดชบอร์ดสำหรับผู้ดูแล · {new Date().toLocaleDateString("th-TH")}
      </footer>
    </main>
  );
}
