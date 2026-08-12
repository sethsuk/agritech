import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

type StaffGate =
  | { ok: true; userId: string; admin: Admin }
  | { ok: false; response: NextResponse };

/**
 * Auth gate for every manager-facing API route.
 *
 * These handlers all use the service-role client, which bypasses RLS completely —
 * so this role check is the ONLY thing standing between a logged-in worker and the
 * full alerts/workers/trees dataset. It lives here rather than being copy-pasted per
 * route because it was previously duplicated five times and /api/manager/alerts was
 * missing it, letting any worker read and dismiss fraud alerts about themselves.
 *
 * Usage:
 *   const gate = await requireStaff();
 *   if (!gate.ok) return gate.response;
 *   const { admin, userId } = gate;
 */
export async function requireStaff(): Promise<StaffGate> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "manager" && profile.role !== "owner")) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { ok: true, userId: user.id, admin };
}
