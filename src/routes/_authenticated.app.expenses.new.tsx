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
import { useState } from "react";
import { toast } from "sonner";
import { useAuditLog } from "@/lib/use-audit";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/app/expenses/new")({
  head: () => ({ meta: [{ title: "New expense — CaterFlow" }] }),
  validateSearch: z.object({ event: z.string().optional() }),
  component: NewExpense,
});

const PAYMENT_METHODS = ["Cash", "Bank transfer", "Card", "Mobile money", "Check", "Other"];

function NewExpense() {
  const { currentOrgId, user } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const audit = useAuditLog();

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState("none");
  const [eventId, setEventId] = useState(search.event ?? "none");
  const [supplierId, setSupplierId] = useState("none");
  const [paymentMethod, setPaymentMethod] = useState("none");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ["expense-categories", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data } = await supabase
        .from("expense_categories")
        .select("id, name")
        .eq("organization_id", currentOrgId!)
        .eq("is_active", true)
        .order("name");
      return data ?? [];
    },
  });

  const { data: events = [] } = useQuery({
    queryKey: ["events-lite-exp", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, title")
        .eq("organization_id", currentOrgId!)
        .order("event_date", { ascending: false });
      return data ?? [];
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-lite", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data } = await supabase.from("suppliers").select("id, name").eq("organization_id", currentOrgId!).order("name");
      return data ?? [];
    },
  });

  const submit = async () => {
    if (!currentOrgId || !user) return;
    if (!description.trim()) return toast.error("Description is required");
    const val = Number(amount);
    if (Number.isNaN(val) || val <= 0) return toast.error("Enter a valid amount greater than 0");
    if (!expenseDate) return toast.error("Date is required");

    setSaving(true);
    const { data: created, error } = await supabase
      .from("expenses")
      .insert({
        organization_id: currentOrgId,
        created_by: user.id,
        description: description.trim(),
        amount: val,
        expense_date: expenseDate,
        category_id: categoryId !== "none" ? categoryId : null,
        event_id: eventId !== "none" ? eventId : null,
        supplier_id: supplierId !== "none" ? supplierId : null,
        payment_method: paymentMethod !== "none" ? paymentMethod : null,
        reference: reference.trim() || null,
        notes: notes.trim() || null,
      })
      .select("id")
      .single();
    setSaving(false);

    if (error || !created) {
      return toast.error(error?.message ?? "Failed to save expense");
    }
    audit("create", "expense", created.id, { description: description.trim(), amount: val });
    toast.success("Expense recorded");
    navigate({ to: "/app/expenses" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New expense</h1>
        <p className="text-sm text-muted-foreground">Record an operational cost and optionally link it to an event.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label>Description *</Label>
            <Input placeholder="e.g. Ice delivery, venue deposit" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Amount *</Label>
            <Input type="number" min={0} step={0.01} placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Date *</Label>
            <Input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {categories.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Linked event</Label>
            <Select value={eventId} onValueChange={setEventId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {events.map((e: any) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Supplier</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {suppliers.map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Payment method</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Reference</Label>
            <Input placeholder="Receipt / transaction number" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Notes</Label>
            <Textarea rows={3} placeholder="Additional details…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate({ to: "/app/expenses" })}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={saving}>
          {saving ? "Saving…" : "Record expense"}
        </Button>
      </div>
    </div>
  );
}
