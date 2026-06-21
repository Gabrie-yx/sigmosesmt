import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Plus, Printer, Search, ClipboardCheck, Flame, AlertTriangle, CheckCircle2,
  ShieldCheck, CalendarClock, Activity, Sparkles, CalendarDays, Droplet,
} from "lucide-react";
import { History, Trash2 } from "lucide-react";
import { MediaViewerDialog, type MediaItem } from "@/components/media-viewer-dialog";
import { toast } from "sonner";
import { ExtintorInspecaoFotoDialog } from "@/components/extintores/inspecao-foto-dialog";
import { InspecaoManualDialog } from "@/components/extintores/inspecao-manual-dialog";
import { ExtintorGlassCard } from "@/components/extintores/glass-card-preview";
import { formatDateBR } from "@/lib/utils-date";
import { PDFPreviewDialog } from "@/components/pdf-preview-dialog";
import { SignaturePadDialog } from "@/components/signature-pad-dialog";
import { gerarPdfPlanilhaExtintores } from "@/lib/extintores-pdf";
import { gerarPdfHistoricoExtintor } from "@/lib/extintor-historico-pdf";
import { gerarPdfAuditoriaExtintores } from "@/lib/extintor-auditoria-pdf";
import { calcularProximosPassos, formatMesAnoBR, isVencido } from "@/lib/extintor-regulatorio";
import { FileText, CalendarRange, Wrench, Gauge, ClipboardEdit, Info } from "lucide-react";
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

const normalizeIaStatus = (status?: string | null) => {
  const s = (status ?? "").toUpperCase();
  if (s === "CONFORME") return "CONFORME";
  if (s === "PENDENTE_REVISAO" || s === "PRECISA_REVISAO") return "PRECISA_REVISAO";
  if (s === "NAO_CONFORME" || s === "NÃO_CONFORME") return "NAO_CONFORME";
  return null;
};

const IA_STATUS_LABEL: Record<string, string> = {
  CONFORME: "Conforme",
  PRECISA_REVISAO: "Revisar",
  NAO_CONFORME: "Não conforme",
};

function readSearchString(params: URLSearchParams, key: string): string | null {
  const raw = params.get(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "string" ? parsed : raw;
  } catch {
    return raw;
  }
}

type Extintor = any;
type Inspecao = any;

