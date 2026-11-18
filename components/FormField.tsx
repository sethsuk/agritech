"use client";

import type { ReactNode } from "react";
import { useT } from "@/lib/i18n/LanguageContext";

/**
 * Label + control + hint/error, with a visible red * on required fields (and a
 * screen-reader "(required)"). The label is linked to the control via htmlFor, so
 * tapping the label focuses the input and tests can use getByLabel.
 *
 * Pass the control as children, with the same `id` as `htmlFor`.
 */
export function FormField({
  htmlFor, label, required, hint, error, children, icon,
}: {
  htmlFor: string;
  label: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  icon?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-ink">
        {icon && <span aria-hidden>{icon}</span>}
        <span>{label}</span>
        {required && <RequiredMark />}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="mt-1.5 text-sm font-semibold text-warning-ink">{error}</p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="mt-1.5 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function RequiredMark() {
  const { tr } = useT();
  return (
    <>
      <span aria-hidden className="text-warning-ink">*</span>
      <span className="sr-only">{tr("requiredSr")}</span>
    </>
  );
}

/** "* = required" — put once at the top of a form that has required fields. */
export function RequiredLegend() {
  const { tr } = useT();
  return <p className="text-xs text-muted">{tr("requiredLegend")}</p>;
}
