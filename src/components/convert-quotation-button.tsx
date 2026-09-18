import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { useAuditLog } from "@/lib/use-audit";
import { toast } from "sonner";
import { FileText } from "lucide-react";

type Props = { quotationId: string; eventId: string };

/**
 * Turns an accepted quotation into a draft invoice: copies the event line items,
 * applies the quotation's tax and discount, and links the invoice to the event.
 */
export function ConvertQuotationButton({ quotationId, eventId }: Props) {
  const { currentOrgId, user, roles } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const audit = useAuditLog();
  const [busy, setBusy] = useState(false);
  const canBill = roles.some((r) => ["admin", "manager", "accountant"].includes(r));

  if (!canBill) return null;

  const convert = async () => {
    if (!currentOrgId || !user) return;
    setBusy(true);
    try {
      const { data: existing } = await supabase
        .from("invoices")
        .select("id")
        .eq("event_id", eventId)
        .limit(1)
        .maybeSingle();
      if (existing) {
        toast.error("This event already has an invoice.");
        navigate({ to: "/app/invoices/$id", params: { id: existing.id } });
        return;
      }

      const [{ data: quote }, { data: event }, { data: items }] = await Promise.all([
        supabase.from("quotations").select("tax_rate, discount, notes").eq("id", quotationId).single(),
        supabase.from("events").select("id, title, customer_id").eq("id", eventId).single(),
        supabase.from("event_items").select("name, description, quantity, unit_price").eq("event_id", eventId),
      ]);
      if (!event) throw new Error("Event not found");

      const lines = (items ?? []).length
        ? (items ?? []).map((i: any) => ({
            description: i.name + (i.description ? ` — ${i.description}` : ""),
            quantity: Number(i.quantity),
            unit_price: Number(i.unit_price),
          }))
        : [{ description: `Catering for ${event.title}`, quantity: 1, unit_price: 0 }];

      const subtotal = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
      const discount = Number(quote?.discount ?? 0);
      const taxAmount = ((subtotal - discount) * Number(quote?.tax_rate ?? 0)) / 100;

      const { count } = await supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", currentOrgId);
      const number = `INV-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(4, "0")}`;

      const { data: inv, error } = await supabase
        .from("invoices")
        .insert({
          organization_id: currentOrgId,
          created_by: user.id,
          invoice_number: number,
          customer_id: event.customer_id,
          event_id: event.id,
          issue_date: new Date().toISOString().slice(0, 10),
          tax_amount: taxAmount,
          notes: quote?.notes ?? null,
          status: "draft",
        })
        .select("id")
        .single();
      if (error || !inv) throw new Error(error?.message ?? "Failed to create invoice");

      const { error: itemsErr } = await supabase.from("invoice_items").insert(
        lines.map((l) => ({
          organization_id: currentOrgId,
          invoice_id: inv.id,
          description: l.description,
          quantity: l.quantity,
          unit_price: l.unit_price,
          total: l.quantity * l.unit_price,
        })),
      );
      if (itemsErr) throw new Error(itemsErr.message);

      await supabase.from("quotations").update({ status: "accepted" }).eq("id", quotationId);
      audit("convert", "quotation", quotationId, { invoice_id: inv.id, invoice_number: number });
      qc.invalidateQueries({ queryKey: ["quotations", currentOrgId] });
      qc.invalidateQueries({ queryKey: ["invoices", currentOrgId] });
      toast.success(`Invoice ${number} created`);
      navigate({ to: "/app/invoices/$id", params: { id: inv.id } });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not create the invoice");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="ghost" size="sm" onClick={convert} disabled={busy}>
      <FileText className="mr-1 h-3.5 w-3.5" />
      {busy ? "…" : "Invoice"}
    </Button>
  );
}
