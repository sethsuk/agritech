"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

type Props = {
  value: string; // ISO yyyy-mm-dd, or ""
  onChange: (isoValue: string) => void;
  required?: boolean;
};

function isValidDate(day: number, month: number, year: number) {
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

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

// Position in `formatted` right after the nth digit character.
function cursorAfterDigit(formatted: string, digitCount: number) {
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i])) {
      seen++;
      if (seen === digitCount) return i + 1;
    }
  }
  return formatted.length;
}

// Native <input type="date"> renders in the browser/OS locale (often MM/DD/YYYY),
// ignoring the page's lang attribute. This always displays/parses as DD/MM/YYYY.
export function DateInputDMY({ value, onChange, required }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCursor = useRef<number | null>(null);
  const [text, setText] = useState(() => isoToDisplay(value));

  useEffect(() => {
    setText(isoToDisplay(value));
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

    if (digits.length === 8) {
      const day = digits.slice(0, 2);
      const month = digits.slice(2, 4);
      const year = digits.slice(4);
      const valid = isValidDate(Number(day), Number(month), Number(year));
      onChange(valid ? `${year}-${month}-${day}` : "");
    } else {
      onChange("");
    }
  }

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      placeholder="DD/MM/YYYY"
      maxLength={10}
      required={required}
      value={text}
      onChange={handleChange}
      className="h-12 w-full rounded-xl border border-slate-300 px-4 text-base focus:border-emerald-500 focus:outline-none"
    />
  );
}
