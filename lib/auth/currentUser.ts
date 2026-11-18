import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/types/database";

/**
 * The signed-in user's identity and role, for server components and layouts.
 *
 * The sibling of `requireStaff()`: same cookie-client-then-admin-client lookup, but it
 * returns the role instead of an HTTP response, because a page redirects where a route
 * handler replies. Splitting on that difference alone keeps one definition of "who is
 * this" — the lookup was previously open-coded in three places (app/page.tsx and both
 * route-group layouts) with three different spellings of the staff test.
 */

export interface CurrentUser {
  userId: string;
  role: UserRole;
  displayName: string;
}

/** Managers and owners. The one place this comparison is written down. */
export function isStaff(role: UserRole | null | undefined): boolean {
  return role === "manager" || role === "owner";
}

/** Null when nobody is signed in, or when the auth user has no `public.users` row. */
export async function currentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("role, display_name")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return { userId: user.id, role: profile.role, displayName: profile.display_name };
}
