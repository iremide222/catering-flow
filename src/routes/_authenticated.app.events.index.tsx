import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { Plus, Download, Search } from "lucide-react";
import { exportCsv } from "@/lib/export-csv";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_authenticated/app/events/")({
  head: () => ({ meta: [{ title: "Events — CaterFlow" }] }),
  component: EventsList,
});

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  inquiry: "outline",
  quotation: "secondary",
  confirmed: "default",
  planning: "default",
  execution: "default",
  delivered: "secondary",
  closed: "secondary",
  cancelled: "destructive",
};

const STATUSES = ["inquiry","quotation","confirmed","planning","execution","delivered","closed","cancelled"];

function EventsList() {
  const { currentOrgId, organizations } = useAuth();
  const currency = organizations.find((o) => o.id === currentOrgId)?.currency ?? "USD";
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [range, setRange] = useState<string>("all"); // all | upcoming | past | 30d

  const { data: events = [] } = useQuery({
    queryKey: ["events", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id,title,status,event_date,venue,guest_count,total_amount,customers(name)")
        .eq("organization_id", currentOrgId!)
        .order("event_date", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const needle = q.trim().toLowerCase();
    return (events as any[]).filter((e) => {
      if (status !== "all" && e.status !== status) return false;
      if (range === "upcoming" && (!e.event_date || e.event_date < today)) return false;
      if (range === "past" && (!e.event_date || e.event_date >= today)) return false;
      if (range === "30d" && (!e.event_date || e.event_date < today || e.event_date > in30)) return false;
      if (needle) {
        const hay = `${e.title ?? ""} ${e.venue ?? ""} ${e.customers?.name ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [events, q, status, range]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() =>
              exportCsv(
                "events",
                [
                  { key: "title", label: "Title" },
                  { key: "customer", label: "Customer", get: (r: any) => r.customers?.name ?? "" },
                  { key: "event_date", label: "Date", get: (r: any) => formatDate(r.event_date) },
                  { key: "venue", label: "Venue" },
                  { key: "guest_count", label: "Guests" },
                  { key: "status", label: "Status" },
                  { key: "total_amount", label: "Total", get: (r: any) => Number(r.total_amount ?? 0).toFixed(2) },
                ],
                filtered,
              )
            }
            disabled={filtered.length === 0}
          >
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
          <Link to="/app/events/new"><Button><Plus className="mr-2 h-4 w-4" /> New event</Button></Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search title, venue, customer…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Date" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All dates</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="30d">Next 30 days</SelectItem>
            <SelectItem value="past">Past</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto text-xs text-muted-foreground">
          {filtered.length} of {events.length}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  {events.length === 0 ? "No events yet." : "No events match these filters."}
                </TableCell></TableRow>
              ) : filtered.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell><Link to="/app/events/$id" params={{ id: e.id }} className="font-medium hover:underline">{e.title}</Link><div className="text-xs text-muted-foreground">{e.venue ?? "—"}</div></TableCell>
                  <TableCell className="text-muted-foreground">{e.customers?.name ?? "—"}</TableCell>
                  <TableCell>{formatDate(e.event_date)}</TableCell>
                  <TableCell><Badge variant={STATUS_VARIANTS[e.status] ?? "outline"}>{e.status}</Badge></TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(e.total_amount ?? 0), currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
