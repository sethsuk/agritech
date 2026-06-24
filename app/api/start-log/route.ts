import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { signToken } from "@/lib/logToken";
import type { DbWorker, DbTaskDefinition } from "@/types/database";

const BodySchema = z.object({
  treeId: z.string(),
  taskDefId: z.string(),
  qrScannedAt: z.string().datetime(),
});

const FLAT_AUDIT_RATE = 0.10; // 10% for MVP — replace with tier-based rates later
const TOKEN_TTL_MINUTES = 60;

/**
 * POST /api/start-log
 *
 * Called when a worker opens a task form (after QR scan).
 * Server decides photo_required and returns a signed token.
 * The token must accompany the submit-log call.
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

  const { treeId, taskDefId, qrScannedAt } = parsed.data;
  const admin = createAdminClient();

  // Fetch task definition
  const { data: taskDef, error: tdErr } = await admin
    .from("task_definitions")
    .select("*")
    .eq("task_def_id", taskDefId)
    .eq("active", true)
    .single<DbTaskDefinition>();
  if (tdErr || !taskDef) {
    return NextResponse.json({ error: "Task definition not found" }, { status: 404 });
  }

  // Fetch worker trust tier (for future tier-based audit rate)
  const { data: worker } = await admin
    .from("workers")
    .select("trust_tier")
    .eq("worker_id", user.id)
    .single<Pick<DbWorker, "trust_tier">>();

  // Decide photo requirement
  let photoRequired = false;
  let photoRequirementReason = "none";
  let auditSeed = "";

  const skipValidation = process.env.SKIP_VALIDATION === "true";

  if (!skipValidation) {
    if (taskDef.photo_policy_mode === "always") {
      photoRequired = true;
      photoRequirementReason = "task_default";
    } else if (taskDef.photo_policy_mode === "audit_only") {
      // MVP: flat rate. Later: use worker.trust_tier + taskDef.photo_policy_audit_rates
      auditSeed = Math.random().toString(36).slice(2);
      const roll = parseInt(auditSeed, 36) / Math.pow(36, auditSeed.length);
      photoRequired = roll < FLAT_AUDIT_RATE;
      photoRequirementReason = photoRequired ? "random_audit" : "none";
    }
  }

  const formOpenedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000).toISOString();

  const token = signToken({
    workerId: user.id,
    treeId,
    taskDefId,
    photoRequired,
    photoRequirementReason,
    auditSeed,
    formOpenedAt,
    expiresAt,
  });

  return NextResponse.json({
    logToken: token,
    photoRequired,
    photoRequirementReason,
    formOpenedAt,
    workerTrustTier: worker?.trust_tier ?? "audit",
  });
}
