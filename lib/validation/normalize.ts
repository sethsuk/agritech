import type { TaskField } from "@/types/database";

/**
 * Coerce numeric form values to JSON numbers before validation and storage.
 *
 * A crafted request could send "5.0" or " 5": the JS bounds check accepts it, but the SQL
 * views read counts with `~ '^\d+$'`, so a flower count like that became NULL and the
 * next sync closed the set as if its bloom had been voided. After this, values are either
 * real numbers or left as-is (and then rejected by checkBounds as not-a-number).
 */
export function normalizeFormData(form: Record<string, unknown>, fields: TaskField[]): Record<string, unknown> {
  const out: Record<string, unknown> = { ...form };
  const num = (v: unknown) => {
    if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
    return v;
  };
  for (const f of fields) {
    const v = out[f.field_id];
    if (v === undefined || v === null) continue;
    if (f.type === "numeric_counter" || f.type === "slider") out[f.field_id] = num(v);
    if (f.type === "grade_counter" && typeof v === "object") {
      out[f.field_id] = Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, n]) => [k, num(n)]));
    }
  }
  return out;
}
