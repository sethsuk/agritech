"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { t } from "@/lib/i18n/t";
import type { DbTree, DbTaskDefinition, DbSet } from "@/types/database";

interface TreeData {
  tree: DbTree;
  sets: DbSet[];
}

export default function TreeDetailPage() {
  const { treeId } = useParams<{ treeId: string }>();
  const router = useRouter();
  const [treeData, setTreeData] = useState<TreeData | null>(null);
  const [taskDefs, setTaskDefs] = useState<DbTaskDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/trees/${treeId}`).then((r) => r.ok ? r.json() : Promise.reject()),
      fetch("/api/task-definitions").then((r) => r.ok ? r.json() : Promise.reject()),
    ])
      .then(([td, defs]) => {
        setTreeData(td);
        setTaskDefs(defs);
      })
      .catch(() => toast.error("โหลดข้อมูลต้นไม้ไม่สำเร็จ"))
      .finally(() => setLoading(false));
  }, [treeId]);

  if (loading) {
    return (
      <main className="mx-auto max-w-md px-4 py-6">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      </main>
    );
  }

  if (!treeData) {
    return (
      <main className="mx-auto max-w-md px-4 py-6 text-center">
        <p className="text-slate-500">ไม่พบต้นไม้</p>
        <button onClick={() => router.push("/scan")} className="mt-4 text-emerald-600 underline">
          กลับไปสแกน
        </button>
      </main>
    );
  }

  const { tree, sets } = treeData;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 py-6">
      <button
        onClick={() => router.push("/scan")}
        className="mb-4 flex items-center gap-1 text-sm text-slate-500 active:text-slate-700"
      >
        ← สแกนใหม่
      </button>

      {/* Tree info card */}
      <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-2xl font-bold text-slate-900">{tree.tree_id}</p>
            <p className="text-sm text-slate-500">
              {tree.zone} · แถว {tree.row_num} · ตำแหน่ง {tree.position}
            </p>
            <p className="mt-1 text-sm font-medium text-slate-700">{tree.variety}</p>
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
            {tree.status === "active" ? "ใช้งาน" : tree.status}
          </span>
        </div>

        {sets.length > 0 && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <p className="mb-2 text-xs font-medium text-slate-500">ชุดผลที่กำลังพัฒนา</p>
            <div className="flex flex-wrap gap-2">
              {sets.map((s) => {
                const colorMap: Record<string, string> = {
                  red: "bg-red-100 text-red-700",
                  blue: "bg-blue-100 text-blue-700",
                  yellow: "bg-yellow-100 text-yellow-700",
                  white: "bg-slate-100 text-slate-700",
                };
                return (
                  <span
                    key={s.set_id}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${colorMap[s.color] ?? "bg-slate-100 text-slate-700"}`}
                  >
                    {s.color === "red" ? "แดง" : s.color === "blue" ? "น้ำเงิน" : s.color === "yellow" ? "เหลือง" : "ขาว"}
                    {" "}· {s.current_fruit_count} ผล
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Task selection */}
      <h2 className="mb-3 text-base font-semibold text-slate-700">เลือกงานที่จะทำ</h2>
      <div className="space-y-3">
        {taskDefs.map((def) => (
          <button
            key={def.task_def_id}
            onClick={() =>
              router.push(`/tree/${treeId}/task/${def.task_def_id}`)
            }
            className="flex h-16 w-full items-center gap-4 rounded-2xl bg-white px-4 text-left shadow-sm active:bg-slate-50"
          >
            <span className="text-2xl">{def.display_name.icon ?? "📋"}</span>
            <div>
              <p className="font-semibold text-slate-900">{t(def.display_name)}</p>
              <p className="text-xs text-slate-500">{def.task_type}</p>
            </div>
            <span className="ml-auto text-slate-300">›</span>
          </button>
        ))}
      </div>
    </main>
  );
}
