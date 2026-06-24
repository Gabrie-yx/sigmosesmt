import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState, lazy, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Plus, FileSignature, Download, Upload, Search, Settings2, AlertCircle, CheckCircle2, Clock, FileWarning, Eye, Ban,
  Briefcase, AlertTriangle, FileDown, ChevronDown, ChevronRight, X as XIcon,
} from "lucide-react";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/utils-date";
import { buildOssPdf } from "@/lib/oss-pdf";
const PDFPreviewDialog = lazy(() =>
  import("@/components/pdf-preview-dialog").then((m) => ({ default: m.PDFPreviewDialog })),
);
import { OssRowActions } from "@/components/oss/oss-row-actions";
import { OssAssinarButton } from "@/components/oss/oss-assinar-button";
import { EmployeeQuickView } from "@/components/employees/employee-quick-view";
import type jsPDF from "jspdf";

export const Route = createFileRoute("/app/oss/")({
  component: OssIndexPage,
  head: () => ({ meta: [{ title: "Ordens de Serviço de Segurança · SIGMO" }] }),
});

type Emissao = {
  id: string;
  employee_id: string;
  template_id: string;
  template_revisao: number;
  cargo_snapshot: string;
  status: "PENDENTE_ASSINATURA" | "ASSINADO" | "VENCIDO" | "SUBSTITUIDO";
  motivo_emissao: string;
  emitido_em: string;
  assinado_em: string | null;
  expira_em: string | null;
  pdf_gerado_path: string | null;
  pdf_assinado_path: string | null;
  conteudo_snapshot: any;
  employees?: {
    nome: string; cpf: string | null; matricula: string | null; admissao: string | null;
    rg?: string | null;
    companies?: { name: string | null; cnpj: string | null } | null;
    roles?: { name: string | null; cbo?: string | null } | null;
  } | null;
  oss_templates?: { titulo: string; setor: string | null } | null;
};

const STATUS_META: Record<Emissao["status"], { label: string; cls: string; icon: any }> = {
  PENDENTE_ASSINATURA: { label: "Pendente assinatura", cls: "bg-amber-100 text-amber-800 border-amber-300", icon: Clock },
  ASSINADO: { label: "Assinado", cls: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: CheckCircle2 },
  VENCIDO: { label: "Vencido", cls: "bg-red-100 text-red-800 border-red-300", icon: AlertCircle },
  SUBSTITUIDO: { label: "Substituído", cls: "bg-slate-100 text-slate-600 border-slate-300", icon: FileWarning },
};
const STATUS_META_EXTRA: Record<string, { label: string; cls: string; icon: any }> = {
  ...STATUS_META,
  CANCELADO: { label: "Cancelado", cls: "bg-red-50 text-red-700 border-red-200 line-through", icon: Ban },
};

// Semáforo de vencimento — calcula a partir de expira_em e status
type VencBucket = "VENCIDA" | "VENCE_30D" | "VENCE_90D" | "OK" | "SEM_DATA";
const VENC_META: Record<VencBucket, { label: string; cls: string; dot: string }> = {
  VENCIDA:    { label: "Vencida",       cls: "bg-red-100 text-red-800 border-red-300",          dot: "bg-red-500" },
  VENCE_30D:  { label: "Vence ≤ 30d",   cls: "bg-orange-100 text-orange-800 border-orange-300", dot: "bg-orange-500" },
  VENCE_90D:  { label: "Vence ≤ 90d",   cls: "bg-amber-100 text-amber-800 border-amber-300",    dot: "bg-amber-500" },
  OK:         { label: "Em dia",        cls: "bg-emerald-100 text-emerald-800 border-emerald-300", dot: "bg-emerald-500" },
  SEM_DATA:   { label: "Sem validade",  cls: "bg-slate-100 text-slate-600 border-slate-300",    dot: "bg-slate-400" },
};

function diasAteVencer(expira_em: string | null): number | null {
  if (!expira_em) return null;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const venc = new Date(expira_em.slice(0, 10) + "T00:00:00");
  return Math.floor((venc.getTime() - hoje.getTime()) / 86400000);
}
function bucketVencimento(em: Emissao): VencBucket {
  if (em.status === "VENCIDO") return "VENCIDA";
  const d = diasAteVencer(em.expira_em);
  if (d === null) return "SEM_DATA";
  if (d < 0) return "VENCIDA";
  if (d <= 30) return "VENCE_30D";
  if (d <= 90) return "VENCE_90D";
  return "OK";
}

