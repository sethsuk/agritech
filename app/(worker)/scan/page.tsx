"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { QrScanner } from "@/components/worker/QrScanner";
import { WorkerHeader } from "@/components/worker/WorkerHeader";

export default function ScanPage() {
  const router = useRouter();
  const [manualId, setManualId] = useState("");
  const [checking, setChecking] = useState(false);
  const [scanned, setScanned] = useState(false);

  const navigateToTree = useCallback(
    async (qrValue: string, scannedAt: string) => {
      if (checking || scanned) return;
      setChecking(true);

      try {
        const res = await fetch(`/api/trees/${encodeURIComponent(qrValue)}`);
        if (!res.ok) {
          toast.error("ไม่พบต้นไม้รหัสนี้");
          setChecking(false);
          return;
        }
        const { tree } = await res.json();
        setScanned(true);
        sessionStorage.setItem("qr_scanned_at", scannedAt);
        sessionStorage.setItem("qr_value", qrValue);
        router.push(`/tree/${tree.tree_id}`);
      } catch {
        toast.error("เกิดข้อผิดพลาด ลองอีกครั้ง");
        setChecking(false);
      }
    },
    [router, checking, scanned],
  );

  const handleQrDecode = useCallback(
    (text: string) => {
      const scannedAt = new Date().toISOString();
      navigateToTree(text, scannedAt);
    },
    [navigateToTree],
  );

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!manualId.trim()) return;
    await navigateToTree(manualId.trim().toUpperCase(), new Date().toISOString());
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <WorkerHeader variant="home" />

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-6">
        <p className="mb-4 text-sm text-slate-500">สแกน QR code ที่ต้นทุเรียน</p>
        <div className="flex-1 space-y-4">
        <QrScanner
          onDecode={handleQrDecode}
          onUnavailable={() => toast.info("ไม่สามารถเข้าถึงกล้อง ใช้การพิมพ์รหัสแทน")}
        />

        {checking && (
          <div className="rounded-2xl bg-emerald-50 p-4 text-center text-sm text-emerald-700">
            กำลังค้นหาต้นไม้...
          </div>
        )}

        <div className="relative flex items-center py-2">
          <div className="flex-1 border-t border-slate-200" />
          <span className="mx-3 text-xs text-slate-400">หรือพิมพ์รหัสต้นไม้</span>
          <div className="flex-1 border-t border-slate-200" />
        </div>

        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            type="text"
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
            placeholder="A-001"
            className="h-12 flex-1 rounded-xl border border-slate-300 px-4 text-base uppercase focus:border-emerald-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!manualId.trim() || checking}
            className="h-12 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white disabled:bg-slate-300"
          >
            ค้นหา
          </button>
        </form>
        </div>
      </main>
    </div>
  );
}
