import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/quotations/")({
  head: () => ({ meta: [{ title: "Quotations — CaterFlow" }] }),
  component: QuotationsList,
});

function QuotationsList() {
  const { currentOrgId, organizations } = useAuth();
  const currency = organizations.find((o) => o.id === currentOrgId)?.currency ?? "USD";

  const { data: quotes = [] } = useQuery({
    queryKey: ["quotations", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotations")
        .select("id,version,status,total,created_at, events!inner(id,title,organization_id,customers(name))")
        .eq("events.organization_id", currentOrgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Quotations</h1>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">No quotations yet.</TableCell></TableRow>
              ) : quotes.map((q: any) => (
                <TableRow key={q.id}>
                  <TableCell><Link to="/app/events/$id" params={{ id: q.events.id }} className="font-medium hover:underline">{q.events.title}</Link></TableCell>
                  <TableCell className="text-muted-foreground">{q.events.customers?.name ?? "—"}</TableCell>
                  <TableCell>v{q.version}</TableCell>
                  <TableCell><Badge variant="outline">{q.status}</Badge></TableCell>
                  <TableCell>{formatDate(q.created_at)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(q.total), currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
