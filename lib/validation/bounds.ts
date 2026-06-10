import type { TaskField } from "@/types/database";

export type BoundsResult =
  | { ok: true; flags: string[] }
  | { ok: false; error: string };

export function checkBounds(
  formData: Record<string, unknown>,
  fields: TaskField[],
): BoundsResult {
  const flags: string[] = [];

  for (const field of fields) {
    if (field.type !== "numeric_counter" && field.type !== "slider") continue;
    const raw = formData[field.field_id];
    if (raw === undefined || raw === null) continue;

    const value = Number(raw);
    if (isNaN(value)) continue;

    if (field.min !== undefined && value < field.min) {
      return { ok: false, error: `${field.field_id} below minimum ${field.min}` };
    }
    if (field.max !== undefined && value > field.max) {
      return { ok: false, error: `${field.field_id} above maximum ${field.max}` };
    }
    if (field.warn_below !== undefined && value < field.warn_below) {
      flags.push(`value_out_of_warn_range:${field.field_id}`);
    }
    if (field.warn_above !== undefined && value > field.warn_above) {
      flags.push(`value_out_of_warn_range:${field.field_id}`);
    }
  }

  return { ok: true, flags };
}
