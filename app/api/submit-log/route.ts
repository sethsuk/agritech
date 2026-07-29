import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyToken } from "@/lib/logToken";
import { validate } from "@/lib/validation";
import type { DbTree, DbTaskDefinition, GenerationColor } from "@/types/database";

const GENERATION_COLORS: readonly GenerationColor[] = ["red", "blue", "yellow", "white"];
function isGenerationColor(v: string): v is GenerationColor {
  return (GENERATION_COLORS as readonly string[]).includes(v);
}

const BodySchema = z.object({
  logToken: z.string(),
  qrValue: z.string(),
  qrScannedAt: z.string().datetime(),
  gpsLat: z.number().nullable(),
  gpsLong: z.number().nullable(),
  formData: z.record(z.string(), z.unknown()),
  photoUrl: z.string().url().nullable().optional(),
  notesText: z.string().nullable().optional(),
});

/**
 * POST /api/submit-log
 *
 * Validates and saves a completed task log.
 * Returns { logId, validationStatus, validationFlags } or an error.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const {
    logToken,
    qrValue,
    qrScannedAt,
    gpsLat,
    gpsLong,
    formData,
    photoUrl,
    notesText,
  } = parsed.data;

  // Verify the log token
  const tokenPayload = verifyToken(logToken);
  if (!tokenPayload) {
    return NextResponse.json({ error: "Invalid or expired log token" }, { status: 400 });
  }
  if (tokenPayload.workerId !== user.id) {
    return NextResponse.json({ error: "Token worker mismatch" }, { status: 403 });
  }

  // Enforce photo requirement from the server's earlier decision
  if (tokenPayload.photoRequired && !photoUrl) {
    return NextResponse.json({ error: "Photo is required for this submission" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Fetch tree and task definition
  const [{ data: tree, error: treeErr }, { data: taskDef, error: tdErr }] = await Promise.all([
    admin.from("trees").select("*").eq("tree_id", tokenPayload.treeId).single<DbTree>(),
    admin.from("task_definitions").select("*").eq("task_def_id", tokenPayload.taskDefId).single<DbTaskDefinition>(),
  ]);

  if (treeErr || !tree) return NextResponse.json({ error: "Tree not found" }, { status: 404 });
  if (tdErr || !taskDef) return NextResponse.json({ error: "Task definition not found" }, { status: 404 });

  const submittedAt = new Date();

  // Run validation
  const validation = validate({
    tree,
    taskDef,
    qrValue,
    qrScannedAt: new Date(qrScannedAt),
    formOpenedAt: new Date(tokenPayload.formOpenedAt),
    submittedAt,
    gpsLat,
    gpsLong,
    formData,
  });

  if (validation.status === "rejected") {
    return NextResponse.json(
      { error: "submission_rejected", detail: validation.rejectionReason },
      { status: 422 },
    );
  }

  // Insert task_log (append-only — service role bypasses the no-insert RLS)
  const { data: log, error: logErr } = await admin
    .from("task_logs")
    .insert({
      tree_id: tokenPayload.treeId,
      task_def_id: tokenPayload.taskDefId,
      task_type: taskDef.task_type,
      assignment_id: null,
      worker_id: user.id,
      submitted_at: submittedAt.toISOString(),
      form_opened_at: tokenPayload.formOpenedAt,
      qr_scanned_at: qrScannedAt,
      qr_value: qrValue,
      gps_lat: gpsLat,
      gps_long: gpsLong,
      gps_delta_meters: validation.gpsDistanceMeters !== null
        ? Math.min(validation.gpsDistanceMeters, 999999.99)
        : null,
      form_data: formData,
      photo_required: tokenPayload.photoRequired,
      photo_requirement_reason: tokenPayload.photoRequirementReason,
      photo_audit_selection_seed: tokenPayload.auditSeed || null,
      photo_url: photoUrl ?? null,
      validation_status: validation.status,
      validation_flags: validation.flags,
      notes_text: notesText ?? null,
    })
    .select("log_id")
    .single();

  if (logErr || !log) {
    console.error("task_logs insert error:", logErr);
    return NextResponse.json({ error: "Failed to save log" }, { status: 500 });
  }

  const logId = log.log_id;

  // Side effects (fire-and-forget — don't block the response)
  handleSideEffects({ admin, logId, tree, taskDef, formData, userId: user.id }).catch(console.error);

  return NextResponse.json({
    logId,
    validationStatus: validation.status,
    validationFlags: validation.flags,
  });
}

async function handleSideEffects({
  admin, logId, tree, taskDef, formData, userId,
}: {
  admin: ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>;
  logId: string;
  tree: DbTree;
  taskDef: DbTaskDefinition;
  formData: Record<string, unknown>;
  userId: string;
}) {
  const now = new Date();
  const rawColor = String(formData.color ?? "");
  const rawSetColor = String(formData.set_color ?? "");

  // Bloom log → create a set
  if (taskDef.task_type === "bloom_log" && isGenerationColor(rawColor)) {
    const color = rawColor;
    const flowerCount = Number(formData.flower_count ?? 0);
    const bloomDate = now.toISOString().slice(0, 10);
    const matDays = 120;
    const harvestStart = new Date(now.getTime() + (matDays - 7) * 86400000).toISOString().slice(0, 10);
    const harvestEnd = new Date(now.getTime() + (matDays + 7) * 86400000).toISOString().slice(0, 10);
    const season = `${now.getFullYear()}-main`;
    const setId = `set_${tree.tree_id.toLowerCase().replace(/-/g, "")}_${season}_${color}`;

    await admin.from("sets").upsert({
      set_id: setId,
      tree_id: tree.tree_id,
      color,
      season,
      bloom_log_id: logId,
      bloom_date: bloomDate,
      estimated_maturation_days: matDays,
      harvest_window_start: harvestStart,
      harvest_window_end: harvestEnd,
      initial_fruit_count: flowerCount,
      current_fruit_count: flowerCount,
      status: "flowering",
    }, { onConflict: "set_id" });

    await admin.from("set_events").insert({
      set_id: setId,
      event_date: bloomDate,
      event_type: "bloom",
      fruit_count: flowerCount,
      log_id: logId,
    });
  }

  // Harvest log → close out the set and record the harvest event
  if (taskDef.task_type === "harvest" && isGenerationColor(rawSetColor)) {
    const color = rawSetColor;
    const season = `${now.getFullYear()}-main`;
    const setId = `set_${tree.tree_id.toLowerCase().replace(/-/g, "")}_${season}_${color}`;

    const { data: updatedSet } = await admin.from("sets")
      .update({ status: "harvested", harvested_at: now.toISOString() })
      .eq("set_id", setId)
      .select("set_id")
      .maybeSingle();

    // Only log the event if the set actually exists — set_events.set_id is a real FK.
    if (updatedSet) {
      const gradeCounts = formData.grade_counts;
      const harvested = gradeCounts && typeof gradeCounts === "object"
        ? Object.values(gradeCounts as Record<string, unknown>)
            .reduce<number>((sum, v) => sum + (isNaN(Number(v)) ? 0 : Number(v)), 0)
        : 0;

      await admin.from("set_events").insert({
        set_id: setId,
        event_date: now.toISOString().slice(0, 10),
        event_type: "harvest",
        fruit_count: harvested,
        log_id: logId,
      });
    }
  }

  // Pest inspection with severity ≥ moderate → create alert
  if (taskDef.task_type === "pest_inspection") {
    const severity = String(formData.severity ?? "none");
    if (severity === "moderate" || severity === "severe") {
      await admin.from("alerts").insert({
        tier: severity === "severe" ? "tier_1" : "tier_2",
        category: "farm_health",
        subtype: `pest_${severity}`,
        tree_id: tree.tree_id,
        worker_id: userId,
        triggered_by_log_id: logId,
        status: "open",
      });
    }
  }

  // Fraud flags → create alert
  const flags = await admin
    .from("task_logs")
    .select("validation_flags")
    .eq("log_id", logId)
    .single();

  const fraudFlags = ["qr_mismatch", "gps_off_tree", "impossible_travel", "bulk_submission"];
  const triggered = (flags.data?.validation_flags ?? []).filter((f: string) =>
    fraudFlags.some((ff) => f.startsWith(ff))
  );
  if (triggered.length > 0) {
    await admin.from("alerts").insert({
      tier: "tier_1",
      category: "fraud_signal",
      subtype: triggered[0],
      tree_id: tree.tree_id,
      worker_id: userId,
      triggered_by_log_id: logId,
      status: "open",
    });
  }

  // Update tree derived state
  await admin.from("trees").update({
    derived_last_updated: now.toISOString(),
    derived_days_since_last_log: 0,
  }).eq("tree_id", tree.tree_id);
}
