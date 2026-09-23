import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorker } from "@/lib/auth/requireWorker";
import type { DbTaskLog } from "@/types/database";

// POST /api/my-logs/:logId/void — the worker-facing "delete" for a record they
// already submitted. Never removes the original row: inserts a new task_logs row
// with correction_type='void' marking the whole chain retracted. :logId may be the
// root or any row already in its chain.

const BodySchema = z.object({
  reason: z.string().trim().min(1),
});

export async function POST(
  request: Request,
  ctx: { params: Promise<{ logId: string }> },
) {
  const { logId } = await ctx.params;

  const gate = await requireWorker();
  if (!gate.ok) return gate.response;
  const { admin, userId } = gate;

  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { reason } = parsed.data;

  const { data: requested, error: fetchErr } = await admin
    .from("task_logs")
    .select("*")
    .eq("log_id", logId)
    .maybeSingle<DbTaskLog>();
  if (fetchErr || !requested) {
    return NextResponse.json({ error: "Log not found" }, { status: 404 });
  }
  if (requested.worker_id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rootId = requested.correction_of_log_id ?? requested.log_id;

  const [{ data: root, error: rootErr }, { data: amendments }] = await Promise.all([
    admin.from("task_logs").select("*").eq("log_id", rootId).single<DbTaskLog>(),
    admin.from("task_logs").select("correction_type").eq("correction_of_log_id", rootId)
      .returns<Pick<DbTaskLog, "correction_type">[]>(),
  ]);
  if (rootErr || !root) {
    return NextResponse.json({ error: "Log not found" }, { status: 404 });
  }
  if ((amendments ?? []).some((a) => a.correction_type === "void")) {
    return NextResponse.json({ error: "log_already_voided" }, { status: 409 });
  }

  const { data: voidLog, error: insertErr } = await admin
    .from("task_logs")
    .insert({
      tree_id: root.tree_id,
      task_def_id: root.task_def_id,
      task_type: root.task_type,
      assignment_id: root.assignment_id,
      worker_id: userId,
      submitted_at: new Date().toISOString(),
      form_opened_at: new Date().toISOString(),
      qr_scanned_at: root.qr_scanned_at,
      qr_value: root.qr_value,
      gps_lat: root.gps_lat,
      gps_long: root.gps_long,
      gps_delta_meters: root.gps_delta_meters,
      form_data: {},
      photo_required: false,
      photo_requirement_reason: "none",
      photo_audit_selection_seed: null,
      photo_url: null,
      validation_status: "passed",
      validation_flags: [],
      notes_text: null,
      correction_of_log_id: rootId,
      correction_type: "void",
      correction_reason: reason,
    })
    .select("log_id")
    .single();

  if (insertErr || !voidLog) {
    console.error("task_logs void insert error:", insertErr);
    return NextResponse.json({ error: "Failed to void log" }, { status: 500 });
  }

  return NextResponse.json({ logId: voidLog.log_id });
}
