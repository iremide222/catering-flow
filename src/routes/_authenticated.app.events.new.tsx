import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/events/new")({
  head: () => ({ meta: [{ title: "New event — CaterFlow" }] }),
  component: NewEvent,
});

function NewEvent() {
  const { currentOrgId, user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "", customer_id: "", event_date: "", start_time: "", end_time: "",
    venue: "", guest_count: "", notes: "",
  });
  const [busy, setBusy] = useState(false);

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-list", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("id,name").eq("organization_id", currentOrgId!).order("name");
      return data ?? [];
    },
  });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrgId || !user) return;
    setBusy(true);
    const { data, error } = await supabase.from("events").insert({
      organization_id: currentOrgId,
      created_by: user.id,
      title: form.title,
      customer_id: form.customer_id || null,
      event_date: form.event_date || null,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      venue: form.venue || null,
      guest_count: form.guest_count ? Number(form.guest_count) : null,
      notes: form.notes || null,
    }).select("id").single();
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Event created");
    navigate({ to: "/app/events/$id", params: { id: data!.id } });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link to="/app/events" className="text-sm text-muted-foreground hover:underline">← Events</Link>
      <Card>
        <CardHeader><CardTitle>New event</CardTitle></CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
            <div className="space-y-2 md:col-span-2">
              <Label>Title <span className="text-destructive">*</span></Label>
              <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Customer</Label>
              <Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  {customers.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Event date</Label>
              <Input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
            </div>
            <div className="space-y-2"><Label>Start</Label><Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
            <div className="space-y-2"><Label>End</Label><Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></div>
            <div className="space-y-2 md:col-span-2"><Label>Venue</Label><Input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} /></div>
            <div className="space-y-2"><Label>Guest count</Label><Input type="number" min={0} value={form.guest_count} onChange={(e) => setForm({ ...form, guest_count: e.target.value })} /></div>
            <div className="space-y-2 md:col-span-2"><Label>Notes</Label><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="md:col-span-2"><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Create event"}</Button></div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
