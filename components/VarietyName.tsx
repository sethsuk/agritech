"use client";

import { useLang } from "@/lib/i18n/LanguageContext";
import { varietyName } from "@/lib/i18n/varieties";

// Translated cultivar name for use inside server components — the selected language
// lives in localStorage, which the server can't read. Same pattern as <T>.
export function VarietyName({ variety }: { variety: string }) {
  const { lang } = useLang();
  return <>{varietyName(variety, lang)}</>;
}
