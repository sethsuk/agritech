"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Lang } from "./t";
import type { DictKey } from "./dictionary";
import { tr as translate } from "./labels";

const STORAGE_KEY = "app_lang";
const DEFAULT_LANG: Lang = "th";

interface LanguageContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: DEFAULT_LANG,
  setLang: () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "th" || stored === "my" || stored === "en") setLangState(stored);
    } catch { /* storage blocked — stay on the default */ }
  }, []);

  // Keep <html lang> in step, so screen readers and fonts pick the right script.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  function setLang(l: Lang) {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* ignore */ }
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

/** Whether the person has explicitly chosen a language on this device. */
export function hasStoredLang(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) !== null; } catch { return false; }
}

export function useLang() {
  return useContext(LanguageContext);
}

/**
 * `const { lang, tr } = useT();` — the language plus a bound dictionary lookup with
 * interpolation (`tr("setRemaining", { n: 3 })`). Replaces the `tr` helper that every
 * page used to redefine for itself.
 */
export function useT() {
  const { lang } = useContext(LanguageContext);
  return {
    lang,
    tr: (key: DictKey, vars?: Record<string, string | number>) => translate(key, lang, vars),
  };
}
