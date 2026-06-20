import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ClipboardEdit, Info, CheckCircle2, AlertTriangle, ShieldAlert, Ban } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Extintor = { id: string; numero?: string | null; tipo_agente?: string | null; localizacao?: string | null };

/** Resultado por item da checklist mensal */
type ItemStatus = "ok" | "nc" | "na" | null;

/** Checklist NR-23 / ABNT NBR 12962 / IT-CBMERJ — inspeção mensal */
const CHECKLIST = [
  {
    id: "acesso",
    titulo: "Acesso e sinalização",
    desc: "Desobstruído, placa/seta visível, piso sinalizado.",
    severidade: "maior" as const,
    norma: "NR-23 / IT-CBMERJ",
  },
  {
    id: "posicionamento",
    titulo: "Posicionamento",
    desc: "Altura entre 0,20 m e 1,60 m, suporte firme.",
    severidade: "menor" as const,
    norma: "ABNT NBR 12693",
  },
  {
    id: "integridade",
    titulo: "Integridade externa",
    desc: "Sem amassados, rachaduras ou corrosão.",
    severidade: "critica" as const,
    norma: "ABNT NBR 12962",
  },
  {
    id: "manometro",
    titulo: "Manômetro (faixa verde)",
    desc: "Ponteiro dentro da faixa verde (pressurizados).",
    severidade: "critica" as const,
    norma: "ABNT NBR 12962",
  },
  {
    id: "lacre_pino",
    titulo: "Lacre e pino de segurança",
    desc: "Lacre íntegro e pino travado no lugar.",
    severidade: "critica" as const,
    norma: "ABNT NBR 12962",
  },
  {
    id: "componentes",
    titulo: "Mangueira, bico e conexões",
    desc: "Sem cortes, ressecamento, obstruções ou folgas.",
    severidade: "maior" as const,
    norma: "ABNT NBR 12962",
  },
  {
    id: "validade",
    titulo: "Etiqueta de validade",
    desc: "Manutenção / inspeção técnica dentro do prazo.",
    severidade: "critica" as const,
    norma: "ABNT NBR 12962 / 12693",
  },
  {
    id: "limpeza",
    titulo: "Limpeza",
    desc: "Livre de sujeira, graxa ou resíduos.",
    severidade: "menor" as const,
    norma: "Boas práticas",
  },
] as const;

type ChecklistId = (typeof CHECKLIST)[number]["id"];
type Severidade = "critica" | "maior" | "menor";

const SEV_LABEL: Record<Severidade, string> = {
  critica: "Crítica",
  maior: "Maior",
  menor: "Menor",
};
const SEV_COLOR: Record<Severidade, string> = {
  critica: "border-red-500/60 bg-red-500/10 text-red-200",
  maior: "border-amber-500/60 bg-amber-500/10 text-amber-200",
  menor: "border-slate-500/60 bg-slate-500/10 text-slate-200",
};

/** 5W2H gerado para uma NC */
export type Plano5W2H = {
  what: string;
  why: string;
  where: string;
  who: string;
  when: string;
  how: string;
  howMuch: string;
  severidade: Severidade;
  norma: string;
};

/** Resultado consolidado da inspeção manual (devolvido ao parent) */
export type ResultadoInspecaoManual = {
  conforme: boolean;
  indisponivel: boolean; // qualquer NC crítica
  itens: Array<{
    id: ChecklistId;
    titulo: string;
    status: Exclude<ItemStatus, null>;
    severidade: Severidade;
    norma: string;
    descricao_nc?: string;
  }>;
  planos5w2h: Plano5W2H[];
  observacoes: string;
  responsavel_nome: string;
  responsavel_registro: string;
};

