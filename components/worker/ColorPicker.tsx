"use client";

import type { TaskFieldOption } from "@/types/database";
import { t } from "@/lib/i18n/t";
import { useLang } from "@/lib/i18n/LanguageContext";

type Props = {
  options: TaskFieldOption[];
  value: string | null;
  onChange: (v: string) => void;
};

const colorRing: Record<string, string> = {
  red: "ring-red-400",
  blue: "ring-blue-400",
  yellow: "ring-yellow-400",
  white: "ring-slate-300",
};

const colorBg: Record<string, string> = {
  red: "bg-red-400",
  blue: "bg-blue-400",
  yellow: "bg-yellow-400",
  white: "bg-slate-100",
};

export function ColorPicker({ options, value, onChange }: Props) {
  const { lang } = useLang();
  return (
    <div className="flex gap-4">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex flex-col items-center gap-1.5 rounded-2xl p-3 transition ${
            value === opt.value
              ? `ring-4 ${colorRing[opt.value] ?? "ring-emerald-400"} bg-white shadow-sm`
              : "bg-slate-50"
          }`}
        >
          <div
            className={`h-10 w-10 rounded-full ${colorBg[opt.value] ?? "bg-slate-300"} ${
              opt.value === "white" ? "border border-slate-300" : ""
            }`}
          />
          <span className="text-xs font-medium text-slate-700">{opt.icon} {t(opt.label, lang)}</span>
        </button>
      ))}
    </div>
  );
}
