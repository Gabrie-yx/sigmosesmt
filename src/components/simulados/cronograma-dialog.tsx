import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SignaturePadDialog } from "@/components/signature-pad-dialog";
import { PDFPreviewDialog } from "@/components/pdf-preview-dialog";
import { Plus, Trash2, ArrowUp, ArrowDown, FileText, Save, PenLine, X, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { buildSimuladoCronogramaPdf, MESES_ABREV, type MesMarca } from "@/lib/simulado-cronograma-pdf";
const EMPRESA_NOME = "DMN ESTALEIRO";
import { uuid as newId } from "@/lib/uuid";

/* eslint-disable @typescript-eslint/no-explicit-any */
const sb: any = supabase;

const CICLO: MesMarca[] = ["", "P", "R", "T"];
const MARCA_CLS: Record<string, string> = {
  "": "bg-transparent text-muted-foreground",
  P: "bg-slate-400/25 text-slate-100 border-slate-300/50",
  R: "bg-emerald-600 text-white border-emerald-400",
  T: "bg-amber-500 text-slate-900 border-amber-300",
};
const MARCA_TXT: Record<string, string> = { "": "·", P: "○", R: "●", T: "⊗" };

type Item = {
  id: string;
  cenario_id?: string | null;
  descricao: string;
  local: string;
  acao_preparatoria: string;
  responsavel: string;
  norma_ref?: string | null;
  meses: MesMarca[];
};

const ACAO_PADRAO = "Preparar o cenário para ação da brigada, kit primeiros socorros, extintores e etc.";
const RESP_PADRAO = "Técnico de segurança do trabalho, Brigadistas e Encarregado";

function vazio12(): MesMarca[] {
  return ["", "", "", "", "", "", "", "", "", "", "", ""];
}

export function CronogramaSimuladosDialog({
  open,
  onClose,
  cronogramaId,
  anoInicial,
}: {
  open: boolean;
  onClose: () => void;
  cronogramaId?: string | null;
  anoInicial?: number;
}) {
  const qc = useQueryClient();
  const [ano, setAno] = useState(anoInicial ?? new Date().getFullYear());
  const [revisao, setRevisao] = useState("00");
  const [dataDoc, setDataDoc] = useState(new Date().toISOString().slice(0, 10));
  const [itens, setItens] = useState<Item[]>([]);
  const [elabNome, setElabNome] = useState("");
  const [elabAss, setElabAss] = useState<string | null>(null);
  const [aprovNome, setAprovNome] = useState("");
  const [aprovAss, setAprovAss] = useState<string | null>(null);
  const [assinandoAlvo, setAssinandoAlvo] = useState<null | "elab" | "aprov">(null);
  const [pdf, setPdf] = useState<any>(null);
  const [novoCenario, setNovoCenario] = useState("");

  const { data: cenarios = [] } = useQuery({
    queryKey: ["simulado-cenarios"],
    enabled: open,
    queryFn: async () => (await sb.from("simulado_cenarios").select("*").eq("ativo", true).order("ordem")).data ?? [],
  });

  const { data: existente, isLoading } = useQuery({
    queryKey: ["simulado-cronograma", cronogramaId],
    enabled: open && !!cronogramaId,
    queryFn: async () => {
      const { data: cab } = await sb.from("simulado_cronograma").select("*").eq("id", cronogramaId).maybeSingle();
      const { data: its } = await sb
        .from("simulado_cronograma_itens").select("*").eq("cronograma_id", cronogramaId).order("ordem");
      return { cab, itens: its ?? [] };
    },
  });

  // Carrega cronograma existente ou pré-carrega os cenários padrão do FOR-SEG 12.
  useEffect(() => {
    if (!open) return;
    if (cronogramaId && existente?.cab) {
      const c = existente.cab;
      setAno(c.ano);
      setRevisao(c.revisao ?? "00");
      setDataDoc((c.data_documento ?? new Date().toISOString()).slice(0, 10));
      setElabNome(c.elaborado_por ?? "");
      setElabAss(c.elaborado_assinatura ?? null);
      setAprovNome(c.aprovado_por ?? "");
      setAprovAss(c.aprovado_assinatura ?? null);
      setItens(
        (existente.itens ?? []).map((i: any) => ({
          id: i.id,
          cenario_id: i.cenario_id,
          descricao: i.descricao ?? "",
          local: i.local ?? "",
          acao_preparatoria: i.acao_preparatoria ?? "",
          responsavel: i.responsavel ?? "",
          norma_ref: i.norma_ref,
          meses: Array.isArray(i.meses) ? (i.meses as MesMarca[]) : vazio12(),
        })),
      );
      return;
    }
    if (!cronogramaId && cenarios.length && itens.length === 0) {
      setItens(
        cenarios.filter((c: any) => c.padrao).map((c: any) => ({
          id: newId(),
          cenario_id: c.id,
          descricao: c.descricao,
          local: c.local ?? "Produção",
          acao_preparatoria: c.acao_preparatoria ?? ACAO_PADRAO,
          responsavel: c.responsavel ?? RESP_PADRAO,
          norma_ref: c.norma_ref,
          meses: vazio12(),
        })),
      );
    }
  }, [open, cronogramaId, existente, cenarios]); // eslint-disable-line react-hooks/exhaustive-deps

  function upd(id: string, patch: Partial<Item>) {
    setItens((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }
  function ciclarMes(id: string, mesIdx: number) {
    setItens((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        const meses = [...i.meses];
        const atual = meses[mesIdx] ?? "";
        meses[mesIdx] = CICLO[(CICLO.indexOf(atual) + 1) % CICLO.length];
        return { ...i, meses };
      }),
    );
  }
  function mover(idx: number, dir: -1 | 1) {
    setItens((prev) => {
      const arr = [...prev];
      const alvo = idx + dir;
      if (alvo < 0 || alvo >= arr.length) return prev;
      [arr[idx], arr[alvo]] = [arr[alvo], arr[idx]];
      return arr;
    });
  }
  function addCenarioCatalogo(cenarioId: string) {
    const c = cenarios.find((x: any) => x.id === cenarioId);
    if (!c) return;
    setItens((prev) => [...prev, {
      id: newId(),
      cenario_id: c.id,
      descricao: c.descricao,
      local: c.local ?? "Produção",
      acao_preparatoria: c.acao_preparatoria ?? ACAO_PADRAO,
      responsavel: c.responsavel ?? RESP_PADRAO,
      norma_ref: c.norma_ref,
      meses: vazio12(),
    }]);
  }
  function addLinhaLivre() {
    setItens((prev) => [...prev, {
      id: newId(),
      descricao: "",
      local: "Produção",
      acao_preparatoria: ACAO_PADRAO,
      responsavel: RESP_PADRAO,
      meses: vazio12(),
    }]);
  }

  const criarCenario = useMutation({
    mutationFn: async (descricao: string) => {
      const { data, error } = await sb.from("simulado_cenarios").insert({
        descricao,
        local: "Produção",
        acao_preparatoria: ACAO_PADRAO,
        responsavel: RESP_PADRAO,
        padrao: false,
        ordem: 99,
      }).select("*").single();
      if (error) throw error;
      return data;
    },
    onSuccess: (c: any) => {
      qc.invalidateQueries({ queryKey: ["simulado-cenarios"] });
      setItens((prev) => [...prev, {
        id: newId(),
        cenario_id: c.id,
        descricao: c.descricao,
        local: c.local ?? "Produção",
        acao_preparatoria: c.acao_preparatoria ?? ACAO_PADRAO,
        responsavel: c.responsavel ?? RESP_PADRAO,
        meses: vazio12(),
      }]);
      setNovoCenario("");
      toast.success("Cenário criado e adicionado ao cronograma.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao criar cenário"),
  });

  const salvar = useMutation({
    mutationFn: async () => {
      if (itens.some((i) => !i.descricao.trim())) throw new Error("Há simulado sem descrição.");
      const cab = {
        ano,
        revisao,
        data_documento: dataDoc,
        elaborado_por: elabNome || null,
        elaborado_assinatura: elabAss,
        aprovado_por: aprovNome || null,
        aprovado_assinatura: aprovAss,
        updated_at: new Date().toISOString(),
      };
      let id = cronogramaId;
      if (id) {
        const { error } = await sb.from("simulado_cronograma").update(cab).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await sb.from("simulado_cronograma").insert(cab).select("id").single();
        if (error) throw error;
        id = data.id;
      }
      await sb.from("simulado_cronograma_itens").delete().eq("cronograma_id", id);
      if (itens.length) {
        const { error } = await sb.from("simulado_cronograma_itens").insert(
          itens.map((i, idx) => ({
            cronograma_id: id,
            cenario_id: i.cenario_id ?? null,
            ordem: idx + 1,
            descricao: i.descricao,
            local: i.local || null,
            acao_preparatoria: i.acao_preparatoria || null,
            responsavel: i.responsavel || null,
            norma_ref: i.norma_ref ?? null,
            meses: i.meses,
          })),
        );
        if (error) throw error;
      }
      return id;
    },
    onSuccess: () => {
      toast.success("Cronograma salvo.");
      qc.invalidateQueries({ queryKey: ["simulado-cronogramas"] });
      qc.invalidateQueries({ queryKey: ["simulado-cronograma"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar"),
  });

  function gerarPdf() {
    if (!itens.length) { toast.error("Adicione ao menos um simulado."); return; }
    setPdf(buildSimuladoCronogramaPdf({
      empresa: EMPRESA_NOME,
      ano,
      revisao,
      dataDocumento: dataDoc,
      linhas: itens.map((i) => ({
        descricao: i.descricao,
        local: i.local,
        acao_preparatoria: i.acao_preparatoria,
        responsavel: i.responsavel,
        meses: i.meses,
      })),
      elaboradoPor: elabNome || null,
      elaboradoAssinatura: elabAss,
      aprovadoPor: aprovNome || null,
      aprovadoAssinatura: aprovAss,
    }));
  }

  const disponiveis = useMemo(
    () => cenarios.filter((c: any) => !itens.some((i) => i.cenario_id === c.id)),
    [cenarios, itens],
  );

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-[98vw] w-[98vw] h-[94vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              FOR-SEG 12 — Cronograma dos Simulados de Emergência
              <Badge variant="outline">{ano}</Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-auto space-y-4 pr-1">
            {/* 1. Identificação */}
            <section className="rounded-lg border p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">1 · Identificação</p>
              <div className="grid gap-3 sm:grid-cols-4">
                <div>
                  <Label className="text-xs">Ano</Label>
                  <Input type="number" value={ano} onChange={(e) => setAno(Number(e.target.value))} />
                </div>
                <div>
                  <Label className="text-xs">Revisão</Label>
                  <Input value={revisao} onChange={(e) => setRevisao(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Data do documento</Label>
                  <Input type="date" value={dataDoc} onChange={(e) => setDataDoc(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Empresa</Label>
                  <Input value={EMPRESA_NOME} disabled />
                </div>
              </div>
            </section>

            {/* 2. Grade */}
            <section className="rounded-lg border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">2 · Simulados e meses</p>
                <div className="flex flex-wrap items-center gap-2">
                  {disponiveis.length > 0 && (
                    <Select value="" onValueChange={addCenarioCatalogo}>
                      <SelectTrigger className="h-8 w-[240px] text-xs">
                        <SelectValue placeholder="+ Adicionar do catálogo" />
                      </SelectTrigger>
                      <SelectContent>
                        {disponiveis.map((c: any) => (
                          <SelectItem key={c.id} value={c.id} className="text-xs">{c.descricao}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button size="sm" variant="outline" onClick={addLinhaLivre}>
                    <Plus className="h-3.5 w-3.5 mr-1" />Linha livre
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-2 mb-3 rounded border border-dashed p-2">
                <div className="flex-1 min-w-[240px]">
                  <Label className="text-[11px]">Novo tipo de simulado (vai para o catálogo)</Label>
                  <Input
                    placeholder="Ex.: Simulado de resgate de afogado / IMV / animais peçonhentos"
                    value={novoCenario}
                    onChange={(e) => setNovoCenario(e.target.value)}
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!novoCenario.trim() || criarCenario.isPending}
                  onClick={() => criarCenario.mutate(novoCenario.trim())}
                >
                  {criarCenario.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
                  Criar e incluir
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-xs border-collapse">
                  <thead>
                    <tr className="bg-muted/60">
                      <th className="border p-1 w-10">ITEM</th>
                      <th className="border p-1 min-w-[180px]">DESCRIÇÃO DO SIMULADO</th>
                      <th className="border p-1 min-w-[110px]">LOCAL</th>
                      <th className="border p-1 min-w-[200px]">AÇÃO PREPARATÓRIA</th>
                      <th className="border p-1 min-w-[150px]">RESP.</th>
                      {MESES_ABREV.map((m) => <th key={m} className="border p-1 w-9">{m}</th>)}
                      <th className="border p-1 w-20" />
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((i, idx) => (
                      <tr key={i.id} className="align-top">
                        <td className="border p-1 text-center font-bold">{idx + 1}</td>
                        <td className="border p-1">
                          <Textarea rows={3} className="text-xs min-h-0" value={i.descricao}
                            onChange={(e) => upd(i.id, { descricao: e.target.value })} />
                        </td>
                        <td className="border p-1">
                          <Textarea rows={3} className="text-xs min-h-0" value={i.local}
                            onChange={(e) => upd(i.id, { local: e.target.value })} />
                        </td>
                        <td className="border p-1">
                          <Textarea rows={3} className="text-xs min-h-0" value={i.acao_preparatoria}
                            onChange={(e) => upd(i.id, { acao_preparatoria: e.target.value })} />
                        </td>
                        <td className="border p-1">
                          <Textarea rows={3} className="text-xs min-h-0" value={i.responsavel}
                            onChange={(e) => upd(i.id, { responsavel: e.target.value })} />
                        </td>
                        {MESES_ABREV.map((m, mi) => (
                          <td key={m} className="border p-0.5 text-center">
                            <button
                              type="button"
                              onClick={() => ciclarMes(i.id, mi)}
                              title="Clique para alternar: planejado → realizado → transferido"
                              className={`h-7 w-7 rounded border text-sm leading-none ${MARCA_CLS[i.meses[mi] ?? ""]}`}
                            >
                              {MARCA_TXT[i.meses[mi] ?? ""]}
                            </button>
                          </td>
                        ))}
                        <td className="border p-1">
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => mover(idx, -1)}>
                              <ArrowUp className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => mover(idx, 1)}>
                              <ArrowDown className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive"
                              onClick={() => setItens((prev) => prev.filter((x) => x.id !== i.id))}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {itens.length === 0 && (
                      <tr><td colSpan={18} className="border p-6 text-center text-muted-foreground">
                        {isLoading ? "Carregando..." : "Nenhum simulado no cronograma."}
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Legenda: <b>○</b> planejado · <b className="text-emerald-500">●</b> realizado · <b className="text-amber-500">⊗</b> transferido
              </p>
            </section>

            {/* 3. Assinaturas */}
            <section className="rounded-lg border p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">3 · Assinaturas</p>
              <div className="grid gap-4 sm:grid-cols-2">
                {([
                  { key: "elab" as const, label: "Elaborador (TST)", nome: elabNome, setNome: setElabNome, ass: elabAss, setAss: setElabAss },
                  { key: "aprov" as const, label: "Aprovado gerente", nome: aprovNome, setNome: setAprovNome, ass: aprovAss, setAss: setAprovAss },
                ]).map((s) => (
                  <div key={s.key} className="rounded border p-2">
                    <Label className="text-xs">{s.label}</Label>
                    <Input className="mt-1" placeholder="Nome" value={s.nome} onChange={(e) => s.setNome(e.target.value)} />
                    <div className="mt-2 flex items-center gap-2">
                      {s.ass ? (
                        <>
                          <img src={s.ass} alt={s.label} className="h-10 rounded border bg-white object-contain px-1" />
                          <Button size="sm" variant="ghost" onClick={() => s.setAss(null)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setAssinandoAlvo(s.key)}>
                          <PenLine className="h-3.5 w-3.5 mr-1" />Assinar
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <DialogFooter className="flex-wrap gap-2">
            <Button variant="ghost" onClick={onClose}>Fechar</Button>
            <Button variant="outline" onClick={gerarPdf}><FileText className="h-4 w-4 mr-1" />Gerar PDF</Button>
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
              {salvar.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Salvar cronograma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SignaturePadDialog
        open={!!assinandoAlvo}
        onClose={() => setAssinandoAlvo(null)}
        onConfirm={(r) => {
          if (assinandoAlvo === "elab") setElabAss(r.dataUrl);
          if (assinandoAlvo === "aprov") setAprovAss(r.dataUrl);
          setAssinandoAlvo(null);
        }}
        title="Assinatura do cronograma"
      />

      <PDFPreviewDialog
        open={!!pdf}
        onClose={() => setPdf(null)}
        doc={pdf}
        fileName={`FOR-SEG-12_Cronograma_Simulados_${ano}.pdf`}
        title="Cronograma dos Simulados de Emergência"
      />
    </>
  );
}
