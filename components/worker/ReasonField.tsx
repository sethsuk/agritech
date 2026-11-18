"use client";

import { FormField } from "@/components/FormField";

/** The required reason box for a correction or void — red * and an inline error, not just a toast. */
export function ReasonField({
  label, placeholder, value, onChange, error,
}: { label: string; placeholder: string; value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <div className={`rounded-lg bg-surface p-4 ${error ? "border-2 border-warning" : "border border-line"}`}>
      <FormField htmlFor="reason" label={<span className="text-lg">{label}</span>} required error={error}>
        <textarea
          id="reason"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          required
          aria-invalid={!!error || undefined}
          aria-describedby={error ? "reason-error" : undefined}
          className="w-full rounded-lg border border-line px-3 py-2 text-base focus:border-primary focus:outline-none"
        />
      </FormField>
    </div>
  );
}
