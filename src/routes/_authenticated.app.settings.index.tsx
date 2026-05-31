import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/settings/")({
  head: () => ({ meta: [{ title: "Settings — CaterFlow" }] }),
  component: Settings,
});

const ROLES = ["admin", "manager", "accountant", "store_manager", "staff"] as const;
const CURRENCIES = ["USD", "EUR", "GBP", "KES", "INR", "NGN", "ZAR", "AED", "AUD", "CAD"];

function Settings() {
  const { currentOrgId, organizations, roles, user, refresh } = useAuth();
  const qc = useQueryClient();
  const org = organizations.find((o) => o.id === currentOrgId);
  const isAdmin = roles.includes("admin");

  const [name, setName] = useState(org?.name ?? "");
  const [currency, setCurrency] = useState(org?.currency ?? "USD");

  const { data: members = [] } = useQuery({
    queryKey: ["members", currentOrgId],
    enabled: !!currentOrgId,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("id,role,user_id,profiles:user_id(full_name)")
        .eq("organization_id", currentOrgId!);
      return data ?? [];
    },
  });

  const updateOrg = async () => {
    if (!org) return;
    const { error } = await supabase.from("organizations").update({ name, currency }).eq("id", org.id);
    if (error) return toast.error(error.message);
    toast.success("Workspace updated");
    refresh();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
          <CardDescription>Your roles: {roles.length ? roles.join(", ") : "—"}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!isAdmin} />
          </div>
          <div className="space-y-2">
            <Label>Currency</Label>
            <Select value={currency} onValueChange={setCurrency} disabled={!isAdmin}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-end"><Button onClick={updateOrg} disabled={!isAdmin}>Save</Button></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Team</CardTitle>
          <CardDescription>People with roles in this workspace. Invite by adding a user id — your own user id is <code>{user?.id}</code>.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.length === 0 ? (
                <TableRow><TableCell colSpan={2} className="py-6 text-center text-sm text-muted-foreground">No team members.</TableCell></TableRow>
              ) : members.map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell><div className="font-medium">{m.profiles?.full_name ?? "(no name)"}</div><div className="text-xs text-muted-foreground">{m.user_id}</div></TableCell>
                  <TableCell><Badge variant="outline">{m.role}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {isAdmin && <InviteCard orgId={currentOrgId!} onChange={() => qc.invalidateQueries({ queryKey: ["members", currentOrgId] })} />}
    </div>
  );
}

function InviteCard({ orgId, onChange }: { orgId: string; onChange: () => void }) {
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<typeof ROLES[number]>("staff");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!userId) return;
    setBusy(true);
    const { error: mErr } = await supabase.from("organization_members").insert({ organization_id: orgId, user_id: userId });
    if (mErr && !mErr.message.includes("duplicate")) { setBusy(false); return toast.error(mErr.message); }
    const { error: rErr } = await supabase.from("user_roles").insert({ organization_id: orgId, user_id: userId, role });
    setBusy(false);
    if (rErr) return toast.error(rErr.message);
    toast.success("Member added");
    setUserId("");
    onChange();
  };

  return (
    <Card>
      <CardHeader><CardTitle>Add team member</CardTitle><CardDescription>Paste a user id — staff sign up first, then admin adds them here.</CardDescription></CardHeader>
      <CardContent className="grid gap-2 md:grid-cols-12">
        <Input className="md:col-span-6" placeholder="User id (uuid)" value={userId} onChange={(e) => setUserId(e.target.value)} />
        <Select value={role} onValueChange={(v) => setRole(v as any)}>
          <SelectTrigger className="md:col-span-3"><SelectValue /></SelectTrigger>
          <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
        </Select>
        <Button className="md:col-span-3" onClick={add} disabled={busy}>{busy ? "Adding…" : "Add member"}</Button>
      </CardContent>
    </Card>
  );
}
