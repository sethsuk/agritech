"use client";

import type { TaskFieldOption } from "@/types/database";
import { t } from "@/lib/i18n/t";

type Props = {
  options: TaskFieldOption[];
  value: string | null;
  onChange: (v: string) => void;
};

const severityColor: Record<string, string> = {
  none: "bg-emerald-50 ring-emerald-300 text-emerald-800",
  low: "bg-yellow-50 ring-yellow-300 text-yellow-800",
  moderate: "bg-orange-50 ring-orange-300 text-orange-800",
  severe: "bg-red-50 ring-red-400 text-red-800",
};

export function SeverityPicker({ options, value, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex flex-col items-center gap-2 rounded-2xl p-4 transition ${
            value === opt.value
              ? `ring-4 ${severityColor[opt.value] ?? "ring-emerald-300 bg-emerald-50 text-emerald-800"} shadow-sm`
              : "bg-slate-50 text-slate-700"
          }`}
        >
          <span className="text-3xl">{opt.icon}</span>
          <span className="text-sm font-medium">{t(opt.label)}</span>
        </button>
      ))}
    </div>
  );
}
