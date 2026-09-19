import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, IS_BACKEND_LOCAL } from "@/integrations/supabase/client";
import {
  CONFIG_VAZIA,
  moduloLigado,
  rotuloDe,
  type EmpresaConfig,
  type ModulosMap,
  type RotuloKey,
  type RotulosMap,
} from "@/lib/config-sistema";
import type { AppModule } from "@/lib/access-control";

async function carregarConfigGlobal(): Promise<EmpresaConfig> {
  const { data, error } = await supabase
    .from("empresa_config")
    .select("id, company_id, ramo, rotulos, modulos")
    .is("company_id", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ...CONFIG_VAZIA };
  return {
    id: data.id,
    company_id: null,
    ramo: (data.ramo as string | null) ?? null,
    rotulos: ((data.rotulos as RotulosMap) ?? {}) as RotulosMap,
    modulos: ((data.modulos as ModulosMap) ?? {}) as ModulosMap,
  };
}

export function useConfigSistema() {
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["empresa-config", "global"],
    queryFn: carregarConfigGlobal,
    staleTime: 60_000,
  });

  const cfg = q.data ?? CONFIG_VAZIA;

  const salvar = useMutation({
    mutationFn: async (patch: Partial<Pick<EmpresaConfig, "ramo" | "rotulos" | "modulos">>) => {
      const atual = await carregarConfigGlobal();
      const novo = {
        ramo: patch.ramo !== undefined ? patch.ramo : atual.ramo,
        rotulos: patch.rotulos ?? atual.rotulos,
        modulos: patch.modulos ?? atual.modulos,
      };
      if (atual.id) {
        const { error } = await supabase
          .from("empresa_config")
          .update(novo as never)
          .eq("id", atual.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("empresa_config")
          .insert({ company_id: null, ...novo } as never);
        if (error) throw error;
      }
      // Auditoria (não bloqueia o salvamento se falhar)
      try {
        const { data: u } = await supabase.auth.getUser();
        await supabase.from("audit_logs").insert({
          action: "UPDATE",
          entity: "empresa_config",
          entity_id: atual.id ?? null,
          user_id: u?.user?.id ?? null,
          detalhes: novo,
        } as never);
      } catch {
        /* auditoria best-effort */
      }
      return novo;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["empresa-config"] });
    },
  });

  return {
    config: cfg,
    carregando: q.isLoading,
    salvar,
    rotulo: (k: RotuloKey, forma: "singular" | "plural" = "singular") => rotuloDe(cfg, k, forma),
    // No servidor DMN nada é desligado por configuração: tudo continua ligado.
    moduloAtivo: (m: AppModule) => (IS_BACKEND_LOCAL ? true : moduloLigado(cfg, m)),
  };
}

/** Rótulo configurável para uso direto nas telas. */
export function useRotulo(key: RotuloKey, forma: "singular" | "plural" = "singular") {
  const { rotulo } = useConfigSistema();
  return rotulo(key, forma);
}
