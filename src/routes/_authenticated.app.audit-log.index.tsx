import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAuditLog } from "@/lib/audit.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollText } from "lucide-react";
import { useMemo, useState } from "react";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/app/audit-log/")({
  head: () => ({ meta: [{ title: "Audit log — CaterFlow" }] }),
  component: AuditLogPage,
});

const ACTION_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  create: "default",
  update: "secondary",
  delete: "destructive",
};

function actionVariant(a: string) {
  const key = a.split(".").pop() ?? a;
  return ACTION_VARIANTS[key] ?? "outline";
}

function AuditLogPage() {
  const { currentOrgId } = useAuth();
  const fetchLog = useServerFn(getAuditLog);
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState<string>("all");

  const { data, isLoading, error } = useQuery({
    queryKey: ["audit-log", currentOrgId, entityFilter],
    queryFn: () => fetchLog({ data: { organizationId: currentOrgId!, entity: entityFilter === "all" ? undefined : entityFilter } }),
    enabled: !!currentOrgId,
  });

  const entries = data?.entries ?? [];

  const entities = useMemo(() => {
    const s = new Set<string>();
    entries.forEach((e: any) => e.entity && s.add(e.entity));
    return Array.from(s).sort();
  }, [entries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e: any) =>
      [e.action, e.entity, (e as any).profiles?.full_name, JSON.stringify(e.payload ?? {})]
        .filter(Boolean)
        .some((s: string) => String(s).toLowerCase().includes(q)),
    );
  }, [entries, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="text-sm text-muted-foreground">Recent activity across your workspace (admins only).</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search action, entity, user…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All entities" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All entities</SelectItem>
            {entities.map((e) => (
              <SelectItem key={e} value={e}>{e}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{filtered.length} entries</span>
      </div>

      {error ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-destructive">
            {(error as Error).message.includes("permission") || (error as Error).message.includes("policy")
              ? "Only admins can view the audit log."
              : (error as Error).message}
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16">
            <ScrollText className="h-8 w-8 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">No audit entries yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-44">When</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDate(e.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={actionVariant(e.action)} className="font-mono text-[10px]">
                        {e.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {e.entity ?? <span className="text-muted-foreground">—</span>}
                      {e.entity_id && (
                        <div className="font-mono text-[10px] text-muted-foreground">{e.entity_id.slice(0, 8)}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{e.profiles?.full_name ?? "—"}</TableCell>
                    <TableCell className="max-w-md">
                      {e.payload ? (
                        <pre className="overflow-x-auto rounded bg-muted/40 p-2 text-[11px] leading-tight">
                          {JSON.stringify(e.payload, null, 0).slice(0, 240)}
                        </pre>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
