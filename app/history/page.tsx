"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useCurrentWorker } from "@/lib/workerSession";
import {
  InspectionDetailModal,
  type InspectionDetail,
} from "@/components/InspectionDetailModal";

const GRADE_COLOR: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-800",
  B: "bg-amber-100 text-amber-800",
  C: "bg-red-100 text-red-800",
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HistoryPage() {
  const worker = useCurrentWorker();
  const [rows, setRows] = useState<InspectionDetail[] | null>(null);
  const [selected, setSelected] = useState<InspectionDetail | null>(null);

  useEffect(() => {
    if (worker === null) return;
    const params = new URLSearchParams({ workerId: worker.id, date: "today" });
    fetch(`/api/inspections?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error("fetch failed");
        return r.json() as Promise<InspectionDetail[]>;
      })
      .then(setRows)
      .catch(() => {
        toast.error("โหลดประวัติไม่สำเร็จ");
        setRows([]);
      });
  }, [worker]);

  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 py-4">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/scan" className="text-sm text-emerald-700 underline">
          ← กลับ
        </Link>
        <h1 className="text-lg font-bold text-slate-900">ประวัติวันนี้</h1>
        <span className="w-12" />
      </div>

      {worker === null && (
        <div className="text-center text-sm text-slate-500">กำลังโหลด...</div>
      )}
      {rows === null && worker && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      )}
      {rows?.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          ยังไม่มีการตรวจวันนี้
        </div>
      )}

      <div className="space-y-3">
        {rows?.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setSelected(r)}
            className="flex w-full items-center gap-3 rounded-2xl border-2 border-slate-200 bg-white p-3 text-left active:bg-slate-50"
          >
            {r.photoUrls[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={r.photoUrls[0]}
                alt=""
                className="h-14 w-14 shrink-0 rounded-xl object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xl">
                🌳
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900">{r.treeId}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    GRADE_COLOR[r.healthGrade] ?? "bg-slate-100"
                  }`}
                >
                  {r.healthGrade}
                </span>
              </div>
              <div className="text-xs text-slate-500">{fmtTime(r.createdAt)}</div>
            </div>
          </button>
        ))}
      </div>

      <InspectionDetailModal
        inspection={selected}
        onClose={() => setSelected(null)}
      />
    </main>
  );
}
