import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import {
  Search,
  Users,
  CalendarDays,
  Receipt,
  Package,
  UserCog,
  LayoutDashboard,
  BarChart3,
  ClipboardList,
  Truck,
  CheckSquare,
  Settings,
  FileText,
  Plus,
} from "lucide-react";

const QUICK_NAV = [
  { label: "Dashboard", to: "/app", icon: LayoutDashboard },
  { label: "Reports", to: "/app/reports", icon: BarChart3 },
  { label: "Customers", to: "/app/customers", icon: Users },
  { label: "Events", to: "/app/events", icon: CalendarDays },
  { label: "Calendar", to: "/app/calendar", icon: CalendarDays },
  { label: "Quotations", to: "/app/quotations", icon: FileText },
  { label: "Invoices", to: "/app/invoices", icon: Receipt },
  { label: "Tasks", to: "/app/tasks", icon: CheckSquare },
  { label: "Staff", to: "/app/staff", icon: UserCog },
  { label: "Inventory", to: "/app/inventory", icon: Package },
  { label: "Suppliers", to: "/app/suppliers", icon: Truck },
  { label: "Purchase orders", to: "/app/purchase-orders", icon: ClipboardList },
  { label: "Settings", to: "/app/settings", icon: Settings },
];

const QUICK_CREATE = [
  { label: "New customer", to: "/app/customers/new", icon: Users },
  { label: "New event", to: "/app/events/new", icon: CalendarDays },
  { label: "New invoice", to: "/app/invoices/new", icon: Receipt },
  { label: "New purchase order", to: "/app/purchase-orders/new", icon: ClipboardList },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const { currentOrgId } = useAuth();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const term = q.trim();
  const enabled = open && !!currentOrgId && term.length >= 2;

  const { data: results } = useQuery({
    queryKey: ["cmdk", currentOrgId, term],
    enabled,
    queryFn: async () => {
      const like = `%${term}%`;
      const [customers, events, invoices, items] = await Promise.all([
        supabase.from("customers").select("id,name,email").eq("organization_id", currentOrgId!).ilike("name", like).limit(6),
        supabase.from("events").select("id,name,event_date,status").eq("organization_id", currentOrgId!).ilike("name", like).limit(6),
        supabase.from("invoices").select("id,invoice_number,status,total").eq("organization_id", currentOrgId!).ilike("invoice_number", like).limit(6),
        supabase.from("items").select("id,name,sku").eq("organization_id", currentOrgId!).ilike("name", like).limit(6),
      ]);
      return {
        customers: customers.data ?? [],
        events: events.data ?? [],
        invoices: invoices.data ?? [],
        items: items.data ?? [],
      };
    },
  });

  const filteredNav = useMemo(() => {
    if (!term) return QUICK_NAV;
    const t = term.toLowerCase();
    return QUICK_NAV.filter((n) => n.label.toLowerCase().includes(t));
  }, [term]);

  const go = (to: string, params?: Record<string, string>) => {
    setOpen(false);
    setQ("");
    navigate({ to, params } as any);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-2 px-2 text-muted-foreground"
        onClick={() => setOpen(true)}
        title="Search (Ctrl/Cmd + K)"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden text-xs md:inline">Search…</span>
        <kbd className="hidden rounded border bg-muted px-1 text-[10px] md:inline">⌘K</kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search customers, events, invoices, items…"
          value={q}
          onValueChange={setQ}
        />
        <CommandList>
          <CommandEmpty>
            {term.length < 2 ? "Type at least 2 characters to search." : "No matches."}
          </CommandEmpty>

          {filteredNav.length > 0 && (
            <CommandGroup heading="Navigate">
              {filteredNav.map((n) => {
                const Icon = n.icon;
                return (
                  <CommandItem key={n.to} value={`nav ${n.label}`} onSelect={() => go(n.to)}>
                    <Icon className="mr-2 h-4 w-4" />
                    {n.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}

          <CommandSeparator />
          <CommandGroup heading="Create">
            {QUICK_CREATE.map((c) => {
              const Icon = c.icon;
              return (
                <CommandItem key={c.to} value={`create ${c.label}`} onSelect={() => go(c.to)}>
                  <Plus className="mr-2 h-4 w-4 text-muted-foreground" />
                  <Icon className="mr-2 h-4 w-4" />
                  {c.label}
                </CommandItem>
              );
            })}
          </CommandGroup>

          {enabled && results && (
            <>
              {results.customers.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Customers">
                    {results.customers.map((c: any) => (
                      <CommandItem
                        key={c.id}
                        value={`customer ${c.name} ${c.email ?? ""}`}
                        onSelect={() => go("/app/customers/$id", { id: c.id })}
                      >
                        <Users className="mr-2 h-4 w-4" />
                        <span>{c.name}</span>
                        {c.email && <span className="ml-2 text-xs text-muted-foreground">{c.email}</span>}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}

              {results.events.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Events">
                    {results.events.map((e: any) => (
                      <CommandItem
                        key={e.id}
                        value={`event ${e.name}`}
                        onSelect={() => go("/app/events/$id", { id: e.id })}
                      >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        <span>{e.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {e.event_date} · {e.status}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}

              {results.invoices.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Invoices">
                    {results.invoices.map((i: any) => (
                      <CommandItem
                        key={i.id}
                        value={`invoice ${i.invoice_number}`}
                        onSelect={() => go("/app/invoices/$id", { id: i.id })}
                      >
                        <Receipt className="mr-2 h-4 w-4" />
                        <span>{i.invoice_number}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{i.status}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}

              {results.items.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Inventory">
                    {results.items.map((it: any) => (
                      <CommandItem
                        key={it.id}
                        value={`item ${it.name} ${it.sku ?? ""}`}
                        onSelect={() => go("/app/inventory/$id", { id: it.id })}
                      >
                        <Package className="mr-2 h-4 w-4" />
                        <span>{it.name}</span>
                        {it.sku && <span className="ml-2 text-xs text-muted-foreground">{it.sku}</span>}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
