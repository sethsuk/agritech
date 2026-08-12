"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { t, taskDisplayName } from "@/lib/i18n/t";
import { WorkerHeader } from "@/components/worker/WorkerHeader";
import { useLang } from "@/lib/i18n/LanguageContext";
import { dict } from "@/lib/i18n/dictionary";
import { varietyName } from "@/lib/i18n/varieties";
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
            <div key={i} className="h-20 animate-pulse rounded-lg bg-surface-alt" />
          ))}
        </div>
      </main>
    );
  }

  if (!treeData) {
    return (
      <main className="mx-auto max-w-md px-4 py-6 text-center">
        <p className="text-muted">{tr("treeNotFound")}</p>
        <button onClick={() => router.push("/scan")} className="mt-4 text-primary-ink underline">
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
        showLanguageToggle
      />

      <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
      {/* Tree info card */}
      <div className="mb-6 rounded-lg bg-surface p-4 border border-line">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-2xl font-bold text-ink">{tree.tree_id}</p>
            <p className="text-lg text-muted">
              {tree.zone}{tree.side} · {tr("rowLabel")} {tree.row_num} · {tr("positionLabel")} {tree.position}
            </p>
            <p className="mt-1 text-lg font-semibold text-body">{varietyName(tree.variety, lang)}</p>
          </div>
          <span className="rounded-full bg-primary-tint px-3 py-1 text-base font-semibold text-primary-ink">
            {tree.status === "active" ? tr("treeStatusActive") : tree.status}
          </span>
        </div>

        {sets.length > 0 && (
          <div className="mt-3 border-t border-line pt-3">
            <p className="mb-2 text-base font-semibold text-muted">{tr("activeSets")}</p>
            <div className="flex flex-wrap gap-2">
              {sets.map((s) => {
                // Ribbon colour shows as a discrete round swatch on a neutral chip,
                // never as a coloured pill — that is what keeps it distinguishable
                // from a status badge.
                const swatch: Record<string, string> = {
                  red: "bg-ribbon-red",
                  blue: "bg-ribbon-blue",
                  yellow: "bg-ribbon-yellow",
                  white: "bg-ribbon-white",
                };
                return (
                  <span
                    key={s.set_id}
                    className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-alt px-3 py-1 text-lg font-semibold text-body"
                  >
                    <span
                      aria-hidden
                      className={`h-3.5 w-3.5 flex-shrink-0 rounded-full border border-line ${swatch[s.color] ?? "bg-ribbon-white"}`}
                    />
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
      <h2 className="mb-3 text-base font-semibold text-body">{tr("chooseTask")}</h2>
      <div className="space-y-3">
        {taskDefs.map((def) => (
          <button
            key={def.task_def_id}
            onClick={() =>
              router.push(`/tree/${treeId}/task/${def.task_def_id}`)
            }
            className="flex h-15 w-full items-center gap-4 rounded-lg bg-surface px-4 text-left border border-line active:bg-surface-alt"
          >
            <span className="text-2xl">{def.icon ?? "📋"}</span>
            <div>
              <p className="font-semibold text-ink">{taskDisplayName(def, lang)}</p>
              <p className="text-base text-muted">{def.task_type}</p>
            </div>
            <span className="ml-auto text-muted">›</span>
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
        className="mt-6 flex h-15 w-full items-center justify-center gap-2 rounded-lg border-2 border-line text-lg font-semibold text-muted active:bg-surface-alt"
      >
        <span>📷</span>
        <span>{tr("exitTree")}</span>
      </button>
      </main>
    </div>
  );
}
