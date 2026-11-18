"use client";

import { useRef } from "react";

/**
 * Radio-group keyboard behaviour for our big tap-target pickers (colour, severity,
 * dropdown, set, yes/no): one Tab stop (the selected option, else the first), arrow keys
 * move AND select, Home/End jump. Without this, `role="radio"` buttons announce as radios
 * but behave like a row of separate buttons, which confuses screen-reader and keyboard use.
 *
 *   const radio = useRadioGroup(values, value, onChange, disabled);
 *   <button {...radio(i)}>…</button>
 */
export function useRadioGroup<T>(values: T[], value: T | null, onChange: (v: T) => void, disabled: T[] = []) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = values.findIndex((v) => v === value);
  const tabStop = selected >= 0 ? selected : values.findIndex((v) => !disabled.includes(v));

  function move(from: number, step: number) {
    for (let k = 1; k <= values.length; k++) {
      const i = (from + step * k + values.length * k) % values.length;
      if (!disabled.includes(values[i])) {
        refs.current[i]?.focus();
        onChange(values[i]);
        return;
      }
    }
  }

  return (i: number) => ({
    ref: (el: HTMLButtonElement | null) => { refs.current[i] = el; },
    role: "radio" as const,
    "aria-checked": i === selected,
    tabIndex: i === tabStop ? 0 : -1,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); move(i, 1); }
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); move(i, -1); }
      else if (e.key === "Home") { e.preventDefault(); move(-1, 1); }
      else if (e.key === "End") { e.preventDefault(); move(values.length, -1); }
    },
  });
}
