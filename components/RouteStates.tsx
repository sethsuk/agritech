"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n/LanguageContext";

/** Shared body for error.tsx / not-found.tsx: translated, with a way forward. */
export function RouteMessage({
  icon, title, body, onRetry,
}: { icon: string; title: string; body: string; onRetry?: () => void }) {
  const { tr } = useT();
  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center px-4 py-10 text-center">
      <div aria-hidden className="mb-4 text-5xl">{icon}</div>
      <h1 className="text-xl font-bold text-ink">{title}</h1>
      <p className="mt-2 text-base text-body">{body}</p>
      <div className="mt-6 flex w-full flex-col gap-3">
        {onRetry && (
          <button type="button" onClick={onRetry} className="h-15 w-full rounded-lg bg-primary text-lg font-semibold text-white active:bg-primary-press">
            {tr("retryButton")}
          </button>
        )}
        {/* "/" routes by role: workers → /scan, managers → /dashboard. */}
        <Link href="/" className="flex h-15 w-full items-center justify-center rounded-lg border-2 border-line text-lg font-semibold text-body active:bg-surface-alt">
          {tr("goHome")}
        </Link>
      </div>
    </main>
  );
}

/** Skeleton shown by loading.tsx while a server-rendered route loads. */
export function RouteSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6" aria-busy aria-live="polite">
      <div className="mb-6 h-8 w-48 animate-pulse rounded-lg bg-surface-alt" />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-surface-alt" />)}
      </div>
    </div>
  );
}
