import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { QueryState } from "@/components/data-states";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/menus/$id")({
  head: () => ({ meta: [{ title: "Dish — CaterFlow" }] }),
  component: MenuDetail,
});

const CATEGORIES = ["starter", "main", "dessert", "beverage", "snack", "other"];

function MenuDetail() {
  const { id } = Route.useParams();
  const { currentOrgId } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: dish, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["menu-item", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("menu_items").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: ingredients = [], refetch: refetchIngredients } = useQuery({
    queryKey: ["menu-ingredients", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_item_ingredients")
        .select("id, quantity, item_id, items(name, unit, default_cost)")
        .eq("menu_item_id", id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: inventoryItems = [] } = useQuery({
    queryKey: ["items", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("items").select("id, name, unit, default_cost").eq("organization_id", currentOrgId!).eq("is_active", true).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [form, setForm] = useState({ name: "", category: "main", description: "", selling_price: "0", is_active: true });
  useEffect(() => {
    if (dish) setForm({
      name: dish.name,
      category: dish.category,
      description: dish.description ?? "",
      selling_price: String(dish.selling_price),
      is_active: dish.is_active,
    });
  }, [dish]);

  const [newIng, setNewIng] = useState({ item_id: "", quantity: "1" });

  const recipeCost = ingredients.reduce(
    (sum, r: any) => sum + Number(r.quantity) * Number(r.items?.default_cost ?? 0), 0
  );
  const price = Number(form.selling_price) || 0;
  const margin = price > 0 ? ((price - recipeCost) / price) * 100 : null;

  const save = async () => {
    const { error } = await supabase.from("menu_items").update({
      name: form.name,
      category: form.category,
      description: form.description || null,
      selling_price: price,
      is_active: form.is_active,
    }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Dish updated");
    qc.invalidateQueries({ queryKey: ["menu-item", id] });
    qc.invalidateQueries({ queryKey: ["menu-items"] });
  };

  const addIngredient = async () => {
    if (!newIng.item_id) return;
    const { error } = await supabase.from("menu_item_ingredients").insert({
      menu_item_id: id,
      item_id: newIng.item_id,
      quantity: Number(newIng.quantity) || 1,
    });
    if (error) return toast.error(error.message);
    setNewIng({ item_id: "", quantity: "1" });
    refetchIngredients();
    qc.invalidateQueries({ queryKey: ["menu-costs"] });
  };

  const removeIngredient = async (ingId: string) => {
    const { error } = await supabase.from("menu_item_ingredients").delete().eq("id", ingId);
    if (error) return toast.error(error.message);
    refetchIngredients();
    qc.invalidateQueries({ queryKey: ["menu-costs"] });
  };

  const removeDish = async () => {
    const { error } = await supabase.from("menu_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Dish deleted");
    navigate({ to: "/app/menus" });
  };

  if (isLoading || isError || !dish) {
    return (
      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        isEmpty={!isLoading && !isError && !dish}
        emptyMessage="Dish not found."
      />
    );
  }

  return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/app/menus" })}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-2xl font-semibold tracking-tight">{dish.name}</h1>
            </div>
            <Button variant="destructive" size="sm" onClick={removeDish}><Trash2 className="mr-2 h-4 w-4" /> Delete</Button>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
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
                <div className="flex items-center justify-between">
                  <Label>Active</Label>
                  <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                </div>
                <Button onClick={save} className="w-full">Save changes</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Costing</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Recipe cost</span><span className="font-medium">{formatCurrency(recipeCost)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Selling price</span><span className="font-medium">{formatCurrency(price)}</span></div>
                <div className="flex justify-between border-t pt-3 text-sm">
                  <span className="text-muted-foreground">Margin</span>
                  <span className={`font-medium ${margin !== null && margin < 30 ? "text-destructive" : "text-green-600"}`}>
                    {margin === null ? "—" : `${margin.toFixed(1)}% (${formatCurrency(price - recipeCost)})`}
                  </span>
                </div>
                {margin !== null && margin < 30 && (
                  <p className="text-xs text-destructive">Margin is below 30%. Consider raising the price or reducing ingredient costs.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Recipe — ingredients</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Ingredient</TableHead><TableHead className="text-right">Qty</TableHead><TableHead>Unit</TableHead>
                  <TableHead className="text-right">Unit cost</TableHead><TableHead className="text-right">Line cost</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {ingredients.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">No ingredients yet. Add inventory items below to build the recipe.</TableCell></TableRow>
                  )}
                  {ingredients.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.items?.name ?? "—"}</TableCell>
                      <TableCell className="text-right">{Number(r.quantity)}</TableCell>
                      <TableCell className="text-muted-foreground">{r.items?.unit ?? "—"}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(r.items?.default_cost ?? 0))}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(r.quantity) * Number(r.items?.default_cost ?? 0))}</TableCell>
                      <TableCell><Button variant="ghost" size="icon" onClick={() => removeIngredient(r.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-48 flex-1">
                  <Label>Inventory item</Label>
                  <Select value={newIng.item_id} onValueChange={(v) => setNewIng({ ...newIng, item_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                    <SelectContent>
                      {inventoryItems
                        .filter((it: any) => !ingredients.some((r: any) => r.item_id === it.id))
                        .map((it: any) => <SelectItem key={it.id} value={it.id}>{it.name} ({it.unit})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-28">
                  <Label>Quantity</Label>
                  <Input type="number" min="0" step="0.001" value={newIng.quantity} onChange={(e) => setNewIng({ ...newIng, quantity: e.target.value })} />
                </div>
                <Button onClick={addIngredient} disabled={!newIng.item_id}><Plus className="mr-2 h-4 w-4" /> Add</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </QueryState>
  );
}
