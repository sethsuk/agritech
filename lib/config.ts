/**
 * Editable thresholds for notifications and fruit batch logic.
 * Change these values and restart `npm run dev` to apply.
 *
 * NOTE: This is a TypeScript file (not JSON) so the values are type-checked at
 * compile time. If you mistype `harvestDaysAfterBloom` you'll get a build error
 * instead of a silent runtime failure.
 */

export const config = {
  /** Days after bloom until fruit is considered ready to harvest. */
  harvestDaysAfterBloom: 120,

  /** Days between fertilizer applications before a tree is "overdue". */
  fertilizerIntervalDays: 30,

  /**
   * `Inspection.issuesFound` entries that should trigger a pesticide alert.
   * Must match the Thai labels used in the issue chips on the inspection form.
   */
  pesticideTriggerIssues: ["เพลี้ย", "แมลงศัตรูพืช", "โรครา", "รากเน่า"],

  /** Days since last inspection before a tree is flagged "stale". */
  staleInspectionDays: 14,

  /** Heads-up window: alert this many days BEFORE harvest readiness. */
  harvestWarningDaysBefore: 7,

  /** The three physical ribbon colors used in the field. */
  fruitBatchColors: [
    { id: "red", labelTh: "แดง", hex: "#ef4444" },
    { id: "green", labelTh: "เขียว", hex: "#22c55e" },
    { id: "blue", labelTh: "น้ำเงิน", hex: "#3b82f6" },
  ],

  /** Issue chip options shown on the inspection form. */
  issueChoices: [
    "ใบเหลือง",
    "โรครา",
    "รากเน่า",
    "เพลี้ย",
    "แมลงศัตรูพืช",
    "ขาดน้ำ",
    "อื่นๆ",
  ],
} as const;

export type FruitBatchColorId = (typeof config.fruitBatchColors)[number]["id"];
