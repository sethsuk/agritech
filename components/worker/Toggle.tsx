"use client";

import { useT } from "@/lib/i18n/LanguageContext";

/** Large Yes / No pair — a switch is too small and ambiguous for gloved, sunlit use. */
export function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const { tr } = useT();
  return (
    <div className="grid grid-cols-2 gap-3" role="radiogroup">
      {[false, true].map((v) => (
        <button
          key={String(v)}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={`min-h-15 rounded-lg border-2 text-lg font-semibold ${
            value === v ? "border-primary bg-primary-tint text-primary-ink" : "border-line bg-surface-alt text-body"
          }`}
        >
          {value === v && "✓ "}{tr(v ? "yesLabel" : "noLabel")}
        </button>
      ))}
    </div>
  );
}
