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

  if (!data?.customer) return <div className="text-sm text-muted-foreground">Loading…</div>;

  const c = data.customer;
  return (
    <div className="space-y-6">
      <Link to="/app/customers" className="text-sm text-muted-foreground hover:underline">← Customers</Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
        <div className="mt-1 text-sm text-muted-foreground">{c.email ?? "no email"} · {c.phone ?? "no phone"}</div>
        <div className="mt-2 flex flex-wrap gap-1">{(c.tags ?? []).map((t: string) => <Badge key={t} variant="secondary">{t}</Badge>)}</div>
      </div>

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
