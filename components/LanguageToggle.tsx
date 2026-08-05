"use client";

import { useLang } from "@/lib/i18n/LanguageContext";
import type { Lang } from "@/lib/i18n/t";

const LANGS: { code: Lang; label: string }[] = [
  { code: "th", label: "ไทย" },
  { code: "my", label: "မြန်မာ" },
  { code: "en", label: "EN" },
];

export function LanguageToggle({ className }: { className?: string }) {
  const { lang, setLang } = useLang();

  return (
    <div className={`flex gap-0.5 rounded-full bg-surface-alt p-1 ${className ?? ""}`}>
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => setLang(l.code)}
          // min-h-11 (44px) is the minimum comfortable touch target; relaxed on
          // desktop where a pointer is precise.
          className={`min-h-11 rounded-full px-3 text-xs font-semibold transition sm:min-h-0 sm:px-2.5 sm:py-1 ${
            lang === l.code ? "bg-surface text-primary-ink border border-line" : "text-muted"
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
