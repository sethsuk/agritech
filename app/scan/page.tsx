"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { QrScanner } from "@/components/QrScanner";
import { AlertBadge } from "@/components/AlertBadge";
import {
  clearCurrentWorker,
  getRecentTrees,
  pushRecentTree,
  useCurrentWorker,
} from "@/lib/workerSession";

const TREE_PATTERN = /^TREE-\d{3}$/;

export default function ScanPage() {
  const router = useRouter();
  const worker = useCurrentWorker();
  const [manualId, setManualId] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [navigating, setNavigating] = useState(false);

  useEffect(() => {
    setRecent(getRecentTrees());
  }, []);

  // Redirect to worker selection if none set.
  useEffect(() => {
    if (worker === null) {
      const t = setTimeout(() => {
        if (!localStorage.getItem("currentWorkerId")) router.replace("/");
      }, 100);
      return () => clearTimeout(t);
    }
  }, [worker, router]);

  function goToInspect(rawId: string) {
    if (navigating) return;
    const id = rawId.trim().toUpperCase();
    if (!TREE_PATTERN.test(id)) {
      toast.error("รหัส QR ไม่ถูกต้อง");
      return;
    }
    setNavigating(true);
    pushRecentTree(id);
    router.push(`/inspect/${id}`);
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    goToInspect(manualId);
  }

  function changeUser() {
    clearCurrentWorker();
    router.push("/");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 py-4">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-slate-500">คนงาน</div>
          <div className="truncate text-base font-semibold text-slate-900">
            {worker?.name ?? "..."}
          </div>
          <button
            type="button"
            onClick={changeUser}
            className="text-xs text-emerald-700 underline"
          >
            เปลี่ยนผู้ใช้
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/history"
            aria-label="ประวัติวันนี้"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-700 active:bg-slate-200"
          >
            <span className="text-xl">📋</span>
          </Link>
          <AlertBadge />
        </div>
      </header>

      <h1 className="mb-2 text-2xl font-bold text-slate-900">สแกน QR Code ของต้นไม้</h1>
      <p className="mb-4 text-sm text-slate-600">หันกล้องไปที่รหัส QR บนต้นไม้</p>

      <QrScanner
        onDecode={(text) => goToInspect(text)}
        onUnavailable={() => toast.info("ใช้การพิมพ์รหัสด้านล่างแทน")}
      />

      <form onSubmit={handleManualSubmit} className="mt-4">
        <label className="text-sm font-medium text-slate-700">
          หรือพิมพ์รหัสต้นไม้
        </label>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
            placeholder="TREE-001"
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            className="h-12 flex-1 rounded-xl border-2 border-slate-300 px-4 text-base uppercase placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={navigating || manualId.trim().length === 0}
            className="h-12 rounded-xl bg-emerald-600 px-6 font-semibold text-white disabled:bg-slate-300 active:bg-emerald-700"
          >
            ไป
          </button>
        </div>
      </form>

      {recent.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-medium text-slate-700">
            สแกนล่าสุด
          </h2>
          <div className="flex flex-wrap gap-2">
            {recent.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => goToInspect(id)}
                className="h-11 rounded-full border-2 border-slate-300 bg-white px-4 font-medium text-slate-700 active:bg-slate-50"
              >
                {id}
              </button>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
