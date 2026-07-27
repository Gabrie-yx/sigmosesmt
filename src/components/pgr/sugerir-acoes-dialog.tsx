import { useMemo, useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  open, onOpenChange, riscos, riscosSemPlano, jaVinculadas = [],
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  riscos: RiscoAlvo[];
  riscosSemPlano: RiscoAlvo[];
  jaVinculadas?: { inventario_id: string; biblioteca_id: string | null }[];
}) {
  const qc = useQueryClient();
  const [riscoId, setRiscoId] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [aba, setAba] = useState<"sugestoes" | "catalogo">("sugestoes");
  const [busca, setBusca] = useState("");
  const [fCat, setFCat] = useState("all");
  const [fHier, setFHier] = useState("all");

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

  // Ações da biblioteca já vinculadas a cada risco (evita duplicar no plano)
  const usadasPorRisco = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const v of jaVinculadas) {
      if (!v.biblioteca_id) continue;
      if (!m.has(v.inventario_id)) m.set(v.inventario_id, new Set());
      m.get(v.inventario_id)!.add(v.biblioteca_id);
    }
    return m;
  }, [jaVinculadas]);

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

  const jaNoPlano = usadasPorRisco.get(riscoId) ?? new Set<string>();

  // Pré-seleciona as ações de maior hierarquia de controle
  useEffect(() => {
    const top = [...sugestoes]
      .filter((s) => s.categoria !== "GERAL" && !jaNoPlano.has(s.id))
      .sort((a, b) => HIERARQUIA_ORDEM[a.hierarquia] - HIERARQUIA_ORDEM[b.hierarquia])
      .slice(0, 4)
      .map((s) => s.id);
    setSel(new Set(top));
  }, [sugestoes, riscoId]);

  // Catálogo completo (todas as ações da biblioteca, com busca e filtros)
  const catalogo = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return bib
      .filter((a) => (fCat === "all" ? true : a.categoria === fCat))
      .filter((a) => (fHier === "all" ? true : a.hierarquia === fHier))
      .filter((a) =>
        q.length === 0
          ? true
          : [a.acao, a.como ?? "", a.perigo_padrao, a.norma_ref ?? "", (a.palavras_chave ?? []).join(" ")]
              .join(" ")
              .toLowerCase()
              .includes(q),
      )
      .sort(
        (a, b) =>
          a.categoria.localeCompare(b.categoria) ||
          HIERARQUIA_ORDEM[a.hierarquia] - HIERARQUIA_ORDEM[b.hierarquia] ||
          a.acao.localeCompare(b.acao),
      );
  }, [bib, busca, fCat, fHier]);

  const contagem = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of bib) m[a.categoria] = (m[a.categoria] ?? 0) + 1;
    return m;
  }, [bib]);

  const toggle = (id: string) =>
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  const gerar = useMutation({
    mutationFn: async () => {
      if (!risco) throw new Error("Selecione o risco");
      const fonte = aba === "catalogo" ? catalogo : sugestoes;
      const escolhidas = fonte.filter((s) => sel.has(s.id) && !jaNoPlano.has(s.id));
      if (escolhidas.length === 0) throw new Error("Selecione pelo menos uma ação");
      const prazoBase = prazoPorNivel(cls);
      const rows = escolhidas.map((a) => ({
        inventario_id: risco.id,
        biblioteca_id: a.id,
        o_que: a.acao,
        por_que: `Controle do perigo "${risco.perigo}" — nível ${AIHA_LABEL[cls]}${a.norma_ref ? ` (${a.norma_ref})` : ""}`,
        como: a.como,
        onde: risco.fonte_geradora || null,
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
        const usadas = usadasPorRisco.get(r.id) ?? new Set<string>();
        const top = sugerirAcoes(bib, {
          perigo: r.perigo, categoria: r.categoria, classificacao: c,
          agravo: r.agravo, fonte: r.fonte_geradora,
        })
          .filter((s) => s.categoria !== "GERAL" && !usadas.has(s.id))
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
            onde: r.fonte_geradora || null,
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
            Catálogo normativo próprio com <b>{bib.length}</b> medidas de controle. As sugestões respeitam a
            hierarquia eliminação → substituição → engenharia → administrativa → EPI (NR-01).
          </DialogDescription>
        </DialogHeader>

        <Tabs value={aba} onValueChange={(v) => setAba(v as "sugestoes" | "catalogo")}>
          <TabsList className="h-auto flex-wrap justify-start gap-1 p-1">
            <TabsTrigger value="sugestoes">Sugestões para o risco</TabsTrigger>
            <TabsTrigger value="catalogo">Catálogo completo ({bib.length})</TabsTrigger>
          </TabsList>

        <TabsContent value="sugestoes" className="space-y-3">
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
              Nenhuma ação correspondente a esse perigo. Use a aba <b>Catálogo completo</b> para escolher
              qualquer uma das {bib.length} ações, ou cadastre a ação manualmente.
            </Card>
          ) : (
            <div className="space-y-1.5 max-h-[45vh] overflow-y-auto pr-1">
              {sugestoes.map((s) => {
                const usada = jaNoPlano.has(s.id);
                return (
                <Card
                  key={s.id}
                  className={`p-3 transition ${usada ? "opacity-60" : "cursor-pointer"} ${sel.has(s.id) ? "border-primary/60 bg-primary/5" : ""}`}
                  onClick={() => { if (!usada) toggle(s.id); }}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox checked={sel.has(s.id)} disabled={usada} onCheckedChange={() => toggle(s.id)} className="mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm">{s.acao}</div>
                      {s.como && <div className="text-xs text-muted-foreground mt-0.5">{s.como}</div>}
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        {usada && <Badge variant="outline" className="text-[10px]">já no plano</Badge>}
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
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="catalogo" className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Input placeholder="Buscar ação, perigo ou norma…" value={busca} onChange={(e) => setBusca(e.target.value)} />
            <Select value={fCat} onValueChange={setFCat}>
              <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias ({bib.length})</SelectItem>
                {Object.entries(contagem).map(([k, n]) => (
                  <SelectItem key={k} value={k}>{CATEGORIA_LABEL[k] ?? k} ({n})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={fHier} onValueChange={setFHier}>
              <SelectTrigger><SelectValue placeholder="Hierarquia" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as hierarquias</SelectItem>
                {(Object.entries(HIERARQUIA_LABEL) as [string, string][]).map(([k, l]) => (
                  <SelectItem key={k} value={k}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Vincular ao risco</Label>
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

          <div className="text-xs text-muted-foreground">{catalogo.length} ação(ões) no filtro</div>

          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground text-sm">Carregando biblioteca…</div>
          ) : (
            <div className="space-y-1.5 max-h-[45vh] overflow-y-auto pr-1">
              {catalogo.map((a) => {
                const usada = jaNoPlano.has(a.id);
                return (
                  <Card
                    key={a.id}
                    className={`p-3 transition ${usada ? "opacity-60" : "cursor-pointer"} ${sel.has(a.id) ? "border-primary/60 bg-primary/5" : ""}`}
                    onClick={() => { if (!usada) toggle(a.id); }}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox checked={sel.has(a.id)} disabled={usada} onCheckedChange={() => toggle(a.id)} className="mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm">{a.acao}</div>
                        {a.como && <div className="text-xs text-muted-foreground mt-0.5">{a.como}</div>}
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          {usada && <Badge variant="outline" className="text-[10px]">já no plano</Badge>}
                          <Badge variant="outline" className="text-[10px]">{CATEGORIA_LABEL[a.categoria] ?? a.categoria}</Badge>
                          <Badge variant="outline" className={`text-[10px] ${HIERARQUIA_COLOR[a.hierarquia]}`}>
                            {HIERARQUIA_LABEL[a.hierarquia]}
                          </Badge>
                          <Badge variant="outline" className={`text-[10px] ${PRIORIDADE_COLOR[a.prioridade]}`}>
                            {PRIORIDADE_LABEL[a.prioridade]}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">{a.prazo_dias} dias</Badge>
                          {a.norma_ref && <Badge variant="outline" className="text-[10px]">{a.norma_ref}</Badge>}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
              {catalogo.length === 0 && (
                <Card className="p-6 text-center text-sm text-muted-foreground">Nada encontrado com esses filtros.</Card>
              )}
            </div>
          )}
        </TabsContent>
        </Tabs>

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