import { config } from "./config";

export type NotificationType =
  | "harvest_ready"
  | "harvest_soon"
  | "pesticide_needed"
  | "fertilizer_overdue"
  | "inspection_stale";

export type Severity = "high" | "medium" | "low";

export type Notification = {
  id: string;
  type: NotificationType;
  severity: Severity;
  treeId: string;
  zone: string;
  variety: string;
  message: string;
  detail?: string;
  /** Anchor date — what triggered this alert (bloom date, last inspection, etc.) */
  since: Date;
  /** Optional payload to deep-link the worker UI to the right form section. */
  payload?: { batchId?: string; colorTag?: string };
};

export type DeriveInput = {
  trees: Array<{ id: string; zone: string; variety: string }>;
  inspections: Array<{
    id: string;
    treeId: string;
    healthGrade: string;
    issuesFound: string; // JSON-encoded string[]
    fertilizerApplied: boolean;
    pesticideApplied: boolean;
    createdAt: Date;
  }>;
  fruitBatches: Array<{
    id: string;
    treeId: string;
    colorTag: string;
    bloomDate: Date;
    harvestedAt: Date | null;
  }>;
  /** Pass `new Date()` from the caller so this stays a pure function (testable). */
  now: Date;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const SEVERITY_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

function colorLabel(colorTag: string): string {
  return (
    config.fruitBatchColors.find((c) => c.id === colorTag)?.labelTh ?? colorTag
  );
}

function safeParseIssues(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / DAY_MS);
}

