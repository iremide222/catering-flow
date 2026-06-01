import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency, formatDate } from "@/lib/format";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/purchase-orders/$id")({
  head: () => ({ meta: [{ title: "PO — CaterFlow" }] }),
  component: PoDetail,
});

const STATUSES = ["draft", "ordered", "partial", "received", "closed", "cancelled"];

function PoDetail() {
  const { id } = Route.useParams();
  const { currentOrgId, organizations } = useAuth();
  const qc = useQueryClient();
  const currency = organizations.find((o) => o.id === currentOrgId)?.currency ?? "USD";

  const { data } = useQuery({
    queryKey: ["po", id],
    queryFn: async () => {
      const [{ data: po }, { data: items }, { data: itemList }, { data: locations }] = await Promise.all([
        supabase.from("purchase_orders").select("*, suppliers(name), events(title), locations(name)").eq("id", id).maybeSingle(),
        supabase.from("purchase_order_items").select("*, items(name, unit)").eq("purchase_order_id", id).order("created_at"),
        supabase.from("items").select("id,name,unit,default_cost").eq("organization_id", currentOrgId!).order("name"),
        supabase.from("locations").select("id,name").eq("organization_id", currentOrgId!).order("name"),
      ]);
      return { po, items: items ?? [], itemList: itemList ?? [], locations: locations ?? [] };
    },
    enabled: !!currentOrgId,
  });

  const [line, setLine] = useState({ item_id: "", quantity: "1", unit_price: "0" });
  const [receiveQty, setReceiveQty] = useState<Record<string, string>>({});

  const recalc = async () => {
    const { data: items } = await supabase.from("purchase_order_items").select("quantity, unit_price").eq("purchase_order_id", id);
    const subtotal = (items ?? []).reduce((s, i: any) => s + Number(i.quantity) * Number(i.unit_price), 0);
    const { data: po } = await supabase.from("purchase_orders").select("tax_rate").eq("id", id).maybeSingle();
    const tax = subtotal * (Number(po?.tax_rate ?? 0) / 100);
    await supabase.from("purchase_orders").update({ subtotal, total: subtotal + tax }).eq("id", id);
  };

  const addLine = async () => {
    if (!line.item_id) return;
    const itm = data?.itemList.find((i: any) => i.id === line.item_id);
    const { error } = await supabase.from("purchase_order_items").insert({
      purchase_order_id: id,
      item_id: line.item_id,
      quantity: Number(line.quantity),
      unit_price: Number(line.unit_price || itm?.default_cost || 0),
    });
    if (error) return toast.error(error.message);
    setLine({ item_id: "", quantity: "1", unit_price: "0" });
    await recalc();
    qc.invalidateQueries({ queryKey: ["po", id] });
  };

  const removeLine = async (lineId: string) => {
    const { error } = await supabase.from("purchase_order_items").delete().eq("id", lineId);
    if (error) return toast.error(error.message);
    await recalc();
    qc.invalidateQueries({ queryKey: ["po", id] });
  };

  const updateStatus = async (status: string) => {
    const { error } = await supabase.from("purchase_orders").update({ status: status as any }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["po", id] });
  };

  const receive = async (lineId: string) => {
    const qty = Number(receiveQty[lineId] || 0);
    if (!qty || qty <= 0) return toast.error("Enter quantity");
    if (!data?.po?.location_id) return toast.error("Set a receive location on the PO header first");
    const { error } = await supabase.rpc("receive_po_item", {
      _po_item_id: lineId, _quantity: qty, _location_id: data.po.location_id,
    });
    if (error) return toast.error(error.message);
    toast.success("Received");
    setReceiveQty({ ...receiveQty, [lineId]: "" });
    qc.invalidateQueries({ queryKey: ["po", id] });
    qc.invalidateQueries({ queryKey: ["stock-totals"] });
  };

  if (!data?.po) return <div className="text-sm text-muted-foreground">Loading…</div>;
  const p = data.po;

  return (
    <div className="space-y-6">
      <Link to="/app/purchase-orders" className="text-sm text-muted-foreground hover:underline">← Purchase Orders</Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{p.order_number ?? `PO ${p.id.slice(0, 8)}`}</h1>
          <div className="mt-1 text-sm text-muted-foreground">
            {p.suppliers?.name} · expected {formatDate(p.expected_date)} · receive to {p.locations?.name ?? "—"}
            {p.events && <> · event <Link to="/app/events/$id" params={{ id: p.event_id }} className="text-primary hover:underline">{p.events.title}</Link></>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Select value={p.status} onValueChange={updateStatus}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Badge variant="secondary">{formatCurrency(Number(p.total), currency)}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Items</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Item</TableHead><TableHead className="w-20">Ordered</TableHead><TableHead className="w-20">Received</TableHead>
              <TableHead className="w-28">Unit price</TableHead><TableHead className="w-28 text-right">Subtotal</TableHead>
              <TableHead className="w-56">Receive</TableHead><TableHead className="w-10"></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.items.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">No items yet.</TableCell></TableRow>
              ) : data.items.map((i: any) => {
                const remaining = Number(i.quantity) - Number(i.received_quantity);
                return (
                  <TableRow key={i.id}>
                    <TableCell>{i.items?.name ?? "—"} <span className="text-xs text-muted-foreground">({i.items?.unit})</span></TableCell>
                    <TableCell>{i.quantity}</TableCell>
                    <TableCell>{i.received_quantity}</TableCell>
                    <TableCell>{formatCurrency(Number(i.unit_price), currency)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(i.quantity) * Number(i.unit_price), currency)}</TableCell>
                    <TableCell>
                      {remaining > 0 ? (
                        <div className="flex gap-1">
                          <Input className="h-8 w-20" type="number" min={0} max={remaining} step={0.01}
                            value={receiveQty[i.id] ?? ""} placeholder={String(remaining)}
                            onChange={(e) => setReceiveQty({ ...receiveQty, [i.id]: e.target.value })} />
                          <Button size="sm" variant="outline" onClick={() => receive(i.id)}>Receive</Button>
                        </div>
                      ) : <Badge variant="outline">Complete</Badge>}
                    </TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={() => removeLine(i.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="grid grid-cols-12 gap-2 border-t pt-4">
            <div className="col-span-5">
              <Select value={line.item_id} onValueChange={(v) => {
                const itm = data.itemList.find((x: any) => x.id === v);
                setLine({ ...line, item_id: v, unit_price: itm ? String(itm.default_cost) : line.unit_price });
              }}>
                <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                <SelectContent>
                  {data.itemList.map((i: any) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Input className="col-span-2" type="number" min={0} step={0.01} value={line.quantity} onChange={(e) => setLine({ ...line, quantity: e.target.value })} />
            <Input className="col-span-3" type="number" min={0} step={0.01} value={line.unit_price} onChange={(e) => setLine({ ...line, unit_price: e.target.value })} />
            <Button className="col-span-2" onClick={addLine} disabled={!line.item_id}>Add</Button>
          </div>
        </CardContent>
      </Card>

      {p.notes && (
        <Card>
          <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">{p.notes}</CardContent>
        </Card>
      )}
    </div>
  );
}
