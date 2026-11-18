import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorker } from "@/lib/auth/gate";
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
 * Called when a worker opens a task form (after QR scan). The server decides
 * photo_required and returns a signed token binding that decision, the form-open time
 * and the QR-scan time. The token must accompany the submit-log call.
 */
export async function POST(request: Request) {
  const gate = await requireWorker(); // also refuses deactivated workers
  if (!gate.ok) return gate.response;
  const { admin, userId } = gate;

  const body = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const { treeId, taskDefId } = parsed.data;

  const [{ data: taskDef }, { data: tree }, { data: worker }] = await Promise.all([
    admin.from("task_definitions").select("*").eq("task_def_id", taskDefId).eq("active", true)
      .maybeSingle<DbTaskDefinition>(),
    admin.from("trees").select("tree_id").eq("tree_id", treeId).eq("status", "active").maybeSingle(),
    admin.from("workers").select("trust_tier").eq("worker_id", userId)
      .maybeSingle<Pick<DbWorker, "trust_tier">>(),
  ]);
  if (!taskDef) return NextResponse.json({ error: "task_not_found" }, { status: 404 });
  if (!tree) return NextResponse.json({ error: "tree_not_found" }, { status: 404 });

  // Least-trusted default: an unknown/missing worker row gets the highest audit rate.
  const trustTier: WorkerTrustTier = worker?.trust_tier ?? "audit";

  // Deterministic per worker/tree/task/day — reopening the form can't reroll it.
  const { photoRequired, photoRequirementReason, auditSeed } = photoDecisionFor(
    taskDef.photo_policy_mode,
    trustTier,
    { workerId: userId, treeId, taskDefId },
    process.env.SKIP_VALIDATION === "true",
  );

  const now = new Date();
  const formOpenedAt = now.toISOString();
  // A scan time in the future (clock skew, tampering) is clamped to now.
  const scanned = new Date(parsed.data.qrScannedAt);
  const qrScannedAt = (scanned > now ? now : scanned).toISOString();

  const token = signToken({
    workerId: userId,
    treeId,
    taskDefId,
    photoRequired,
    photoRequirementReason,
    auditSeed,
    formOpenedAt,
    qrScannedAt,
    expiresAt: new Date(now.getTime() + TOKEN_TTL_MINUTES * 60 * 1000).toISOString(),
  });

  return NextResponse.json({
    logToken: token,
    photoRequired,
    photoRequirementReason,
    formOpenedAt,
    workerTrustTier: trustTier,
  });
}
