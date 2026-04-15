"use client";

type Props = {
  options: readonly string[];
  selected: string[];
  onChange: (next: string[]) => void;
};

export function IssueChips({ options, selected, onChange }: Props) {
  const set = new Set(selected);

  function toggle(opt: string) {
    if (set.has(opt)) {
      onChange(selected.filter((s) => s !== opt));
    } else {
      onChange([...selected, opt]);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const isOn = set.has(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={[
              "min-h-12 rounded-full border-2 px-4 text-sm font-medium transition active:scale-[0.98]",
              isOn
                ? "border-red-600 bg-red-50 text-red-700"
                : "border-slate-300 bg-white text-slate-700",
            ].join(" ")}
          >
            {isOn ? "✓ " : ""}
            {opt}
          </button>
        );
      })}
    </div>
  );
}
