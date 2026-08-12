"use client";

import type { TaskFieldOption } from "@/types/database";
import { t } from "@/lib/i18n/t";
import { useLang } from "@/lib/i18n/LanguageContext";

type Props = {
  options: TaskFieldOption[];
  value: string | null;
  onChange: (v: string) => void;
};

// Ribbon colors are domain data (the physical ribbon on the tree), not UI
// semantics — hence the dedicated --color-ribbon-* tokens. They are always drawn
// as a round swatch so they can never be confused with a status badge.
const colorRing: Record<string, string> = {
  red: "ring-ribbon-red",
  blue: "ring-ribbon-blue",
  yellow: "ring-ribbon-yellow",
  white: "ring-line",
};

const colorBg: Record<string, string> = {
  red: "bg-ribbon-red",
  blue: "bg-ribbon-blue",
  yellow: "bg-ribbon-yellow",
  white: "bg-ribbon-white",
};

export function ColorPicker({ options, value, onChange }: Props) {
  const { lang } = useLang();
  return (
    <div className="flex gap-4">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex flex-col items-center gap-1.5 rounded-lg p-3 transition ${
            value === opt.value
              ? `ring-4 ${colorRing[opt.value] ?? "ring-primary"} bg-surface border border-line`
              : "bg-surface-alt"
          }`}
        >
          <div
            className={`h-10 w-10 rounded-full ${colorBg[opt.value] ?? "bg-surface-press"} ${
              opt.value === "white" ? "border border-line" : ""
            }`}
          />
          <span className="text-base font-semibold text-body">{opt.icon} {t(opt.label, lang)}</span>
        </button>
      ))}
    </div>
  );
}
