import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

type Props = { eventId: string };

/**
 * Event menu planning: pick dishes from the menu for an event, see the food cost,
 * and get the total ingredient requirement checked against current stock.
 */
export function EventMenuPlanner({ eventId }: Props) {
  const { currentOrgId, organizations } = useAuth();
  const qc = useQueryClient();
  const currency = organizations.find((o) => o.id === currentOrgId)?.currency ?? "USD";
  const [dishId, setDishId] = useState("");
  const [servings, setServings] = useState("1");

  const { data: planned = [] } = useQuery({
    queryKey: ["event-menus", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_menus")
        .select("id, servings, menu_item_id, menu_items(id,name,category,selling_price)")
        .eq("event_id", eventId)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: dishes = [] } = useQuery({
    queryKey: ["menu-items", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("id,name,category,selling_price")
        .eq("organization_id", currentOrgId!)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: recipes = [] } = useQuery({
    queryKey: ["menu-recipes", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menu_item_ingredients")
        .select("menu_item_id, item_id, quantity, items(id,name,unit,default_cost)");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: stock = {} } = useQuery({
    queryKey: ["stock-by-item", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_levels")
        .select("item_id, quantity")
        .eq("organization_id", currentOrgId!);
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const r of data ?? []) map[r.item_id] = (map[r.item_id] ?? 0) + Number(r.quantity);
      return map;
    },
  });

  const addDish = async () => {
    if (!currentOrgId || !dishId) return;
    const { error } = await supabase.from("event_menus").insert({
      organization_id: currentOrgId,
      event_id: eventId,
      menu_item_id: dishId,
      servings: Number(servings) || 1,
    });
    if (error) return toast.error(error.message);
    setDishId("");
    setServings("1");
    qc.invalidateQueries({ queryKey: ["event-menus", eventId] });
  };

  const updateServings = async (rowId: string, value: string) => {
    const { error } = await supabase.from("event_menus").update({ servings: Number(value) || 0 }).eq("id", rowId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["event-menus", eventId] });
  };

  const removeDish = async (rowId: string) => {
    const { error } = await supabase.from("event_menus").delete().eq("id", rowId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["event-menus", eventId] });
  };

  // Cost of one serving of each dish
  const dishCost: Record<string, number> = {};
  for (const r of recipes as any[]) {
    const c = Number(r.items?.default_cost ?? 0) * Number(r.quantity);
    dishCost[r.menu_item_id] = (dishCost[r.menu_item_id] ?? 0) + c;
  }

  // Aggregate ingredient requirement across all planned dishes
  const required: Record<string, { name: string; unit: string; qty: number; cost: number }> = {};
  for (const row of planned as any[]) {
    const qtyServings = Number(row.servings ?? 0);
    for (const r of (recipes as any[]).filter((x) => x.menu_item_id === row.menu_item_id)) {
      const need = Number(r.quantity) * qtyServings;
      const prev = required[r.item_id];
      required[r.item_id] = {
        name: r.items?.name ?? "Item",
        unit: r.items?.unit ?? "",
        qty: (prev?.qty ?? 0) + need,
        cost: (prev?.cost ?? 0) + need * Number(r.items?.default_cost ?? 0),
      };
    }
  }
  const requiredRows = Object.entries(required).sort((a, b) => a[1].name.localeCompare(b[1].name));

  const totalFoodCost = (planned as any[]).reduce(
    (s, row) => s + (dishCost[row.menu_item_id] ?? 0) * Number(row.servings ?? 0),
    0,
  );
  const totalMenuValue = (planned as any[]).reduce(
    (s, row) => s + Number(row.menu_items?.selling_price ?? 0) * Number(row.servings ?? 0),
    0,
  );
  const shortages = requiredRows.filter(([itemId, r]) => (stock as any)[itemId] === undefined || (stock as any)[itemId] < r.qty);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Menu plan</CardTitle>
        <Link to="/app/menus" className="text-sm text-primary hover:underline">Manage dishes →</Link>
      </CardHeader>
      <CardContent className="space-y-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dish</TableHead>
              <TableHead className="w-28">Servings</TableHead>
              <TableHead className="w-32 text-right">Food cost</TableHead>
              <TableHead className="w-32 text-right">Menu value</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {planned.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                No dishes planned yet. Pick dishes below to see ingredient needs and food cost.
              </TableCell></TableRow>
            ) : (planned as any[]).map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <div className="font-medium">{row.menu_items?.name ?? "Dish"}</div>
                  <div className="text-xs capitalize text-muted-foreground">{row.menu_items?.category}</div>
                </TableCell>
                <TableCell>
                  <Input
                    type="number" min={0} step={1} defaultValue={row.servings}
                    onBlur={(e) => { if (Number(e.target.value) !== Number(row.servings)) updateServings(row.id, e.target.value); }}
                  />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency((dishCost[row.menu_item_id] ?? 0) * Number(row.servings ?? 0), currency)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(Number(row.menu_items?.selling_price ?? 0) * Number(row.servings ?? 0), currency)}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => removeDish(row.id)}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="grid grid-cols-12 gap-2 border-t pt-4">
          <Select value={dishId} onValueChange={setDishId}>
            <SelectTrigger className="col-span-7"><SelectValue placeholder="Pick a dish" /></SelectTrigger>
            <SelectContent>
              {dishes
                .filter((d: any) => !(planned as any[]).some((p) => p.menu_item_id === d.id))
                .map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input className="col-span-3" type="number" min={1} step={1} value={servings} onChange={(e) => setServings(e.target.value)} />
          <Button className="col-span-2" onClick={addDish} disabled={!dishId}>Add</Button>
        </div>

        {planned.length > 0 && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Planned food cost</div>
              <div className="text-lg font-semibold">{formatCurrency(totalFoodCost, currency)}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Menu value</div>
              <div className="text-lg font-semibold">{formatCurrency(totalMenuValue, currency)}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Ingredient shortages</div>
              <div className={`text-lg font-semibold ${shortages.length > 0 ? "text-destructive" : "text-emerald-600"}`}>
                {shortages.length}
              </div>
            </div>
          </div>
        )}

        {requiredRows.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Ingredients required</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ingredient</TableHead>
                  <TableHead className="text-right">Required</TableHead>
                  <TableHead className="text-right">In stock</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requiredRows.map(([itemId, r]) => {
                  const have = Number((stock as any)[itemId] ?? 0);
                  const short = have < r.qty;
                  return (
                    <TableRow key={itemId}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.qty.toFixed(2)} {r.unit}</TableCell>
                      <TableCell className="text-right tabular-nums">{have.toFixed(2)} {r.unit}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(r.cost, currency)}</TableCell>
                      <TableCell>
                        {short
                          ? <Badge variant="destructive">Short {(r.qty - have).toFixed(2)}</Badge>
                          : <Badge variant="secondary">In stock</Badge>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {shortages.length > 0 && (
              <div className="flex justify-end">
                <Button variant="outline" size="sm" asChild>
                  <Link to="/app/purchase-orders/new">Create purchase order</Link>
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
