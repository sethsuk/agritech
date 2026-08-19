"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { t, taskDisplayName } from "@/lib/i18n/t";
import { WorkerHeader } from "@/components/worker/WorkerHeader";
import { useLang } from "@/lib/i18n/LanguageContext";
import { dict } from "@/lib/i18n/dictionary";
import type { DbTaskLog, DbTaskDefinition } from "@/types/database";

type MyLogRow = DbTaskLog & { amendmentCount: number; voided: boolean };

export default function MyLogsPage() {
  const router = useRouter();
  const { lang } = useLang();
  const [logs, setLogs] = useState<MyLogRow[] | null>(null);
  const [taskDefs, setTaskDefs] = useState<Record<string, DbTaskDefinition>>({});
  const [loading, setLoading] = useState(true);

  const tr = (key: keyof typeof dict) => t(dict[key], lang);

  useEffect(() => {
    Promise.all([
      fetch("/api/my-logs").then((r) => r.ok ? r.json() : Promise.reject()),
      fetch("/api/task-definitions").then((r) => r.ok ? r.json() : Promise.reject()),
    ])
      .then(([logsRes, defsRes]: [{ logs: MyLogRow[] }, DbTaskDefinition[]]) => {
        setLogs(logsRes.logs);
        setTaskDefs(Object.fromEntries(defsRes.map((d) => [d.task_def_id, d])));
      })
      .catch(() => toast.error(tr("myLogsLoadError")))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex min-h-dvh flex-col">
      <WorkerHeader variant="back" title={tr("myLogsTitle")} onBack={() => router.push("/scan")} />

      <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-surface-alt" />
            ))}
          </div>
        )}

        {!loading && logs?.length === 0 && (
          <p className="mt-10 text-center text-lg text-muted">{tr("myLogsEmpty")}</p>
        )}

        {!loading && logs && logs.length > 0 && (
          <div className="space-y-3">
            {logs.map((log) => {
              const def = taskDefs[log.task_def_id];
              return (
                <button
                  key={log.log_id}
                  onClick={() => router.push(`/my-logs/${log.log_id}`)}
                  className="flex w-full items-center gap-3 rounded-lg border border-line bg-surface p-4 text-left active:bg-surface-alt"
                >
                  <span className="text-2xl">{def?.icon ?? "📋"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">
                      {def ? taskDisplayName(def, lang) : log.task_type}
                    </p>
                    <p className="truncate text-base text-muted">
                      {log.tree_id} · {new Date(log.submitted_at).toLocaleString("th-TH")}
                    </p>
                    {(log.voided || log.amendmentCount > 0) && (
                      <span
                        className={`mt-1 inline-block rounded-full px-2 py-0.5 text-sm font-semibold ${
                          log.voided
                            ? "bg-warning-tint text-warning-ink"
                            : "bg-caution-tint text-caution-ink"
                        }`}
                      >
                        {log.voided ? tr("voidedBadge") : tr("correctedBadge")}
                      </span>
                    )}
                  </div>
                  <span className="text-muted">›</span>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
