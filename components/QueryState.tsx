"use client";

import { useT } from "@/lib/i18n/LanguageContext";
import { errorMessage } from "@/lib/i18n/labels";
import { errorBody } from "@/lib/client/api";
import { formatDateTime } from "@/lib/time";

/** Inline error card with a Retry button — instead of a 3-second toast and a skeleton that pulses forever. */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { lang, tr } = useT();
  return (
    <div role="alert" className="rounded-lg border border-warning bg-warning-tint p-4 text-sm text-warning-ink">
      <p className="font-semibold">{tr("loadError")}</p>
      <p className="mt-1">{errorMessage(errorBody(error), lang)}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-surface px-4 text-sm font-semibold text-body border border-line"
      >
        {tr("retryButton")}
      </button>
    </div>
  );
}

/**
 * "Updated 14:05 · ⟳ Refresh". Data is cached until refreshed, so the page always says
 * how fresh it is and offers a one-tap reload (visibility of system status).
 */
export function RefreshBar({
  updatedAt, fetching, onRefresh,
}: { updatedAt: number | string | undefined; fetching: boolean; onRefresh: () => void }) {
  const { lang, tr } = useT();
  return (
    <div className="flex items-center gap-2 text-xs text-muted">
      {updatedAt ? <span aria-live="polite">{tr("updatedAt", { time: formatDateTime(updatedAt, lang) })}</span> : null}
      <button
        type="button"
        onClick={onRefresh}
        disabled={fetching}
        className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 font-semibold text-primary-ink hover:bg-surface-alt disabled:opacity-60 sm:min-h-0 sm:py-1"
      >
        <span aria-hidden className={fetching ? "inline-block animate-spin" : "inline-block"}>⟳</span>
        {tr("refreshButton")}
      </button>
    </div>
  );
}
