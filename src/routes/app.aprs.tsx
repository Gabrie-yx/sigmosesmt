import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, Pencil, Trash2, FileText, Filter, MoreHorizontal, Printer, Download, Eye, ShieldAlert, Zap, Copy, LayoutGrid, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/utils-date";
import { AprForm } from "@/components/aprs/apr-form";
import { AprModeloPicker, type AprModelo } from "@/components/aprs/apr-modelo-picker";
import { AplicarModeloLoteDialog } from "@/components/aprs/aplicar-modelo-lote-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { abrirAprPdf, imprimirAprPdf, baixarAprPdf, buildAprPdf } from "@/lib/apr-pdf-loader";
import { PDFPreviewDialog } from "@/components/pdf-preview-dialog";
import type jsPDF from "jspdf";
import { DEFAULT_TEXTO_GERAIS } from "@/lib/apr-defaults";

export const Route = createFileRoute("/app/aprs")({
  component: AprsPage,
});

const STATUS_TONE: Record<string, string> = {
  RASCUNHO: "bg-white/10 text-rose-100/80 border border-white/15",
  ATIVA: "bg-gradient-to-br from-emerald-600/80 to-emerald-900/80 text-emerald-50 border-emerald-400/40 shadow-[0_0_12px_-2px_rgba(16,185,129,0.5)]",
  ENCERRADA: "bg-black/40 text-rose-200/50 border border-white/10",
  CANCELADA: "bg-gradient-to-br from-rose-700/80 to-rose-900/80 text-rose-50 border border-rose-400/30",
};

const newAprDraft = {
  atividade_descricao: "",
  data_emissao: new Date().toISOString().slice(0, 10),
  validade_dias: 7,
  status: "RASCUNHO",
  exige_pte: false,
  texto_gerais: DEFAULT_TEXTO_GERAIS,
  hora_inicio: "07:30",
  hora_fim: "17:30",
  hora_inicio_sexta: "07:30",
  hora_fim_sexta: "16:30",
  dias_semana: ["SEG", "TER", "QUA", "QUI", "SEX"],
};

function AprsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { isEditor, isAdmin } = useAuth();
  const [editing, setEditing] = useState<string | null | "new">(null);
  const [modeloPickerOpen, setModeloPickerOpen] = useState(false);
  const [loteOpen, setLoteOpen] = useState(false);
  const [loteModeloId, setLoteModeloId] = useState<string | null>(null);
  const [loteCascoId, setLoteCascoId] = useState<string | null>(null);
  const [matrizOpen, setMatrizOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ATIVAS");
  const [filterCasco, setFilterCasco] = useState<string>("ALL");
  const [filterPeriodo, setFilterPeriodo] = useState<string>("30d");
  const [pdfDoc, setPdfDoc] = useState<jsPDF | null>(null);
  const [pdfName, setPdfName] = useState("apr.pdf");
  const [pdfAprId, setPdfAprId] = useState<string | null>(null);
  const [encSig, setEncSig] = useState<string | null>(null);
  const [tstSig, setTstSig] = useState<string | null>(null);
  const [dupSource, setDupSource] = useState<any | null>(null);
  const [dupCascoIds, setDupCascoIds] = useState<string[]>([]);

  async function openPreview(aprId: string, numero?: string | null, eSig?: string | null, tSig?: string | null) {
    try {
      const doc = await buildAprPdf(aprId, { encSig: eSig ?? null, tstSig: tSig ?? null });
      setPdfDoc(doc);
      setPdfName(`${numero ?? "apr"}.pdf`);
      setPdfAprId(aprId);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  const { data: aprs = [], isLoading } = useQuery({
    queryKey: ["aprs"],
    queryFn: async () => (await supabase.from("aprs").select("*").order("data_emissao", { ascending: false }).order("numero", { ascending: false })).data ?? [],
  });
  const { data: ptesLink = [] } = useQuery({
    queryKey: ["ptes-by-apr"],
    queryFn: async () => (await supabase.from("ptes").select("id,numero,apr_id,status")).data ?? [],
  });
  const { data: cascos = [] } = useQuery({
    queryKey: ["cascos-light-list"],
    queryFn: async () => (await supabase.from("cascos").select("id,numero,nome").order("numero")).data ?? [],
  });
  const { data: companies = [] } = useQuery({
    queryKey: ["companies-light-aprs"],
    queryFn: async () => (await supabase.from("companies").select("id,name")).data ?? [],
  });
  const { data: modelos = [] } = useQuery({
    queryKey: ["apr-modelos-ativos"],
    queryFn: async () => (await supabase.from("apr_modelos").select("id,nome,categoria,ordem").eq("ativo", true).order("ordem").order("nome")).data ?? [],
  });

  const cascoMap = useMemo(() => new Map(cascos.map((c: any) => [c.id, c])), [cascos]);
  const companyMap = useMemo(() => new Map(companies.map((c: any) => [c.id, c.name])), [companies]);
  const ptesByApr = useMemo(() => {
    const m = new Map<string, any[]>();
    ptesLink.forEach((p: any) => {
      if (!p.apr_id) return;
      const arr = m.get(p.apr_id) ?? [];
      arr.push(p);
      m.set(p.apr_id, arr);
    });
    return m;
  }, [ptesLink]);

  const filtered = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    let cutoff: string | null = null;
    if (filterPeriodo !== "all") {
      const days = filterPeriodo === "today" ? 0 : filterPeriodo === "7d" ? 7 : 30;
      const d = new Date();
      d.setDate(d.getDate() - days);
      cutoff = d.toISOString().slice(0, 10);
    }
    return aprs.filter((a: any) => {
      if (filterStatus === "ATIVAS") {
        if (a.status === "ENCERRADA" || a.status === "CANCELADA") return false;
      } else if (filterStatus !== "ALL" && a.status !== filterStatus) return false;
      if (filterCasco !== "ALL" && a.casco_id !== filterCasco) return false;
      if (cutoff && a.data_emissao && a.data_emissao < cutoff) return false;
      if (search) {
        const q = search.toLowerCase();
        const txt = `${a.numero ?? ""} ${a.atividade_descricao ?? ""} ${a.local ?? ""}`.toLowerCase();
        if (!txt.includes(q)) return false;
      }
      return true;
    }).map((a: any) => ({
      ...a,
      _vencida: a.data_validade && a.data_validade < today && a.status === "ATIVA",
    }));
  }, [aprs, search, filterStatus, filterCasco, filterPeriodo]);

  const grouped = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const in2 = new Date();
    in2.setDate(in2.getDate() + 2);
    const in2Str = in2.toISOString().slice(0, 10);
    const map = new Map<string, { casco: any; aprs: any[]; ativas: number; vencendo: number; pendentes: number }>();
    for (const a of filtered) {
      const key = a.casco_id ?? "__sem_casco__";
      let g = map.get(key);
      if (!g) {
        g = {
          casco: a.casco_id ? cascoMap.get(a.casco_id) ?? null : null,
          aprs: [],
          ativas: 0,
          vencendo: 0,
          pendentes: 0,
        };
        map.set(key, g);
      }
      g.aprs.push(a);
      if (a.status === "ATIVA") g.ativas++;
      if (a.data_validade && a.status === "ATIVA" && a.data_validade >= today && a.data_validade <= in2Str) g.vencendo++;
      const byApr = ptesByApr.get(a.id) ?? [];
      const legacy = a.pte_id ? (ptesLink as any[]).filter((p) => p.id === a.pte_id && p.apr_id !== a.id) : [];
      if (a.exige_pte && byApr.length + legacy.length === 0) g.pendentes++;
    }
    return Array.from(map.entries())
      .map(([key, g]) => ({ key, ...g }))
      .sort((a, b) => {
        const an = a.casco?.numero ?? "zzz";
        const bn = b.casco?.numero ?? "zzz";
        return String(an).localeCompare(String(bn));
      });
  }, [filtered, cascoMap, ptesByApr, ptesLink]);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("aprs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["aprs"] }); toast.success("APR excluída"); },
    onError: (e: any) => toast.error(e.message),
  });

  const duplicate = useMutation({
    mutationFn: async ({ srcId, cascoIds }: { srcId: string; cascoIds: string[] }) => {
      const [{ data: a, error: ea }, { data: rs, error: er }, { data: ass, error: eas }] = await Promise.all([
        supabase.from("aprs").select("*").eq("id", srcId).maybeSingle(),
        supabase.from("apr_riscos").select("*").eq("apr_id", srcId).order("ordem"),
        supabase.from("apr_assinaturas").select("*").eq("apr_id", srcId).order("ordem"),
      ]);
      if (ea) throw ea;
      if (er) throw er;
      if (eas) throw eas;
      if (!a) throw new Error("APR de origem não encontrada");

      const { id: _ignoreId, created_at, updated_at, numero: _oldNum, data_validade, pte_id, ...rest } = a as any;
      const criadas: { id: string; numero: string }[] = [];

      for (const cascoId of cascoIds) {
        const { data: numero, error: enErr } = await supabase.rpc("gerar_numero_apr");
        if (enErr) throw enErr;

        const payload = {
          ...rest,
          numero,
          casco_id: cascoId,
          pte_id: null,
          status: "RASCUNHO",
          data_emissao: new Date().toISOString().slice(0, 10),
        };
        const { data: novo, error: ein } = await supabase.from("aprs").insert(payload).select("id,numero").single();
        if (ein) throw ein;

        if (rs && rs.length > 0) {
          const { error: e2 } = await supabase.from("apr_riscos").insert(
            rs.map((r: any) => {
              const { id, created_at, apr_id, nivel_risco, ...rr } = r;
              return { ...rr, apr_id: novo.id };
            }),
          );
          if (e2) throw e2;
        }
        if (ass && ass.length > 0) {
          const { error: e3 } = await supabase.from("apr_assinaturas").insert(
            ass.map((s: any) => {
              const { id, created_at, apr_id, ...ss } = s;
              return { ...ss, apr_id: novo.id };
            }),
          );
          if (e3) throw e3;
        }
        criadas.push(novo);
      }
      return criadas;
    },
    onSuccess: (criadas: { numero: string }[]) => {
      qc.invalidateQueries({ queryKey: ["aprs"] });
      setDupSource(null);
      setDupCascoIds([]);
      if (criadas.length === 1) {
        toast.success(`APR ${criadas[0].numero} duplicada — revise e ative quando estiver pronta`);
      } else {
        toast.success(`${criadas.length} APRs criadas como RASCUNHO`);
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-4 md:p-8 h-full flex flex-col overflow-x-hidden">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5 md:mb-6 shrink-0">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-3xl font-black text-rose-100 flex items-center gap-2">
            <FileText className="h-6 w-6 md:h-7 md:w-7 shrink-0" />
            <span className="truncate">APR — Análise Preliminar de Risco</span>
          </h1>
          <p className="text-sm text-rose-200/60 mt-1">{filtered.length} APR(s) listadas</p>
        </div>
        {isEditor && (
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => { setLoteModeloId(null); setLoteCascoId(null); setLoteOpen(true); }}
              size="lg"
              variant="outline"
              className="border-rose-400/40 text-rose-100 bg-white/5 hover:bg-white/10"
            >
              <LayoutGrid className="h-4 w-4 mr-1" /> Aplicar a vários cascos
            </Button>
            <Button
              onClick={() => setModeloPickerOpen(true)}
              size="lg"
              variant="outline"
              className="border-amber-400/40 text-amber-200 bg-white/5 hover:bg-white/10"
            >
              <Zap className="h-4 w-4 mr-1" /> Modelo (editar)
            </Button>
            <Button
              onClick={() => {
                qc.setQueryData(["apr-form-draft", "new"], newAprDraft);
                qc.setQueryData(["apr-form-draft", "new-riscos"], []);
                setEditing("new");
              }}
              size="lg"
              className="bg-gradient-to-br from-rose-600 to-rose-900 hover:from-rose-500 hover:to-rose-800 text-white shadow-[0_0_20px_-4px_rgba(220,38,70,0.7)]"
            >
              <Plus className="h-4 w-4 mr-1" /> Nova APR
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-rose-950/60 to-black/40 border border-white/10 shadow-[inset_0_1px_0_rgba(255,230,235,0.05)] p-3 sm:p-4 mb-4 flex flex-wrap gap-2 sm:gap-3 shrink-0">
        <div className="relative w-full sm:flex-1 sm:min-w-[240px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-rose-200/60" />
          <Input placeholder="Buscar por número, atividade, local..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="flex-1 min-w-[140px] sm:flex-none sm:w-[160px]"><Filter className="h-3.5 w-3.5 mr-1" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ATIVAS">Ativas (padrão)</SelectItem>
            <SelectItem value="ALL">Todos status</SelectItem>
            <SelectItem value="RASCUNHO">Rascunho</SelectItem>
            <SelectItem value="ATIVA">Ativa</SelectItem>
            <SelectItem value="ENCERRADA">Encerrada</SelectItem>
            <SelectItem value="CANCELADA">Cancelada</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPeriodo} onValueChange={setFilterPeriodo}>
          <SelectTrigger className="flex-1 min-w-[140px] sm:flex-none sm:w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="all">Todo período</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCasco} onValueChange={setFilterCasco}>
          <SelectTrigger className="flex-1 min-w-[160px] sm:flex-none sm:w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos cascos</SelectItem>
            {cascos.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.numero}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Matriz de cobertura: Modelo × Casco */}
      {cascos.length > 0 && modelos.length > 0 && (
        <div className="rounded-2xl bg-gradient-to-br from-rose-950/60 to-black/40 border border-white/10 shadow-[inset_0_1px_0_rgba(255,230,235,0.05)] mb-4 shrink-0">
          <button
            type="button"
            onClick={() => setMatrizOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 rounded-t-2xl"
          >
            <div className="flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-rose-300" />
              <span className="font-black text-sm text-rose-100">Cobertura por casco</span>
              <span className="text-[11px] text-rose-200/60">— modelos × cascos. Clique na célula vazia para gerar APR.</span>
            </div>
            {matrizOpen ? <ChevronUp className="h-4 w-4 text-rose-200/60" /> : <ChevronDown className="h-4 w-4 text-rose-200/60" />}
          </button>
          {matrizOpen && (() => {
            // Set: `${modeloId}::${cascoId}` quando existe APR ATIVA/RASCUNHO
            const coverage = new Set<string>();
            for (const a of aprs as any[]) {
              if (a.modelo_id && a.casco_id && (a.status === "ATIVA" || a.status === "RASCUNHO")) {
                coverage.add(`${a.modelo_id}::${a.casco_id}`);
              }
            }
            return (
              <div className="overflow-x-auto border-t border-white/10">
                <table className="w-full text-xs">
                  <thead className="bg-black/30">
                    <tr>
                      <th className="text-left font-black text-rose-200/80 px-3 py-2 sticky left-0 bg-black/30 z-10 min-w-[180px]">
                        Modelo
                      </th>
                      {cascos.map((c: any) => (
                        <th key={c.id} className="font-black text-rose-100 px-2 py-2 text-center whitespace-nowrap">
                          {c.numero}
                          {c.nome && <div className="text-[9px] font-normal text-rose-200/50 truncate max-w-[80px]">{c.nome}</div>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {modelos.map((m: any) => (
                      <tr key={m.id} className="border-t border-white/5 hover:bg-white/5">
                        <td className="px-3 py-1.5 font-bold text-rose-100/90 sticky left-0 bg-[#1a0510] hover:bg-white/5 z-10">
                          {m.nome}
                        </td>
                        {cascos.map((c: any) => {
                          const tem = coverage.has(`${m.id}::${c.id}`);
                          return (
                            <td key={c.id} className="text-center p-1">
                              {tem ? (
                                <button
                                  type="button"
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 hover:bg-emerald-500/30"
                                  title="APR já existe — clique pra filtrar"
                                  onClick={() => {
                                    setFilterCasco(c.id);
                                    setSearch(m.nome);
                                  }}
                                >
                                  ✓
                                </button>
                              ) : isEditor ? (
                                <button
                                  type="button"
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-dashed border-white/20 text-rose-200/50 hover:border-rose-300 hover:text-rose-200 hover:bg-white/10"
                                  title={`Gerar APR "${m.nome}" para CASCO ${c.numero}`}
                                  onClick={() => { setLoteModeloId(m.id); setLoteCascoId(c.id); setLoteOpen(true); }}
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </button>
                              ) : (
                                <span className="text-rose-200/30">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      )}

      <div className="rounded-2xl bg-gradient-to-br from-rose-950/60 to-black/40 border border-white/10 shadow-[inset_0_1px_0_rgba(255,230,235,0.05)] flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="overflow-y-auto flex-1 p-2">
          {isLoading ? (
            <div className="text-center py-8 text-rose-200/60">Carregando…</div>
          ) : grouped.length === 0 ? (
            <div className="text-center py-12 text-rose-200/60">Nenhuma APR encontrada</div>
          ) : (
            <Accordion type="multiple" defaultValue={grouped.map((g) => g.key)} className="space-y-2">
              {grouped.map((g) => (
                <AccordionItem key={g.key} value={g.key} className="border border-white/10 rounded-xl bg-black/30 px-3">
                  <AccordionTrigger className="hover:no-underline py-3">
                    <div className="flex flex-wrap items-center gap-3 w-full">
                      <span className="font-black text-rose-100 text-base">
                        CASCO {g.casco?.numero ?? "—"}
                      </span>
                      {g.casco?.nome && <span className="text-xs text-rose-200/60">{g.casco.nome}</span>}
                      <span className="ml-auto flex items-center gap-2 mr-3">
                        <Badge variant="outline" className="bg-white/10 border-white/20 text-rose-100 text-[10px] font-black">
                          {g.aprs.length} APR{g.aprs.length !== 1 ? "s" : ""}
                        </Badge>
                        {g.ativas > 0 && (
                          <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-400/40 text-[10px] font-black">
                            {g.ativas} ATIVA{g.ativas !== 1 ? "S" : ""}
                          </Badge>
                        )}
                        {g.vencendo > 0 && (
                          <Badge className="bg-amber-500/20 text-amber-200 border-amber-400/40 text-[10px] font-black">
                            {g.vencendo} vencendo ≤2d
                          </Badge>
                        )}
                        {g.pendentes > 0 && (
                          <Badge className="bg-orange-500/20 text-orange-200 border-orange-400/40 text-[10px] font-black">
                            {g.pendentes} PTE pendente{g.pendentes !== 1 ? "s" : ""}
                          </Badge>
                        )}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-3">
                    <div className="rounded-lg border border-white/10 bg-black/20 overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Número</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead>Empresa</TableHead>
                            <TableHead>Atividade</TableHead>
                            <TableHead>Validade</TableHead>
                            <TableHead>PTEs</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {g.aprs.map((a: any) => {
                            const byApr = ptesByApr.get(a.id) ?? [];
                            const legacy = a.pte_id
                              ? (ptesLink as any[]).filter((p) => p.id === a.pte_id && p.apr_id !== a.id)
                              : [];
                            const linkedPtes = [...byApr, ...legacy];
                            return (
                              <TableRow key={a.id} className={a._vencida ? "bg-rose-900/20" : ""}>
                                <TableCell className="font-bold text-rose-200">{a.numero}</TableCell>
                                <TableCell className="text-sm">{formatDateBR(a.data_emissao)}</TableCell>
                                <TableCell className="text-sm">{a.empresa_id ? companyMap.get(a.empresa_id) ?? "—" : "—"}</TableCell>
                                <TableCell className="text-sm max-w-[280px] truncate" title={a.atividade_descricao}>{a.atividade_descricao}</TableCell>
                                <TableCell className="text-sm">
                                  {a.data_validade ? formatDateBR(a.data_validade) : "—"}
                                  {a._vencida && <Badge variant="destructive" className="ml-1 text-[9px]">VENCIDA</Badge>}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {a.exige_pte ? (
                                    linkedPtes.length > 0 ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 text-[10px] font-black"
                                        title={linkedPtes.map((p: any) => p.numero).join(", ")}>
                                        ✓ {linkedPtes.length} emitida{linkedPtes.length > 1 ? "s" : ""}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-400/30 text-[10px] font-black">
                                        <ShieldAlert className="h-3 w-3" /> Pendente
                                      </span>
                                    )
                                  ) : (
                                    <span className="text-rose-200/40 text-[10px]">N/A</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${STATUS_TONE[a.status] ?? ""}`}>{a.status}</span>
                                </TableCell>
                                <TableCell className="text-right">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button size="icon" variant="ghost" className="h-8 w-8">
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-52">
                                      <DropdownMenuItem onClick={() => abrirAprPdf(a.id).catch((e) => toast.error(e.message))}>
                                        <Eye className="h-4 w-4 mr-2" /> Visualizar PDF
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => imprimirAprPdf(a.id).catch((e) => toast.error(e.message))}>
                                        <Printer className="h-4 w-4 mr-2" /> Imprimir
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => baixarAprPdf(a.id, a.numero).catch((e) => toast.error(e.message))}>
                                        <Download className="h-4 w-4 mr-2" /> Baixar PDF
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      {isEditor && a.exige_pte && (
                                        <DropdownMenuItem
                                          className="text-orange-600 focus:text-orange-600"
                                          onClick={() => navigate({ to: "/app/ptes", search: { apr_id: a.id } as any })}
                                        >
                                          <ShieldAlert className="h-4 w-4 mr-2" /> Gerar PTE vinculada
                                        </DropdownMenuItem>
                                      )}
                                      {isEditor && (
                                        <DropdownMenuItem onClick={() => setEditing(a.id)}>
                                          <Pencil className="h-4 w-4 mr-2" /> Editar
                                        </DropdownMenuItem>
                                      )}
                                      {isEditor && (
                                        <DropdownMenuItem onClick={() => { setDupSource(a); setDupCascoIds([]); }}>
                                          <Copy className="h-4 w-4 mr-2" /> Duplicar para outros cascos
                                        </DropdownMenuItem>
                                      )}
                                      {isAdmin && (
                                        <DropdownMenuItem
                                          className="text-rose-600 focus:text-rose-600"
                                          onClick={() => { if (confirm(`Excluir ${a.numero}?`)) del.mutate(a.id); }}>
                                          <Trash2 className="h-4 w-4 mr-2" /> Excluir
                                        </DropdownMenuItem>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
      </div>

      <Dialog
        modal={false}
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
      >
        <DialogContent className="max-w-[95vw] w-[1200px] h-[92vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <DialogTitle>{editing === "new" ? "Nova APR" : "Editar APR"}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            <AprForm key={editing ?? "closed"} aprId={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
          </div>
        </DialogContent>
      </Dialog>

      <AprModeloPicker
        open={modeloPickerOpen}
        onOpenChange={setModeloPickerOpen}
        onSelect={(modelo: AprModelo) => {
          // Pré-popula APR com campos do modelo
          qc.setQueryData(["apr-form-draft", "new"], {
            ...newAprDraft,
            modelo_id: modelo.id,
            atividade_descricao: modelo.atividade_descricao,
            setor: modelo.setor_padrao ?? null,
            local: modelo.local_padrao ?? null,
            condicoes_climaticas: modelo.condicoes_climaticas ?? null,
            observacoes_gerais: modelo.observacoes_gerais ?? null,
            exige_pte: modelo.exige_pte,
          });
          // Pré-popula riscos (adiciona ordem)
          const riscosComOrdem = (modelo.riscos ?? []).map((r: any, i: number) => ({
            ordem: i + 1,
            risco_nome: r.risco_nome ?? "",
            risco_categoria: r.risco_categoria ?? null,
            efeitos_danos: r.efeitos_danos ?? null,
            probabilidade: r.probabilidade ?? 1,
            severidade: r.severidade ?? 1,
            acoes_preventivas: r.acoes_preventivas ?? null,
            epis: Array.isArray(r.epis) ? r.epis : [],
            nrs: Array.isArray(r.nrs) ? r.nrs : [],
            responsavel_acoes: r.responsavel_acoes ?? null,
            passo_a_passo: r.passo_a_passo ?? null,
          }));
          qc.setQueryData(["apr-form-draft", "new-riscos"], riscosComOrdem);
          setEditing("new");
          toast.success(`Modelo "${modelo.nome}" carregado — ${riscosComOrdem.length} riscos pré-preenchidos`);
        }}
      />

      <AplicarModeloLoteDialog
        open={loteOpen}
        onOpenChange={setLoteOpen}
        modeloPreselecionadoId={loteModeloId}
        cascoPreselecionadoId={loteCascoId}
      />

      <PDFPreviewDialog
        open={!!pdfDoc}
        onClose={() => { setPdfDoc(null); setPdfAprId(null); setEncSig(null); setTstSig(null); }}
        doc={pdfDoc}
        fileName={pdfName}
        title="Visualizar / Assinar APR"
        signable
        encSig={encSig}
        sesmtSig={tstSig}
        onChangeEncSig={(v) => { setEncSig(v); if (pdfAprId) openPreview(pdfAprId, pdfName.replace(/\.pdf$/, ""), v, tstSig); }}
        onChangeSesmtSig={(v) => { setTstSig(v); if (pdfAprId) openPreview(pdfAprId, pdfName.replace(/\.pdf$/, ""), encSig, v); }}
      />

      <Dialog open={!!dupSource} onOpenChange={(o) => { if (!o) { setDupSource(null); setDupCascoIds([]); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Duplicar APR {dupSource?.numero} para vários cascos</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-slate-600">
              Será criada 1 APR (status <b>RASCUNHO</b>) para <b>cada casco</b> marcado, copiando atividade,
              riscos, EPIs, NRs e assinaturas. Cada uma recebe número próprio; a PTE não é copiada.
            </p>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-700">Cascos destino</label>
                {(() => {
                  const disponiveis = cascos.filter((c: any) => c.id !== dupSource?.casco_id);
                  const todos = disponiveis.length > 0 && disponiveis.every((c: any) => dupCascoIds.includes(c.id));
                  return (
                    <button
                      type="button"
                      className="text-[10px] font-bold text-[#991b1b] hover:underline"
                      onClick={() => setDupCascoIds(todos ? [] : disponiveis.map((c: any) => c.id))}
                    >
                      {todos ? "Limpar" : "Marcar todos"}
                    </button>
                  );
                })()}
              </div>
              <div className="grid grid-cols-2 gap-1.5 max-h-[280px] overflow-y-auto pr-1">
                {cascos
                  .filter((c: any) => c.id !== dupSource?.casco_id)
                  .map((c: any) => {
                    const marcado = dupCascoIds.includes(c.id);
                    return (
                      <label
                        key={c.id}
                        className={`flex items-center gap-2 p-2 rounded border text-xs cursor-pointer ${
                          marcado ? "bg-[#991b1b]/5 border-[#991b1b]/40" : "bg-white border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <Checkbox
                          checked={marcado}
                          onCheckedChange={(v) =>
                            setDupCascoIds((prev) => (v ? [...prev, c.id] : prev.filter((x) => x !== c.id)))
                          }
                        />
                        <div className="min-w-0">
                          <div className="font-bold">CASCO {c.numero}</div>
                          {c.nome && <div className="text-[10px] text-slate-500 truncate">{c.nome}</div>}
                        </div>
                      </label>
                    );
                  })}
              </div>
              {dupSource?.casco_id && (
                <p className="text-[11px] text-slate-400 mt-2">
                  Origem: casco {cascoMap.get(dupSource.casco_id)?.numero ?? "—"}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="ghost" onClick={() => { setDupSource(null); setDupCascoIds([]); }}>Cancelar</Button>
              <Button
                className="bg-gradient-to-br from-rose-600 to-rose-900 hover:from-rose-500 hover:to-rose-800 text-white shadow-[0_0_20px_-4px_rgba(220,38,70,0.7)]"
                disabled={dupCascoIds.length === 0 || duplicate.isPending}
                onClick={() => dupSource && duplicate.mutate({ srcId: dupSource.id, cascoIds: dupCascoIds })}
              >
                {duplicate.isPending
                  ? "Duplicando..."
                  : `Duplicar para ${dupCascoIds.length || ""} casco${dupCascoIds.length !== 1 ? "s" : ""}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}