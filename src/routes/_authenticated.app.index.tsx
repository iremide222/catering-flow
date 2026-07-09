import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Users, DollarSign, ArrowRight, Receipt, AlertTriangle, CheckSquare } from "lucide-react";
import { useEffect } from "react";
import { formatCurrency, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({ meta: [{ title: "Dashboard — CaterFlow" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { currentOrgId, organizations, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && organizations.length === 0 && !currentOrgId) {
      navigate({ to: "/app/onboarding" });
    }
  }, [loading, organizations.length, currentOrgId, navigate]);

  const currency = organizations.find((o) => o.id === currentOrgId)?.currency ?? "USD";

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const orgId = currentOrgId!;
      const today = new Date().toISOString().slice(0, 10);
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

      const [
        { count: customers },
        { count: events },
        { data: upcoming },
        { data: invoices },
        { data: items },
        { data: stockLevels },
        { data: openTasks },
      ] = await Promise.all([
        supabase.from("customers").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
        supabase.from("events").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
        supabase.from("events").select("id,title,event_date,status,total_amount").eq("organization_id", orgId).gte("event_date", today).order("event_date").limit(5),
        supabase.from("invoices").select("id,invoice_number,total,amount_paid,status,due_date,issue_date,customers(name)").eq("organization_id", orgId),
        supabase.from("items").select("id,name,unit,reorder_level").eq("organization_id", orgId).eq("is_active", true),
        supabase.from("stock_levels").select("item_id,quantity").eq("organization_id", orgId),
        supabase.from("tasks").select("id,title,status,priority,due_date").eq("organization_id", orgId).neq("status", "done").order("due_date", { ascending: true, nullsFirst: false }).limit(5),
      ]);

      const onHandByItem = new Map<string, number>();
      (stockLevels ?? []).forEach((s: any) => onHandByItem.set(s.item_id, (onHandByItem.get(s.item_id) ?? 0) + Number(s.quantity ?? 0)));
      const lowStock = (items ?? [])
        .map((i: any) => ({ ...i, onHand: onHandByItem.get(i.id) ?? 0 }))
        .filter((i: any) => Number(i.reorder_level) > 0 && i.onHand <= Number(i.reorder_level))
        .slice(0, 5);

      const outstanding = (invoices ?? []).reduce(
        (s: number, i: any) => s + Math.max(0, Number(i.total) - Number(i.amount_paid)),
        0,
      );
      const overdue = (invoices ?? []).filter(
        (i: any) => i.due_date && i.due_date < today && Number(i.total) - Number(i.amount_paid) > 0,
      );
      const revenueMTD = (invoices ?? [])
        .filter((i: any) => i.issue_date >= monthStart && i.status !== "void")
        .reduce((s: number, i: any) => s + Number(i.total), 0);

      return {
        customers: customers ?? 0,
        events: events ?? 0,
        upcoming: upcoming ?? [],
        outstanding,
        overdue: overdue.slice(0, 5),
        overdueCount: overdue.length,
        revenueMTD,
        lowStock,
        openTasks: openTasks ?? [],
      };
    },
  });

  if (!currentOrgId) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">At-a-glance view of your operation.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/app/reports"><Button variant="outline">Reports</Button></Link>
          <Link to="/app/events/new"><Button>New event</Button></Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={DollarSign} label="Revenue this month" value={stats ? formatCurrency(stats.revenueMTD, currency) : "—"} />
        <StatCard icon={Receipt} label="Outstanding AR" value={stats ? formatCurrency(stats.outstanding, currency) : "—"} sub={stats?.overdueCount ? `${stats.overdueCount} overdue` : undefined} />
        <StatCard icon={CalendarDays} label="Upcoming events" value={stats?.upcoming.length ?? "—"} />
        <StatCard icon={Users} label="Customers" value={stats?.customers ?? "—"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Upcoming events</CardTitle>
            <Link to="/app/events" className="text-xs text-muted-foreground hover:underline">View all</Link>
          </CardHeader>
          <CardContent>
            {!stats?.upcoming?.length ? (
              <EmptyState text="No upcoming events." />
            ) : (
              <div className="divide-y">
                {stats.upcoming.map((e: any) => (
                  <Link key={e.id} to="/app/events/$id" params={{ id: e.id }} className="flex items-center justify-between py-3 hover:bg-accent/40">
                    <div>
                      <div className="font-medium">{e.title}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(e.event_date)} · {e.status}</div>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="tabular-nums">{formatCurrency(Number(e.total_amount ?? 0), currency)}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Overdue invoices</CardTitle>
            <Link to="/app/invoices" className="text-xs text-muted-foreground hover:underline">View all</Link>
          </CardHeader>
          <CardContent>
            {!stats?.overdue?.length ? (
              <EmptyState text="No overdue invoices." />
            ) : (
              <div className="divide-y">
                {stats.overdue.map((i: any) => {
                  const bal = Number(i.total) - Number(i.amount_paid);
                  return (
                    <Link key={i.id} to="/app/invoices/$id" params={{ id: i.id }} className="flex items-center justify-between py-3 hover:bg-accent/40">
                      <div>
                        <div className="font-medium">{i.invoice_number}</div>
                        <div className="text-xs text-muted-foreground">{i.customers?.name ?? "—"} · due {formatDate(i.due_date)}</div>
                      </div>
                      <span className="text-sm tabular-nums">{formatCurrency(bal, currency)}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Low stock</CardTitle>
            <Link to="/app/inventory" className="text-xs text-muted-foreground hover:underline">View all</Link>
          </CardHeader>
          <CardContent>
            {!stats?.lowStock?.length ? (
              <EmptyState text="Stock levels look healthy." />
            ) : (
              <div className="divide-y">
                {stats.lowStock.map((i: any) => (
                  <Link key={i.id} to="/app/inventory/$id" params={{ id: i.id }} className="flex items-center justify-between py-3 hover:bg-accent/40">
                    <div>
                      <div className="font-medium">{i.name}</div>
                      <div className="text-xs text-muted-foreground">Reorder at {i.reorder_level} {i.unit}</div>
                    </div>
                    <Badge variant="destructive" className="tabular-nums">{i.onHand} {i.unit}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2"><CheckSquare className="h-4 w-4" /> Open tasks</CardTitle>
            <Link to="/app/tasks" className="text-xs text-muted-foreground hover:underline">View all</Link>
          </CardHeader>
          <CardContent>
            {!stats?.openTasks?.length ? (
              <EmptyState text="No open tasks." />
            ) : (
              <div className="divide-y">
                {stats.openTasks.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between py-3">
                    <div>
                      <div className="font-medium">{t.title}</div>
                      <div className="text-xs text-muted-foreground">{t.status}{t.due_date ? ` · due ${formatDate(t.due_date)}` : ""}</div>
                    </div>
                    <Badge variant="outline">{t.priority}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: any; sub?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-6">
        <div className="rounded-md bg-primary/10 p-3 text-primary"><Icon className="h-5 w-5" /></div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold tabular-nums">{value}</div>
          {sub && <div className="text-xs text-amber-600">{sub}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="py-8 text-center text-sm text-muted-foreground">{text}</div>;
}
