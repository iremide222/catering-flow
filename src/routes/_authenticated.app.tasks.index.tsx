import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, CalendarDays, User as UserIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/tasks/")({
  head: () => ({ meta: [{ title: "Tasks — CaterFlow" }] }),
  component: TasksBoard,
});

type Status = "todo" | "in_progress" | "done";
type Priority = "low" | "medium" | "high";
const COLUMNS: { key: Status; label: string }[] = [
  { key: "todo", label: "To do" },
  { key: "in_progress", label: "In progress" },
  { key: "done", label: "Done" },
];
const PRIO_COLOR: Record<Priority, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  high: "bg-destructive/15 text-destructive",
};

const empty = {
  title: "",
  description: "",
  priority: "medium" as Priority,
  due_date: "",
  event_id: "none",
  assigned_to_staff_id: "none",
};

function TasksBoard() {
  const { currentOrgId, user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, events(title), staff_members:assigned_to_staff_id(name)")
        .eq("organization_id", currentOrgId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: events = [] } = useQuery({
    queryKey: ["events-lite", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data } = await supabase.from("events").select("id, title").eq("organization_id", currentOrgId!).order("event_date", { ascending: false });
      return data ?? [];
    },
  });
  const { data: staff = [] } = useQuery({
    queryKey: ["staff-lite", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data } = await supabase.from("staff_members").select("id, name").eq("organization_id", currentOrgId!).eq("is_active", true).order("name");
      return data ?? [];
    },
  });

  const create = async () => {
    if (!currentOrgId || !user || !form.title) return;
    const { error } = await supabase.from("tasks").insert({
      organization_id: currentOrgId,
      created_by: user.id,
      title: form.title,
      description: form.description || null,
      priority: form.priority,
      due_date: form.due_date || null,
      event_id: form.event_id !== "none" ? form.event_id : null,
      assigned_to_staff_id: form.assigned_to_staff_id !== "none" ? form.assigned_to_staff_id : null,
    });
    if (error) return toast.error(error.message);
    toast.success("Task created");
    setForm(empty);
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["tasks"] });
  };

  const setStatus = async (id: string, status: Status) => {
    const { error } = await supabase.from("tasks").update({
      status,
      completed_at: status === "done" ? new Date().toISOString() : null,
    }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["tasks"] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["tasks"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">Track work across events and your team.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> New task</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New task</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Priority</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as Priority })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Due date</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Event</Label>
                  <Select value={form.event_id} onValueChange={(v) => setForm({ ...form, event_id: v })}>
                    <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {events.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Assignee</Label>
                  <Select value={form.assigned_to_staff_id} onValueChange={(v) => setForm({ ...form, assigned_to_staff_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Unassigned</SelectItem>
                      {staff.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter><Button onClick={create}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const items = tasks.filter((t: any) => t.status === col.key);
          return (
            <Card key={col.key}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-sm font-medium">
                  <span>{col.label}</span>
                  <span className="text-muted-foreground">{items.length}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {items.length === 0 && <p className="text-xs text-muted-foreground">No tasks.</p>}
                {items.map((t: any) => (
                  <div key={t.id} className="rounded-md border bg-card p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium leading-snug">{t.title}</div>
                      <Button variant="ghost" size="icon" className="-mr-2 -mt-1 h-7 w-7" onClick={() => remove(t.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {t.description && <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <Badge className={PRIO_COLOR[t.priority as Priority]}>{t.priority}</Badge>
                      {t.due_date && <span className="inline-flex items-center gap-1 text-muted-foreground"><CalendarDays className="h-3 w-3" />{t.due_date}</span>}
                      {t.events?.title && <span className="text-muted-foreground">· {t.events.title}</span>}
                      {t.staff_members?.name && <span className="inline-flex items-center gap-1 text-muted-foreground"><UserIcon className="h-3 w-3" />{t.staff_members.name}</span>}
                    </div>
                    <div className="mt-2">
                      <Select value={t.status} onValueChange={(v) => setStatus(t.id, v as Status)}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {COLUMNS.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
