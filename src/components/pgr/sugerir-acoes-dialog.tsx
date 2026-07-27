import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Wand2, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { classifyAiha, AIHA_LABEL, AIHA_COLOR, CATEGORIA_LABEL } from "@/lib/aiha";
import {
  sugerirAcoes, prioridadePorNivel, prazoPorNivel, prazoParaData,
  HIERARQUIA_LABEL, HIERARQUIA_COLOR, HIERARQUIA_ORDEM,
  PRIORIDADE_LABEL, PRIORIDADE_COLOR,
  type AcaoBiblioteca,
} from "@/lib/pgr-acoes-biblioteca";

const sb: any = supabase;

export type RiscoAlvo = {
  id: string;
  perigo: string;
  categoria: string;
  agravo: string | null;
  fonte_geradora: string | null;
  probabilidade: number | null;
  severidade: number | null;
};

export function SugerirAcoesDialog({
  open, onOpenChange, riscos, riscosSemPlano,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  riscos: RiscoAlvo[];
  riscosSemPlano: RiscoAlvo[];
}) {
  const qc = useQueryClient();
  const [riscoId, setRiscoId] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());

  const { data: bib = [], isLoading } = useQuery<AcaoBiblioteca[]>({
    queryKey: ["pgr_acoes_biblioteca"],
    queryFn: async () => {
      const { data, error } = await sb.from("pgr_acoes_biblioteca").select("*").eq("ativo", true);
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  useEffect(() => {
    if (open) setRiscoId(riscosSemPlano[0]?.id ?? riscos[0]?.id ?? "");
  }, [open, riscos, riscosSemPlano]);

  const risco = riscos.find((r) => r.id === riscoId) ?? null;
  const cls = risco ? classifyAiha(risco.probabilidade, risco.severidade) : "NAO_CLASSIFICADO";

  const sugestoes = useMemo(() => {
    if (!risco) return [];
    return sugerirAcoes(bib, {
      perigo: risco.perigo,
      categoria: risco.categoria,
      classificacao: cls,
      agravo: risco.agravo,
      fonte: risco.fonte_geradora,
    });
  }, [bib, risco, cls]);

  // Pré-seleciona as ações de maior hierarquia de controle
  useEffect(() => {
    const top = [...sugestoes]
      .filter((s) => s.categoria !== "GERAL")
      .sort((a, b) => HIERARQUIA_ORDEM[a.hierarquia] - HIERARQUIA_ORDEM[b.hierarquia])
      .slice(0, 4)
      .map((s) => s.id);
    setSel(new Set(top));
  }, [sugestoes]);

  const toggle = (id: string) =>
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  const gerar = useMutation({
    mutationFn: async () => {
      if (!risco) throw new Error("Selecione o risco");
      const escolhidas = sugestoes.filter((s) => sel.has(s.id));
      if (escolhidas.length === 0) throw new Error("Selecione pelo menos uma ação");
      const prazoBase = prazoPorNivel(cls);
      const rows = escolhidas.map((a) => ({
        inventario_id: risco.id,
        biblioteca_id: a.id,
        o_que: a.acao,
        por_que: `Controle do perigo "${risco.perigo}" — nível ${AIHA_LABEL[cls]}${a.norma_ref ? ` (${a.norma_ref})` : ""}`,
        como: a.como,
        quando: prazoParaData(Math.min(a.prazo_dias, prazoBase)),
        prioridade: prioridadePorNivel(cls),
        hierarquia: a.hierarquia,
        status: "PENDENTE",
      }));
      const { error } = await sb.from("pgr_plano_acao").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["pgr_plano_acao"] });
      toast.success(`${n} ação(ões) geradas no plano`);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const gerarLote = useMutation({
    mutationFn: async () => {
      if (riscosSemPlano.length === 0) throw new Error("Nenhum risco sem plano");
      const rows: any[] = [];
      for (const r of riscosSemPlano) {
        const c = classifyAiha(r.probabilidade, r.severidade);
        const top = sugerirAcoes(bib, {
          perigo: r.perigo, categoria: r.categoria, classificacao: c,
          agravo: r.agravo, fonte: r.fonte_geradora,
        })
          .filter((s) => s.categoria !== "GERAL")
          .sort((a, b) => HIERARQUIA_ORDEM[a.hierarquia] - HIERARQUIA_ORDEM[b.hierarquia])
          .slice(0, 3);
        const prazoBase = prazoPorNivel(c);
        for (const a of top) {
          rows.push({
            inventario_id: r.id,
            biblioteca_id: a.id,
            o_que: a.acao,
            por_que: `Controle do perigo "${r.perigo}" — nível ${AIHA_LABEL[c]}${a.norma_ref ? ` (${a.norma_ref})` : ""}`,
            como: a.como,
            quando: prazoParaData(Math.min(a.prazo_dias, prazoBase)),
            prioridade: prioridadePorNivel(c),
            hierarquia: a.hierarquia,
            status: "PENDENTE",
          });
        }
      }
      if (rows.length === 0) throw new Error("Nenhuma ação correspondente na biblioteca");
      const { error } = await sb.from("pgr_plano_acao").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["pgr_plano_acao"] });
      toast.success(`${n} ação(ões) geradas para ${riscosSemPlano.length} risco(s)`);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />Biblioteca de ações (NR-01)
          </DialogTitle>
          <DialogDescription>
            Catálogo normativo de medidas de controle. As sugestões respeitam a hierarquia
            eliminação → substituição → engenharia → administrativa → EPI.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Risco do inventário</Label>
            <Select value={riscoId} onValueChange={setRiscoId}>
              <SelectTrigger><SelectValue placeholder="Selecione o risco" /></SelectTrigger>
              <SelectContent>
                {riscos.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.perigo} — {CATEGORIA_LABEL[r.categoria] ?? r.categoria}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {risco && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline" className={AIHA_COLOR[cls]}>{AIHA_LABEL[cls]}</Badge>
              <Badge variant="outline" className={PRIORIDADE_COLOR[prioridadePorNivel(cls)]}>
                Prioridade {PRIORIDADE_LABEL[prioridadePorNivel(cls)]}
              </Badge>
              <span className="text-muted-foreground">Prazo sugerido: {prazoPorNivel(cls)} dias</span>
            </div>
          )}

          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground text-sm">Carregando biblioteca…</div>
          ) : sugestoes.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              Nenhuma ação correspondente. Ajuste o nome do perigo ou cadastre a ação manualmente.
            </Card>
          ) : (
            <div className="space-y-1.5 max-h-[45vh] overflow-y-auto pr-1">
              {sugestoes.map((s) => (
                <Card
                  key={s.id}
                  className={`p-3 cursor-pointer transition ${sel.has(s.id) ? "border-primary/60 bg-primary/5" : ""}`}
                  onClick={() => toggle(s.id)}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox checked={sel.has(s.id)} onCheckedChange={() => toggle(s.id)} className="mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">{s.acao}</div>
                      {s.como && <div className="text-xs text-muted-foreground mt-0.5">{s.como}</div>}
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        <Badge variant="outline" className={`text-[10px] ${HIERARQUIA_COLOR[s.hierarquia]}`}>
                          {HIERARQUIA_LABEL[s.hierarquia]}
                        </Badge>
                        <Badge variant="outline" className={`text-[10px] ${PRIORIDADE_COLOR[s.prioridade]}`}>
                          {PRIORIDADE_LABEL[s.prioridade]}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">{s.prazo_dias} dias</Badge>
                        {s.norma_ref && <Badge variant="outline" className="text-[10px]">{s.norma_ref}</Badge>}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="outline"
            className="gap-2"
            disabled={gerarLote.isPending || riscosSemPlano.length === 0}
            onClick={() => {
              if (confirm(`Gerar as 3 ações de maior hierarquia para ${riscosSemPlano.length} risco(s) sem plano?`))
                gerarLote.mutate();
            }}
          >
            <Wand2 className="h-4 w-4" />
            Gerar em lote ({riscosSemPlano.length})
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={() => gerar.mutate()} disabled={gerar.isPending || sel.size === 0} className="gap-2">
              <Sparkles className="h-4 w-4" />
              {gerar.isPending ? "Gerando…" : `Adicionar ${sel.size} ao plano`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}