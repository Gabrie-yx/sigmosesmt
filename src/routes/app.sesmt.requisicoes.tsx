import { createFileRoute, useLocation } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
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
  ShoppingCart, Plus, FileDown, Printer, Check, X as XIcon, Trash2, Eye, Filter, Pencil, Link2,
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
import { SignatureGallery } from "@/components/signature-gallery";
import { Wizard, type WizardStep } from "@/components/wizard";
import { useDraftAutosave } from "@/hooks/use-draft-autosave";
import { deleteDraft, loadDraft } from "@/lib/draft-store";
import { printPdf } from "@/lib/pdf-print";

export const Route = createFileRoute("/app/sesmt/requisicoes")({
  component: RequisicoesPage,
});

type Status = "PENDENTE" | "COTADA" | "APROVADA" | "INDEFERIDA";
type Classe = "MATERIAL" | "SERVICO";

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
  status_token?: string | null;
  cotacao_at?: string | null;
  cotador_nome?: string | null;
  cotacao_fornecedor?: string | null;
  cotacao_valor?: number | null;
};

const STATUS_BADGE: Record<Status, string> = {
  PENDENTE: "bg-amber-100 text-amber-800 border-amber-300",
  COTADA: "bg-blue-100 text-blue-800 border-blue-300",
  APROVADA: "bg-emerald-100 text-emerald-800 border-emerald-300",
  INDEFERIDA: "bg-rose-100 text-rose-800 border-rose-300",
};

