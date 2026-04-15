"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export function AlertBadge() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: { severity: string }[]) => {
        if (cancelled) return;
        const high = data.filter((d) => d.severity === "high").length;
        setCount(high);
      })
      .catch(() => {
        if (!cancelled) setCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Link
      href="/alerts"
      aria-label="การแจ้งเตือน"
      className="relative flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-700 active:bg-slate-200"
    >
      <span className="text-xl">🔔</span>
      {count != null && count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-bold text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
