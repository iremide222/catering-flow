import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pencil } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useAuditLog } from "@/lib/use-audit";
import { formatCurrency, formatDate } from "@/lib/format";

const customerSchema = z.object({
  name: z.string().trim().min(1, { message: "Name is required" }).max(100, { message: "Name must be under 100 characters" }),
  email: z.union([z.string().trim().email({ message: "Invalid email address" }).max(255), z.literal("")]),
  phone: z.string().trim().max(30, { message: "Phone must be under 30 characters" }),
  address: z.string().trim().max(300, { message: "Address must be under 300 characters" }),
  preferences: z.string().trim().max(1000, { message: "Preferences must be under 1000 characters" }),
  tags: z.string().trim().max(200, { message: "Tags must be under 200 characters" }),
  notes: z.string().trim().max(2000, { message: "Notes must be under 2000 characters" }),
});

export const Route = createFileRoute("/_authenticated/app/customers/$id")({
  head: () => ({ meta: [{ title: "Customer — CaterFlow" }] }),
  component: CustomerDetail,
});

function CustomerDetail() {
  const { id } = Route.useParams();
  const { organizations, currentOrgId } = useAuth();
  const currency = organizations.find((o) => o.id === currentOrgId)?.currency ?? "USD";
  const qc = useQueryClient();
  const audit = useAuditLog();
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "", preferences: "", tags: "", notes: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data } = useQuery({
    queryKey: ["customer", id],
    queryFn: async () => {
      const [{ data: customer }, { data: events }] = await Promise.all([
        supabase.from("customers").select("*").eq("id", id).maybeSingle(),
        supabase.from("events").select("id,title,status,event_date,total_amount").eq("customer_id", id).order("event_date", { ascending: false }),
      ]);
      const totalSpend = (events ?? []).filter((e: any) => ["delivered", "closed"].includes(e.status)).reduce((s, e: any) => s + Number(e.total_amount ?? 0), 0);
      return { customer, events: events ?? [], totalSpend };
    },
  });

  const openEdit = () => {
    const cur = data?.customer as any;
    if (!cur) return;
    setForm({
      name: cur.name ?? "",
      email: cur.email ?? "",
      phone: cur.phone ?? "",
      address: cur.address ?? "",
      preferences: cur.preferences ?? "",
      tags: (cur.tags ?? []).join(", "),
      notes: cur.notes ?? "",
    });
    setErrors({});
    setEditOpen(true);
  };

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = customerSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSaving(true);
    const v = parsed.data;
    const { error } = await supabase
      .from("customers")
      .update({
        name: v.name,
        email: v.email || null,
        phone: v.phone || null,
        address: v.address || null,
        preferences: v.preferences || null,
        notes: v.notes || null,
        tags: v.tags.split(",").map((t) => t.trim()).filter(Boolean),
      })
      .eq("id", id);
    setSaving(false);
    if (error) {
      toast.error(error.message || "Could not update customer");
      return;
    }
    audit("update", "customer", id, { name: v.name });
    toast.success("Customer updated");
    setEditOpen(false);
    await qc.invalidateQueries({ queryKey: ["customer", id] });
    qc.invalidateQueries({ queryKey: ["customers"] });
  };

  if (!data?.customer) return <div className="text-sm text-muted-foreground">Loading…</div>;

  const c = data.customer;
  return (
    <div className="space-y-6">
      <Link to="/app/customers" className="text-sm text-muted-foreground hover:underline">← Customers</Link>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
          <div className="mt-1 text-sm text-muted-foreground">{c.email ?? "no email"} · {c.phone ?? "no phone"}</div>
          <div className="mt-2 flex flex-wrap gap-1">{(c.tags ?? []).map((t: string) => <Badge key={t} variant="secondary">{t}</Badge>)}</div>
        </div>
        <Button variant="outline" onClick={openEdit}><Pencil className="mr-2 h-4 w-4" /> Edit</Button>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit customer</DialogTitle></DialogHeader>
          <form onSubmit={onSave} className="space-y-3">
            <EditField label="Name" error={errors['name']}>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </EditField>
            <div className="grid grid-cols-2 gap-3">
              <EditField label="Email" error={errors['email']}>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </EditField>
              <EditField label="Phone" error={errors['phone']}>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </EditField>
            </div>
            <EditField label="Tags (comma-separated)" error={errors['tags']}>
              <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
            </EditField>
            <EditField label="Address" error={errors['address']}>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </EditField>
            <EditField label="Preferences" error={errors['preferences']}>
              <Textarea rows={2} value={form.preferences} onChange={(e) => setForm({ ...form, preferences: e.target.value })} />
            </EditField>
            <EditField label="Notes" error={errors['notes']}>
              <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </EditField>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setEditOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>


      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Events" value={data.events.length} />
        <Stat label="Lifetime spend" value={formatCurrency(data.totalSpend, currency)} />
        <Stat label="Last event" value={data.events[0]?.event_date ?? "—"} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row k="Address" v={c.address} />
            <Row k="Preferences" v={c.preferences} />
            <Row k="Notes" v={c.notes} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Event history</CardTitle></CardHeader>
          <CardContent>
            {data.events.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">No events yet.</div>
            ) : (
              <div className="divide-y">
                {data.events.map((e: any) => (
                  <Link key={e.id} to="/app/events/$id" params={{ id: e.id }} className="flex items-center justify-between py-3 hover:bg-accent/40">
                    <div>
                      <div className="font-medium">{e.title}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(e.event_date)} · {e.status}</div>
                    </div>
                    <div className="text-sm">{formatCurrency(Number(e.total_amount ?? 0), currency)}</div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return <Card><CardContent className="p-6"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-semibold">{value}</div></CardContent></Card>;
}
function Row({ k, v }: { k: string; v?: string | null }) {
  return <div className="grid grid-cols-3 gap-2"><div className="text-muted-foreground">{k}</div><div className="col-span-2">{v || "—"}</div></div>;
}
