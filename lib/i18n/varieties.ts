import type { I18nString } from "@/types/database";
import { t, type Lang } from "./t";

/**
 * Durian cultivar names.
 *
 * `trees.variety` stores the romanized name as the canonical value — these entries are
 * display transliterations only. The stored value must NEVER change with the UI
 * language, or the same cultivar would be recorded as "หมอนทอง" by a Thai-speaking
 * manager and "Monthong" by an English-speaking one.
 *
 * Managers can also type a free-text variety via the "other" option; unknown values
 * render as-is.
 */
export const KNOWN_VARIETIES: string[] = ["Monthong", "Chanee", "Puangmanee"];

const VARIETY_NAMES: Record<string, I18nString> = {
  Monthong: { th: "หมอนทอง", my: "မွန်းသောင်း", en: "Monthong" },
  Chanee: { th: "ชะนี", my: "ချာနီ", en: "Chanee" },
  Puangmanee: { th: "พวงมณี", my: "ပွမ်မဏီ", en: "Puangmanee" },
};

/** Display name for a stored variety. Custom/unknown varieties render unchanged. */
export function varietyName(variety: string, lang: Lang = "th"): string {
  const known = VARIETY_NAMES[variety];
  return known ? t(known, lang) : variety;
}
