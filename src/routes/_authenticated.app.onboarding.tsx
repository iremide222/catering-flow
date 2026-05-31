import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/onboarding")({
  head: () => ({ meta: [{ title: "Create workspace — CaterFlow" }] }),
  component: Onboarding,
});

const CURRENCIES = ["USD", "EUR", "GBP", "KES", "INR", "NGN", "ZAR", "AED", "AUD", "CAD"];

function Onboarding() {
  const navigate = useNavigate();
  const { refresh, setCurrentOrg } = useAuth();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.rpc("create_organization", { _name: name, _currency: currency });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Workspace created");
    await refresh();
    if (data) setCurrentOrg(data as unknown as string);
    navigate({ to: "/app" });
  };

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Create your workspace</CardTitle>
          <CardDescription>Set up your catering company. You'll be the workspace admin.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="name">Company name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Default currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={busy}>{busy ? "Creating…" : "Create workspace"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
