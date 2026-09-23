import type { I18nString } from "@/types/database";

export type Lang = "th" | "my" | "en";

/**
 * Resolve a localised string. Falls back to 'th', then any available language.
 * Pass a plain string to get it back unchanged.
 *
 * Used for translated content that lives *inside* a JSONB document — task field
 * labels and option labels within `task_definitions.fields`. Table columns with a
 * fixed shape use per-language columns instead (see taskDisplayName below).
 */
export function t(str: I18nString | string, lang: Lang = "th"): string {
  if (typeof str === "string") return str;
  return str[lang] || str.th || str.my || str.en || "";
}

/**
 * Resolve a task definition's display name from its per-language columns.
 * Falls back to Thai, matching t()'s behaviour.
 */
export function taskDisplayName(
  def: { display_name_th: string; display_name_my: string; display_name_en: string },
  lang: Lang = "th",
): string {
  const byLang = { th: def.display_name_th, my: def.display_name_my, en: def.display_name_en };
  return byLang[lang] || def.display_name_th || "";
}
