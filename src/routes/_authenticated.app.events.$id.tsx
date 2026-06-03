import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency, formatDate } from "@/lib/format";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/events/$id")({
  head: () => ({ meta: [{ title: "Event — CaterFlow" }] }),
  component: EventDetail,
});

const STATUSES = ["inquiry", "quotation", "confirmed", "planning", "execution", "delivered", "closed", "cancelled"];

function EventDetail() {
  const { id } = Route.useParams();
  const { organizations, currentOrgId } = useAuth();
  const qc = useQueryClient();
  const currency = organizations.find((o) => o.id === currentOrgId)?.currency ?? "USD";

  const { data } = useQuery({
    queryKey: ["event", id],
    queryFn: async () => {
      const [{ data: event }, { data: items }, { data: quotes }, { data: assigns }, { data: tasks }] = await Promise.all([
        supabase.from("events").select("*, customers(id,name,email,phone)").eq("id", id).maybeSingle(),
        supabase.from("event_items").select("*").eq("event_id", id).order("created_at"),
        supabase.from("quotations").select("*").eq("event_id", id).order("version", { ascending: false }),
        supabase.from("event_staff_assignments").select("*, staff_members(id,name,role_title)").eq("event_id", id),
        supabase.from("tasks").select("*, staff_members:assigned_to_staff_id(name)").eq("event_id", id).order("created_at", { ascending: false }),
      ]);
      return { event, items: items ?? [], quotes: quotes ?? [], assigns: assigns ?? [], tasks: tasks ?? [] };
    },
  });

  const { data: staffList = [] } = useQuery({
    queryKey: ["staff-lite", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data } = await supabase.from("staff_members").select("id, name, role_title").eq("organization_id", currentOrgId!).eq("is_active", true).order("name");
      return data ?? [];
    },
  });

  const [staffPick, setStaffPick] = useState<string>("");
  const [staffRole, setStaffRole] = useState<string>("");

  const assignStaff = async () => {
    if (!staffPick) return;
    const { error } = await supabase.from("event_staff_assignments").insert({
      event_id: id, staff_member_id: staffPick, role: staffRole || null,
    });
    if (error) return toast.error(error.message);
    setStaffPick(""); setStaffRole("");
    qc.invalidateQueries({ queryKey: ["event", id] });
  };

  const unassignStaff = async (assignId: string) => {
    const { error } = await supabase.from("event_staff_assignments").delete().eq("id", assignId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["event", id] });
  };

  const [newItem, setNewItem] = useState({ name: "", quantity: "1", unit_price: "0" });

  const recalcTotal = async () => {
    const { data: items } = await supabase.from("event_items").select("quantity, unit_price").eq("event_id", id);
    const total = (items ?? []).reduce((s, i: any) => s + Number(i.quantity) * Number(i.unit_price), 0);
    await supabase.from("events").update({ total_amount: total }).eq("id", id);
  };

  const addItem = async () => {
    if (!newItem.name) return;
    const { error } = await supabase.from("event_items").insert({
      event_id: id, name: newItem.name, quantity: Number(newItem.quantity), unit_price: Number(newItem.unit_price),
    });
    if (error) return toast.error(error.message);
    setNewItem({ name: "", quantity: "1", unit_price: "0" });
    await recalcTotal();
    qc.invalidateQueries({ queryKey: ["event", id] });
  };

  const removeItem = async (itemId: string) => {
    const { error } = await supabase.from("event_items").delete().eq("id", itemId);
    if (error) return toast.error(error.message);
    await recalcTotal();
    qc.invalidateQueries({ queryKey: ["event", id] });
  };

  const updateStatus = async (status: string) => {
    const { error } = await supabase.from("events").update({ status: status as any }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Status updated");
    qc.invalidateQueries({ queryKey: ["event", id] });
  };

  const createQuotation = async () => {
    if (!data?.event) return;
    const nextVersion = (data.quotes[0]?.version ?? 0) + 1;
    const subtotal = data.items.reduce((s, i: any) => s + Number(i.quantity) * Number(i.unit_price), 0);
    const { error } = await supabase.from("quotations").insert({
      event_id: id, version: nextVersion, subtotal, total: subtotal,
    });
    if (error) return toast.error(error.message);
    toast.success(`Quotation v${nextVersion} created`);
    qc.invalidateQueries({ queryKey: ["event", id] });
  };

  if (!data?.event) return <div className="text-sm text-muted-foreground">Loading…</div>;
  const e = data.event;

  return (
    <div className="space-y-6">
      <Link to="/app/events" className="text-sm text-muted-foreground hover:underline">← Events</Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{e.title}</h1>
          <div className="mt-1 text-sm text-muted-foreground">
            {formatDate(e.event_date)} · {e.venue ?? "no venue"} · {e.guest_count ?? "—"} guests
          </div>
          {e.customers && (
            <div className="mt-1 text-sm">
              Customer: <Link to="/app/customers/$id" params={{ id: e.customers.id }} className="text-primary hover:underline">{e.customers.name}</Link>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Select value={e.status} onValueChange={updateStatus}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Badge variant="secondary">{formatCurrency(Number(e.total_amount ?? 0), currency)}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Menu / line items</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="w-24">Qty</TableHead>
                <TableHead className="w-32">Unit price</TableHead>
                <TableHead className="w-32 text-right">Subtotal</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">No items yet.</TableCell></TableRow>
              ) : data.items.map((i: any) => (
                <TableRow key={i.id}>
                  <TableCell>{i.name}</TableCell>
                  <TableCell>{i.quantity}</TableCell>
                  <TableCell>{formatCurrency(Number(i.unit_price), currency)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(i.quantity) * Number(i.unit_price), currency)}</TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => removeItem(i.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="grid grid-cols-12 gap-2 border-t pt-4">
            <Input className="col-span-5" placeholder="Item name" value={newItem.name} onChange={(ev) => setNewItem({ ...newItem, name: ev.target.value })} />
            <Input className="col-span-2" type="number" min={0} step={0.01} value={newItem.quantity} onChange={(ev) => setNewItem({ ...newItem, quantity: ev.target.value })} />
            <Input className="col-span-3" type="number" min={0} step={0.01} value={newItem.unit_price} onChange={(ev) => setNewItem({ ...newItem, unit_price: ev.target.value })} />
            <Button className="col-span-2" onClick={addItem}>Add</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Quotations</CardTitle>
          <Button size="sm" onClick={createQuotation}>New quotation from items</Button>
        </CardHeader>
        <CardContent>
          {data.quotes.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">No quotations yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.quotes.map((q: any) => (
                  <TableRow key={q.id}>
                    <TableCell>v{q.version}</TableCell>
                    <TableCell><Badge variant="outline">{q.status}</Badge></TableCell>
                    <TableCell>{formatDate(q.created_at)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(Number(q.total), currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {e.notes && (
        <Card>
          <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">{e.notes}</CardContent>
        </Card>
      )}
    </div>
  );
}
