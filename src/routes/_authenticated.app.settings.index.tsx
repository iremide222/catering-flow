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
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("id,role,user_id")
        .eq("organization_id", currentOrgId!);
      if (rolesError) throw rolesError;

      const userIds = [...new Set((rolesData ?? []).map((r) => r.user_id))];
      let profiles: { id: string; full_name: string | null }[] = [];
      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id,full_name")
          .in("id", userIds);
        if (!profilesError) profiles = profilesData ?? [];
      }

      const profileMap = new Map(profiles.map((p) => [p.id, p]));
      return (rolesData ?? []).map((m) => ({
        ...m,
        profiles: profileMap.get(m.user_id) ?? null,
      }));
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

      <ExpenseCategoriesCard orgId={currentOrgId!} canEdit={roles.includes("admin") || roles.includes("manager")} />

      <LocationsCard orgId={currentOrgId!} canEdit={roles.includes("admin") || roles.includes("manager")} />
    </div>
  );
}

function LocationsCard({ orgId, canEdit }: { orgId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const { data: locations = [] } = useQuery({
    queryKey: ["locations", orgId],
    queryFn: async () => {
      const { data } = await supabase.from("locations").select("*").eq("organization_id", orgId).order("name");
      return data ?? [];
    },
  });
  const add = async () => {
    if (!name) return;
    const { error } = await supabase.from("locations").insert({ organization_id: orgId, name, address: address || null });
    if (error) return toast.error(error.message);
    setName(""); setAddress("");
    qc.invalidateQueries({ queryKey: ["locations", orgId] });
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from("locations").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["locations", orgId] });
  };
  return (
    <Card>
      <CardHeader><CardTitle>Locations</CardTitle><CardDescription>Warehouses or stores where you keep stock.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Address</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {locations.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="py-4 text-center text-sm text-muted-foreground">No locations yet.</TableCell></TableRow>
            ) : locations.map((l: any) => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">{l.name}</TableCell>
                <TableCell className="text-muted-foreground">{l.address ?? "—"}</TableCell>
                <TableCell>{canEdit && <Button variant="ghost" size="sm" onClick={() => remove(l.id)}>Remove</Button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {canEdit && (
          <div className="grid grid-cols-12 gap-2 border-t pt-4">
            <Input className="col-span-4" placeholder="Location name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input className="col-span-6" placeholder="Address (optional)" value={address} onChange={(e) => setAddress(e.target.value)} />
            <Button className="col-span-2" onClick={add} disabled={!name}>Add</Button>
          </div>
        )}
      </CardContent>
    </Card>
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
