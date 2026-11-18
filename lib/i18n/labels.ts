/**
 * Human labels for machine codes — the only place a code becomes display text.
 *
 * Raw codes (`gps_off_tree`, `fruit_check`, `harvest_exceeds_set`, API error codes) used
 * to leak straight into the Thai UI, sometimes with `.replace(/_/g, " ")` as the only
 * "translation". Every code shown to a person goes through one of these helpers.
 */
import { dict, type DictKey } from "./dictionary";
import { t, taskDisplayName, type Lang } from "./t";
import type { DbTaskDefinition, TaskField } from "@/types/database";
import type { Rejection } from "@/lib/validation/rejection";

/** "{n} left" + {n: 3} → "3 left". Unknown placeholders are left as-is. */
export function fmt(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

/** Dictionary lookup with interpolation. */
export function tr(key: DictKey, lang: Lang, vars?: Record<string, string | number>): string {
  return fmt(t(dict[key], lang), vars);
}

function lookup(prefix: string, code: string, lang: Lang): string | null {
  const key = `${prefix}${code}` as DictKey;
  return key in dict ? t(dict[key], lang) : null;
}

/** Natural workflow order for task buttons: routine care first, then the set lifecycle. */
export const TASK_ORDER = [
  "watering", "fertilizer", "pest_inspection", "soil_check", "bloom_log", "fruit_check", "harvest",
];
export function sortTaskDefs<T extends { task_type: string }>(defs: T[]): T[] {
  const rank = (t: string) => { const i = TASK_ORDER.indexOf(t); return i === -1 ? 99 : i; };
  return [...defs].sort((a, b) => rank(a.task_type) - rank(b.task_type));
}

/** Task name for a log row: uses the definition when available, never the raw code. */
export function taskLabel(
  taskDefId: string,
  defs: Pick<DbTaskDefinition, "task_def_id" | "display_name_th" | "display_name_my" | "display_name_en">[] | undefined,
  lang: Lang,
): string {
  const def = defs?.find((d) => d.task_def_id === taskDefId);
  return def ? taskDisplayName(def, lang) : "—";
}

/** A validation flag like `gps_off_tree` or `value_out_of_warn_range:amount_kg`. */
export function flagLabel(flag: string, lang: Lang): string {
  const code = flag.split(":")[0];
  return lookup("flag_", code, lang) ?? code;
}

/** Alert subtype: pest alerts have their own strings; fraud/compliance reuse flag labels. */
export function alertSubtypeLabel(subtype: string, lang: Lang): string {
  return lookup("alert_", subtype, lang) ?? lookup("flag_", subtype, lang) ?? subtype;
}

export function validationStatusLabel(status: string, lang: Lang): string {
  if (status === "flagged") return t(dict.validationFlagged, lang);
  if (status === "passed") return t(dict.validationPassed, lang);
  return status;
}

/** API error code (+ details) → message. Falls back to a generic error, never the code. */
export function errorMessage(
  body: { error?: unknown; [k: string]: unknown } | null | undefined,
  lang: Lang,
  ctx: { fields?: TaskField[] } = {},
): string {
  const code = typeof body?.error === "string" ? body.error : "server_error";

  if (code === "submission_rejected" && body) {
    return rejectionMessage(body as unknown as Rejection, ctx.fields ?? [], lang);
  }
  const key = `err_${code}` as DictKey;
  if (!(key in dict)) return t(dict.err_server_error, lang);

  const vars: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(body ?? {})) {
    if (typeof v === "string" || typeof v === "number") vars[k] = v;
  }
  if (typeof body?.color === "string") vars.color = colorName(body.color, lang);
  return fmt(t(dict[key], lang), vars);
}

/** A hard rejection, naming the field in the worker's language. */
export function rejectionMessage(rejection: Rejection, fields: TaskField[], lang: Lang): string {
  const field = fields.find((f) => f.field_id === rejection.field);
  let name = field ? t(field.label, lang) : rejection.field;
  if (rejection.option && field?.options) {
    const opt = field.options.find((o) => o.value === rejection.option);
    if (opt) name = `${name} — ${t(opt.label, lang)}`;
  }
  const key = `rej_${rejection.code}` as DictKey;
  return key in dict
    ? fmt(t(dict[key], lang), { field: name, limit: rejection.limit ?? "" })
    : t(dict.err_bad_request, lang);
}

const COLOR_NAMES: Record<string, { th: string; my: string; en: string }> = {
  red: { th: "แดง", my: "အနီ", en: "red" },
  blue: { th: "น้ำเงิน", my: "အပြာ", en: "blue" },
  yellow: { th: "เหลือง", my: "အဝါ", en: "yellow" },
  white: { th: "ขาว", my: "အဖြူ", en: "white" },
};
export const COLOR_ICON: Record<string, string> = { red: "🔴", blue: "🔵", yellow: "🟡", white: "⚪" };

export function colorName(color: string, lang: Lang): string {
  return COLOR_NAMES[color]?.[lang] ?? color;
}

/** A form_data value as display text, through the field's own labels. */
export function formValueLabel(field: TaskField, value: unknown, lang: Lang): string {
  if (value === undefined || value === null || value === "") return "—";
  if (field.type === "toggle") return t(value ? dict.yesLabel : dict.noLabel, lang);
  if (field.options && typeof value !== "object") {
    const opt = field.options.find((o) => o.value === String(value));
    if (opt) return `${opt.icon} ${t(opt.label, lang)}`;
  }
  if (field.type === "grade_counter" && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, n]) => Number(n) > 0)
      .map(([g, n]) => {
        const opt = field.options?.find((o) => o.value === g);
        return `${opt ? t(opt.label, lang) : g}: ${n}`;
      })
      .join(" · ") || "0";
  }
  return String(value);
}
