import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorker } from "@/lib/auth/requireWorker";
import { checkBounds } from "@/lib/validation/bounds";
import type { DbTaskLog, DbTaskDefinition } from "@/types/database";

// POST /api/my-logs/:logId/correct — the worker-facing "update" for a record they
// already submitted. Never mutates the original row: inserts a new task_logs row
// with correction_type='correction', correction_of_log_id pointing at the record's
// root log. :logId may be the root or any row already in its chain.

const BodySchema = z.object({
  formData: z.record(z.string(), z.unknown()),
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
  const { formData, reason } = parsed.data;

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

  const { data: taskDef, error: tdErr } = await admin
    .from("task_definitions")
    .select("*")
    .eq("task_def_id", root.task_def_id)
    .single<DbTaskDefinition>();
  if (tdErr || !taskDef) {
    return NextResponse.json({ error: "Task definition not found" }, { status: 404 });
  }

  for (const field of taskDef.fields) {
    if (field.required && (formData[field.field_id] === undefined || formData[field.field_id] === "")) {
      return NextResponse.json(
        { error: "field_required", detail: field.field_id },
        { status: 422 },
      );
    }
  }

  const bounds = checkBounds(formData, taskDef.fields);
  if (!bounds.ok) {
    return NextResponse.json({ error: "bounds_violation", detail: bounds.error }, { status: 422 });
  }

  const { data: correctionLog, error: insertErr } = await admin
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
      form_data: formData,
      photo_required: false,
      photo_requirement_reason: "none",
      photo_audit_selection_seed: null,
      photo_url: root.photo_url,
      validation_status: bounds.flags.length > 0 ? "flagged" : "passed",
      validation_flags: bounds.flags,
      notes_text: null,
      correction_of_log_id: rootId,
      correction_type: "correction",
      correction_reason: reason,
    })
    .select("log_id")
    .single();

  if (insertErr || !correctionLog) {
    console.error("task_logs correction insert error:", insertErr);
    return NextResponse.json({ error: "Failed to save correction" }, { status: 500 });
  }

  return NextResponse.json({ logId: correctionLog.log_id });
}
