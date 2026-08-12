import type { DbTree, DbTaskDefinition, ValidationStatus } from "@/types/database";
import { checkPresence } from "./presence";
import { checkTiming } from "./timing";
import { checkBounds } from "./bounds";
import { checkFields } from "./fields";

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
  rejectionReason?: string;
}

export function validate(input: ValidationInput): ValidationOutput {
  // Allow disabling field validation during local development/testing
  if (process.env.SKIP_VALIDATION === "true") {
    return { status: "passed", flags: [], gpsDistanceMeters: null };
  }

  const allFlags: string[] = [];

  // Layer 1 — Presence
  const { flags: presenceFlags, gpsDistanceMeters } = checkPresence({
    qrValue: input.qrValue,
    tree: input.tree,
    gpsLat: input.gpsLat,
    gpsLong: input.gpsLong,
  });
  allFlags.push(...presenceFlags);

  // Layer 2 — Timing
  const timingFlags = checkTiming({
    formOpenedAt: input.formOpenedAt,
    qrScannedAt: input.qrScannedAt,
    submittedAt: input.submittedAt,
    taskDef: input.taskDef,
  });
  allFlags.push(...timingFlags);

  // Layer 3 — Required fields present and option values legal (hard violations → reject)
  const fieldsResult = checkFields(input.formData, input.taskDef.fields);
  if (!fieldsResult.ok) {
    return {
      status: "rejected",
      flags: allFlags,
      gpsDistanceMeters,
      rejectionReason: fieldsResult.error,
    };
  }

  // Layer 4 — Input bounds (hard violations → reject)
  const boundsResult = checkBounds(input.formData, input.taskDef.fields);
  if (!boundsResult.ok) {
    return {
      status: "rejected",
      flags: allFlags,
      gpsDistanceMeters,
      rejectionReason: boundsResult.error,
    };
  }
  allFlags.push(...boundsResult.flags);

  return {
    status: allFlags.length > 0 ? "flagged" : "passed",
    flags: allFlags,
    gpsDistanceMeters,
  };
}