const PAGE_SIZE = 50;

function OssIndexPage() {
  const qc = useQueryClient();
  const { isEditor } = useAuth();
  const [q, setQ] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ATIVAS");
  const [filterCargo, setFilterCargo] = useState<string>("TODOS");
  const [filterMotivo, setFilterMotivo] = useState<string>("TODOS");
  const [filterVenc, setFilterVenc] = useState<string>("TODOS");
  const [agruparCargo, setAgruparCargo] = useState(false);
  const [page, setPage] = useState(1);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [emitirOpen, setEmitirOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ doc: jsPDF; name: string } | null>(null);

  const { data: emissoes = [], isLoading } = useQuery({
    queryKey: ["oss-emissoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("oss_emissoes")
        .select("*, employees(nome, cpf, matricula, admissao, rg, assinatura_url, companies(name, cnpj), roles(name, cbo)), oss_templates(titulo, setor, cbo)")
        .order("emitido_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Emissao[];
    },
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return emissoes.filter((e) => {
      if (filterStatus === "ATIVAS" && (e.status === "SUBSTITUIDO" || e.status === "VENCIDO" || (e.status as string) === "CANCELADO")) return false;
      if (filterStatus !== "ATIVAS" && filterStatus !== "TODAS" && e.status !== filterStatus) return false;
      if (filterCargo !== "TODOS" && e.cargo_snapshot !== filterCargo) return false;
      if (filterMotivo !== "TODOS" && e.motivo_emissao !== filterMotivo) return false;
      if (filterVenc !== "TODOS" && bucketVencimento(e) !== filterVenc) return false;
      if (!s) return true;
      return (
        (e.employees?.nome ?? "").toLowerCase().includes(s) ||
        e.cargo_snapshot.toLowerCase().includes(s) ||
        (e.employees?.cpf ?? "").includes(s)
      );
    });
  }, [emissoes, q, filterStatus, filterCargo, filterMotivo, filterVenc]);

  // KPIs sempre calculados sobre as ATIVAS (ignora substituídas/canceladas)
  const kpis = useMemo(() => {
    const ativas = emissoes.filter(
      (e) => e.status !== "SUBSTITUIDO" && (e.status as string) !== "CANCELADO",
    );
    let pendentes = 0, vencidas = 0, vence30 = 0, vence90 = 0, ok = 0;
    for (const e of ativas) {
      if (e.status === "PENDENTE_ASSINATURA") pendentes++;
      const b = bucketVencimento(e);
      if (b === "VENCIDA") vencidas++;
      else if (b === "VENCE_30D") vence30++;
      else if (b === "VENCE_90D") vence90++;
      else if (b === "OK") ok++;
    }
    return { pendentes, vencidas, vence30, vence90, ok, total: ativas.length };
  }, [emissoes]);

  // Opções únicas para os selects de Cargo e Motivo
  const cargosUnicos = useMemo(() => {
    const set = new Set<string>();
    emissoes.forEach((e) => e.cargo_snapshot && set.add(e.cargo_snapshot));
    return Array.from(set).sort();
  }, [emissoes]);
  const motivosUnicos = useMemo(() => {
    const set = new Set<string>();
    emissoes.forEach((e) => e.motivo_emissao && set.add(e.motivo_emissao));
    return Array.from(set).sort();
  }, [emissoes]);

  // Paginação
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageItems = useMemo(
    () => (agruparCargo ? filtered : filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE)),
    [filtered, pageSafe, agruparCargo],
  );

  // Agrupamento por cargo (quando ligado)
  const grouped = useMemo(() => {
    if (!agruparCargo) return null;
    const map = new Map<string, Emissao[]>();
    for (const e of filtered) {
      const k = e.cargo_snapshot || "(sem cargo)";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered, agruparCargo]);

  const algumFiltro =
    !!q || filterStatus !== "ATIVAS" || filterCargo !== "TODOS" ||
    filterMotivo !== "TODOS" || filterVenc !== "TODOS";

  const limparFiltros = () => {
    setQ(""); setFilterStatus("ATIVAS"); setFilterCargo("TODOS");
    setFilterMotivo("TODOS"); setFilterVenc("TODOS"); setPage(1);
  };

  const exportCSV = () => {
    const rows = [
      ["Funcionário", "CPF", "Cargo", "Revisão", "Status", "Vencimento", "Dias", "Emitido", "Motivo"],
      ...filtered.map((e) => {
        const d = diasAteVencer(e.expira_em);
        return [
          e.employees?.nome ?? "",
          e.employees?.cpf ?? "",
          e.cargo_snapshot,
          `Rev.${e.template_revisao}`,
          STATUS_META_EXTRA[e.status]?.label ?? e.status,
          e.expira_em ? formatDateBR(e.expira_em.slice(0, 10)) : "",
          d === null ? "" : String(d),
          formatDateBR(e.emitido_em.slice(0, 10)),
          e.motivo_emissao.replace(/_/g, " "),
        ];
      }),
    ];
    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `OSS-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exportado ${filtered.length} registros`);
  };

  const baixarPdf = async (em: Emissao) => {
    // Busca catálogo de EPIs do estoque pra preencher os C.A. automaticamente
    const { data: epiRows } = await supabase
      .from("estoque_epi")
      .select("nome_material, ca");
    const episCatalog = (epiRows ?? [])
      .filter((r: any) => r.nome_material && r.ca)
      .map((r: any) => ({ nome: r.nome_material as string, ca: r.ca as string }));
    // Sempre regerar a partir do snapshot pra evitar dependência do storage
    const doc = buildOssPdf({
      revisao: em.template_revisao,
      emitido_em: em.emitido_em,
      expira_em: em.expira_em,
      motivo_emissao: em.motivo_emissao,
      funcionario: {
        nome: em.employees?.nome ?? "—",
        cpf: em.employees?.cpf ?? null,
        matricula: em.employees?.matricula ?? null,
        admissao: em.employees?.admissao ?? null,
        rg: em.employees?.rg ?? null,
      },
      cargo: em.cargo_snapshot,
      cbo: em.conteudo_snapshot?.cbo ?? em.employees?.roles?.cbo ?? null,
      setor: em.oss_templates?.setor ?? null,
      empresa: em.employees?.companies?.name ?? null,
      empresa_cnpj: em.employees?.companies?.cnpj ?? null,
      conteudo: em.conteudo_snapshot,
      episCatalog,
      assinaturaColaboradorDataUrl: (em.employees as any)?.assinatura_url ?? null,
    });
    setPreviewDoc({ doc, name: `OSS-${em.cargo_snapshot}-${em.employees?.nome ?? "func"}.pdf` });
  };

  const uploadAssinado = useMutation({
    mutationFn: async ({ em, file }: { em: Emissao; file: File }) => {
      const path = `${em.id}/${Date.now()}-assinado.pdf`;
      const { error: upErr } = await supabase.storage.from("oss-pdfs").upload(path, file, {
        contentType: "application/pdf",
        upsert: false,
      });
      if (upErr) throw upErr;
      const { error } = await supabase
        .from("oss_emissoes")
        .update({
          pdf_assinado_path: path,
          status: "ASSINADO",
          assinado_em: new Date().toISOString(),
        })
        .eq("id", em.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("PDF assinado anexado — OSS marcada como Assinada");
      qc.invalidateQueries({ queryKey: ["oss-emissoes"] });
    },
    onError: (e: any) => toast.error("Erro no upload: " + e.message),
  });

  const downloadAssinado = async (em: Emissao) => {
    if (!em.pdf_assinado_path) return;
    const { data, error } = await supabase.storage.from("oss-pdfs").createSignedUrl(em.pdf_assinado_path, 60);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, "_blank");
  };

  const [quickViewEmpId, setQuickViewEmpId] = useState<string | null>(null);

  // KPI cards (clicáveis = aplicam filtro)
  const kpiCards: Array<{
    key: string; label: string; value: number; icon: any;
    onClick: () => void; active: boolean;
    // Cores do efeito glass: borda gradiente, halo, accent do valor
    border: string; halo: string; accent: string; pulse?: boolean;
  }> = [
    {
      key: "total", label: "Ativas no total", value: kpis.total,
      icon: FileSignature,
      onClick: () => { limparFiltros(); }, active: !algumFiltro,
      border: "linear-gradient(135deg, #ffffff 0%, #b8b8b8 25%, #5a5a5a 50%, #d8d8d8 75%, #ffffff 100%)",
      halo: "radial-gradient(60% 50% at 50% 50%, rgba(148,163,184,0.45) 0%, rgba(148,163,184,0.15) 40%, transparent 75%)",
      accent: "text-white",
    },
    {
      key: "pend", label: "Pendentes assinatura", value: kpis.pendentes,
      icon: Clock,
      onClick: () => { setFilterStatus("PENDENTE_ASSINATURA"); setFilterVenc("TODOS"); setPage(1); },
      active: filterStatus === "PENDENTE_ASSINATURA",
      border: "linear-gradient(135deg, #fcd34d 0%, #f59e0b 25%, #b45309 50%, #f59e0b 75%, #fcd34d 100%)",
      halo: "radial-gradient(60% 50% at 50% 50%, rgba(251,191,36,0.7) 0%, rgba(251,191,36,0.25) 40%, transparent 75%)",
      accent: "text-amber-300",
      pulse: kpis.pendentes > 0,
    },
    {
      key: "venc", label: "Vencidas", value: kpis.vencidas,
      icon: AlertCircle,
      onClick: () => { setFilterStatus("ATIVAS"); setFilterVenc("VENCIDA"); setPage(1); },
      active: filterVenc === "VENCIDA",
      border: "linear-gradient(135deg, #ff6b6b 0%, #ef4444 25%, #b91c1c 50%, #ef4444 75%, #ff6b6b 100%)",
      halo: "radial-gradient(60% 50% at 50% 50%, rgba(239,68,68,0.95) 0%, rgba(239,68,68,0.35) 40%, transparent 75%)",
      accent: "text-red-300",
      pulse: kpis.vencidas > 0,
    },
    {
      key: "v30", label: "Vencem em 30d", value: kpis.vence30,
      icon: AlertTriangle,
      onClick: () => { setFilterStatus("ATIVAS"); setFilterVenc("VENCE_30D"); setPage(1); },
      active: filterVenc === "VENCE_30D",
      border: "linear-gradient(135deg, #fdba74 0%, #fb923c 25%, #c2410c 50%, #fb923c 75%, #fdba74 100%)",
      halo: "radial-gradient(60% 50% at 50% 50%, rgba(251,146,60,0.7) 0%, rgba(251,146,60,0.25) 40%, transparent 75%)",
      accent: "text-orange-300",
    },
    {
      key: "v90", label: "Vencem em 90d", value: kpis.vence90,
      icon: Clock,
      onClick: () => { setFilterStatus("ATIVAS"); setFilterVenc("VENCE_90D"); setPage(1); },
      active: filterVenc === "VENCE_90D",
      border: "linear-gradient(135deg, #fde68a 0%, #facc15 25%, #a16207 50%, #facc15 75%, #fde68a 100%)",
      halo: "radial-gradient(60% 50% at 50% 50%, rgba(250,204,21,0.55) 0%, rgba(250,204,21,0.2) 40%, transparent 75%)",
      accent: "text-amber-200",
    },
    {
      key: "ok", label: "Em dia", value: kpis.ok,
      icon: CheckCircle2,
      onClick: () => { setFilterStatus("ATIVAS"); setFilterVenc("OK"); setPage(1); },
      active: filterVenc === "OK",
      border: "linear-gradient(135deg, #6ee7b7 0%, #10b981 25%, #047857 50%, #10b981 75%, #6ee7b7 100%)",
      halo: "radial-gradient(60% 50% at 50% 50%, rgba(16,185,129,0.55) 0%, rgba(16,185,129,0.2) 40%, transparent 75%)",
      accent: "text-emerald-300",
    },
  ];

  const renderRow = (em: Emissao) => {
    const meta = STATUS_META_EXTRA[em.status] ?? STATUS_META.PENDENTE_ASSINATURA;
    const Icon = meta.icon;
    const vb = bucketVencimento(em);
    const vMeta = VENC_META[vb];
    const dias = diasAteVencer(em.expira_em);
    return (
      <TableRow key={em.id}>
        <TableCell>
          <button
            type="button"
            onClick={() => setQuickViewEmpId(em.employee_id)}
            className="text-left group"
            title="Ver resumo do funcionário"
          >
            <div className="font-medium text-sm text-slate-900 group-hover:text-rose-600 group-hover:underline underline-offset-2 transition-colors">
              {em.employees?.nome ?? "—"}
            </div>
            <div className="text-[10px] text-slate-500">{em.employees?.cpf ?? ""}</div>
          </button>
        </TableCell>
        <TableCell className="text-sm">{em.cargo_snapshot} <span className="text-[10px] text-slate-400">Rev.{em.template_revisao}</span></TableCell>
        <TableCell>
          <Badge variant="outline" className={`${meta.cls} text-[10px]`}>
            <Icon className="h-3 w-3 mr-1" />{meta.label}
          </Badge>
        </TableCell>
        <TableCell className="text-xs">{formatDateBR(em.emitido_em.slice(0, 10))}</TableCell>
        <TableCell>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs">{em.expira_em ? formatDateBR(em.expira_em.slice(0, 10)) : "—"}</span>
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[9px] w-fit ${vMeta.cls}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${vMeta.dot}`} />
              {dias !== null && dias >= 0 && vb !== "SEM_DATA" ? `${dias}d` : vMeta.label}
            </span>
          </div>
        </TableCell>
        <TableCell className="text-[10px] text-slate-600">{em.motivo_emissao.replace(/_/g, " ")}</TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={() => baixarPdf(em)} title="Visualizar / Baixar PDF">
              <Eye className="h-3.5 w-3.5" />
            </Button>
            {em.pdf_assinado_path && (
              <Button variant="ghost" size="sm" onClick={() => downloadAssinado(em)} title="Baixar assinado">
                <Download className="h-3.5 w-3.5" />
              </Button>
            )}
            {isEditor && em.status === "PENDENTE_ASSINATURA" && (
              <>
                <OssAssinarButton em={em} />
                <UploadAssinadoButton
                  onPick={(f) => uploadAssinado.mutate({ em, file: f })}
                  disabled={uploadAssinado.isPending}
                />
              </>
            )}
            <OssRowActions em={em} invalidateKeys={[["oss-emissoes"], ["employee-oss", em.employee_id]]} />
          </div>
        </TableCell>
      </TableRow>
    );
  };

  const tableHeader = (
    <TableHeader>
      <TableRow>
        <TableHead>Funcionário</TableHead>
        <TableHead>Cargo</TableHead>
        <TableHead>Status</TableHead>
        <TableHead>Emitido</TableHead>
        <TableHead>Vencimento</TableHead>
        <TableHead>Motivo</TableHead>
        <TableHead className="text-right">Ações</TableHead>
      </TableRow>
    </TableHeader>
  );

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="px-6 pt-5 pb-3 border-b border-rose-100 bg-gradient-to-r from-rose-50 via-white to-amber-50 shadow-sm">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-rose-600 to-[#991b1b] text-white shadow">
              <FileSignature className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Ordens de Serviço de Segurança</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Conforme NR-01 item 1.4.1 alínea "c" — entregar OSS ao trabalhador na admissão, mudança de cargo ou revisão de risco.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/app/oss/templates"><Settings2 className="h-4 w-4 mr-1" />Modelos por Cargo</Link>
            </Button>
            {isEditor && (
              <Button onClick={() => setEmitirOpen(true)} className="bg-rose-600 hover:bg-rose-700">
                <Plus className="h-4 w-4 mr-1" />Emitir OSS
              </Button>
            )}
          </div>
        </div>
        {/* KPIs clicáveis */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {kpiCards.map((k) => {
            const Icon = k.icon;
            return (
              <button
                key={k.key}
                onClick={k.onClick}
                className={`text-left p-2.5 rounded-lg border bg-gradient-to-br ${k.cls} transition-all hover:shadow-md hover:-translate-y-0.5 ${
                  k.active ? "ring-2 ring-rose-400 shadow-md" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wide font-bold opacity-80">{k.label}</span>
                  <Icon className="h-3.5 w-3.5 opacity-70" />
                </div>
                <div className="text-2xl font-black mt-1 leading-none">{k.value}</div>
              </button>
            );
          })}
        </div>
        {/* Filtros */}
        <div className="mt-3 flex gap-2 flex-wrap items-center">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Buscar funcionário, cargo, CPF..." className="pl-8 h-9" />
          </div>
          <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ATIVAS">Ativas</SelectItem>
              <SelectItem value="TODAS">Todas</SelectItem>
              <SelectItem value="PENDENTE_ASSINATURA">Pendentes</SelectItem>
              <SelectItem value="ASSINADO">Assinadas</SelectItem>
              <SelectItem value="VENCIDO">Vencidas</SelectItem>
              <SelectItem value="SUBSTITUIDO">Substituídas</SelectItem>
              <SelectItem value="CANCELADO">Canceladas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterCargo} onValueChange={(v) => { setFilterCargo(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-48"><Briefcase className="h-3.5 w-3.5 mr-1" /><SelectValue placeholder="Cargo" /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="TODOS">Todos cargos</SelectItem>
              {cargosUnicos.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterMotivo} onValueChange={(v) => { setFilterMotivo(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Motivo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos motivos</SelectItem>
              {motivosUnicos.map((m) => <SelectItem key={m} value={m}>{m.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterVenc} onValueChange={(v) => { setFilterVenc(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Vencimento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Qualquer vencimento</SelectItem>
              <SelectItem value="VENCIDA">Vencidas</SelectItem>
              <SelectItem value="VENCE_30D">Vencem ≤ 30d</SelectItem>
              <SelectItem value="VENCE_90D">Vencem ≤ 90d</SelectItem>
              <SelectItem value="OK">Em dia</SelectItem>
              <SelectItem value="SEM_DATA">Sem validade</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={agruparCargo ? "default" : "outline"}
            size="sm"
            className="h-9"
            onClick={() => setAgruparCargo((v) => !v)}
            title="Agrupar a lista por cargo"
          >
            <Briefcase className="h-3.5 w-3.5 mr-1" />
            {agruparCargo ? "Agrupado por cargo" : "Agrupar por cargo"}
          </Button>
          <Button variant="outline" size="sm" className="h-9" onClick={exportCSV} title="Baixar CSV filtrado">
            <FileDown className="h-3.5 w-3.5 mr-1" />CSV
          </Button>
          {algumFiltro && (
            <Button variant="ghost" size="sm" className="h-9 text-rose-700" onClick={limparFiltros}>
              <XIcon className="h-3.5 w-3.5 mr-1" />Limpar filtros
            </Button>
          )}
          <span className="text-[11px] text-slate-500 ml-auto">
            {filtered.length} de {emissoes.length} registros
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <Card>
          {isLoading && <div className="p-6 text-sm text-slate-500">Carregando...</div>}
          {!isLoading && filtered.length === 0 && (
            <div className="p-8 text-center">
              <FileSignature className="h-12 w-12 mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-500">Nenhuma OSS encontrada.</p>
              {emissoes.length === 0 && (
                <p className="text-xs text-slate-400 mt-2">
                  Comece criando um <Link to="/app/oss/templates" className="text-rose-600 underline">modelo por cargo</Link>, depois emita a OSS para os funcionários.
                </p>
              )}
            </div>
          )}
          {!isLoading && filtered.length > 0 && !agruparCargo && (
            <>
              <Table>
                {tableHeader}
                <TableBody>
                  {(pageItems as Emissao[]).map(renderRow)}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-3 border-t bg-slate-50 text-xs">
                  <span className="text-slate-600">
                    Página {pageSafe} de {totalPages} · mostrando {pageItems.length} de {filtered.length}
                  </span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" disabled={pageSafe <= 1} onClick={() => setPage(1)}>«</Button>
                    <Button size="sm" variant="outline" disabled={pageSafe <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹ Anterior</Button>
                    <Button size="sm" variant="outline" disabled={pageSafe >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Próxima ›</Button>
                    <Button size="sm" variant="outline" disabled={pageSafe >= totalPages} onClick={() => setPage(totalPages)}>»</Button>
                  </div>
                </div>
              )}
            </>
          )}
          {!isLoading && filtered.length > 0 && agruparCargo && grouped && (
            <div className="divide-y">
              {grouped.map(([cargo, items]) => {
                const collapsed = collapsedGroups[cargo] ?? false;
                const pend = items.filter((i) => i.status === "PENDENTE_ASSINATURA").length;
                const venc = items.filter((i) => bucketVencimento(i) === "VENCIDA").length;
                return (
                  <div key={cargo}>
                    <button
                      type="button"
                      onClick={() => setCollapsedGroups((s) => ({ ...s, [cargo]: !collapsed }))}
                      className="w-full flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 text-left transition"
                    >
                      {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      <Briefcase className="h-3.5 w-3.5 text-slate-500" />
                      <span className="font-bold text-sm text-slate-800">{cargo}</span>
                      <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
                      {pend > 0 && <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-300">{pend} pend.</Badge>}
                      {venc > 0 && <Badge variant="outline" className="text-[10px] bg-red-50 text-red-800 border-red-300">{venc} venc.</Badge>}
                    </button>
                    {!collapsed && (
                      <Table>
                        {tableHeader}
                        <TableBody>{items.map(renderRow)}</TableBody>
                      </Table>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {emitirOpen && (
        <EmitirOssDialog
          open={true}
          onClose={() => setEmitirOpen(false)}
          onIssued={() => qc.invalidateQueries({ queryKey: ["oss-emissoes"] })}
        />
      )}
      {!!previewDoc && (
        <Suspense fallback={null}>
          <PDFPreviewDialog
            open={!!previewDoc}
            onClose={() => setPreviewDoc(null)}
            doc={previewDoc?.doc ?? null}
            fileName={previewDoc?.name ?? "OSS.pdf"}
            title="Ordem de Serviço de Segurança"
          />
        </Suspense>
      )}
      <EmployeeQuickView
        employeeId={quickViewEmpId}
        open={!!quickViewEmpId}
        onClose={() => setQuickViewEmpId(null)}
      />
    </div>
  );
}

function UploadAssinadoButton({ onPick, disabled }: { onPick: (f: File) => void; disabled?: boolean }) {
  const inp = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={inp}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          if (inp.current) inp.current.value = "";
        }}
      />
      <Button variant="outline" size="sm" onClick={() => inp.current?.click()} disabled={disabled} title="Anexar PDF assinado" className="border-emerald-300 text-emerald-700 hover:bg-emerald-50">
        <Upload className="h-3.5 w-3.5 mr-1" />Assinado
      </Button>
    </>
  );
}

// =====================================================
// Emitir OSS Dialog
// =====================================================
function EmitirOssDialog({ open, onClose, onIssued }: { open: boolean; onClose: () => void; onIssued: () => void }) {
  const [companyId, setCompanyId] = useState<string>("");
  const [employeeId, setEmployeeId] = useState<string>("");
  const [templateId, setTemplateId] = useState<string>("");
  const [motivo, setMotivo] = useState<string>("ADMISSAO");

  // Lista de empresas (ATIVAS)
  const { data: companies = [] } = useQuery({
    queryKey: ["oss-emit-companies"],
    queryFn: async () => {
      const { data } = await supabase
        .from("companies")
        .select("id, name")
        .order("name");
      return data ?? [];
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["oss-emit-employees", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("id, nome, cpf, matricula, admissao, status, role_id, company_id, roles(name)")
        .eq("status", "ATIVO")
        .eq("company_id", companyId)
        .order("nome");
      return (data ?? []).map((e: any) => ({
        ...e,
        cargo: e.roles?.name ?? null,
      })) as Array<{
        id: string; nome: string; cpf: string | null; matricula: string | null;
        admissao: string | null; cargo: string | null;
      }>;
    },
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["oss-emit-templates"],
    queryFn: async () => {
      const { data } = await supabase
        .from("oss_templates")
        .select("id, cargo, cbo, titulo, setor, revisao, validade_meses, descricao_atividades, riscos_texto, medidas_preventivas, epis_obrigatorios, proibicoes, penalidades, procedimentos_emergencia, risco_fisico, risco_quimico, risco_biologico, risco_ergonomico, risco_acidente, risco_psicossocial")
        .eq("ativo", true)
        .order("cargo");
      return (data ?? []) as any[];
    },
  });

  const selectedEmp = employees.find((e) => e.id === employeeId);

  // Auto-selecionar template baseado no cargo do funcionário
  const autoSuggestedTemplate = useMemo(() => {
    if (!selectedEmp?.cargo) return null;
    const norm = (s: string) =>
      s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
    const target = norm(selectedEmp.cargo);
    return (
      templates.find((t) => norm(t.cargo) === target) ??
      templates.find((t) => norm(t.cargo).includes(target) || target.includes(norm(t.cargo))) ??
      null
    );
  }, [selectedEmp, templates]);

  const effectiveTemplateId = templateId || autoSuggestedTemplate?.id || "";

  const emit = useMutation({
    mutationFn: async () => {
      if (!employeeId) throw new Error("Selecione o funcionário");
      if (!effectiveTemplateId) throw new Error("Selecione o modelo de OSS");
      const tpl = templates.find((t) => t.id === effectiveTemplateId);
      const emp = selectedEmp;
      if (!tpl || !emp) throw new Error("Dados inválidos");

      const { error } = await supabase.from("oss_emissoes").insert({
        employee_id: employeeId,
        template_id: tpl.id,
        template_revisao: tpl.revisao,
        cargo_snapshot: emp.cargo ?? tpl.cargo,
        motivo_emissao: motivo as any,
        conteudo_snapshot: {
          cbo: (tpl as any).cbo ?? null,
          descricao_atividades: tpl.descricao_atividades,
          riscos_texto: tpl.riscos_texto,
          medidas_preventivas: tpl.medidas_preventivas,
          epis_obrigatorios: tpl.epis_obrigatorios,
          proibicoes: tpl.proibicoes,
          penalidades: tpl.penalidades,
          procedimentos_emergencia: tpl.procedimentos_emergencia,
          riscos_categorias: {
            fisico: (tpl as any).risco_fisico ?? null,
            quimico: (tpl as any).risco_quimico ?? null,
            biologico: (tpl as any).risco_biologico ?? null,
            ergonomico: (tpl as any).risco_ergonomico ?? null,
            acidente: (tpl as any).risco_acidente ?? null,
            psicossocial: (tpl as any).risco_psicossocial ?? null,
          },
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("OSS emitida — baixe o PDF, imprima e colete a assinatura física");
      onIssued();
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg sm:max-w-lg overflow-hidden">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-base">Emitir nova OSS</DialogTitle>
          <DialogDescription className="text-xs">
            Após emitir, baixe o PDF, imprima, colete as assinaturas físicas e anexe o PDF escaneado na lista.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 min-w-0">
          <div>
            <Label className="text-[10px] font-black uppercase">Empresa *</Label>
            <Select
              value={companyId}
              onValueChange={(v) => { setCompanyId(v); setEmployeeId(""); setTemplateId(""); }}
            >
              <SelectTrigger className="w-full min-w-0"><SelectValue placeholder="Selecione a empresa..." className="truncate" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] font-black uppercase">Funcionário *</Label>
            <Select value={employeeId} onValueChange={(v) => { setEmployeeId(v); setTemplateId(""); }} disabled={!companyId}>
              <SelectTrigger className="w-full min-w-0">
                <SelectValue placeholder={companyId ? "Selecione..." : "Escolha a empresa primeiro"} className="truncate" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {employees.length === 0 && companyId && (
                  <div className="px-2 py-3 text-xs text-slate-500">Nenhum funcionário ativo nesta empresa.</div>
                )}
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.nome} — {e.cargo ?? "(sem cargo)"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] font-black uppercase">Modelo de OSS *</Label>
            <Select value={effectiveTemplateId} onValueChange={setTemplateId}>
              <SelectTrigger className="w-full min-w-0"><SelectValue placeholder="Selecione o modelo..." className="truncate" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.cargo} — {t.titulo} (Rev. {t.revisao})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {autoSuggestedTemplate && !templateId && (
              <div className="text-[10px] text-emerald-700 mt-1">✓ Modelo sugerido pelo cargo do funcionário</div>
            )}
            {selectedEmp?.cargo && !autoSuggestedTemplate && (
              <div className="text-[10px] text-amber-700 mt-1">
                ⚠ Nenhum modelo para o cargo "{selectedEmp.cargo}". <Link to="/app/oss/templates" className="underline">Criar modelo</Link>
              </div>
            )}
          </div>
          <div>
            <Label className="text-[10px] font-black uppercase">Motivo da emissão</Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger className="w-full min-w-0"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMISSAO">Admissão</SelectItem>
                <SelectItem value="MUDANCA_CARGO">Mudança de cargo</SelectItem>
                <SelectItem value="REVISAO_RISCO">Revisão de risco / EPI</SelectItem>
                <SelectItem value="RECICLAGEM_ANUAL">Reciclagem anual</SelectItem>
                <SelectItem value="EMISSAO_MANUAL">Emissão manual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="flex-row justify-end gap-2 sm:gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={() => emit.mutate()} disabled={emit.isPending || !employeeId || !effectiveTemplateId} className="bg-rose-600 hover:bg-rose-700">
            <FileSignature className="h-4 w-4 mr-1" />Emitir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
