import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/inventory/new")({
  head: () => ({ meta: [{ title: "New item — CaterFlow" }] }),
  component: NewItem,
});

function NewItem() {
  const { currentOrgId } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", sku: "", unit: "unit", default_cost: "0", reorder_level: "0", description: "" });
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrgId || !form.name) return;
    setSaving(true);
    const { data, error } = await supabase.from("items").insert({
      organization_id: currentOrgId,
      name: form.name,
      sku: form.sku || null,
      unit: form.unit || "unit",
      default_cost: Number(form.default_cost) || 0,
      reorder_level: Number(form.reorder_level) || 0,
      description: form.description || null,
    }).select("id").single();
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Item created");
    navigate({ to: "/app/inventory/$id", params: { id: data!.id } });
  };

  return (
    <div className="space-y-6">
      <Link to="/app/inventory" className="text-sm text-muted-foreground hover:underline">← Inventory</Link>
      <h1 className="text-2xl font-semibold tracking-tight">New item</h1>
      <Card className="max-w-2xl">
        <CardHeader><CardTitle>Item details</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
              <div><Label>SKU</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
              <div><Label>Unit</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="kg, box, unit…" /></div>
              <div><Label>Default cost</Label><Input type="number" min={0} step={0.01} value={form.default_cost} onChange={(e) => setForm({ ...form, default_cost: e.target.value })} /></div>
              <div><Label>Reorder level</Label><Input type="number" min={0} step={0.01} value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} /></div>
            </div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} /></div>
            <div className="flex justify-end gap-2">
              <Link to="/app/inventory"><Button type="button" variant="outline">Cancel</Button></Link>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Create item"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
