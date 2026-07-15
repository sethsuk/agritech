"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { t } from "@/lib/i18n/t";
import { WorkerHeader } from "@/components/worker/WorkerHeader";
import { useLang } from "@/lib/i18n/LanguageContext";
import { dict } from "@/lib/i18n/dictionary";
import type { DbTree, DbTaskDefinition, DbSet } from "@/types/database";

interface TreeData {
  tree: DbTree;
  sets: DbSet[];
}

const colorLabel: Record<string, I18nColorLabel> = {
  red: { th: "แดง", my: "အနီ", en: "Red" },
  blue: { th: "น้ำเงิน", my: "အပြာ", en: "Blue" },
  yellow: { th: "เหลือง", my: "အဝါ", en: "Yellow" },
  white: { th: "ขาว", my: "အဖြူ", en: "White" },
};

type I18nColorLabel = { th: string; my: string; en: string };

export default function TreeDetailPage() {
  const { treeId } = useParams<{ treeId: string }>();
  const router = useRouter();
  const { lang } = useLang();
  const [treeData, setTreeData] = useState<TreeData | null>(null);
  const [taskDefs, setTaskDefs] = useState<DbTaskDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  const tr = (key: keyof typeof dict) => t(dict[key], lang);

  useEffect(() => {
    Promise.all([
      fetch(`/api/trees/${treeId}`).then((r) => r.ok ? r.json() : Promise.reject()),
      fetch("/api/task-definitions").then((r) => r.ok ? r.json() : Promise.reject()),
    ])
      .then(([td, defs]) => {
        setTreeData(td);
        setTaskDefs(defs);
      })
      .catch(() => toast.error(tr("treeLoadError")))
      .finally(() => setLoading(false));
  }, [treeId]); // eslint-disable-line react-hooks/exhaustive-deps

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
        <p className="text-slate-500">{tr("treeNotFound")}</p>
        <button onClick={() => router.push("/scan")} className="mt-4 text-emerald-600 underline">
          {tr("backToScan")}
        </button>
      </main>
    );
  }

  const { tree, sets } = treeData;

  return (
    <div className="flex min-h-dvh flex-col">
      <WorkerHeader
        variant="back"
        title={`${tr("treeTitlePrefix")} ${tree.tree_id}`}
        onBack={() => router.push("/scan")}
      />

      <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
      {/* Tree info card */}
      <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-2xl font-bold text-slate-900">{tree.tree_id}</p>
            <p className="text-sm text-slate-500">
              {tree.zone}{tree.side} · {tr("rowLabel")} {tree.row_num} · {tr("positionLabel")} {tree.position}
            </p>
            <p className="mt-1 text-sm font-medium text-slate-700">{tree.variety}</p>
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
            {tree.status === "active" ? tr("treeStatusActive") : tree.status}
          </span>
        </div>

        {sets.length > 0 && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <p className="mb-2 text-xs font-medium text-slate-500">{tr("activeSets")}</p>
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
                    {t(colorLabel[s.color] ?? colorLabel.white, lang)}
                    {" "}· {s.current_fruit_count} {tr("fruitCountUnit")}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Task selection */}
      <h2 className="mb-3 text-base font-semibold text-slate-700">{tr("chooseTask")}</h2>
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
              <p className="font-semibold text-slate-900">{t(def.display_name, lang)}</p>
              <p className="text-xs text-slate-500">{def.task_type}</p>
            </div>
            <span className="ml-auto text-slate-300">›</span>
          </button>
        ))}
      </div>

      {/* Exit: go scan a different tree */}
      <button
        onClick={() => {
          sessionStorage.removeItem("qr_scanned_at");
          sessionStorage.removeItem("qr_value");
          router.push("/scan");
        }}
        className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 text-sm font-medium text-slate-500 active:bg-slate-50"
      >
        <span>📷</span>
        <span>{tr("exitTree")}</span>
      </button>
      </main>
    </div>
  );
}
