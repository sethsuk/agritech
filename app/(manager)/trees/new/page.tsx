"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { isValidTreeId } from "@/lib/treeId";
import { downloadTreeQrLabel } from "@/lib/qrLabel";
import type { DbTree } from "@/types/database";

const KNOWN_VARIETIES = ["Monthong", "Chanee", "Puangmanee"];

export default function NewTreePage() {
  const router = useRouter();

  const [treeId, setTreeId] = useState("");
  const [varietyChoice, setVarietyChoice] = useState(KNOWN_VARIETIES[0]);
  const [customVariety, setCustomVariety] = useState("");
  const [plantedDate, setPlantedDate] = useState("");
  const [gps, setGps] = useState<{ lat: number; long: number } | null>(null);
  const [capturingGps, setCapturingGps] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createdTree, setCreatedTree] = useState<DbTree | null>(null);

  const treeIdTrimmed = treeId.trim().toUpperCase();
  const treeIdValid = treeIdTrimmed.length === 0 || isValidTreeId(treeIdTrimmed);
  const variety = varietyChoice === "other" ? customVariety.trim() : varietyChoice;

  const canSubmit =
    isValidTreeId(treeIdTrimmed) &&
    variety.length > 0 &&
    plantedDate.length > 0 &&
    gps !== null &&
    !submitting;

  function captureGps() {
    if (!navigator.geolocation) {
      toast.error("อุปกรณ์นี้ไม่รองรับ GPS");
      return;
    }
    setCapturingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, long: pos.coords.longitude });
        setCapturingGps(false);
      },
      () => {
        toast.error("ไม่สามารถอ่านตำแหน่ง GPS ได้ กรุณาลองใหม่ที่ต้นไม้");
        setCapturingGps(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !gps) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/manager/trees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          treeId: treeIdTrimmed,
          lat: gps.lat,
          long: gps.long,
          variety,
          plantedDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.detail ?? "สร้างต้นไม้ไม่สำเร็จ");
        return;
      }
      toast.success("สร้างต้นไม้เรียบร้อย ✓");
      setCreatedTree(data.tree);
    } catch {
      toast.error("เกิดข้อผิดพลาด ลองอีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setTreeId("");
    setVarietyChoice(KNOWN_VARIETIES[0]);
    setCustomVariety("");
    setPlantedDate("");
    setGps(null);
    setCreatedTree(null);
  }

  if (createdTree) {
    return (
      <div className="mx-auto max-w-md px-4 py-6">
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
          <div className="mb-3 text-5xl">✅</div>
          <h1 className="text-xl font-bold text-slate-900">สร้างต้นไม้แล้ว</h1>
          <p className="mt-1 font-mono text-lg text-slate-700">{createdTree.tree_id}</p>
          <p className="mt-1 text-sm text-slate-500">{createdTree.qr_code}</p>

          <button
            onClick={() => downloadTreeQrLabel(createdTree.tree_id, createdTree.qr_code)}
            className="mt-6 h-12 w-full rounded-xl bg-emerald-600 text-sm font-semibold text-white active:bg-emerald-700"
          >
            📥 ดาวน์โหลด QR
          </button>

          <div className="mt-3 flex gap-2">
            <button
              onClick={resetForm}
              className="h-12 flex-1 rounded-xl bg-slate-100 text-sm font-medium text-slate-600 active:bg-slate-200"
            >
              เพิ่มต้นไม้อีกต้น
            </button>
            <button
              onClick={() => router.push(`/trees/${createdTree.tree_id}`)}
              className="h-12 flex-1 rounded-xl bg-slate-100 text-sm font-medium text-slate-600 active:bg-slate-200"
            >
              ดูรายละเอียด
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <div className="mb-4 flex items-center gap-2">
        <Link href="/trees" className="text-sm text-slate-400">‹ กลับ</Link>
      </div>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">เพิ่มต้นไม้ใหม่</h1>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            รหัสต้นไม้
          </label>
          <input
            type="text"
            value={treeId}
            onChange={(e) => setTreeId(e.target.value)}
            placeholder="AL13-7"
            required
            className={`h-12 w-full rounded-xl border px-4 text-base uppercase focus:outline-none ${
              treeIdValid ? "border-slate-300 focus:border-emerald-500" : "border-red-400"
            }`}
          />
          <p className="mt-1 text-xs text-slate-400">
            รูปแบบ: [โซน][ฝั่ง L/R][แถว]-[คอลัมน์] เช่น AL13-7
          </p>
          {!treeIdValid && (
            <p className="mt-1 text-xs text-red-500">รูปแบบไม่ถูกต้อง</p>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">พันธุ์</label>
          <select
            value={varietyChoice}
            onChange={(e) => setVarietyChoice(e.target.value)}
            className="h-12 w-full rounded-xl border border-slate-300 px-4 text-base focus:border-emerald-500 focus:outline-none"
          >
            {KNOWN_VARIETIES.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
            <option value="other">อื่นๆ...</option>
          </select>
          {varietyChoice === "other" && (
            <input
              type="text"
              value={customVariety}
              onChange={(e) => setCustomVariety(e.target.value)}
              placeholder="ระบุพันธุ์"
              required
              className="mt-2 h-12 w-full rounded-xl border border-slate-300 px-4 text-base focus:border-emerald-500 focus:outline-none"
            />
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">วันที่ปลูก</label>
          <input
            type="date"
            value={plantedDate}
            onChange={(e) => setPlantedDate(e.target.value)}
            required
            className="h-12 w-full rounded-xl border border-slate-300 px-4 text-base focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">ตำแหน่ง GPS</label>
          <button
            type="button"
            onClick={captureGps}
            disabled={capturingGps}
            className={`h-12 w-full rounded-xl text-sm font-medium ${
              gps ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
            } disabled:opacity-50`}
          >
            {capturingGps
              ? "กำลังอ่านตำแหน่ง..."
              : gps
              ? `✓ ${gps.lat.toFixed(6)}, ${gps.long.toFixed(6)}`
              : "📍 จับตำแหน่งปัจจุบัน"}
          </button>
          <p className="mt-1 text-xs text-slate-400">ยืนที่ต้นไม้แล้วกดปุ่มนี้</p>
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="h-12 w-full rounded-xl bg-emerald-600 text-base font-semibold text-white transition active:bg-emerald-700 disabled:bg-slate-300"
        >
          {submitting ? "กำลังบันทึก..." : "สร้างต้นไม้"}
        </button>
      </form>
    </div>
  );
}
