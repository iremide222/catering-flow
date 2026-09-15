import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { TableState } from "@/components/data-states";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/menus/")({
  head: () => ({ meta: [{ title: "Menus — CaterFlow" }] }),
  component: MenusList,
});

const CATEGORIES = ["starter", "main", "dessert", "beverage", "snack", "other"];

function MenusList() {
  const { currentOrgId } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", category: "main", description: "", selling_price: "" });

  const { data: menus = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["menu-items", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_items").select("*").eq("organization_id", currentOrgId!).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Recipe costs per menu item
  const { data: costs = {} } = useQuery({
    queryKey: ["menu-costs", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_item_ingredients")
        .select("menu_item_id, quantity, items(default_cost)");
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const r of data ?? []) {
        const c = (r as any).items?.default_cost ?? 0;
        map[r.menu_item_id] = (map[r.menu_item_id] ?? 0) + Number(r.quantity) * Number(c);
      }
      return map;
    },
  });

  const create = async () => {
    if (!currentOrgId || !form.name) return;
    const { error } = await supabase.from("menu_items").insert({
      organization_id: currentOrgId,
      name: form.name,
      category: form.category,
      description: form.description || null,
      selling_price: Number(form.selling_price) || 0,
    });
    if (error) return toast.error(error.message);
    toast.success("Dish added");
    setForm({ name: "", category: "main", description: "", selling_price: "" });
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["menu-items"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Menus</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> New dish</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New dish</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Selling price</Label><Input type="number" min="0" step="0.01" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} /></div>
              </div>
              <div><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={create}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Dish</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Recipe cost</TableHead>
              <TableHead className="text-right">Price</TableHead><TableHead className="text-right">Margin</TableHead><TableHead>Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              <TableState
                colSpan={6}
                isLoading={isLoading}
                isError={isError}
                error={error}
                onRetry={() => refetch()}
                isEmpty={menus.length === 0}
                emptyMessage="No dishes yet. Add a dish, then attach ingredients to see its cost and margin."
              />
              {!isLoading && !isError && menus.map((m: any) => {
                const cost = costs[m.id] ?? 0;
                const price = Number(m.selling_price);
                const margin = price > 0 ? ((price - cost) / price) * 100 : null;
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <Link to="/app/menus/$id" params={{ id: m.id }} className="font-medium hover:underline">{m.name}</Link>
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground">{m.category}</TableCell>
                    <TableCell className="text-right">{formatCurrency(cost)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(price)}</TableCell>
                    <TableCell className="text-right">
                      {margin === null ? "—" : (
                        <span className={margin < 30 ? "text-destructive" : "text-green-600"}>{margin.toFixed(0)}%</span>
                      )}
                    </TableCell>
                    <TableCell>{m.is_active ? <Badge variant="secondary">Active</Badge> : <Badge variant="outline">Inactive</Badge>}</TableCell>
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
