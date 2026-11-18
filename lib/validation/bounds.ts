import type { TaskField } from "@/types/database";
import type { Rejection } from "./rejection";

export type BoundsResult =
  | { ok: true; flags: string[] }
  | { ok: false; rejection: Rejection };

/** Flags from this check start with this prefix (corrections recompute only these). */
export const BOUNDS_FLAG_PREFIX = "value_out_of_warn_range:";

/** A field accepts only whole numbers when its step (default 1) is a whole number. */
function wholeNumbersOnly(field: TaskField): boolean {
  return Number.isInteger(field.step ?? 1);
}

function checkNumber(field: TaskField, raw: unknown, option?: string): Rejection | null {
  const value = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
  if (!Number.isFinite(value)) return { code: "field_not_a_number", field: field.field_id, option };
  if (wholeNumbersOnly(field) && !Number.isInteger(value)) {
    return { code: "field_not_whole_number", field: field.field_id, option };
  }
  if (field.min !== undefined && value < field.min) {
    return { code: "field_below_min", field: field.field_id, option, limit: field.min };
  }
  if (field.max !== undefined && value > field.max) {
    return { code: "field_above_max", field: field.field_id, option, limit: field.max };
  }
  return null;
}

/**
 * Layer 4 — numeric values are real numbers within hard min/max (else reject), and
 * outside warn_below/warn_above only flag. Non-numbers used to be skipped silently and
 * then crashed the set/alert side effects downstream.
 */
export function checkBounds(formData: Record<string, unknown>, fields: TaskField[]): BoundsResult {
  const flags: string[] = [];

  for (const field of fields) {
    const raw = formData[field.field_id];
    if (raw === undefined || raw === null || raw === "") continue;

    if (field.type === "grade_counter") {
      if (typeof raw !== "object") return { ok: false, rejection: { code: "field_not_a_number", field: field.field_id } };
      for (const [grade, count] of Object.entries(raw as Record<string, unknown>)) {
        const rejection = checkNumber(field, count, grade);
        if (rejection) return { ok: false, rejection };
      }
      continue;
    }

    if (field.type !== "numeric_counter" && field.type !== "slider") continue;
    const rejection = checkNumber(field, raw);
    if (rejection) return { ok: false, rejection };

    const value = Number(raw);
    if ((field.warn_below !== undefined && value < field.warn_below) ||
        (field.warn_above !== undefined && value > field.warn_above)) {
      flags.push(`${BOUNDS_FLAG_PREFIX}${field.field_id}`);
    }
  }

  return { ok: true, flags };
}
