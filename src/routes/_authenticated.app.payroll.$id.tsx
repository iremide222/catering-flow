import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/format";
import { exportCsv } from "@/lib/export-csv";
import { TableState } from "@/components/data-states";

export const Route = createFileRoute("/_authenticated/app/payroll/$id")({
  head: () => ({ meta: [{ title: "Pay run — CaterFlow" }] }),
  component: PayrollDetail,
});

function PayrollDetail() {
  const { id } = Route.useParams();
  const { currentOrgId, organizations } = useAuth();
  const currency = organizations.find((o) => o.id === currentOrgId)?.currency ?? "USD";
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: run } = useQuery({
    queryKey: ["payroll-run", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("payroll_runs").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: items = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["payroll-items", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_items")
        .select("*, staff_members(id, name, role_title)")
        .eq("payroll_run_id", id)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const locked = run?.status === "paid";

  const updateItem = async (itemId: string, adjustments: number, gross: number) => {
    const { error } = await supabase
      .from("payroll_items")
      .update({ adjustments, net_amount: Number((gross + adjustments).toFixed(2)) })
      .eq("id", itemId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["payroll-items", id] });
    qc.invalidateQueries({ queryKey: ["payroll-run", id] });
  };

  const removeItem = async (itemId: string) => {
    const { error } = await supabase.from("payroll_items").delete().eq("id", itemId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["payroll-items", id] });
    qc.invalidateQueries({ queryKey: ["payroll-run", id] });
  };

  const setStatus = async (status: string) => {
    const { error } = await supabase.from("payroll_runs").update({ status: status as any }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Pay run marked ${status}`);
    qc.invalidateQueries({ queryKey: ["payroll-run", id] });
    qc.invalidateQueries({ queryKey: ["payroll-runs"] });
  };

  const deleteRun = async () => {
    const { error } = await supabase.from("payroll_runs").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Pay run deleted");
    qc.invalidateQueries({ queryKey: ["payroll-runs"] });
    navigate({ to: "/app/payroll" });
  };

  const totalHours = items.reduce((s: number, i: any) => s + Number(i.hours ?? 0), 0);
  const totalNet = items.reduce((s: number, i: any) => s + Number(i.net_amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link to="/app/payroll" className="inline-flex items-center text-sm text-muted-foreground hover:underline">
            <ArrowLeft className="mr-1 h-4 w-4" /> Payroll
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {run ? `${formatDate(run.period_start)} – ${formatDate(run.period_end)}` : "Pay run"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {items.length} staff · {totalHours.toFixed(2)} hours ·{" "}
            <span className="font-medium text-foreground">{formatCurrency(totalNet, currency)}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {run && (
            <Select value={run.status} onValueChange={setStatus}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Button
            variant="outline"
            disabled={items.length === 0}
            onClick={() =>
              exportCsv(
                "payroll",
                [
                  { key: "staff", label: "Staff", get: (r: any) => r.staff_members?.name ?? "" },
                  { key: "role", label: "Role", get: (r: any) => r.staff_members?.role_title ?? "" },
                  { key: "hours", label: "Hours", get: (r: any) => Number(r.hours).toFixed(2) },
                  { key: "hourly_rate", label: "Rate", get: (r: any) => Number(r.hourly_rate).toFixed(2) },
                  { key: "gross_amount", label: "Gross", get: (r: any) => Number(r.gross_amount).toFixed(2) },
                  { key: "adjustments", label: "Adjustments", get: (r: any) => Number(r.adjustments).toFixed(2) },
                  { key: "net_amount", label: "Net", get: (r: any) => Number(r.net_amount).toFixed(2) },
                ],
                items,
              )
            }
          >
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
          <Button variant="ghost" onClick={deleteRun}>Delete</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Pay lines</CardTitle>
          {run && <Badge variant={run.status === "paid" ? "default" : "secondary"}>{run.status}</Badge>}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Adjustments</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableState
                colSpan={7}
                isLoading={isLoading}
                isError={isError}
                error={error}
                onRetry={() => refetch()}
                isEmpty={items.length === 0}
                emptyMessage="No pay lines. There was no attendance logged in this period."
              />
              {!isLoading && !isError && items.map((i: any) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">
                    {i.staff_members?.name ?? "—"}
                    {i.staff_members?.role_title && (
                      <span className="ml-2 text-xs text-muted-foreground">{i.staff_members.role_title}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{Number(i.hours).toFixed(2)}</TableCell>
                  <TableCell className="text-right tabular-nums">{Number(i.hourly_rate).toFixed(2)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(Number(i.gross_amount), currency)}</TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      step="0.01"
                      className="ml-auto h-8 w-28 text-right"
                      defaultValue={Number(i.adjustments).toFixed(2)}
                      disabled={locked}
                      onBlur={(e) => {
                        const v = Number(e.target.value || 0);
                        if (v !== Number(i.adjustments)) updateItem(i.id, v, Number(i.gross_amount));
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{formatCurrency(Number(i.net_amount), currency)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" disabled={locked} onClick={() => removeItem(i.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
