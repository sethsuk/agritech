"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/LanguageContext";
import { KNOWN_VARIETIES, varietyName } from "@/lib/i18n/varieties";
import { readGps, type GpsFix } from "@/lib/geo";
import { DateInputDMY, type DateInputState } from "@/components/DateInputDMY";
import { FormField } from "@/components/FormField";

/**
 * Form pieces shared by the new-tree and edit-tree pages (previously duplicated in
 * both, including two copies of the GPS capture code).
 */

// --- Variety ---

export interface VarietyValue { choice: string; custom: string }

export function varietyFromStored(stored: string): VarietyValue {
  const known = KNOWN_VARIETIES.includes(stored);
  return { choice: known ? stored : "other", custom: known ? "" : stored };
}
export const varietyOf = (v: VarietyValue) => (v.choice === "other" ? v.custom.trim() : v.choice);

export function VarietyField({ value, onChange }: { value: VarietyValue; onChange: (v: VarietyValue) => void }) {
  const { lang, tr } = useT();
  return (
    <FormField htmlFor="tree-variety" label={tr("colVariety")} required>
      <select
        id="tree-variety"
        value={value.choice}
        onChange={(e) => onChange({ ...value, choice: e.target.value })}
        className="h-12 w-full rounded-lg border border-line bg-surface px-4 text-base focus:border-primary focus:outline-none"
      >
        {/* The stored value stays the canonical romanized name; only the label is translated. */}
        {KNOWN_VARIETIES.map((v) => <option key={v} value={v}>{varietyName(v, lang)}</option>)}
        <option value="other">{tr("otherOption")}</option>
      </select>
      {value.choice === "other" && (
        <input
          type="text"
          aria-label={tr("customVarietyPlaceholder")}
          value={value.custom}
          onChange={(e) => onChange({ ...value, custom: e.target.value })}
          placeholder={tr("customVarietyPlaceholder")}
          required
          className="mt-2 h-12 w-full rounded-lg border border-line px-4 text-base focus:border-primary focus:outline-none"
        />
      )}
    </FormField>
  );
}

// --- Planted date ---

/**
 * Date field that explains what's wrong *as you type* (impossible date, future date,
 * before 1950) rather than silently disabling the submit button. "Incomplete" is only
 * reported after the field loses focus or the form is submitted.
 */
export function PlantedDateField({
  initial, state, onChange, showAllErrors,
}: {
  initial: string;
  state: DateInputState;
  onChange: (s: DateInputState) => void;
  showAllErrors: boolean;
}) {
  const { tr } = useT();
  const [blurred, setBlurred] = useState(false);
  const missing = !state.iso && !state.problem;
  const problem =
    state.problem && (state.problem !== "dateIncomplete" || blurred || showAllErrors) ? state.problem
    : missing && showAllErrors ? "dateIncomplete"
    : null;

  return (
    <div onBlur={() => setBlurred(true)}>
      <FormField
        htmlFor="tree-planted"
        label={tr("plantedDateLabel")}
        required
        hint={tr("dateFormatHint")}
        error={problem ? tr(problem) : undefined}
      >
        <DateInputDMY
          id="tree-planted"
          value={initial}
          onChange={onChange}
          required
          invalid={!!problem}
          describedBy={problem ? "tree-planted-error" : "tree-planted-hint"}
        />
      </FormField>
    </div>
  );
}

// --- GPS ---

export function GpsField({
  value, onChange, current, required, buttonLabel,
}: {
  value: GpsFix | null;
  onChange: (fix: GpsFix) => void;
  /** Saved coordinates, shown for comparison on the edit page. */
  current?: { lat: number; long: number };
  required?: boolean;
  buttonLabel: string;
}) {
  const { tr } = useT();
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function capture() {
    setReading(true);
    setError(null);
    try {
      onChange(await readGps());
    } catch (e) {
      setError(tr(e === "unsupported" ? "gpsUnsupported" : "gpsReadFailedRetry"));
    } finally {
      setReading(false);
    }
  }

  return (
    <FormField
      htmlFor="tree-gps"
      label={tr("gpsLocationLabel")}
      required={required}
      error={error ?? undefined}
      hint={value ? tr("locationUpdated", { m: value.accuracyMeters }) : tr("gpsStandHint")}
    >
      {current && (
        <p className="mb-2 text-xs text-muted">
          {tr("currentPrefix")}: <span className="font-mono">{current.lat.toFixed(6)}, {current.long.toFixed(6)}</span>
        </p>
      )}
      <button
        id="tree-gps"
        type="button"
        onClick={capture}
        disabled={reading}
        aria-live="polite"
        // Name the button by its action — otherwise the field's <label> ("GPS location")
        // becomes its accessible name and a screen reader never says what it does.
        aria-label={reading ? tr("readingLocation")
          : value ? `${tr("gpsLocationLabel")}: ${value.lat.toFixed(6)}, ${value.long.toFixed(6)}`
          : buttonLabel}
        className={`h-12 w-full rounded-lg border text-sm font-semibold disabled:opacity-60 ${
          value ? "border-primary bg-primary-tint text-primary-ink" : "border-line bg-surface-alt text-body"
        }`}
      >
        {reading
          ? tr("readingLocation")
          : value
          ? <span className="font-mono">✓ {value.lat.toFixed(6)}, {value.long.toFixed(6)}</span>
          : buttonLabel}
      </button>
    </FormField>
  );
}
