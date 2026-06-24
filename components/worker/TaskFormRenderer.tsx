"use client";

import { t } from "@/lib/i18n/t";
import type { TaskField } from "@/types/database";
import { NumericCounter } from "./NumericCounter";
import { ColorPicker } from "./ColorPicker";
import { SeverityPicker } from "./SeverityPicker";
import { IconDropdown } from "./IconDropdown";

type Props = {
  fields: TaskField[];
  formData: Record<string, unknown>;
  onChange: (fieldId: string, value: unknown) => void;
};

function FieldWrapper({ field, children }: { field: TaskField; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <span>{field.label_icon}</span>
        <span>{t(field.label)}</span>
        {field.required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}

export function TaskFormRenderer({ fields, formData, onChange }: Props) {
  return (
    <div className="space-y-4">
      {fields.map((field) => {
        const rawValue = formData[field.field_id];

        if (field.type === "numeric_counter" || field.type === "slider") {
          const numValue = typeof rawValue === "number" ? rawValue : null;
          return (
            <FieldWrapper key={field.field_id} field={field}>
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
                  ⚠️ ค่าต่ำกว่าเกณฑ์ปกติ ({field.warn_below})
                </p>
              )}
              {field.warn_above !== undefined && numValue !== null && numValue > field.warn_above && (
                <p className="mt-2 text-xs text-amber-600">
                  ⚠️ ค่าสูงกว่าเกณฑ์ปกติ ({field.warn_above})
                </p>
              )}
            </FieldWrapper>
          );
        }

        if (field.type === "color_picker") {
          const strValue = typeof rawValue === "string" ? rawValue : null;
          return (
            <FieldWrapper key={field.field_id} field={field}>
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
            <FieldWrapper key={field.field_id} field={field}>
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
            <FieldWrapper key={field.field_id} field={field}>
              <IconDropdown
                options={field.options ?? []}
                value={strValue}
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
