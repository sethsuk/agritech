import { describe, expect, it } from "vitest";
import { addDays, bkkDate, formatDate, formatDateTime, plantedDateProblem, rangeStart } from "@/lib/time";

describe("lib/time — always Bangkok", () => {
  // 2026-11-17 18:30 UTC = 2026-11-18 01:30 Bangkok (a Wednesday).
  const now = new Date("2026-11-17T18:30:00Z");

  it("bkkDate uses the Bangkok calendar day, not UTC", () => {
    expect(bkkDate(now)).toBe("2026-11-18");
  });

  it("rangeStart gives Bangkok calendar boundaries (week starts Monday)", () => {
    expect(rangeStart("today", now)!.toISOString()).toBe("2026-11-17T17:00:00.000Z"); // 18 Nov 00:00 BKK
    expect(rangeStart("week", now)!.toISOString()).toBe("2026-11-15T17:00:00.000Z");  // Mon 16 Nov 00:00 BKK
    expect(rangeStart("month", now)!.toISOString()).toBe("2026-10-31T17:00:00.000Z"); // 1 Nov 00:00 BKK
    expect(rangeStart("year", now)!.toISOString()).toBe("2025-12-31T17:00:00.000Z");  // 1 Jan 00:00 BKK
    expect(rangeStart("all", now)).toBeNull();
  });

  it("a Monday is its own week start; Sunday belongs to the previous week", () => {
    expect(rangeStart("week", new Date("2026-11-16T03:00:00Z"))!.toISOString()).toBe("2026-11-15T17:00:00.000Z");
    expect(rangeStart("week", new Date("2026-11-22T10:00:00Z"))!.toISOString()).toBe("2026-11-15T17:00:00.000Z");
  });

  it("formats in Bangkok time regardless of the machine timezone", () => {
    expect(formatDateTime(now, "en")).toContain("01:30");
    expect(formatDateTime(now, "th")).toContain("2569"); // Buddhist-era year
  });

  it("formatDate treats a DATE column as a calendar day (no shift)", () => {
    expect(formatDate("2026-01-01", "en")).toContain("2026");
    expect(formatDate("2026-01-01", "en")).toMatch(/^1 /);
  });

  it("addDays crosses month and year ends", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
  });

  it("plantedDateProblem rejects impossible, future and pre-1950 dates", () => {
    expect(plantedDateProblem("2020-02-31")).toBe("dateNotReal");
    expect(plantedDateProblem("2999-01-01", "2026-11-18")).toBe("dateInFuture");
    expect(plantedDateProblem("1949-12-31")).toBe("dateTooOld");
    expect(plantedDateProblem("2020-02-29")).toBeNull();
  });
});
