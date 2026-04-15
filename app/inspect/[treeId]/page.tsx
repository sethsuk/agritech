"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { config } from "@/lib/config";
import { useCurrentWorker } from "@/lib/workerSession";
import { HealthGradeButtons } from "@/components/HealthGradeButtons";
import { NumberStepper } from "@/components/NumberStepper";
import { IssueChips } from "@/components/IssueChips";
import { PhotoCapture } from "@/components/PhotoCapture";
import { useGpsCapture } from "@/components/GpsCapture";
import {
  FruitBatchSection,
  type FruitBatchSummary,
} from "@/components/FruitBatchSection";

type TreeDetail = {
  id: string;
  zone: string;
  variety: string;
  plantedDate: string;
  lastInspectionAt: string | null;
  lastInspectionGrade: string | null;
  activeFruitBatches: FruitBatchSummary[];
};

type Grade = "A" | "B" | "C";

function yearsSince(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / (365 * 24 * 60 * 60 * 1000));
}

function fmtThaiDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function InspectPage({
  params,
}: {
  params: Promise<{ treeId: string }>;
}) {
  const { treeId } = use(params);
  const router = useRouter();
  const search = useSearchParams();
  const focusBatchId = search.get("batchId"); // deep-link from /alerts
  const worker = useCurrentWorker();
  const coords = useGpsCapture();

  const [tree, setTree] = useState<TreeDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [grade, setGrade] = useState<Grade | null>(null);
  const [flowers, setFlowers] = useState(0);
  const [fruits, setFruits] = useState(0);
  const [issues, setIssues] = useState<string[]>([]);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [fertilizer, setFertilizer] = useState(false);
  const [pesticide, setPesticide] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const refreshTree = useCallback(async () => {
    try {
      const res = await fetch(`/api/trees/${treeId}`);
      if (res.status === 404) {
        setLoadError("ไม่พบต้นไม้รหัสนี้");
        return;
      }
      if (!res.ok) throw new Error("fetch failed");
      const data = (await res.json()) as TreeDetail;
      setTree(data);
    } catch {
      setLoadError("โหลดข้อมูลต้นไม้ไม่สำเร็จ");
    }
  }, [treeId]);

  useEffect(() => {
    refreshTree();
  }, [refreshTree]);

  // Redirect to home if no worker selected.
  useEffect(() => {
    if (worker === null) {
      const t = setTimeout(() => {
        if (!localStorage.getItem("currentWorkerId")) router.replace("/");
      }, 100);
      return () => clearTimeout(t);
    }
  }, [worker, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!worker) return;
    if (!grade) {
      toast.error("กรุณาเลือกสุขภาพต้น");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/inspections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          treeId,
          workerId: worker.id,
          healthGrade: grade,
          flowerCount: flowers || null,
          fruitCount: fruits || null,
          issuesFound: issues,
          notes: notes || null,
          photoUrls,
          latitude: coords?.latitude ?? null,
          longitude: coords?.longitude ?? null,
          fertilizerApplied: fertilizer,
          pesticideApplied: pesticide,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "บันทึกไม่สำเร็จ");
      }
      toast.success("บันทึกข้อมูลเรียบร้อย");
      router.push("/scan");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "บันทึกไม่สำเร็จ ลองอีกครั้ง";
      toast.error(msg);
      setSubmitting(false);
    }
  }

  if (loadError) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center">
        <div className="text-4xl">⚠️</div>
        <p className="mt-3 text-lg font-semibold text-slate-800">{loadError}</p>
        <Link
          href="/scan"
          className="mt-6 inline-flex h-12 items-center rounded-xl bg-emerald-600 px-6 font-medium text-white"
        >
          กลับไปสแกน
        </Link>
      </main>
    );
  }

  if (!tree) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 py-6">
        <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />
        <div className="mt-4 h-64 animate-pulse rounded-2xl bg-slate-100" />
      </main>
    );
  }

  const ageYears = yearsSince(tree.plantedDate);

  return (
    <main className="mx-auto max-w-md px-4 pb-32 pt-4">
      <div className="mb-3 flex items-center justify-between">
        <Link href="/scan" className="text-sm text-emerald-700 underline">
          ← กลับ
        </Link>
        <div className="text-xs text-slate-500">{worker?.name}</div>
      </div>

      {/* Tree info card */}
      <section className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4">
        <div className="text-3xl font-bold text-emerald-900">{tree.id}</div>
        <div className="mt-1 grid grid-cols-3 gap-2 text-sm">
          <div>
            <div className="text-xs text-emerald-700">โซน</div>
            <div className="font-semibold text-emerald-900">{tree.zone}</div>
          </div>
          <div>
            <div className="text-xs text-emerald-700">พันธุ์</div>
            <div className="font-semibold text-emerald-900">{tree.variety}</div>
          </div>
          <div>
            <div className="text-xs text-emerald-700">อายุ</div>
            <div className="font-semibold text-emerald-900">{ageYears} ปี</div>
          </div>
        </div>
        {tree.lastInspectionAt && (
          <div className="mt-2 text-xs text-emerald-800">
            ตรวจล่าสุด: {fmtThaiDate(tree.lastInspectionAt)} (เกรด {tree.lastInspectionGrade ?? "—"})
          </div>
        )}
      </section>

      <form onSubmit={submit} className="mt-5 space-y-5">
        <div>
          <label className="mb-2 block text-base font-semibold text-slate-800">
            สุขภาพต้น <span className="text-red-600">*</span>
          </label>
          <HealthGradeButtons value={grade} onChange={setGrade} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-800">
              จำนวนดอก
            </label>
            <NumberStepper value={flowers} onChange={setFlowers} ariaLabel="ดอก" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-800">
              จำนวนผล
            </label>
            <NumberStepper value={fruits} onChange={setFruits} ariaLabel="ผล" />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-base font-semibold text-slate-800">
            ปัญหาที่พบ
          </label>
          <IssueChips
            options={config.issueChoices}
            selected={issues}
            onChange={setIssues}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex h-14 cursor-pointer items-center gap-3 rounded-xl border-2 border-slate-300 bg-white px-3 has-checked:border-emerald-500 has-checked:bg-emerald-50">
            <input
              type="checkbox"
              checked={fertilizer}
              onChange={(e) => setFertilizer(e.target.checked)}
              className="h-5 w-5"
            />
            <span className="text-sm font-medium text-slate-800">ใส่ปุ๋ยแล้ว</span>
          </label>
          <label className="flex h-14 cursor-pointer items-center gap-3 rounded-xl border-2 border-slate-300 bg-white px-3 has-checked:border-emerald-500 has-checked:bg-emerald-50">
            <input
              type="checkbox"
              checked={pesticide}
              onChange={(e) => setPesticide(e.target.checked)}
              className="h-5 w-5"
            />
            <span className="text-sm font-medium text-slate-800">ฉีดยาแล้ว</span>
          </label>
        </div>

        <div>
          <label className="mb-2 block text-base font-semibold text-slate-800">
            ถ่ายรูป
          </label>
          <PhotoCapture treeId={treeId} photoUrls={photoUrls} onChange={setPhotoUrls} />
        </div>

        <div>
          <label className="mb-2 block text-base font-semibold text-slate-800">
            หมายเหตุ
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-xl border-2 border-slate-300 bg-white p-3 text-base focus:border-emerald-500 focus:outline-none"
            placeholder="เพิ่มเติม (ไม่บังคับ)"
          />
        </div>

        {/* Bloom + harvest sections */}
        <FruitBatchSection
          treeId={tree.id}
          workerId={worker?.id ?? null}
          activeBatches={tree.activeFruitBatches}
          onChanged={refreshTree}
        />

        {focusBatchId && (
          <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            มาจากการแจ้งเตือน — ตรวจสอบสถานะของผลด้านบน
          </div>
        )}

        {/* Sticky save bar */}
        <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white p-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
          <div className="mx-auto max-w-md">
            <button
              type="submit"
              disabled={submitting}
              className="h-14 w-full rounded-2xl bg-emerald-600 text-lg font-semibold text-white transition disabled:bg-slate-300 active:bg-emerald-700"
            >
              {submitting ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </div>
      </form>
    </main>
  );
}
