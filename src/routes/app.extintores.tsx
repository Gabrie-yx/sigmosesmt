import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Plus, Printer, Search, ClipboardCheck, Flame, AlertTriangle, CheckCircle2,
  Pencil, Camera, Upload, ShieldCheck, CalendarClock, Activity, X, Sparkles, CalendarDays, Droplet,
} from "lucide-react";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/utils-date";
import { PDFPreviewDialog } from "@/components/pdf-preview-dialog";
import { SignaturePadDialog } from "@/components/signature-pad-dialog";
import { EXTINTORES_CHECKLIST_NC as CHECKLIST_NC, gerarPdfPlanilhaExtintores } from "@/lib/extintores-pdf";
import type jsPDF from "jspdf";

export const Route = createFileRoute("/app/extintores")({
  component: ExtintoresPage,
  head: () => ({ meta: [{ title: "Controle de Extintores · SIGMO" }] }),
});

const TIPOS = ["ABC", "BC", "A", "AP", "CO2", "PQS", "PQS_K", "OUTRO"] as const;
const STATUS = ["ATIVO", "EM_MANUTENCAO", "BAIXADO", "VENCIDO"] as const;

const STATUS_LABEL: Record<string, string> = {
  ATIVO: "Ativo", EM_MANUTENCAO: "Em manutenção", BAIXADO: "Baixado", VENCIDO: "Vencido",
};
const STATUS_STYLES: Record<string, string> = {
  ATIVO: "bg-emerald-100 text-emerald-700 border-emerald-300",
  EM_MANUTENCAO: "bg-amber-100 text-amber-700 border-amber-300",
  BAIXADO: "bg-slate-100 text-slate-500 border-slate-200",
  VENCIDO: "bg-red-100 text-red-700 border-red-300",
};

type Extintor = any;
type Inspecao = any;

function ExtintoresPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [fStatus, setFStatus] = useState<string>("TODOS");
  const [fArea, setFArea] = useState<string>("TODAS");
  const [novoOpen, setNovoOpen] = useState(false);
  const [editExt, setEditExt] = useState<Extintor | null>(null);
  const [inspecaoExt, setInspecaoExt] = useState<Extintor | null>(null);
  const [pdfDoc, setPdfDoc] = useState<jsPDF | null>(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [sigOpen, setSigOpen] = useState(false);

  const extintores = useQuery({
    queryKey: ["extintores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("extintores").select("*").order("numero");
      if (error) throw error;
      return (data ?? []) as Extintor[];
    },
  });

  const inspecoes = useQuery({
    queryKey: ["extintor-inspecoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("extintor_inspecoes").select("*").order("data_inspecao", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Inspecao[];
    },
  });

  const areas = useMemo(() => {
    const set = new Set<string>();
    (extintores.data ?? []).forEach((e) => e.area && set.add(e.area));
    return Array.from(set).sort();
  }, [extintores.data]);

  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

  const inspecoesMesPorExt = useMemo(() => {
    const map = new Map<string, Inspecao>();
    (inspecoes.data ?? []).forEach((i) => {
      const d = new Date(i.data_inspecao + "T00:00");
      if (d >= inicioMes && !map.has(i.extintor_id)) map.set(i.extintor_id, i);
    });
    return map;
  }, [inspecoes.data, inicioMes]);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (extintores.data ?? []).filter((e) => {
      if (fStatus !== "TODOS" && e.status !== fStatus) return false;
      if (fArea !== "TODAS" && e.area !== fArea) return false;
      if (!q) return true;
      return [e.numero, e.localizacao, e.area, e.numero_selo_inmetro, e.tipo_agente]
        .some((v) => (v ?? "").toString().toLowerCase().includes(q));
    });
  }, [extintores.data, busca, fStatus, fArea]);

  const stats = useMemo(() => {
    const all = extintores.data ?? [];
    const ativos = all.filter((e) => e.status === "ATIVO");
    const hojeISO = hoje.toISOString().slice(0, 10);
    const em30 = new Date(hoje); em30.setDate(em30.getDate() + 30);
    const em30ISO = em30.toISOString().slice(0, 10);
    const vencidos = ativos.filter((e) => e.proxima_recarga && e.proxima_recarga < hojeISO).length;
    const vencendo = ativos.filter((e) => e.proxima_recarga && e.proxima_recarga >= hojeISO && e.proxima_recarga <= em30ISO).length;
    const inspecionados = ativos.filter((e) => inspecoesMesPorExt.has(e.id)).length;
    const semInspecao = ativos.length - inspecionados;
    const pctInsp = ativos.length ? Math.round((inspecionados / ativos.length) * 100) : 0;
    return { total: all.length, ativos: ativos.length, vencidos, vencendo, semInspecao, inspecionados, pctInsp };
  }, [extintores.data, inspecoesMesPorExt]);

  const onInvalidate = () => {
    qc.invalidateQueries({ queryKey: ["extintores"] });
    qc.invalidateQueries({ queryKey: ["extintor-inspecoes"] });
  };

  const abrirPdfPlanilha = () => {
    if (extintores.isLoading || inspecoes.isLoading) {
      toast.info("Aguarde carregar os dados da planilha");
      return;
    }
    setSigOpen(true);
  };

  return (
    <div className="p-4 md:p-6 space-y-5 animate-fadeIn">
      {/* HERO HEADER */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-700 via-red-600 to-orange-500 text-white shadow-xl">
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -left-16 -bottom-16 h-56 w-56 rounded-full bg-amber-300/20 blur-3xl" />
        <div className="relative p-5 md:p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center ring-1 ring-white/30">
              <Flame className="h-7 w-7" />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/70">SESMT · NR-23 · NBR 12962</div>
              <h1 className="heading-display text-2xl md:text-3xl leading-tight">Controle de Extintores</h1>
              <div className="text-xs text-white/80 mt-0.5">Inventário, inspeções mensais e conformidade FOR-SFG 08</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" className="gap-2 bg-white text-red-700 hover:bg-white/90" onClick={abrirPdfPlanilha}>
              <Printer className="h-4 w-4" /> Visualizar PDF
            </Button>
            <Button asChild variant="secondary" className="gap-2 bg-white text-red-700 hover:bg-white/90">
              <Link to="/app/extintores-inspecao-foto"><Sparkles className="h-4 w-4" /> Inspeção por foto (IA)</Link>
            </Button>
            <Button onClick={() => setNovoOpen(true)} className="gap-2 bg-slate-900 hover:bg-slate-800 text-white">
              <Plus className="h-4 w-4" /> Novo extintor
            </Button>
          </div>
        </div>

        {/* Progresso de inspeções do mês */}
        <div className="relative px-5 md:px-6 pb-5">
          <div className="rounded-xl bg-white/10 backdrop-blur p-3 ring-1 ring-white/20">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider">
              <span className="flex items-center gap-2"><Activity className="h-3.5 w-3.5" /> Inspeções deste mês</span>
              <span className="tabular-nums">{stats.inspecionados}/{stats.ativos} · {stats.pctInsp}%</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-white/20 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-300 to-emerald-500 transition-all duration-700"
                style={{ width: `${stats.pctInsp}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi icon={ShieldCheck} label="Total" value={stats.total} tone="slate" />
        <Kpi icon={CheckCircle2} label="Ativos" value={stats.ativos} tone="green" />
        <Kpi icon={AlertTriangle} label="Recarga vencida" value={stats.vencidos} tone="red" pulse={stats.vencidos > 0} />
        <Kpi icon={CalendarClock} label="Vencendo 30d" value={stats.vencendo} tone="amber" />
        <Kpi icon={ClipboardCheck} label="Sem inspeção" value={stats.semInspecao} tone={stats.semInspecao > 0 ? "amber" : "green"} />
      </div>

      {/* Banner normativa NBR 12962 */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 via-white to-rose-50 shadow-sm">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-amber-500 via-orange-500 to-red-600" />
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-amber-200/40 blur-2xl" />
        <div className="relative flex flex-wrap items-center gap-4 p-4 pl-6">
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-amber-400 to-red-600 blur-md opacity-60" />
            <div className="relative h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-red-600 flex items-center justify-center ring-2 ring-white shadow-lg">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
          </div>
          <div className="flex-1 min-w-[240px]">
            <div className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-700">Normativa · ABNT NBR 12962</div>
            <div className="text-sm font-semibold text-slate-800 leading-snug">
              Rotina recomendada para extintores de incêndio
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2 shadow-sm">
              <ClipboardCheck className="h-4 w-4 text-emerald-700" />
              <div className="text-[11px] leading-tight">
                <div className="font-bold text-emerald-800 uppercase tracking-wide">Inspeção visual</div>
                <div className="text-emerald-700">Mensal</div>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50/80 px-3 py-2 shadow-sm">
              <CalendarDays className="h-4 w-4 text-sky-700" />
              <div className="text-[11px] leading-tight">
                <div className="font-bold text-sky-800 uppercase tracking-wide">Recarga</div>
                <div className="text-sky-700">Anual (12 meses)</div>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50/80 px-3 py-2 shadow-sm">
              <Droplet className="h-4 w-4 text-violet-700" />
              <div className="text-[11px] leading-tight">
                <div className="font-bold text-violet-800 uppercase tracking-wide">Teste hidrostático</div>
                <div className="text-violet-700">A cada 5 anos</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <Card className="border-slate-200/70">
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nº, localização, selo INMETRO…" className="pl-8" />
          </div>
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos status</SelectItem>
              {STATUS.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fArea} onValueChange={setFArea}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TODAS">Todas áreas</SelectItem>
              {areas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="w-[80px]">Nº</TableHead>
                <TableHead>Área</TableHead>
                <TableHead>Localização</TableHead>
                <TableHead className="w-[80px]">Tipo</TableHead>
                <TableHead className="w-[80px]">Carga</TableHead>
                <TableHead className="w-[120px]">Selo INMETRO</TableHead>
                <TableHead className="w-[110px]">Próx. recarga</TableHead>
                <TableHead className="w-[90px]">Hidrost.</TableHead>
                <TableHead className="w-[130px]">Inspeção mês</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[180px] text-right pr-4">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {extintores.isLoading && <TableRow><TableCell colSpan={11} className="text-center text-slate-400 py-8">Carregando…</TableCell></TableRow>}
              {!extintores.isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={11} className="text-center text-slate-400 py-8">Nenhum extintor encontrado.</TableCell></TableRow>
              )}
              {filtered.map((e) => {
                const insp = inspecoesMesPorExt.get(e.id);
                const vencido = e.proxima_recarga && e.proxima_recarga < hoje.toISOString().slice(0, 10);
                return (
                  <TableRow key={e.id} className="hover:bg-red-50/30 transition-colors">
                    <TableCell className="font-mono font-bold text-red-700">{e.numero}</TableCell>
                    <TableCell className="text-xs">{e.area}</TableCell>
                    <TableCell className="text-xs">{e.localizacao}</TableCell>
                    <TableCell className="text-xs font-semibold">{e.tipo_agente}</TableCell>
                    <TableCell className="text-xs">{e.carga_nominal ? `${e.carga_nominal} ${e.carga_unidade || "kg"}` : "—"}</TableCell>
                    <TableCell className="text-xs font-mono">{e.numero_selo_inmetro || "—"}</TableCell>
                    <TableCell className={`text-xs ${vencido ? "text-red-700 font-bold" : ""}`}>
                      {e.proxima_recarga ? formatDateBR(e.proxima_recarga) : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{e.proximo_teste_hidrostatico || "—"}</TableCell>
                    <TableCell>
                      {insp ? (
                        <Badge variant="outline" className={insp.conforme ? "bg-emerald-50 text-emerald-700 border-emerald-300" : "bg-red-50 text-red-700 border-red-300"}>
                          {insp.conforme ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
                          {formatDateBR(insp.data_inspecao)}
                          {insp.foto_path && <Camera className="h-3 w-3 ml-1" />}
                        </Badge>
                      ) : e.ultima_inspecao_em ? (
                        <Badge
                          variant="outline"
                          className={
                            e.ultimo_status_inspecao === "CONFORME"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                              : e.ultimo_status_inspecao === "PRECISA_REVISAO"
                              ? "bg-amber-50 text-amber-700 border-amber-300"
                              : "bg-red-50 text-red-700 border-red-300"
                          }
                          title={`Inspeção IA · ${e.ultimo_status_inspecao}`}
                        >
                          {e.ultimo_status_inspecao === "CONFORME"
                            ? <CheckCircle2 className="h-3 w-3 mr-1" />
                            : <AlertTriangle className="h-3 w-3 mr-1" />}
                          {formatDateBR(new Date(e.ultima_inspecao_em).toISOString().slice(0, 10))}
                          <Sparkles className="h-3 w-3 ml-1" />
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">Pendente</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_STYLES[e.status]}>{STATUS_LABEL[e.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditExt(e)} title="Editar">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" className="gap-1 h-7 bg-red-700 hover:bg-red-800" onClick={() => setInspecaoExt(e)}>
                          <ClipboardCheck className="h-3.5 w-3.5" /> Inspecionar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {novoOpen && (
        <ExtintorFormDialog
          open={novoOpen}
          onOpenChange={setNovoOpen}
          userId={user?.id}
          onSaved={onInvalidate}
        />
      )}
      {editExt && (
        <ExtintorFormDialog
          extintor={editExt}
          open={!!editExt}
          onOpenChange={(v) => !v && setEditExt(null)}
          userId={user?.id}
          onSaved={onInvalidate}
        />
      )}
      {inspecaoExt && (
        <InspecaoDialog
          extintor={inspecaoExt}
          open={!!inspecaoExt}
          onOpenChange={(v) => !v && setInspecaoExt(null)}
          userId={user?.id}
          onCreated={onInvalidate}
        />
      )}
      <PDFPreviewDialog
        open={pdfOpen}
        onClose={() => setPdfOpen(false)}
        doc={pdfDoc}
        fileName={`planilha-inspecao-extintores-${new Date().toISOString().slice(0, 10)}.pdf`}
        title="Planilha de Inspeção de Extintores"
      />
      <SignaturePadDialog
        open={sigOpen}
        onClose={() => setSigOpen(false)}
        title="Assinar planilha de inspeção"
        onConfirm={async (sig) => {
          const doc = await gerarPdfPlanilhaExtintores(extintores.data ?? [], inspecoes.data ?? [], sig);
          setPdfDoc(doc);
          setSigOpen(false);
          setPdfOpen(true);
        }}
      />
    </div>
  );
}

function Kpi({
  label, value, tone, icon: Icon, pulse,
}: { label: string; value: number; tone: "red" | "amber" | "green" | "slate"; icon: any; pulse?: boolean }) {
  const tones = {
    red: "from-red-500 to-red-700",
    amber: "from-amber-400 to-amber-600",
    green: "from-emerald-500 to-emerald-700",
    slate: "from-slate-600 to-slate-800",
  };
  return (
    <div className={`relative rounded-xl bg-gradient-to-br ${tones[tone]} text-white p-3 shadow-md ring-1 ring-white/10 overflow-hidden group hover:shadow-lg hover:-translate-y-0.5 transition-all`}>
      <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-white/10 blur-xl group-hover:bg-white/20 transition" />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="text-[9px] font-black uppercase tracking-widest opacity-90">{label}</div>
          <div className="text-2xl font-black tabular-nums leading-tight">{value}</div>
        </div>
        <div className={`h-8 w-8 rounded-lg bg-white/15 flex items-center justify-center ${pulse ? "animate-pulse" : ""}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function ExtintorFormDialog({
  extintor, open, onOpenChange, onSaved, userId,
}: { extintor?: Extintor; open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void; userId?: string }) {
  const isEdit = !!extintor;
  const [form, setForm] = useState({
    numero: extintor?.numero ?? "",
    area: extintor?.area ?? "",
    localizacao: extintor?.localizacao ?? "",
    tipo_agente: (extintor?.tipo_agente ?? "ABC") as any,
    carga_nominal: extintor?.carga_nominal?.toString() ?? "",
    carga_unidade: extintor?.carga_unidade ?? "kg",
    capacidade_extintora: extintor?.capacidade_extintora ?? "",
    numero_selo_inmetro: extintor?.numero_selo_inmetro ?? "",
    data_ultima_recarga: extintor?.data_ultima_recarga ?? "",
    ano_teste_hidrostatico: extintor?.ano_teste_hidrostatico?.toString() ?? "",
    fabricante: extintor?.fabricante ?? "",
    empresa_responsavel: extintor?.empresa_responsavel ?? "",
    status: extintor?.status ?? "ATIVO",
    observacoes: extintor?.observacoes ?? "",
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        area: form.area,
        localizacao: form.localizacao,
        tipo_agente: form.tipo_agente,
        carga_nominal: form.carga_nominal ? Number(form.carga_nominal) : null,
        carga_unidade: form.carga_unidade || "kg",
        capacidade_extintora: form.capacidade_extintora || null,
        numero_selo_inmetro: form.numero_selo_inmetro || null,
        data_ultima_recarga: form.data_ultima_recarga || null,
        ano_teste_hidrostatico: form.ano_teste_hidrostatico ? Number(form.ano_teste_hidrostatico) : null,
        fabricante: form.fabricante || null,
        empresa_responsavel: form.empresa_responsavel || null,
        status: form.status,
        observacoes: form.observacoes || null,
      };
      if (isEdit) {
        const { error } = await supabase.from("extintores").update(payload).eq("id", extintor.id);
        if (error) throw error;
      } else {
        payload.numero = form.numero || null;
        payload.created_by = userId ?? null;
        const { error } = await supabase.from("extintores").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Extintor atualizado" : "Extintor cadastrado");
      onSaved();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-red-600" />
            {isEdit ? `Editar extintor ${extintor.numero ?? ""}` : "Novo extintor"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          {!isEdit && (
            <div><Label>Nº do extintor <span className="text-slate-400 font-normal">(opcional)</span></Label><Input value={form.numero} onChange={(e) => set("numero", e.target.value)} placeholder="auto" /></div>
          )}
          <div><Label>Tipo agente *</Label>
            <Select value={form.tipo_agente} onValueChange={(v) => set("tipo_agente", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {isEdit && (
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div><Label>Área *</Label><Input value={form.area} onChange={(e) => set("area", e.target.value)} placeholder="PRODUÇÃO, ALMOXARIFADO…" /></div>
          <div><Label>Localização *</Label><Input value={form.localizacao} onChange={(e) => set("localizacao", e.target.value)} placeholder="Ex.: Em frente ao SESMT" /></div>
          <div><Label>Carga nominal</Label>
            <div className="flex gap-2">
              <Input type="number" step="0.5" value={form.carga_nominal} onChange={(e) => set("carga_nominal", e.target.value)} />
              <Select value={form.carga_unidade} onValueChange={(v) => set("carga_unidade", v)}>
                <SelectTrigger className="w-[80px]"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="kg">kg</SelectItem><SelectItem value="L">L</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Capacidade extintora</Label><Input value={form.capacidade_extintora} onChange={(e) => set("capacidade_extintora", e.target.value)} placeholder="Ex.: 3-A:20-B:C" /></div>
          <div><Label>Nº selo INMETRO</Label><Input value={form.numero_selo_inmetro} onChange={(e) => set("numero_selo_inmetro", e.target.value)} /></div>
          <div><Label>Fabricante</Label><Input value={form.fabricante} onChange={(e) => set("fabricante", e.target.value)} /></div>
          <div><Label>Data da última recarga</Label><Input type="date" value={form.data_ultima_recarga} onChange={(e) => set("data_ultima_recarga", e.target.value)} /></div>
          <div><Label>Ano teste hidrostático</Label><Input type="number" value={form.ano_teste_hidrostatico} onChange={(e) => set("ano_teste_hidrostatico", e.target.value)} placeholder={String(new Date().getFullYear())} /></div>
          <div className="col-span-2"><Label>Empresa responsável pela manutenção</Label><Input value={form.empresa_responsavel} onChange={(e) => set("empresa_responsavel", e.target.value)} /></div>
          <div className="col-span-2"><Label>Observações</Label><Textarea value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !form.area || !form.localizacao}
            className="bg-red-700 hover:bg-red-800"
          >
            {isEdit ? "Salvar alterações" : "Cadastrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InspecaoDialog({
  extintor, open, onOpenChange, onCreated, userId,
}: { extintor: Extintor; open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void; userId?: string }) {
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [nome, setNome] = useState("");
  const [registro, setRegistro] = useState("");
  const [ncs, setNcs] = useState<number[]>([]);
  const [nc, setNc] = useState("");
  const [obs, setObs] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const toggle = (id: number) => setNcs((arr) => arr.includes(id) ? arr.filter((n) => n !== id) : [...arr, id]);

  const onPickFile = (f: File | null) => {
    setFoto(f);
    if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    setFotoPreview(f ? URL.createObjectURL(f) : null);
  };

  const save = useMutation({
    mutationFn: async () => {
      let foto_path: string | null = null;
      if (foto) {
        setUploading(true);
        const ext = foto.name.split(".").pop() || "jpg";
        const path = `${extintor.id}/${Date.now()}.${ext}`;
        const up = await supabase.storage.from("extintores-fotos").upload(path, foto, {
          contentType: foto.type, upsert: false,
        });
        setUploading(false);
        if (up.error) throw up.error;
        foto_path = up.data.path;
      }
      const conforme = ncs.length === 0;
      const { error } = await supabase.from("extintor_inspecoes").insert({
        extintor_id: extintor.id,
        data_inspecao: data,
        responsavel_nome: nome,
        responsavel_registro: registro || null,
        nc_codigos: ncs,
        nao_conformidade: nc || null,
        observacoes: obs || null,
        conforme,
        foto_path,
        created_by: userId ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Inspeção registrada"); onCreated(); onOpenChange(false); },
    onError: (e: any) => { setUploading(false); toast.error(e.message ?? "Erro ao registrar"); },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-red-600" />
                Inspeção mensal — Extintor {extintor.numero}
              </DialogTitle>
              <div className="text-xs text-slate-500 mt-1">{extintor.area} · {extintor.localizacao} · {extintor.tipo_agente}</div>
            </div>
            <Button asChild size="sm" variant="outline" className="gap-1 shrink-0">
              <Link to="/app/extintores-inspecao-foto" search={{ extintor: extintor.id } as any}>
                <Sparkles className="h-3.5 w-3.5" /> Inspecionar com IA
              </Link>
            </Button>
          </div>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Data *</Label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
            <div className="col-span-2"><Label>Responsável *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Téc. Segurança — Nome" /></div>
            <div className="col-span-3"><Label>CRP/Registro</Label><Input value={registro} onChange={(e) => setRegistro(e.target.value)} placeholder="CRP-0000000/UF-MTE" /></div>
          </div>
          <div>
            <Label>Não conformidades observadas (FOR-SFG 08)</Label>
            <div className="grid grid-cols-2 gap-2 mt-2 p-3 rounded-md border bg-slate-50">
              {CHECKLIST_NC.map((it) => (
                <label key={it.id} className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox checked={ncs.includes(it.id)} onCheckedChange={() => toggle(it.id)} />
                  <span className="font-mono font-bold text-slate-400 w-5">{it.id}.</span>
                  <span>{it.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div><Label>Detalhamento da não conformidade</Label><Textarea value={nc} onChange={(e) => setNc(e.target.value)} rows={2} /></div>
          <div><Label>Observações</Label><Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} /></div>

          {/* EVIDÊNCIA / FOTO */}
          <div>
            <Label className="flex items-center gap-2"><Camera className="h-4 w-4 text-red-600" /> Evidência fotográfica</Label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            />
            {!fotoPreview ? (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="mt-2 w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 hover:border-red-400 hover:bg-red-50/40 transition rounded-lg py-6 text-slate-500 hover:text-red-700"
              >
                <Upload className="h-6 w-6" />
                <span className="text-xs font-semibold">Tirar/anexar foto do extintor</span>
                <span className="text-[10px] text-slate-400">JPG/PNG · obrigatório se houver não conformidade</span>
              </button>
            ) : (
              <div className="mt-2 relative inline-block">
                <img src={fotoPreview} alt="prévia" className="max-h-48 rounded-lg border border-slate-200 shadow-sm" />
                <button
                  type="button"
                  onClick={() => onPickFile(null)}
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-600 text-white flex items-center justify-center shadow"
                  title="Remover"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || uploading || !nome}
            className="bg-red-700 hover:bg-red-800"
          >
            {uploading ? "Enviando foto…" : save.isPending ? "Registrando…" : "Registrar inspeção"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
