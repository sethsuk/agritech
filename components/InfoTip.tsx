"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useT } from "@/lib/i18n/LanguageContext";

/**
 * ⓘ tap-to-explain. Phones have no hover, so a `title` tooltip is invisible there —
 * this toggles on tap and closes on an outside tap or Escape.
 *
 * Renders inline; put it next to the label it explains. Accessible as a disclosure: a
 * real button with aria-expanded / aria-controls pointing at the explanation panel.
 */
export function InfoTip({ text, label }: { text: string; label?: string }) {
  const { tr } = useT();
  const [open, setOpen] = useState(false);
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex align-middle">
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); }}
        aria-expanded={open}
        aria-controls={id}
        aria-label={label ? `${tr("moreInfo")}: ${label}` : tr("moreInfo")}
        className="-m-2 inline-flex h-9 w-9 items-center justify-center rounded-full text-muted hover:text-body focus-visible:outline-2 focus-visible:outline-primary"
      >
        <span aria-hidden className="flex h-5 w-5 items-center justify-center rounded-full border border-current text-[11px] font-bold leading-none">i</span>
      </button>
      {open && (
        // A disclosure panel, not role="tooltip": it opens on tap and stays until dismissed.
        <span
          id={id}
          data-infotip-panel=""
          className="absolute left-1/2 top-full z-30 mt-1 w-64 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-lg border border-line bg-surface p-3 text-left text-xs font-normal leading-relaxed text-body shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  );
}
