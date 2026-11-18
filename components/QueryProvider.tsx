"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * In-memory data cache shared by every page (TanStack Query).
 *
 * Data is fetched once and kept until the user refreshes (the refresh button, or
 * reloading the page) or a change they make invalidates it. That's what makes
 * switching dashboard ranges/zones, alert tabs, and moving between manager pages
 * instant instead of re-requesting everything each time.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: Infinity,
            gcTime: 30 * 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
