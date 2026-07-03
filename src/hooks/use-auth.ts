import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { MENU_BY_KEY } from "@/lib/menu-catalog";
import type { AppModule, AppRole } from "@/lib/access-control";

export type { AppModule, AppRole };

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [modules, setModules] = useState<AppModule[]>([]);
  const [menuKeys, setMenuKeys] = useState<Set<string>>(new Set());
  const [modulesWithMenuConfig, setModulesWithMenuConfig] = useState<Set<AppModule>>(new Set());
  const [aal, setAal] = useState<"aal1" | "aal2">("aal1");
  const [mfaActive, setMfaActive] = useState(false);
  const [mfaGraceUntil, setMfaGraceUntil] = useState<Date | null>(null);
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
        setMenuKeys(new Set());
        setModulesWithMenuConfig(new Set());
        setAal("aal1");
        setMfaActive(false);
        setMfaGraceUntil(null);
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
      const [rolesRes, modsRes, menusRes, aalRes, factorsRes, profileRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", uid),
        supabase.from("user_module_access").select("module, enabled").eq("user_id", uid).eq("enabled", true),
        (supabase as any).from("user_menu_access").select("menu_key, enabled").eq("user_id", uid),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.auth.mfa.listFactors(),
        (supabase as any).from("profiles").select("mfa_grace_until").eq("id", uid).maybeSingle(),
      ]);
      setRoles((rolesRes.data ?? []).map((r) => r.role as AppRole));
      setModules((modsRes.data ?? []).map((m) => m.module as AppModule));
      const rows = (menusRes?.data ?? []) as { menu_key: string; enabled: boolean }[];
      const enabledKeys = new Set(rows.filter((r) => r.enabled).map((r) => r.menu_key));
      const configuredModules = new Set<AppModule>();
      for (const r of rows) {
        const m = MENU_BY_KEY[r.menu_key]?.module;
        if (m) configuredModules.add(m);
      }
      setMenuKeys(enabledKeys);
      setModulesWithMenuConfig(configuredModules);
      setAal(((aalRes.data?.currentLevel ?? "aal1") as "aal1" | "aal2"));
      const totps = (factorsRes.data?.totp ?? []).filter((f) => f.status === "verified");
      setMfaActive(totps.length > 0);
      const g = (profileRes as any)?.data?.mfa_grace_until as string | null | undefined;
      setMfaGraceUntil(g ? new Date(g) : null);
    } catch (e) {
      console.warn("[useAuth] loadAll exception:", e);
      setRoles([]);
      setModules([]);
      setMenuKeys(new Set());
      setModulesWithMenuConfig(new Set());
      setMfaGraceUntil(null);
    }
  }

  const isAdmin = roles.includes("admin");
  const isModerator = isAdmin || roles.includes("moderador");
  const isEditor = isModerator || roles.includes("editor") || roles.includes("tst") || roles.includes("compras");
  // MFA obrigatório pra qualquer usuário com papel (regra de 03/07/2026).
  const requiresMfa = roles.length > 0;
  const graceActive = !!(mfaGraceUntil && mfaGraceUntil.getTime() > Date.now());
  const graceDaysLeft = mfaGraceUntil
    ? Math.max(0, Math.ceil((mfaGraceUntil.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;
  // Satisfeito se não exige, ou já autenticou 2FA, ou ainda está dentro do grace de 7 dias.
  const mfaSatisfied = !requiresMfa || aal === "aal2" || graceActive;

  function hasModule(m: AppModule): boolean {
    if (isAdmin) return true;
    if (m === "compras" && roles.includes("compras")) return true;
    return modules.includes(m);
  }

  /**
   * Verifica se o usuário pode acessar um menu específico.
   * Regra: admin sempre OK. Sem o módulo pai -> não. Se o usuário tem
   * configuração explícita de menus naquele módulo -> só os enabled.
   * Se não tem nenhuma configuração de menu no módulo -> libera tudo
   * (compatibilidade com quem só usa permissão por módulo).
   */
  function hasMenu(key: string): boolean {
    if (isAdmin) return true;
    const entry = MENU_BY_KEY[key];
    if (!entry) return true; // menu não catalogado: deixa passar (não bloqueia rotas internas tipo /app/hoje)
    if (!hasModule(entry.module)) return false;
    if (!modulesWithMenuConfig.has(entry.module)) return true;
    return menuKeys.has(key);
  }

  return {
    session, user, roles, modules, aal, mfaActive, loading,
    isAdmin, isModerator, isEditor, requiresMfa, mfaSatisfied,
    hasModule, hasMenu,
    menuKeys, modulesWithMenuConfig,
    mfaGraceUntil, graceActive, graceDaysLeft,
  };
}