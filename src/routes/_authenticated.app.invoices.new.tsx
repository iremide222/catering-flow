import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuditLog } from "@/lib/use-audit";

export const Route = createFileRoute("/_authenticated/app/invoices/new")({
  head: () => ({ meta: [{ title: "New invoice — CaterFlow" }] }),
  component: NewInvoice,
});

type Line = { description: string; quantity: string; unit_price: string };
const emptyLine: Line = { description: "", quantity: "1", unit_price: "0" };

function NewInvoice() {
  const { currentOrgId, user } = useAuth();
  const navigate = useNavigate();
  const audit = useAuditLog();
  const [number, setNumber] = useState("");
  const [customerId, setCustomerId] = useState("none");
  const [eventId, setEventId] = useState("none");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [taxAmount, setTaxAmount] = useState("0");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ ...emptyLine }]);
  const [saving, setSaving] = useState(false);

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-lite", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("id, name").eq("organization_id", currentOrgId!).order("name");
      return data ?? [];
    },
  });

  const { data: events = [] } = useQuery({
    queryKey: ["events-lite-inv", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data } = await supabase.from("events").select("id, title, customer_id, total_amount").eq("organization_id", currentOrgId!).order("event_date", { ascending: false });
      return data ?? [];
    },
  });

  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unit_price || 0), 0),
    [lines],
  );
  const total = subtotal + Number(taxAmount || 0);

  const prefillFromEvent = (id: string) => {
    setEventId(id);
    if (id === "none") return;
    const ev = events.find((e: any) => e.id === id);
    if (ev?.customer_id) setCustomerId(ev.customer_id);
    if (ev && Number(ev.total_amount) > 0 && lines.length === 1 && !lines[0].description) {
      setLines([{ description: `Catering for ${ev.title}`, quantity: "1", unit_price: String(ev.total_amount) }]);
    }
  };

  const submit = async () => {
    if (!currentOrgId || !user) return;
    if (!number.trim()) return toast.error("Invoice number is required");
    const validLines = lines.filter((l) => l.description.trim());
    if (validLines.length === 0) return toast.error("Add at least one line item");
    setSaving(true);
    const { data: inv, error } = await supabase
      .from("invoices")
      .insert({
        organization_id: currentOrgId,
        created_by: user.id,
        invoice_number: number.trim(),
        customer_id: customerId !== "none" ? customerId : null,
        event_id: eventId !== "none" ? eventId : null,
        issue_date: issueDate,
        due_date: dueDate || null,
        tax_amount: Number(taxAmount || 0),
        notes: notes || null,
        status: "draft",
      })
      .select("id")
      .single();
    if (error || !inv) { setSaving(false); return toast.error(error?.message ?? "Failed"); }
    const itemsPayload = validLines.map((l) => ({
      organization_id: currentOrgId,
      invoice_id: inv.id,
      description: l.description,
      quantity: Number(l.quantity || 0),
      unit_price: Number(l.unit_price || 0),
      total: Number(l.quantity || 0) * Number(l.unit_price || 0),
    }));
    const { error: itemsErr } = await supabase.from("invoice_items").insert(itemsPayload);
    setSaving(false);
    if (itemsErr) return toast.error(itemsErr.message);
    audit("create", "invoice", inv.id, { invoice_number: number.trim(), total });
    toast.success("Invoice created");
    navigate({ to: "/app/invoices/$id", params: { id: inv.id } });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New invoice</h1>
        <p className="text-sm text-muted-foreground">Create an invoice from scratch or link to an event.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div><Label>Invoice number *</Label><Input placeholder="INV-0001" value={number} onChange={(e) => setNumber(e.target.value)} /></div>
            <div>
              <Label>Customer</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {customers.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Linked event</Label>
              <Select value={eventId} onValueChange={prefillFromEvent}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {events.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Issue date</Label><Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></div>
              <div><Label>Due date</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Line items</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setLines([...lines, { ...emptyLine }])}><Plus className="mr-1 h-3.5 w-3.5" /> Add line</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {lines.map((l, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2">
              <Input className="col-span-6" placeholder="Description" value={l.description} onChange={(e) => setLines(lines.map((x, i) => i === idx ? { ...x, description: e.target.value } : x))} />
              <Input className="col-span-2" type="number" step="0.01" placeholder="Qty" value={l.quantity} onChange={(e) => setLines(lines.map((x, i) => i === idx ? { ...x, quantity: e.target.value } : x))} />
              <Input className="col-span-3" type="number" step="0.01" placeholder="Unit price" value={l.unit_price} onChange={(e) => setLines(lines.map((x, i) => i === idx ? { ...x, unit_price: e.target.value } : x))} />
              <Button variant="ghost" size="icon" className="col-span-1" onClick={() => setLines(lines.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <div className="grid grid-cols-12 gap-2 border-t pt-3">
            <div className="col-span-8 text-right text-sm text-muted-foreground">Subtotal</div>
            <div className="col-span-3 text-right tabular-nums text-sm">{subtotal.toFixed(2)}</div>
          </div>
          <div className="grid grid-cols-12 items-center gap-2">
            <div className="col-span-8 text-right text-sm text-muted-foreground">Tax</div>
            <Input className="col-span-3 text-right" type="number" step="0.01" value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} />
          </div>
          <div className="grid grid-cols-12 gap-2 border-t pt-3">
            <div className="col-span-8 text-right text-sm font-medium">Total</div>
            <div className="col-span-3 text-right tabular-nums text-base font-semibold">{total.toFixed(2)}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
        <CardContent>
          <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Payment terms, bank details…" />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate({ to: "/app/invoices" })}>Cancel</Button>
        <Button onClick={submit} disabled={saving}>{saving ? "Creating…" : "Create invoice"}</Button>
      </div>
    </div>
  );
}
