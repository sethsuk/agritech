import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

type WorkerGate =
  | { ok: true; userId: string; admin: Admin }
  | { ok: false; response: NextResponse };

/**
 * Auth gate for worker-facing API routes that use the service-role client (needed
 * because writing a correction/void row is still append-only-via-service-role, same
 * as /api/submit-log — see requireStaff.ts for why this check can't be skipped just
 * because RLS also exists).
 *
 * Usage:
 *   const gate = await requireWorker();
 *   if (!gate.ok) return gate.response;
 *   const { admin, userId } = gate;
 */
export async function requireWorker(): Promise<WorkerGate> {
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

  if (!profile || profile.role !== "worker") {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { ok: true, userId: user.id, admin };
}
