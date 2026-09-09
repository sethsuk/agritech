import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { signToken } from "@/lib/logToken";
import { photoDecisionFor } from "@/lib/photoAudit";
import type { DbWorker, DbTaskDefinition, WorkerTrustTier } from "@/types/database";

const BodySchema = z.object({
  treeId: z.string(),
  taskDefId: z.string(),
  qrScannedAt: z.string().datetime(),
});

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

  const { data: worker } = await admin
    .from("workers")
    .select("trust_tier")
    .eq("worker_id", user.id)
    .single<Pick<DbWorker, "trust_tier">>();

  // Least-trusted default: an unknown/missing worker row gets the highest audit rate.
  const trustTier: WorkerTrustTier = worker?.trust_tier ?? "audit";

  // Decide photo requirement. Deterministic per worker/tree/task/day — reopening the
  // form cannot produce a different answer. See lib/photoAudit.ts.
  const { photoRequired, photoRequirementReason, auditSeed } = photoDecisionFor(
    taskDef.photo_policy_mode,
    trustTier,
    { workerId: user.id, treeId, taskDefId },
    process.env.SKIP_VALIDATION === "true",
  );

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
    workerTrustTier: trustTier,
  });
}