export function deriveNotifications(input: DeriveInput): Notification[] {
  const { trees, inspections, fruitBatches, now } = input;
  const notifications: Notification[] = [];
  const treeById = new Map(trees.map((t) => [t.id, t]));

  // Group inspections by tree, newest first.
  const inspectionsByTree = new Map<string, DeriveInput["inspections"]>();
  for (const insp of inspections) {
    const list = inspectionsByTree.get(insp.treeId) ?? [];
    list.push(insp);
    inspectionsByTree.set(insp.treeId, list);
  }
  for (const list of inspectionsByTree.values()) {
    list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // --- Fruit batch alerts (harvest_ready, harvest_soon) ---
  for (const batch of fruitBatches) {
    if (batch.harvestedAt) continue;
    const tree = treeById.get(batch.treeId);
    if (!tree) continue;

    const ageDays = daysBetween(now, batch.bloomDate);
    const daysToHarvest = config.harvestDaysAfterBloom - ageDays;
    const colorTh = colorLabel(batch.colorTag);

    if (daysToHarvest <= 0) {
      const overdueBy = -daysToHarvest;
      notifications.push({
        id: `harvest_ready:${batch.id}`,
        type: "harvest_ready",
        severity: "high",
        treeId: tree.id,
        zone: tree.zone,
        variety: tree.variety,
        message: `${tree.id} ผลสี${colorTh}พร้อมเก็บเกี่ยว`,
        detail:
          overdueBy === 0
            ? "ครบกำหนดวันนี้"
            : `เลยกำหนด ${overdueBy} วัน · บานเมื่อ ${ageDays} วันที่แล้ว`,
        since: batch.bloomDate,
        payload: { batchId: batch.id, colorTag: batch.colorTag },
      });
    } else if (daysToHarvest <= config.harvestWarningDaysBefore) {
      notifications.push({
        id: `harvest_soon:${batch.id}`,
        type: "harvest_soon",
        severity: "medium",
        treeId: tree.id,
        zone: tree.zone,
        variety: tree.variety,
        message: `${tree.id} ผลสี${colorTh}ใกล้พร้อมเก็บเกี่ยว`,
        detail: `อีก ${daysToHarvest} วัน · บานเมื่อ ${ageDays} วันที่แล้ว`,
        since: batch.bloomDate,
        payload: { batchId: batch.id, colorTag: batch.colorTag },
      });
    }
  }

  // --- Per-tree alerts (pesticide_needed, fertilizer_overdue, inspection_stale) ---
  const pesticideTriggers = new Set<string>(config.pesticideTriggerIssues);

  for (const tree of trees) {
    const list = inspectionsByTree.get(tree.id) ?? [];

    // inspection_stale
    if (list.length === 0) {
      notifications.push({
        id: `inspection_stale:${tree.id}`,
        type: "inspection_stale",
        severity: "low",
        treeId: tree.id,
        zone: tree.zone,
        variety: tree.variety,
        message: `${tree.id} ยังไม่เคยตรวจ`,
        detail: "บันทึกการตรวจครั้งแรกได้เลย",
        since: tree.id ? new Date(0) : now,
      });
    } else {
      const latest = list[0];
      const days = daysBetween(now, latest.createdAt);
      if (days >= config.staleInspectionDays) {
        notifications.push({
          id: `inspection_stale:${tree.id}`,
          type: "inspection_stale",
          severity: "low",
          treeId: tree.id,
          zone: tree.zone,
          variety: tree.variety,
          message: `${tree.id} ไม่ได้ตรวจมา ${days} วัน`,
          detail: `ตรวจครั้งสุดท้าย ${days} วันที่แล้ว`,
          since: latest.createdAt,
        });
      }
    }

    // pesticide_needed: most recent inspection has a trigger issue AND no later inspection has pesticideApplied=true
    // Walk newest-first: first inspection with trigger issue AND no subsequent pesticideApplied means alert.
    const latest = list[0];
    if (latest) {
      const issues = safeParseIssues(latest.issuesFound);
      const hasTrigger = issues.some((i) => pesticideTriggers.has(i));
      if (hasTrigger && !latest.pesticideApplied) {
        const triggered = issues.filter((i) => pesticideTriggers.has(i));
        notifications.push({
          id: `pesticide_needed:${tree.id}`,
          type: "pesticide_needed",
          severity: "high",
          treeId: tree.id,
          zone: tree.zone,
          variety: tree.variety,
          message: `${tree.id} ต้องฉีดยา (${triggered.join(", ")})`,
          detail: `พบเมื่อ ${daysBetween(now, latest.createdAt)} วันที่แล้ว`,
          since: latest.createdAt,
        });
      }
    }

    // fertilizer_overdue: no inspection with fertilizerApplied=true within fertilizerIntervalDays.
    const lastFertilized = list.find((i) => i.fertilizerApplied);
    if (!lastFertilized) {
      notifications.push({
        id: `fertilizer_overdue:${tree.id}`,
        type: "fertilizer_overdue",
        severity: "medium",
        treeId: tree.id,
        zone: tree.zone,
        variety: tree.variety,
        message: `${tree.id} ยังไม่เคยใส่ปุ๋ย`,
        detail: "บันทึกการใส่ปุ๋ยครั้งแรกได้เลย",
        since: list.at(-1)?.createdAt ?? now,
      });
    } else {
      const days = daysBetween(now, lastFertilized.createdAt);
      if (days >= config.fertilizerIntervalDays) {
        notifications.push({
          id: `fertilizer_overdue:${tree.id}`,
          type: "fertilizer_overdue",
          severity: "medium",
          treeId: tree.id,
          zone: tree.zone,
          variety: tree.variety,
          message: `${tree.id} ปุ๋ยเกินกำหนด ${days} วัน`,
          detail: `ใส่ปุ๋ยครั้งสุดท้าย ${days} วันที่แล้ว`,
          since: lastFertilized.createdAt,
        });
      }
    }
  }

  // Sort: severity asc (high first), then since desc (newest first within a severity).
  notifications.sort((a, b) => {
    const s = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (s !== 0) return s;
    return b.since.getTime() - a.since.getTime();
  });

  return notifications;
}

export function notificationCounts(notifications: Notification[]) {
  return {
    total: notifications.length,
    high: notifications.filter((n) => n.severity === "high").length,
    medium: notifications.filter((n) => n.severity === "medium").length,
    low: notifications.filter((n) => n.severity === "low").length,
  };
}
