import { NextResponse } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/requireStaff";
import type { DbUser, DbWorker } from "@/types/database";

// GET /api/manager/workers/:workerId — worker detail + recent logs.
// PATCH /api/manager/workers/:workerId — edit display name/language, or deactivate/reactivate.
// Both require manager or owner role.

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ workerId: string }> },
) {
  const { workerId } = await ctx.params;

  const gate = await requireStaff();
  if (!gate.ok) return gate.response;
  const { admin } = gate;

  const [{ data: worker, error: workerErr }, { data: recentLogs }] = await Promise.all([
    admin.from("workers").select("*, users(id, display_name, role)").eq("worker_id", workerId).single(),
    admin
      .from("task_logs")
      .select("log_id, task_type, tree_id, submitted_at, validation_status")
      .eq("worker_id", workerId)
      .order("submitted_at", { ascending: false })
      .limit(10),
  ]);

  if (workerErr || !worker) {
    return NextResponse.json({ error: "Worker not found" }, { status: 404 });
  }

  return NextResponse.json({ worker, recentLogs: recentLogs ?? [] });
}

const PatchSchema = z.object({
  displayName: z.string().trim().min(1).optional(),
  language: z.enum(["my", "th", "en"]).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ workerId: string }> },
) {
  const { workerId } = await ctx.params;

  const gate = await requireStaff();
  if (!gate.ok) return gate.response;
  const { admin } = gate;

  const body = await request.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { displayName, language, active } = parsed.data;
  if (displayName === undefined && language === undefined && active === undefined) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  if (displayName !== undefined) {
    const { error: userErr } = await admin
      .from("users")
      .update({ display_name: displayName } satisfies Partial<DbUser>)
      .eq("id", workerId);
    if (userErr) {
      return NextResponse.json({ error: "Failed to update worker" }, { status: 500 });
    }
  }

  if (active !== undefined) {
    // "Deactivating" a worker must actually block login, not just hide them from
    // the manager list — ban the auth user (100 years ~= indefinite) and lift the
    // ban on reactivation. `workers.active` alone isn't checked anywhere in the
    // worker-facing auth path.
    const { error: banErr } = await admin.auth.admin.updateUserById(workerId, {
      ban_duration: active ? "none" : "876000h",
    });
    if (banErr) {
      return NextResponse.json({ error: "Failed to update worker" }, { status: 500 });
    }
  }

  const workerUpdate: Partial<DbWorker> = {};
  if (language !== undefined) workerUpdate.language = language;
  if (active !== undefined) workerUpdate.active = active;

  let worker;
  if (Object.keys(workerUpdate).length > 0) {
    const { data, error } = await admin
      .from("workers")
      .update(workerUpdate)
      .eq("worker_id", workerId)
      .select("*, users(id, display_name, role)")
      .single();
    if (error || !data) {
      return NextResponse.json({ error: "Failed to update worker" }, { status: 500 });
    }
    worker = data;
  } else {
    const { data } = await admin
      .from("workers")
      .select("*, users(id, display_name, role)")
      .eq("worker_id", workerId)
      .single();
    worker = data;
  }

  return NextResponse.json({ worker });
}
