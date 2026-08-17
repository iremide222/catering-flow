import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(path.resolve(process.cwd(), p), "utf8");

describe("authentication redirect behavior", () => {
  const src = read("src/routes/_authenticated/route.tsx");

  it("redirects unauthenticated users to /login", () => {
    expect(src).toContain(`const SIGN_IN_ROUTE = '/login'`);
    expect(src).toContain("throw redirect({ to: SIGN_IN_ROUTE })");
  });

  it("checks the session before rendering the subtree", () => {
    expect(src).toContain("supabase.auth.getUser()");
    expect(src).toContain("ssr: false");
  });
});

describe("purchase order report query", () => {
  const src = read("src/routes/_authenticated.app.reports.index.tsx");

  it("selects total and created_at (not total_amount / order_date)", () => {
    expect(src).toContain(`from("purchase_orders").select("total,status,created_at")`);
    expect(src).not.toMatch(/purchase_orders[^\n]*total_amount/);
    expect(src).not.toMatch(/purchase_orders[^\n]*order_date/);
  });

  it("buckets purchase order spend by created_at", () => {
    expect(src).toContain("bucket(p.created_at)");
  });
});

describe("event duplication", () => {
  const src = read("src/routes/_authenticated.app.events.$id.tsx");

  it("sets created_by from the authenticated user", () => {
    expect(src).toContain("created_by: user.id");
  });
});

describe("calendar status mapping", () => {
  const src = read("src/routes/_authenticated.app.calendar.index.tsx");
  const statuses = ["quotation", "planning", "execution", "delivered", "closed"];

  it("maps every event status to a colour class", () => {
    const block = src.slice(src.indexOf("const STATUS_COLOR"), src.indexOf("function startOfMonth"));
    for (const s of statuses) expect(block).toContain(`${s}:`);
  });

  it("gives each status a distinct colour", () => {
    const block = src.slice(src.indexOf("const STATUS_COLOR"), src.indexOf("function startOfMonth"));
    const hues = statuses.map((s) => block.match(new RegExp(`${s}: "bg-([a-z]+)-`))?.[1]);
    expect(new Set(hues).size).toBe(statuses.length);
  });
});
