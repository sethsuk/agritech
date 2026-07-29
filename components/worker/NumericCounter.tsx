"use client";

import { useState } from "react";
import { t } from "@/lib/i18n/t";
import { useLang } from "@/lib/i18n/LanguageContext";
import { dict } from "@/lib/i18n/dictionary";

type Props = {
  value: number | null;
  min?: number;
  max?: number;
  default_value?: number;
  step?: number;
  onChange: (v: number) => void;
};

function decimalPlaces(step: number): number {
  const s = step.toString();
  const dot = s.indexOf(".");
  return dot === -1 ? 0 : s.length - dot - 1;
}

// Integer-based step arithmetic avoids floating-point drift (e.g. 7.9 + 0.1 = 7.999…)
function stepped(from: number, delta: number, step: number): number {
  const factor = Math.pow(10, decimalPlaces(step));
  return (Math.round(from * factor) + delta * Math.round(step * factor)) / factor;
}

export function NumericCounter({ value, min = 0, max = 9999, default_value, step = 1, onChange }: Props) {
  const { lang } = useLang();
  const initialValue = default_value !== undefined ? default_value : min;
  // draft holds the raw string while the user is mid-edit; null means "show parent value"
  const [draft, setDraft] = useState<string | null>(null);

  function decrement() {
    setDraft(null);
    if (value === null) return;
    const next = stepped(value, -1, step);
    if (next >= min) onChange(next);
  }

  // Tapping the placeholder just initialises the field at its resting value, so a
  // legitimate min reading (0 flowers, 0 kg) is still one tap away.
  function initialize() {
    setDraft(null);
    onChange(initialValue);
  }

  function increment() {
    setDraft(null);
    if (value === null) {
      // "+" means add one step — from an unset field that's the task's default if it
      // has one, otherwise one step above the floor. Tapping + should never leave the
      // counter sitting on min.
      onChange(default_value !== undefined ? default_value : Math.min(max, stepped(min, 1, step)));
      return;
    }
    const next = stepped(value, 1, step);
    if (next <= max) onChange(next);
  }

  function commitDraft() {
    if (draft === null) return;
    const n = parseFloat(draft);
    if (!isNaN(n) && n >= min && n <= max) onChange(stepped(n, 0, step));
    setDraft(null);
  }

  const displayValue = draft !== null ? draft : value !== null ? String(value) : "";

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={decrement}
        disabled={value === null || value <= min}
        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl font-bold text-slate-700 active:bg-slate-200 disabled:opacity-30"
      >
        −
      </button>

      {value === null && draft === null ? (
        <button
          type="button"
          onClick={initialize}
          className="h-14 w-28 rounded-2xl border-2 border-dashed border-slate-300 text-center text-sm text-slate-400"
        >
{t(dict.numericTapToSet, lang)}
        </button>
      ) : (
        <input
          type="number"
          value={displayValue}
          min={min}
          max={max}
          step={step}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          className="h-14 w-28 rounded-2xl border border-slate-200 text-center text-2xl font-bold text-slate-900 focus:border-emerald-500 focus:outline-none [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden"
        />
      )}

      <button
        type="button"
        onClick={increment}
        disabled={value !== null && value >= max}
        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-2xl font-bold text-emerald-700 active:bg-emerald-200 disabled:opacity-30"
      >
        +
      </button>
    </div>
  );
}
