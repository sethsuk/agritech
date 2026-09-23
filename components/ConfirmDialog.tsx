"use client";

import { useEffect, useRef } from "react";
import { t } from "@/lib/i18n/t";
import { useLang } from "@/lib/i18n/LanguageContext";
import { dict } from "@/lib/i18n/dictionary";

type Props = {
  open: boolean;
  title: string;
  message?: string;
  /** Label for the confirming action. Falls back to a generic "Confirm". */
  confirmLabel?: string;
  /** Destructive actions get the warning fill instead of primary. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Replaces window.confirm(), which can't be styled, can't be translated
 * consistently, and renders OS-sized buttons far below our touch target.
 *
 * Deliberately has no small "X" dismiss and no tap-outside-to-close: the two
 * full-width buttons are the only way out, so nothing can be dismissed by an
 * accidental touch — which matters with gloved hands on a phone in the field.
 */
export function ConfirmDialog({
  open, title, message, confirmLabel, destructive, onConfirm, onCancel,
}: Props) {
  const { lang } = useLang();
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Escape still cancels — a keyboard affordance for the manager desktop case.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    cancelRef.current?.focus();
    // Block background scroll while the dialog owns the screen.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div className="w-full max-w-md rounded-lg border border-line bg-surface p-5">
        <h2 id="confirm-title" className="text-lg font-bold text-ink">{title}</h2>
        {message && <p className="mt-2 text-base text-body">{message}</p>}

        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={onConfirm}
            className={`h-15 w-full rounded-lg text-base font-bold text-white ${
              destructive
                ? "bg-warning active:bg-warning-press"
                : "bg-primary active:bg-primary-press"
            }`}
          >
            {confirmLabel ?? t(dict.confirmAction, lang)}
          </button>
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="h-15 w-full rounded-lg border border-line bg-surface-alt text-base font-semibold text-body active:bg-surface-press"
          >
            {t(dict.cancelAction, lang)}
          </button>
        </div>
      </div>
    </div>
  );
}
