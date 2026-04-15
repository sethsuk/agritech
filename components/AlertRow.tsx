"use client";

import Link from "next/link";
import type { Notification, Severity } from "@/lib/notifications";

const SEVERITY_COLOR: Record<Severity, { dot: string; label: string }> = {
  high: { dot: "bg-red-500", label: "ด่วน" },
  medium: { dot: "bg-amber-500", label: "เร็วๆ นี้" },
  low: { dot: "bg-slate-400", label: "" },
};

const TYPE_ICON: Record<Notification["type"], string> = {
  harvest_ready: "🥭",
  harvest_soon: "⏳",
  pesticide_needed: "🐛",
  fertilizer_overdue: "🪴",
  inspection_stale: "🔍",
};

export function AlertRow({ n }: { n: Notification }) {
  const sev = SEVERITY_COLOR[n.severity];
  const href =
    n.payload?.batchId
      ? `/inspect/${n.treeId}?batchId=${n.payload.batchId}`
      : `/inspect/${n.treeId}`;

  return (
    <Link
      href={href}
      className="flex items-start gap-3 rounded-2xl border-2 border-slate-200 bg-white p-4 active:bg-slate-50"
    >
      <div className="relative">
        <span className="text-2xl">{TYPE_ICON[n.type]}</span>
        <span
          className={`absolute -right-1 -top-1 inline-block h-3 w-3 rounded-full ${sev.dot}`}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="font-semibold text-slate-900">{n.message}</div>
          {sev.label && (
            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              {sev.label}
            </span>
          )}
        </div>
        {n.detail && (
          <div className="mt-0.5 text-sm text-slate-600">{n.detail}</div>
        )}
        <div className="mt-1 text-xs text-slate-400">
          โซน {n.zone} · {n.variety}
        </div>
      </div>
    </Link>
  );
}
