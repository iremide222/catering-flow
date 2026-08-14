import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Download } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { exportCsv } from "@/lib/export-csv";
import { TableState } from "@/components/data-states";

export const Route = createFileRoute("/_authenticated/app/invoices/")({
  head: () => ({ meta: [{ title: "Invoices — CaterFlow" }] }),
  component: InvoicesList,
});

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  sent: "outline",
  partial: "default",
  paid: "default",
  void: "destructive",
};

function InvoicesList() {
  const { currentOrgId, organizations } = useAuth();
  const currency = organizations.find((o) => o.id === currentOrgId)?.currency ?? "USD";

  const { data: invoices = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["invoices", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, customers(name)")
        .eq("organization_id", currentOrgId!)
        .order("issue_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const outstanding = invoices.reduce(
    (sum: number, i: any) => sum + Math.max(0, Number(i.total) - Number(i.amount_paid)),
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground">
            Outstanding: <span className="font-medium text-foreground">{formatCurrency(outstanding, currency)}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() =>
              exportCsv(
                "invoices",
                [
                  { key: "invoice_number", label: "Number" },
                  { key: "customer", label: "Customer", get: (r: any) => r.customers?.name ?? "" },
                  { key: "issue_date", label: "Issued", get: (r: any) => formatDate(r.issue_date) },
                  { key: "due_date", label: "Due", get: (r: any) => formatDate(r.due_date) },
                  { key: "status", label: "Status" },
                  { key: "total", label: "Total", get: (r: any) => Number(r.total).toFixed(2) },
                  { key: "amount_paid", label: "Paid", get: (r: any) => Number(r.amount_paid).toFixed(2) },
                  { key: "balance", label: "Balance", get: (r: any) => (Number(r.total) - Number(r.amount_paid)).toFixed(2) },
                ],
                invoices,
              )
            }
            disabled={invoices.length === 0}
          >
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
          <Link to="/app/invoices/new"><Button><Plus className="mr-2 h-4 w-4" /> New invoice</Button></Link>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Number</TableHead><TableHead>Customer</TableHead><TableHead>Issued</TableHead>
              <TableHead>Due</TableHead><TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead><TableHead className="text-right">Balance</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              <TableState
                colSpan={7}
                isLoading={isLoading}
                isError={isError}
                error={error}
                onRetry={() => refetch()}
                isEmpty={invoices.length === 0}
                emptyMessage="No invoices yet. Create an invoice to start billing."
              />
              {!isLoading && !isError && invoices.map((inv: any) => {
                const bal = Number(inv.total) - Number(inv.amount_paid);
                return (
                  <TableRow key={inv.id} className="cursor-pointer">
                    <TableCell className="font-medium">
                      <Link to="/app/invoices/$id" params={{ id: inv.id }} className="hover:underline">{inv.invoice_number}</Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{inv.customers?.name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(inv.issue_date)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(inv.due_date)}</TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[inv.status]}>{inv.status}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(Number(inv.total), currency)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(bal, currency)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
