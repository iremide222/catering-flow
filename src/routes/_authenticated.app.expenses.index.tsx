import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Download } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { exportCsv } from "@/lib/export-csv";
import { TableState } from "@/components/data-states";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/app/expenses/")({
  head: () => ({ meta: [{ title: "Expenses — CaterFlow" }] }),
  component: ExpensesList,
});

export default function ExpensesList() {
  const { currentOrgId, organizations } = useAuth();
  const currency = organizations.find((o) => o.id === currentOrgId)?.currency ?? "USD";
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const { data: categories = [] } = useQuery({
    queryKey: ["expense-categories", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data } = await supabase
        .from("expense_categories")
        .select("id, name, color")
        .eq("organization_id", currentOrgId!)
        .eq("is_active", true)
        .order("name");
      return data ?? [];
    },
  });

  const { data: expenses = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["expenses", currentOrgId, categoryFilter],
    enabled: !!currentOrgId,
    queryFn: async () => {
      let q = supabase
        .from("expenses")
        .select("*, expense_categories(id, name, color), events(id, title), suppliers(id, name)")
        .eq("organization_id", currentOrgId!)
        .order("expense_date", { ascending: false });
      if (categoryFilter !== "all") {
        q = q.eq("category_id", categoryFilter);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const total = expenses.reduce((sum: number, e: any) => sum + Number(e.amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Expenses</h1>
          <p className="text-sm text-muted-foreground">
            Total spent: <span className="font-medium text-foreground">{formatCurrency(total, currency)}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color ?? "#94a3b8" }} />
                    {c.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() =>
              exportCsv(
                "expenses",
                [
                  { key: "description", label: "Description" },
                  { key: "category", label: "Category", get: (r: any) => r.expense_categories?.name ?? "" },
                  { key: "event", label: "Event", get: (r: any) => r.events?.title ?? "" },
                  { key: "supplier", label: "Supplier", get: (r: any) => r.suppliers?.name ?? "" },
                  { key: "expense_date", label: "Date", get: (r: any) => formatDate(r.expense_date) },
                  { key: "payment_method", label: "Method" },
                  { key: "amount", label: "Amount", get: (r: any) => Number(r.amount).toFixed(2) },
                ],
                expenses,
              )
            }
            disabled={expenses.length === 0}
          >
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
          <Link to="/app/expenses/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" /> New expense
            </Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableState
                colSpan={7}
                isLoading={isLoading}
                isError={isError}
                error={error}
                onRetry={() => refetch()}
                isEmpty={expenses.length === 0}
                emptyMessage="No expenses yet. Record your first operational cost."
              />
              {!isLoading &&
                !isError &&
                expenses.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-muted-foreground">{formatDate(e.expense_date)}</TableCell>
                    <TableCell className="font-medium">{e.description}</TableCell>
                    <TableCell>
                      {e.expense_categories ? (
                        <Badge variant="outline" style={{ borderColor: e.expense_categories.color ?? undefined, color: e.expense_categories.color ?? undefined }}>
                          {e.expense_categories.name}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{e.events?.title ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{e.suppliers?.name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{e.payment_method ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(Number(e.amount), currency)}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
