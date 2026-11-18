import { describe, expect, it } from "vitest";
import { parseDmyDigits } from "@/components/DateInputDMY";
import { errorMessage, flagLabel, fmt } from "@/lib/i18n/labels";
import { isPin, toAuthPassword } from "@/lib/auth/pin";

describe("DateInputDMY parsing", () => {
  it("accepts a Buddhist-era year", () => {
    expect(parseDmyDigits("01012563")).toEqual({ iso: "2020-01-01", problem: null });
  });
  it("reports incomplete and impossible dates instead of blanking", () => {
    expect(parseDmyDigits("0101202")).toEqual({ iso: null, problem: "dateIncomplete" });
    expect(parseDmyDigits("31022020")).toEqual({ iso: null, problem: "dateNotReal" });
    expect(parseDmyDigits("")).toEqual({ iso: null, problem: null });
  });
});

describe("labels", () => {
  it("interpolates placeholders", () => {
    expect(fmt("{n} left", { n: 3 })).toBe("3 left");
  });
  it("turns error codes into text in the worker's language, never the raw code", () => {
    expect(errorMessage({ error: "fruit_count_exceeds_remaining", remaining: 12 }, "en")).toContain("12");
    expect(errorMessage({ error: "ribbon_in_use", color: "red" }, "th")).toContain("แดง");
    expect(errorMessage({ error: "something_unknown" }, "en")).toBe("Something went wrong, please try again");
    expect(errorMessage(null, "my")).not.toContain("server_error");
  });
  it("labels flags, including value-range flags with a field suffix", () => {
    expect(flagLabel("value_out_of_warn_range:amount_kg", "en")).toBe("Unusual value");
  });
});

describe("PIN passwords", () => {
  it("prefixes 4–6 digit PINs only", () => {
    expect(isPin("1111")).toBe(true);
    expect(toAuthPassword("1111")).toBe("pin-1111");
    expect(toAuthPassword("manager1234")).toBe("manager1234");
    expect(toAuthPassword("1234567")).toBe("1234567");
  });
});
