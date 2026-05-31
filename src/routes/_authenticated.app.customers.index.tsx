import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { useState } from "react";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/customers/")({
  head: () => ({ meta: [{ title: "Customers — CaterFlow" }] }),
  component: CustomersList,
});

function CustomersList() {
  const { currentOrgId } = useAuth();
  const [q, setQ] = useState("");

  const { data: customers = [] } = useQuery({
    queryKey: ["customers", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id,name,email,phone,tags,created_at")
        .eq("organization_id", currentOrgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = customers.filter((c: any) =>
    !q || [c.name, c.email, c.phone].some((x) => x?.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
        <Link to="/app/customers/new"><Button><Plus className="mr-2 h-4 w-4" /> New customer</Button></Link>
      </div>

      <Input placeholder="Search by name, email or phone…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Tags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">No customers yet.</TableCell></TableRow>
              ) : filtered.map((c: any) => (
                <TableRow key={c.id} className="cursor-pointer">
                  <TableCell>
                    <Link to="/app/customers/$id" params={{ id: c.id }} className="font-medium hover:underline">{c.name}</Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.email ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{c.phone ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{(c.tags ?? []).join(", ") || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
