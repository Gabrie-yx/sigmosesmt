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
      const { error } = await supabase.from("inspecao_ncs").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} NC(s) criada(s) a partir da análise por IA`);
      qc.invalidateQueries({ queryKey: ["inspecao-ncs", inspecaoId] });
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
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Análise por IA das evidências</DialogTitle>
        </DialogHeader>

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
              <div className="text-xs text-muted-foreground border-l-2 border-primary pl-2 italic">
                <b className="not-italic text-foreground">Parecer IA:</b> {parecer}
              </div>
            )}
            <div className="space-y-2">
              {sugestoes.map((n, i) => (
                <div key={i} className="border rounded p-2 space-y-2 bg-card">
                  <div className="flex items-start gap-2">
                    <Checkbox checked={n._sel} onCheckedChange={() => toggle(i)} className="mt-1" />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge className={CLASSE_CLS[n.classe_risco] + " text-[10px] font-black border"}>{n.classe_risco}</Badge>
                        <Badge variant="outline" className="text-[10px]">{n.nr_codigo}{n.nr_item ? ` · ${n.nr_item}` : ""}</Badge>
                        <Badge variant="outline" className="text-[10px]">P{n.probabilidade}×S{n.severidade}={n.risco_calculado}</Badge>
                        {n.foto_id && <Badge variant="secondary" className="text-[10px]">Foto linkada</Badge>}
                      </div>
                      <Textarea rows={2} value={n.descricao} onChange={(e) => editar(i, { descricao: e.target.value })} className="text-xs" />
                      <Textarea rows={2} value={n.recomendacao} onChange={(e) => editar(i, { recomendacao: e.target.value })} className="text-xs" placeholder="Recomendação" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">
              Você ainda precisará abrir cada NC criada e montar o 5W2H (plano PDCA) antes de publicar a inspeção.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={salvar.isPending}>Cancelar</Button>
          {sugestoes.length > 0 && !rodando && (
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending || sugestoes.every((n) => !n._sel)}>
              {salvar.isPending ? "Salvando…" : `Criar ${sugestoes.filter((n) => n._sel).length} NC(s)`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}