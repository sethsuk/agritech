"use client";

import { t } from "@/lib/i18n/t";
import { useT } from "@/lib/i18n/LanguageContext";
import type { SetState, TaskField } from "@/types/database";
import { RequiredMark } from "@/components/FormField";
import { NumericCounter } from "./NumericCounter";
import { ColorPicker } from "./ColorPicker";
import { SeverityPicker } from "./SeverityPicker";
import { IconDropdown } from "./IconDropdown";
import { GradeCounter } from "./GradeCounter";
import { SetPicker } from "./SetPicker";
import { Toggle } from "./Toggle";

type Props = {
  fields: TaskField[];
  formData: Record<string, unknown>;
  onChange: (fieldId: string, value: unknown) => void;
  /** The tree's open sets — for set_picker fields, and to grey out ribbons in use on bloom. */
  openSets?: SetState[];
  /** Field to highlight (the one the server rejected, or the first missing one). */
  errorField?: string | null;
  errorMessage?: string | null;
};

/** DOM id of a field's card, so the page can scroll the offending field into view. */
export const fieldDomId = (fieldId: string) => `field-${fieldId}`;

/**
 * Renders a task form generically from `task_definitions.fields`. Adding a field type
 * means a case here, a widget, and (if it needs checking) a case in lib/validation.
 */
export function TaskFormRenderer({ fields, formData, onChange, openSets = [], errorField, errorMessage }: Props) {
  const { lang, tr } = useT();

  return (
    <div className="space-y-4">
      {fields.map((field) => {
        const raw = formData[field.field_id];
        const hasError = errorField === field.field_id;
        const labelId = `${fieldDomId(field.field_id)}-label`;

        let control: React.ReactNode = null;
        if (field.type === "numeric_counter" || field.type === "slider") {
          const num = typeof raw === "number" ? raw : null;
          control = (
            <>
              <NumericCounter
                value={num}
                min={field.min}
                max={field.max}
                default_value={field.default_value}
                step={field.step}
                onChange={(v) => onChange(field.field_id, v)}
              />
              {field.warn_below !== undefined && num !== null && num < field.warn_below && (
                <p className="mt-2 text-base text-caution-ink">⚠️ {tr("warnBelow")} ({field.warn_below})</p>
              )}
              {field.warn_above !== undefined && num !== null && num > field.warn_above && (
                <p className="mt-2 text-base text-caution-ink">⚠️ {tr("warnAbove")} ({field.warn_above})</p>
              )}
            </>
          );
        } else if (field.type === "color_picker") {
          control = (
            <ColorPicker
              options={field.options ?? []}
              value={typeof raw === "string" ? raw : null}
              onChange={(v) => onChange(field.field_id, v)}
              // On a bloom log, a ribbon already on an open set can't start a new one.
              disabledValues={field.field_id === "color" ? openSets.map((s) => s.color) : []}
              disabledNote={tr("ribbonInUseShort")}
            />
          );
        } else if (field.type === "severity_picker") {
          control = (
            <SeverityPicker options={field.options ?? []} value={typeof raw === "string" ? raw : null} onChange={(v) => onChange(field.field_id, v)} />
          );
        } else if (field.type === "dropdown") {
          control = (
            <IconDropdown options={field.options ?? []} value={typeof raw === "string" ? raw : null} onChange={(v) => onChange(field.field_id, v)} />
          );
        } else if (field.type === "grade_counter") {
          control = (
            <GradeCounter
              options={field.options ?? []}
              value={raw && typeof raw === "object" ? (raw as Record<string, number>) : null}
              min={field.min}
              max={field.max}
              step={field.step}
              onChange={(v) => onChange(field.field_id, v)}
            />
          );
        } else if (field.type === "set_picker") {
          control = <SetPicker sets={openSets} value={typeof raw === "string" ? raw : null} onChange={(v) => onChange(field.field_id, v)} />;
        } else if (field.type === "toggle") {
          control = <Toggle value={raw === true} onChange={(v) => onChange(field.field_id, v)} />;
        }
        if (!control) return null;

        return (
          <div
            key={field.field_id}
            id={fieldDomId(field.field_id)}
            role="group"
            aria-labelledby={labelId}
            aria-invalid={hasError || undefined}
            className={`scroll-mt-24 rounded-lg bg-surface p-4 ${hasError ? "border-2 border-warning" : "border border-line"}`}
          >
            <p id={labelId} className="mb-3 flex items-center gap-2 text-lg font-semibold text-body">
              <span aria-hidden>{field.label_icon}</span>
              <span>{t(field.label, lang)}</span>
              {field.required && <RequiredMark />}
            </p>
            {control}
            {field.hint && <p className="mt-2 text-sm text-muted">{t(field.hint, lang)}</p>}
            {hasError && errorMessage && (
              <p role="alert" className="mt-2 text-base font-semibold text-warning-ink">{errorMessage}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
