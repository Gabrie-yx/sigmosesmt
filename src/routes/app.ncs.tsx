import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle, Plus, Search, ShieldAlert, CheckCircle2, Clock, XCircle,
  FileDown, Printer, Trash2, FileText, User, Wrench, ClipboardCheck, Pencil, Ban,
} from "lucide-react";
import { toast } from "sonner";
import { generateTNCPdf, type NCData } from "@/lib/nc-tnc-pdf";
import { PDFPreviewDialog } from "@/components/pdf-preview-dialog";
import type jsPDF from "jspdf";
import { Eye } from "lucide-react";

type Search = { titulo?: string; origem?: string; severidade?: string; descricao?: string; pendencia?: string };

export const Route = createFileRoute("/app/ncs")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    titulo: s.titulo as string | undefined,
    origem: s.origem as string | undefined,
    severidade: s.severidade as string | undefined,
    descricao: s.descricao as string | undefined,
    pendencia: s.pendencia as string | undefined,
  }),
  component: NCsPage,
});

const SEV_STYLES: Record<string, string> = {
  BAIXA: "bg-slate-100 text-slate-700 border-slate-200",
  MEDIA: "bg-amber-100 text-amber-700 border-amber-200",
  ALTA: "bg-orange-100 text-orange-700 border-orange-200",
  CRITICA: "bg-red-100 text-red-700 border-red-200",
};
const STATUS_STYLES: Record<string, string> = {
  ABERTA: "bg-red-100 text-red-700 border-red-200",
  EM_ANALISE: "bg-amber-100 text-amber-700 border-amber-200",
  EM_TRATAMENTO: "bg-blue-100 text-blue-700 border-blue-200",
  CONCLUIDA: "bg-emerald-100 text-emerald-700 border-emerald-200",
  CANCELADA: "bg-slate-100 text-slate-500 border-slate-200",
};

type Acao = { acao: string; responsavel: string; prazo: string };

const EMPTY_FORM = {
  // Identificação (Emitente)
  titulo: "", descricao: "", origem: "AUDITORIA", severidade: "MEDIA", status: "ABERTA",
  data_identificacao: new Date().toISOString().slice(0, 10),
  data_limite: "",
  emitente: "", departamento: "SESMT", enviado_para: "",
  classificacao: "Não Conformidade", requisito: "", norma: "ISO 9001:2015",
  reincidente: false, abrangencia: "",
  pendencia_origem: "" as string | null,
  // Tratativa (Receptor)
  porques: { p1: "", p2: "", p3: "", p4: "", p5: "" },
  acoes_imediatas_lista: [] as Acao[],
  acoes_corretivas_lista: [] as Acao[],
  acoes_implementadas: null as boolean | null,
  data_implementacao: "", novo_prazo: "", comentarios_implementacao: "",
  // SGI
  prazo_verificacao_eficacia: "",
  eficaz: null as boolean | null,
  comentarios_eficacia: "",
  data_fechamento: "", responsavel_fechamento: "",
};

function NCsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const search = useSearch({ from: "/app/ncs" });
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [pdfDoc, setPdfDoc] = useState<jsPDF | null>(null);
  const [pdfName, setPdfName] = useState<string>("");
  const [pdfOpen, setPdfOpen] = useState(false);

  async function previewTNC(nc: NCData) {
    try {
      const doc = await generateTNCPdf(nc);
      setPdfDoc(doc);
      setPdfName(`TNC-${nc.numero ?? "rascunho"}.pdf`);
      setPdfOpen(true);
    } catch (e: any) {
      toast.error("Erro ao gerar PDF: " + (e?.message ?? "desconhecido"));
    }
  }
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  // Pré-preenchimento via querystring (vindo de "Abrir NC" das pendências)
  useEffect(() => {
    if (search.titulo || search.descricao || search.origem || search.severidade) {
      setForm({
        ...EMPTY_FORM,
        titulo: search.titulo ?? "",
        descricao: search.descricao ?? "",
        origem: search.origem ?? "AUDITORIA",
        severidade: search.severidade ?? "ALTA",
        pendencia_origem: search.pendencia ?? null,
      });
      setEditing(null);
      setOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["ncs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("nao_conformidades")
        .select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  function openNew() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setOpen(true);
  }

  function openEdit(nc: any) {
    setEditing(nc);
    setForm({
      ...EMPTY_FORM,
      ...nc,
      data_identificacao: nc.data_identificacao ?? "",
      data_limite: nc.data_limite ?? "",
      data_implementacao: nc.data_implementacao ?? "",
      novo_prazo: nc.novo_prazo ?? "",
      prazo_verificacao_eficacia: nc.prazo_verificacao_eficacia ?? "",
      data_fechamento: nc.data_fechamento ?? "",
      porques: nc.porques ?? { p1: "", p2: "", p3: "", p4: "", p5: "" },
      acoes_imediatas_lista: nc.acoes_imediatas_lista ?? [],
      acoes_corretivas_lista: nc.acoes_corretivas_lista ?? [],
    });
    setOpen(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!form.titulo.trim()) throw new Error("Informe o título");
      const payload: any = {
        titulo: form.titulo,
        descricao: form.descricao || null,
        origem: form.origem,
        severidade: form.severidade,
        status: form.status,
        data_identificacao: form.data_identificacao || null,
        data_limite: form.data_limite || null,
        emitente: form.emitente || null,
        departamento: form.departamento || null,
        enviado_para: form.enviado_para || null,
        classificacao: form.classificacao,
        requisito: form.requisito || null,
        norma: form.norma,
        reincidente: !!form.reincidente,
        abrangencia: form.abrangencia || null,
        porques: form.porques,
        acoes_imediatas_lista: form.acoes_imediatas_lista,
        acoes_corretivas_lista: form.acoes_corretivas_lista,
        acoes_implementadas: form.acoes_implementadas,
        data_implementacao: form.data_implementacao || null,
        novo_prazo: form.novo_prazo || null,
        comentarios_implementacao: form.comentarios_implementacao || null,
        prazo_verificacao_eficacia: form.prazo_verificacao_eficacia || null,
        eficaz: form.eficaz,
        comentarios_eficacia: form.comentarios_eficacia || null,
        data_fechamento: form.data_fechamento || null,
        responsavel_fechamento: form.responsavel_fechamento || null,
        pendencia_origem: form.pendencia_origem || null,
      };
      if (editing) {
        const { error } = await supabase.from("nao_conformidades").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        payload.created_by = user?.id ?? null;
        const { error } = await supabase.from("nao_conformidades").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "TNC atualizada" : "TNC registrada");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["ncs"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("nao_conformidades").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("TNC excluída");
      qc.invalidateQueries({ queryKey: ["ncs"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("nao_conformidades")
        .update({ status: "CANCELADA" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("TNC cancelada (histórico preservado)");
      qc.invalidateQueries({ queryKey: ["ncs"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const filtered = useMemo(() => {
    const s = busca.trim().toLowerCase();
    if (!s) return items;
    return items.filter((i: any) =>
      i.titulo?.toLowerCase().includes(s) ||
      i.descricao?.toLowerCase().includes(s) ||
      i.numero?.toLowerCase().includes(s));
  }, [items, busca]);

  const stats = useMemo(() => ({
    total: items.length,
    abertas: items.filter((i: any) => i.status === "ABERTA").length,
    tratamento: items.filter((i: any) => i.status === "EM_TRATAMENTO" || i.status === "EM_ANALISE").length,
    concluidas: items.filter((i: any) => i.status === "CONCLUIDA").length,
  }), [items]);

  // ---- helpers de ações dinâmicas ----
  function addAcao(key: "acoes_imediatas_lista" | "acoes_corretivas_lista") {
    setForm((f) => ({ ...f, [key]: [...f[key], { acao: "", responsavel: "", prazo: "" }] }));
  }
  function updAcao(key: "acoes_imediatas_lista" | "acoes_corretivas_lista", idx: number, patch: Partial<Acao>) {
    setForm((f) => ({ ...f, [key]: f[key].map((a, i) => (i === idx ? { ...a, ...patch } : a)) }));
  }
  function removeAcao(key: "acoes_imediatas_lista" | "acoes_corretivas_lista", idx: number) {
    setForm((f) => ({ ...f, [key]: f[key].filter((_, i) => i !== idx) }));
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-red-600" /> Tratativa de Não Conformidades — TNC
          </h1>
          <p className="text-sm text-slate-500">
            FORCP-SGI-05 · ISO 9001:2015 — ciclo PDCA <strong>AGIR</strong>
          </p>
        </div>
        <Button onClick={openNew} className="bg-red-700 hover:bg-red-800">
          <Plus className="h-4 w-4 mr-1" /> Nova TNC
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4"><div className="flex items-center justify-between"><div><div className="text-xs text-slate-500">Total</div><div className="text-2xl font-bold">{stats.total}</div></div><AlertTriangle className="h-7 w-7 text-slate-400" /></div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center justify-between"><div><div className="text-xs text-slate-500">Abertas</div><div className="text-2xl font-bold text-red-600">{stats.abertas}</div></div><XCircle className="h-7 w-7 text-red-400" /></div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center justify-between"><div><div className="text-xs text-slate-500">Em tratamento</div><div className="text-2xl font-bold text-blue-600">{stats.tratamento}</div></div><Clock className="h-7 w-7 text-blue-400" /></div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center justify-between"><div><div className="text-xs text-slate-500">Concluídas</div><div className="text-2xl font-bold text-emerald-600">{stats.concluidas}</div></div><CheckCircle2 className="h-7 w-7 text-emerald-400" /></div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Registros</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
            <Input placeholder="Buscar por nº, título..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-8" />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="text-sm text-slate-500">Carregando...</div> :
            filtered.length === 0 ? <div className="text-sm text-slate-500 text-center py-8">Nenhuma não conformidade registrada.</div> :
            <div className="space-y-2">
              {filtered.map((i: any) => (
                <div key={i.id} className="border rounded-lg p-3 hover:bg-slate-50 transition">
                  <div className="flex items-start justify-between gap-3">
                    <button onClick={() => openEdit(i)} className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-2 flex-wrap">
                        {i.numero && <span className="text-xs font-mono font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded">{i.numero}</span>}
                        <span className="font-semibold text-slate-900">{i.titulo}</span>
                      </div>
                      {i.descricao && <div className="text-xs text-slate-500 line-clamp-2 mt-1">{i.descricao}</div>}
                      <div className="text-[11px] text-slate-400 mt-1">
                        Aberta em {new Date(i.data_identificacao).toLocaleDateString("pt-BR")}
                        {i.data_limite && ` · prazo ${new Date(i.data_limite).toLocaleDateString("pt-BR")}`}
                        {i.emitente && ` · emitente ${i.emitente}`}
                        {i.requisito && ` · req. ${i.requisito}`}
                        {i.pendencia_origem && ` · origem: pendência [${i.pendencia_origem}]`}
                      </div>
                    </button>
                    <div className="flex items-start gap-1 shrink-0">
                      <Badge variant="outline" className={SEV_STYLES[i.severidade]}>{i.severidade}</Badge>
                      <Badge variant="outline" className={STATUS_STYLES[i.status]}>{i.status.replace("_", " ")}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-2 pt-2 border-t border-slate-100">
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-blue-700 hover:text-blue-800 hover:bg-blue-50" onClick={() => previewTNC(i as NCData)}>
                      <Eye className="h-3.5 w-3.5 mr-1" /> Visualizar PDF
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-100" onClick={() => openEdit(i)}>
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                    </Button>
                    {i.status !== "CANCELADA" && i.status !== "CONCLUIDA" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-amber-700 hover:text-amber-800 hover:bg-amber-50"
                        onClick={() => { if (confirm(`Cancelar TNC "${i.titulo}"?\n\nO registro será mantido no histórico marcado como Cancelada.`)) cancel.mutate(i.id); }}
                      >
                        <Ban className="h-3.5 w-3.5 mr-1" /> Cancelar
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 ml-auto" onClick={() => { if (confirm(`Excluir definitivamente a TNC "${i.titulo}"?\n\nEsta ação não pode ser desfeita. Para preservar o histórico, prefira "Cancelar".`)) del.mutate(i.id); }}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          }
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-red-700" />
              {editing ? `Editar TNC ${editing.numero ?? ""}` : "Nova Tratativa de Não Conformidade"}
            </DialogTitle>
          </DialogHeader>

          {form.pendencia_origem && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded p-2">
              ⚡ Esta TNC foi gerada a partir da pendência <strong>{form.pendencia_origem}</strong> detectada pelo sistema.
            </div>
          )}

          <Tabs defaultValue="emitente" className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-14 bg-gradient-to-r from-rose-50 via-white to-rose-50 p-1.5 rounded-xl border border-rose-200/70 shadow-inner">
              <TabsTrigger
                value="emitente"
                className="group h-11 gap-2 font-semibold text-slate-600 transition-all duration-300 rounded-lg hover:text-[#7B1E2B] data-[state=active]:bg-gradient-to-br data-[state=active]:from-[#7B1E2B] data-[state=active]:to-[#A03344] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-rose-900/30 data-[state=active]:scale-[1.02]"
              >
                <User className="h-4 w-4 transition-transform group-data-[state=active]:scale-110" /> Emitente
              </TabsTrigger>
              <TabsTrigger
                value="receptor"
                className="group h-11 gap-2 font-semibold text-slate-600 transition-all duration-300 rounded-lg hover:text-[#7B1E2B] data-[state=active]:bg-gradient-to-br data-[state=active]:from-[#7B1E2B] data-[state=active]:to-[#A03344] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-rose-900/30 data-[state=active]:scale-[1.02]"
              >
                <Wrench className="h-4 w-4 transition-transform group-data-[state=active]:scale-110" /> Receptor (Tratativa)
              </TabsTrigger>
              <TabsTrigger
                value="sgi"
                className="group h-11 gap-2 font-semibold text-slate-600 transition-all duration-300 rounded-lg hover:text-[#7B1E2B] data-[state=active]:bg-gradient-to-br data-[state=active]:from-[#7B1E2B] data-[state=active]:to-[#A03344] data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-rose-900/30 data-[state=active]:scale-[1.02]"
              >
                <ClipboardCheck className="h-4 w-4 transition-transform group-data-[state=active]:scale-110" /> SGI (Eficácia)
              </TabsTrigger>
            </TabsList>

            {/* ============ ABA EMITENTE ============ */}
            <TabsContent value="emitente" className="pt-4">
              <div className="rounded-xl border-2 border-rose-200 bg-gradient-to-br from-rose-50/70 via-white to-rose-50/50 p-5 shadow-md space-y-3">
                <div className="flex items-center gap-2 pb-3 mb-1 -mx-5 -mt-5 px-5 pt-4 rounded-t-xl bg-gradient-to-r from-[#7B1E2B] to-[#A03344] text-white">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold tracking-wide text-[#7B1E2B] shadow">
                    <User className="h-3 w-3" /> EMITENTE
                  </span>
                  <span className="text-xs font-medium text-white/95">Identificação e descrição do problema</span>
                </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Emitente</Label><Input value={form.emitente} onChange={(e) => setForm({ ...form, emitente: e.target.value })} placeholder="Nome de quem abriu" /></div>
                <div><Label>Departamento</Label><Input value={form.departamento} onChange={(e) => setForm({ ...form, departamento: e.target.value })} /></div>
                <div><Label>Data de abertura</Label><Input type="date" value={form.data_identificacao} onChange={(e) => setForm({ ...form, data_identificacao: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Enviado para</Label><Input value={form.enviado_para} onChange={(e) => setForm({ ...form, enviado_para: e.target.value })} placeholder="Responsável tratativa" /></div>
                <div>
                  <Label>Origem da ocorrência</Label>
                  <Select value={form.origem} onValueChange={(v) => setForm({ ...form, origem: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AUDITORIA">Auditoria Interna</SelectItem>
                      <SelectItem value="AUDITORIA_EXTERNA">Auditoria Externa</SelectItem>
                      <SelectItem value="INSPECAO">Inspeção</SelectItem>
                      <SelectItem value="INCIDENTE">Incidente</SelectItem>
                      <SelectItem value="CLIENTE">Cliente</SelectItem>
                      <SelectItem value="SISTEMA">Detectado pelo Sistema</SelectItem>
                      <SelectItem value="OUTRO">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Classificação</Label>
                  <Select value={form.classificacao} onValueChange={(v) => setForm({ ...form, classificacao: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Não Conformidade">Não Conformidade</SelectItem>
                      <SelectItem value="Observação">Observação</SelectItem>
                      <SelectItem value="Oportunidade de Melhoria">Oportunidade de Melhoria</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div><Label>Requisito</Label><Input value={form.requisito} onChange={(e) => setForm({ ...form, requisito: e.target.value })} placeholder="Ex: 8.1 / 9.1.1" /></div>
                <div><Label>Norma</Label><Input value={form.norma} onChange={(e) => setForm({ ...form, norma: e.target.value })} /></div>
                <div><Label>Reincidente?</Label>
                  <Select value={form.reincidente ? "S" : "N"} onValueChange={(v) => setForm({ ...form, reincidente: v === "S" })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="N">Não</SelectItem><SelectItem value="S">Sim</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label>Severidade</Label>
                  <Select value={form.severidade} onValueChange={(v) => setForm({ ...form, severidade: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BAIXA">Baixa</SelectItem><SelectItem value="MEDIA">Média</SelectItem>
                      <SelectItem value="ALTA">Alta</SelectItem><SelectItem value="CRITICA">Crítica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Título *</Label><Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} /></div>
              <div><Label>2 — Descrição do problema</Label><Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={3} /></div>
              </div>
            </TabsContent>

            {/* ============ ABA RECEPTOR ============ */}
            <TabsContent value="receptor" className="pt-4">
              <div className="rounded-xl border-2 border-amber-200 bg-gradient-to-br from-amber-50/70 via-white to-orange-50/50 p-5 shadow-md space-y-4">
                <div className="flex items-center gap-2 pb-3 mb-1 -mx-5 -mt-5 px-5 pt-4 rounded-t-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold tracking-wide text-amber-700 shadow">
                    <Wrench className="h-3 w-3" /> RECEPTOR
                  </span>
                  <span className="text-xs font-medium text-white/95">Abrangência, ações imediatas e análise da causa raiz</span>
                </div>
              <div>
                <Label className="text-sm font-bold">3 — Abrangência da não conformidade</Label>
                <Textarea className="mt-2" value={form.abrangencia} onChange={(e) => setForm({ ...form, abrangencia: e.target.value })} rows={2} placeholder="Quais áreas/processos são afetados?" />
              </div>

              <div>
                <Label className="text-sm font-bold">4 — Ações Imediatas</Label>
                <div className="space-y-2 mt-2">
                  {form.acoes_imediatas_lista.map((a, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-6"><Input placeholder="Ação" value={a.acao} onChange={(e) => updAcao("acoes_imediatas_lista", idx, { acao: e.target.value })} /></div>
                      <div className="col-span-3"><Input placeholder="Responsável" value={a.responsavel} onChange={(e) => updAcao("acoes_imediatas_lista", idx, { responsavel: e.target.value })} /></div>
                      <div className="col-span-2"><Input placeholder="dd/mm/aaaa ou texto" value={a.prazo} onChange={(e) => updAcao("acoes_imediatas_lista", idx, { prazo: e.target.value })} /></div>
                      <Button size="icon" variant="ghost" className="col-span-1 text-red-600" onClick={() => removeAcao("acoes_imediatas_lista", idx)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" onClick={() => addAcao("acoes_imediatas_lista")}><Plus className="h-3.5 w-3.5 mr-1" /> Adicionar ação imediata</Button>
                </div>
              </div>

              <div>
                <Label className="text-sm font-bold">5 — Análise da Causa Raiz (5 Porquês)</Label>
                <div className="space-y-2 mt-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <div key={n} className="grid grid-cols-12 gap-2 items-center">
                      <Label className="col-span-2 text-right text-xs">{n}º Por quê?</Label>
                      <Input className="col-span-10" value={(form.porques as any)[`p${n}`] ?? ""} onChange={(e) => setForm({ ...form, porques: { ...form.porques, [`p${n}`]: e.target.value } })} />
                    </div>
                  ))}
                </div>
                <div className="mt-2 inline-flex items-start gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-[11px] font-medium text-blue-700 ring-1 ring-blue-200">
                  <span className="font-bold">Obs.:</span>
                  <span>pode utilizar anexos e relatórios complementares caso os campos deste formulário não sejam suficientes.</span>
                </div>
              </div>

              </div>
            </TabsContent>

            {/* ============ ABA SGI ============ */}
            <TabsContent value="sgi" className="pt-4">
              <div className="rounded-xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/50 p-5 shadow-md space-y-3">
                <div className="flex items-center gap-2 pb-3 mb-1 -mx-5 -mt-5 px-5 pt-4 rounded-t-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold tracking-wide text-emerald-700 shadow">
                    <ClipboardCheck className="h-3 w-3" /> EMITENTE / RECEPTOR / SGI
                  </span>
                  <span className="text-xs font-medium text-white/95">Ações corretivas, verificação da eficácia e fechamento</span>
                </div>

                <div>
                  <Label className="text-sm font-bold">6 — Ações Corretivas</Label>
                  <div className="space-y-2 mt-2">
                    {form.acoes_corretivas_lista.map((a, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-6"><Input placeholder="Ação corretiva" value={a.acao} onChange={(e) => updAcao("acoes_corretivas_lista", idx, { acao: e.target.value })} /></div>
                        <div className="col-span-3"><Input placeholder="Responsável" value={a.responsavel} onChange={(e) => updAcao("acoes_corretivas_lista", idx, { responsavel: e.target.value })} /></div>
                        <div className="col-span-2"><Input placeholder="dd/mm/aaaa ou texto" value={a.prazo} onChange={(e) => updAcao("acoes_corretivas_lista", idx, { prazo: e.target.value })} /></div>
                        <Button size="icon" variant="ghost" className="col-span-1 text-red-600" onClick={() => removeAcao("acoes_corretivas_lista", idx)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}
                    <Button size="sm" variant="outline" onClick={() => addAcao("acoes_corretivas_lista")}><Plus className="h-3.5 w-3.5 mr-1" /> Adicionar ação corretiva</Button>
                  </div>
                </div>

              <div className="grid grid-cols-3 gap-3">
                <div><Label>As ações foram implementadas?</Label>
                  <Select value={form.acoes_implementadas == null ? "" : form.acoes_implementadas ? "S" : "N"} onValueChange={(v) => setForm({ ...form, acoes_implementadas: v === "" ? null : v === "S" })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent><SelectItem value="S">Sim</SelectItem><SelectItem value="N">Não</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label>Data implementação</Label><Input placeholder="dd/mm/aaaa ou texto" value={form.data_implementacao} onChange={(e) => setForm({ ...form, data_implementacao: e.target.value })} /></div>
                <div><Label>Novo prazo (se houver)</Label><Input placeholder="dd/mm/aaaa ou texto" value={form.novo_prazo} onChange={(e) => setForm({ ...form, novo_prazo: e.target.value })} /></div>
              </div>
              <div><Label>Comentários sobre implementação</Label><Textarea value={form.comentarios_implementacao} onChange={(e) => setForm({ ...form, comentarios_implementacao: e.target.value })} rows={2} /></div>

              <div className="grid grid-cols-2 gap-3">
                <div><Label>7 — Prazo para verificação da eficácia</Label><Input placeholder="dd/mm/aaaa ou texto" value={form.prazo_verificacao_eficacia} onChange={(e) => setForm({ ...form, prazo_verificacao_eficacia: e.target.value })} /></div>
                <div><Label>A ação corretiva foi eficaz?</Label>
                  <Select value={form.eficaz == null ? "" : form.eficaz ? "S" : "N"} onValueChange={(v) => setForm({ ...form, eficaz: v === "" ? null : v === "S" })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent><SelectItem value="S">Sim, eficaz</SelectItem><SelectItem value="N">Não, reabrir</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Comentários da verificação</Label><Textarea value={form.comentarios_eficacia} onChange={(e) => setForm({ ...form, comentarios_eficacia: e.target.value })} rows={3} /></div>
              <div><Label>Status final</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ABERTA">Aberta</SelectItem>
                    <SelectItem value="EM_ANALISE">Em análise</SelectItem>
                    <SelectItem value="EM_TRATAMENTO">Em tratamento</SelectItem>
                    <SelectItem value="CONCLUIDA">Concluída</SelectItem>
                    <SelectItem value="CANCELADA">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                <div><Label>Data de fechamento</Label><Input type="date" value={form.data_fechamento} onChange={(e) => setForm({ ...form, data_fechamento: e.target.value })} /></div>
                <div><Label>Responsável pelo fechamento</Label><Input value={form.responsavel_fechamento} onChange={(e) => setForm({ ...form, responsavel_fechamento: e.target.value })} /></div>
              </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="gap-2 sm:gap-2">
            {editing && (
              <>
                <Button variant="outline" onClick={() => previewTNC({ ...editing, ...form } as NCData)}>
                  <Eye className="h-4 w-4 mr-1" /> Visualizar PDF
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending} className="bg-red-700 hover:bg-red-800">
              {editing ? "Atualizar" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PDFPreviewDialog
        open={pdfOpen}
        onClose={() => setPdfOpen(false)}
        doc={pdfDoc}
        fileName={pdfName}
        title="Visualizar TNC"
      />
    </div>
  );
}