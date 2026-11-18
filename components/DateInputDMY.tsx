"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { plantedDateProblem, type PlantedDateProblem } from "@/lib/time";

export type DateProblem = PlantedDateProblem | "dateIncomplete";

export interface DateInputState {
  /** Valid ISO yyyy-mm-dd, or null while empty / incomplete / invalid. */
  iso: string | null;
  /** Dictionary key describing what's wrong, or null when valid or empty. */
  problem: DateProblem | null;
}

type Props = {
  id?: string;
  /** Initial / externally-set ISO value. */
  value: string;
  onChange: (state: DateInputState) => void;
  required?: boolean;
  /** Show the error styling (the parent decides when — e.g. after blur or submit). */
  invalid?: boolean;
  describedBy?: string;
};

function isoToDisplay(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function formatDigits(digits: string) {
  if (digits.length > 4) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}

function cursorAfterDigit(formatted: string, digitCount: number) {
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i]) && ++seen === digitCount) return i + 1;
  }
  return formatted.length;
}

/** Parse the typed digits. A Buddhist-era year (> 2400, e.g. 2569) is converted. */
export function parseDmyDigits(digits: string): DateInputState {
  if (digits.length === 0) return { iso: null, problem: null };
  if (digits.length < 8) return { iso: null, problem: "dateIncomplete" };
  let year = Number(digits.slice(4));
  if (year > 2400) year -= 543;
  const iso = `${String(year).padStart(4, "0")}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`;
  const problem = plantedDateProblem(iso);
  return problem ? { iso: null, problem } : { iso, problem: null };
}

/**
 * DD/MM/YYYY text input (native <input type="date"> renders in the OS locale, often
 * MM/DD/YYYY, ignoring the page language).
 *
 * The typed text is owned locally and is never overwritten while the user edits. The
 * old version emitted "" for every partial edit, and an effect then reset the text from
 * that "" — so one backspace wiped the whole date, the form's planted date became empty,
 * and Save silently did nothing (which is also why re-captured GPS never saved).
 */
export function DateInputDMY({ id, value, onChange, required, invalid, describedBy }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCursor = useRef<number | null>(null);
  const lastEmitted = useRef<string | null>(value || null);
  const [text, setText] = useState(() => isoToDisplay(value));

  // Adopt a new value only when it comes from outside (e.g. data loaded), never as an
  // echo of what this input just emitted.
  useEffect(() => {
    if ((value || null) !== lastEmitted.current) {
      lastEmitted.current = value || null;
      setText(isoToDisplay(value));
    }
  }, [value]);

  useLayoutEffect(() => {
    if (pendingCursor.current !== null && inputRef.current) {
      inputRef.current.setSelectionRange(pendingCursor.current, pendingCursor.current);
      pendingCursor.current = null;
    }
  }, [text]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const cursor = e.target.selectionStart ?? raw.length;
    const digitsBeforeCursor = raw.slice(0, cursor).replace(/\D/g, "").length;
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    const formatted = formatDigits(digits);

    pendingCursor.current = cursorAfterDigit(formatted, digitsBeforeCursor);
    setText(formatted);

    const state = parseDmyDigits(digits);
    lastEmitted.current = state.iso;
    onChange(state);
  }

  return (
    <input
      ref={inputRef}
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="DD/MM/YYYY"
      maxLength={10}
      required={required}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      value={text}
      onChange={handleChange}
      className={`h-12 w-full rounded-lg border px-4 text-base focus:outline-none ${
        invalid ? "border-2 border-warning bg-warning-tint/40" : "border-line focus:border-primary"
      }`}
    />
  );
}
