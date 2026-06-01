import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/purchase-orders/")({
  head: () => ({ meta: [{ title: "Purchase Orders — CaterFlow" }] }),
  component: PoList,
});

function PoList() {
  const { currentOrgId, organizations } = useAuth();
  const currency = organizations.find((o) => o.id === currentOrgId)?.currency ?? "USD";

  const { data: pos = [] } = useQuery({
    queryKey: ["pos", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("*, suppliers(name), events(title)")
        .eq("organization_id", currentOrgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Purchase Orders</h1>
        <Link to="/app/purchase-orders/new"><Button><Plus className="mr-2 h-4 w-4" /> New PO</Button></Link>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>PO #</TableHead><TableHead>Supplier</TableHead><TableHead>Event</TableHead>
              <TableHead>Status</TableHead><TableHead>Expected</TableHead><TableHead className="text-right">Total</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {pos.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">No purchase orders yet.</TableCell></TableRow>
              ) : pos.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link to="/app/purchase-orders/$id" params={{ id: p.id }} className="font-medium hover:underline">
                      {p.order_number ?? p.id.slice(0, 8)}
                    </Link>
                  </TableCell>
                  <TableCell>{p.suppliers?.name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{p.events?.title ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline">{p.status}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(p.expected_date)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(p.total), currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
