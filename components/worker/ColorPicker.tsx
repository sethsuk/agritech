"use client";

import type { TaskFieldOption } from "@/types/database";
import { t } from "@/lib/i18n/t";
import { useLang } from "@/lib/i18n/LanguageContext";

type Props = {
  options: TaskFieldOption[];
  value: string | null;
  onChange: (v: string) => void;
  /** Options that can't be picked right now (e.g. a ribbon colour already on an open set). */
  disabledValues?: string[];
  disabledNote?: string;
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

export function ColorPicker({ options, value, onChange, disabledValues = [], disabledNote }: Props) {
  const { lang } = useLang();
  return (
    // Grid, not a single flex row: four swatches overflowed 320–360px phones.
    <div className="grid grid-cols-2 gap-3 min-[400px]:grid-cols-4" role="radiogroup">
      {options.map((opt) => {
        const selected = value === opt.value;
        const disabled = disabledValues.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`relative flex min-h-15 flex-col items-center gap-1.5 rounded-lg p-3 transition disabled:opacity-40 ${
              selected
                ? `ring-4 ${colorRing[opt.value] ?? "ring-primary"} border border-line bg-surface`
                : "bg-surface-alt"
            }`}
          >
            {/* A ✓ as well as the ring: colour alone is unreadable in direct sun. */}
            {selected && (
              <span aria-hidden className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">✓</span>
            )}
            <div
              className={`h-10 w-10 rounded-full ${colorBg[opt.value] ?? "bg-surface-press"} ${
                opt.value === "white" ? "border border-line" : ""
              }`}
            />
            <span className="text-base font-semibold text-body">{t(opt.label, lang)}</span>
            {disabled && disabledNote && <span className="text-xs text-muted">({disabledNote})</span>}
          </button>
        );
      })}
    </div>
  );
}
