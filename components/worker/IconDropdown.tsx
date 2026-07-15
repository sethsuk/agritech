"use client";

import type { TaskFieldOption } from "@/types/database";
import { t } from "@/lib/i18n/t";
import { useLang } from "@/lib/i18n/LanguageContext";

type Props = {
  options: TaskFieldOption[];
  value: string | null;
  onChange: (v: string) => void;
};

export function IconDropdown({ options, value, onChange }: Props) {
  const { lang } = useLang();
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition ${
            value === opt.value
              ? "bg-emerald-50 ring-2 ring-emerald-400 text-emerald-900"
              : "bg-slate-50 text-slate-700 active:bg-slate-100"
          }`}
        >
          <span className="text-xl">{opt.icon}</span>
          <span className="text-sm font-medium">{t(opt.label, lang)}</span>
        </button>
      ))}
    </div>
  );
}
