import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, CalendarDays } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { TableState } from "@/components/data-states";

export const Route = createFileRoute("/_authenticated/app/staff/")({
  head: () => ({ meta: [{ title: "Staff — CaterFlow" }] }),
  component: StaffList,
});

const empty = { name: "", email: "", phone: "", role_title: "", hourly_rate: "0", notes: "" };

function StaffList() {
  const { currentOrgId } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);

  const { data: staff = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["staff", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_members").select("*").eq("organization_id", currentOrgId!).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const { data: assignments = [] } = useQuery({
    queryKey: ["staff-upcoming", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_staff_assignments")
        .select("id, role, staff_member_id, events!inner(id, title, event_date, start_time, venue, organization_id)")
        .eq("events.organization_id", currentOrgId!)
        .gte("events.event_date", today)
        .order("event_date", { referencedTable: "events", ascending: true })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const upcomingByStaff = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const a of assignments as any[]) {
      if (!m.has(a.staff_member_id)) m.set(a.staff_member_id, []);
      m.get(a.staff_member_id)!.push(a);
    }
    return m;
  }, [assignments]);

  const create = async () => {
    if (!currentOrgId || !form.name) return;
    const { error } = await supabase.from("staff_members").insert({
      organization_id: currentOrgId,
      name: form.name,
      email: form.email || null,
      phone: form.phone || null,
      role_title: form.role_title || null,
      hourly_rate: Number(form.hourly_rate || 0),
      notes: form.notes || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Staff member added");
    setForm(empty);
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["staff"] });
  };

  const toggleActive = async (id: string, is_active: boolean) => {
    const { error } = await supabase.from("staff_members").update({ is_active: !is_active }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["staff"] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("staff_members").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["staff"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Staff</h1>
          <p className="text-sm text-muted-foreground">Manage your team and assign them to events.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> New staff</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New staff member</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Role</Label><Input placeholder="Chef, Server…" value={form.role_title} onChange={(e) => setForm({ ...form, role_title: e.target.value })} /></div>
                <div><Label>Hourly rate</Label><Input type="number" step="0.01" value={form.hourly_rate} onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              </div>
              <div><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={create}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead>Contact</TableHead>
              <TableHead className="text-right">Rate</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              <TableState
                colSpan={6}
                isLoading={isLoading}
                isError={isError}
                error={error}
                onRetry={() => refetch()}
                isEmpty={staff.length === 0}
                emptyMessage="No staff yet. Add team members to assign them to events."
              />
              {!isLoading && !isError && staff.map((s: any) => {
                const up = upcomingByStaff.get(s.id) ?? [];
                return (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-muted-foreground">{s.role_title ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {s.email ?? ""}{s.email && s.phone ? " · " : ""}{s.phone ?? ""}
                    {!s.email && !s.phone ? "—" : ""}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{Number(s.hourly_rate).toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={s.is_active ? "default" : "secondary"} className="cursor-pointer" onClick={() => toggleActive(s.id, s.is_active)}>
                      {s.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4" /> Upcoming schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          {assignments.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No upcoming assignments.</p>
          ) : (
            <div className="space-y-4">
              {staff
                .filter((s: any) => (upcomingByStaff.get(s.id) ?? []).length > 0)
                .map((s: any) => {
                  const up = upcomingByStaff.get(s.id) ?? [];
                  return (
                    <div key={s.id} className="space-y-2">
                      <div className="text-sm font-medium">
                        {s.name}
                        <span className="ml-2 text-xs text-muted-foreground">{up.length} upcoming</span>
                      </div>
                      <div className="grid gap-2 md:grid-cols-2">
                        {up.slice(0, 6).map((a: any) => (
                          <Link
                            key={a.id}
                            to="/app/events/$id"
                            params={{ id: a.events.id }}
                            className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2 text-sm hover:bg-accent/40"
                          >
                            <div className="min-w-0">
                              <div className="truncate font-medium">{a.events.title}</div>
                              <div className="truncate text-xs text-muted-foreground">
                                {formatDate(a.events.event_date)}
                                {a.events.start_time ? ` · ${a.events.start_time.slice(0, 5)}` : ""}
                                {a.events.venue ? ` · ${a.events.venue}` : ""}
                              </div>
                            </div>
                            {a.role && <Badge variant="outline" className="shrink-0">{a.role}</Badge>}
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
