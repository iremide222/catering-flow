import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/purchase-orders/new")({
  head: () => ({ meta: [{ title: "New PO — CaterFlow" }] }),
  component: NewPo,
});

function NewPo() {
  const { currentOrgId, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ supplier_id: "", event_id: "", location_id: "", order_number: "", expected_date: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const { data: refs } = useQuery({
    queryKey: ["po-refs", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const [{ data: suppliers }, { data: events }, { data: locations }] = await Promise.all([
        supabase.from("suppliers").select("id,name").eq("organization_id", currentOrgId!).order("name"),
        supabase.from("events").select("id,title").eq("organization_id", currentOrgId!).order("created_at", { ascending: false }).limit(100),
        supabase.from("locations").select("id,name").eq("organization_id", currentOrgId!).order("name"),
      ]);
      return { suppliers: suppliers ?? [], events: events ?? [], locations: locations ?? [] };
    },
  });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrgId || !user || !form.supplier_id) return;
    setSaving(true);
    const { data, error } = await supabase.from("purchase_orders").insert({
      organization_id: currentOrgId,
      supplier_id: form.supplier_id,
      event_id: form.event_id || null,
      location_id: form.location_id || null,
      order_number: form.order_number || null,
      expected_date: form.expected_date || null,
      notes: form.notes || null,
      created_by: user.id,
    }).select("id").single();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("PO created");
    navigate({ to: "/app/purchase-orders/$id", params: { id: data!.id } });
  };

  return (
    <div className="space-y-6">
      <Link to="/app/purchase-orders" className="text-sm text-muted-foreground hover:underline">← Purchase Orders</Link>
      <h1 className="text-2xl font-semibold tracking-tight">New purchase order</h1>
      <Card className="max-w-2xl">
        <CardHeader><CardTitle>Header</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div><Label>Supplier *</Label>
              <Select value={form.supplier_id} onValueChange={(v) => setForm({ ...form, supplier_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>
                  {refs?.suppliers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Linked event</Label>
                <Select value={form.event_id} onValueChange={(v) => setForm({ ...form, event_id: v })}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    {refs?.events.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Receive to location</Label>
                <Select value={form.location_id} onValueChange={(v) => setForm({ ...form, location_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Choose later" /></SelectTrigger>
                  <SelectContent>
                    {refs?.locations.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>PO number</Label><Input value={form.order_number} onChange={(e) => setForm({ ...form, order_number: e.target.value })} placeholder="auto if blank" /></div>
              <div><Label>Expected date</Label><Input type="date" value={form.expected_date} onChange={(e) => setForm({ ...form, expected_date: e.target.value })} /></div>
            </div>
            <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="flex justify-end gap-2">
              <Link to="/app/purchase-orders"><Button type="button" variant="outline">Cancel</Button></Link>
              <Button type="submit" disabled={saving || !form.supplier_id}>{saving ? "Saving…" : "Create PO"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
