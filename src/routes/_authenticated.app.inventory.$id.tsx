import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency, formatDate } from "@/lib/format";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/inventory/$id")({
  head: () => ({ meta: [{ title: "Item — CaterFlow" }] }),
  component: ItemDetail,
});

function ItemDetail() {
  const { id } = Route.useParams();
  const { currentOrgId, organizations, user } = useAuth();
  const qc = useQueryClient();
  const currency = organizations.find((o) => o.id === currentOrgId)?.currency ?? "USD";

  const { data } = useQuery({
    queryKey: ["item", id],
    queryFn: async () => {
      const [{ data: item }, { data: levels }, { data: movements }, { data: locations }] = await Promise.all([
        supabase.from("items").select("*").eq("id", id).maybeSingle(),
        supabase.from("stock_levels").select("*, locations(name)").eq("item_id", id),
        supabase.from("stock_movements").select("*, locations(name)").eq("item_id", id).order("created_at", { ascending: false }).limit(50),
        supabase.from("locations").select("id,name").eq("organization_id", currentOrgId!).order("name"),
      ]);
      return { item, levels: levels ?? [], movements: movements ?? [], locations: locations ?? [] };
    },
    enabled: !!currentOrgId,
  });

  const [mv, setMv] = useState({ type: "in", quantity: "1", location_id: "", reason: "" });

  const recordMovement = async () => {
    if (!data?.item || !mv.location_id || !user) return;
    const { error } = await supabase.from("stock_movements").insert({
      organization_id: data.item.organization_id,
      item_id: id,
      location_id: mv.location_id,
      type: mv.type as any,
      quantity: Number(mv.quantity),
      reason: mv.reason || null,
      created_by: user.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Movement recorded");
    setMv({ ...mv, quantity: "1", reason: "" });
    qc.invalidateQueries({ queryKey: ["item", id] });
    qc.invalidateQueries({ queryKey: ["stock-totals"] });
  };

  if (!data?.item) return <div className="text-sm text-muted-foreground">Loading…</div>;
  const i = data.item;
  const totalOnHand = data.levels.reduce((s, l: any) => s + Number(l.quantity), 0);
  const low = Number(i.reorder_level) > 0 && totalOnHand <= Number(i.reorder_level);

  return (
    <div className="space-y-6">
      <Link to="/app/inventory" className="text-sm text-muted-foreground hover:underline">← Inventory</Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{i.name}</h1>
          <div className="mt-1 text-sm text-muted-foreground">
            {i.sku ? `SKU ${i.sku} · ` : ""}{i.unit} · cost {formatCurrency(Number(i.default_cost), currency)} · reorder at {i.reorder_level}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {low && <Badge variant="destructive">Low stock</Badge>}
          <Badge variant="secondary">{totalOnHand} on hand</Badge>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Stock by location</CardTitle></CardHeader>
        <CardContent>
          {data.levels.length === 0 ? (
            <div className="py-4 text-center text-sm text-muted-foreground">No stock recorded yet.</div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Location</TableHead><TableHead className="text-right">Quantity</TableHead><TableHead>Updated</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.levels.map((l: any) => (
                  <TableRow key={l.id}>
                    <TableCell>{l.locations?.name ?? "—"}</TableCell>
                    <TableCell className="text-right">{l.quantity}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(l.updated_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Record movement</CardTitle></CardHeader>
        <CardContent>
          {data.locations.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Add a location first in <Link to="/app/settings" className="text-primary hover:underline">Settings → Locations</Link>.
            </div>
          ) : (
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-3"><Label>Type</Label>
                <Select value={mv.type} onValueChange={(v) => setMv({ ...mv, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in">Stock in</SelectItem>
                    <SelectItem value="out">Stock out</SelectItem>
                    <SelectItem value="adjust">Adjust</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2"><Label>Qty</Label>
                <Input type="number" step={0.01} value={mv.quantity} onChange={(e) => setMv({ ...mv, quantity: e.target.value })} />
              </div>
              <div className="col-span-3"><Label>Location</Label>
                <Select value={mv.location_id} onValueChange={(v) => setMv({ ...mv, location_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {data.locations.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-3"><Label>Reason</Label>
                <Input value={mv.reason} onChange={(e) => setMv({ ...mv, reason: e.target.value })} placeholder="optional" />
              </div>
              <div className="col-span-1 flex items-end"><Button onClick={recordMovement} disabled={!mv.location_id}>Save</Button></div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent movements</CardTitle></CardHeader>
        <CardContent className="p-0">
          {data.movements.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">No movements yet.</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Location</TableHead>
                <TableHead className="text-right">Qty</TableHead><TableHead>Reason</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data.movements.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-muted-foreground">{formatDate(m.created_at)}</TableCell>
                    <TableCell><Badge variant={m.type === "out" ? "destructive" : "outline"}>{m.type}</Badge></TableCell>
                    <TableCell>{m.locations?.name ?? "—"}</TableCell>
                    <TableCell className="text-right">{m.quantity}</TableCell>
                    <TableCell className="text-muted-foreground">{m.reason ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
