"use client";

type Props = {
  value: number | null;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
};

function decimalPlaces(step: number): number {
  const s = step.toString();
  const dot = s.indexOf(".");
  return dot === -1 ? 0 : s.length - dot - 1;
}

function rounded(val: number, step: number): number {
  return parseFloat(val.toFixed(decimalPlaces(step)));
}

export function NumericCounter({ value, min = 0, max = 9999, step = 1, onChange }: Props) {
  function decrement() {
    if (value === null) return;
    const next = rounded(value - step, step);
    if (next >= min) onChange(next);
  }

  function increment() {
    if (value === null) {
      // first tap: land on min
      onChange(min);
      return;
    }
    const next = rounded(value + step, step);
    if (next <= max) onChange(next);
  }

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

      {value === null ? (
        <button
          type="button"
          onClick={increment}
          className="h-14 w-28 rounded-2xl border-2 border-dashed border-slate-300 text-center text-sm text-slate-400"
        >
          แตะเพื่อตั้งค่า
        </button>
      ) : (
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const n = parseFloat(e.target.value);
            if (!isNaN(n) && n >= min && n <= max) onChange(rounded(n, step));
          }}
          className="h-14 w-28 rounded-2xl border border-slate-200 text-center text-2xl font-bold text-slate-900 focus:border-emerald-500 focus:outline-none"
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
