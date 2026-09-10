import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Download, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { exportCsv } from "@/lib/export-csv";
import { TableState } from "@/components/data-states";

export const Route = createFileRoute("/_authenticated/app/attendance/")({
  head: () => ({ meta: [{ title: "Attendance — CaterFlow" }] }),
  component: AttendancePage,
});

function monthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = {
  staff_member_id: "",
  event_id: "none",
  work_date: today(),
  check_in: "09:00",
  check_out: "17:00",
  notes: "",
};

function AttendancePage() {
  const { currentOrgId, user } = useAuth();
  const qc = useQueryClient();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: staff = [] } = useQuery({
    queryKey: ["staff-active", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data } = await supabase
        .from("staff_members")
        .select("id, name, hourly_rate")
        .eq("organization_id", currentOrgId!)
        .eq("is_active", true)
        .order("name");
      return data ?? [];
    },
  });

  const { data: events = [] } = useQuery({
    queryKey: ["events-brief", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, title, event_date")
        .eq("organization_id", currentOrgId!)
        .order("event_date", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const { data: records = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["attendance", currentOrgId, from, to],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("*, staff_members(id, name, hourly_rate), events(id, title)")
        .eq("organization_id", currentOrgId!)
        .gte("work_date", from)
        .lte("work_date", to)
        .order("work_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const totalHours = records.reduce((s: number, r: any) => s + Number(r.hours ?? 0), 0);

  const create = async () => {
    if (!currentOrgId || !form.staff_member_id) return toast.error("Pick a staff member");
    const ci = form.check_in ? `${form.work_date}T${form.check_in}:00` : null;
    const co = form.check_out ? `${form.work_date}T${form.check_out}:00` : null;
    const { error } = await supabase.from("attendance_records").insert({
      organization_id: currentOrgId,
      staff_member_id: form.staff_member_id,
      event_id: form.event_id === "none" ? null : form.event_id,
      work_date: form.work_date,
      check_in: ci,
      check_out: co,
      notes: form.notes || null,
      created_by: user?.id ?? null,
    });
    if (error) return toast.error(error.message);
    toast.success("Attendance recorded");
    setForm({ ...emptyForm, work_date: form.work_date });
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["attendance"] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("attendance_records").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["attendance"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Attendance</h1>
          <p className="text-sm text-muted-foreground">
            {records.length} records · <span className="font-medium text-foreground">{totalHours.toFixed(2)} hours</span> in range
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} />
          <Button
            variant="outline"
            disabled={records.length === 0}
            onClick={() =>
              exportCsv(
                "attendance",
                [
                  { key: "work_date", label: "Date", get: (r: any) => formatDate(r.work_date) },
                  { key: "staff", label: "Staff", get: (r: any) => r.staff_members?.name ?? "" },
                  { key: "event", label: "Event", get: (r: any) => r.events?.title ?? "" },
                  { key: "check_in", label: "In", get: (r: any) => (r.check_in ? new Date(r.check_in).toISOString().slice(11, 16) : "") },
                  { key: "check_out", label: "Out", get: (r: any) => (r.check_out ? new Date(r.check_out).toISOString().slice(11, 16) : "") },
                  { key: "hours", label: "Hours", get: (r: any) => Number(r.hours).toFixed(2) },
                ],
                records,
              )
            }
          >
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Log hours</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Log attendance</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Staff member *</Label>
                  <Select value={form.staff_member_id} onValueChange={(v) => setForm({ ...form, staff_member_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                    <SelectContent>
                      {staff.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Event</Label>
                  <Select value={form.event_id} onValueChange={(v) => setForm({ ...form, event_id: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {events.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Date</Label><Input type="date" value={form.work_date} onChange={(e) => setForm({ ...form, work_date: e.target.value })} /></div>
                  <div><Label>Check in</Label><Input type="time" value={form.check_in} onChange={(e) => setForm({ ...form, check_in: e.target.value })} /></div>
                  <div><Label>Check out</Label><Input type="time" value={form.check_out} onChange={(e) => setForm({ ...form, check_out: e.target.value })} /></div>
                </div>
                <div><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={create}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>In</TableHead>
                <TableHead>Out</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableState
                colSpan={7}
                isLoading={isLoading}
                isError={isError}
                error={error}
                onRetry={() => refetch()}
                isEmpty={records.length === 0}
                emptyMessage="No attendance in this period. Log hours to build payroll from them."
              />
              {!isLoading && !isError && records.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="text-muted-foreground">{formatDate(r.work_date)}</TableCell>
                  <TableCell className="font-medium">{r.staff_members?.name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.events?.title ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.check_in ? new Date(r.check_in).toISOString().slice(11, 16) : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{r.check_out ? new Date(r.check_out).toISOString().slice(11, 16) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{Number(r.hours).toFixed(2)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
