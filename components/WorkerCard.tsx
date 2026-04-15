"use client";

type Props = {
  name: string;
  selected: boolean;
  onSelect: () => void;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? "";
  return (first + second) || "?";
}

const COLORS = ["bg-emerald-500", "bg-amber-500", "bg-sky-500", "bg-rose-500", "bg-violet-500"];

export function WorkerCard({ name, selected, onSelect }: Props) {
  // Stable color per name based on a simple hash.
  const colorIdx =
    [...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % COLORS.length;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition",
        "min-h-20 active:scale-[0.98]",
        selected
          ? "border-emerald-600 bg-emerald-50 ring-4 ring-emerald-200"
          : "border-slate-200 bg-white hover:border-slate-300",
      ].join(" ")}
    >
      <div
        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${COLORS[colorIdx]} text-xl font-bold text-white`}
      >
        {initials(name)}
      </div>
      <div className="flex-1">
        <div className="text-lg font-semibold text-slate-900">{name}</div>
      </div>
      {selected && (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white">
          ✓
        </div>
      )}
    </button>
  );
}
