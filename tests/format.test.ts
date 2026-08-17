import { describe, expect, it } from "vitest";
import { formatCurrency, formatDate } from "@/lib/format";

describe("formatCurrency", () => {
  it("formats USD by default", () => {
    expect(formatCurrency(1234.5)).toContain("1,234.5");
  });

  it("respects an explicit currency", () => {
    expect(formatCurrency(10, "EUR")).toMatch(/(€|EUR)/);
  });

  it("falls back gracefully on an invalid currency code", () => {
    expect(formatCurrency(10, "NOT_A_CURRENCY")).toBe("NOT_A_CURRENCY 10.00");
  });
});

describe("formatDate", () => {
  it("renders a dash for empty values", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
  });

  it("formats an ISO date", () => {
    expect(formatDate("2026-01-15")).toMatch(/2026/);
  });
});
