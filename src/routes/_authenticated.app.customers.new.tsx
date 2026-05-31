import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/customers/new")({
  head: () => ({ meta: [{ title: "New customer — CaterFlow" }] }),
  component: NewCustomer,
});

function NewCustomer() {
  const { currentOrgId, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "", preferences: "", tags: "", notes: "" });
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrgId || !user) return;
    setBusy(true);
    const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
    const { data, error } = await supabase.from("customers").insert({
      organization_id: currentOrgId,
      created_by: user.id,
      name: form.name,
      email: form.email || null,
      phone: form.phone || null,
      address: form.address || null,
      preferences: form.preferences || null,
      notes: form.notes || null,
      tags,
    }).select("id").single();
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Customer created");
    navigate({ to: "/app/customers/$id", params: { id: data!.id } });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link to="/app/customers" className="text-sm text-muted-foreground hover:underline">← Customers</Link>
      <Card>
        <CardHeader><CardTitle>New customer</CardTitle></CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
            <Field label="Name" required>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </Field>
            <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="Tags (comma-separated)"><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="vip, wedding" /></Field>
            <Field label="Address" className="md:col-span-2"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
            <Field label="Preferences" className="md:col-span-2"><Textarea rows={2} value={form.preferences} onChange={(e) => setForm({ ...form, preferences: e.target.value })} placeholder="Dietary, recurring orders…" /></Field>
            <Field label="Notes" className="md:col-span-2"><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
            <div className="md:col-span-2"><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save customer"}</Button></div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, required, children, className }: { label: string; required?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label>{label}{required && <span className="text-destructive"> *</span>}</Label>
      {children}
    </div>
  );
}
