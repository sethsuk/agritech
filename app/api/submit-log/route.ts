import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorker } from "@/lib/auth/gate";
import { verifyToken } from "@/lib/logToken";
import { validate } from "@/lib/validation";
import type { DbTree, DbTaskDefinition } from "@/types/database";

const BodySchema = z.object({
  logToken: z.string(),
  qrValue: z.string(),
  gpsLat: z.number().nullable(),
  gpsLong: z.number().nullable(),
  formData: z.record(z.string(), z.unknown()),
  photoUrl: z.string().url().nullable().optional(),
  notesText: z.string().nullable().optional(),
});

/** Status for each domain error code submit_task_log can return. */
const RPC_ERROR_STATUS: Record<string, number> = {
  tree_not_found: 404,
  ribbon_in_use: 409,
  set_not_open: 409,
  fruit_count_exceeds_remaining: 422,
  invalid_fruit_count: 422,
  invalid_color: 422,
  empty_harvest: 422,
};

/**
 * POST /api/submit-log
 *
 * Verifies the signed token, runs fraud validation (presence / timing / fields /
 * bounds), then hands the log to the submit_task_log RPC, which inserts it together
 * with every consequence — set creation/closure, pest/fraud/over-harvest alerts — in
 * ONE transaction. There are no fire-and-forget side effects to lose.
 *
 * Errors are `{ error: <code>, ...details }`; the client maps codes to translated text.
 */
export async function POST(request: Request) {
  const gate = await requireWorker();
  if (!gate.ok) return gate.response;
  const { admin, userId } = gate;

  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const { logToken, qrValue, gpsLat, gpsLong, formData, photoUrl, notesText } = parsed.data;

  const verified = verifyToken(logToken);
  if (!verified.ok) {
    return NextResponse.json(
      { error: verified.reason === "expired" ? "token_expired" : "token_invalid" },
      { status: verified.reason === "expired" ? 410 : 400 },
    );
  }
  const token = verified.payload;
  if (token.workerId !== userId) {
    return NextResponse.json({ error: "token_invalid" }, { status: 403 });
  }

  // Enforce the photo decision the server made when the form was opened.
  if (token.photoRequired && !photoUrl) {
    return NextResponse.json({ error: "photo_required" }, { status: 400 });
  }
  // Only accept photos from this worker's own folder in our bucket — not arbitrary URLs.
  if (photoUrl && !isOwnPhotoUrl(photoUrl, userId)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const [{ data: tree }, { data: taskDef }] = await Promise.all([
    admin.from("trees").select("*").eq("tree_id", token.treeId).maybeSingle<DbTree>(),
    admin.from("task_definitions").select("*").eq("task_def_id", token.taskDefId).maybeSingle<DbTaskDefinition>(),
  ]);
  if (!tree) return NextResponse.json({ error: "tree_not_found" }, { status: 404 });
  if (!taskDef) return NextResponse.json({ error: "task_not_found" }, { status: 404 });

  const submittedAt = new Date();
  const validation = validate({
    tree,
    taskDef,
    qrValue,
    qrScannedAt: new Date(token.qrScannedAt),
    formOpenedAt: new Date(token.formOpenedAt),
    submittedAt,
    gpsLat,
    gpsLong,
    formData,
  });

  if (validation.status === "rejected") {
    return NextResponse.json(
      { error: "submission_rejected", ...validation.rejection },
      { status: 422 },
    );
  }

  const { data: result, error: rpcErr } = await admin.rpc("submit_task_log", {
    p: {
      tree_id: token.treeId,
      task_def_id: token.taskDefId,
      task_type: taskDef.task_type,
      worker_id: userId,
      submitted_at: submittedAt.toISOString(),
      form_opened_at: token.formOpenedAt,
      qr_scanned_at: token.qrScannedAt,
      qr_value: qrValue,
      gps_lat: gpsLat,
      gps_long: gpsLong,
      gps_delta_meters: validation.gpsDistanceMeters !== null
        ? Math.min(validation.gpsDistanceMeters, 999999.99)
        : null,
      form_data: formData,
      photo_required: token.photoRequired,
      photo_requirement_reason: token.photoRequirementReason,
      photo_audit_selection_seed: token.auditSeed || null,
      photo_url: photoUrl ?? null,
      validation_status: validation.status,
      validation_flags: validation.flags,
      notes_text: notesText ?? null,
    },
  });

  if (rpcErr || !result) {
    console.error("submit_task_log failed:", rpcErr);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
  if (result.error) {
    return NextResponse.json(result, { status: RPC_ERROR_STATUS[result.error] ?? 422 });
  }

  return NextResponse.json({
    logId: result.log_id,
    validationStatus: result.validation_status,
    validationFlags: result.validation_flags,
  });
}

function isOwnPhotoUrl(url: string, userId: string): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return !!base && url.startsWith(`${base}/storage/v1/object/public/task-photos/${userId}/`);
}