function ExtintoresPage() {
  const { user, isModerator } = useAuth();
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [fStatus, setFStatus] = useState<string>("TODOS");
  const [fArea, setFArea] = useState<string>("TODAS");
  const [fClasse, setFClasse] = useState<string>("TODAS");
  const [novoOpen, setNovoOpen] = useState(false);
  const [editExt, setEditExt] = useState<Extintor | null>(null);
  const [histExt, setHistExt] = useState<Extintor | null>(null);
  const [pdfDoc, setPdfDoc] = useState<jsPDF | null>(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [sigOpen, setSigOpen] = useState(false);
  const [excluirExt, setExcluirExt] = useState<Extintor | null>(null);
  const [inspecaoExt, setInspecaoExt] = useState<Extintor | null>(null);
  const [manualExt, setManualExt] = useState<Extintor | null>(null);
  const [audOpen, setAudOpen] = useState(false);
  const [audIni, setAudIni] = useState<string>(() => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 2);
    return d.toISOString().slice(0, 10);
  });
  const [audFim, setAudFim] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [audGerando, setAudGerando] = useState(false);
  const [audPdf, setAudPdf] = useState<jsPDF | null>(null);
  const [audPdfOpen, setAudPdfOpen] = useState(false);

  const excluirMut = useMutation({
    mutationFn: async (ext: Extintor) => {
      const { error } = await supabase.from("extintores").delete().eq("id", ext.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Extintor excluído");
      setExcluirExt(null);
      qc.invalidateQueries({ queryKey: ["extintores"] });
    },
    onError: (e: any) => {
      toast.error(e?.message?.includes("foreign") || e?.code === "23503"
        ? "Não foi possível excluir: existem inspeções vinculadas. Considere marcar como BAIXADO."
        : `Erro ao excluir: ${e?.message ?? e}`);
    },
  });

  const extintores = useQuery({
    queryKey: ["extintores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("extintores").select("*").order("numero");
      if (error) throw error;
      return (data ?? []) as Extintor[];
    },
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
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

  // Última inspeção IA por extintor (para expandir NCs concretas em pendências)
  const inspecoesFotos = useQuery({
    queryKey: ["extintor-inspecoes-fotos-recentes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("extintor_inspecoes_fotos")
        .select("id, extintor_id, status_geral, nao_conformidades, divergencia_detectada, divergencia_descricao, inspecionado_em")
        .order("inspecionado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const ultimaIaPorExt = useMemo(() => {
    const map = new Map<string, any>();
    (inspecoesFotos.data ?? []).forEach((r) => {
      if (!map.has(r.extintor_id)) map.set(r.extintor_id, r);
    });
    return map;
  }, [inspecoesFotos.data]);

  // Contador total de inspeções (foto + manual) por extintor, pra mostrar no card
  const totalInspecoesPorExt = useMemo(() => {
    const map = new Map<string, number>();
    (inspecoesFotos.data ?? []).forEach((r) => {
      map.set(r.extintor_id, (map.get(r.extintor_id) ?? 0) + 1);
    });
    (inspecoes.data ?? []).forEach((r) => {
      map.set(r.extintor_id, (map.get(r.extintor_id) ?? 0) + 1);
    });
    return map;
  }, [inspecoesFotos.data, inspecoes.data]);

  const areas = useMemo(() => {
    const set = new Set<string>();
    (extintores.data ?? []).forEach((e) => e.area && set.add(e.area));
    return Array.from(set).sort();
  }, [extintores.data]);

  const classesAgrupadas = useMemo(() => {
    const counts = new Map<string, number>();
    (extintores.data ?? []).forEach((e) => {
      const c = (e.tipo_agente || "—").toString().toUpperCase();
      counts.set(c, (counts.get(c) ?? 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
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
      if (fStatus === "INSPECIONADOS_MES") {
        if (e.status !== "ATIVO" || !inspecoesMesPorExt.has(e.id)) return false;
      } else if (fStatus !== "TODOS" && e.status !== fStatus) return false;
      if (fArea !== "TODAS" && e.area !== fArea) return false;
      if (fClasse !== "TODAS" && (e.tipo_agente || "").toUpperCase() !== fClasse) return false;
      if (!q) return true;
      return [e.numero, e.localizacao, e.area, e.numero_selo_inmetro, e.tipo_agente]
        .some((v) => (v ?? "").toString().toLowerCase().includes(q));
    });
  }, [extintores.data, busca, fStatus, fArea, fClasse, inspecoesMesPorExt]);

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
    const emManutencao = all.filter((e) => e.status === "EM_MANUTENCAO").length;
    const baixados = all.filter((e) => e.status === "BAIXADO").length;
    const vencidosStatus = all.filter(
      (e) => e.status === "VENCIDO" || (e.status === "ATIVO" && e.proxima_recarga && e.proxima_recarga < hojeISO),
    ).length;
    return {
      total: all.length,
      ativos: ativos.length,
      vencidos,
      vencendo,
      semInspecao,
      inspecionados,
      pctInsp,
      emManutencao,
      baixados,
      vencidosStatus,
    };
  }, [extintores.data, inspecoesMesPorExt]);

  const onInvalidate = () => {
    qc.invalidateQueries({ queryKey: ["extintores"] });
    qc.invalidateQueries({ queryKey: ["extintor-inspecoes"] });
    qc.invalidateQueries({ queryKey: ["extintor-inspecoes-fotos-recentes"] });
  };

  useEffect(() => {
    if (typeof window === "undefined" || !extintores.data?.length) return;
    const params = new URLSearchParams(window.location.search);
    const historicoId = readSearchString(params, "historico");
    if (!historicoId) return;
    const alvo = extintores.data.find((e) => e.id === historicoId);
    if (alvo) {
      setHistExt(alvo);
      params.delete("historico");
      const qs = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
    }
  }, [extintores.data]);

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
            <Button variant="secondary" className="gap-2 bg-white text-red-700 hover:bg-white/90" onClick={() => setAudOpen(true)}>
              <ClipboardCheck className="h-4 w-4" /> Relatório de Auditoria
            </Button>
            <Button variant="secondary" className="gap-2 bg-white text-red-700 hover:bg-white/90" onClick={() => toast.info("Escolha um extintor na lista e clique em Inspecionar.") }>
              <Sparkles className="h-4 w-4" /> Inspeção por foto
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

      {/* KPIs (clicáveis = filtram a lista) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi icon={ShieldCheck}    label="Total"          value={stats.total}          tone="slate"   active={fStatus === "TODOS"}                  onClick={() => setFStatus("TODOS")} />
        <Kpi icon={CheckCircle2}   label="Ativos"         value={stats.ativos}         tone="emerald" active={fStatus === "ATIVO"}                  onClick={() => setFStatus("ATIVO")} />
        <Kpi icon={Activity}       label="Inspecionados" value={stats.inspecionados}  tone="cyan"    active={fStatus === "INSPECIONADOS_MES"}      onClick={() => setFStatus("INSPECIONADOS_MES")} />
        <Kpi icon={CalendarClock}  label="Em manutenção" value={stats.emManutencao}   tone="amber"   active={fStatus === "EM_MANUTENCAO"}          onClick={() => setFStatus("EM_MANUTENCAO")} />
        <Kpi icon={AlertTriangle}  label="Vencidos"       value={stats.vencidosStatus} tone="red"     pulse={stats.vencidosStatus > 0} active={fStatus === "VENCIDO"} onClick={() => setFStatus("VENCIDO")} />
        <Kpi icon={ClipboardCheck} label="Baixados"       value={stats.baixados}       tone="violet"  active={fStatus === "BAIXADO"}                onClick={() => setFStatus("BAIXADO")} />
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

      {/* Pills de classes (clicáveis = filtram por agente) */}
      {classesAgrupadas.length > 0 && (
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mr-1">Classe</span>
          <button
            type="button"
            onClick={() => setFClasse("TODAS")}
            className={`px-4 py-2 rounded-full text-sm font-black tracking-wider border-2 transition-all ${
              fClasse === "TODAS"
                ? "bg-gradient-to-br from-amber-300 to-amber-500 text-slate-900 border-amber-200 shadow-[0_0_18px_-2px_rgba(251,191,36,0.7)]"
                : "bg-slate-900/60 text-slate-200 border-slate-700 hover:border-amber-400/60"
            }`}
          >
            TODAS · {extintores.data?.length ?? 0}
          </button>
          {classesAgrupadas.map(([cls, n]) => {
            const active = fClasse === cls;
            return (
              <button
                key={cls}
                type="button"
                onClick={() => setFClasse(active ? "TODAS" : cls)}
                className={`px-4 py-2 rounded-full text-sm font-black tracking-wider border-2 transition-all ${
                  active
                    ? "bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 border-amber-300 shadow-[0_0_20px_-2px_rgba(251,146,60,0.8)] scale-105"
                    : "bg-slate-950/80 text-amber-300 border-amber-500/40 hover:border-amber-400 hover:bg-amber-500/10 hover:shadow-[0_0_14px_-2px_rgba(251,191,36,0.5)]"
                }`}
              >
                {cls} · {n}
              </button>
            );
          })}
        </div>
      )}

      {/* Grid de cards — padrão visual: vidro escuro */}
      {extintores.isLoading ? (
        <div className="text-center text-slate-400 py-8">Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-slate-400 py-12 rounded-2xl border border-dashed border-slate-300 bg-slate-50/50">
          Nenhum extintor encontrado.
        </div>
      ) : (
        <div className="bg-black/40 rounded-3xl p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10 justify-items-stretch">
          {filtered.map((e) => {
            const insp = inspecoesMesPorExt.get(e.id);
            const iaStatus = normalizeIaStatus(e.ultimo_status_inspecao);
            const manualConformeMes = !!insp && insp.conforme === true;
            const hojeISO = hoje.toISOString().slice(0, 10);
            const vencido = !!e.proxima_recarga && e.proxima_recarga < hojeISO;
            const indisponivel =
              vencido ||
              e.status === "BAIXADO" ||
              e.status === "VENCIDO" ||
              (!manualConformeMes && iaStatus === "NAO_CONFORME");
            return (
              <ExtintorGlassCard
                key={e.id}
                extintor={e}
                totalInspecoes={totalInspecoesPorExt.get(e.id) ?? 0}
                podeExcluir={isModerator}
                indisponivel={indisponivel}
                onInspecaoFoto={() => setInspecaoExt(e)}
                onInspecaoManual={() => setManualExt(e)}
                onHistorico={() => setHistExt(e)}
                onEditar={() => setEditExt(e)}
                onExcluir={() => setExcluirExt(e)}
              />
            );
          })}
        </div>
      )}

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
      {histExt && (
        <HistoricoInspecoesDialog
          extintor={histExt}
          open={!!histExt}
          onOpenChange={(v: boolean) => !v && setHistExt(null)}
          onNovaInspecao={() => { setHistExt(null); setInspecaoExt(histExt); }}
          userId={user?.id}
          userNome={(user?.user_metadata as any)?.full_name ?? user?.email ?? ""}
        />
      )}
      <PDFPreviewDialog
        open={pdfOpen}
        onClose={() => setPdfOpen(false)}
        doc={pdfDoc}
        fileName={`planilha-inspecao-extintores-${new Date().toISOString().slice(0, 10)}.pdf`}
        title="Planilha de Inspeção de Extintores"
      />
      <PDFPreviewDialog
        open={audPdfOpen}
        onClose={() => setAudPdfOpen(false)}
        doc={audPdf}
        fileName={`relatorio-auditoria-extintores-${audIni}_a_${audFim}.pdf`}
        title="Relatório de Auditoria de Extintores"
      />
      <Dialog open={audOpen} onOpenChange={(v) => !v && setAudOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <ClipboardCheck className="h-5 w-5" /> Relatório de Auditoria
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Define o período a ser auditado. O relatório vai trazer o resumo executivo,
              vencimentos regulatórios, inspeções do período e não conformidades identificadas.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Início</Label>
                <Input type="date" value={audIni} onChange={(e) => setAudIni(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Fim</Label>
                <Input type="date" value={audFim} onChange={(e) => setAudFim(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAudOpen(false)} disabled={audGerando}>Cancelar</Button>
            <Button
              className="bg-red-700 hover:bg-red-800 text-white"
              disabled={audGerando || !audIni || !audFim || audIni > audFim}
              onClick={async () => {
                if (extintores.isLoading || inspecoes.isLoading || inspecoesFotos.isLoading) {
                  toast.info("Aguarde carregar os dados…"); return;
                }
                try {
                  setAudGerando(true);
                  // Busca completa de inspeções foto (a query existente projeta só alguns campos)
                  const { data: fotosFull, error: fErr } = await supabase
                    .from("extintor_inspecoes_fotos")
                    .select("id, extintor_id, status_geral, nao_conformidades, inspecionado_em, assinado_por_nome")
                    .order("inspecionado_em", { ascending: false });
                  if (fErr) throw fErr;
                  const doc = await gerarPdfAuditoriaExtintores({
                    periodoInicio: audIni,
                    periodoFim: audFim,
                    extintores: extintores.data ?? [],
                    inspecoesFoto: (fotosFull ?? []) as any[],
                    inspecoesManual: inspecoes.data ?? [],
                    emitidoPor: (user?.user_metadata as any)?.full_name ?? user?.email ?? null,
                  });
                  setAudPdf(doc);
                  setAudOpen(false);
                  setAudPdfOpen(true);
                } catch (e: any) {
                  toast.error(`Erro ao gerar relatório: ${e?.message ?? e}`);
                } finally {
                  setAudGerando(false);
                }
              }}
            >
              {audGerando ? "Gerando…" : "Gerar relatório"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ExtintorInspecaoFotoDialog
        extintor={inspecaoExt}
        open={!!inspecaoExt}
        onOpenChange={(v) => { if (!v) setInspecaoExt(null); }}
      />
      <InspecaoManualDialog
        extintor={manualExt}
        open={!!manualExt}
        onOpenChange={(v) => { if (!v) setManualExt(null); }}
        userId={user?.id}
        userNome={(user?.user_metadata as any)?.full_name ?? user?.email ?? ""}
        onSaved={onInvalidate}
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
      <Dialog open={!!excluirExt} onOpenChange={(v) => !v && setExcluirExt(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" /> Excluir extintor
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              Tem certeza que deseja excluir o extintor{" "}
              <strong className="font-mono">{excluirExt?.numero}</strong> ({excluirExt?.tipo_agente})?
            </p>
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-800 text-xs">
              <strong>Atenção:</strong> a exclusão é permanente. Se já houver inspeções vinculadas,
              o sistema bloqueia a exclusão para preservar o histórico legal (NR-23 / Bombeiros).
              Nesses casos, edite o cadastro e altere o status para <strong>BAIXADO</strong>.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcluirExt(null)} disabled={excluirMut.isPending}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => excluirExt && excluirMut.mutate(excluirExt)}
              disabled={excluirMut.isPending}
            >
              {excluirMut.isPending ? "Excluindo..." : "Excluir definitivamente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({
  label, value, tone, icon: Icon, pulse, active, onClick,
}: { label: string; value: number; tone: "red" | "amber" | "emerald" | "slate" | "cyan" | "violet"; icon: any; pulse?: boolean; active?: boolean; onClick?: () => void }) {
  const tones: Record<string, { ring: string; glow: string; icon: string; accent: string }> = {
    slate:   { ring: "ring-slate-400/30",   glow: "shadow-[0_0_24px_-6px_rgba(148,163,184,0.5)]",  icon: "text-slate-200",   accent: "from-slate-400/30 to-transparent" },
    emerald: { ring: "ring-emerald-400/40", glow: "shadow-[0_0_24px_-6px_rgba(16,185,129,0.6)]",   icon: "text-emerald-300", accent: "from-emerald-400/30 to-transparent" },
    cyan:    { ring: "ring-cyan-400/40",    glow: "shadow-[0_0_24px_-6px_rgba(34,211,238,0.6)]",   icon: "text-cyan-300",    accent: "from-cyan-400/30 to-transparent" },
    amber:   { ring: "ring-amber-400/40",   glow: "shadow-[0_0_24px_-6px_rgba(251,191,36,0.6)]",   icon: "text-amber-300",   accent: "from-amber-400/30 to-transparent" },
    red:     { ring: "ring-red-400/40",     glow: "shadow-[0_0_24px_-6px_rgba(248,113,113,0.7)]",  icon: "text-red-300",     accent: "from-red-500/30 to-transparent" },
    violet:  { ring: "ring-violet-400/40",  glow: "shadow-[0_0_24px_-6px_rgba(167,139,250,0.6)]",  icon: "text-violet-300",  accent: "from-violet-400/30 to-transparent" },
  };
  const t = tones[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left relative rounded-2xl p-3.5 text-white overflow-hidden group transition-all hover:-translate-y-0.5
        bg-white/5 backdrop-blur-xl border border-white/10 ring-1 ${t.ring} ${active ? `${t.glow} border-white/30 -translate-y-0.5` : "shadow-md"}`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${t.accent} opacity-60 pointer-events-none`} />
      <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-white/10 blur-2xl group-hover:bg-white/20 transition" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="text-[9px] font-black uppercase tracking-[0.18em] text-white/70">{label}</div>
          <div className="text-2xl font-black tabular-nums leading-tight mt-0.5 drop-shadow">{value}</div>
        </div>
        <div className={`h-9 w-9 rounded-xl bg-white/10 border border-white/15 backdrop-blur flex items-center justify-center ${pulse ? "animate-pulse" : ""}`}>
          <Icon className={`h-4 w-4 ${t.icon}`} />
        </div>
      </div>
    </button>
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-red-600" />
            {isEdit ? `Editar cadastro — Extintor ${extintor.numero ?? ""}` : "Novo extintor"}
          </DialogTitle>
          {isEdit && (
            <div className="text-sm text-slate-300">
              Somente dados do cadastro. Inspeções e fotos ficam no botão Histórico.
            </div>
          )}
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

function UltimaInspecaoIAPanel({ extintorId }: { extintorId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["extintor-ultima-insp-ia", extintorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("extintor_inspecoes_fotos")
        .select("*")
        .eq("extintor_id", extintorId)
        .order("inspecionado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!data) return;
    const paths: { key: string; label: string; path: string | null }[] = [
      { key: "etiqueta", label: "Etiqueta", path: data.foto_etiqueta_path },
      { key: "manometro", label: "Manômetro", path: data.foto_manometro_path },
      { key: "lacre", label: "Lacre", path: data.foto_lacre_path },
      { key: "inmetro", label: "Selo INMETRO", path: data.foto_inmetro_path },
      { key: "extra", label: "Extra", path: data.foto_extra_path },
    ];
    (async () => {
      const out: Record<string, string> = {};
      for (const p of paths) {
        if (!p.path) continue;
        const { data: signed } = await supabase.storage
          .from("extintores-inspecoes")
          .createSignedUrl(p.path, 3600);
        if (signed?.signedUrl) out[p.key] = signed.signedUrl;
      }
      setUrls(out);
    })();
  }, [data]);

  if (isLoading) {
    return <div className="text-xs text-slate-400 py-2">Carregando última inspeção por foto…</div>;
  }
  if (!data) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500 flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-slate-400" />
        Nenhuma inspeção por foto registrada para este extintor.
      </div>
    );
  }

  const status = data.status_geral as string | null;
  const statusStyles =
    status === "CONFORME"
      ? "bg-emerald-50 text-emerald-700 border-emerald-300"
      : status === "PRECISA_REVISAO"
      ? "bg-amber-50 text-amber-700 border-amber-300"
      : "bg-red-50 text-red-700 border-red-300";

  const fotos: { key: string; label: string }[] = [
    { key: "etiqueta", label: "Etiqueta" },
    { key: "manometro", label: "Manômetro" },
    { key: "lacre", label: "Lacre" },
    { key: "inmetro", label: "Selo INMETRO" },
    { key: "extra", label: "Extra" },
  ].filter((f) => urls[f.key]);

  const ncs = Array.isArray(data.nao_conformidades) ? data.nao_conformidades : [];

  return (
    <div className="rounded-xl border border-red-200 bg-gradient-to-br from-red-50/60 via-white to-amber-50/40 p-3 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-red-600" />
          <span className="text-xs font-black uppercase tracking-wider text-red-700">Última inspeção por foto</span>
          <Badge variant="outline" className={statusStyles}>{status ?? "—"}</Badge>
        </div>
        <div className="text-[11px] text-slate-500">
          {data.inspecionado_em ? new Date(data.inspecionado_em).toLocaleString("pt-BR") : "—"}
          {data.confianca_ia != null && <span className="ml-2">· confiança {Math.round(Number(data.confianca_ia) * 100)}%</span>}
        </div>
      </div>

      {ncs.length > 0 && (
        <div className="text-[11px]">
          <div className="font-bold text-red-700 mb-1">Não conformidades:</div>
          <ul className="list-disc list-inside text-slate-700 space-y-0.5">
            {ncs.map((n: any, i: number) => <li key={i}>{String(n)}</li>)}
          </ul>
        </div>
      )}
      {data.observacoes && (
        <div className="text-[11px] text-slate-600"><span className="font-bold">Obs:</span> {data.observacoes}</div>
      )}

      {fotos.length > 0 ? (
        <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
          {fotos.map((f) => (
            <a
              key={f.key}
              href={urls[f.key]}
              target="_blank"
              rel="noreferrer"
              className="group block rounded-md overflow-hidden border border-slate-200 hover:border-red-400 bg-white shadow-sm"
              title={`Abrir foto: ${f.label}`}
            >
              <img src={urls[f.key]} alt={f.label} className="h-20 w-full object-cover group-hover:opacity-90" />
              <div className="text-[10px] font-semibold text-slate-600 text-center py-0.5 border-t border-slate-100">{f.label}</div>
            </a>
          ))}
        </div>
      ) : (
        <div className="text-[11px] text-slate-400 italic">Sem fotos anexadas.</div>
      )}

      <div className="flex justify-end">
        <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => toast.info("Use o botão Inspecionar no card do extintor.") }>
          <Sparkles className="h-3 w-3" /> Nova inspeção por foto
        </Button>
      </div>
    </div>
  );
}

function HistoricoInspecoesDialog({
  extintor, open, onOpenChange, onNovaInspecao, userId, userNome,
}: {
  extintor: Extintor;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onNovaInspecao: () => void;
  userId?: string;
  userNome?: string;
}) {
  const qc = useQueryClient();
  const [manualOpen, setManualOpen] = useState(true);
  const [manualForm, setManualForm] = useState<{
    conforme: boolean | null;
    nao_conformidade: string;
    observacoes: string;
    responsavel_nome: string;
    responsavel_registro: string;
  }>({
    conforme: null,
    nao_conformidade: "",
    observacoes: "",
    responsavel_nome: userNome ?? "",
    responsavel_registro: "",
  });
  useEffect(() => {
    setManualForm((p) => ({ ...p, responsavel_nome: userNome ?? p.responsavel_nome }));
  }, [userNome]);
  useEffect(() => {
    if (!open) return;
    setManualOpen(true);
    const handler = (ev: Event) => {
      const det = (ev as CustomEvent).detail;
      if (det && det !== extintor.id) return;
      setManualOpen(true);
    };
    window.addEventListener("abrir-inspecao-manual", handler as EventListener);
    return () => window.removeEventListener("abrir-inspecao-manual", handler as EventListener);
  }, [open, extintor.id]);

  const salvarManual = useMutation({
    mutationFn: async () => {
      const nome = (manualForm.responsavel_nome || "").trim();
      if (!nome) throw new Error("Informe o responsável pela inspeção");
      if (manualForm.conforme === null) {
        throw new Error("Selecione CONFORME ou NÃO CONFORME antes de salvar");
      }
      if (manualForm.conforme === false && !manualForm.nao_conformidade.trim()) {
        throw new Error("Descreva a não conformidade encontrada");
      }
      const hoje = new Date().toISOString().slice(0, 10);
      const { error } = await supabase.from("extintor_inspecoes").insert({
        extintor_id: extintor.id,
        data_inspecao: hoje,
        conforme: manualForm.conforme!,
        nao_conformidade: manualForm.conforme ? null : (manualForm.nao_conformidade || null),
        observacoes: manualForm.observacoes || null,
        responsavel_nome: nome,
        responsavel_registro: manualForm.responsavel_registro || null,
        created_by: userId ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Inspeção manual registrada");
      setManualOpen(false);
      setManualForm((p) => ({ ...p, nao_conformidade: "", observacoes: "" }));
      qc.invalidateQueries({ queryKey: ["extintor-inspecoes"] });
      qc.invalidateQueries({ queryKey: ["hist-manual", extintor.id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar inspeção"),
  });

  const ia = useQuery({
    queryKey: ["hist-ia", extintor.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("extintor_inspecoes_fotos")
        .select("*")
        .eq("extintor_id", extintor.id)
        .order("inspecionado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });
  const manuais = useQuery({
    queryKey: ["hist-manual", extintor.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("extintor_inspecoes")
        .select("*")
        .eq("extintor_id", extintor.id)
        .order("data_inspecao", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!ia.data && !manuais.data) return;
    (async () => {
      const out: Record<string, string> = {};
      const sign = async (bucket: string, path: string) => {
        const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
        if (data?.signedUrl) out[`${bucket}:${path}`] = data.signedUrl;
      };
      for (const r of ia.data ?? []) {
        for (const p of [r.foto_etiqueta_path, r.foto_manometro_path, r.foto_lacre_path, r.foto_inmetro_path, r.foto_extra_path]) {
          if (p) await sign("extintores-inspecoes", p);
        }
      }
      for (const r of manuais.data ?? []) {
        if (r.foto_path) await sign("extintores-fotos", r.foto_path);
      }
      setUrls(out);
    })();
  }, [ia.data, manuais.data]);

  const total = (ia.data?.length ?? 0) + (manuais.data?.length ?? 0);

  const mediaItems: MediaItem[] = useMemo(() => {
    const out: MediaItem[] = [];
    for (const r of ia.data ?? []) {
      const pares: { label: string; path: string | null }[] = [
        { label: "Etiqueta", path: r.foto_etiqueta_path },
        { label: "Manômetro", path: r.foto_manometro_path },
        { label: "Lacre", path: r.foto_lacre_path },
        { label: "INMETRO", path: r.foto_inmetro_path },
        { label: "Extra", path: r.foto_extra_path },
      ];
      for (const p of pares) {
        if (!p.path) continue;
        const url = urls[`extintores-inspecoes:${p.path}`];
        if (url) out.push({ url, name: `Foto · ${p.label} · ${new Date(r.inspecionado_em).toLocaleDateString("pt-BR")}`, kind: "image" });
      }
    }
    for (const r of manuais.data ?? []) {
      if (!r.foto_path) continue;
      const url = urls[`extintores-fotos:${r.foto_path}`];
      if (url) out.push({ url, name: `Manual · ${new Date(r.data_inspecao + "T00:00").toLocaleDateString("pt-BR")}`, kind: "image" });
    }
    return out;
  }, [ia.data, manuais.data, urls]);

  const [viewerIdx, setViewerIdx] = useState<number | null>(null);
  const openByUrl = (url: string) => {
    const i = mediaItems.findIndex((m) => m.url === url);
    if (i >= 0) setViewerIdx(i);
  };

  const [histPdfDoc, setHistPdfDoc] = useState<jsPDF | null>(null);
  const [histPdfOpen, setHistPdfOpen] = useState(false);

  const ultimaInsp =
    (manuais.data?.[0] as any)?.data_inspecao
      ? (manuais.data?.[0] as any).data_inspecao
      : (ia.data?.[0] as any)?.inspecionado_em
      ? String((ia.data?.[0] as any).inspecionado_em).slice(0, 10)
      : null;
  const passos = useMemo(() => calcularProximosPassos(extintor, ultimaInsp), [extintor, ultimaInsp]);

  const gerarPdf = async () => {
    try {
      const doc = await gerarPdfHistoricoExtintor(extintor, ia.data ?? [], manuais.data ?? []);
      setHistPdfDoc(doc);
      setHistPdfOpen(true);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar PDF");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto custom-scrollbar">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-red-600" />
            Histórico de inspeções — Extintor {extintor.numero}
          </DialogTitle>
          <div className="text-sm text-slate-300 mt-1">
            {extintor.area} · {extintor.localizacao} · {extintor.tipo_agente} · {total} registro(s)
          </div>
        </DialogHeader>

        {/* Próximos passos regulatórios (NBR 12962) */}
        <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-br from-slate-900 to-emerald-950/40 p-3 shadow-[0_0_18px_-6px_rgba(16,185,129,0.4)]">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
            <div className="flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-emerald-300" />
              <span className="text-xs font-black uppercase tracking-wider text-emerald-300">
                Próximos passos regulatórios · NBR 12962
              </span>
            </div>
            <Button
              size="sm"
              onClick={gerarPdf}
              className="h-8 gap-1.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white text-xs font-bold shadow-[0_0_12px_-2px_rgba(239,68,68,0.55)] border-0"
            >
              <FileText className="h-3.5 w-3.5" /> Baixar histórico (PDF)
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <PassoCard
              icon={ClipboardCheck}
              label="Inspeção mensal (1º grau)"
              value={formatMesAnoBR(passos.proximaInspecaoMensal)}
              vencido={isVencido(passos.proximaInspecaoMensal)}
            />
            <PassoCard
              icon={Wrench}
              label="Recarga (2º grau)"
              value={formatMesAnoBR(passos.proximaRecarga)}
              vencido={isVencido(passos.proximaRecarga)}
            />
            <PassoCard
              icon={Gauge}
              label="Teste hidrostático (3º grau)"
              value={formatMesAnoBR(passos.proximoTesteHidrostatico)}
              vencido={isVencido(passos.proximoTesteHidrostatico)}
            />
          </div>
        </div>

        {(ia.isLoading || manuais.isLoading) && (
          <div className="text-sm text-slate-400 py-6 text-center">Carregando histórico…</div>
        )}

        {!ia.isLoading && !manuais.isLoading && total === 0 && (
          <div className="text-sm text-slate-500 py-8 text-center border border-dashed rounded-lg">
            Este extintor ainda não tem inspeções registradas.
          </div>
        )}

        <div className="space-y-3">
          {(ia.data ?? []).map((r: any) => {
            const status = normalizeIaStatus(r.status_geral) ?? "NAO_CONFORME";
            const tone =
              status === "CONFORME" ? "border-emerald-500/40 bg-slate-900/60"
              : status === "PRECISA_REVISAO" ? "border-amber-500/40 bg-slate-900/60"
              : "border-red-500/40 bg-slate-900/60";
            const badge =
              status === "CONFORME" ? "bg-emerald-100 text-emerald-700 border-emerald-300"
              : status === "PRECISA_REVISAO" ? "bg-amber-100 text-amber-700 border-amber-300"
              : "bg-red-100 text-red-700 border-red-300";
            const fotos = [
              { label: "Etiqueta", path: r.foto_etiqueta_path },
              { label: "Manômetro", path: r.foto_manometro_path },
              { label: "Lacre", path: r.foto_lacre_path },
              { label: "INMETRO", path: r.foto_inmetro_path },
              { label: "Extra", path: r.foto_extra_path },
            ].filter((f) => f.path);
            const ncs = Array.isArray(r.nao_conformidades) ? r.nao_conformidades : [];
            return (
              <div key={r.id} className={`rounded-xl border ${tone} p-3 space-y-2`}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-red-400" />
                    <span className="text-sm font-black uppercase tracking-wider text-white">Inspeção por foto</span>
                    <Badge variant="outline" className={badge}>{IA_STATUS_LABEL[status]}</Badge>
                  </div>
                  <div className="text-xs text-slate-300">
                    {r.inspecionado_em ? new Date(r.inspecionado_em).toLocaleString("pt-BR") : "—"}
                    {r.confianca_ia != null && <span className="ml-2">· confiança {Math.round(Number(r.confianca_ia) * 100)}%</span>}
                  </div>
                </div>
                {ncs.length > 0 && (
                  <div className="text-sm">
                    <div className="font-bold text-red-400 mb-1">Não conformidades:</div>
                    <ul className="list-disc list-inside text-slate-100 space-y-1">
                      {ncs.map((n: any, i: number) => <li key={i}>{String(n)}</li>)}
                    </ul>
                  </div>
                )}
                {r.observacoes && (
                  <div className="text-sm text-slate-200"><span className="font-bold text-white">Obs:</span> {r.observacoes}</div>
                )}
                {r.assinado_por_nome && (
                  <div className="text-xs text-slate-300">
                    Assinado por <span className="font-semibold text-white">{r.assinado_por_nome}</span>
                    {r.assinado_por_cargo ? ` · ${r.assinado_por_cargo}` : ""}
                  </div>
                )}
                {fotos.length > 0 && (
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                    {fotos.map((f) => {
                      const url = urls[`extintores-inspecoes:${f.path}`];
                      if (!url) return null;
                      return (
                        <button
                          key={f.label}
                          type="button"
                          onClick={() => openByUrl(url)}
                          className="block w-full text-left rounded-md overflow-hidden border border-white/15 hover:border-red-400 bg-slate-950/60 shadow-sm"
                        >
                          <img src={url} alt={f.label} className="h-24 w-full object-cover" />
                          <div className="text-xs font-semibold text-slate-100 text-center py-1 border-t border-white/10">{f.label}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {(manuais.data ?? []).map((r: any) => {
            const tone = r.conforme ? "border-emerald-500/40 bg-slate-900/60" : "border-red-500/40 bg-slate-900/60";
            const badge = r.conforme ? "bg-emerald-100 text-emerald-700 border-emerald-300" : "bg-red-100 text-red-700 border-red-300";
            const url = r.foto_path ? urls[`extintores-fotos:${r.foto_path}`] : null;
            return (
              <div key={r.id} className={`rounded-xl border ${tone} p-3 space-y-2`}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4 text-red-400" />
                    <span className="text-sm font-black uppercase tracking-wider text-white">Inspeção manual</span>
                    <Badge variant="outline" className={badge}>{r.conforme ? "CONFORME" : "NÃO CONFORME"}</Badge>
                  </div>
                  <div className="text-xs text-slate-300">{formatDateBR(r.data_inspecao)}</div>
                </div>
                <div className="text-sm text-slate-200">
                  Responsável: <span className="font-semibold text-white">{r.responsavel_nome || "—"}</span>
                  {r.responsavel_registro ? ` · ${r.responsavel_registro}` : ""}
                </div>
                {r.nao_conformidade && (
                  <div className="text-sm text-slate-200"><span className="font-bold text-white">Detalhe:</span> {r.nao_conformidade}</div>
                )}
                {r.observacoes && (
                  <div className="text-sm text-slate-200"><span className="font-bold text-white">Obs:</span> {r.observacoes}</div>
                )}
                {url && (
                  <button
                    type="button"
                    onClick={() => openByUrl(url)}
                    className="inline-block rounded-md overflow-hidden border border-white/15 hover:border-red-400 bg-slate-950/60 shadow-sm"
                  >
                    <img src={url} alt="Evidência" className="h-32 object-cover" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button
            onClick={gerarPdf}
            variant="outline"
            className="gap-1.5 bg-slate-900/60 border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-cyan-300"
          >
            <FileText className="h-3.5 w-3.5" /> PDF do histórico
          </Button>
          <Button
            variant="outline"
            className="gap-1.5 bg-slate-900/60 border-emerald-600/40 text-emerald-200 hover:bg-emerald-950/40"
            onClick={() => setManualOpen((v) => !v)}
          >
            <ClipboardEdit className="h-3.5 w-3.5" /> {manualOpen ? "Fechar inspeção manual" : "Nova inspeção manual"}
          </Button>
          <Button variant="outline" className="gap-1" onClick={onNovaInspecao}>
            <Sparkles className="h-3.5 w-3.5" /> Nova inspeção por foto
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
        {manualOpen && (
          <div className="rounded-xl border border-emerald-500/40 bg-slate-900/70 p-3 space-y-3 mt-3">
            <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-emerald-300">
              <ClipboardEdit className="h-4 w-4" /> Registrar inspeção manual
            </div>
            <div className="text-[11px] text-slate-300 flex items-start gap-1.5">
              <Info className="h-3.5 w-3.5 mt-0.5 text-cyan-300 shrink-0" />
              Use quando a inspeção for visual/no local (sem fotos). A data é a de hoje. O responsável é preenchido com seu usuário logado.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="md:col-span-1">
                <Label className="text-xs">Responsável *</Label>
                <Input
                  value={manualForm.responsavel_nome}
                  onChange={(e) => setManualForm((p) => ({ ...p, responsavel_nome: e.target.value }))}
                />
              </div>
              <div className="md:col-span-1">
                <Label className="text-xs">Registro / matrícula</Label>
                <Input
                  placeholder="Ex.: TST-2210"
                  value={manualForm.responsavel_registro}
                  onChange={(e) => setManualForm((p) => ({ ...p, responsavel_registro: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label className="text-xs">Resultado da inspeção *</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setManualForm((p) => ({ ...p, conforme: true }))}
                    className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-bold transition ${
                      manualForm.conforme === true
                        ? "border-emerald-500 bg-emerald-500/15 text-emerald-300 shadow-[0_0_12px_-4px_rgba(16,185,129,0.6)]"
                        : "border-slate-700 text-slate-400 hover:border-emerald-500/40 hover:text-emerald-300"
                    }`}
                  >
                    CONFORME
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualForm((p) => ({ ...p, conforme: false }))}
                    className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-bold transition ${
                      manualForm.conforme === false
                        ? "border-red-500 bg-red-500/15 text-red-300 shadow-[0_0_12px_-4px_rgba(239,68,68,0.6)]"
                        : "border-slate-700 text-slate-400 hover:border-red-500/40 hover:text-red-300"
                    }`}
                  >
                    NÃO CONFORME
                  </button>
                </div>
                {manualForm.conforme === null && (
                  <div className="text-[11px] text-amber-400">
                    Escolha CONFORME ou NÃO CONFORME — sem valor padrão. Digitar observação não conclui a inspeção.
                  </div>
                )}
              </div>
              {manualForm.conforme === false && (
                <div className="md:col-span-2">
                  <Label className="text-xs">Descrição da não conformidade *</Label>
                  <Textarea
                    rows={2}
                    value={manualForm.nao_conformidade}
                    onChange={(e) => setManualForm((p) => ({ ...p, nao_conformidade: e.target.value }))}
                  />
                </div>
              )}
              <div className="md:col-span-2">
                <Label className="text-xs">Observações</Label>
                <Textarea
                  rows={2}
                  placeholder="Ex.: manômetro na faixa verde, lacre íntegro, sinalização OK."
                  value={manualForm.observacoes}
                  onChange={(e) => setManualForm((p) => ({ ...p, observacoes: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setManualOpen(false)}>Cancelar</Button>
              <Button
                size="sm"
                onClick={() => salvarManual.mutate()}
                disabled={salvarManual.isPending}
                className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white"
              >
                {salvarManual.isPending ? "Salvando…" : "Salvar inspeção manual"}
              </Button>
            </div>
          </div>
        )}
        <MediaViewerDialog
          items={mediaItems}
          index={viewerIdx}
          onClose={() => setViewerIdx(null)}
          onIndexChange={setViewerIdx}
        />
        <PDFPreviewDialog
          open={histPdfOpen}
          onClose={() => setHistPdfOpen(false)}
          doc={histPdfDoc}
          fileName={`historico-extintor-${extintor.numero ?? extintor.id}.pdf`}
          title={`Histórico do extintor ${extintor.numero ?? ""}`}
        />
      </DialogContent>
    </Dialog>
  );
}

function PassoCard({
  icon: Icon, label, value, vencido,
}: { icon: any; label: string; value: string; vencido: boolean }) {
  return (
    <div
      className={`rounded-lg border p-2.5 flex items-center gap-2.5 ${
        vencido
          ? "border-red-500/40 bg-red-950/40 shadow-[0_0_12px_-4px_rgba(239,68,68,0.5)]"
          : "border-slate-700/60 bg-slate-950/50"
      }`}
    >
      <div
        className={`h-9 w-9 rounded-md flex items-center justify-center shrink-0 ${
          vencido ? "bg-red-500/20 text-red-300" : "bg-emerald-500/15 text-emerald-300"
        }`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 leading-tight">{label}</div>
        <div className={`text-sm font-black leading-tight ${vencido ? "text-red-300" : "text-slate-100"}`}>
          {value}{vencido && " · VENCIDO"}
        </div>
      </div>
    </div>
  );
}
