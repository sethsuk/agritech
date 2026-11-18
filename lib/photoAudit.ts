/**
 * Whether a submission must carry an audit photo.
 *
 * Previously this was `Math.random()` inline in `start-log`, evaluated afresh on every
 * form open and persisted nowhere. Because the task form calls `start-log` on each mount,
 * a worker who drew "photo required" could go back, re-enter the form, and draw again —
 * at the audit tier's 0.15 rate, fewer than seven reloads to escape. The signed token made
 * the decision unforgeable but not un-resamplable.
 *
 * The draw is now a pure function of the worker, the tree, the task and the calendar day,
 * keyed by HMAC. Re-entering the same form the same day yields the same answer, so there
 * is nothing to reroll; the next day, or a different tree, draws fresh.
 */
import { createHmac } from "crypto";
import type { PhotoRequirementReason, WorkerTrustTier } from "@/types/database";

/**
 * Photo audit sampling rate per worker trust tier. Deployment config, not domain data —
 * tune without a DB write. Defaults match the original design doc.
 */
export function auditRateFor(tier: WorkerTrustTier): number {
  const fromEnv = {
    trusted: process.env.PHOTO_AUDIT_RATE_TRUSTED,
    standard: process.env.PHOTO_AUDIT_RATE_STANDARD,
    audit: process.env.PHOTO_AUDIT_RATE_AUDIT,
  }[tier];
  const fallback = { trusted: 0.01, standard: 0.05, audit: 0.15 }[tier];
  const parsed = Number(fromEnv);
  return fromEnv !== undefined && !isNaN(parsed) ? parsed : fallback;
}

function secret(): string {
  const s = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  // A different slice from lib/logToken.ts so the audit draw and the token signature
  // are not derived from the same key material.
  return s.slice(32, 64) || s.slice(0, 32);
}

export interface PhotoAuditKey {
  workerId: string;
  treeId: string;
  taskDefId: string;
  /** The day the draw belongs to. Defaults to now. */
  at?: Date;
}

/**
 * A stable 0..1 draw for this worker/tree/task/day.
 *
 * Exported for its own sake: it is the part worth testing, and a caller can check that
 * the same key really does give the same number.
 */
export function auditDraw({ workerId, treeId, taskDefId, at = new Date() }: PhotoAuditKey): {
  roll: number;
  seed: string;
} {
  const day = at.toISOString().slice(0, 10);
  const seed = createHmac("sha256", secret())
    .update(`${workerId}:${treeId}:${taskDefId}:${day}`)
    .digest("hex");

  // First 13 hex digits ≈ 52 bits, which is exactly what a JS double holds without loss.
  const roll = parseInt(seed.slice(0, 13), 16) / 2 ** 52;
  return { roll, seed };
}

export interface PhotoDecision {
  photoRequired: boolean;
  photoRequirementReason: PhotoRequirementReason;
  /** Recorded on the log row so an audit draw can be reconstructed after the fact. */
  auditSeed: string;
}

/**
 * The photo requirement for one form open.
 *
 * `skipValidation` mirrors SKIP_VALIDATION elsewhere: it forces "no photo" for local
 * iteration. Never set it in production.
 */
export function photoDecisionFor(
  policyMode: string,
  trustTier: WorkerTrustTier,
  key: PhotoAuditKey,
  skipValidation = false,
): PhotoDecision {
  if (skipValidation || policyMode === "never") {
    return { photoRequired: false, photoRequirementReason: "none", auditSeed: "" };
  }

  if (policyMode === "always") {
    return { photoRequired: true, photoRequirementReason: "task_default", auditSeed: "" };
  }

  if (policyMode === "audit_only") {
    const { roll, seed } = auditDraw(key);
    const photoRequired = roll < auditRateFor(trustTier);
    return {
      photoRequired,
      photoRequirementReason: photoRequired ? "random_audit" : "none",
      auditSeed: seed,
    };
  }

  return { photoRequired: false, photoRequirementReason: "none", auditSeed: "" };
}
