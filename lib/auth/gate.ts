import { cache } from "react";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/types/database";

/**
 * Authorization for API routes and server components — the one implementation.
 *
 * Every API route uses the service-role client, which bypasses RLS completely, so the
 * role check here is the ONLY thing between a logged-in worker and the manager dataset
 * (a missing check once let workers read and dismiss fraud alerts about themselves).
 * There used to be three near-identical copies of this lookup (requireStaff,
 * requireOwner, requireWorker) plus an inline copy in five routes.
 *
 * Usage in a route handler:
 *   const gate = await requireStaff();
 *   if (!gate.ok) return gate.response;
 *   const { admin, userId } = gate;
 */

type Admin = ReturnType<typeof createAdminClient>;

export interface Session {
  userId: string;
  role: UserRole;
  displayName: string;
  /** Workers only: false once a manager deactivates them. Staff are always true. */
  active: boolean;
}

export type Gate =
  | { ok: true; userId: string; role: UserRole; admin: Admin }
  | { ok: false; response: NextResponse };

/** Managers and owners. The one place this comparison is written down. */
export function isStaff(role: UserRole | null | undefined): boolean {
  return role === "manager" || role === "owner";
}

/**
 * The signed-in user, or null. Wrapped in React `cache()` so a layout and the page it
 * wraps share one lookup per request instead of each doing getUser + a role query.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("role, display_name, workers(active)")
    .eq("id", user.id)
    .maybeSingle<{ role: UserRole; display_name: string; workers: { active: boolean } | null }>();
  if (!profile) return null;

  return {
    userId: user.id,
    role: profile.role,
    displayName: profile.display_name,
    active: profile.role === "worker" ? profile.workers?.active ?? false : true,
  };
});

const deny = (status: 401 | 403, error: string): Gate => ({
  ok: false,
  response: NextResponse.json({ error }, { status }),
});

/** Allow the given roles. Deactivated workers are always refused. */
export async function requireRole(...roles: UserRole[]): Promise<Gate> {
  const session = await getSession();
  if (!session) return deny(401, "unauthorized");
  if (!roles.includes(session.role)) return deny(403, "forbidden");
  if (!session.active) return deny(403, "account_inactive");
  return { ok: true, userId: session.userId, role: session.role, admin: createAdminClient() };
}

export const requireStaff = () => requireRole("manager", "owner");
export const requireOwner = () => requireRole("owner");
export const requireWorker = () => requireRole("worker");
