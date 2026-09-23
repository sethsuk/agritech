"use client";

import { useLang } from "@/lib/i18n/LanguageContext";
import type { Lang } from "@/lib/i18n/t";

const LANGS: { code: Lang; label: string }[] = [
  { code: "th", label: "ไทย" },
  { code: "my", label: "မြန်မာ" },
  { code: "en", label: "EN" },
];

type Props = {
  className?: string;
  /**
   * "worker" uses the 60px field target — gloved, outdoor, low-vision use.
   * "default" uses the 44px minimum, for the manager chrome where a worker who
   * cannot read the current language is not the scenario being designed for.
   */
  size?: "default" | "worker";
};

export function LanguageToggle({ className, size = "default" }: Props) {
  const { lang, setLang } = useLang();

  // Desktop relaxes both — a pointer is precise, and the manager header is dense.
  const sizing =
    size === "worker"
      ? "min-h-15 px-4 text-base sm:min-h-0 sm:px-2.5 sm:py-1 sm:text-xs"
      : "min-h-11 px-3 text-xs sm:min-h-0 sm:px-2.5 sm:py-1";

  return (
    <div className={`flex gap-0.5 rounded-full bg-surface-alt p-1 ${className ?? ""}`}>
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => setLang(l.code)}
          className={`rounded-full font-semibold transition ${sizing} ${
            lang === l.code ? "border border-line bg-surface text-primary-ink" : "text-muted"
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
