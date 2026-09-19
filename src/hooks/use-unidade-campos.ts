import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CampoDef } from "@/lib/campos-dinamicos";

function normalizar(row: any): CampoDef {
  return {
    id: row.id,
    company_id: row.company_id ?? null,
    aba: row.aba ?? "Dados",
    aba_ordem: row.aba_ordem ?? 0,
    chave: row.chave,
    label: row.label,
    tipo: row.tipo,
    obrigatorio: !!row.obrigatorio,
    ordem: row.ordem ?? 0,
    opcoes: Array.isArray(row.opcoes) ? (row.opcoes as string[]) : [],
    ajuda: row.ajuda ?? null,
    mostrar_lista: !!row.mostrar_lista,
    ativo: row.ativo !== false,
  };
}

/** Campos das unidades. Definição da empresa quando existir; senão, a global. */
export function useUnidadeCampos(companyId?: string | null) {
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["unidade-campos", companyId ?? "global"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unidade_campos")
        .select("*")
        .order("aba_ordem")
        .order("ordem");
      if (error) throw error;
      const todos = (data ?? []).map(normalizar);
      const daEmpresa = companyId ? todos.filter((c) => c.company_id === companyId) : [];
      return daEmpresa.length ? daEmpresa : todos.filter((c) => c.company_id === null);
    },
    staleTime: 30_000,
  });

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["unidade-campos"] });
    qc.invalidateQueries({ queryKey: ["unidade-campos-admin"] });
  };

  const salvar = useMutation({
    mutationFn: async (campo: Partial<CampoDef> & { id?: string }) => {
      const payload: any = {
        company_id: campo.company_id ?? null,
        aba: campo.aba,
        aba_ordem: campo.aba_ordem ?? 0,
        chave: campo.chave,
        label: campo.label,
        tipo: campo.tipo,
        obrigatorio: campo.obrigatorio ?? false,
        ordem: campo.ordem ?? 0,
        opcoes: campo.opcoes ?? [],
        ajuda: campo.ajuda ?? null,
        mostrar_lista: campo.mostrar_lista ?? false,
        ativo: campo.ativo ?? true,
      };
      if (campo.id) {
        const { error } = await supabase.from("unidade_campos").update(payload).eq("id", campo.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("unidade_campos").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: invalidar,
  });

  const reordenar = useMutation({
    mutationFn: async (itens: { id: string; ordem: number; aba?: string; aba_ordem?: number }[]) => {
      for (const it of itens) {
        const patch: any = { ordem: it.ordem };
        if (it.aba !== undefined) patch.aba = it.aba;
        if (it.aba_ordem !== undefined) patch.aba_ordem = it.aba_ordem;
        const { error } = await supabase.from("unidade_campos").update(patch).eq("id", it.id);
        if (error) throw error;
      }
    },
    onSuccess: invalidar,
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      // Exclusão suave: some das telas, o valor antigo continua guardado.
      const { error } = await supabase.from("unidade_campos").update({ ativo: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidar,
  });

  const reativar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("unidade_campos").update({ ativo: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidar,
  });

  /** Exclusão definitiva de um campo (some da lista de vez). */
  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("unidade_campos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidar,
  });

  /** Apaga TODOS os campos (globais e por empresa). */
  const excluirTodos = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("unidade_campos")
        .delete()
        .not("id", "is", null);
      if (error) throw error;
    },
    onSuccess: invalidar,
  });

  return {
    campos: q.data ?? [],
    carregando: q.isLoading,
    salvar,
    reordenar,
    remover,
    reativar,
    excluir,
    excluirTodos,
  };
}

/** Todos os campos (inclusive inativos) — usado pelo construtor. */
export function useUnidadeCamposAdmin() {
  const q = useQuery({
    queryKey: ["unidade-campos-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unidade_campos")
        .select("*")
        .order("aba_ordem")
        .order("ordem");
      if (error) throw error;
      return (data ?? []).map(normalizar);
    },
  });
  return { campos: q.data ?? [], carregando: q.isLoading };
}
