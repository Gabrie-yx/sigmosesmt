import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { analisarFotosInspecao, type NcSugerida } from "@/lib/inspecao-fotos-ia.functions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

const CLASSE_CLS: Record<string, string> = {
  BAIXO: "bg-emerald-500/15 text-emerald-200 border-emerald-500/40",
  MODERADO: "bg-yellow-500/15 text-yellow-200 border-yellow-500/40",
  ALTO: "bg-orange-500/15 text-orange-200 border-orange-500/40",
  CRITICO: "bg-red-500/20 text-red-100 border-red-500/50",
};

const PRAZO_POR_RISCO: Record<string, number> = {
  CRITICO: 1,
  ALTO: 7,
  MODERADO: 15,
  BAIXO: 30,
};

const PRIORIDADE_POR_RISCO: Record<string, "CRITICA" | "ALTA" | "MEDIA" | "BAIXA"> = {
  CRITICO: "CRITICA",
  ALTO: "ALTA",
  MODERADO: "MEDIA",
  BAIXO: "BAIXA",
};

function dataPrazo(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

function montarPlanoSugerido(n: NcSugerida, ncId: string, userId: string) {
  const dias = PRAZO_POR_RISCO[n.classe_risco] ?? 15;
  const norma = `${n.nr_codigo}${n.nr_item ? ` ${n.nr_item}` : ""}`.trim();
  return {
    nc_id: ncId,
    acao: (n.recomendacao || `Corrigir a condição identificada: ${n.descricao}`).trim(),
    por_que: `Eliminar/controlar o risco identificado na NC${norma ? ` (${norma})` : ""}: ${n.descricao}`,
    onde: "Área evidenciada na foto da inspeção",
    como: "Comunicar a liderança, controlar ou paralisar a atividade quando aplicável, corrigir a condição, registrar evidência fotográfica e validar a eficácia antes do encerramento.",
    responsavel_nome: "Encarregado da área / SESMT",
    prazo: dataPrazo(dias),
    custo_estimado: null,
    prioridade: PRIORIDADE_POR_RISCO[n.classe_risco] ?? "MEDIA",
    prazo_dias_sugerido: dias,
    criada_por: userId,
  };
}

export function AnalisarFotosIA({ inspecaoId, temFotos, disabled }: { inspecaoId: string; temFotos: boolean; disabled?: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const analisar = useServerFn(analisarFotosInspecao);
  const [open, setOpen] = useState(false);
  const [contexto, setContexto] = useState("");
  const [parecer, setParecer] = useState<string>("");
  const [sugestoes, setSugestoes] = useState<Array<NcSugerida & { _sel: boolean }>>([]);
  const [rodando, setRodando] = useState(false);

  async function rodarIA() {
    setRodando(true);
    try {
      const r = await analisar({ data: { inspecao_id: inspecaoId, contexto: contexto || null } });
      setParecer(r.parecer);
      setSugestoes(r.ncs.map((n) => ({ ...n, _sel: true })));
      if (r.ncs.length === 0) toast.info("IA não identificou NCs claras nas fotos.");
      else toast.success(`${r.ncs.length} NC(s) sugeridas — revise e confirme.`);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha na análise por IA");
    } finally {
      setRodando(false);
    }
  }

  const salvar = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessão expirada");
      const selecionadas = sugestoes.filter((n) => n._sel);
      if (!selecionadas.length) throw new Error("Selecione ao menos uma NC");
      const rows = selecionadas.map((n) => ({
        inspecao_id: inspecaoId,
        foto_id: n.foto_id,
        nr_codigo: n.nr_codigo,
        nr_item: n.nr_item,
        descricao: n.descricao,
        probabilidade: n.probabilidade,
        severidade: n.severidade,
        recomendacao: n.recomendacao || null,
        criada_por: user.id,
      }));
      const { data: criadas, error } = await supabase.from("inspecao_ncs").insert(rows).select("id, descricao");
      if (error) throw error;
      // Map defensivo por descrição (única no lote da IA) em vez de índice.
      const porDesc = new Map<string, string>();
      (criadas ?? []).forEach((c: any) => porDesc.set(c.descricao, c.id));
      const planos = selecionadas
        .map((n) => {
          const ncId = porDesc.get(n.descricao);
          return ncId ? montarPlanoSugerido(n, ncId, user.id) : null;
        })
        .filter(Boolean);
      let planosCriados = 0;
      let planoErr: string | null = null;
      if (planos.length) {
        const { error: planoError, count } = await supabase
          .from("inspecao_ncs_planos")
          .insert(planos as any, { count: "exact" });
        if (planoError) planoErr = planoError.message;
        else planosCriados = count ?? planos.length;
      }
      return { ncs: rows.length, planos: planosCriados, planoErr };
    },
    onSuccess: (r) => {
      if (r.planoErr) {
        toast.warning(
          `${r.ncs} NC(s) criada(s), mas o 5W2H automático falhou: ${r.planoErr}. Abra cada NC e clique em "Criar 5W2H automático".`,
          { duration: 8000 },
        );
      } else {
        toast.success(`${r.ncs} NC(s) criada(s) com ${r.planos} plano(s) 5W2H sugerido(s)`);
      }
      qc.invalidateQueries({ queryKey: ["inspecao-ncs", inspecaoId] });
      qc.invalidateQueries({ queryKey: ["inspecao-planos-resumo"] });
      setOpen(false);
      setSugestoes([]);
      setParecer("");
      setContexto("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar NCs"),
  });

  function toggle(i: number) {
    setSugestoes((s) => s.map((n, k) => k === i ? { ...n, _sel: !n._sel } : n));
  }

  function editar(i: number, patch: Partial<NcSugerida>) {
    setSugestoes((s) => s.map((n, k) => k === i ? { ...n, ...patch } : n));
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!salvar.isPending) setOpen(o); }}>
      <Button
        size="sm"
        variant="outline"
        className="gap-1"
        disabled={disabled || !temFotos}
        onClick={() => setOpen(true)}
        title={!temFotos ? "Envie ao menos uma foto primeiro" : "Analisar fotos com IA"}
      >
        <Sparkles className="h-3.5 w-3.5" /> Analisar fotos com IA
      </Button>
      <DialogContent className="flex max-h-[92dvh] w-[calc(100vw-1rem)] max-w-3xl flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 px-4 pt-4 sm:px-6 sm:pt-6">
          <DialogTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary shrink-0" /> <span className="truncate">Análise por IA das evidências</span></DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-6">
        {sugestoes.length === 0 && !rodando && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              A IA (TST sênior) vai olhar as fotos anexadas e sugerir NCs pré-preenchidas (NR, descrição, P×S, recomendação) linkadas com a foto de origem. Você revisa, ajusta e confirma.
            </p>
            <div className="space-y-1">
              <Label className="text-xs">Contexto adicional (opcional)</Label>
              <Textarea rows={3} value={contexto} onChange={(e) => setContexto(e.target.value)}
                placeholder="Ex.: pátio de pré-montagem, operação de içamento de chapas com guindaste Grove, chuva no local, equipe X." />
            </div>
            <Button onClick={rodarIA} className="w-full gap-2">
              <Sparkles className="h-4 w-4" /> Rodar análise
            </Button>
          </div>
        )}

        {rodando && (
          <div className="flex flex-col items-center gap-3 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            Analisando fotos com IA… (pode levar 20-40s)
          </div>
        )}

        {sugestoes.length > 0 && !rodando && (
          <div className="space-y-3">
            {parecer && (
              <div className="text-xs text-muted-foreground border-l-2 border-primary pl-2 italic break-words">
                <b className="not-italic text-foreground">Parecer IA:</b> {parecer}
              </div>
            )}
            <div className="space-y-2">
              {sugestoes.map((n, i) => (
                <div key={i} className="border rounded p-2 space-y-2 bg-card/60">
                  <div className="flex items-start gap-2">
                    <Checkbox checked={n._sel} onCheckedChange={() => toggle(i)} className="mt-1 shrink-0" />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge className={CLASSE_CLS[n.classe_risco] + " text-[10px] font-black border"}>{n.classe_risco}</Badge>
                        <Badge variant="outline" className="text-[10px] break-all">{n.nr_codigo}{n.nr_item ? ` · ${n.nr_item}` : ""}</Badge>
                        <Badge variant="outline" className="text-[10px]">P{n.probabilidade}×S{n.severidade}={n.risco_calculado}</Badge>
                        {n.foto_id && <Badge variant="secondary" className="text-[10px]">Foto linkada</Badge>}
                      </div>
                      <Textarea rows={3} value={n.descricao} onChange={(e) => editar(i, { descricao: e.target.value })} className="text-xs w-full" />
                      <Textarea rows={3} value={n.recomendacao} onChange={(e) => editar(i, { recomendacao: e.target.value })} className="text-xs w-full" placeholder="Recomendação" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Ao confirmar, o sistema já cria um 5W2H inicial para cada NC selecionada. Você só revisa responsável, prazo e texto se quiser.
            </p>
          </div>
        )}
        </div>
        <DialogFooter className="shrink-0 gap-2 border-t border-border/60 bg-background/60 px-4 py-3 sm:px-6 flex-col-reverse sm:flex-row">
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => setOpen(false)} disabled={salvar.isPending}>Cancelar</Button>
          {sugestoes.length > 0 && !rodando && (
            <Button className="w-full sm:w-auto" onClick={() => salvar.mutate()} disabled={salvar.isPending || sugestoes.every((n) => !n._sel)}>
              {salvar.isPending ? "Salvando…" : `Criar ${sugestoes.filter((n) => n._sel).length} NC(s)`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}