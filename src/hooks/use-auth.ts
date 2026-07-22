import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MENU_BY_KEY } from "@/lib/menu-catalog";
import type { AppModule, AppRole } from "@/lib/access-control";

export type { AppModule, AppRole };

type AuthPayload = {
  roles: AppRole[];
  modules: AppModule[];
  menuKeys: Set<string>;
  modulesWithMenuConfig: Set<AppModule>;
  aal: "aal1" | "aal2";
  mfaActive: boolean;
  mfaGraceUntil: Date | null;
};

const EMPTY_PAYLOAD: AuthPayload = {
  roles: [],
  modules: [],
  menuKeys: new Set(),
  modulesWithMenuConfig: new Set(),
  aal: "aal1",
  mfaActive: false,
  mfaGraceUntil: null,
};

async function fetchAuthPayload(uid: string): Promise<AuthPayload> {
  const [rolesRes, modsRes, menusRes, aalRes, factorsRes, profileRes] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", uid),
    supabase.from("user_module_access").select("module, enabled").eq("user_id", uid).eq("enabled", true),
    (supabase as any).from("user_menu_access").select("menu_key, enabled").eq("user_id", uid),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
    (supabase as any).from("profiles").select("mfa_grace_until").eq("id", uid).maybeSingle(),
  ]);
  const rows = (menusRes?.data ?? []) as { menu_key: string; enabled: boolean }[];
  const enabledKeys = new Set(rows.filter((r) => r.enabled).map((r) => r.menu_key));
  const configuredModules = new Set<AppModule>();
  for (const r of rows) {
    const m = MENU_BY_KEY[r.menu_key]?.module;
    if (m) configuredModules.add(m);
  }
  const totps = (factorsRes.data?.totp ?? []).filter((f) => f.status === "verified");
  const g = (profileRes as any)?.data?.mfa_grace_until as string | null | undefined;
  return {
    roles: (rolesRes.data ?? []).map((r) => r.role as AppRole),
    modules: (modsRes.data ?? []).map((m) => m.module as AppModule),
    menuKeys: enabledKeys,
    modulesWithMenuConfig: configuredModules,
    aal: ((aalRes.data?.currentLevel ?? "aal1") as "aal1" | "aal2"),
    mfaActive: totps.length > 0,
    mfaGraceUntil: g ? new Date(g) : null,
  };
}

// Sessão fica em módulo (singleton) — evita cada componente escutar
// onAuthStateChange separadamente e refazer o loadAll.
let cachedSession: Session | null | undefined = undefined;
const sessionListeners = new Set<(s: Session | null) => void>();
let sessionSubStarted = false;

function startSessionSub() {
  if (sessionSubStarted) return;
  sessionSubStarted = true;
  supabase.auth.getSession().then(({ data }) => {
    cachedSession = data.session;
    sessionListeners.forEach((fn) => fn(cachedSession ?? null));
  });
  supabase.auth.onAuthStateChange((event, s) => {
    // TOKEN_REFRESHED não muda uid; só notifica se mudou de fato.
    const prevUid = cachedSession?.user?.id ?? null;
    const nextUid = s?.user?.id ?? null;
    cachedSession = s;
    if (event === "TOKEN_REFRESHED" && prevUid === nextUid) return;
    sessionListeners.forEach((fn) => fn(s));
  });
}

export function useAuth() {
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null>(cachedSession ?? null);

  useEffect(() => {
    startSessionSub();
    const listener = (s: Session | null) => {
      setSession((prev) => {
        const prevUid = prev?.user?.id ?? null;
        const nextUid = s?.user?.id ?? null;
        if (prevUid !== nextUid) {
          // Invalida cache do usuário anterior; próximo useQuery refaz.
          qc.invalidateQueries({ queryKey: ["auth-payload"] });
        }
        return s;
      });
    };
    sessionListeners.add(listener);
    if (cachedSession !== undefined) setSession(cachedSession);
    return () => {
      sessionListeners.delete(listener);
    };
  }, [qc]);

  const user: User | null = session?.user ?? null;
  const uid = user?.id ?? null;

  const { data: payload, isLoading: payloadLoading } = useQuery({
    queryKey: ["auth-payload", uid],
    queryFn: () => fetchAuthPayload(uid!),
    enabled: !!uid,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const { roles, modules, menuKeys, modulesWithMenuConfig, aal, mfaActive, mfaGraceUntil } =
    payload ?? EMPTY_PAYLOAD;

  const loading = cachedSession === undefined || (!!uid && payloadLoading && !payload);

  const isAdmin = roles.includes("admin");
  const isModerator = isAdmin || roles.includes("moderador");
  const isEditor = isModerator || roles.includes("editor") || roles.includes("tst") || roles.includes("compras");
  const isExtraSabadoMarcador = roles.includes("extra_sabado_marcador" as AppRole);
  const isSupervisorExtraGeral = roles.includes("supervisor_extra_geral" as AppRole);
  // Marcador operacional: pode ter viewer base do convite, mas deve cair no painel mobile.
  const isMarcadorPuro = isExtraSabadoMarcador
    && !isAdmin && !isModerator
    && !roles.includes("editor") && !roles.includes("tst")
    && !roles.includes("compras");
  // Porteiro puro: só o papel de porteiro (sem admin/mod/editor/tst/compras).
  // Ao logar, cai direto no cockpit da Portaria (/app/portaria).
  const isPorteiroPuro = roles.includes("porteiro" as AppRole)
    && !isAdmin && !isModerator
    && !roles.includes("editor") && !roles.includes("tst")
    && !roles.includes("compras");
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
    isExtraSabadoMarcador, isMarcadorPuro, isSupervisorExtraGeral, isPorteiroPuro,
    hasModule, hasMenu,
    menuKeys, modulesWithMenuConfig,
    mfaGraceUntil, graceActive, graceDaysLeft,
  };
}