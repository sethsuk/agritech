"use client";

import { T } from "@/components/T";
import { treeHealthFrom, type TreeAlertSummary } from "@/lib/derived/treeHealth";
import type { DictKey } from "@/lib/i18n/dictionary";

const LABEL: Record<ReturnType<typeof treeHealthFrom>, DictKey> = {
  ok: "healthOk",
  watch: "healthWatch",
  attention: "healthAttention",
};

const STYLE: Record<ReturnType<typeof treeHealthFrom>, string> = {
  ok: "bg-primary-tint text-primary-ink",
  watch: "bg-caution-tint text-caution-ink",
  attention: "bg-warning-tint text-warning-ink",
};

/**
 * The tree's health, stated as open-alert status.
 *
 * Replaces a percentage badge that always read 100% because `derived_health_score` had
 * no formula and no writer. Both the tree list and the tree detail page render this, so
 * the thresholds can't drift between them.
 */
export function TreeHealthBadge({
  openAlerts,
  hasTier1Alert,
  className = "",
}: TreeAlertSummary & { className?: string }) {
  const health = treeHealthFrom({ openAlerts, hasTier1Alert });
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STYLE[health]} ${className}`}
    >
      <T k={LABEL[health]} />
    </span>
  );
}
