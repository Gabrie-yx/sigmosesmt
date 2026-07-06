import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, ArrowLeft, Calendar, Clock, Building2, MapPin, X, Users, Eye, Pencil, Trash2, ChevronDown } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { HoraExtraSabadoDialog } from "@/components/hora-extra-sabado-dialog";
import { gerarHoraExtraSabadoPDF } from "@/lib/hora-extra-sabado-pdf";
import { PDFPreviewDialog } from "@/components/pdf-preview-dialog";
import { compressSignatureForPdf, compressSignaturesBatch } from "@/lib/signature-utils";
import type jsPDF from "jspdf";
import dmnLogo from "@/assets/dmn-logo.png";

export const Route = createFileRoute("/app/employees/hora-extra-sabado")({
  component: HoraExtraSabadoPage,
});

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

async function imageToDataUrl(src: string): Promise<string | null> {
  try {
    const res = await fetch(src);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function HoraExtraSabadoPage() {
  const qc = useQueryClient();
  const { user, isEditor, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [previewDoc, setPreviewDoc] = useState<jsPDF | null>(null);
  const [previewFileName, setPreviewFileName] = useState("hora-extra.pdf");
  const [previewFichaId, setPreviewFichaId] = useState<string | null>(null);
  const [tstSig, setTstSig] = useState<string | null>(null);
  const [gestorSig, setGestorSig] = useState<string | null>(null);
  const [empresaFiltro, setEmpresaFiltro] = useState<string>("todas");
  const [turnoFiltro, setTurnoFiltro] = useState<string>("todos");
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [mesAberto, setMesAberto] = useState<string | null>(null);
  // Cache pesado por ficha: evita re-baixar lista + recomprimir todas as
  // assinaturas dos funcionários toda vez que o TST/Gestor assina no preview.
  const pdfCacheRef = useRef<Map<string, { rec: any; paginas: any[]; empresasEnvolvidas: string[]; logo: string | null }>>(new Map());

  const { data: fichas, isLoading } = useQuery({
    queryKey: ["hora-extra-sabado"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hora_extra_sabado")
        .select("*, companies(name), hora_extra_sabado_funcionarios(id, nome, funcao, externo, presenca, employee_id, employees(companies(name)))")
        .order("data", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("excluir_convocacao_extra_lider", { _hora_extra_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hora-extra-sabado"] });
      toast.success("Ficha arquivada com histórico preservado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function gerarPdf(id: string) {
    setDetalheId(null);
    const cached = pdfCacheRef.current.get(id);
    const { data: rec } = await supabase
      .from("hora_extra_sabado")
      .select("*, companies(name)")
      .eq("id", id)
      .maybeSingle();
    if (!rec) return toast.error("Registro não encontrado");
    const tstRaw = (rec as any).assinatura_tst_data ?? null;
    const gestorRaw = (rec as any).assinatura_gestor_data ?? null;
    // Comprime as 2 assinaturas do rodapé em paralelo (60-100KB → ~6KB cada).
    const [tst, gestor] = await Promise.all([
      compressSignatureForPdf(tstRaw),
      compressSignatureForPdf(gestorRaw),
    ]);
    setTstSig(tst);
    setGestorSig(gestor);
    let paginas: any[];
    let empresasEnvolvidas: string[];
    let logo: string | null;
    if (cached) {
      paginas = cached.paginas;
      empresasEnvolvidas = cached.empresasEnvolvidas;
      logo = cached.logo;
    } else {
      const { data: list, error: listError } = await supabase
        .from("hora_extra_sabado_funcionarios")
        .select("*, employees(id, company_id, assinatura_url, companies(name))")
        .eq("hora_extra_id", id)
        .order("ordem");
      if (listError) return toast.error(listError.message);

      logo = await imageToDataUrl(dmnLogo);

      const sigsCompactas = await compressSignaturesBatch(
        (list ?? []).map((f: any) => f.employees?.assinatura_url ?? null),
      );
      const empresaPadrao = (rec as any).companies?.name ?? "EXTERNOS";
      const grupos = new Map<string, any[]>();
      (list ?? []).forEach((f: any, idx: number) => {
        const empNome =
          f.employees?.companies?.name ??
          (f.externo ? "EXTERNOS" : empresaPadrao);
        if (!grupos.has(empNome)) grupos.set(empNome, []);
        grupos.get(empNome)!.push({ ...f, _sigCompacta: sigsCompactas[idx] });
      });
      const ordenadas = Array.from(grupos.entries()).sort(([a], [b]) => {
        if (a === "EXTERNOS") return 1;
        if (b === "EXTERNOS") return -1;
        return a.localeCompare(b, "pt-BR");
      });
      empresasEnvolvidas = ordenadas.map(([e]) => e);
      paginas = ordenadas.map(([empresaNome, fs]) => ({
        empresaNome,
        funcionarios: fs.map((f: any) => ({
          nome: f.nome,
          transporte: f.transporte,
          alimentacao: f.alimentacao,
          presenca: f.presenca,
          assinaturaDataUrl: f._sigCompacta ?? f.employees?.assinatura_url ?? null,
        })),
      }));
      pdfCacheRef.current.set(id, { rec, paginas, empresasEnvolvidas, logo });
    }

    const d = new Date(rec.data + "T12:00:00");
    const ddmmyyyy = d.toLocaleDateString("pt-BR");
    const dia = DIAS[d.getDay()];
    const horario = rec.horario_inicio && rec.horario_fim ? `${rec.horario_inicio} às ${rec.horario_fim}` : rec.horario_inicio || "—";

    const doc = gerarHoraExtraSabadoPDF({
      data: ddmmyyyy,
      diaSemana: dia,
      turno: rec.turno,
      horario,
      setor: rec.setor,
      centroCusto: rec.centro_custo,
      tipoEfetivo: rec.tipo_efetivo as any,
      observacao: rec.observacao,
      logoDataUrl: logo,
      assinaturaTstDataUrl: tst,
      assinaturaGestorDataUrl: gestor,
      solicitanteNome:
        (user as any)?.user_metadata?.full_name ??
        (user as any)?.email?.split("@")[0] ??
        null,
      empresasEnvolvidas,
      paginas,
    });
    setPreviewFileName(`hora-extra-${rec.data}.pdf`);
    setPreviewDoc(doc);
    setPreviewFichaId(id);
  }

  async function saveSig(field: "assinatura_tst_data" | "assinatura_gestor_data", value: string | null) {
    if (!previewFichaId) return;
    const patch = (field === "assinatura_tst_data"
      ? { assinatura_tst_data: value }
      : { assinatura_gestor_data: value });
    const { error } = await supabase
      .from("hora_extra_sabado")
      .update(patch)
      .eq("id", previewFichaId);
    if (error) return toast.error(error.message);
    toast.success(value ? "Assinatura salva" : "Assinatura removida");
    // Regenera o PDF mantendo o preview aberto
    await gerarPdf(previewFichaId);
  }

  const filtradas = (fichas ?? []).filter((f: any) => {
    if (empresaFiltro !== "todas" && (f.companies?.name ?? "") !== empresaFiltro) return false;
    if (turnoFiltro !== "todos" && String(f.turno ?? "") !== turnoFiltro) return false;
    if (!busca.trim()) return true;
    const s = busca.toLowerCase();
    return (
      (f.setor ?? "").toLowerCase().includes(s) ||
      (f.centro_custo ?? "").toLowerCase().includes(s) ||
      (f.companies?.name ?? "").toLowerCase().includes(s) ||
      f.data.includes(s)
    );
  });

  // Agrupa fichas filtradas por mês (YYYY-MM), ordenado desc.
  const gruposPorMes = useMemo(() => {
    const map = new Map<string, any[]>();
    filtradas.forEach((f: any) => {
      const key = f.data.slice(0, 7); // YYYY-MM
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, itens]) => {
        const [y, m] = key.split("-").map(Number);
        const label = new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
        return { key, label, itens };
      });
  }, [filtradas]);

  // Mês aberto por padrão: o mais recente com fichas.
  const mesAtivo = mesAberto ?? gruposPorMes[0]?.key ?? null;

  const empresasUnicas = useMemo(() => {
    const s = new Set<string>();
    (fichas ?? []).forEach((f: any) => { if (f.companies?.name) s.add(f.companies.name); });
    return Array.from(s).sort();
  }, [fichas]);

  const turnosUnicos = useMemo(() => {
    const s = new Set<string>();
    (fichas ?? []).forEach((f: any) => { if (f.turno) s.add(String(f.turno)); });
    return Array.from(s).sort();
  }, [fichas]);

  const fichaDetalhe = (fichas ?? []).find((f: any) => f.id === detalheId);

  const temFiltro = empresaFiltro !== "todas" || turnoFiltro !== "todos" || busca.trim() !== "";
  function limparFiltros() {
    setEmpresaFiltro("todas"); setTurnoFiltro("todos"); setBusca("");
  }

  return (
    <div className="p-6 md:p-8 animate-fadeIn">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link to="/app/employees" className="rounded-full p-2 hover:bg-slate-100"><ArrowLeft className="h-4 w-4" /></Link>
          <div>
            <h2 className="heading-display text-3xl md:text-4xl text-brand">Hora extra — sábado</h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">
              Fichas de escala para o sábado
            </p>
          </div>
        </div>
        {isEditor && (
          <div className="flex items-center gap-2">
            <Button onClick={() => { setEditId(null); setOpen(true); }} className="bg-[#0f172a] hover:bg-brand text-white text-[11px] font-black uppercase tracking-widest rounded-xl px-5 py-3 h-auto shadow-lg">
              <Plus className="h-4 w-4 mr-2" />Nova ficha
            </Button>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={empresaFiltro} onValueChange={setEmpresaFiltro}>
          <SelectTrigger className="h-8 w-[180px] text-xs bg-white/[0.03] border-white/10 text-slate-200">
            <SelectValue placeholder="Empresa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as empresas</SelectItem>
            {empresasUnicas.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={turnoFiltro} onValueChange={setTurnoFiltro}>
          <SelectTrigger className="h-8 w-[120px] text-xs bg-white/[0.03] border-white/10 text-slate-200">
            <SelectValue placeholder="Turno" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos turnos</SelectItem>
            {turnosUnicos.map((t) => <SelectItem key={t} value={t}>{t}º turno</SelectItem>)}
          </SelectContent>
        </Select>
        <Input
          className="h-8 max-w-[220px] text-xs bg-white/[0.03] border-white/10 text-slate-200 placeholder:text-slate-500"
          placeholder="Buscar…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        {temFiltro && (
          <button onClick={limparFiltros} className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-rose-300 inline-flex items-center gap-1">
            <X className="h-3 w-3" /> Limpar
          </button>
        )}
        <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-slate-400">
          {filtradas.length} ficha{filtradas.length === 1 ? "" : "s"}
        </span>
      </div>

      {isLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />)}
        </div>
      ) : filtradas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Calendar className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold uppercase tracking-widest text-slate-500">Nenhuma ficha registrada</p>
          <p className="text-xs text-slate-400 mt-1">Crie a primeira clicando em "Nova ficha".</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {gruposPorMes.map((grupo, idx) => {
            const accents = [
              { border: "border-white/20",       glow: "shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_10px_40px_-15px_rgba(255,255,255,0.15)]", text: "text-slate-100",   ring: "ring-white/20"   },
              { border: "border-amber-400/60",   glow: "shadow-[0_0_0_1px_rgba(251,191,36,0.25),0_10px_40px_-15px_rgba(251,191,36,0.35)]",   text: "text-amber-200",    ring: "ring-amber-400/40" },
              { border: "border-rose-500/60",    glow: "shadow-[0_0_0_1px_rgba(244,63,94,0.25),0_10px_40px_-15px_rgba(244,63,94,0.4)]",     text: "text-rose-200",     ring: "ring-rose-400/40"  },
              { border: "border-yellow-400/60",  glow: "shadow-[0_0_0_1px_rgba(250,204,21,0.25),0_10px_40px_-15px_rgba(250,204,21,0.35)]",  text: "text-yellow-200",   ring: "ring-yellow-400/40"},
              { border: "border-emerald-400/60", glow: "shadow-[0_0_0_1px_rgba(52,211,153,0.25),0_10px_40px_-15px_rgba(52,211,153,0.35)]",  text: "text-emerald-200",  ring: "ring-emerald-400/40"},
              { border: "border-sky-400/60",     glow: "shadow-[0_0_0_1px_rgba(56,189,248,0.25),0_10px_40px_-15px_rgba(56,189,248,0.35)]",  text: "text-sky-200",      ring: "ring-sky-400/40"   },
            ];
            const a = accents[idx % accents.length];
            return (
            <div
              key={grupo.key}
              className={`relative rounded-2xl border ${a.border} ${a.glow} bg-gradient-to-br from-[#1a0608] via-[#12040a] to-black p-5 transition-all hover:-translate-y-0.5`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="min-w-0">
                  <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] ${a.text} truncate`}>{grupo.label}</h3>
                  <div className={`text-4xl font-black tabular-nums leading-none mt-2 ${a.text}`}>
                    {grupo.itens.length}
                  </div>
                  <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mt-1">
                    ficha{grupo.itens.length === 1 ? "" : "s"} no mês
                  </div>
                </div>
                <div className={`shrink-0 grid place-items-center h-9 w-9 rounded-full ring-1 ${a.ring} ${a.text}`}>
                  <Calendar className="h-4 w-4" />
                </div>
              </div>
              <div className="grid gap-2 pt-3 border-t border-white/5">
                {grupo.itens.map((f: any) => {
                  const d = new Date(f.data + "T12:00:00");
                  const dia = DIAS[d.getDay()];
                  const qtd = f.hora_extra_sabado_funcionarios?.length ?? 0;
                  const indeferida = f.status === "INDEFERIDA";
                  const aprovada = f.status === "APROVADA";
                  return (
                    <button
                      key={f.id}
                      onClick={() => setDetalheId(f.id)}
                      className={`w-full text-left rounded-xl border bg-white/[0.02] hover:bg-white/[0.06] transition-all px-3 py-2 flex items-center gap-3 ${
                        indeferida
                          ? "animate-indeferida"
                          : "border-white/10 hover:border-rose-400/40"
                      }`}
                    >
                      <div className="flex flex-col items-center justify-center w-12 shrink-0">
                        <span className="text-[9px] font-black uppercase tracking-widest text-rose-300">{dia.slice(0,3)}</span>
                        <span className="text-lg font-black tabular-nums text-slate-100 leading-none">{d.getDate().toString().padStart(2,"0")}</span>
                      </div>
                      <div className="h-9 w-px bg-white/10" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-slate-100 truncate inline-flex items-center gap-1.5">
                          <Building2 className="h-3 w-3 text-rose-300" />{f.companies?.name ?? "—"}
                          {indeferida && (
                            <span className="ml-1 inline-flex items-center rounded border border-amber-400/60 bg-destructive/25 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-200">
                              Indeferida
                            </span>
                          )}
                          {aprovada && (
                            <span className="ml-1 inline-flex items-center rounded border border-emerald-400/50 bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-200">
                              Aprovada
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-300 truncate inline-flex items-center gap-1.5 mt-0.5"><Clock className="h-3 w-3 text-rose-300" />{f.horario_inicio ?? "—"}{f.horario_fim ? ` – ${f.horario_fim}` : ""} · {f.turno ?? "—"}º · <Users className="h-3 w-3" />{qtd}</div>
                        {indeferida && f.motivo_indeferimento && (
                          <div className="mt-1 text-[10px] text-rose-100/90 line-clamp-1">
                            <span className="font-black text-amber-300">Motivo:</span> {f.motivo_indeferimento}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* Modal de detalhes */}
      <Dialog open={!!detalheId} onOpenChange={(o) => !o && setDetalheId(null)}>
        <DialogContent className="w-full sm:max-w-lg bg-[#1a0608]/95 backdrop-blur-sm border-white/10 text-slate-100">
          {fichaDetalhe && (() => {
            const d = new Date(fichaDetalhe.data + "T12:00:00");
            const dia = DIAS[d.getDay()];
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="text-2xl font-black text-rose-200">
                    {d.toLocaleDateString("pt-BR")}
                  </DialogTitle>
                  <DialogDescription className="text-slate-400">
                    {dia} · {fichaDetalhe.tipo_efetivo} · {fichaDetalhe.hora_extra_sabado_funcionarios?.length ?? 0} funcionários
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-6 space-y-4 text-sm">
                  {fichaDetalhe.companies?.name && (
                    <div className="flex items-start gap-2"><Building2 className="h-4 w-4 text-rose-300 mt-0.5" /><div><div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Empresa</div><div>{fichaDetalhe.companies.name}</div></div></div>
                  )}
                  {fichaDetalhe.turno && (
                    <div className="flex items-start gap-2"><Clock className="h-4 w-4 text-rose-300 mt-0.5" /><div><div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Turno / Horário</div><div>{fichaDetalhe.turno}º — {fichaDetalhe.horario_inicio} às {fichaDetalhe.horario_fim ?? "—"}</div></div></div>
                  )}
                  {fichaDetalhe.setor && (
                    <div className="flex items-start gap-2"><MapPin className="h-4 w-4 text-rose-300 mt-0.5" /><div><div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Setor</div><div>{fichaDetalhe.setor}</div></div></div>
                  )}
                  {fichaDetalhe.centro_custo && (
                    <div className="flex items-start gap-2"><MapPin className="h-4 w-4 text-rose-300 mt-0.5" /><div><div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Centro de custo</div><div>{fichaDetalhe.centro_custo}</div></div></div>
                  )}
                  {fichaDetalhe.observacao && (
                    <div className="rounded-lg bg-white/[0.03] border border-white/10 p-3 text-xs text-slate-300">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Observação</div>
                      {fichaDetalhe.observacao}
                    </div>
                  )}
                  {(() => {
                    const tipo = fichaDetalhe.tipo_convocacao === "DIAS_UTEIS" ? "Dia útil" : "Sábado";
                    const funcs = fichaDetalhe.hora_extra_sabado_funcionarios ?? [];
                    return (
                      <>
                        <div className="flex items-start gap-2">
                          <Calendar className="h-4 w-4 text-rose-300 mt-0.5" />
                          <div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tipo</div>
                            <div>
                              <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest bg-rose-500/20 text-rose-200 border border-rose-400/40">
                                {tipo}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Users className="h-4 w-4 text-rose-300" />
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              Funcionários ({funcs.length})
                            </div>
                          </div>
                          {funcs.length === 0 ? (
                            <div className="text-xs text-slate-500 italic px-1">Nenhum funcionário marcado.</div>
                          ) : (
                            (() => {
                              const empresaFicha = fichaDetalhe.companies?.name ?? "Sem empresa";
                              const grupos = new Map<string, any[]>();
                              for (const f of funcs) {
                                const emp = f.employees?.companies?.name
                                  ?? (f.externo ? "Sem empresa" : empresaFicha);
                                if (!grupos.has(emp)) grupos.set(emp, []);
                                grupos.get(emp)!.push(f);
                              }
                              const ordenadas = Array.from(grupos.entries())
                                .sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
                              return (
                                <div className="max-h-64 overflow-y-auto rounded-lg border border-white/10 bg-white/[0.02] divide-y divide-white/10">
                                  {ordenadas.map(([empresa, lista]) => (
                                    <div key={empresa}>
                                      <div className="sticky top-0 z-10 flex items-center justify-between px-3 py-1.5 bg-rose-500/10 border-b border-rose-400/30">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-rose-200">{empresa}</span>
                                        <span className="text-[10px] font-bold text-rose-100/70">{lista.length}</span>
                                      </div>
                                      <ul className="divide-y divide-white/5">
                                        {lista.map((f: any) => (
                                          <li key={f.id} className="px-3 py-2 flex items-center justify-between gap-2 text-xs">
                                            <span className="truncate text-slate-100">
                                              {f.nome}
                                              {f.externo ? <span className="ml-1 text-[10px] text-amber-300">(externo)</span> : null}
                                              {f.funcao ? <span className="text-slate-400"> · {f.funcao}</span> : null}
                                            </span>
                                            {f.presenca && (
                                              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">{f.presenca}</span>
                                            )}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  ))}
                                </div>
                              );
                            })()
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
                <div className="mt-6 flex flex-wrap gap-2 pt-4 border-t border-white/10">
                  <Button onClick={() => gerarPdf(fichaDetalhe.id)} className="bg-rose-500 hover:bg-rose-600 text-white">
                    <Eye className="h-4 w-4 mr-1.5" />Prévia PDF
                  </Button>
                  {isEditor && (
                    <Button variant="outline" className="border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.08]" onClick={() => { setEditId(fichaDetalhe.id); setDetalheId(null); setOpen(true); }}>
                      <Pencil className="h-4 w-4 mr-1.5" />Editar
                    </Button>
                  )}
                  {isAdmin && (
                    <Button variant="outline" className="border-rose-400/30 text-rose-300 hover:bg-rose-500/10 ml-auto" onClick={() => { if (confirm("Excluir esta ficha?")) { del.mutate(fichaDetalhe.id); setDetalheId(null); } }}>
                      <Trash2 className="h-4 w-4 mr-1.5" />Excluir
                    </Button>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <HoraExtraSabadoDialog
        open={open}
        onOpenChange={(o) => {
          // Ao fechar o modal de edição/criação, invalida o cache do PDF
          // dessa ficha — os dados podem ter mudado (funcionários, horário).
          if (!o && editId) pdfCacheRef.current.delete(editId);
          setOpen(o);
        }}
        editId={editId}
      />
      <PDFPreviewDialog
        open={!!previewDoc}
        onClose={() => { setPreviewDoc(null); setPreviewFichaId(null); setTstSig(null); setGestorSig(null); }}
        doc={previewDoc}
        fileName={previewFileName}
        title="Prévia da ficha de hora extra"
        signable
        useSignatureGallery
        signatureLabels={{ enc: "Téc. Segurança", sesmt: "Aprovação / Gestor" }}
        encSig={tstSig}
        sesmtSig={gestorSig}
        onChangeEncSig={(v) => saveSig("assinatura_tst_data", v)}
        onChangeSesmtSig={(v) => saveSig("assinatura_gestor_data", v)}
      />
    </div>
  );
}
