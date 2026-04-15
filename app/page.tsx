"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { WorkerCard } from "@/components/WorkerCard";
import { setCurrentWorker } from "@/lib/workerSession";

type Worker = { id: string; name: string };

export default function WorkerSelectionPage() {
  const router = useRouter();
  const [workers, setWorkers] = useState<Worker[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/workers")
      .then((r) => {
        if (!r.ok) throw new Error("fetch failed");
        return r.json() as Promise<Worker[]>;
      })
      .then(setWorkers)
      .catch(() => {
        toast.error("โหลดรายชื่อคนงานไม่สำเร็จ");
        setWorkers([]);
      });
  }, []);

  function handleStart() {
    const w = workers?.find((x) => x.id === selectedId);
    if (!w) {
      toast.error("กรุณาเลือกชื่อคนงาน");
      return;
    }
    setCurrentWorker({ id: w.id, name: w.name });
    router.push("/scan");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 py-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">เลือกชื่อคนงาน</h1>
        <p className="mt-1 text-sm text-slate-600">เลือกชื่อของคุณเพื่อเริ่มทำงาน</p>
      </header>

      <section className="flex-1 space-y-3 pb-28">
        {workers === null && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        )}
        {workers?.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center text-slate-500">
            ไม่พบรายชื่อคนงาน <br />
            <span className="text-xs">รัน <code>npm run db:seed</code> เพื่อเพิ่มข้อมูลตัวอย่าง</span>
          </div>
        )}
        {workers?.map((w) => (
          <WorkerCard
            key={w.id}
            name={w.name}
            selected={selectedId === w.id}
            onSelect={() => setSelectedId(w.id)}
          />
        ))}
      </section>

      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white p-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
        <div className="mx-auto max-w-md">
          <button
            type="button"
            onClick={handleStart}
            disabled={!selectedId}
            className="h-14 w-full rounded-2xl bg-emerald-600 text-lg font-semibold text-white transition disabled:bg-slate-300 active:bg-emerald-700"
          >
            เริ่มทำงาน
          </button>
        </div>
      </div>
    </main>
  );
}
