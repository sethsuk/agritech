import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorker } from "@/lib/auth/gate";
import { checkFields } from "@/lib/validation/fields";
import { checkBounds, BOUNDS_FLAG_PREFIX } from "@/lib/validation/bounds";
import { normalizeFormData } from "@/lib/validation/normalize";
import { CORRECTION_ERROR_STATUS } from "@/lib/logCorrections";
import type { DbTaskLog, DbTaskDefinition } from "@/types/database";

// POST /api/my-logs/:logId/correct — the worker-facing "update" for a record they
// already submitted. Never mutates the original row: the correct_task_log RPC appends a
// correction row (locking the record, so it can't race a concurrent void) and re-syncs
// the set the record belongs to, so derived counts follow the correction.

const BodySchema = z.object({
  formData: z.record(z.string(), z.unknown()),
  reason: z.string().trim().min(1),
});

export async function POST(request: Request, ctx: { params: Promise<{ logId: string }> }) {
  const { logId } = await ctx.params;

  const gate = await requireWorker();
  if (!gate.ok) return gate.response;
  const { admin, userId } = gate;

  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "reason_required" }, { status: 400 });
  }
  const { reason } = parsed.data;

  const { data: requested } = await admin
    .from("task_logs")
    .select("log_id, correction_of_log_id")
    .eq("log_id", logId)
    .maybeSingle<Pick<DbTaskLog, "log_id" | "correction_of_log_id">>();
  if (!requested) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const rootId = requested.correction_of_log_id ?? requested.log_id;
  const { data: root } = await admin
    .from("task_logs")
    .select("task_def_id, validation_flags")
    .eq("log_id", rootId)
    .single<Pick<DbTaskLog, "task_def_id" | "validation_flags">>();
  const { data: taskDef } = await admin
    .from("task_definitions")
    .select("fields")
    .eq("task_def_id", root?.task_def_id ?? "")
    .maybeSingle<Pick<DbTaskDefinition, "fields">>();
  if (!root || !taskDef) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const formData = normalizeFormData(parsed.data.formData, taskDef.fields);

  const fields = checkFields(formData, taskDef.fields);
  if (!fields.ok) {
    return NextResponse.json({ error: "submission_rejected", ...fields.rejection }, { status: 422 });
  }
  const bounds = checkBounds(formData, taskDef.fields);
  if (!bounds.ok) {
    return NextResponse.json({ error: "submission_rejected", ...bounds.rejection }, { status: 422 });
  }

  // Presence/timing flags describe the original visit and still apply; value-range flags
  // are recomputed here; domain flags (over-harvest) are recomputed by the RPC.
  const flags = [
    ...root.validation_flags.filter((f) => !f.startsWith(BOUNDS_FLAG_PREFIX)),
    ...bounds.flags,
  ];

  const { data: result, error } = await admin.rpc("correct_task_log", {
    p_log_id: logId,
    p_worker: userId,
    p_form: formData,
    p_status: flags.length > 0 ? "flagged" : "passed",
    p_flags: flags,
    p_reason: reason,
  });
  if (error || !result) {
    console.error("correct_task_log failed:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
  if (result.error) {
    return NextResponse.json(result, { status: CORRECTION_ERROR_STATUS[result.error] ?? 422 });
  }
  return NextResponse.json({ logId: result.log_id });
}
