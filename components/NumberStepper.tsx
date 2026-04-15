"use client";

type Props = {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  ariaLabel?: string;
};

export function NumberStepper({
  value,
  onChange,
  min = 0,
  max = 9999,
  step = 1,
  ariaLabel,
}: Props) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  return (
    <div className="flex items-stretch overflow-hidden rounded-xl border-2 border-slate-300 bg-white">
      <button
        type="button"
        onClick={() => onChange(clamp(value - step))}
        className="flex h-14 w-14 items-center justify-center text-2xl font-bold text-slate-700 active:bg-slate-100"
        aria-label={`ลด ${ariaLabel ?? ""}`.trim()}
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(clamp(Number(e.target.value) || 0))}
        className="h-14 flex-1 border-x-2 border-slate-200 text-center text-2xl font-semibold text-slate-900 focus:outline-none"
        aria-label={ariaLabel}
      />
      <button
        type="button"
        onClick={() => onChange(clamp(value + step))}
        className="flex h-14 w-14 items-center justify-center text-2xl font-bold text-slate-700 active:bg-slate-100"
        aria-label={`เพิ่ม ${ariaLabel ?? ""}`.trim()}
      >
        +
      </button>
    </div>
  );
}
