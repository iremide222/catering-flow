import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/customers/$id")({
  head: () => ({ meta: [{ title: "Customer — CaterFlow" }] }),
  component: CustomerDetail,
});

function CustomerDetail() {
  const { id } = Route.useParams();
  const { organizations, currentOrgId } = useAuth();
  const currency = organizations.find((o) => o.id === currentOrgId)?.currency ?? "USD";

  const { data } = useQuery({
    queryKey: ["customer", id],
    queryFn: async () => {
      const [{ data: customer }, { data: events }] = await Promise.all([
        supabase.from("customers").select("*").eq("id", id).maybeSingle(),
        supabase.from("events").select("id,title,status,event_date,total_amount").eq("customer_id", id).order("event_date", { ascending: false }),
      ]);
      const totalSpend = (events ?? []).filter((e: any) => ["delivered", "closed"].includes(e.status)).reduce((s, e: any) => s + Number(e.total_amount ?? 0), 0);
      return { customer, events: events ?? [], totalSpend };
    },
  });

  if (!data?.customer) return <div className="text-sm text-muted-foreground">Loading…</div>;

  const c = data.customer;
  return (
    <div className="space-y-6">
      <Link to="/app/customers" className="text-sm text-muted-foreground hover:underline">← Customers</Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
        <div className="mt-1 text-sm text-muted-foreground">{c.email ?? "no email"} · {c.phone ?? "no phone"}</div>
        <div className="mt-2 flex flex-wrap gap-1">{(c.tags ?? []).map((t: string) => <Badge key={t} variant="secondary">{t}</Badge>)}</div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Events" value={data.events.length} />
        <Stat label="Lifetime spend" value={formatCurrency(data.totalSpend, currency)} />
        <Stat label="Last event" value={data.events[0]?.event_date ?? "—"} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row k="Address" v={c.address} />
            <Row k="Preferences" v={c.preferences} />
            <Row k="Notes" v={c.notes} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Event history</CardTitle></CardHeader>
          <CardContent>
            {data.events.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">No events yet.</div>
            ) : (
              <div className="divide-y">
                {data.events.map((e: any) => (
                  <Link key={e.id} to="/app/events/$id" params={{ id: e.id }} className="flex items-center justify-between py-3 hover:bg-accent/40">
                    <div>
                      <div className="font-medium">{e.title}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(e.event_date)} · {e.status}</div>
                    </div>
                    <div className="text-sm">{formatCurrency(Number(e.total_amount ?? 0), currency)}</div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return <Card><CardContent className="p-6"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-semibold">{value}</div></CardContent></Card>;
}
function Row({ k, v }: { k: string; v?: string | null }) {
  return <div className="grid grid-cols-3 gap-2"><div className="text-muted-foreground">{k}</div><div className="col-span-2">{v || "—"}</div></div>;
}
