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
    <div className={`flex gap-0.5 rounded-full bg-slate-100 p-1 ${className ?? ""}`}>
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => setLang(l.code)}
          className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
            lang === l.code ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500"
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
