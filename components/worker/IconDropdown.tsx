"use client";

import type { TaskFieldOption } from "@/types/database";
import { t } from "@/lib/i18n/t";
import { useLang } from "@/lib/i18n/LanguageContext";
import { SelectedCheck } from "./SelectedCheck";
import { useRadioGroup } from "@/lib/client/useRadioGroup";

type Props = {
  options: TaskFieldOption[];
  value: string | null;
  onChange: (v: string) => void;
  labelledBy?: string;
};

export function IconDropdown({ options, value, onChange, labelledBy }: Props) {
  const { lang } = useLang();
  const radio = useRadioGroup(options.map((o) => o.value), value, onChange);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="radiogroup" aria-labelledby={labelledBy}>
      {options.map((opt, i) => (
        <button
          key={opt.value}
          type="button"
          {...radio(i)}
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
