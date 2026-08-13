import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { type ReactNode, useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getNotifications, syncNotifications } from "@/lib/notifications.functions";
import { formatDate } from "@/lib/format";
import { useIsMobile } from "@/hooks/use-mobile";
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
  UserCog,
  CheckSquare,
  Receipt,
  BarChart3,
  Bell,
  ScrollText,
  Menu,
  Package as PackageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@/components/command-palette";
import { canAccessPath } from "@/lib/permissions";

const BELL_ICON: Record<string, React.ElementType> = {
  low_stock: Package,
  overdue_invoice: Receipt,
  upcoming_event: CalendarDays,
  task_due: CheckSquare,
};

const nav = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/app/reports", label: "Reports", icon: BarChart3 },
  { to: "/app/customers", label: "Customers", icon: Users },
  { to: "/app/events", label: "Events", icon: CalendarDays },
  { to: "/app/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/app/quotations", label: "Quotations", icon: FileText },
  { to: "/app/invoices", label: "Invoices", icon: Receipt },
  { to: "/app/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/app/follow-ups", label: "Follow-ups", icon: ListChecks },
  { to: "/app/staff", label: "Staff", icon: UserCog },
  { to: "/app/inventory", label: "Inventory", icon: Package },
  { to: "/app/suppliers", label: "Suppliers", icon: Truck },
  { to: "/app/purchase-orders", label: "Purchase orders", icon: ClipboardList },
  { to: "/app/audit-log", label: "Audit log", icon: ScrollText },
  { to: "/app/settings", label: "Settings", icon: Settings },
];

function NotificationBell() {
  const { currentOrgId } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fetchList = useServerFn(getNotifications);
  const doSync = useServerFn(syncNotifications);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: notifData } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchList(),
    enabled: !!currentOrgId,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!currentOrgId) return;
    doSync({ data: { organizationId: currentOrgId } }).catch(() => {});
  }, [currentOrgId, doSync]);

  const notifications = notifData?.notifications ?? [];
  const unread = notifications.filter((n: any) => !n.read);
  const recent = unread.slice(0, 5);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        <Bell className="h-5 w-5" />
        {unread.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
            {unread.length > 9 ? "9+" : unread.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-md border bg-card p-2 shadow-lg">
          <div className="mb-2 flex items-center justify-between px-2 pt-1">
            <span className="text-sm font-medium">Notifications</span>
            <button
              onClick={() => { setOpen(false); navigate({ to: "/app/notifications" }); }}
              className="text-xs text-primary hover:underline"
            >
              View all
            </button>
          </div>
          {recent.length === 0 ? (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">No new alerts.</div>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              {recent.map((n: any) => {
                const NIcon = BELL_ICON[n.type] ?? Bell;
                return (
                  <button
                    key={n.id}
                    onClick={() => {
                      setOpen(false);
                      if (n.link) navigate({ to: n.link });
                    }}
                    className="flex w-full items-start gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent/50"
                  >
                    <div className="mt-0.5">
                      <NIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium leading-snug">{n.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2">{n.message}</div>
                      <div className="mt-1 text-[10px] text-muted-foreground">{formatDate(n.created_at)}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, organizations, currentOrgId, roles, setCurrentOrg, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const currentOrg = organizations.find((o) => o.id === currentOrgId);
  const visibleNav = nav.filter((item) => canAccessPath(roles, item.to));
  const allowed = canAccessPath(roles, location.pathname);


  return (
    <div className="flex min-h-screen bg-muted/20">
      <aside className="flex w-60 flex-col border-r bg-card">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <div className="text-base font-semibold tracking-tight">CaterFlow</div>
            <div className="mt-1 text-xs text-muted-foreground">{currentOrg?.name ?? "No workspace"}</div>
          </div>
          <NotificationBell />
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {visibleNav.map((item) => {
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
        <div className="flex items-center justify-end border-b bg-card/50 px-6 py-2 md:px-8">
          <CommandPalette />
        </div>
        <div className="mx-auto max-w-7xl p-6 md:p-8">
          {allowed ? (
            children
          ) : (
            <div className="mx-auto max-w-md rounded-lg border bg-card p-8 text-center">
              <h1 className="text-lg font-semibold">Access restricted</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Your role doesn’t have permission to view this page. Contact a workspace admin if you need access.
              </p>
              <Button className="mt-4" variant="outline" onClick={() => navigate({ to: "/app" })}>
                Back to dashboard
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
