"use client";

import { useT } from "@/lib/i18n/LanguageContext";
import { useRadioGroup } from "@/lib/client/useRadioGroup";

/** Large Yes / No pair — a switch is too small and ambiguous for gloved, sunlit use. */
export function Toggle({ value, onChange, labelledBy }: { value: boolean; onChange: (v: boolean) => void; labelledBy?: string }) {
  const { tr } = useT();
  const radio = useRadioGroup([false, true], value, onChange);
  return (
    <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-labelledby={labelledBy}>
      {[false, true].map((v, i) => (
        <button
          key={String(v)}
          type="button"
          {...radio(i)}
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
