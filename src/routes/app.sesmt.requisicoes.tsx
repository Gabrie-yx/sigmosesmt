import { createFileRoute, useLocation } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useMinhasRcsDecididas } from "@/hooks/use-minhas-rcs-decididas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import {
  ShoppingCart, Plus, FileDown, Printer, Check, X as XIcon, Trash2, Eye, Filter, Pencil, Link2, Pill,
} from "lucide-react";
import { toast } from "sonner";
import type jsPDF from "jspdf";

// Lazy loader: jspdf + jspdf-autotable só baixam quando alguém gera/imprime PDF.
async function loadPdfLibs() {
  const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  return { JsPDF, autoTable };
}
import dmnLogo from "@/assets/dmn-logo.png";
import { EstoqueLookupSheet, type PickedItem } from "@/components/estoque-lookup-sheet";
import { RequisicaoMedicamentosDialog } from "@/components/sesmt/requisicao-medicamentos-dialog";
import { PDFPreviewDialog } from "@/components/pdf-preview-dialog";
import { SignatureGallery } from "@/components/signature-gallery";
import { Wizard, type WizardStep } from "@/components/wizard";
import { useDraftAutosave } from "@/hooks/use-draft-autosave";
import { deleteDraft, loadDraft } from "@/lib/draft-store";
import { printPdf } from "@/lib/pdf-print";
import { gerarPdfRequisicaoDoc, rcPdfFileName, type RcPdfReq, type RcPdfCotacao } from "@/lib/requisicao-compra-pdf";
import { UrgenciaBadge, UrgenciaSelect, type Urgencia } from "@/components/compras/urgencia";

export const Route = createFileRoute("/app/sesmt/requisicoes")({
  component: RequisicoesPage,
});

type Status = "PENDENTE" | "EM_COTACAO" | "COTADA" | "APROVADA" | "INDEFERIDA" | "EM_RECEBIMENTO" | "CONCLUIDA" | "DEVOLVIDA";
type Classe = "MATERIAL" | "SERVICO" | "MEDICAMENTOS";

type Item = {
  item_numero: number;
  descricao: string;
  quantidade: string;
  unidade: string;
  observacao: string;
};

type PrintMode = "download" | "print" | "preview";

type Req = {
  id: string;
  numero: string;
  titulo: string | null;
  data_requisicao: string;
  classificacao: Classe;
  solicitante: string;
  setor: string | null;
  fornecedor: string | null;
  obra_construcao: string | null;
  obra_manutencao: string | null;
  codigo_formulario: string | null;
  revisao: string | null;
  data_revisao: string | null;
  pagina: string | null;
  status: Status;
  motivo_indeferimento: string | null;
  observacoes: string | null;
  approved_at: string | null;
  created_by: string | null;
  created_at: string;
  signature_solicitante: string | null;
  signature_solicitante_height: number | null;
  responsavel_tst?: string | null;
  responsavel_aprovador?: string | null;
  status_token?: string | null;
  cotacao_at?: string | null;
  cotador_nome?: string | null;
  cotacao_fornecedor?: string | null;
  cotacao_valor?: number | null;
  dispensa_cotacao?: boolean | null;
  dispensa_motivo?: string | null;
  dispensa_justificativa?: string | null;
  devolvida_em?: string | null;
  devolvida_por_nome?: string | null;
  devolucao_mensagem?: string | null;
  pc_numero?: string | null;
  pc_fornecedor?: string | null;
  pc_valor?: number | null;
  nf_numero?: string | null;
  recebido_em?: string | null;
  urgencia?: Urgencia | null;
  sla_deadline?: string | null;
};

const STATUS_BADGE: Record<Status, string> = {
  PENDENTE: "bg-amber-100 text-amber-800 border-amber-300",
  EM_COTACAO: "bg-violet-100 text-violet-800 border-violet-300",
  COTADA: "bg-blue-100 text-blue-800 border-blue-300",
  APROVADA: "bg-emerald-100 text-emerald-800 border-emerald-300",
  INDEFERIDA: "bg-rose-100 text-rose-800 border-rose-300",
  EM_RECEBIMENTO: "bg-cyan-100 text-cyan-800 border-cyan-300",
  CONCLUIDA: "bg-slate-200 text-slate-800 border-slate-400",
  DEVOLVIDA: "bg-orange-100 text-orange-800 border-orange-300",
};

const STATUS_LABEL: Record<Status, string> = {
  PENDENTE: "Em andamento",
  EM_COTACAO: "Em cotação",
  COTADA: "Cotada",
  APROVADA: "Deferida",
  INDEFERIDA: "Indeferida",
  EM_RECEBIMENTO: "PC emitido — aguardando NF",
  CONCLUIDA: "Concluída",
  DEVOLVIDA: "Devolvida — precisa ajuste",
};

function fmtBR(d?: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("T")[0].split("-");
  return `${day}/${m}/${y}`;
}

function emptyItems(): Item[] {
  return Array.from({ length: 10 }, (_, i) => ({
    item_numero: i + 1, descricao: "", quantidade: "", unidade: "", observacao: "",
  }));
}

async function logoDataUrl(): Promise<string | null> {
  try {
    const r = await fetch(dmnLogo);
    const b = await r.blob();
    return await new Promise((res) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result as string);
      fr.onerror = () => res(null);
      fr.readAsDataURL(b);
    });
  } catch { return null; }
}

async function gerarPdfRequisicao(req: Req, itens: Item[], mode: PrintMode = "download", cotacoes: RcPdfCotacao[] = []) {
  // Sprint 2: PDF único — usa o gerador compartilhado (mesmo layout FOR-COMP-03).
  const doc = await gerarPdfRequisicaoDoc(req as unknown as RcPdfReq, itens, cotacoes);
  const fileName = rcPdfFileName(req);

  if (mode === "print") {
    await printPdf(doc.output("arraybuffer") as ArrayBuffer, fileName);
    return;
  }

  if (mode === "preview") {
    const url = URL.createObjectURL(doc.output("blob"));
    const win = window.open(url, "_blank");
    if (!win) doc.save(fileName);
    window.setTimeout(() => URL.revokeObjectURL(url), 120000);
    return;
  }

  doc.save(fileName);
}

async function gerarRelatorio(reqs: Req[], periodo: string) {
  const { JsPDF, autoTable } = await loadPdfLibs();
  const doc = new JsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const W = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica","bold"); doc.setFontSize(14);
  doc.text("RELATÓRIO DE REQUISIÇÕES DE COMPRA", W/2, 14, { align: "center" });
  doc.setFont("helvetica","normal"); doc.setFontSize(10);
  doc.text(`Período: ${periodo}`, W/2, 20, { align: "center" });
  doc.text(`Emitido em: ${new Date().toLocaleString("pt-BR")}`, W/2, 25, { align: "center" });

  const tot = reqs.length;
  const def = reqs.filter(r => r.status === "APROVADA").length;
  const ind = reqs.filter(r => r.status === "INDEFERIDA").length;
  const pen = reqs.filter(r => r.status === "PENDENTE").length;
  doc.setFontSize(9);
  doc.text(`Total: ${tot}   |   Deferidas: ${def}   |   Em andamento: ${pen}   |   Indeferidas: ${ind}`, 14, 32);

  autoTable(doc, {
    startY: 36,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [180,0,0], textColor: 255, fontStyle: "bold" },
    head: [["Nº", "Data", "Solicitante", "Setor", "Fornecedor", "Classif.", "Status", "Obs."]],
    body: reqs.map(r => [
      r.numero,
      fmtBR(r.data_requisicao),
      r.solicitante,
      r.setor || "—",
      r.fornecedor || "—",
      r.classificacao === "MATERIAL" ? "Material" : "Serviço",
      STATUS_LABEL[r.status],
      r.status === "INDEFERIDA" ? (r.motivo_indeferimento || "") : (r.observacoes || ""),
    ]),
  });

  doc.save(`relatorio-requisicoes-${Date.now()}.pdf`);
}

