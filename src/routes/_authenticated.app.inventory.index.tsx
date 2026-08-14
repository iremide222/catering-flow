import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Plus } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { TableState } from "@/components/data-states";

export const Route = createFileRoute("/_authenticated/app/inventory/")({
  head: () => ({ meta: [{ title: "Inventory — CaterFlow" }] }),
  component: InventoryList,
});

function InventoryList() {
  const { currentOrgId, organizations } = useAuth();
  const currency = organizations.find((o) => o.id === currentOrgId)?.currency ?? "USD";
  const [q, setQ] = useState("");

  const { data: items = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["items", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("items")
        .select("id,sku,name,unit,default_cost,reorder_level,is_active")
        .eq("organization_id", currentOrgId!)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: stock = [] } = useQuery({
    queryKey: ["stock-totals", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_levels")
        .select("item_id,quantity")
        .eq("organization_id", currentOrgId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  const totals = stock.reduce<Record<string, number>>((acc, s: any) => {
    acc[s.item_id] = (acc[s.item_id] ?? 0) + Number(s.quantity);
    return acc;
  }, {});

  const filtered = items.filter((i: any) =>
    !q || [i.name, i.sku].some((x) => x?.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
        <Link to="/app/inventory/new"><Button><Plus className="mr-2 h-4 w-4" /> New item</Button></Link>
      </div>

      <Input placeholder="Search by name or SKU…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">On hand</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableState
                colSpan={6}
                isLoading={isLoading}
                isError={isError}
                error={error}
                onRetry={() => refetch()}
                isEmpty={filtered.length === 0}
                emptyMessage={items.length === 0 ? "No inventory items yet. Add an item to start tracking stock." : "No items match your search."}
              />
              {!isLoading && !isError && filtered.map((i: any) => {
                const onHand = totals[i.id] ?? 0;
                const low = i.reorder_level > 0 && onHand <= Number(i.reorder_level);
                return (
                  <TableRow key={i.id}>
                    <TableCell>
                      <Link to="/app/inventory/$id" params={{ id: i.id }} className="font-medium hover:underline">{i.name}</Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{i.sku ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{i.unit}</TableCell>
                    <TableCell className="text-right">
                      <span className={low ? "text-destructive font-medium" : ""}>{onHand}</span>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(i.default_cost), currency)}</TableCell>
                    <TableCell>
                      {low ? <Badge variant="destructive">Low stock</Badge> : i.is_active ? <Badge variant="outline">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
