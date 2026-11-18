/**
 * Badge/colour maps shared across pages so the same alert can't read as urgent in one
 * place and mild in another (they used to be copy-pasted with "keep in sync" comments).
 * Token classes only — never hex (see docs/design-system.md).
 */
import type { DictKey } from "@/lib/i18n/dictionary";

export const ALERT_TIER: Record<string, { key: DictKey; className: string }> = {
  tier_1: { key: "alertTierUrgent", className: "bg-warning text-white" },
  tier_2: { key: "alertTierModerate", className: "bg-caution text-white" },
  tier_3: { key: "alertTierInfo", className: "bg-surface-alt text-body border border-line" },
};

export const ALERT_CATEGORY_ICON: Record<string, string> = {
  farm_health: "🌿",
  fraud_signal: "⚠️",
  inactivity: "😴",
  compliance: "📋",
};

export const TRUST_TIER: Record<string, { key: DictKey; className: string }> = {
  trusted: { key: "tierTrusted", className: "bg-primary-tint text-primary-ink" },
  standard: { key: "tierStandard", className: "bg-surface-alt text-body" },
  audit: { key: "tierAudit", className: "bg-caution-tint text-caution-ink" },
};

export function validationBadgeClass(status: string): string {
  return status === "flagged" ? "bg-caution-tint text-caution-ink" : "bg-primary-tint text-primary-ink";
}

/** Shared chip style for filter buttons (zone/range/status). */
export function chipClass(active: boolean): string {
  return `inline-flex min-h-11 items-center justify-center rounded-lg border px-3 text-xs font-semibold sm:min-h-8 ${
    active ? "border-primary bg-primary text-white" : "border-line bg-surface text-body"
  }`;
}
