"use client";

import { useId } from "react";

/**
 * Filter rows for the manager pages. Period and zone are different questions ("when?"
 * and "where?"), and when both were rows of identical chips, non-technical users read
 * them as one set of choices. So they differ in three ways at once:
 *   - each row has an icon + word label (📅 Period, 📍 Zone);
 *   - the period is ONE joined bar of segments (pick exactly one);
 *   - zones are separate round pills.
 * "Selected" is solid green in both, so it means the same thing everywhere.
 *
 * Buttons keep `aria-pressed` and the group keeps its accessible name, so screen readers
 * (and the e2e tests) address them exactly as before.
 */

function GroupLabel({ id, icon, text }: { id: string; icon: string; text: string }) {
  return (
    <p id={id} className="mb-1 flex items-center gap-1 text-xs font-semibold text-muted">
      <span aria-hidden>{icon}</span>
      {text}
    </p>
  );
}

export function PeriodBar<K extends string>({
  label, options, value, onChange,
}: {
  label: string;
  options: { value: K; label: string }[];
  value: K;
  onChange: (v: K) => void;
}) {
  const id = useId();
  return (
    <div>
      <GroupLabel id={id} icon="📅" text={label} />
      <div role="group" aria-labelledby={id} className="flex w-full gap-1 rounded-xl border border-line bg-surface-alt p-1 sm:inline-flex sm:w-auto">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(o.value)}
              // flex-auto (not flex-1): each segment starts at its text's width, so a long
              // word like สัปดาห์นี้ gets more room instead of wrapping inside an equal slot.
              className={`min-h-11 min-w-0 flex-auto rounded-lg px-2 text-xs font-semibold leading-tight sm:min-h-8 sm:flex-none sm:px-3 ${
                active ? "bg-primary text-white shadow-sm" : "text-body active:bg-surface"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ZonePills({
  label, allLabel, zones, value, onChange,
}: {
  label: string;
  allLabel: string;
  zones: string[];
  value: string | null;
  onChange: (zone: string | null) => void;
}) {
  const id = useId();
  const pill = (active: boolean) =>
    `inline-flex min-h-11 items-center justify-center rounded-full border px-4 text-xs font-semibold sm:min-h-8 ${
      active ? "border-primary bg-primary text-white" : "border-line bg-surface text-body"
    }`;
  return (
    <div>
      <GroupLabel id={id} icon="📍" text={label} />
      <div role="group" aria-labelledby={id} className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={value === null} onClick={() => onChange(null)} className={pill(value === null)}>
          {allLabel}
        </button>
        {zones.map((z) => (
          <button key={z} type="button" aria-pressed={value === z} onClick={() => onChange(z)} className={pill(value === z)}>
            {z}
          </button>
        ))}
      </div>
    </div>
  );
}
