import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, ArrowLeft, Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/format";
import { useAuditLog } from "@/lib/use-audit";
import { useServerFn } from "@tanstack/react-start";
import { generateInvoicePdf } from "@/lib/pdf.functions";
import { downloadBase64Pdf } from "@/lib/download-pdf";

export const Route = createFileRoute("/_authenticated/app/invoices/$id")({
  head: () => ({ meta: [{ title: "Invoice — CaterFlow" }] }),
  component: InvoiceDetail,
});

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary", sent: "outline", partial: "default", paid: "default", void: "destructive",
};

function InvoiceDetail() {
  const { id } = Route.useParams();
  const { currentOrgId, organizations, user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const audit = useAuditLog();
  const currency = organizations.find((o) => o.id === currentOrgId)?.currency ?? "USD";
  const [payOpen, setPayOpen] = useState(false);
  const [pay, setPay] = useState({ amount: "", payment_date: new Date().toISOString().slice(0, 10), method: "", reference: "", notes: "" });
  const [pdfBusy, setPdfBusy] = useState(false);
  const makePdf = useServerFn(generateInvoicePdf);
  const downloadPdf = async () => {
    setPdfBusy(true);
    try {
      const res = await makePdf({ data: { id } });
      downloadBase64Pdf(res.base64, res.filename);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate PDF");
    } finally {
      setPdfBusy(false);
    }
  };

  const { data: invoice } = useQuery({
    queryKey: ["invoice", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, customers(name, email), events(title)")
        .eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["invoice-items", id],
    queryFn: async () => {
      const { data } = await supabase.from("invoice_items").select("*").eq("invoice_id", id).order("created_at");
      return data ?? [];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["payments", id],
    queryFn: async () => {
      const { data } = await supabase.from("payments").select("*").eq("invoice_id", id).order("payment_date", { ascending: false });
      return data ?? [];
    },
  });

  if (!invoice) return null;
  const balance = Number(invoice.total) - Number(invoice.amount_paid);

  const setStatus = async (status: string) => {
    const { error } = await supabase.from("invoices").update({ status: status as any }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["invoice", id] });
    qc.invalidateQueries({ queryKey: ["invoices"] });
  };

  const recordPayment = async () => {
    if (!currentOrgId || !user) return;
    const amt = Number(pay.amount);
    if (!amt || amt <= 0) return toast.error("Enter a positive amount");
    const { error } = await supabase.from("payments").insert({
      organization_id: currentOrgId,
      invoice_id: id,
      created_by: user.id,
      amount: amt,
      payment_date: pay.payment_date,
      method: pay.method || null,
      reference: pay.reference || null,
      notes: pay.notes || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Payment recorded");
    setPayOpen(false);
    setPay({ amount: "", payment_date: new Date().toISOString().slice(0, 10), method: "", reference: "", notes: "" });
    qc.invalidateQueries({ queryKey: ["payments", id] });
    qc.invalidateQueries({ queryKey: ["invoice", id] });
    qc.invalidateQueries({ queryKey: ["invoices"] });
  };

  const deletePayment = async (pid: string) => {
    const { error } = await supabase.from("payments").delete().eq("id", pid);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["payments", id] });
    qc.invalidateQueries({ queryKey: ["invoice", id] });
  };

  const deleteInvoice = async () => {
    if (!confirm("Delete this invoice?")) return;
    const { error } = await supabase.from("invoices").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Invoice deleted");
    navigate({ to: "/app/invoices" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/app/invoices" })}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{invoice.invoice_number}</h1>
            <p className="text-sm text-muted-foreground">
              {invoice.customers?.name ?? "—"}{invoice.events?.title ? ` · ${invoice.events.title}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={invoice.status} onValueChange={setStatus}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="void">Void</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant={STATUS_VARIANT[invoice.status]}>{invoice.status}</Badge>
          <Button variant="outline" size="sm" onClick={downloadPdf} disabled={pdfBusy}>
            <Download className="mr-1 h-4 w-4" />{pdfBusy ? "Preparing…" : "PDF"}
          </Button>
          <Button variant="outline" size="sm" onClick={deleteInvoice}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total" value={formatCurrency(Number(invoice.total), currency)} />
        <StatCard label="Paid" value={formatCurrency(Number(invoice.amount_paid), currency)} />
        <StatCard label="Balance" value={formatCurrency(balance, currency)} />
        <StatCard label="Due" value={formatDate(invoice.due_date)} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Line items</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Unit price</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {items.map((i: any) => (
                <TableRow key={i.id}>
                  <TableCell>{i.description}</TableCell>
                  <TableCell className="text-right tabular-nums">{Number(i.quantity)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(Number(i.unit_price), currency)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(Number(i.total), currency)}</TableCell>
                </TableRow>
              ))}
              <TableRow><TableCell colSpan={3} className="text-right text-muted-foreground">Subtotal</TableCell><TableCell className="text-right tabular-nums">{formatCurrency(Number(invoice.subtotal), currency)}</TableCell></TableRow>
              <TableRow><TableCell colSpan={3} className="text-right text-muted-foreground">Tax</TableCell><TableCell className="text-right tabular-nums">{formatCurrency(Number(invoice.tax_amount), currency)}</TableCell></TableRow>
              <TableRow><TableCell colSpan={3} className="text-right font-medium">Total</TableCell><TableCell className="text-right tabular-nums font-semibold">{formatCurrency(Number(invoice.total), currency)}</TableCell></TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Payments</CardTitle>
          <Dialog open={payOpen} onOpenChange={setPayOpen}>
            <DialogTrigger asChild><Button size="sm" disabled={balance <= 0}><Plus className="mr-1 h-3.5 w-3.5" /> Record payment</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Amount *</Label><Input type="number" step="0.01" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} placeholder={balance.toFixed(2)} /></div>
                  <div><Label>Date</Label><Input type="date" value={pay.payment_date} onChange={(e) => setPay({ ...pay, payment_date: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Method</Label><Input placeholder="Cash, Bank, Card…" value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })} /></div>
                  <div><Label>Reference</Label><Input value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} /></div>
                </div>
                <div><Label>Notes</Label><Input value={pay.notes} onChange={(e) => setPay({ ...pay, notes: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={recordPayment}>Record</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="p-0">
          {payments.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No payments recorded.</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Method</TableHead><TableHead>Reference</TableHead>
                <TableHead className="text-right">Amount</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {payments.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatDate(p.payment_date)}</TableCell>
                    <TableCell className="text-muted-foreground">{p.method ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{p.reference ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(Number(p.amount), currency)}</TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={() => deletePayment(p.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {invoice.notes && (
        <Card>
          <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm text-muted-foreground">{invoice.notes}</CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card><CardContent className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </CardContent></Card>
  );
}
