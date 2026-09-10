import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/format";
import { TableState } from "@/components/data-states";

export const Route = createFileRoute("/_authenticated/app/payroll/")({
  head: () => ({ meta: [{ title: "Payroll — CaterFlow" }] }),
  component: PayrollList,
});

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  draft: "secondary",
  approved: "outline",
  paid: "default",
};

function defaultPeriod() {
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { start, end };
}

function PayrollList() {
  const { currentOrgId, organizations, user } = useAuth();
  const currency = organizations.find((o) => o.id === currentOrgId)?.currency ?? "USD";
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState(defaultPeriod());
  const [busy, setBusy] = useState(false);

  const { data: runs = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["payroll-runs", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payroll_runs")
        .select("*")
        .eq("organization_id", currentOrgId!)
        .order("period_start", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const generate = async () => {
    if (!currentOrgId) return;
    setBusy(true);
    try {
      const { data: attendance, error: aErr } = await supabase
        .from("attendance_records")
        .select("staff_member_id, hours, staff_members(id, name, hourly_rate)")
        .eq("organization_id", currentOrgId)
        .gte("work_date", period.start)
        .lte("work_date", period.end);
      if (aErr) throw aErr;

      const totals = new Map<string, { hours: number; rate: number }>();
      for (const r of (attendance ?? []) as any[]) {
        const cur = totals.get(r.staff_member_id) ?? { hours: 0, rate: Number(r.staff_members?.hourly_rate ?? 0) };
        cur.hours += Number(r.hours ?? 0);
        totals.set(r.staff_member_id, cur);
      }

      const { data: run, error: rErr } = await supabase
        .from("payroll_runs")
        .insert({
          organization_id: currentOrgId,
          period_start: period.start,
          period_end: period.end,
          created_by: user?.id ?? null,
        })
        .select("id")
        .single();
      if (rErr) throw rErr;

      const items = [...totals.entries()].map(([staffId, v]) => ({
        organization_id: currentOrgId,
        payroll_run_id: run.id,
        staff_member_id: staffId,
        hours: Number(v.hours.toFixed(2)),
        hourly_rate: v.rate,
        gross_amount: Number((v.hours * v.rate).toFixed(2)),
        adjustments: 0,
        net_amount: Number((v.hours * v.rate).toFixed(2)),
      }));
      if (items.length > 0) {
        const { error: iErr } = await supabase.from("payroll_items").insert(items);
        if (iErr) throw iErr;
      }

      toast.success(items.length > 0 ? `Payroll run created with ${items.length} staff` : "Payroll run created (no attendance in period)");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["payroll-runs"] });
      navigate({ to: "/app/payroll/$id", params: { id: run.id } });
    } catch (e: any) {
      toast.error(e.message ?? "Could not create payroll run");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Payroll</h1>
          <p className="text-sm text-muted-foreground">Generate pay runs from logged attendance hours and staff rates.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> New pay run</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New pay run</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Period start</Label><Input type="date" value={period.start} onChange={(e) => setPeriod({ ...period, start: e.target.value })} /></div>
              <div><Label>Period end</Label><Input type="date" value={period.end} onChange={(e) => setPeriod({ ...period, end: e.target.value })} /></div>
            </div>
            <p className="text-xs text-muted-foreground">
              Hours are summed from attendance in this period and multiplied by each staff member’s hourly rate.
            </p>
            <DialogFooter><Button onClick={generate} disabled={busy}>{busy ? "Generating…" : "Generate"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableState
                colSpan={4}
                isLoading={isLoading}
                isError={isError}
                error={error}
                onRetry={() => refetch()}
                isEmpty={runs.length === 0}
                emptyMessage="No pay runs yet. Generate one from your attendance records."
              />
              {!isLoading && !isError && runs.map((r: any) => (
                <TableRow key={r.id} className="cursor-pointer">
                  <TableCell className="font-medium">
                    <Link to="/app/payroll/$id" params={{ id: r.id }} className="hover:underline">
                      {formatDate(r.period_start)} – {formatDate(r.period_end)}
                    </Link>
                  </TableCell>
                  <TableCell><Badge variant={STATUS_VARIANT[r.status] ?? "secondary"}>{r.status}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(r.created_at)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(Number(r.total_amount), currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
