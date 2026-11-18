"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { taskDisplayName } from "@/lib/i18n/t";
import { useT } from "@/lib/i18n/LanguageContext";
import { colorName, sortTaskDefs } from "@/lib/i18n/labels";
import { varietyName } from "@/lib/i18n/varieties";
import { useTaskDefs, useWorkerTree } from "@/lib/client/queries";
import { zoneKey } from "@/lib/treeId";
import { WorkerHeader } from "@/components/worker/WorkerHeader";
import { ErrorState } from "@/components/QueryState";

// Ribbon colour is a discrete round swatch on a neutral chip, never a coloured pill,
// so it can't be mistaken for a status badge.
const swatch: Record<string, string> = {
  red: "bg-ribbon-red",
  blue: "bg-ribbon-blue",
  yellow: "bg-ribbon-yellow",
  white: "bg-ribbon-white",
};

/** Tasks that must be logged against an existing open set. */
const NEEDS_OPEN_SET = new Set(["harvest", "fruit_check"]);

export default function TreeDetailPage() {
  const { treeId } = useParams<{ treeId: string }>();
  const router = useRouter();
  const { lang, tr } = useT();
  const treeQuery = useWorkerTree(treeId);
  const defsQuery = useTaskDefs();

  const backToScan = () => {
    sessionStorage.removeItem("qr_scanned_at");
    sessionStorage.removeItem("qr_value");
    router.push("/scan");
  };

  if (treeQuery.isPending || defsQuery.isPending) {
    return (
      <div className="flex min-h-dvh flex-col">
        <WorkerHeader variant="back" title="…" onBack={backToScan} />
        <main className="mx-auto w-full max-w-md px-4 py-6" aria-busy>
          <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-surface-alt" />)}</div>
        </main>
      </div>
    );
  }

  if (treeQuery.isError || defsQuery.isError || !treeQuery.data) {
    // Distinguish "no such tree" from "no signal" — both used to read "tree not found".
    return (
      <div className="flex min-h-dvh flex-col">
        <WorkerHeader variant="back" title={tr("treeNotFound")} onBack={backToScan} />
        <main className="mx-auto w-full max-w-md px-4 py-6">
          <ErrorState error={treeQuery.error ?? defsQuery.error} onRetry={() => { treeQuery.refetch(); defsQuery.refetch(); }} />
          <button onClick={backToScan} className="mt-4 h-15 w-full rounded-lg border-2 border-line text-lg font-semibold text-body">
            📷 {tr("backToScan")}
          </button>
        </main>
      </div>
    );
  }

  const { tree, sets } = treeQuery.data;
  const tasks = sortTaskDefs(defsQuery.data ?? []);

  return (
    <div className="flex min-h-dvh flex-col">
      <WorkerHeader variant="back" title={`${tr("treeTitlePrefix")} ${tree.tree_id}`} onBack={backToScan} showLanguageToggle />

      <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
        <div className="mb-6 rounded-lg border border-line bg-surface p-4">
          <p className="text-2xl font-bold text-ink">{tree.tree_id}</p>
          <p className="text-lg text-muted">
            {zoneKey(tree.zone, tree.side)} · {tr("rowLabel")} {tree.row_num} · {tr("positionLabel")} {tree.position}
          </p>
          <p className="mt-1 text-lg font-semibold text-body">{varietyName(tree.variety, lang)}</p>

          {sets.length > 0 && (
            <div className="mt-3 border-t border-line pt-3">
              <p className="mb-2 text-base font-semibold text-muted">{tr("activeSets")}</p>
              <div className="flex flex-wrap gap-2">
                {sets.map((s) => (
                  <span key={s.set_id} className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-alt px-3 py-1 text-lg font-semibold text-body">
                    <span aria-hidden className={`h-3.5 w-3.5 flex-shrink-0 rounded-full border border-line ${swatch[s.color] ?? "bg-ribbon-white"}`} />
                    {colorName(s.color, lang)} · {tr("setRemaining", { n: Math.max(s.remaining, 0) })}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <h2 className="mb-3 text-base font-semibold text-body">{tr("chooseTask")}</h2>
        <ul className="space-y-3">
          {tasks.map((def) => {
            const blocked = NEEDS_OPEN_SET.has(def.task_type) && sets.length === 0;
            const content = (
              <>
                <span aria-hidden className="text-2xl">{def.icon ?? "📋"}</span>
                <span className="min-w-0 flex-1">
                  {/* Only the name in the chosen language — the raw task code used to show here. */}
                  <span className="block text-lg font-semibold text-ink">{taskDisplayName(def, lang)}</span>
                  {blocked && <span className="block text-sm text-muted">{tr("needsOpenSet")} — {tr("setPickerEmpty")}</span>}
                </span>
                {!blocked && <span aria-hidden className="text-2xl text-muted">›</span>}
              </>
            );
            return (
              <li key={def.task_def_id}>
                {blocked ? (
                  <div aria-disabled className="flex min-h-15 w-full items-center gap-4 rounded-lg border border-line bg-surface-alt px-4 py-3 opacity-70">
                    {content}
                  </div>
                ) : (
                  <Link
                    href={`/tree/${treeId}/task/${def.task_def_id}`}
                    className="flex min-h-15 w-full items-center gap-4 rounded-lg border border-line bg-surface px-4 py-3 active:bg-surface-alt"
                  >
                    {content}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>

        <button
          onClick={backToScan}
          className="mt-6 flex h-15 w-full items-center justify-center gap-2 rounded-lg border-2 border-line text-lg font-semibold text-muted active:bg-surface-alt"
        >
          <span aria-hidden>📷</span>
          <span>{tr("exitTree")}</span>
        </button>
      </main>
    </div>
  );
}
