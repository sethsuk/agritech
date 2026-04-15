"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertRow } from "@/components/AlertRow";
import type { Notification, NotificationType } from "@/lib/notifications";

const FILTERS: Array<{ id: "all" | NotificationType; label: string }> = [
  { id: "all", label: "ทั้งหมด" },
  { id: "harvest_ready", label: "เก็บเกี่ยว" },
  { id: "pesticide_needed", label: "ยาฆ่าแมลง" },
  { id: "fertilizer_overdue", label: "ปุ๋ย" },
  { id: "inspection_stale", label: "ตรวจช้า" },
];

export default function AlertsPage() {
  const [notifications, setNotifications] = useState<Notification[] | null>(null);
  const [active, setActive] = useState<(typeof FILTERS)[number]["id"]>("all");

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => {
        if (!r.ok) throw new Error("fetch failed");
        return r.json() as Promise<Notification[]>;
      })
      .then((data) => {
        setNotifications(
          data.map((n) => ({ ...n, since: new Date(n.since) })),
        );
      })
      .catch(() => {
        toast.error("โหลดการแจ้งเตือนไม่สำเร็จ");
        setNotifications([]);
      });
  }, []);

  const filtered = useMemo(() => {
    if (!notifications) return null;
    if (active === "all") return notifications;
    if (active === "harvest_ready") {
      return notifications.filter(
        (n) => n.type === "harvest_ready" || n.type === "harvest_soon",
      );
    }
    return notifications.filter((n) => n.type === active);
  }, [notifications, active]);

  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 py-4">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/scan" className="text-sm text-emerald-700 underline">
          ← กลับ
        </Link>
        <h1 className="text-lg font-bold text-slate-900">การแจ้งเตือน</h1>
        <span className="w-12" />
      </div>

      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-2">
        {FILTERS.map((f) => {
          const isActive = active === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setActive(f.id)}
              className={[
                "shrink-0 rounded-full border-2 px-4 py-2 text-sm font-medium",
                isActive
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-slate-300 bg-white text-slate-700",
              ].join(" ")}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        {filtered === null && (
          <>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </>
        )}
        {filtered?.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center text-slate-500">
            ไม่มีการแจ้งเตือน 🎉
          </div>
        )}
        {filtered?.map((n) => (
          <AlertRow key={n.id} n={n} />
        ))}
      </div>
    </main>
  );
}
