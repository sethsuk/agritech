"use client";

import { t, type Lang } from "@/lib/i18n/t";
import { useLang } from "@/lib/i18n/LanguageContext";
import { dict } from "@/lib/i18n/dictionary";
import type { TaskField } from "@/types/database";
import { NumericCounter } from "./NumericCounter";
import { ColorPicker } from "./ColorPicker";
import { SeverityPicker } from "./SeverityPicker";
import { IconDropdown } from "./IconDropdown";
import { GradeCounter } from "./GradeCounter";

type Props = {
  fields: TaskField[];
  formData: Record<string, unknown>;
  onChange: (fieldId: string, value: unknown) => void;
};

function FieldWrapper({ field, lang, children }: { field: TaskField; lang: Lang; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <span>{field.label_icon}</span>
        <span>{t(field.label, lang)}</span>
        {field.required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}

export function TaskFormRenderer({ fields, formData, onChange }: Props) {
  const { lang } = useLang();

  return (
    <div className="space-y-4">
      {fields.map((field) => {
        const rawValue = formData[field.field_id];

        if (field.type === "numeric_counter" || field.type === "slider") {
          const numValue = typeof rawValue === "number" ? rawValue : null;
          return (
            <FieldWrapper key={field.field_id} field={field} lang={lang}>
              <NumericCounter
                value={numValue}
                min={field.min}
                max={field.max}
                default_value={field.default_value}
                step={field.step}
                onChange={(v) => onChange(field.field_id, v)}
              />
              {field.warn_below !== undefined && numValue !== null && numValue < field.warn_below && (
                <p className="mt-2 text-xs text-amber-600">
                  ⚠️ {t(dict.warnBelow, lang)} ({field.warn_below})
                </p>
              )}
              {field.warn_above !== undefined && numValue !== null && numValue > field.warn_above && (
                <p className="mt-2 text-xs text-amber-600">
                  ⚠️ {t(dict.warnAbove, lang)} ({field.warn_above})
                </p>
              )}
            </FieldWrapper>
          );
        }

        if (field.type === "color_picker") {
          const strValue = typeof rawValue === "string" ? rawValue : null;
          return (
            <FieldWrapper key={field.field_id} field={field} lang={lang}>
              <ColorPicker
                options={field.options ?? []}
                value={strValue}
                onChange={(v) => onChange(field.field_id, v)}
              />
            </FieldWrapper>
          );
        }

        if (field.type === "severity_picker") {
          const strValue = typeof rawValue === "string" ? rawValue : null;
          return (
            <FieldWrapper key={field.field_id} field={field} lang={lang}>
              <SeverityPicker
                options={field.options ?? []}
                value={strValue}
                onChange={(v) => onChange(field.field_id, v)}
              />
            </FieldWrapper>
          );
        }

        if (field.type === "dropdown") {
          const strValue = typeof rawValue === "string" ? rawValue : null;
          return (
            <FieldWrapper key={field.field_id} field={field} lang={lang}>
              <IconDropdown
                options={field.options ?? []}
                value={strValue}
                onChange={(v) => onChange(field.field_id, v)}
              />
            </FieldWrapper>
          );
        }

        if (field.type === "grade_counter") {
          const objValue = rawValue && typeof rawValue === "object" ? rawValue as Record<string, number> : null;
          return (
            <FieldWrapper key={field.field_id} field={field} lang={lang}>
              <GradeCounter
                options={field.options ?? []}
                value={objValue}
                min={field.min}
                max={field.max}
                step={field.step}
                onChange={(v) => onChange(field.field_id, v)}
              />
            </FieldWrapper>
          );
        }

        return null;
      })}
    </div>
  );
}
