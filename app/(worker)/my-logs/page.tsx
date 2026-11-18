"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { taskDisplayName } from "@/lib/i18n/t";
import { useT } from "@/lib/i18n/LanguageContext";
import { useMyLogs, useTaskDefs } from "@/lib/client/queries";
import { formatDateTime } from "@/lib/time";
import { WorkerHeader } from "@/components/worker/WorkerHeader";
import { ErrorState } from "@/components/QueryState";

/** The worker's own records, newest first, marked when corrected or voided. */
export default function MyLogsPage() {
  const router = useRouter();
  const { lang, tr } = useT();
  const logs = useMyLogs();
  const defs = useTaskDefs();
  const defById = new Map((defs.data ?? []).map((d) => [d.task_def_id, d]));

  return (
    <div className="flex min-h-dvh flex-col">
      <WorkerHeader variant="back" title={tr("myLogsTitle")} onBack={() => router.push("/scan")} />

      <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
        {logs.isError && <ErrorState error={logs.error} onRetry={() => logs.refetch()} />}

        {logs.isPending && (
          <div className="space-y-3" aria-busy>
            {[1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-surface-alt" />)}
          </div>
        )}

        {logs.data?.length === 0 && <p className="mt-10 text-center text-lg text-muted">{tr("myLogsEmpty")}</p>}

        <ul className="space-y-3">
          {logs.data?.map((log) => {
            const def = defById.get(log.task_def_id);
            return (
              <li key={log.log_id}>
                <Link
                  href={`/my-logs/${log.log_id}`}
                  className="flex min-h-15 w-full items-center gap-3 rounded-lg border border-line bg-surface p-4 text-left active:bg-surface-alt"
                >
                  <span aria-hidden className="text-2xl">{def?.icon ?? "📋"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink">{def ? taskDisplayName(def, lang) : "—"}</span>
                    <span className="block truncate text-base text-muted">{log.tree_id} · {formatDateTime(log.submitted_at, lang)}</span>
                    {(log.voided || log.amendmentCount > 0) && (
                      <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-sm font-semibold ${
                        log.voided ? "bg-warning-tint text-warning-ink" : "bg-caution-tint text-caution-ink"
                      }`}>
                        {log.voided ? tr("voidedBadge") : tr("correctedBadge")}
                      </span>
                    )}
                  </span>
                  <span aria-hidden className="text-2xl text-muted">›</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}
