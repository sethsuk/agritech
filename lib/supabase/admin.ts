import { createClient } from "@supabase/supabase-js";

let cached: ReturnType<typeof createClient> | null = null;

// Service-role client — bypasses RLS. Server-only. NEVER import in client components.
export function createAdminClient() {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase admin env vars");
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
