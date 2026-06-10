"use client";

type Props = {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
};

export function NumericCounter({ value, min = 0, max = 9999, step = 1, onChange }: Props) {
  function decrement() {
    const next = value - step;
    if (next >= min) onChange(next);
  }
  function increment() {
    const next = value + step;
    if (next <= max) onChange(next);
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={decrement}
        disabled={value <= min}
        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl font-bold text-slate-700 active:bg-slate-200 disabled:opacity-30"
      >
        −
      </button>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          if (!isNaN(n) && n >= min && n <= max) onChange(n);
        }}
        className="h-14 w-28 rounded-2xl border border-slate-200 text-center text-2xl font-bold text-slate-900 focus:border-emerald-500 focus:outline-none"
      />
      <button
        type="button"
        onClick={increment}
        disabled={value >= max}
        className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-2xl font-bold text-emerald-700 active:bg-emerald-200 disabled:opacity-30"
      >
        +
      </button>
    </div>
  );
}
