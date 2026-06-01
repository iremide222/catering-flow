import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  FileText,
  ListChecks,
  Settings,
  LogOut,
  Building2,
  Package,
  Truck,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/app/customers", label: "Customers", icon: Users },
  { to: "/app/events", label: "Events", icon: CalendarDays },
  { to: "/app/quotations", label: "Quotations", icon: FileText },
  { to: "/app/follow-ups", label: "Follow-ups", icon: ListChecks },
  { to: "/app/inventory", label: "Inventory", icon: Package },
  { to: "/app/suppliers", label: "Suppliers", icon: Truck },
  { to: "/app/purchase-orders", label: "Purchase orders", icon: ClipboardList },
  { to: "/app/settings", label: "Settings", icon: Settings },
];


export function AppShell({ children }: { children: ReactNode }) {
  const { user, organizations, currentOrgId, setCurrentOrg, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const currentOrg = organizations.find((o) => o.id === currentOrgId);

  return (
    <div className="flex min-h-screen bg-muted/20">
      <aside className="flex w-60 flex-col border-r bg-card">
        <div className="border-b px-5 py-4">
          <div className="text-base font-semibold tracking-tight">CaterFlow</div>
          <div className="mt-1 text-xs text-muted-foreground">{currentOrg?.name ?? "No workspace"}</div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = item.exact
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-2 border-t p-3">
          {organizations.length > 1 && (
            <Select value={currentOrgId ?? undefined} onValueChange={setCurrentOrg}>
              <SelectTrigger><SelectValue placeholder="Workspace" /></SelectTrigger>
              <SelectContent>
                {organizations.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    <span className="inline-flex items-center gap-2"><Building2 className="h-3.5 w-3.5" />{o.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="truncate px-2 text-xs text-muted-foreground">{user?.email}</div>
          <Button variant="outline" size="sm" className="w-full" onClick={async () => { await signOut(); navigate({ to: "/login" }); }}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-x-auto">
        <div className="mx-auto max-w-7xl p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
