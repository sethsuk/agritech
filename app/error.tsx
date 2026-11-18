"use client";

import { useEffect } from "react";
import { useT } from "@/lib/i18n/LanguageContext";
import { RouteMessage } from "@/components/RouteStates";

/**
 * Error boundary for every route (rendered inside the root layout, so the language and
 * data providers are available). Replaces Next's English "Application error" screen.
 */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { tr } = useT();
  useEffect(() => { console.error(error); }, [error]);
  return <RouteMessage icon="⚠️" title={tr("crashTitle")} body={tr("crashBody")} onRetry={reset} />;
}
