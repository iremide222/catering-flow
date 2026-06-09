import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { Download } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { generateQuotationPdf } from "@/lib/pdf.functions";
import { downloadBase64Pdf } from "@/lib/download-pdf";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/quotations/")({
  head: () => ({ meta: [{ title: "Quotations — CaterFlow" }] }),
  component: QuotationsList,
});

function QuotationsList() {
  const { currentOrgId, organizations } = useAuth();
  const currency = organizations.find((o) => o.id === currentOrgId)?.currency ?? "USD";

  const { data: quotes = [] } = useQuery({
    queryKey: ["quotations", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotations")
        .select("id,version,status,total,created_at, events!inner(id,title,organization_id,customers(name))")
        .eq("events.organization_id", currentOrgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Quotations</h1>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">No quotations yet.</TableCell></TableRow>
              ) : quotes.map((q: any) => (
                <TableRow key={q.id}>
                  <TableCell><Link to="/app/events/$id" params={{ id: q.events.id }} className="font-medium hover:underline">{q.events.title}</Link></TableCell>
                  <TableCell className="text-muted-foreground">{q.events.customers?.name ?? "—"}</TableCell>
                  <TableCell>v{q.version}</TableCell>
                  <TableCell><Badge variant="outline">{q.status}</Badge></TableCell>
                  <TableCell>{formatDate(q.created_at)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(q.total), currency)}</TableCell>
                  <TableCell className="text-right"><QuotationPdfButton id={q.id} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function QuotationPdfButton({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const makePdf = useServerFn(generateQuotationPdf);
  const onClick = async () => {
    setBusy(true);
    try {
      const res = await makePdf({ data: { id } });
      downloadBase64Pdf(res.base64, res.filename);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate PDF");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button variant="ghost" size="sm" onClick={onClick} disabled={busy}>
      <Download className="mr-1 h-3.5 w-3.5" />{busy ? "…" : "PDF"}
    </Button>
  );
}
