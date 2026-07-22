import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

let cached: SupabaseClient<Database> | null = null;

// Service-role client — bypasses RLS. Server-only. NEVER import in client components.
export function createAdminClient() {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase admin env vars");
  cached = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
