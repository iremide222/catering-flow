import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/follow-ups/")({
  head: () => ({ meta: [{ title: "Follow-ups — CaterFlow" }] }),
  component: FollowUps,
});

function FollowUps() {
  const { currentOrgId, user } = useAuth();
  const qc = useQueryClient();

  const { data: items = [] } = useQuery({
    queryKey: ["follow-ups", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("follow_ups")
        .select("id,due_date,note,done,customer_id,customers(name)")
        .eq("organization_id", currentOrgId!)
        .order("done")
        .order("due_date");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-list", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("id,name").eq("organization_id", currentOrgId!).order("name");
      return data ?? [];
    },
  });

  const [form, setForm] = useState({ due_date: "", note: "", customer_id: "" });

  const addFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrgId || !user || !form.due_date) return;
    const { error } = await supabase.from("follow_ups").insert({
      organization_id: currentOrgId,
      created_by: user.id,
      due_date: form.due_date,
      note: form.note || null,
      customer_id: form.customer_id || null,
    });
    if (error) return toast.error(error.message);
    setForm({ due_date: "", note: "", customer_id: "" });
    qc.invalidateQueries({ queryKey: ["follow-ups", currentOrgId] });
  };

  const toggle = async (id: string, done: boolean) => {
    await supabase.from("follow_ups").update({ done }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["follow-ups", currentOrgId] });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Follow-ups</h1>

      <Card>
        <CardHeader><CardTitle>New follow-up</CardTitle></CardHeader>
        <CardContent>
          <form className="grid gap-2 md:grid-cols-12" onSubmit={addFollowUp}>
            <Input className="md:col-span-3" type="date" required value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            <Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}>
              <SelectTrigger className="md:col-span-3"><SelectValue placeholder="Customer (optional)" /></SelectTrigger>
              <SelectContent>{customers.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            <Input className="md:col-span-4" placeholder="Note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            <Button className="md:col-span-2" type="submit">Add</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="divide-y p-0">
          {items.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No follow-ups.</div>
          ) : items.map((it: any) => (
            <div key={it.id} className={`flex items-center gap-3 p-4 ${it.done ? "opacity-50" : ""}`}>
              <Checkbox checked={it.done} onCheckedChange={(v) => toggle(it.id, !!v)} />
              <div className="flex-1">
                <div className={it.done ? "line-through" : "font-medium"}>{it.note || "(no note)"}</div>
                <div className="text-xs text-muted-foreground">Due {formatDate(it.due_date)}{it.customers ? ` · ${it.customers.name}` : ""}</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
