import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Zap, ShieldAlert, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_TEXTO_GERAIS } from "@/lib/apr-defaults";

type Casco = { id: string; numero: string; nome: string | null };

/**
 * Aplica 1 modelo de APR em N cascos de uma vez.
 * Para cada casco selecionado cria 1 APR (RASCUNHO) com todos os riscos
 * do modelo já preenchidos. Pula cascos que já tenham APR ATIVA do mesmo modelo.
 */
export function AplicarModeloLoteDialog({
  open,
  onOpenChange,
  modeloPreselecionadoId,
  cascoPreselecionadoId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  modeloPreselecionadoId?: string | null;
  cascoPreselecionadoId?: string | null;
}) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [modeloId, setModeloId] = useState<string | null>(modeloPreselecionadoId ?? null);
  const [cascoIds, setCascoIds] = useState<string[]>(cascoPreselecionadoId ? [cascoPreselecionadoId] : []);

  const { data: modelos = [] } = useQuery({
    queryKey: ["apr-modelos-ativos"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("apr_modelos")
        .select("*")
        .eq("ativo", true)
        .order("ordem")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: cascos = [] } = useQuery({
    queryKey: ["cascos-light-list"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cascos")
        .select("id,numero,nome")
        .order("numero");
      if (error) throw error;
      return (data ?? []) as Casco[];
    },
  });

  // APRs ativas do modelo selecionado pra detectar duplicidade
  const { data: aprsDoModelo = [] } = useQuery({
    queryKey: ["aprs-do-modelo", modeloId],
    enabled: !!modeloId,
    queryFn: async () => {
      const { data } = await supabase
        .from("aprs")
        .select("casco_id,status")
        .eq("modelo_id", modeloId!)
        .in("status", ["RASCUNHO", "ATIVA"]);
      return data ?? [];
    },
  });

  const modelo = useMemo(() => modelos.find((m: any) => m.id === modeloId), [modelos, modeloId]);
  const cascosComApr = useMemo(
    () => new Set(aprsDoModelo.map((a: any) => a.casco_id).filter(Boolean)),
    [aprsDoModelo],
  );

  const filteredModelos = useMemo(() => {
    if (!search) return modelos;
    const s = search.toLowerCase();
    return modelos.filter((m: any) =>
      m.nome.toLowerCase().includes(s) ||
      (m.descricao_curta ?? "").toLowerCase().includes(s) ||
      (m.categoria ?? "").toLowerCase().includes(s),
    );
  }, [modelos, search]);

  const aplicar = useMutation({
    mutationFn: async () => {
      if (!modelo) throw new Error("Selecione um modelo");
      if (cascoIds.length === 0) throw new Error("Selecione ao menos um casco");

      const hojeISO = new Date().toISOString().slice(0, 10);
      const riscosModelo = Array.isArray(modelo.riscos) ? modelo.riscos : [];

      const resultados: { casco_id: string; numero?: string; erro?: string; skipped?: boolean }[] = [];

      for (const cascoId of cascoIds) {
        if (cascosComApr.has(cascoId)) {
          resultados.push({ casco_id: cascoId, skipped: true });
          continue;
        }
        try {
          const { data: numero, error: enErr } = await supabase.rpc("gerar_numero_apr");
          if (enErr) throw enErr;

          const payload = {
            numero,
            casco_id: cascoId,
            modelo_id: modelo.id,
            atividade_descricao: modelo.atividade_descricao,
            setor: null,
            local: modelo.local_padrao ?? null,
            condicoes_climaticas: modelo.condicoes_climaticas ?? null,
            observacoes_gerais: modelo.observacoes_gerais ?? null,
            exige_pte: modelo.exige_pte,
            data_emissao: hojeISO,
            validade_dias: 7,
            status: "RASCUNHO",
            texto_gerais: DEFAULT_TEXTO_GERAIS,
            hora_inicio: "07:30",
            hora_fim: "17:30",
            hora_inicio_sexta: "07:30",
            hora_fim_sexta: "16:30",
            dias_semana: ["SEG", "TER", "QUA", "QUI", "SEX"],
          } as any;

          const { data: novo, error: einErr } = await supabase
            .from("aprs")
            .insert(payload)
            .select("id,numero")
            .single();
          if (einErr) throw einErr;

          if (riscosModelo.length > 0) {
            const { error: erErr } = await supabase.from("apr_riscos").insert(
              riscosModelo.map((r: any, i: number) => ({
                apr_id: novo.id,
                ordem: i + 1,
                risco_nome: r.risco_nome ?? "",
                risco_categoria: r.risco_categoria ?? null,
                efeitos_danos: r.efeitos_danos ?? null,
                probabilidade: r.probabilidade ?? 1,
                severidade: r.severidade ?? 1,
                acoes_preventivas: r.acoes_preventivas ?? null,
                epis: Array.isArray(r.epis) ? r.epis : [],
                nrs: Array.isArray(r.nrs) ? r.nrs : [],
                responsavel_acoes: r.responsavel_acoes ?? null,
                passo_a_passo: r.passo_a_passo ?? null,
              })),
            );
            if (erErr) throw erErr;
          }

          resultados.push({ casco_id: cascoId, numero: novo.numero });
        } catch (e: any) {
          resultados.push({ casco_id: cascoId, erro: e.message });
        }
      }

      return resultados;
    },
    onSuccess: (resultados) => {
      const criados = resultados.filter((r) => r.numero).length;
      const skipped = resultados.filter((r) => r.skipped).length;
      const erros = resultados.filter((r) => r.erro).length;
      qc.invalidateQueries({ queryKey: ["aprs"] });
      qc.invalidateQueries({ queryKey: ["aprs-do-modelo"] });
      if (criados > 0)
        toast.success(`${criados} APR${criados !== 1 ? "s" : ""} criada${criados !== 1 ? "s" : ""} (RASCUNHO)`);
      if (skipped > 0)
        toast.info(`${skipped} casco${skipped !== 1 ? "s" : ""} pulado${skipped !== 1 ? "s" : ""} (já tinha APR deste modelo)`);
      if (erros > 0) toast.error(`${erros} falharam — veja o console`);
      onOpenChange(false);
      setCascoIds([]);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const cascosSelecionaveis = cascos.filter((c) => !cascosComApr.has(c.id));
  const todosSelecionados =
    cascosSelecionaveis.length > 0 && cascosSelecionaveis.every((c) => cascoIds.includes(c.id));

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setSearch(""); setModeloId(modeloPreselecionadoId ?? null); setCascoIds([]); } onOpenChange(v); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Aplicar modelo de APR a vários cascos
          </DialogTitle>
          <DialogDescription>
            Escolha um modelo e marque os cascos. O sistema cria 1 APR (status <b>RASCUNHO</b>) por casco, já com riscos preenchidos.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-[1fr_320px] gap-0 border-t">
          {/* Coluna 1: modelos */}
          <div className="flex flex-col overflow-hidden border-r">
            <div className="px-4 py-3 border-b">
              <div className="text-[11px] font-black text-slate-500 uppercase mb-2">1. Escolha o modelo</div>
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input placeholder="Buscar modelo..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-2 space-y-1">
              {filteredModelos.map((m: any) => {
                const ativo = modeloId === m.id;
                const numRiscos = Array.isArray(m.riscos) ? m.riscos.length : 0;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setModeloId(m.id)}
                    className={`w-full text-left p-2.5 rounded-lg border transition ${
                      ativo
                        ? "bg-amber-50 border-amber-400 ring-1 ring-amber-300"
                        : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-bold text-xs">{m.nome}</span>
                      {m.exige_pte && (
                        <Badge variant="outline" className="bg-amber-100 text-amber-900 border-amber-300 text-[9px] px-1 py-0">PTE</Badge>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500">{numRiscos} riscos • {m.categoria}</div>
                  </button>
                );
              })}
              {filteredModelos.length === 0 && (
                <div className="text-center text-xs text-slate-400 py-8">Nenhum modelo encontrado</div>
              )}
            </div>
          </div>

          {/* Coluna 2: cascos */}
          <div className="flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <div className="text-[11px] font-black text-slate-500 uppercase">2. Cascos destino</div>
              {cascosSelecionaveis.length > 0 && (
                <button
                  type="button"
                  className="text-[10px] font-bold text-[#991b1b] hover:underline"
                  onClick={() =>
                    setCascoIds(todosSelecionados ? [] : cascosSelecionaveis.map((c) => c.id))
                  }
                >
                  {todosSelecionados ? "Limpar" : "Todos"}
                </button>
              )}
            </div>
            <div className="overflow-y-auto flex-1 p-2 space-y-1">
              {cascos.map((c) => {
                const jaTem = cascosComApr.has(c.id);
                const marcado = cascoIds.includes(c.id);
                return (
                  <label
                    key={c.id}
                    className={`flex items-center gap-2 p-2 rounded border text-xs ${
                      jaTem
                        ? "bg-emerald-50 border-emerald-200 text-emerald-800 cursor-not-allowed opacity-70"
                        : marcado
                        ? "bg-[#991b1b]/5 border-[#991b1b]/40 cursor-pointer"
                        : "bg-white border-slate-200 hover:bg-slate-50 cursor-pointer"
                    }`}
                  >
                    {jaTem ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    ) : (
                      <Checkbox
                        checked={marcado}
                        onCheckedChange={(v) =>
                          setCascoIds((prev) => (v ? [...prev, c.id] : prev.filter((x) => x !== c.id)))
                        }
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-bold">CASCO {c.numero}</div>
                      {c.nome && <div className="text-[10px] text-slate-500 truncate">{c.nome}</div>}
                    </div>
                    {jaTem && <span className="text-[9px] font-black uppercase">já tem</span>}
                  </label>
                );
              })}
              {cascos.length === 0 && (
                <div className="text-center text-xs text-slate-400 py-8">Nenhum casco cadastrado</div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-3 border-t bg-slate-50 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-600">
            {modelo ? (
              <>
                <b>{modelo.nome}</b> → {cascoIds.length} casco{cascoIds.length !== 1 ? "s" : ""}
              </>
            ) : (
              <span className="text-slate-400">Selecione um modelo</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={aplicar.isPending}>Cancelar</Button>
            <Button
              className="bg-[#991b1b] hover:bg-[#7f1d1d]"
              disabled={!modeloId || cascoIds.length === 0 || aplicar.isPending}
              onClick={() => aplicar.mutate()}
            >
              {aplicar.isPending ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Criando...</>
              ) : (
                <><ShieldAlert className="h-4 w-4 mr-1" /> Criar {cascoIds.length || ""} APR{cascoIds.length !== 1 ? "s" : ""}</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}