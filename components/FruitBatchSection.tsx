"use client";

import { useState } from "react";
import { toast } from "sonner";
import { config } from "@/lib/config";
import { ColorSwatch } from "./ColorSwatch";

export type FruitBatchSummary = {
  id: string;
  colorTag: string;
  bloomDate: string; // ISO
  notes?: string | null;
};

type Props = {
  treeId: string;
  workerId: string | null;
  activeBatches: FruitBatchSummary[];
  onChanged: () => void; // re-fetch tree
};

const DAY_MS = 24 * 60 * 60 * 1000;

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS);
}

export function FruitBatchSection({ treeId, workerId, activeBatches, onChanged }: Props) {
  const [bloomColor, setBloomColor] = useState<string | null>(null);
  const [bloomDate, setBloomDate] = useState<string>(
    () => new Date().toISOString().slice(0, 10),
  );
  const [bloomNotes, setBloomNotes] = useState("");
  const [submittingBloom, setSubmittingBloom] = useState(false);
  const [harvestingId, setHarvestingId] = useState<string | null>(null);

  const usedColors = new Set(activeBatches.map((b) => b.colorTag));
  const freeColors = config.fruitBatchColors.filter((c) => !usedColors.has(c.id));

  const readyBatches = activeBatches.filter(
    (b) => daysSince(b.bloomDate) >= config.harvestDaysAfterBloom,
  );

  async function submitBloom() {
    if (!bloomColor) {
      toast.error("กรุณาเลือกสี");
      return;
    }
    setSubmittingBloom(true);
    try {
      const res = await fetch("/api/fruit-batches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          treeId,
          colorTag: bloomColor,
          bloomDate,
          notes: bloomNotes || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "บันทึกการออกดอกไม่สำเร็จ");
      }
      toast.success("บันทึกการออกดอกเรียบร้อย");
      setBloomColor(null);
      setBloomNotes("");
      onChanged();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "บันทึกการออกดอกไม่สำเร็จ";
      toast.error(msg);
    } finally {
      setSubmittingBloom(false);
    }
  }

  async function harvest(id: string) {
    if (!workerId) {
      toast.error("ไม่พบข้อมูลคนงาน");
      return;
    }
    setHarvestingId(id);
    try {
      const res = await fetch(`/api/fruit-batches/${id}/harvest`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workerId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "บันทึกการเก็บเกี่ยวไม่สำเร็จ");
      }
      toast.success("บันทึกการเก็บเกี่ยวเรียบร้อย");
      onChanged();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "บันทึกการเก็บเกี่ยวไม่สำเร็จ";
      toast.error(msg);
    } finally {
      setHarvestingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Active batches summary */}
      {activeBatches.length > 0 && (
        <div className="rounded-2xl border-2 border-slate-200 bg-white p-4">
          <div className="mb-3 text-sm font-semibold text-slate-700">
            ผลที่ติดอยู่บนต้น ({activeBatches.length}/3)
          </div>
          <ul className="space-y-2">
            {activeBatches.map((b) => {
              const days = daysSince(b.bloomDate);
              const remaining = config.harvestDaysAfterBloom - days;
              const color = config.fruitBatchColors.find((c) => c.id === b.colorTag);
              return (
                <li key={b.id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ColorSwatch hex={color?.hex ?? "#888"} label={color?.labelTh ?? b.colorTag} />
                    <span className="text-xs text-slate-500">
                      บานเมื่อ {days} วันที่แล้ว
                    </span>
                  </div>
                  <span
                    className={[
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      remaining <= 0
                        ? "bg-red-100 text-red-700"
                        : remaining <= config.harvestWarningDaysBefore
                        ? "bg-amber-100 text-amber-700"
                        : "bg-slate-100 text-slate-600",
                    ].join(" ")}
                  >
                    {remaining <= 0 ? "พร้อมเก็บ" : `อีก ${remaining} วัน`}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Harvest section */}
      {readyBatches.length > 0 && (
        <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4">
          <div className="mb-3 text-base font-semibold text-emerald-900">
            🥭 ผลที่พร้อมเก็บเกี่ยว
          </div>
          <ul className="space-y-2">
            {readyBatches.map((b) => {
              const color = config.fruitBatchColors.find((c) => c.id === b.colorTag);
              return (
                <li
                  key={b.id}
                  className="flex items-center justify-between gap-2 rounded-xl bg-white p-3"
                >
                  <ColorSwatch hex={color?.hex ?? "#888"} label={`ผลสี${color?.labelTh ?? b.colorTag}`} />
                  <button
                    type="button"
                    onClick={() => harvest(b.id)}
                    disabled={harvestingId === b.id}
                    className="h-12 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white active:bg-emerald-700 disabled:bg-slate-300"
                  >
                    {harvestingId === b.id ? "กำลังบันทึก..." : "เก็บเกี่ยวแล้ว"}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Bloom recording section */}
      {freeColors.length > 0 && (
        <div className="rounded-2xl border-2 border-pink-200 bg-pink-50 p-4">
          <div className="mb-3 text-base font-semibold text-pink-900">
            🌸 บันทึกการออกดอกใหม่
          </div>
          <div className="text-sm text-slate-700">เลือกสีริบบิ้นที่ใช้ผูก</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {freeColors.map((c) => {
              const isSelected = bloomColor === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setBloomColor(c.id)}
                  className={[
                    "flex h-12 items-center gap-2 rounded-full border-2 px-4 transition",
                    isSelected ? "border-pink-600 bg-white ring-4 ring-pink-200" : "border-slate-300 bg-white",
                  ].join(" ")}
                >
                  <span
                    className="h-6 w-6 rounded-full border-2 border-white shadow"
                    style={{ backgroundColor: c.hex }}
                    aria-hidden
                  />
                  <span className="text-sm font-medium text-slate-700">{c.labelTh}</span>
                </button>
              );
            })}
          </div>

          <label className="mt-4 block text-sm font-medium text-slate-700">
            วันที่ออกดอก
          </label>
          <input
            type="date"
            value={bloomDate}
            onChange={(e) => setBloomDate(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
            className="mt-1 h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-base focus:border-emerald-500 focus:outline-none"
          />

          <label className="mt-4 block text-sm font-medium text-slate-700">
            หมายเหตุ (ไม่บังคับ)
          </label>
          <input
            type="text"
            value={bloomNotes}
            onChange={(e) => setBloomNotes(e.target.value)}
            className="mt-1 h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-base focus:border-emerald-500 focus:outline-none"
          />

          <button
            type="button"
            onClick={submitBloom}
            disabled={submittingBloom || !bloomColor}
            className="mt-4 h-12 w-full rounded-xl bg-pink-600 text-base font-semibold text-white active:bg-pink-700 disabled:bg-slate-300"
          >
            {submittingBloom ? "กำลังบันทึก..." : "บันทึกการออกดอก"}
          </button>
        </div>
      )}

      {freeColors.length === 0 && activeBatches.length === 3 && (
        <div className="rounded-2xl border-2 border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
          ครบ 3 สีแล้ว — เก็บเกี่ยวก่อนเพื่อปลดสี
        </div>
      )}
    </div>
  );
}