export function InspecaoManualDialog({
  extintor,
  open,
  onOpenChange,
  userId,
  userNome,
  onSaved,
  previewMode = false,
  onResultado,
}: {
  extintor: Extintor | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId?: string;
  userNome?: string;
  onSaved?: () => void;
  /** Quando true, NÃO grava no banco — só devolve o resultado via onResultado (usado no card preview). */
  previewMode?: boolean;
  onResultado?: (r: ResultadoInspecaoManual) => void;
}) {
  const qc = useQueryClient();

  const emptyChecklist = (): Record<ChecklistId, ItemStatus> =>
    CHECKLIST.reduce((acc, it) => {
      acc[it.id] = null;
      return acc;
    }, {} as Record<ChecklistId, ItemStatus>);

  const [itens, setItens] = useState<Record<ChecklistId, ItemStatus>>(emptyChecklist());
  const [descNc, setDescNc] = useState<Record<ChecklistId, string>>({} as any);
  const [observacoes, setObservacoes] = useState("");
  const [respNome, setRespNome] = useState(userNome ?? "");
  const [respRegistro, setRespRegistro] = useState("");

  useEffect(() => {
    setRespNome((prev) => prev || userNome || "");
  }, [userNome]);

  useEffect(() => {
    if (open) {
      setItens(emptyChecklist());
      setDescNc({} as any);
      setObservacoes("");
      setRespNome(userNome ?? "");
      setRespRegistro("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userNome]);

  // métricas em tempo real
  const ncIds = useMemo(
    () => CHECKLIST.filter((c) => itens[c.id] === "nc").map((c) => c.id),
    [itens],
  );
  const temCriticaNC = useMemo(
    () => CHECKLIST.some((c) => itens[c.id] === "nc" && c.severidade === "critica"),
    [itens],
  );
  const todosRespondidos = CHECKLIST.every((c) => itens[c.id] !== null);
  const conforme = ncIds.length === 0 && todosRespondidos;

  function gerar5w2h(): Plano5W2H[] {
    const hoje = new Date();
    return ncIds.map((id) => {
      const item = CHECKLIST.find((c) => c.id === id)!;
      const prazoDias = item.severidade === "critica" ? 1 : item.severidade === "maior" ? 7 : 30;
      const prazo = new Date(hoje);
      prazo.setDate(prazo.getDate() + prazoDias);
      return {
        what: `Corrigir: ${item.titulo}`,
        why: `Não conformidade ${item.severidade.toUpperCase()} — risco de indisponibilidade do equipamento de combate a incêndio (${item.norma}).`,
        where: extintor?.localizacao || "Local do extintor",
        who: item.severidade === "critica" ? "SESMT + Empresa certificada (recarga/manutenção)" : "Equipe SESMT",
        when: `Em até ${prazoDias} dia(s) — até ${prazo.toLocaleDateString("pt-BR")}`,
        how:
          item.severidade === "critica"
            ? "Retirar de operação, bloquear no sistema e enviar à empresa certificada para avaliação técnica."
            : "Atuação corretiva direta + verificação visual após correção.",
        howMuch: item.severidade === "critica" ? "Custo de recarga/teste hidrostático" : "Sem custo direto",
        severidade: item.severidade,
        norma: item.norma,
      };
    });
  }

  function buildResultado(): ResultadoInspecaoManual {
    const planos = gerar5w2h();
    return {
      conforme,
      indisponivel: temCriticaNC,
      itens: CHECKLIST.map((c) => ({
        id: c.id,
        titulo: c.titulo,
        status: (itens[c.id] ?? "na") as Exclude<ItemStatus, null>,
        severidade: c.severidade,
        norma: c.norma,
        descricao_nc: itens[c.id] === "nc" ? descNc[c.id] : undefined,
      })),
      planos5w2h: planos,
      observacoes,
      responsavel_nome: respNome,
      responsavel_registro: respRegistro,
    };
  }

  const salvar = useMutation({
    mutationFn: async () => {
      const nome = respNome.trim();
      if (!nome) throw new Error("Informe o responsável pela inspeção");
      if (!todosRespondidos) throw new Error("Responda todos os 8 itens do checklist");
      for (const id of ncIds) {
        if (!descNc[id]?.trim()) {
          const t = CHECKLIST.find((c) => c.id === id)!.titulo;
          throw new Error(`Descreva a NC do item: ${t}`);
        }
      }
      const resultado = buildResultado();

      if (previewMode) {
        // não toca no banco — devolve para o parent
        onResultado?.(resultado);
        return resultado;
      }

      if (!extintor) throw new Error("Extintor não selecionado");
      const hoje = new Date().toISOString().slice(0, 10);
      const ncResumo =
        ncIds.length === 0
          ? null
          : ncIds
              .map((id) => {
                const c = CHECKLIST.find((x) => x.id === id)!;
                return `• [${SEV_LABEL[c.severidade]}] ${c.titulo}: ${descNc[id] ?? ""}`;
              })
              .join("\n");

      const { error } = await supabase.from("extintor_inspecoes").insert({
        extintor_id: extintor.id,
        data_inspecao: hoje,
        conforme,
        nao_conformidade: ncResumo,
        observacoes: observacoes || null,
        responsavel_nome: nome,
        responsavel_registro: respRegistro || null,
        created_by: userId ?? null,
      });
      if (error) throw error;
      onResultado?.(resultado);
      return resultado;
    },
    onSuccess: (resultado) => {
      if (resultado?.indisponivel) {
        toast.error("Extintor marcado como INDISPONÍVEL PARA USO", {
          description: `${resultado.planos5w2h.length} plano(s) 5W2H gerado(s).`,
        });
      } else if (resultado?.conforme) {
        toast.success("Inspeção registrada — extintor conforme");
      } else {
        toast.warning("Inspeção registrada com NC não-críticas", {
          description: `${resultado?.planos5w2h.length ?? 0} plano(s) 5W2H gerado(s).`,
        });
      }
      if (!previewMode) {
        qc.invalidateQueries({ queryKey: ["extintor-inspecoes"] });
        qc.invalidateQueries({ queryKey: ["hist-manual", extintor?.id] });
      }
      onOpenChange(false);
      onSaved?.();
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar inspeção"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardEdit className="h-5 w-5 text-emerald-500" />
            Inspeção mensal — Checklist NR-23
          </DialogTitle>
          <DialogDescription>
            Confira cada item. Itens críticos em NC bloqueiam o extintor automaticamente.
          </DialogDescription>
          {extintor && (
            <div className="text-xs text-muted-foreground mt-1">
              Extintor: <strong className="text-red-500 font-mono">{extintor.numero}</strong>
              {extintor.tipo_agente && <> · {extintor.tipo_agente}</>}
              {extintor.localizacao && <> · {extintor.localizacao}</>}
            </div>
          )}
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-[11px] text-muted-foreground flex items-start gap-1.5">
            <Info className="h-3.5 w-3.5 mt-0.5 text-cyan-400 shrink-0" />
            Marque cada item como <strong>OK</strong>, <strong>NC</strong> ou <strong>N/A</strong>. Itens em NC exigem descrição.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Responsável *</Label>
              <Input
                value={respNome}
                onChange={(e) => setRespNome(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Registro / matrícula</Label>
              <Input
                placeholder="Ex.: TST-2210"
                value={respRegistro}
                onChange={(e) => setRespRegistro(e.target.value)}
              />
            </div>
          </div>

          {/* Checklist */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Checklist mensal (8 itens)
              </div>
              <div className="text-[11px] text-muted-foreground">
                {CHECKLIST.filter((c) => itens[c.id] !== null).length}/8 respondidos
                {ncIds.length > 0 && (
                  <> · <span className="text-red-400 font-semibold">{ncIds.length} NC</span></>
                )}
              </div>
            </div>

            {CHECKLIST.map((item) => {
              const status = itens[item.id];
              return (
                <div
                  key={item.id}
                  className={`rounded-md border px-3 py-2 transition ${
                    status === "nc"
                      ? "border-red-500/60 bg-red-500/5"
                      : status === "ok"
                        ? "border-emerald-500/40 bg-emerald-500/5"
                        : status === "na"
                          ? "border-slate-700 bg-muted/20"
                          : "border-slate-700 bg-muted/10"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">{item.titulo}</span>
                        <Badge variant="outline" className={`text-[9px] ${SEV_COLOR[item.severidade]}`}>
                          {SEV_LABEL[item.severidade]}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">· {item.norma}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{item.desc}</div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {(["ok", "nc", "na"] as const).map((s) => {
                        const sel = status === s;
                        const cls =
                          s === "ok"
                            ? sel
                              ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
                              : "border-slate-700 text-slate-400 hover:border-emerald-500/50"
                            : s === "nc"
                              ? sel
                                ? "border-red-500 bg-red-500/20 text-red-200"
                                : "border-slate-700 text-slate-400 hover:border-red-500/50"
                              : sel
                                ? "border-slate-400 bg-slate-500/20 text-slate-100"
                                : "border-slate-700 text-slate-400 hover:border-slate-400";
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setItens((p) => ({ ...p, [item.id]: s }))}
                            className={`px-2.5 py-1 rounded border text-[10px] font-bold uppercase tracking-wider transition ${cls}`}
                          >
                            {s === "ok" ? "OK" : s === "nc" ? "NC" : "N/A"}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {status === "nc" && (
                    <Textarea
                      rows={2}
                      placeholder="Descreva a NC encontrada *"
                      value={descNc[item.id] ?? ""}
                      onChange={(e) => setDescNc((p) => ({ ...p, [item.id]: e.target.value }))}
                      className="mt-2 text-sm"
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Alerta de bloqueio */}
          {temCriticaNC && (
            <div className="rounded-md border-2 border-red-500 bg-red-500/15 px-3 py-2.5 flex items-start gap-2 animate-pulse">
              <Ban className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
              <div className="text-xs text-red-200 leading-relaxed">
                <div className="font-bold uppercase tracking-wider">Extintor será marcado como INDISPONÍVEL PARA USO</div>
                NC crítica detectada — o equipamento será bloqueado e {ncIds.length} plano(s) 5W2H serão gerados automaticamente.
              </div>
            </div>
          )}
          {!temCriticaNC && ncIds.length > 0 && (
            <div className="rounded-md border border-amber-500/60 bg-amber-500/10 px-3 py-2 flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-300 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-200">
                {ncIds.length} NC não-crítica(s) — extintor permanece em uso, mas plano(s) 5W2H serão gerados.
              </div>
            </div>
          )}

          <div>
            <Label className="text-xs">Observações</Label>
            <Textarea
              rows={2}
              placeholder="Notas adicionais (opcional)"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={salvar.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={() => salvar.mutate()}
            disabled={salvar.isPending || !todosRespondidos}
            className={`gap-1.5 ${
              temCriticaNC
                ? "bg-red-600 hover:bg-red-500 text-white"
                : ncIds.length > 0
                  ? "bg-amber-600 hover:bg-amber-500 text-white"
                  : ""
            }`}
          >
            <ClipboardEdit className="h-4 w-4" />
            {salvar.isPending
              ? "Salvando…"
              : temCriticaNC
                ? "Registrar + bloquear extintor"
                : "Registrar inspeção"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}