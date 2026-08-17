import { describe, expect, it } from "vitest";
import { canAccessPath } from "@/lib/permissions";

describe("canAccessPath", () => {
  it("allows admin everywhere", () => {
    expect(canAccessPath(["admin"], "/app/audit-log")).toBe(true);
    expect(canAccessPath(["admin"], "/app/inventory/123")).toBe(true);
  });

  it("restricts the audit log to admins", () => {
    expect(canAccessPath(["manager"], "/app/audit-log")).toBe(false);
    expect(canAccessPath(["staff"], "/app/audit-log")).toBe(false);
  });

  it("uses the longest matching prefix", () => {
    expect(canAccessPath(["accountant"], "/app/invoices")).toBe(true);
    expect(canAccessPath(["accountant"], "/app/inventory")).toBe(false);
  });

  it("matches nested paths of an allowed prefix", () => {
    expect(canAccessPath(["store_manager"], "/app/purchase-orders/abc")).toBe(true);
  });

  it("falls back to permissive when roles are not resolved yet", () => {
    expect(canAccessPath([], "/app/audit-log")).toBe(true);
  });

  it("allows unknown paths", () => {
    expect(canAccessPath(["staff"], "/some/other/path")).toBe(true);
  });
});
