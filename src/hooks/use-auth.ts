import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "moderador" | "editor" | "viewer" | "tst";
export type AppModule = "sesmt" | "estoque" | "producao" | "manutencao" | "portaria" | "usuarios";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [modules, setModules] = useState<AppModule[]>([]);
  const [aal, setAal] = useState<"aal1" | "aal2">("aal1");
  const [mfaActive, setMfaActive] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => {
          loadAll(s.user.id).finally(() => mounted && setLoading(false));
        }, 0);
      } else {
        setRoles([]);
        setModules([]);
        setAal("aal1");
        setMfaActive(false);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        await loadAll(data.session.user.id);
      }
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function loadAll(uid: string) {
    try {
      const [rolesRes, modsRes, aalRes, factorsRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", uid),
        supabase.from("user_module_access").select("module, enabled").eq("user_id", uid).eq("enabled", true),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.auth.mfa.listFactors(),
      ]);
      setRoles((rolesRes.data ?? []).map((r) => r.role as AppRole));
      setModules((modsRes.data ?? []).map((m) => m.module as AppModule));
      setAal(((aalRes.data?.currentLevel ?? "aal1") as "aal1" | "aal2"));
      const totps = (factorsRes.data?.totp ?? []).filter((f) => f.status === "verified");
      setMfaActive(totps.length > 0);
    } catch (e) {
      console.warn("[useAuth] loadAll exception:", e);
      setRoles([]);
      setModules([]);
    }
  }

  const isAdmin = roles.includes("admin");
  const isModerator = isAdmin || roles.includes("moderador");
  const isEditor = isModerator || roles.includes("editor") || roles.includes("tst");
  const requiresMfa = isModerator; // admin + moderador
  const mfaSatisfied = !requiresMfa || aal === "aal2";

  function hasModule(m: AppModule): boolean {
    if (isAdmin) return true;
    return modules.includes(m);
  }

  return {
    session, user, roles, modules, aal, mfaActive, loading,
    isAdmin, isModerator, isEditor, requiresMfa, mfaSatisfied,
    hasModule,
  };
}