function RequisicoesPage() {
  const { user, isEditor } = useAuth();
  const qc = useQueryClient();
  const [openNew, setOpenNew] = useState(false);
  const location = useLocation();
  const { count: novasAtualizacoes, markAllSeen } = useMinhasRcsDecididas();

  // Marca como visto ao entrar na página (badge do menu some)
  useEffect(() => {
    if (novasAtualizacoes > 0) markAllSeen();
  }, [novasAtualizacoes, markAllSeen]);

  // Se houver rascunho na URL (?draft=true), abre o modal automaticamente
  useEffect(() => {
    if ((location.search as any).draft === "true") {
      setOpenNew(true);
      // Limpa a URL para não reabrir ao navegar de volta
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [(location.search as any).draft]);
  const [tab, setTab] = useState<"todas" | Status>("todas");

  // Aceita ?tab=COTADA vindo do badge do header
  useEffect(() => {
    const t = (location.search as any).tab;
    if (t && ["PENDENTE", "EM_COTACAO", "COTADA", "APROVADA", "INDEFERIDA", "todas"].includes(t)) {
      setTab(t);
    }
  }, [(location.search as any).tab]);
  const [filtroPeriodo, setFiltroPeriodo] = useState<"all" | "week" | "month" | "year">("all");
  const [filtroSolic, setFiltroSolic] = useState("");

  const { data: reqs = [] } = useQuery({
    queryKey: ["purchase-reqs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_requisitions")
        .select("*")
        .order("data_requisicao", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Req[];
    },
  });

  const filtered = useMemo(() => {
    let arr = reqs;
    if (tab !== "todas") arr = arr.filter(r => r.status === tab);
    if (filtroSolic.trim()) {
      const s = filtroSolic.toLowerCase();
      arr = arr.filter(r => r.solicitante?.toLowerCase().includes(s));
    }
    if (filtroPeriodo !== "all") {
      const now = new Date();
      const cutoff = new Date();
      if (filtroPeriodo === "week") cutoff.setDate(now.getDate() - 7);
      if (filtroPeriodo === "month") cutoff.setMonth(now.getMonth() - 1);
      if (filtroPeriodo === "year") cutoff.setFullYear(now.getFullYear() - 1);
      arr = arr.filter(r => new Date(r.data_requisicao) >= cutoff);
    }
    return arr;
  }, [reqs, tab, filtroPeriodo, filtroSolic]);

  const stats = useMemo(() => ({
    total: reqs.length,
    pendentes: reqs.filter(r => r.status === "PENDENTE").length,
    aprovadas: reqs.filter(r => r.status === "APROVADA").length,
    indeferidas: reqs.filter(r => r.status === "INDEFERIDA").length,
  }), [reqs]);

  const updateStatus = useMutation({
    mutationFn: async (p: { id: string; status: Status; motivo?: string }) => {
      // Sprint 1: usa RPC decidir_rc — só Supervisor Geral passa; bypass eliminado.
      const { error } = await supabase.rpc("decidir_rc" as any, {
        _rc_id: p.id,
        _decisao: p.status,
        _motivo: p.status === "INDEFERIDA" ? (p.motivo || "") : null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-reqs"] });
      toast.success("Status atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delReq = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("purchase_requisitions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-reqs"] });
      toast.success("Excluída");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Preview in-app do PDF (com opção de assinar direto na visualização).
  const [previewState, setPreviewState] = useState<{
    doc: jsPDF;
    req: Req;
    itens: Item[];
  } | null>(null);

  const updateSolicitanteSig = useMutation({
    mutationFn: async (p: { id: string; signature: string | null }) => {
      const heightMm = p.signature ? 20 : null;
      const { error } = await supabase
        .from("purchase_requisitions")
        .update({
          signature_solicitante: p.signature,
          signature_solicitante_height: heightMm,
        })
        .eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["purchase-reqs"] });
      toast.success("Assinatura atualizada");
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao salvar assinatura"),
  });

  async function emitirPdf(r: Req, mode: PrintMode = "download") {
    const { data } = await supabase
      .from("purchase_requisition_items")
      .select("*")
      .eq("requisition_id", r.id)
      .order("item_numero");
    const savedItems = (data ?? []).map((f: any) => ({
      item_numero: f.item_numero,
      descricao: f.descricao ?? "",
      quantidade: f.quantidade != null ? String(f.quantidade) : "",
      unidade: f.unidade ?? "",
      observacao: f.observacao ?? "",
    }));
    const minimumRows = emptyItems();
    const itens = savedItems.length >= minimumRows.length
      ? savedItems
      : minimumRows.map((d) => savedItems.find((x) => x.item_numero === d.item_numero) ?? d);
    if (mode === "preview") {
      const doc = await gerarPdfRequisicaoDoc(r as unknown as RcPdfReq, itens);
      setPreviewState({ doc, req: r, itens });
      return;
    }
    await gerarPdfRequisicao(r, itens, mode);
  }

  async function regeneratePreview(nextReq: Req) {
    if (!previewState) return;
    const doc = await gerarPdfRequisicaoDoc(nextReq as unknown as RcPdfReq, previewState.itens);
    setPreviewState({ doc, req: nextReq, itens: previewState.itens });
  }

  function periodoLabel() {
    if (filtroPeriodo === "all") return "Todos";
    if (filtroPeriodo === "week") return "Última semana";
    if (filtroPeriodo === "month") return "Último mês";
    return "Último ano";
  }

  // Agrupa as RCs filtradas em Mês → Dia → itens.
  // Ordena tudo do mais recente pro mais antigo (data_requisicao desc).
  const grupos = useMemo(() => {
    const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
    const byMes = new Map<string, { label: string; ord: number; dias: Map<string, { label: string; ord: number; itens: Req[] }> }>();
    for (const r of filtered) {
      const [yStr, mStr, dStr] = (r.data_requisicao || "").split("T")[0].split("-");
      const y = Number(yStr), m = Number(mStr), d = Number(dStr);
      if (!y || !m || !d) continue;
      const mesKey = `${y}-${String(m).padStart(2,"0")}`;
      const mesLabel = `${MESES[m-1]} de ${y}`;
      const mesOrd = y * 100 + m;
      let mes = byMes.get(mesKey);
      if (!mes) { mes = { label: mesLabel, ord: mesOrd, dias: new Map() }; byMes.set(mesKey, mes); }
      const diaKey = `${mesKey}-${String(d).padStart(2,"0")}`;
      const diaLabel = `${String(d).padStart(2,"0")}/${String(m).padStart(2,"0")}/${y}`;
      const diaOrd = mesOrd * 100 + d;
      let dia = mes.dias.get(diaKey);
      if (!dia) { dia = { label: diaLabel, ord: diaOrd, itens: [] }; mes.dias.set(diaKey, dia); }
      dia.itens.push(r);
    }
    return Array.from(byMes.values())
      .sort((a, b) => b.ord - a.ord)
      .map((mes) => ({
        ...mes,
        dias: Array.from(mes.dias.values()).sort((a, b) => b.ord - a.ord),
        total: Array.from(mes.dias.values()).reduce((n, d) => n + d.itens.length, 0),
      }));
  }, [filtered]);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-red-700" /> Requisições de Compra
          </h1>
          <p className="text-sm text-slate-600">Materiais e serviços — FOR-COMP 03</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => gerarRelatorio(filtered, periodoLabel())}>
            <FileDown className="h-4 w-4 mr-2" /> Relatório PDF
          </Button>
          <EstoqueLookupSheet />
          <RequisicaoMedicamentosDialog defaultSolicitante={user?.email ?? ""} />
          {isEditor && (
            <Dialog open={openNew} onOpenChange={setOpenNew}>
              <DialogTrigger asChild>
                <Button className="bg-red-700 hover:bg-red-800">
                  <Plus className="h-4 w-4 mr-2" /> Nova Requisição
                </Button>
              </DialogTrigger>
              <ReqFormDialog onClose={() => setOpenNew(false)} userId={user?.id} />
            </Dialog>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total" value={stats.total} cls="text-slate-800" />
        <StatCard label="Em andamento" value={stats.pendentes} cls="text-amber-700" />
        <StatCard label="Deferidas" value={stats.aprovadas} cls="text-emerald-700" />
        <StatCard label="Indeferidas" value={stats.indeferidas} cls="text-rose-700" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <Select value={filtroPeriodo} onValueChange={(v: any) => setFiltroPeriodo(v)}>
              <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo período</SelectItem>
                <SelectItem value="week">Última semana</SelectItem>
                <SelectItem value="month">Último mês</SelectItem>
                <SelectItem value="year">Último ano</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Filtrar por solicitante"
              value={filtroSolic}
              onChange={(e) => setFiltroSolic(e.target.value)}
              className="w-[240px] h-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v: any) => setTab(v)}>
            <TabsList>
              <TabsTrigger value="todas">Todas</TabsTrigger>
              <TabsTrigger value="PENDENTE">Em andamento</TabsTrigger>
              <TabsTrigger value="COTADA">Cotadas</TabsTrigger>
              <TabsTrigger value="APROVADA">Deferidas</TabsTrigger>
              <TabsTrigger value="INDEFERIDA">Indeferidas</TabsTrigger>
            </TabsList>
            <TabsContent value={tab} className="mt-4">
              {filtered.length === 0 ? (
                <div className="text-center text-slate-500 py-12 text-sm">Nenhuma requisição encontrada.</div>
              ) : (() => {
                const renderLinha = (r: Req) => (
                    <div
                      key={r.id}
                      className={`border rounded-lg p-3 bg-card hover:bg-muted/40 transition flex flex-wrap items-center gap-3 ${
                        r.status === "PENDENTE" ? "animate-pulse-amber border-amber-300/70" : ""
                      }`}
                    >
                      <div className="flex-1 min-w-[220px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 dark:text-white">Nº {r.numero}</span>
                          {r.titulo && (
                            <span className="font-semibold text-rose-700 dark:text-rose-200 ml-1">
                              — {r.titulo}
                            </span>
                          )}
                          <Badge variant="outline" className={STATUS_BADGE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                          <UrgenciaBadge urgencia={r.urgencia ?? "NORMAL"} slaDeadline={r.sla_deadline} status={r.status} />
                          <Badge
                            variant="outline"
                            className={
                              r.classificacao === "MEDICAMENTOS"
                                ? "text-[10px] bg-rose-50 text-rose-700 border-rose-300 inline-flex items-center gap-1"
                                : "text-[10px]"
                            }
                          >
                            {r.classificacao === "MATERIAL" ? (
                              "Material"
                            ) : r.classificacao === "SERVICO" ? (
                              "Serviço"
                            ) : (
                              <>
                                <Pill className="h-3 w-3" aria-hidden />
                                Medicamentos
                              </>
                            )}
                          </Badge>
                        </div>
                        <div className="text-xs text-slate-700 mt-1">
                          {fmtBR(r.data_requisicao)} · <strong>{r.solicitante}</strong>
                          {r.setor ? ` · ${r.setor}` : ""}
                          {r.fornecedor ? ` · Fornecedor: ${r.fornecedor}` : ""}
                        </div>
                        {r.status === "INDEFERIDA" && r.motivo_indeferimento && (
                          <div className="text-xs text-rose-700 mt-1">Motivo: {r.motivo_indeferimento}</div>
                        )}
                        {r.status === "DEVOLVIDA" && (
                          <div className="mt-1 text-xs bg-orange-50 border border-orange-300 rounded px-2 py-1 text-orange-900">
                            <strong>↩ Devolvida pelo Compras</strong>
                            {r.devolvida_por_nome ? <> · {r.devolvida_por_nome}</> : null}
                            {r.devolvida_em ? <> · {fmtBR(r.devolvida_em)}</> : null}
                            {r.devolucao_mensagem && (
                              <div className="text-[11px] text-orange-800 mt-0.5 whitespace-pre-wrap">
                                {r.devolucao_mensagem}
                              </div>
                            )}
                            {r.motivo_indeferimento && (
                              <div className="text-[11px] text-orange-700 mt-0.5">
                                Indeferimento anterior: {r.motivo_indeferimento}
                              </div>
                            )}
                          </div>
                        )}
                        {r.status === "EM_RECEBIMENTO" && r.pc_numero && (
                          <div className="text-xs text-cyan-800 mt-1">
                            PC {r.pc_numero} emitido{r.pc_fornecedor ? <> — {r.pc_fornecedor}</> : null}
                            {r.pc_valor != null && <> · {Number(r.pc_valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</>}
                          </div>
                        )}
                        {r.status === "CONCLUIDA" && r.nf_numero && (
                          <div className="text-xs text-slate-700 mt-1">
                            NF {r.nf_numero} recebida{r.recebido_em ? <> em {fmtBR(r.recebido_em)}</> : null}
                          </div>
                        )}
                        {(r.status === "COTADA" || r.status === "APROVADA") && r.cotacao_fornecedor && (
                          <div className="text-xs text-blue-700 mt-1">
                            Cotada por <strong>{r.cotador_nome ?? "—"}</strong> · {r.cotacao_fornecedor}
                            {r.cotacao_valor != null && (
                              <> · {Number(r.cotacao_valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</>
                            )}
                          </div>
                        )}
                        {r.dispensa_cotacao && (
                          <div className="mt-1 text-xs bg-amber-50 border border-amber-300 rounded px-2 py-1 text-amber-900">
                            <strong>⚠️ Dispensa de cotação:</strong>{" "}
                            {(() => {
                              const map: Record<string, string> = {
                                FORNECEDOR_EXCLUSIVO: "Fornecedor exclusivo",
                                CONTRATO_GUARDA_CHUVA: "Contrato guarda-chuva",
                                URGENCIA_OPERACIONAL: "Urgência operacional",
                                PADRONIZACAO_TECNICA: "Padronização técnica",
                                OUTRO: "Outro",
                              };
                              return map[r.dispensa_motivo ?? ""] ?? r.dispensa_motivo;
                            })()}
                            {r.dispensa_justificativa && (
                              <div className="text-[11px] text-amber-800 mt-0.5 whitespace-pre-wrap">
                                {r.dispensa_justificativa}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {r.classificacao === "MEDICAMENTOS" ? (
                          <>
                            <MedPdfBtns req={r} />
                            <ViewBtn req={r} />
                            <MedEditBtn req={r} />
                          </>
                        ) : (
                          <>
                            <Button size="sm" variant="outline" onClick={() => emitirPdf(r, "print")}>
                              <Printer className="h-3.5 w-3.5 mr-1" /> Imprimir
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => emitirPdf(r, "preview")}>
                              <Printer className="h-3.5 w-3.5 mr-1" /> PDF
                            </Button>
                            <ViewBtn req={r} />
                            {isEditor && <EditReqBtn req={r} userId={user?.id} />}
                          </>
                        )}
                        {isEditor && (r.status === "PENDENTE" || r.status === "COTADA") && (
                          <>
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700"
                              onClick={() => updateStatus.mutate({ id: r.id, status: "APROVADA" })}
                            >
                              <Check className="h-3.5 w-3.5 mr-1" /> Deferir
                            </Button>
                            <IndeferBtn onConfirm={(motivo) => updateStatus.mutate({ id: r.id, status: "INDEFERIDA", motivo })} />
                            {r.status === "COTADA" && (
                              <DevolverRcBtn rcId={r.id} numero={r.numero} dispensa={!!r.dispensa_cotacao} />
                            )}
                          </>
                        )}
                        {(r.status === "APROVADA" || r.status === "INDEFERIDA") && (
                          <ReabrirRcBtn rcId={r.id} numero={r.numero} statusAtual={r.status} />
                        )}
                        {isEditor && (
                          <Button size="sm" variant="ghost" onClick={() => {
                            if (confirm(`Excluir requisição ${r.numero}?`)) delReq.mutate(r.id);
                          }}>
                            <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                          </Button>
                        )}
                      </div>
                    </div>
                );
                return (
                  <div className="space-y-3">
                    {grupos.map((mes, mIdx) => (
                      <details
                        key={mes.label}
                        open={mIdx === 0}
                        className="group rounded-xl border border-border/60 bg-muted/20 overflow-hidden"
                      >
                        <summary className="cursor-pointer select-none list-none px-3 md:px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-muted/40 transition">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-muted-foreground text-xs group-open:rotate-90 transition-transform">▶</span>
                            <span className="font-bold text-foreground capitalize truncate">{mes.label}</span>
                          </div>
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-200 shrink-0">
                            {mes.total} {mes.total === 1 ? "requisição" : "requisições"}
                          </span>
                        </summary>
                        <div className="p-2 md:p-3 space-y-2 bg-background/40">
                          {mes.dias.map((dia, dIdx) => (
                            <details
                              key={dia.label}
                              open={mIdx === 0 && dIdx === 0}
                              className="group/dia rounded-lg border border-border/50 bg-card/60"
                            >
                              <summary className="cursor-pointer select-none list-none px-3 py-2 flex items-center justify-between gap-2 hover:bg-muted/30 transition">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-muted-foreground text-[10px] group-open/dia:rotate-90 transition-transform">▶</span>
                                  <span className="font-semibold text-sm text-foreground">{dia.label}</span>
                                </div>
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                                  {dia.itens.length}
                                </span>
                              </summary>
                              <div className="p-2 space-y-2">
                                {dia.itens.map(renderLinha)}
                              </div>
                            </details>
                          ))}
                        </div>
                      </details>
                    ))}
                  </div>
                );
              })()}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      {previewState && (
        <PDFPreviewDialog
          open={!!previewState}
          onClose={() => setPreviewState(null)}
          doc={previewState.doc}
          fileName={rcPdfFileName(previewState.req)}
          title={`Requisição de Compra — Nº ${previewState.req.numero}`}
          signable={isEditor}
          useSignatureGallery
          signatureLabels={{ eng: "Solicitante", sesmt: "Supervisor Geral", enc: "Analista de Compras" }}
          engSig={previewState.req.signature_solicitante ?? null}
          onChangeEngSig={async (v) => {
            await updateSolicitanteSig.mutateAsync({ id: previewState.req.id, signature: v });
            const nextReq = {
              ...previewState.req,
              signature_solicitante: v,
              signature_solicitante_height: v ? 20 : null,
            } as Req;
            await regeneratePreview(nextReq);
            toast.success(v ? "Assinatura aplicada no PDF" : "Assinatura removida");
          }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs font-bold uppercase text-slate-500">{label}</div>
        <div className={`text-3xl font-black ${cls}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function ReabrirRcBtn({ rcId, numero, statusAtual }: { rcId: string; numero: string; statusAtual: string }) {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);

  // Só admin ou supervisor geral podem reabrir. O RPC valida no servidor;
  // aqui mostramos o botão pra admin sempre (supervisor cai no gate do RPC).
  const podeVer = isAdmin || true; // botão sempre visível pra editor; RPC bloqueia quem não tem permissão
  if (!podeVer) return null;

  async function submit() {
    if (motivo.trim().length < 5) {
      toast.error("Justificativa mínima de 5 caracteres");
      return;
    }
    setLoading(true);
    const { error } = await supabase.rpc("reabrir_rc", { _rc_id: rcId, _motivo: motivo.trim() });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`RC ${numero} reaberta para cotação`);
    setOpen(false);
    setMotivo("");
    qc.invalidateQueries({ queryKey: ["purchase_requisitions"] });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" title={`Reabrir RC (atual: ${statusAtual})`}>
          Reabrir
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reabrir RC {numero}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-sm text-slate-600">
            A RC voltará para o status <strong>COTADA</strong>, permitindo nova decisão do Supervisor Geral.
            A ação fica registrada em auditoria.
          </div>
          <div>
            <Label htmlFor="motivo-reabrir">Justificativa *</Label>
            <Textarea
              id="motivo-reabrir"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: deferimento acidental, correção de valor, novo pedido do solicitante…"
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={loading || motivo.trim().length < 5}>
            {loading ? "Reabrindo…" : "Confirmar reabertura"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DevolverRcBtn({ rcId, numero, dispensa }: { rcId: string; numero: string; dispensa: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (motivo.trim().length < 10) {
      toast.error("Justificativa mínima de 10 caracteres");
      return;
    }
    setLoading(true);
    const { error } = await supabase.rpc("devolver_rc_para_cotacao", { _rc_id: rcId, _motivo: motivo.trim() });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(`RC ${numero} devolvida para Compras`);
    setOpen(false); setMotivo("");
    qc.invalidateQueries({ queryKey: ["purchase-reqs"] });
    qc.invalidateQueries({ queryKey: ["rc-header-badge"] });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="border-amber-400 text-amber-800 hover:bg-amber-50">
          Devolver
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Devolver RC {numero} para Compras</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-sm text-slate-600">
            A RC voltará para <strong>EM_COTACAO</strong>.
            {dispensa ? " A dispensa de cotação será revogada e Compras precisará anexar as 3 cotações." : " Compras poderá revisar/complementar as cotações."}
            {" "}A ação fica registrada em auditoria.
          </div>
          <div>
            <Label htmlFor="motivo-devolver">Motivo da devolução *</Label>
            <Textarea
              id="motivo-devolver"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: justificativa de dispensa insuficiente, preço fora da média, exigir 3 cotações…"
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>Cancelar</Button>
          <Button
            onClick={submit}
            disabled={loading || motivo.trim().length < 10}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {loading ? "Devolvendo…" : "Confirmar devolução"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ViewBtn({ req }: { req: Req }) {
  const [open, setOpen] = useState(false);
  const { data: itens = [] } = useQuery({
    queryKey: ["pr-items", req.id, open],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_requisition_items")
        .select("*")
        .eq("requisition_id", req.id)
        .order("item_numero");
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost"><Eye className="h-3.5 w-3.5" /></Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Requisição Nº {req.numero}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          {req.titulo && (
            <div className="bg-red-50 p-2 rounded border border-red-100 mb-2 font-bold text-red-900">
              {req.titulo}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div><strong>Data:</strong> {fmtBR(req.data_requisicao)}</div>
            <div><strong>Classificação:</strong> {req.classificacao === "MATERIAL" ? "Material" : "Serviço"}</div>
            <div><strong>Solicitante:</strong> {req.solicitante}</div>
            <div><strong>Setor:</strong> {req.setor || "—"}</div>
            <div><strong>Fornecedor:</strong> {req.fornecedor || "—"}</div>
            <div><strong>Status:</strong> {STATUS_LABEL[req.status]}</div>
            <div><strong>Obra construção:</strong> {req.obra_construcao || "—"}</div>
            <div><strong>Obra manutenção:</strong> {req.obra_manutencao || "—"}</div>
          </div>
          <table className="w-full border text-xs mt-3">
            <thead className="bg-slate-100">
              <tr>
                <th className="border p-1">Item</th>
                <th className="border p-1 text-left">Descrição</th>
                <th className="border p-1">Qtde</th>
                <th className="border p-1">Unid.</th>
                <th className="border p-1 text-left">Observação</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((i: any) => (
                <tr key={i.id}>
                  <td className="border p-1 text-center">{String(i.item_numero).padStart(2,"0")}</td>
                  <td className="border p-1">{i.descricao}</td>
                  <td className="border p-1 text-center">{i.quantidade ?? ""}</td>
                  <td className="border p-1 text-center">{i.unidade ?? ""}</td>
                  <td className="border p-1">{i.observacao ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function IndeferBtn({ onConfirm }: { onConfirm: (motivo: string) => void }) {
  return <_IndeferBtnImpl onConfirm={onConfirm} />;
}

function EditReqBtn({ req, userId }: { req: Req; userId?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" title="Editar requisição">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      {open && <ReqFormDialog onClose={() => setOpen(false)} userId={userId} existing={req} />}
    </Dialog>
  );
}

async function loadMedItemsForPdf(reqId: string) {
  const { data } = await supabase
    .from("purchase_requisition_items")
    .select("*")
    .eq("requisition_id", reqId)
    .order("item_numero");
  return (data ?? []).map((r: any) => {
    const raw = String(r.descricao ?? "");
    const sep = raw.lastIndexOf(" — ");
    const descricao = sep > 0 ? raw.slice(0, sep) : raw;
    const apresentacao = sep > 0 ? raw.slice(sep + 3) : "";
    return {
      descricao,
      apresentacao,
      unidade: r.unidade ?? "UN",
      quantidade: Number(r.quantidade ?? 0),
      justificativa: r.observacao ?? "",
    };
  });
}

function MedPdfBtns({ req }: { req: Req }) {
  const [previewDoc, setPreviewDoc] = useState<jsPDF | null>(null);
  const [busy, setBusy] = useState<null | "pdf">(null);

  async function build() {
    const [{ buildRequisicaoMedicamentosPdf }] = await Promise.all([
      import("@/lib/requisicao-medicamentos-pdf"),
    ]);
    const itens = await loadMedItemsForPdf(req.id);
    return buildRequisicaoMedicamentosPdf({
      numero: req.numero,
      solicitante: req.solicitante ?? "",
      setor: req.setor ?? "SESMT — Ambulatório",
      responsavelTST: (req as any).responsavel_tst ?? "",
      observacoes: (req as any).observacoes ?? "",
      itens,
      assinaturaSolicitanteDataUrl: (req as any).signature_solicitante ?? undefined,
    });
  }

  async function visualizar() {
    try {
      setBusy("pdf");
      const doc = await build();
      setPreviewDoc(doc);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar PDF");
    } finally { setBusy(null); }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={visualizar} disabled={busy !== null}>
        <Printer className="h-3.5 w-3.5 mr-1" /> PDF
      </Button>
      <PDFPreviewDialog
        open={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        doc={previewDoc}
        fileName={`requisicao-medicamentos-${req.numero.replace(/\//g, "-")}.pdf`}
        title={`Requisição de Medicamentos — Nº ${req.numero}`}
      />
    </>
  );
}

function MedEditBtn({ req }: { req: Req }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="bg-rose-50 border-rose-300 text-rose-700 hover:bg-rose-100"
        onClick={() => setOpen(true)}
        title="Abrir requisição de medicamentos"
      >
        <Pencil className="h-3.5 w-3.5 mr-1" /> Abrir
      </Button>
      <RequisicaoMedicamentosDialog
        requisitionId={req.id}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

function _IndeferBtnImpl({ onConfirm }: { onConfirm: (motivo: string) => void }) {
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="border-rose-300 text-rose-700 hover:bg-rose-50">
          <XIcon className="h-3.5 w-3.5 mr-1" /> Indeferir
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Indeferir requisição</DialogTitle></DialogHeader>
        <Label>Motivo</Label>
        <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Informe o motivo do indeferimento" />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            className="bg-rose-700 hover:bg-rose-800"
            disabled={!motivo.trim()}
            onClick={() => { onConfirm(motivo.trim()); setOpen(false); setMotivo(""); }}
          >
            Confirmar indeferimento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type DescricaoSuggestion = { descricao: string; unidade?: string | null };

export function ReqFormDialog({
  onClose,
  userId,
  existing,
  setorFixo,
  consultaSlot,
  descricaoSuggest,
  draftKey,
  dialogTitle,
}: {
  onClose: () => void;
  userId?: string;
  existing?: Req;
  setorFixo?: string;
  consultaSlot?: (pick: (i: PickedItem) => void) => React.ReactNode;
  descricaoSuggest?: (q: string) => Promise<DescricaoSuggestion[]>;
  draftKey?: string;
  dialogTitle?: string;
}) {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const isEdit = !!existing;

  // Gera número automático apenas no modo de criação
  useEffect(() => {
    if (isEdit) return;
    (async () => {
      // Sprint 1: número de RC gerado pela RPC atômica (advisory lock + UNIQUE).
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase.rpc("gerar_numero_rc" as any, { _data: today } as any);
      if (!error && data) {
        setForm((f) => ({ ...f, numero: String(data) }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [form, setForm] = useState({
    numero: existing?.numero ?? "Gerando...",
    titulo: existing?.titulo ?? "",
    data_requisicao: existing?.data_requisicao ?? today,
    classificacao: (existing?.classificacao ?? "MATERIAL") as Classe,
    solicitante: existing?.solicitante ?? "",
    setor: existing?.setor ?? setorFixo ?? "",
    fornecedor: existing?.fornecedor ?? "",
    obra_construcao: existing?.obra_construcao ?? "",
    obra_manutencao: existing?.obra_manutencao ?? "",
    codigo_formulario: existing?.codigo_formulario ?? "FOR-COMP: 03",
    revisao: existing?.revisao ?? "01",
    data_revisao: existing?.data_revisao ?? today,
    pagina: existing?.pagina ?? "01/01",
    observacoes: existing?.observacoes ?? "",
    urgencia: (existing?.urgencia ?? "NORMAL") as Urgencia,
  });
  const [itens, setItens] = useState<Item[]>(emptyItems());
  const [signature, setSignature] = useState<string | null>(() => {
    return existing?.signature_solicitante || localStorage.getItem("sigmo:last-user-signature") || null;
  });
  const [signatureHeight, setSignatureHeight] = useState<number>(() => {
    const stored = existing?.signature_solicitante_height;
    if (!stored) return 80;
    // Compat: valores <=25 são mm (novo formato); >25 são px legados do slider.
    return stored <= 25 ? Math.round(20 + ((stored - 4) / 16) * 120) : stored;
  });

  // === Autosave de rascunho (somente em modo de criação) ===
  const DRAFT_KEY = draftKey ?? "requisicao-nova";
  const DRAFT_ROUTE = "/app/sesmt/requisicoes";

  // Restaura rascunho ao abrir, se existir
  useEffect(() => {
    if (isEdit) return;
    const rec = loadDraft<{
      form: typeof form;
      itens: Item[];
      signature: string | null;
      signatureHeight: number;
    }>(DRAFT_KEY);
    if (!rec) return;
    setForm(rec.data.form);
    setItens(rec.data.itens);
    setSignature(rec.data.signature);
    setSignatureHeight(rec.data.signatureHeight);
    toast.info("Rascunho recuperado", {
      description: "Continuamos de onde você parou.",
      action: {
        label: "Descartar",
        onClick: () => {
          deleteDraft(DRAFT_KEY);
          onClose();
        },
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useDraftAutosave(
    DRAFT_KEY,
    `Requisição ${form.numero || "nova"}${form.solicitante ? ` · ${form.solicitante}` : ""}`,
    DRAFT_ROUTE,
    { form, itens, signature, signatureHeight },
    { enabled: !isEdit },
  );

  // Carrega itens existentes em modo edição
  useEffect(() => {
    if (!existing) return;
    (async () => {
      const { data } = await supabase
        .from("purchase_requisition_items")
        .select("*")
        .eq("requisition_id", existing.id)
        .order("item_numero");
      const loaded: Item[] = (data ?? []).map((f: any) => ({
        item_numero: f.item_numero,
        descricao: f.descricao ?? "",
        quantidade: f.quantidade != null ? String(f.quantidade) : "",
        unidade: f.unidade ?? "",
        observacao: f.observacao ?? "",
      }));
      // Garante no mínimo 10 linhas
      const base = emptyItems();
      const merged = base.map((d) => loaded.find((x) => x.item_numero === d.item_numero) ?? d);
      const extras = loaded.filter((x) => x.item_numero > base.length);
      setItens([...merged, ...extras]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id]);

  const onSignatureUpload = async (file: File | null) => {
    if (!file) return;
    if (file.type !== "image/png") {
      toast.error("A assinatura deve estar no formato PNG");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx. 2MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setSignature(base64);
      // Salva a assinatura globalmente para reaproveitamento em novas requisições
      localStorage.setItem("sigmo:last-user-signature", base64);
    };
    reader.readAsDataURL(file);
  };

  const setItem = (idx: number, k: keyof Item, v: string) => {
    setItens((arr) => arr.map((it, i) => i === idx ? { ...it, [k]: v } : it));
  };

  const addItem = () => {
    setItens((arr) => [
      ...arr,
      { item_numero: arr.length + 1, descricao: "", quantidade: "", unidade: "", observacao: "" },
    ]);
  };

  const removeLastItem = () => {
    setItens((arr) => arr.length > 10 ? arr.slice(0, -1) : arr);
  };

  const pickFromEstoque = (picked: PickedItem) => {
    setItens((arr) => {
      const idx = arr.findIndex((it) => !it.descricao.trim());
      if (idx === -1) {
        return [
          ...arr,
          {
            item_numero: arr.length + 1,
            descricao: picked.descricao,
            quantidade: "",
            unidade: picked.unidade || "",
            observacao: picked.ca ? `CA ${picked.ca}` : "",
          },
        ];
      }
      return arr.map((it, i) =>
        i === idx
          ? {
              ...it,
              descricao: picked.descricao,
              unidade: it.unidade || picked.unidade || "",
              observacao: it.observacao || (picked.ca ? `CA ${picked.ca}` : ""),
            }
          : it,
      );
    });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.numero.trim() || !form.solicitante.trim()) {
        throw new Error("Preencha número e solicitante");
      }
      const payload = {
        numero: form.numero.trim(),
        titulo: form.titulo.trim() || null,
        data_requisicao: form.data_requisicao,
        classificacao: form.classificacao,
        solicitante: form.solicitante.trim(),
        setor: form.setor.trim() || null,
        fornecedor: form.fornecedor.trim() || null,
        obra_construcao: form.obra_construcao.trim() || null,
        obra_manutencao: form.obra_manutencao.trim() || null,
        codigo_formulario: form.codigo_formulario,
        revisao: form.revisao,
        data_revisao: form.data_revisao || null,
        pagina: form.pagina,
        observacoes: form.observacoes.trim() || null,
        signature_solicitante: signature,
        // Converte o slider (20-140 px de preview) para altura em mm no PDF (4-20 mm).
        signature_solicitante_height: signature
          ? Math.round(4 + Math.max(0, Math.min(120, signatureHeight - 20)) / 120 * 16)
          : null,
        urgencia: form.urgencia,
      };

      let reqId: string;
      if (isEdit && existing) {
        const { error } = await supabase
          .from("purchase_requisitions")
          .update(payload)
          .eq("id", existing.id);
        if (error) throw error;
        reqId = existing.id;
        // Substitui itens
        const { error: eDel } = await supabase
          .from("purchase_requisition_items")
          .delete()
          .eq("requisition_id", reqId);
        if (eDel) throw eDel;
      } else {
        const { data: req, error } = await supabase
          .from("purchase_requisitions")
          .insert({ ...payload, created_by: userId ?? null })
          .select()
          .single();
        if (error) throw error;
        reqId = req.id;
      }

      const itemsToInsert = itens
        .filter((i) => i.descricao.trim())
        .map((i) => ({
          requisition_id: reqId,
          item_numero: i.item_numero,
          descricao: i.descricao.trim(),
          quantidade: i.quantidade ? Number(i.quantidade) : null,
          unidade: i.unidade.trim() || null,
          observacao: i.observacao.trim() || null,
        }));
      if (itemsToInsert.length > 0) {
        const { error: e2 } = await supabase.from("purchase_requisition_items").insert(itemsToInsert);
        if (e2) throw e2;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["purchase-reqs"] });
      toast.success(isEdit ? "Requisição atualizada" : "Requisição criada");
      if (!isEdit) deleteDraft(DRAFT_KEY);
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  // === Conteúdo dos passos do wizard ===
  const stepCabecalho = (
    <div className="border-2 border-black bg-white text-black font-sans text-[12px] leading-tight">
      {/* Cabeçalho: logo | título | bloco código */}
      <div className="grid grid-cols-[110px_1fr_180px] border-b-2 border-black">
            <div className="border-r-2 border-black flex items-center justify-center p-2">
              <img src={dmnLogo} alt="DMN" className="max-h-14 object-contain" />
            </div>
            <div className="border-r-2 border-black flex flex-col items-center justify-center px-3 py-2 text-center">
              <span className="font-extrabold text-[15px] uppercase leading-none">
                Requisição de Compra de Materiais e Serviços
              </span>
              <input
                placeholder="TÍTULO DA REQUISIÇÃO (EX: NOVOS FARDAMENTOS)"
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                className="w-full mt-1 bg-yellow-50/50 border-0 border-b border-dashed border-red-700/30 text-center uppercase font-bold text-[11px] text-red-900 outline-none focus:bg-yellow-50 focus:border-red-700"
              />
            </div>
            <div className="text-[11px] p-2 space-y-0.5">
              <FieldInline label="CÓD." value={form.codigo_formulario} onChange={(v) => setForm({ ...form, codigo_formulario: v })} />
              <FieldInline label="REVISÃO:" value={form.revisao} onChange={(v) => setForm({ ...form, revisao: v })} />
              <FieldInline label="DATA:" type="date" value={form.data_revisao} onChange={(v) => setForm({ ...form, data_revisao: v })} readOnly />
              <FieldInline label="PAG.:" value={form.pagina} onChange={(v) => setForm({ ...form, pagina: v })} />
            </div>
          </div>

          {/* Linha 1: Classificação | Data */}
          <div className="grid grid-cols-2 border-b border-black">
            <div className="border-r border-black p-1.5 flex items-center gap-2 flex-wrap">
              <span className="font-bold uppercase">Classificação do Pedido:</span>
              <label className="inline-flex items-center gap-1">
                <span>MATERIAL</span>
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5"
                  checked={form.classificacao === "MATERIAL"}
                  onChange={() => setForm({ ...form, classificacao: "MATERIAL" })}
                />
              </label>
              <label className="inline-flex items-center gap-1">
                <span>SERVIÇO</span>
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5"
                  checked={form.classificacao === "SERVICO"}
                  onChange={() => setForm({ ...form, classificacao: "SERVICO" })}
                />
              </label>
            </div>
            <FieldRow label="DATA:" type="date" value={form.data_requisicao} onChange={(v) => setForm({ ...form, data_requisicao: v })} />
          </div>

          {/* Linha 2: Solicitante | Nº Requisição */}
          <div className="grid grid-cols-2 border-b border-black">
            <FieldRow label="SOLICITANTE:" value={form.solicitante} onChange={(v) => setForm({ ...form, solicitante: v })} required />
            <div className="border-l border-black">
              <FieldRow label="Nº DA REQUISIÇÃO:" value={form.numero} onChange={(v) => setForm({ ...form, numero: v })} required />
            </div>
          </div>

          {/* Linha 3: Setor | Fornecedor */}
          <div className="grid grid-cols-2 border-b border-black">
            {setorFixo ? (
              <div className="flex items-stretch">
                <span className="font-bold uppercase whitespace-nowrap p-1.5 pr-2">SETOR:</span>
                <span className="flex-1 min-w-0 px-1 py-1.5 text-[12px] font-semibold text-red-800">
                  {setorFixo} <span className="text-[10px] font-normal text-slate-500">(travado)</span>
                </span>
              </div>
            ) : (
              <SetorField value={form.setor} onChange={(v) => setForm({ ...form, setor: v })} />
            )}
            <div className="border-l border-black">
              <FieldRow label="FORNECEDOR:" value={form.fornecedor} onChange={(v) => setForm({ ...form, fornecedor: v })} />
            </div>
          </div>

          {/* Linha 4: Obra Construção | Obra Manutenção */}
          <div className="grid grid-cols-2 border-b-2 border-black">
            <FieldRow label="OBRA EM CONSTRUÇÃO:" value={form.obra_construcao} onChange={(v) => setForm({ ...form, obra_construcao: v })} />
            <div className="border-l border-black">
              <FieldRow label="OBRA EM MANUTENÇÃO:" value={form.obra_manutencao} onChange={(v) => setForm({ ...form, obra_manutencao: v })} />
            </div>
          </div>

          {/* Linha 5: Urgência (Sprint 3 — SLA) */}
          <div className="p-3 bg-slate-50 border-b-2 border-black">
            <UrgenciaSelect
              value={form.urgencia}
              onChange={(v) => setForm({ ...form, urgencia: v })}
            />
            <p className="text-[11px] text-slate-600 mt-1">
              Emergência = 24h · Urgente = 48h · Normal = 7 dias. O prazo é cronometrado a partir da criação.
            </p>
          </div>
    </div>
  );

  const stepItens = (
    <div className="space-y-3">
      <div className="border-2 border-black bg-white text-black font-sans text-[12px] leading-tight">
        {/* Cabeçalho da tabela de itens */}
        <div className="grid grid-cols-[40px_1fr_70px_70px_1fr] bg-white font-bold uppercase text-center border-b-2 border-black">
            <div className="border-r border-black p-1">Item</div>
            <div className="border-r border-black p-1">Descrição completa do material ou serviço</div>
            <div className="border-r border-black p-1">Qtde</div>
            <div className="border-r border-black p-1">Unid.</div>
            <div className="p-1">Observação</div>
          </div>
        {/* Linhas de itens */}
        {itens.map((it, idx) => (
            <div key={idx} className="grid grid-cols-[40px_1fr_70px_70px_1fr] border-b border-black">
              <div className="border-r border-black p-1 text-center font-bold">
                {String(it.item_numero).padStart(2, "0")}
              </div>
              <div className="border-r border-black">
                {descricaoSuggest ? (
                  <DescricaoAutocompleteCell
                    value={it.descricao}
                    onChange={(v) => setItem(idx, "descricao", v)}
                    onPick={(s) => {
                      setItem(idx, "descricao", s.descricao);
                      if (s.unidade && !it.unidade) setItem(idx, "unidade", s.unidade);
                    }}
                    suggest={descricaoSuggest}
                  />
                ) : (
                  <CellInput value={it.descricao} onChange={(v) => setItem(idx, "descricao", v)} />
                )}
              </div>
              <div className="border-r border-black">
                <CellInput value={it.quantidade} onChange={(v) => setItem(idx, "quantidade", v)} className="text-center" />
              </div>
              <div className="border-r border-black">
                <CellInput value={it.unidade} onChange={(v) => setItem(idx, "unidade", v)} className="text-center" />
              </div>
              <div>
                <CellInput value={it.observacao} onChange={(v) => setItem(idx, "observacao", v)} />
              </div>
            </div>
          ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Total de linhas: {itens.length}</span>
            {consultaSlot
              ? consultaSlot(pickFromEstoque)
              : <EstoqueLookupSheet onPick={pickFromEstoque} triggerLabel="Consultar Estoque / CA" />}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={removeLastItem} disabled={itens.length <= 10}>
              Remover última linha
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar item
            </Button>
          </div>
        </div>
    </div>
  );

  const stepAssinatura = (
    <div className="space-y-3">
      <div className="border-2 border-black bg-white text-black text-[12px]">
          <div className="grid grid-cols-3 font-bold text-center uppercase border-b border-black">
            <div className="border-r border-black p-1.5">Assinatura Solicitante</div>
            <div className="border-r border-black p-1.5">Assinatura Supervisor Geral</div>
            <div className="p-1.5">Assinatura Analista de Compras</div>
          </div>
          <div className="grid grid-cols-3 min-h-16">
            <div className="border-r border-black relative flex items-center justify-center p-1">
              {signature ? (
                <div className="flex flex-col items-center gap-1 w-full">
                  <img
                    src={signature}
                    alt="Assinatura do solicitante"
                    style={{ height: `${signatureHeight}px` }}
                    className="object-contain max-w-full"
                  />
                  <div className="flex items-center gap-2 w-full px-2">
                    <span className="text-[10px] text-muted-foreground">Tamanho</span>
                    <input
                      type="range"
                      min={20}
                      max={140}
                      step={2}
                      value={signatureHeight}
                      onChange={(e) => setSignatureHeight(Number(e.target.value))}
                      className="flex-1 accent-red-700"
                    />
                    <button
                      type="button"
                      onClick={() => setSignature(null)}
                      className="text-[10px] text-red-700 hover:underline"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2 items-center p-2">
                  <label className="cursor-pointer text-[11px] text-red-700 hover:underline px-2 py-1 border border-dashed border-red-700/50 rounded w-full text-center">
                    Enviar assinatura (PNG)
                    <input
                      type="file"
                      accept="image/png"
                      className="hidden"
                      onChange={(e) => onSignatureUpload(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  <SignatureGallery onSelect={(data) => setSignature(data)} />
                </div>
              )}
            </div>
            <div className="border-r border-black" />
            <div />
          </div>
          <div className="grid grid-cols-3 border-t border-black font-bold uppercase">
            <div className="border-r border-black p-1.5 flex items-center gap-2">
              <span>Data:</span>
              <input
                type="date"
                value={form.data_requisicao}
                onChange={(e) => setForm({ ...form, data_requisicao: e.target.value })}
                className="flex-1 min-w-0 bg-transparent border-0 outline-none font-normal focus:bg-yellow-50"
              />
            </div>
            <div className="border-r border-black p-1.5">Data:</div>
            <div className="p-1.5">Data:</div>
          </div>
        </div>
      <div>
          <Label className="text-xs">Observações gerais (interno)</Label>
          <Textarea
            value={form.observacoes}
            onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
            rows={2}
          />
        </div>
    </div>
  );

  const itensPreenchidos = itens.filter((i) => i.descricao.trim());
  const stepRevisao = (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 border rounded-md p-3 bg-slate-50">
        <div className="col-span-2 text-red-800 font-bold border-b pb-1 mb-1">
          TÍTULO: {form.titulo || "Não informado"}
        </div>
        <div><strong>Nº:</strong> {form.numero}</div>
        <div><strong>Data:</strong> {fmtBR(form.data_requisicao)}</div>
        <div><strong>Classificação:</strong> {form.classificacao === "MATERIAL" ? "Material" : "Serviço"}</div>
        <div><strong>Solicitante:</strong> {form.solicitante || "—"}</div>
        <div><strong>Setor:</strong> {form.setor || "—"}</div>
        <div><strong>Fornecedor:</strong> {form.fornecedor || "—"}</div>
        <div><strong>Obra construção:</strong> {form.obra_construcao || "—"}</div>
        <div><strong>Obra manutenção:</strong> {form.obra_manutencao || "—"}</div>
        <div><strong>Assinatura:</strong> {signature ? "Enviada" : "Não enviada"}</div>
        <div><strong>Itens preenchidos:</strong> {itensPreenchidos.length}</div>
      </div>
      {itensPreenchidos.length > 0 && (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-100">
              <tr>
                <th className="border p-1">Item</th>
                <th className="border p-1 text-left">Descrição</th>
                <th className="border p-1">Qtde</th>
                <th className="border p-1">Unid.</th>
              </tr>
            </thead>
            <tbody>
              {itensPreenchidos.map((i) => (
                <tr key={i.item_numero}>
                  <td className="border p-1 text-center">{String(i.item_numero).padStart(2, "0")}</td>
                  <td className="border p-1">{i.descricao}</td>
                  <td className="border p-1 text-center">{i.quantidade || "—"}</td>
                  <td className="border p-1 text-center">{i.unidade || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-500">Confirme os dados acima e clique em <strong>{isEdit ? "Atualizar Requisição" : "Salvar Requisição"}</strong>.</p>
    </div>
  );

  const steps: WizardStep[] = [
    {
      id: "cabecalho",
      title: "Cabeçalho e dados",
      description: "Classificação, solicitante, número e obras.",
      content: stepCabecalho,
      isValid: () => form.numero.trim() !== "" && form.solicitante.trim() !== "",
      invalidMessage: "Preencha pelo menos Nº da Requisição e Solicitante.",
    },
    {
      id: "itens",
      title: "Itens da requisição",
      description: "Adicione os materiais ou serviços. Use o estoque para preenchimento rápido.",
      content: stepItens,
      isValid: () => itens.some((i) => i.descricao.trim() !== ""),
      invalidMessage: "Adicione pelo menos um item com descrição.",
    },
    {
      id: "assinatura",
      title: "Assinatura e observações",
      description: "Anexe a assinatura do solicitante (PNG) e observações internas.",
      content: stepAssinatura,
    },
    {
      id: "revisao",
      title: "Revisão final",
      description: "Confira e salve.",
      content: stepRevisao,
    },
  ];

  return (
    <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0">
      <DialogHeader className="px-4 pt-4 pb-2 border-b">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <DialogTitle>{isEdit ? `Editar Requisição Nº ${existing?.numero}` : (dialogTitle ?? "Nova Requisição de Compra")}</DialogTitle>
          {consultaSlot
            ? consultaSlot(pickFromEstoque)
            : <EstoqueLookupSheet onPick={pickFromEstoque} triggerLabel="Consultar Estoque / CA" />}
        </div>
      </DialogHeader>
      <div className="px-4 pb-4 pt-3">
        <Wizard
          steps={steps}
          onComplete={() => save.mutate()}
          isSubmitting={save.isPending}
          completeLabel={save.isPending ? "Salvando..." : isEdit ? "Atualizar Requisição" : "Salvar Requisição"}
          onCancel={onClose}
        />
      </div>
    </DialogContent>
  );
}

function FieldInline({
  label, value, onChange, type = "text", readOnly,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; readOnly?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      <span className="font-bold whitespace-nowrap">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        className={`flex-1 min-w-0 bg-transparent border-0 border-b border-dotted border-black/40 outline-none text-[11px] px-0.5 focus:border-red-700 ${readOnly ? "cursor-default text-black/70" : ""}`}
      />
    </div>
  );
}

function FieldRow({
  label, value, onChange, type = "text", required,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div className="flex items-stretch">
      <span className="font-bold uppercase whitespace-nowrap p-1.5 pr-2">
        {label}{required && <span className="text-red-700 ml-0.5">*</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 min-w-0 bg-transparent border-0 outline-none px-1 text-[12px] focus:bg-yellow-50"
      />
    </div>
  );
}

export const SETORES_RC = [
  "Produção",
  "Manutenção Elétrica",
  "Manutenção Mecânica",
  "Administrativo",
  "Almoxarifado",
  "SESMT",
] as const;

function SetorField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-stretch">
      <span className="font-bold uppercase whitespace-nowrap p-1.5 pr-2">
        SETOR:<span className="text-red-700 ml-0.5">*</span>
      </span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 min-w-0 bg-transparent border-0 outline-none px-1 text-[12px] focus:bg-yellow-50"
      >
        <option value="">— selecione —</option>
        {SETORES_RC.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
    </div>
  );
}

function CellInput({
  value, onChange, className = "",
}: { value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full h-8 bg-transparent border-0 outline-none px-1.5 text-[12px] focus:bg-yellow-50 ${className}`}
    />
  );
}

function DescricaoAutocompleteCell({
  value,
  onChange,
  onPick,
  suggest,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (s: DescricaoSuggestion) => void;
  suggest: (q: string) => Promise<DescricaoSuggestion[]>;
}) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<DescricaoSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = value.trim();
    if (!q) { setOpts([]); setOpen(false); return; }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await suggest(q);
        if (!cancelled) { setOpts(r.slice(0, 12)); setOpen(r.length > 0); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 180);
    return () => { cancelled = true; clearTimeout(t); };
  }, [value, suggest]);

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => { if (opts.length > 0) setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="w-full h-8 bg-transparent border-0 outline-none px-1.5 text-[12px] focus:bg-yellow-50"
        placeholder="Digite para buscar na Base MP..."
      />
      {open && (
        <div className="absolute z-50 left-0 right-0 top-full mt-0.5 max-h-64 overflow-y-auto rounded-md border border-border bg-popover text-popover-foreground shadow-lg text-[12px]">
          {loading && <div className="px-2 py-1 text-muted-foreground">Buscando...</div>}
          {!loading && opts.map((o, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onPick(o); setOpen(false); }}
              className="w-full text-left px-2 py-1.5 border-b last:border-b-0 border-border/60 hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
            >
              <div className="font-medium truncate">{o.descricao}</div>
              {o.unidade && <div className="text-[10px] text-muted-foreground">Unid.: {o.unidade}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
