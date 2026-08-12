import type { TaskField } from "@/types/database";

export type FieldsResult = { ok: true } | { ok: false; error: string };

/** A value counts as "not filled in" if it's absent, blank, or an empty grade tally. */
function isMissing(field: TaskField, raw: unknown): boolean {
  if (raw === undefined || raw === null || raw === "") return true;
  if (field.type === "grade_counter") {
    return typeof raw !== "object" || Object.keys(raw as object).length === 0;
  }
  return false;
}

const OPTION_FIELD_TYPES = ["dropdown", "color_picker", "severity_picker"];

/**
 * Layer 3 — submitted values actually match the task definition.
 *
 * The browser checks required fields before enabling submit, but the API is reachable
 * directly: without this, POST /api/submit-log with `formData: {}` saved a completed
 * task log containing no data at all. Option-backed fields are also checked against
 * their declared values so a hand-crafted request can't store an unknown severity or
 * ribbon colour that later side-effects branch on.
 */
export function checkFields(
  formData: Record<string, unknown>,
  fields: TaskField[],
): FieldsResult {
  for (const field of fields) {
    const raw = formData[field.field_id];

    if (isMissing(field, raw)) {
      if (field.required) {
        return { ok: false, error: `${field.field_id} is required` };
      }
      continue;
    }

    if (OPTION_FIELD_TYPES.includes(field.type)) {
      const allowed = (field.options ?? []).map((o) => o.value);
      if (allowed.length > 0 && !allowed.includes(String(raw))) {
        return { ok: false, error: `${field.field_id} is not one of the allowed values` };
      }
    }

    if (field.type === "grade_counter") {
      const allowed = (field.options ?? []).map((o) => o.value);
      for (const key of Object.keys(raw as Record<string, unknown>)) {
        if (allowed.length > 0 && !allowed.includes(key)) {
          return { ok: false, error: `${field.field_id}.${key} is not a known grade` };
        }
      }
    }
  }

  return { ok: true };
}
