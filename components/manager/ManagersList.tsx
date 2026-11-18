"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useT } from "@/lib/i18n/LanguageContext";
import { errorMessage } from "@/lib/i18n/labels";
import { api, errorBody } from "@/lib/client/api";
import { qk, useManagers, type ManagerRow } from "@/lib/client/queries";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ErrorState, RefreshBar } from "@/components/QueryState";

/** Owner view: manager accounts, with deactivate / reactivate (soft — history is kept). */
export function ManagersList() {
  const { lang, tr } = useT();
  const queryClient = useQueryClient();
  const managers = useManagers();
  const [target, setTarget] = useState<ManagerRow | null>(null);

  const toggle = useMutation({
    mutationFn: (m: ManagerRow) => api(`/api/owner/managers/${m.id}`, { method: "PATCH", json: { active: !m.active } }),
    onSuccess: (_d, m) => {
      toast.success(tr(m.active ? "deactivatedManagerToast" : "reactivatedManagerToast"));
      queryClient.invalidateQueries({ queryKey: qk.managers });
    },
    onError: (err) => toast.error(errorMessage(errorBody(err), lang)),
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">{tr("navManagers")}{managers.data ? ` (${managers.data.length})` : ""}</h1>
          <RefreshBar updatedAt={managers.dataUpdatedAt || undefined} fetching={managers.isFetching} onRefresh={() => managers.refetch()} />
        </div>
        <Link
          href="/managers/new"
          className="flex h-11 flex-shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-white active:bg-primary-press"
        >
          {tr("addManagerButton")}
        </Link>
      </div>

      {managers.isError && !managers.data && <ErrorState error={managers.error} onRetry={() => managers.refetch()} />}
      {managers.isPending && (
        <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-surface-alt" />)}</div>
      )}
      {managers.data?.length === 0 && (
        <div className="rounded-lg border border-line bg-surface p-8 text-center text-muted">{tr("noManagersFound")}</div>
      )}

      <ul className="space-y-3">
        {managers.data?.map((m) => (
          <li key={m.id} data-testid="manager-row" className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface p-4">
            <div className="min-w-0">
              <p className="font-semibold text-ink">{m.displayName}</p>
              <p className="truncate text-xs text-muted">{m.email}</p>
              {!m.active && (
                <span className="mt-1 inline-block rounded-full bg-surface-press px-2 py-0.5 text-xs font-semibold text-body">{tr("inactiveBadge")}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setTarget(m)}
              disabled={toggle.isPending}
              className={`min-h-11 flex-shrink-0 rounded-lg px-3 text-xs font-semibold disabled:opacity-50 ${
                m.active ? "border border-warning bg-warning-tint text-warning-ink" : "bg-primary text-white"
              }`}
            >
              {m.active ? tr("deactivateManagerButton") : tr("reactivateManagerButton")}
            </button>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={target !== null}
        title={target?.active ? tr("deactivateManagerTitle") : tr("reactivateManagerTitle")}
        message={target ? tr(target.active ? "deactivateManagerMsg" : "reactivateManagerMsg", { name: target.displayName }) : undefined}
        confirmLabel={target?.active ? tr("deactivateManagerButton") : tr("reactivateManagerButton")}
        destructive={target?.active}
        onConfirm={() => { if (target) toggle.mutate(target); setTarget(null); }}
        onCancel={() => setTarget(null)}
      />
    </div>
  );
}
