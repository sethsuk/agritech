"use client";

import type { TaskFieldOption } from "@/types/database";
import { t } from "@/lib/i18n/t";
import { useLang } from "@/lib/i18n/LanguageContext";

type Props = {
  options: TaskFieldOption[];
  value: string | null;
  onChange: (v: string) => void;
};

// Severity escalates through the semantic palette: safe → caution → warning tint
// → solid warning. Intensity, not hue, carries the ranking.
const severityColor: Record<string, string> = {
  none: "bg-primary-tint ring-primary text-primary-ink",
  mild: "bg-caution-tint ring-caution text-caution-ink",
  low: "bg-caution-tint ring-caution text-caution-ink",
  moderate: "bg-warning-tint ring-warning text-warning-ink",
  severe: "bg-warning ring-warning-press text-white",
};

export function SeverityPicker({ options, value, onChange }: Props) {
  const { lang } = useLang();
  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex flex-col items-center gap-2 rounded-lg p-4 transition ${
            value === opt.value
              ? `ring-4 ${severityColor[opt.value] ?? "ring-primary bg-primary-tint text-primary-ink"} border border-line`
              : "bg-surface-alt text-body"
          }`}
        >
          <span className="text-3xl">{opt.icon}</span>
          <span className="text-lg font-semibold">{t(opt.label, lang)}</span>
        </button>
      ))}
    </div>
  );
}
