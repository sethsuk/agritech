"use client";

import type { TaskFieldOption } from "@/types/database";
import { t } from "@/lib/i18n/t";
import { useLang } from "@/lib/i18n/LanguageContext";
import { SelectedCheck } from "./SelectedCheck";

type Props = {
  options: TaskFieldOption[];
  value: string | null;
  onChange: (v: string) => void;
};

export function IconDropdown({ options, value, onChange }: Props) {
  const { lang } = useLang();
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="radiogroup">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={`relative flex min-h-15 items-center gap-3 rounded-lg px-4 py-3 pr-9 text-left transition ${
            value === opt.value
              ? "bg-primary-tint ring-2 ring-primary text-primary-ink"
              : "bg-surface-alt text-body active:bg-surface-alt"
          }`}
        >
          {value === opt.value && <SelectedCheck />}
          <span aria-hidden className="text-xl">{opt.icon}</span>
          <span className="text-lg font-semibold">{t(opt.label, lang)}</span>
        </button>
      ))}
    </div>
  );
}
