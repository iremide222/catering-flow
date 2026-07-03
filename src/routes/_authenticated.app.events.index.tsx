import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { Plus, Download } from "lucide-react";
import { exportCsv } from "@/lib/export-csv";

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

function EventsList() {
  const { currentOrgId, organizations } = useAuth();
  const currency = organizations.find((o) => o.id === currentOrgId)?.currency ?? "USD";

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
        <Link to="/app/events/new"><Button><Plus className="mr-2 h-4 w-4" /> New event</Button></Link>
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
              {events.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">No events yet.</TableCell></TableRow>
              ) : events.map((e: any) => (
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
