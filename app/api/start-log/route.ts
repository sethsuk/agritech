import { NextResponse } from "next/server";
import { z } from "zod";
import { requireWorker } from "@/lib/auth/gate";
import { randomUUID } from "crypto";
import { signToken, verifyToken, type LogTokenPayload } from "@/lib/logToken";
import { photoDecisionFor } from "@/lib/photoAudit";
import type { DbWorker, DbTaskDefinition, WorkerTrustTier } from "@/types/database";

const BodySchema = z.object({
  treeId: z.string(),
  taskDefId: z.string(),
  qrScannedAt: z.string().datetime(),
  /** The form's previous token (expired, or from a restored draft) — see renewal below. */
  previousToken: z.string().optional(),
});

const TOKEN_TTL_MINUTES = 60;
/** How long after first opening a form its token can still be renewed. */
const RENEW_WINDOW_HOURS = 12;

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
  const expiresAt = new Date(now.getTime() + TOKEN_TTL_MINUTES * 60 * 1000).toISOString();

  // Renewal: an expired (or draft-restored) token for the SAME worker, tree and task keeps
  // its original form-open / QR-scan times, photo decision and submission id. A fresh
  // formOpenedAt would make a worker whose fields are already filled in look like they
  // completed the task in seconds (completion_too_fast), and a fresh submission id would
  // defeat duplicate protection if the first attempt actually went through.
  const prev = parsed.data.previousToken ? verifyToken(parsed.data.previousToken, { allowExpired: true }) : null;
  const renewable: LogTokenPayload | null =
    prev?.ok &&
    prev.payload.workerId === userId && prev.payload.treeId === treeId && prev.payload.taskDefId === taskDefId &&
    now.getTime() - Date.parse(prev.payload.formOpenedAt) < RENEW_WINDOW_HOURS * 3_600_000
      ? prev.payload
      : null;

  // A scan time in the future (clock skew, tampering) is clamped to now.
  const scanned = new Date(parsed.data.qrScannedAt);
  const payload: LogTokenPayload = renewable
    ? { ...renewable, expiresAt }
    : {
        workerId: userId,
        treeId,
        taskDefId,
        photoRequired,
        photoRequirementReason,
        auditSeed,
        formOpenedAt: now.toISOString(),
        qrScannedAt: (scanned > now ? now : scanned).toISOString(),
        submissionId: randomUUID(),
        expiresAt,
      };
  const token = signToken(payload);

  return NextResponse.json({
    logToken: token,
    photoRequired: payload.photoRequired,
    photoRequirementReason: payload.photoRequirementReason,
    formOpenedAt: payload.formOpenedAt,
    workerTrustTier: trustTier,
    renewed: renewable !== null,
  });
}
