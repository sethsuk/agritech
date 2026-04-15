"use client";

import { useEffect } from "react";

export type InspectionDetail = {
  id: string;
  treeId: string;
  worker: { name: string };
  healthGrade: string;
  flowerCount: number | null;
  fruitCount: number | null;
  issuesFound: string[];
  notes: string | null;
  photoUrls: string[];
  fertilizerApplied: boolean;
  pesticideApplied: boolean;
  createdAt: string;
};

const GRADE_COLOR: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-800",
  B: "bg-amber-100 text-amber-800",
  C: "bg-red-100 text-red-800",
};

export function InspectionDetailModal({
  inspection,
  onClose,
}: {
  inspection: InspectionDetail | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!inspection) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inspection, onClose]);

  if (!inspection) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xl font-bold text-slate-900">{inspection.treeId}</div>
            <div className="text-xs text-slate-500">
              {new Date(inspection.createdAt).toLocaleString("th-TH")}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-700"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-sm font-bold ${
              GRADE_COLOR[inspection.healthGrade] ?? "bg-slate-100"
            }`}
          >
            เกรด {inspection.healthGrade}
          </span>
          {inspection.fertilizerApplied && (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
              🪴 ใส่ปุ๋ยแล้ว
            </span>
          )}
          {inspection.pesticideApplied && (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
              🐛 ฉีดยาแล้ว
            </span>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-xs text-slate-500">ดอก</div>
            <div className="text-lg font-semibold">{inspection.flowerCount ?? "—"}</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-xs text-slate-500">ผล</div>
            <div className="text-lg font-semibold">{inspection.fruitCount ?? "—"}</div>
          </div>
        </div>

        {inspection.issuesFound.length > 0 && (
          <div className="mt-4">
            <div className="text-sm font-semibold text-slate-700">ปัญหาที่พบ</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {inspection.issuesFound.map((i) => (
                <span
                  key={i}
                  className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700"
                >
                  {i}
                </span>
              ))}
            </div>
          </div>
        )}

        {inspection.notes && (
          <div className="mt-4">
            <div className="text-sm font-semibold text-slate-700">หมายเหตุ</div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{inspection.notes}</p>
          </div>
        )}

        {inspection.photoUrls.length > 0 && (
          <div className="mt-4">
            <div className="text-sm font-semibold text-slate-700">รูปภาพ</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {inspection.photoUrls.map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={url}
                  src={url}
                  alt=""
                  className="aspect-square w-full rounded-xl object-cover"
                />
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 text-xs text-slate-500">
          บันทึกโดย {inspection.worker.name}
        </div>
      </div>
    </div>
  );
}
