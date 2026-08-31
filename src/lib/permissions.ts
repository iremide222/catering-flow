// Frontend mirror of the backend RLS role rules. Purely for UI visibility —
// the database remains the source of truth for authorization.
export type Role = "admin" | "manager" | "accountant" | "store_manager" | "staff";

// Route prefix -> roles allowed to see/open it. Longest prefix wins.
const ROUTE_ROLES: Array<{ prefix: string; roles: Role[] }> = [
  { prefix: "/app/audit-log", roles: ["admin"] },
  { prefix: "/app/settings", roles: ["admin", "manager", "accountant", "store_manager", "staff"] },
  { prefix: "/app/reports", roles: ["admin", "manager", "accountant"] },
  { prefix: "/app/invoices", roles: ["admin", "manager", "accountant"] },
  { prefix: "/app/expenses", roles: ["admin", "manager", "accountant"] },
  { prefix: "/app/quotations", roles: ["admin", "manager", "accountant"] },
  { prefix: "/app/customers", roles: ["admin", "manager", "accountant", "staff"] },
  { prefix: "/app/events", roles: ["admin", "manager", "accountant", "store_manager", "staff"] },
  { prefix: "/app/calendar", roles: ["admin", "manager", "accountant", "store_manager", "staff"] },
  { prefix: "/app/tasks", roles: ["admin", "manager", "store_manager", "staff"] },
  { prefix: "/app/follow-ups", roles: ["admin", "manager", "staff"] },
  { prefix: "/app/staff", roles: ["admin", "manager"] },
  { prefix: "/app/inventory", roles: ["admin", "manager", "store_manager"] },
  { prefix: "/app/suppliers", roles: ["admin", "manager", "store_manager"] },
  { prefix: "/app/purchase-orders", roles: ["admin", "manager", "store_manager"] },
  { prefix: "/app/notifications", roles: ["admin", "manager", "accountant", "store_manager", "staff"] },
  { prefix: "/app/onboarding", roles: ["admin", "manager", "accountant", "store_manager", "staff"] },
  { prefix: "/app", roles: ["admin", "manager", "accountant", "store_manager", "staff"] },
];

export function canAccessPath(roles: Role[], path: string): boolean {
  if (roles.length === 0) return true; // no org/roles resolved yet — let the page decide
  const match = ROUTE_ROLES.filter((r) => path === r.prefix || path.startsWith(r.prefix + "/"))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0];
  if (!match) return true;
  return roles.some((r) => match.roles.includes(r));
}
