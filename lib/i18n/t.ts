import type { I18nString } from "@/types/database";

export type Lang = "th" | "my" | "en";

/**
 * Resolve a localised string. Falls back to 'th', then any available language.
 * Pass a plain string to get it back unchanged.
 */
export function t(str: I18nString | string, lang: Lang = "th"): string {
  if (typeof str === "string") return str;
  return str[lang] || str.th || str.my || str.en || "";
}
