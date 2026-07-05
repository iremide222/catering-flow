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

  const { data: staff = [] } = useQuery({
    queryKey: ["staff", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_members").select("*").eq("organization_id", currentOrgId!).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

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
              {staff.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">No staff yet.</TableCell></TableRow>
              ) : staff.map((s: any) => (
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
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
