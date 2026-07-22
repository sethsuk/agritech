"use client";

import { useLang } from "@/lib/i18n/LanguageContext";
import { t } from "@/lib/i18n/t";
import { dict, type DictKey } from "@/lib/i18n/dictionary";

// Drop-in translated text node for use inside server components — language lives in
// localStorage (client-only), so server components can't read it directly. Only the
// leaf text becomes a client boundary; the surrounding page stays server-rendered.
export function T({ k }: { k: DictKey }) {
  const { lang } = useLang();
  return <>{t(dict[k], lang)}</>;
}
