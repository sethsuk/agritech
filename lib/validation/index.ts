import type { DbTree, DbTaskDefinition, ValidationStatus } from "@/types/database";
import { checkPresence } from "./presence";
import { checkTiming } from "./timing";
import { checkBounds } from "./bounds";
import { checkFields } from "./fields";
import type { Rejection } from "./rejection";

export type { Rejection } from "./rejection";

export interface ValidationInput {
  tree: DbTree;
  taskDef: DbTaskDefinition;
  qrValue: string;
  qrScannedAt: Date;
  formOpenedAt: Date;
  submittedAt: Date;
  gpsLat: number | null;
  gpsLong: number | null;
  formData: Record<string, unknown>;
}

export interface ValidationOutput {
  status: ValidationStatus;
  flags: string[];
  gpsDistanceMeters: number | null;
  rejection?: Rejection;
}

export function validate(input: ValidationInput): ValidationOutput {
  // SKIP_VALIDATION=true (local/e2e only) skips the checks a laptop can't satisfy —
  // presence (GPS/QR) and timing. Field and bounds checks always run: they protect data
  // integrity, not fraud detection, and skipping them let malformed values reach the DB.
  const skipPresence = process.env.SKIP_VALIDATION === "true";

  const allFlags: string[] = [];
  let gpsDistanceMeters: number | null = null;

  if (!skipPresence) {
    // Layer 1 — Presence
    const presence = checkPresence({
      qrValue: input.qrValue,
      tree: input.tree,
      gpsLat: input.gpsLat,
      gpsLong: input.gpsLong,
    });
    allFlags.push(...presence.flags);
    gpsDistanceMeters = presence.gpsDistanceMeters;

    // Layer 2 — Timing
    allFlags.push(...checkTiming({
      formOpenedAt: input.formOpenedAt,
      qrScannedAt: input.qrScannedAt,
      submittedAt: input.submittedAt,
      taskDef: input.taskDef,
    }));
  }

  // Layer 3 — Required fields present and option values legal (hard violations → reject)
  const fieldsResult = checkFields(input.formData, input.taskDef.fields);
  if (!fieldsResult.ok) {
    return { status: "rejected", flags: allFlags, gpsDistanceMeters, rejection: fieldsResult.rejection };
  }

  // Layer 4 — Input bounds (hard violations → reject, soft → flag)
  const boundsResult = checkBounds(input.formData, input.taskDef.fields);
  if (!boundsResult.ok) {
    return { status: "rejected", flags: allFlags, gpsDistanceMeters, rejection: boundsResult.rejection };
  }
  allFlags.push(...boundsResult.flags);

  return {
    status: allFlags.length > 0 ? "flagged" : "passed",
    flags: allFlags,
    gpsDistanceMeters,
  };
}