const STATUS_LABEL: Record<Status, string> = {
  PENDENTE: "Em andamento",
  COTADA: "Cotada",
  APROVADA: "Deferida",
  INDEFERIDA: "Indeferida",
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

async function gerarPdfRequisicao(req: Req, itens: Item[], mode: PrintMode = "download") {
  const { JsPDF, autoTable } = await loadPdfLibs();
  const doc = new JsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 10;
  const logo = await logoDataUrl();

  // Cabeçalho
  doc.setLineWidth(0.4);
  doc.rect(M, M, W - 2 * M, 24); // Aumentei a altura de 22 para 24
  if (logo) {
    try { doc.addImage(logo, "PNG", M + 2, M + 3, 28, 18); } catch { /* noop */ }
  }
  
  // Bloco código
  const codX = W - M - 55;
  doc.line(codX, M, codX, M + 24);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  doc.text(`CÓD. FOR-COMP: ${req.codigo_formulario ?? "03"}`, codX + 2, M + 5);
  doc.text(`REVISÃO: ${req.revisao ?? "01"}`, codX + 2, M + 10);
  doc.text(`DATA: ${fmtBR(req.data_revisao) || fmtBR(req.data_requisicao)}`, codX + 2, M + 15);
  doc.text(`PAG.: ${req.pagina ?? "01/01"}`, codX + 2, M + 20);

  // Títulos centrais
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("REQUISIÇÃO DE COMPRA DE MATERIAIS E SERVIÇOS", M + 35, M + 8, { maxWidth: W - 2 * M - 95 });
  
  if (req.titulo) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.setTextColor(180, 0, 0); // Tom de vermelho para destacar o título da requisição
    doc.text(req.titulo.toUpperCase(), M + 35, M + 19, { maxWidth: W - 2 * M - 95 });
    doc.setTextColor(0, 0, 0); // Volta para preto
  }

  // Linhas de cabeçalho do formulário
  let y = M + 24;
  const rowH = 7;
  const halfW = (W - 2 * M) / 2;

  const drawSplitRow = (l1: string, v1: string, l2: string, v2: string) => {
    doc.rect(M, y, halfW, rowH); doc.rect(M + halfW, y, halfW, rowH);
    doc.setFont("helvetica", "bold"); doc.setFontSize(8);
    doc.text(l1, M + 1.5, y + 4.5);
    doc.text(l2, M + halfW + 1.5, y + 4.5);
    doc.setFont("helvetica", "normal");
    doc.text(v1, M + 1.5 + doc.getTextWidth(l1) + 2, y + 4.5);
    doc.text(v2, M + halfW + 1.5 + doc.getTextWidth(l2) + 2, y + 4.5);
    y += rowH;
  };

  const cls = req.classificacao === "MATERIAL" ? "MATERIAL (X) SERVIÇO ( )" : "MATERIAL ( ) SERVIÇO (X)";
  drawSplitRow("CLASSIFICAÇÃO DO PEDIDO:", cls, "DATA:", fmtBR(req.data_requisicao));
  drawSplitRow("SOLICITANTE:", req.solicitante || "", "Nº DA REQUISIÇÃO:", req.numero || "");
  drawSplitRow("SETOR:", req.setor || "", "FORNECEDOR:", req.fornecedor || "");
  drawSplitRow("OBRA EM CONSTRUÇÃO:", req.obra_construcao || "", "OBRA EM MANUTENÇÃO:", req.obra_manutencao || "");

  // Tabela de itens
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 1.8, lineColor: [0,0,0], lineWidth: 0.3, minCellHeight: 7 },
    headStyles: { fillColor: [255,255,255], textColor: [0,0,0], fontStyle: "bold", halign: "center" },
    columnStyles: {
      0: { cellWidth: 14, halign: "center" },
      1: { cellWidth: 95 },
      2: { cellWidth: 18, halign: "center" },
      3: { cellWidth: 18, halign: "center" },
      4: { cellWidth: "auto" },
    },
    head: [["ITEM","DESCRIÇÃO COMPLETA DO MATERIAL OU SERVIÇO","QTDE","UNID.","OBSERVAÇÃO"]],
    body: itens.map((i) => [
      String(i.item_numero).padStart(2,"0"),
      i.descricao || "",
      i.quantidade || "",
      i.unidade || "",
      i.observacao || "",
    ]),
  });

  // Assinaturas
  let finalY = (doc as any).lastAutoTable.finalY + 8;
  if (finalY > 245) {
    doc.addPage();
    finalY = M;
  }
  const colW = (W - 2 * M) / 3;
  const sigH = 22;
  // Pré-carrega a assinatura para usar a proporção real (sem distorcer)
  let sigDims: { w: number; h: number } | null = null;
  if (req.signature_solicitante) {
    try {
      sigDims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = reject;
        img.src = req.signature_solicitante as string;
      });
    } catch (e) {
      console.warn("Falha ao carregar assinatura:", e);
    }
  }

  ["ASSINATURA SOLICITANTE","ASSINATURA SUPERVISOR GERAL","ASSINATURA ANALISTA DE COMPRAS"].forEach((label, idx) => {
    const x = M + idx * colW;
    doc.rect(x, finalY, colW, sigH);
    doc.setFont("helvetica","bold"); doc.setFontSize(8);
    doc.text(label, x + colW/2, finalY + 4, { align: "center" });
    doc.line(x, finalY + sigH - 6, x + colW, finalY + sigH - 6);
    doc.text("DATA:", x + 1.5, finalY + sigH - 1);
    if (idx === 0) {
      doc.setFont("helvetica", "normal");
      doc.text(fmtBR(req.data_requisicao), x + 13, finalY + sigH - 1);
      if (req.signature_solicitante) {
        try {
          // Área disponível para a assinatura (entre o título e a linha "DATA")
          const areaX = x + 2;
          const areaY = finalY + 5;
          const areaW = colW - 4;
          const areaH = sigH - 11; // ~11mm
          let drawW = areaW;
          let drawH = areaH;
          if (sigDims && sigDims.w > 0 && sigDims.h > 0) {
            const ratio = sigDims.w / sigDims.h;
            // Ajusta preservando proporção dentro da área
            drawH = areaH;
            drawW = drawH * ratio;
            if (drawW > areaW) {
              drawW = areaW;
              drawH = drawW / ratio;
            }
          }
          const drawX = areaX + (areaW - drawW) / 2;
          const drawY = areaY + (areaH - drawH) / 2;
          doc.addImage(req.signature_solicitante, "PNG", drawX, drawY, drawW, drawH, undefined, "FAST");
        } catch (e) {
          console.warn("Falha ao desenhar assinatura no PDF:", e);
        }
      }
    }
  });

  // Rodapé status
  doc.setFont("helvetica","bold"); doc.setFontSize(9);
  doc.text(`STATUS: ${STATUS_LABEL[req.status].toUpperCase()}`, M, finalY + sigH + 7);
  if (req.status === "INDEFERIDA" && req.motivo_indeferimento) {
    doc.setFont("helvetica","normal");
    doc.text(`Motivo: ${req.motivo_indeferimento}`, M, finalY + sigH + 12, { maxWidth: W - 2*M });
  }

  const fileName = `requisicao-${req.numero || req.id.slice(0,8)}.pdf`;

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

  // Se houver rascunho na URL (?draft=true), abre o modal automaticamente
  useEffect(() => {
    if ((location.search as any).draft === "true") {
      setOpenNew(true);
      // Limpa a URL para não reabrir ao navegar de volta
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [location.search.draft]);
  const [tab, setTab] = useState<"todas" | Status>("todas");
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
      const { error } = await supabase
        .from("purchase_requisitions")
        .update({
          status: p.status,
          motivo_indeferimento: p.status === "INDEFERIDA" ? (p.motivo || "") : null,
          approved_by: user?.id ?? null,
          approved_at: new Date().toISOString(),
        })
        .eq("id", p.id);
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
    await gerarPdfRequisicao(r, itens, mode);
  }

  function periodoLabel() {
    if (filtroPeriodo === "all") return "Todos";
    if (filtroPeriodo === "week") return "Última semana";
    if (filtroPeriodo === "month") return "Último mês";
    return "Último ano";
  }

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
              ) : (
                <div className="space-y-2">
                  {filtered.map((r) => (
                    <div key={r.id} className="border rounded-lg p-3 hover:bg-slate-50 transition flex flex-wrap items-center gap-3">
                      <div className="flex-1 min-w-[220px]">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900">Nº {r.numero}</span>
                          {r.titulo && <span className="font-semibold text-red-800 ml-1">— {r.titulo}</span>}
                          <Badge variant="outline" className={STATUS_BADGE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                          <Badge variant="outline" className="text-[10px]">{r.classificacao === "MATERIAL" ? "Material" : "Serviço"}</Badge>
                        </div>
                        <div className="text-xs text-slate-700 mt-1">
                          {fmtBR(r.data_requisicao)} · <strong>{r.solicitante}</strong>
                          {r.setor ? ` · ${r.setor}` : ""}
                          {r.fornecedor ? ` · Fornecedor: ${r.fornecedor}` : ""}
                        </div>
                        {r.status === "INDEFERIDA" && r.motivo_indeferimento && (
                          <div className="text-xs text-rose-700 mt-1">Motivo: {r.motivo_indeferimento}</div>
                        )}
                        {(r.status === "COTADA" || r.status === "APROVADA") && r.cotacao_fornecedor && (
                          <div className="text-xs text-blue-700 mt-1">
                            Cotada por <strong>{r.cotador_nome ?? "—"}</strong> · {r.cotacao_fornecedor}
                            {r.cotacao_valor != null && (
                              <> · {Number(r.cotacao_valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {r.status_token && (
                          <Button
                            size="sm"
                            variant="outline"
                            title="Copiar link público de status"
                            onClick={() => {
                              const url = `${window.location.origin}/rc/${r.status_token}`;
                              navigator.clipboard.writeText(url).then(
                                () => toast.success("Link copiado! Cole no WhatsApp."),
                                () => toast.error("Não foi possível copiar"),
                              );
                            }}
                          >
                            <Link2 className="h-3.5 w-3.5 mr-1" /> Link
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => emitirPdf(r, "print")}>
                          <Printer className="h-3.5 w-3.5 mr-1" /> Imprimir
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => emitirPdf(r, "preview")}>
                          <Printer className="h-3.5 w-3.5 mr-1" /> PDF
                        </Button>
                        <ViewBtn req={r} />
                        {isEditor && <EditReqBtn req={r} userId={user?.id} />}
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
                          </>
                        )}
                        {isEditor && r.status !== "PENDENTE" && r.status !== "COTADA" && (
                          <Button size="sm" variant="ghost" onClick={() => updateStatus.mutate({ id: r.id, status: "PENDENTE" })}>
                            Reabrir
                          </Button>
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
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
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

function ReqFormDialog({
  onClose,
  userId,
  existing,
}: {
  onClose: () => void;
  userId?: string;
  existing?: Req;
}) {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const isEdit = !!existing;

  // Gera número automático apenas no modo de criação
  useEffect(() => {
    if (isEdit) return;
    (async () => {
      const now = new Date();
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const yyyy = String(now.getFullYear());
      const start = `${yyyy}-${mm}-01`;
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const end = endDate.toISOString().slice(0, 10);
      const { count } = await supabase
        .from("purchase_requisitions")
        .select("id", { count: "exact", head: true })
        .gte("data_requisicao", start)
        .lt("data_requisicao", end);
      const seq = String((count ?? 0) + 1).padStart(3, "0");
      const novo = `${seq}/${mm}/${yyyy}`;
      setForm((f) => ({ ...f, numero: novo }));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [form, setForm] = useState({
    numero: existing?.numero ?? "Gerando...",
    titulo: existing?.titulo ?? "",
    data_requisicao: existing?.data_requisicao ?? today,
    classificacao: (existing?.classificacao ?? "MATERIAL") as Classe,
    solicitante: existing?.solicitante ?? "",
    setor: existing?.setor ?? "",
    fornecedor: existing?.fornecedor ?? "",
    obra_construcao: existing?.obra_construcao ?? "",
    obra_manutencao: existing?.obra_manutencao ?? "",
    codigo_formulario: existing?.codigo_formulario ?? "FOR-COMP: 03",
    revisao: existing?.revisao ?? "01",
    data_revisao: existing?.data_revisao ?? today,
    pagina: existing?.pagina ?? "01/01",
    observacoes: existing?.observacoes ?? "",
  });
  const [itens, setItens] = useState<Item[]>(emptyItems());
  const [signature, setSignature] = useState<string | null>(() => {
    return existing?.signature_solicitante || localStorage.getItem("sigmo:last-user-signature") || null;
  });
  const [signatureHeight, setSignatureHeight] = useState<number>(existing?.signature_solicitante_height ?? 80);

  // === Autosave de rascunho (somente em modo de criação) ===
  const DRAFT_KEY = "requisicao-nova";
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
        signature_solicitante_height: signature ? signatureHeight : null,
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
            <FieldRow label="SETOR:" value={form.setor} onChange={(v) => setForm({ ...form, setor: v })} />
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
                <CellInput value={it.descricao} onChange={(v) => setItem(idx, "descricao", v)} />
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
            <EstoqueLookupSheet onPick={pickFromEstoque} triggerLabel="Consultar Estoque / CA" />
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
          <DialogTitle>{isEdit ? `Editar Requisição Nº ${existing?.numero}` : "Nova Requisição de Compra"}</DialogTitle>
          <EstoqueLookupSheet onPick={pickFromEstoque} triggerLabel="Consultar Estoque / CA" />
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
