"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

/** Remove this tab's unsaved task-form drafts (they hold the previous user's entries). */
export function clearDrafts() {
  try {
    for (const k of Object.keys(sessionStorage)) if (k.startsWith("draft:")) sessionStorage.removeItem(k);
  } catch { /* storage blocked */ }
}

/**
 * Sign out AND forget everything cached for this user. Farm phones are shared: without
 * clearing the query cache, the next worker to sign in would briefly see — or, offline,
 * keep seeing — the previous worker's records.
 */
export function useSignOut() {
  const router = useRouter();
  const queryClient = useQueryClient();
  return async () => {
    queryClient.clear();
    clearDrafts();
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  };
}
