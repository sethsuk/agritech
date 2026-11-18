import type { TaskField } from "@/types/database";
import type { Rejection } from "./rejection";

export type FieldsResult = { ok: true } | { ok: false; rejection: Rejection };

/**
 * A value counts as "not filled in" if it's absent, blank, or a grade tally with no
 * fruit at all (`{}` or all zeros).
 *
 * Shared by the task form (to enable submit and point at the field) and the server, so
 * the browser and the API can't disagree about what "required" means.
 */
export function isMissing(field: TaskField, raw: unknown): boolean {
  if (raw === undefined || raw === null || raw === "") return true;
  if (field.type === "grade_counter") {
    if (typeof raw !== "object") return true;
    return !Object.values(raw as Record<string, unknown>).some((v) => Number(v) > 0);
  }
  return false;
}

const OPTION_FIELD_TYPES = ["dropdown", "color_picker", "severity_picker"];

/** The first required field the worker hasn't filled in, or null if the form is complete. */
export function firstMissingRequiredField(
  formData: Record<string, unknown>,
  fields: TaskField[],
): TaskField | null {
  for (const field of fields) {
    if (field.required && isMissing(field, formData[field.field_id])) return field;
  }
  return null;
}

/**
 * Layer 3 — submitted values match the task definition: required fields present, option
 * values from the declared list, grade keys known, toggles boolean. The API is reachable
 * directly, so the browser's checks aren't enough on their own.
 *
 * set_picker values are only shape-checked here; whether the set exists, belongs to this
 * tree and is open is enforced in the submit_task_log RPC (domain integrity).
 */
export function checkFields(formData: Record<string, unknown>, fields: TaskField[]): FieldsResult {
  for (const field of fields) {
    const raw = formData[field.field_id];
    const fail = (code: Rejection["code"], option?: string): FieldsResult =>
      ({ ok: false, rejection: { code, field: field.field_id, option } });

    if (isMissing(field, raw)) {
      if (field.required) return fail("field_required");
      continue;
    }

    if (OPTION_FIELD_TYPES.includes(field.type)) {
      const allowed = (field.options ?? []).map((o) => o.value);
      if (allowed.length > 0 && !allowed.includes(String(raw))) return fail("field_invalid_option");
    }

    if (field.type === "grade_counter") {
      const allowed = (field.options ?? []).map((o) => o.value);
      for (const key of Object.keys(raw as Record<string, unknown>)) {
        if (allowed.length > 0 && !allowed.includes(key)) return fail("field_invalid_option", key);
      }
    }

    if (field.type === "toggle" && typeof raw !== "boolean") return fail("field_invalid_option");
    if (field.type === "set_picker" && typeof raw !== "string") return fail("field_invalid_option");
  }

  return { ok: true };
}
