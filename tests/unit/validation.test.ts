import { afterEach, describe, expect, it, vi } from "vitest";
import { validate } from "@/lib/validation";
import { checkFields, firstMissingRequiredField } from "@/lib/validation/fields";
import { normalizeFormData } from "@/lib/validation/normalize";
import type { DbTaskDefinition, DbTree, TaskField } from "@/types/database";

const tree = { tree_id: "AL1-1", qr_code: "QR_AL1-1_v1", lat: "18.7", long: "98.9", location_set_at: "2026-01-01T00:00:00Z" } as unknown as DbTree;
const amount: TaskField = { field_id: "amount", type: "numeric_counter", label_icon: "", label: { th: "", my: "", en: "" }, required: true, min: 0, max: 50, warn_above: 20, step: 1 };
const grades: TaskField = { field_id: "grade_counts", type: "grade_counter", label_icon: "", label: { th: "", my: "", en: "" }, required: true, required_unless: "final_pick", min: 0, max: 200, options: [{ value: "A", icon: "", label: { th: "A", my: "A", en: "A" } }] };
const finalPick: TaskField = { field_id: "final_pick", type: "toggle", label_icon: "", label: { th: "", my: "", en: "" }, required: false };
const def = (fields: TaskField[]) => ({ fields, min_completion_seconds: 12, min_qr_to_submit_seconds: 20 }) as unknown as DbTaskDefinition;

const base = (over: Partial<Parameters<typeof validate>[0]> = {}) => ({
  tree, taskDef: def([amount]), qrValue: "QR_AL1-1_v1",
  qrScannedAt: new Date("2026-01-01T00:00:00Z"), formOpenedAt: new Date("2026-01-01T00:00:10Z"),
  submittedAt: new Date("2026-01-01T00:01:00Z"), gpsLat: 18.7, gpsLong: 98.9, formData: { amount: 5 }, ...over,
});

afterEach(() => vi.unstubAllEnvs());

describe("validate — presence and timing (skipped in e2e by SKIP_VALIDATION)", () => {
  it("passes a clean submission at the tree", () => {
    expect(validate(base())).toMatchObject({ status: "passed", flags: [] });
  });
  it("flags a typed tree ID as manual entry (case-insensitive), not a QR mismatch", () => {
    expect(validate(base({ qrValue: "al1-1" })).flags).toEqual(["manual_entry"]);
    expect(validate(base({ qrValue: "QR_AL2-2_v1" })).flags).toContain("qr_mismatch");
  });
  it("flags missing GPS and being far from the tree", () => {
    expect(validate(base({ gpsLat: null, gpsLong: null })).flags).toContain("gps_missing");
    expect(validate(base({ gpsLat: 18.71, gpsLong: 98.9 })).flags).toContain("gps_off_tree");
  });
  it("skips the GPS check for a tree whose real location was never captured", () => {
    const unlocated = { ...tree, location_set_at: null };
    expect(validate(base({ tree: unlocated, gpsLat: 13.7, gpsLong: 100.5 }))).toMatchObject({ status: "passed", flags: [], gpsDistanceMeters: null });
    expect(validate(base({ tree: unlocated, gpsLat: null, gpsLong: null })).flags).toEqual([]);
    // The QR check still runs.
    expect(validate(base({ tree: unlocated, qrValue: "QR_AL2-2_v1" })).flags).toEqual(["qr_mismatch"]);
  });
  it("flags too-fast completion and QR-to-submit", () => {
    const fast = validate(base({ submittedAt: new Date("2026-01-01T00:00:15Z") }));
    expect(fast.flags).toEqual(expect.arrayContaining(["completion_too_fast", "qr_to_submit_too_fast"]));
  });
  it("SKIP_VALIDATION skips presence/timing but still enforces bounds", () => {
    vi.stubEnv("SKIP_VALIDATION", "true");
    expect(validate(base({ gpsLat: null, gpsLong: null, qrValue: "x" })).flags).toEqual([]);
    expect(validate(base({ formData: { amount: 51 } }))).toMatchObject({ status: "rejected", rejection: { code: "field_above_max", field: "amount", limit: 50 } });
  });
});

describe("fields and bounds", () => {
  it("rejects non-numbers and decimals where whole numbers are expected", () => {
    expect(validate(base({ formData: { amount: "abc" } })).rejection?.code).toBe("field_not_a_number");
    expect(validate(base({ formData: { amount: 3.5 } })).rejection?.code).toBe("field_not_whole_number");
  });
  it("soft-flags values outside the warning range", () => {
    expect(validate(base({ formData: { amount: 30 } }))).toMatchObject({ status: "flagged", flags: ["value_out_of_warn_range:amount"] });
  });
  it("an all-zero grade tally counts as missing — unless it's a last pick", () => {
    expect(firstMissingRequiredField({ grade_counts: { A: 0 } }, [grades, finalPick])?.field_id).toBe("grade_counts");
    expect(firstMissingRequiredField({ grade_counts: {}, final_pick: true }, [grades, finalPick])).toBeNull();
    expect(checkFields({ final_pick: true }, [grades, finalPick])).toEqual({ ok: true });
  });
});

describe("normalizeFormData", () => {
  it("turns numeric strings into numbers so SQL integer checks agree", () => {
    expect(normalizeFormData({ amount: " 5 ", grade_counts: { A: "5.0" } }, [amount, grades]))
      .toEqual({ amount: 5, grade_counts: { A: 5 } });
  });
  it("leaves non-numeric values for validation to reject", () => {
    expect(normalizeFormData({ amount: "abc" }, [amount])).toEqual({ amount: "abc" });
  });
});
