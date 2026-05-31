import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";

type Organization = { id: string; name: string; currency: string; owner_id: string };
type Role = "admin" | "manager" | "accountant" | "store_manager" | "staff";

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  organizations: Organization[];
  currentOrgId: string | null;
  roles: Role[];
  setCurrentOrg: (id: string) => void;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

const ORG_KEY = "caterflow.currentOrgId";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrgId, setCurrentOrgIdState] = useState<string | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const router = useRouter();
  const queryClient = useQueryClient();

  const loadOrgs = async (uid: string) => {
    const { data: members } = await supabase
      .from("organization_members")
      .select("organization_id, organizations(id, name, currency, owner_id)")
      .eq("user_id", uid);
    const orgs = (members ?? [])
      .map((m: any) => m.organizations)
      .filter(Boolean) as Organization[];
    setOrganizations(orgs);
    const saved = typeof window !== "undefined" ? localStorage.getItem(ORG_KEY) : null;
    const next = orgs.find((o) => o.id === saved)?.id ?? orgs[0]?.id ?? null;
    setCurrentOrgIdState(next);
    if (next) {
      const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", uid).eq("organization_id", next);
      setRoles((r ?? []).map((x: any) => x.role));
    } else {
      setRoles([]);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => loadOrgs(s.user.id), 0);
      } else {
        setOrganizations([]);
        setCurrentOrgIdState(null);
        setRoles([]);
      }
      router.invalidate();
      queryClient.invalidateQueries();
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) loadOrgs(s.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setCurrentOrg = (id: string) => {
    localStorage.setItem(ORG_KEY, id);
    setCurrentOrgIdState(id);
    if (user) {
      supabase.from("user_roles").select("role").eq("user_id", user.id).eq("organization_id", id).then(({ data }) => {
        setRoles((data ?? []).map((x: any) => x.role));
      });
    }
    queryClient.invalidateQueries();
  };

  const refresh = async () => {
    if (user) await loadOrgs(user.id);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, organizations, currentOrgId, roles, setCurrentOrg, refresh, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
