"use client";

import { useState } from "react";
import type { TaskFieldOption } from "@/types/database";
import { t } from "@/lib/i18n/t";
import { useLang } from "@/lib/i18n/LanguageContext";
import { dict } from "@/lib/i18n/dictionary";

type Props = {
  options: TaskFieldOption[];
  value: Record<string, number> | null;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: Record<string, number>) => void;
};

// Per-grade fruit tally — total harvested count is derived by summing the grades,
// there's no separate total to reconcile against.
export function GradeCounter({ options, value, min = 0, max = 200, step = 1, onChange }: Props) {
  const { lang } = useLang();
  const counts = value ?? {};
  const total = options.reduce((sum, opt) => sum + (counts[opt.value] ?? 0), 0);
  // Per-grade raw draft string while a field is mid-edit; absent means "show the count".
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  function setCount(gradeValue: string, next: number) {
    onChange({ ...counts, [gradeValue]: next });
  }

  function commitDraft(gradeValue: string) {
    const draft = drafts[gradeValue];
    if (draft === undefined) return;
    const n = parseInt(draft, 10);
    // Blank or non-numeric input reverts to the current count; otherwise clamp to bounds.
    if (!isNaN(n)) setCount(gradeValue, Math.min(max, Math.max(min, n)));
    setDrafts((d) => {
      const next = { ...d };
      delete next[gradeValue];
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {options.map((opt) => {
        const count = counts[opt.value] ?? 0;
        const displayValue = opt.value in drafts ? drafts[opt.value] : String(count);
        return (
          <div key={opt.value} className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <span className="text-lg">{opt.icon}</span>
              {t(opt.label, lang)}
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCount(opt.value, Math.max(min, count - step))}
                disabled={count <= min}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-lg font-bold text-slate-700 active:bg-slate-200 disabled:opacity-30"
              >
                −
              </button>
              <input
                type="number"
                inputMode="numeric"
                value={displayValue}
                min={min}
                max={max}
                onChange={(e) => setDrafts((d) => ({ ...d, [opt.value]: e.target.value }))}
                onFocus={(e) => e.target.select()}
                onBlur={() => commitDraft(opt.value)}
                className="h-10 w-14 rounded-xl border border-slate-200 text-center text-lg font-bold text-slate-900 focus:border-emerald-500 focus:outline-none [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden"
              />
              <button
                type="button"
                onClick={() => setCount(opt.value, Math.min(max, count + step))}
                disabled={count >= max}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-lg font-bold text-emerald-700 active:bg-emerald-200 disabled:opacity-30"
              >
                +
              </button>
            </div>
          </div>
        );
      })}

      <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-sm font-semibold text-slate-600">
        <span>{t(dict.totalFruitCount, lang)}</span>
        <span>{total} {t(dict.fruitCountUnit, lang)}</span>
      </div>
    </div>
  );
}
