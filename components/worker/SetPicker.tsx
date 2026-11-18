"use client";

import { useT } from "@/lib/i18n/LanguageContext";
import { colorName } from "@/lib/i18n/labels";
import { formatDate } from "@/lib/time";
import type { SetState } from "@/types/database";

const swatch: Record<string, string> = {
  red: "bg-ribbon-red",
  blue: "bg-ribbon-blue",
  yellow: "bg-ribbon-yellow",
  white: "bg-ribbon-white",
};

/**
 * Pick which of the tree's OPEN sets a harvest / fruit count belongs to. Each option
 * shows the ribbon colour, bloom date and fruit remaining, so the worker matches the
 * physical ribbon instead of recalling it. Only sets that exist can be chosen — this is
 * what keeps every harvest a subset of a logged bloom.
 */
export function SetPicker({
  sets, value, onChange,
}: { sets: SetState[]; value: string | null; onChange: (setId: string) => void }) {
  const { lang, tr } = useT();

  if (sets.length === 0) {
    return <p className="rounded-lg bg-caution-tint p-3 text-base font-semibold text-caution-ink">{tr("setPickerEmpty")}</p>;
  }

  return (
    <div className="space-y-2" role="radiogroup">
      {sets.map((s) => {
        const selected = value === s.set_id;
        return (
          <button
            key={s.set_id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(s.set_id)}
            className={`flex min-h-15 w-full items-center gap-3 rounded-lg border-2 px-4 py-3 text-left ${
              selected ? "border-primary bg-primary-tint" : "border-line bg-surface-alt"
            }`}
          >
            <span aria-hidden className={`h-8 w-8 flex-shrink-0 rounded-full border border-line ${swatch[s.color] ?? "bg-ribbon-white"}`} />
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-semibold text-ink">{colorName(s.color, lang)}</span>
              <span className="block text-sm text-muted">{tr("setBloomedOn", { date: formatDate(s.bloom_date, lang) })}</span>
            </span>
            <span className="text-right text-base font-bold text-body">{tr("setRemaining", { n: Math.max(s.remaining, 0) })}</span>
            {selected && <span aria-hidden className="text-xl font-bold text-primary-ink">✓</span>}
          </button>
        );
      })}
    </div>
  );
}
