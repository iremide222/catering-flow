import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, Users, FileText, DollarSign, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({ meta: [{ title: "Dashboard — CaterFlow" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { currentOrgId, organizations, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && organizations.length === 0) navigate({ to: "/app/onboarding" });
  }, [loading, organizations.length, navigate]);

  const currency = organizations.find((o) => o.id === currentOrgId)?.currency ?? "USD";

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const orgId = currentOrgId!;
      const [{ count: customers }, { count: events }, { data: upcoming }, { data: revenue }] = await Promise.all([
        supabase.from("customers").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
        supabase.from("events").select("*", { count: "exact", head: true }).eq("organization_id", orgId),
        supabase.from("events").select("id,title,event_date,status,total_amount").eq("organization_id", orgId).gte("event_date", new Date().toISOString().slice(0, 10)).order("event_date").limit(5),
        supabase.from("events").select("total_amount").eq("organization_id", orgId).in("status", ["delivered", "closed"]),
      ]);
      const totalRevenue = (revenue ?? []).reduce((sum, r: any) => sum + Number(r.total_amount ?? 0), 0);
      return { customers: customers ?? 0, events: events ?? 0, upcoming: upcoming ?? [], totalRevenue };
    },
  });

  if (!currentOrgId) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <Link to="/app/events/new"><Button>New event</Button></Link>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon={Users} label="Customers" value={stats?.customers ?? "—"} />
        <StatCard icon={CalendarDays} label="Events" value={stats?.events ?? "—"} />
        <StatCard icon={FileText} label="Upcoming" value={stats?.upcoming.length ?? "—"} />
        <StatCard icon={DollarSign} label="Delivered revenue" value={stats ? formatCurrency(stats.totalRevenue, currency) : "—"} />
      </div>

      <Card>
        <CardHeader><CardTitle>Upcoming events</CardTitle></CardHeader>
        <CardContent>
          {!stats?.upcoming?.length ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No upcoming events.</div>
          ) : (
            <div className="divide-y">
              {stats.upcoming.map((e: any) => (
                <Link key={e.id} to="/app/events/$id" params={{ id: e.id }} className="flex items-center justify-between py-3 hover:bg-accent/40">
                  <div>
                    <div className="font-medium">{e.title}</div>
                    <div className="text-xs text-muted-foreground">{e.event_date} · {e.status}</div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span>{formatCurrency(Number(e.total_amount ?? 0), currency)}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: any }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-6">
        <div className="rounded-md bg-primary/10 p-3 text-primary"><Icon className="h-5 w-5" /></div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
