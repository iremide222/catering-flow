import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/reports/")({
  head: () => ({ meta: [{ title: "Reports — CaterFlow" }] }),
  component: Reports,
});

function Reports() {
  const { currentOrgId, organizations } = useAuth();
  const currency = organizations.find((o) => o.id === currentOrgId)?.currency ?? "USD";

  const { data } = useQuery({
    queryKey: ["reports", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const orgId = currentOrgId!;
      const today = new Date();
      const startOfWindow = new Date(today.getFullYear(), today.getMonth() - 5, 1).toISOString().slice(0, 10);

      const [{ data: invoices }, { data: payments }, { data: events }, { data: pos }, { data: expenses }] = await Promise.all([
        supabase.from("invoices").select("id,total,amount_paid,status,issue_date,due_date,customer_id,customers(name)").eq("organization_id", orgId),
        supabase.from("payments").select("amount,payment_date").eq("organization_id", orgId).gte("payment_date", startOfWindow),
        supabase.from("events").select("id,total_amount,status,event_date").eq("organization_id", orgId).gte("event_date", startOfWindow),
        supabase.from("purchase_orders").select("total,status,created_at").eq("organization_id", orgId).gte("created_at", startOfWindow),
        supabase.from("expenses").select("amount,expense_date").eq("organization_id", orgId).gte("expense_date", startOfWindow),
      ]);

      // Monthly buckets last 6 months
      const months: { key: string; label: string; revenue: number; payments: number; spend: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        months.push({
          key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
          label: d.toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
          revenue: 0, payments: 0, spend: 0,
        });
      }
      const bucket = (dateStr: string) => months.find((m) => m.key === dateStr.slice(0, 7));
      (invoices ?? []).forEach((i: any) => {
        if (i.status === "void" || !i.issue_date) return;
        const b = bucket(i.issue_date);
        if (b) b.revenue += Number(i.total);
      });
      (payments ?? []).forEach((p: any) => {
        const b = bucket(p.payment_date);
        if (b) b.payments += Number(p.amount);
      });
      (pos ?? []).forEach((p: any) => {
        if (!p.created_at) return;
        const b = bucket(p.created_at);
        if (b) b.spend += Number(p.total ?? 0);
      });
      (expenses ?? []).forEach((x: any) => {
        if (!x.expense_date) return;
        const b = bucket(x.expense_date);
        if (b) b.spend += Number(x.amount ?? 0);
      });

      // AR aging
      const todayStr = today.toISOString().slice(0, 10);
      const buckets = { current: 0, d30: 0, d60: 0, d90: 0, d90plus: 0 };
      (invoices ?? []).forEach((i: any) => {
        const bal = Number(i.total) - Number(i.amount_paid);
        if (bal <= 0 || i.status === "void") return;
        if (!i.due_date || i.due_date >= todayStr) { buckets.current += bal; return; }
        const days = Math.floor((+new Date(todayStr) - +new Date(i.due_date)) / 86400000);
        if (days <= 30) buckets.d30 += bal;
        else if (days <= 60) buckets.d60 += bal;
        else if (days <= 90) buckets.d90 += bal;
        else buckets.d90plus += bal;
      });

      // Top customers by invoiced total
      const byCust = new Map<string, { name: string; total: number }>();
      (invoices ?? []).forEach((i: any) => {
        if (i.status === "void" || !i.customer_id) return;
        const cur = byCust.get(i.customer_id) ?? { name: i.customers?.name ?? "—", total: 0 };
        cur.total += Number(i.total);
        byCust.set(i.customer_id, cur);
      });
      const topCustomers = Array.from(byCust.values()).sort((a, b) => b.total - a.total).slice(0, 5);

      // Event status breakdown
      const statusCounts: Record<string, number> = {};
      (events ?? []).forEach((e: any) => { statusCounts[e.status] = (statusCounts[e.status] ?? 0) + 1; });

      return { months, buckets, topCustomers, statusCounts };
    },
  });

  if (!data) return null;
  const maxVal = Math.max(1, ...data.months.flatMap((m) => [m.revenue, m.payments, m.spend]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">Last 6 months of activity.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Revenue, payments & procurement</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-6 gap-3">
            {data.months.map((m) => (
              <div key={m.key} className="flex flex-col items-center gap-2">
                <div className="flex h-40 w-full items-end justify-center gap-1">
                  <Bar value={m.revenue} max={maxVal} className="bg-primary" title={`Revenue: ${formatCurrency(m.revenue, currency)}`} />
                  <Bar value={m.payments} max={maxVal} className="bg-emerald-500" title={`Payments: ${formatCurrency(m.payments, currency)}`} />
                  <Bar value={m.spend} max={maxVal} className="bg-amber-500" title={`Spend: ${formatCurrency(m.spend, currency)}`} />
                </div>
                <div className="text-xs text-muted-foreground">{m.label}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-center gap-4 text-xs text-muted-foreground">
            <Legend className="bg-primary" label="Revenue" />
            <Legend className="bg-emerald-500" label="Payments" />
            <Legend className="bg-amber-500" label="Spend" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Accounts receivable aging</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Bucket</TableHead><TableHead className="text-right">Outstanding</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                <AgingRow label="Current" value={data.buckets.current} currency={currency} />
                <AgingRow label="1–30 days" value={data.buckets.d30} currency={currency} />
                <AgingRow label="31–60 days" value={data.buckets.d60} currency={currency} />
                <AgingRow label="61–90 days" value={data.buckets.d90} currency={currency} />
                <AgingRow label="90+ days" value={data.buckets.d90plus} currency={currency} />
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Top customers</CardTitle></CardHeader>
          <CardContent>
            {data.topCustomers.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No invoiced customers yet.</div>
            ) : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Customer</TableHead><TableHead className="text-right">Invoiced</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {data.topCustomers.map((c, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(c.total, currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Events by status</CardTitle></CardHeader>
          <CardContent>
            {Object.keys(data.statusCounts).length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No events in window.</div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {Object.entries(data.statusCounts).map(([s, n]) => (
                  <div key={s} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                    <span className="capitalize">{s}</span>
                    <span className="font-semibold tabular-nums">{n}</span>
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

function Bar({ value, max, className, title }: { value: number; max: number; className: string; title: string }) {
  const pct = Math.max(0, (value / max) * 100);
  return <div title={title} className={`w-3 rounded-t ${className}`} style={{ height: `${pct}%` }} />;
}

function Legend({ className, label }: { className: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded ${className}`} />{label}</span>;
}

function AgingRow({ label, value, currency }: { label: string; value: number; currency: string }) {
  return (
    <TableRow>
      <TableCell>{label}</TableCell>
      <TableCell className="text-right tabular-nums">{formatCurrency(value, currency)}</TableCell>
    </TableRow>
  );
}
