import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/gate";
import { toAuthPassword } from "@/lib/auth/pin";
import { reliabilityFor } from "@/lib/derived";
import type { DbUser, DbWorker } from "@/types/database";

// GET   /api/manager/workers/:workerId — worker + live reliability + recent logs.
// PATCH /api/manager/workers/:workerId — edit name/language/trust tier, deactivate or
//       reactivate (soft delete — history is kept), or reset the PIN.

const WORKER_SELECT = "*, users(id, display_name, role)";

export async function GET(_request: Request, ctx: { params: Promise<{ workerId: string }> }) {
  const { workerId } = await ctx.params;
  const gate = await requireStaff();
  if (!gate.ok) return gate.response;
  const { admin } = gate;

  const [{ data: worker }, { data: recentLogs }, reliability] = await Promise.all([
    admin.from("workers").select(WORKER_SELECT).eq("worker_id", workerId).maybeSingle(),
    admin.from("effective_task_logs")
      .select("log_id, task_def_id, task_type, tree_id, submitted_at, validation_status, validation_flags")
      .eq("worker_id", workerId)
      .order("submitted_at", { ascending: false })
      .limit(20),
    reliabilityFor(admin, workerId),
  ]);
  if (!worker) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ worker, recentLogs: recentLogs ?? [], reliability });
}

const PatchSchema = z.object({
  displayName: z.string().trim().min(1).optional(),
  language: z.enum(["my", "th", "en"]).optional(),
  active: z.boolean().optional(),
  trustTier: z.enum(["trusted", "standard", "audit"]).optional(),
  pin: z.string().regex(/^\d{4,6}$/).optional(),
});

export async function PATCH(request: Request, ctx: { params: Promise<{ workerId: string }> }) {
  const { workerId } = await ctx.params;
  const gate = await requireStaff();
  if (!gate.ok) return gate.response;
  const { admin } = gate;

  const body = await request.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    const pinBad = parsed.error.issues.some((i) => i.path[0] === "pin");
    return NextResponse.json({ error: pinBad ? "weak_pin" : "bad_request" }, { status: 400 });
  }
  const { displayName, language, active, trustTier, pin } = parsed.data;
  if ([displayName, language, active, trustTier, pin].every((v) => v === undefined)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { data: exists } = await admin.from("workers").select("worker_id").eq("worker_id", workerId).maybeSingle();
  if (!exists) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (displayName !== undefined) {
    const { error } = await admin.from("users")
      .update({ display_name: displayName } satisfies Partial<DbUser>)
      .eq("id", workerId);
    if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  // Auth-side changes: deactivation must actually block login (ban the auth user —
  // 100 years ≈ indefinite — and lift it on reactivation); a PIN reset sets a new
  // prefixed password (lib/auth/pin.ts). requireWorker() also refuses inactive workers,
  // which covers the window before an already-issued session expires.
  const authUpdate: { ban_duration?: string; password?: string } = {};
  if (active !== undefined) authUpdate.ban_duration = active ? "none" : "876000h";
  if (pin !== undefined) authUpdate.password = toAuthPassword(pin);
  if (Object.keys(authUpdate).length > 0) {
    const { error } = await admin.auth.admin.updateUserById(workerId, authUpdate);
    if (error) {
      console.error("worker auth update failed:", error);
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
  }

  const workerUpdate: Partial<DbWorker> = {};
  if (language !== undefined) workerUpdate.language = language;
  if (active !== undefined) workerUpdate.active = active;
  if (trustTier !== undefined) {
    workerUpdate.trust_tier = trustTier;
    workerUpdate.trust_tier_set_by = gate.userId;
    workerUpdate.trust_tier_changed_at = new Date().toISOString();
  }
  if (Object.keys(workerUpdate).length > 0) {
    const { error } = await admin.from("workers").update(workerUpdate).eq("worker_id", workerId);
    if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  const { data: worker } = await admin.from("workers").select(WORKER_SELECT).eq("worker_id", workerId).single();
  return NextResponse.json({ worker });
}
