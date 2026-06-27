import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, ArrowLeft, Pencil, Trash2, Calendar, Eye, Users, Clock, Building2, MapPin, X, List, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
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
  const [periodo, setPeriodo] = useState<"todos" | "mes" | "mes_passado" | "30d">("mes");
  const [empresaFiltro, setEmpresaFiltro] = useState<string>("todas");
  const [turnoFiltro, setTurnoFiltro] = useState<string>("todos");
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"lista" | "calendario">("lista");
  const [cursorMes, setCursorMes] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });

  const { data: fichas, isLoading } = useQuery({
    queryKey: ["hora-extra-sabado"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hora_extra_sabado")
        .select("*, companies(name), hora_extra_sabado_funcionarios(id)")
        .order("data", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("hora_extra_sabado").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hora-extra-sabado"] });
      toast.success("Ficha excluída");
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function gerarPdf(id: string) {
    setDetalheId(null);
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
    const { data: list, error: listError } = await supabase
      .from("hora_extra_sabado_funcionarios")
      .select("*, employees(id, company_id, assinatura_url, companies(name))")
      .eq("hora_extra_id", id)
      .order("ordem");
    if (listError) return toast.error(listError.message);

    const d = new Date(rec.data + "T12:00:00");
    const ddmmyyyy = d.toLocaleDateString("pt-BR");
    const dia = DIAS[d.getDay()];
    const horario = rec.horario_inicio && rec.horario_fim ? `${rec.horario_inicio} às ${rec.horario_fim}` : rec.horario_inicio || "—";

    const logo = await imageToDataUrl(dmnLogo);

    // Comprime TODAS as assinaturas dos funcionários em paralelo ANTES de
    // montar o PDF. Antes: cada addImage parseava um PNG ~17KB; agora ~3KB.
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
    // Sempre 1 página por empresa, ordem alfabética (EXTERNOS por último).
    const ordenadas = Array.from(grupos.entries()).sort(([a], [b]) => {
      if (a === "EXTERNOS") return 1;
      if (b === "EXTERNOS") return -1;
      return a.localeCompare(b, "pt-BR");
    });
    const empresasEnvolvidas = ordenadas.map(([e]) => e);
    const paginas = ordenadas.map(([empresaNome, fs]) => ({
      empresaNome,
      funcionarios: fs.map((f: any) => ({
        nome: f.nome,
        transporte: f.transporte,
        alimentacao: f.alimentacao,
        presenca: f.presenca,
        assinaturaDataUrl: f._sigCompacta ?? f.employees?.assinatura_url ?? null,
      })),
    }));

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
    const d = new Date(f.data + "T12:00:00");
    if (viewMode === "calendario") {
      if (d.getMonth() !== cursorMes.getMonth() || d.getFullYear() !== cursorMes.getFullYear()) return false;
    } else if (periodo !== "todos") {
      const hoje = new Date();
      if (periodo === "mes") {
        if (d.getMonth() !== hoje.getMonth() || d.getFullYear() !== hoje.getFullYear()) return false;
      } else if (periodo === "mes_passado") {
        const ref = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
        if (d.getMonth() !== ref.getMonth() || d.getFullYear() !== ref.getFullYear()) return false;
      } else if (periodo === "30d") {
        const limite = new Date(); limite.setDate(limite.getDate() - 30);
        if (d < limite) return false;
      }
    }
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

  const temFiltro = periodo !== "todos" || empresaFiltro !== "todas" || turnoFiltro !== "todos" || busca.trim() !== "";
  function limparFiltros() {
    setPeriodo("todos"); setEmpresaFiltro("todas"); setTurnoFiltro("todos"); setBusca("");
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
          <Button onClick={() => { setEditId(null); setOpen(true); }} className="bg-[#0f172a] hover:bg-brand text-white text-[11px] font-black uppercase tracking-widest rounded-xl px-5 py-3 h-auto shadow-lg">
            <Plus className="h-4 w-4 mr-2" />Nova ficha
          </Button>
        )}
      </div>

      {/* Toggle + filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-full border border-white/10 bg-white/[0.03] p-0.5">
          {([
            { id: "lista", label: "Lista", Icon: List },
            { id: "calendario", label: "Calendário", Icon: Calendar },
          ] as const).map((v) => (
            <button
              key={v.id}
              onClick={() => setViewMode(v.id)}
              className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full transition-all ${
                viewMode === v.id ? "bg-rose-500/20 text-rose-100" : "text-slate-300 hover:text-slate-100"
              }`}
            >
              <v.Icon className="h-3 w-3" />{v.label}
            </button>
          ))}
        </div>
        {viewMode === "lista" ? (
          <>
            {[
              { id: "mes", label: "Este mês" },
              { id: "mes_passado", label: "Mês passado" },
              { id: "30d", label: "Últimos 30d" },
              { id: "todos", label: "Todos" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriodo(p.id as any)}
                className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border transition-all ${
                  periodo === p.id
                    ? "bg-rose-500/20 border-rose-400/40 text-rose-100"
                    : "bg-white/[0.03] border-white/10 text-slate-300 hover:bg-white/[0.06]"
                }`}
              >
                {p.label}
              </button>
            ))}
          </>
        ) : (
          <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-1">
            <button onClick={() => setCursorMes(new Date(cursorMes.getFullYear(), cursorMes.getMonth() - 1, 1))} className="p-1 rounded-full hover:bg-white/[0.06] text-slate-300"><ChevronLeft className="h-3.5 w-3.5" /></button>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-100 px-2 min-w-[110px] text-center">
              {cursorMes.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
            </span>
            <button onClick={() => setCursorMes(new Date(cursorMes.getFullYear(), cursorMes.getMonth() + 1, 1))} className="p-1 rounded-full hover:bg-white/[0.06] text-slate-300"><ChevronRight className="h-3.5 w-3.5" /></button>
            <button onClick={() => { const d = new Date(); setCursorMes(new Date(d.getFullYear(), d.getMonth(), 1)); }} className="text-[9px] font-black uppercase tracking-widest text-rose-200 hover:text-rose-100 px-2">Hoje</button>
          </div>
        )}
        <div className="h-5 w-px bg-white/10 mx-1" />
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
      ) : viewMode === "calendario" ? (
        (() => {
          const ano = cursorMes.getFullYear();
          const mes = cursorMes.getMonth();
          const primeiroDia = new Date(ano, mes, 1).getDay();
          const diasNoMes = new Date(ano, mes + 1, 0).getDate();
          const porDia = new Map<number, any[]>();
          filtradas.forEach((f: any) => {
            const dia = new Date(f.data + "T12:00:00").getDate();
            if (!porDia.has(dia)) porDia.set(dia, []);
            porDia.get(dia)!.push(f);
          });
          const celulas: Array<{ dia: number | null }> = [];
          for (let i = 0; i < primeiroDia; i++) celulas.push({ dia: null });
          for (let i = 1; i <= diasNoMes; i++) celulas.push({ dia: i });
          const hojeRef = new Date();
          const isHoje = (d: number) => hojeRef.getDate() === d && hojeRef.getMonth() === mes && hojeRef.getFullYear() === ano;
          return (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
              <div className="grid grid-cols-7 gap-1 mb-1">
                {["DOM","SEG","TER","QUA","QUI","SEX","SÁB"].map((d) => (
                  <div key={d} className="text-[9px] font-black uppercase tracking-widest text-slate-500 text-center py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {celulas.map((c, idx) => {
                  if (c.dia === null) return <div key={idx} />;
                  const fs = porDia.get(c.dia) ?? [];
                  const temFichas = fs.length > 0;
                  const dow = new Date(ano, mes, c.dia).getDay();
                  const fimDeSemana = dow === 0 || dow === 6;
                  return (
                    <div
                      key={idx}
                      className={`min-h-[78px] rounded-lg border p-1.5 flex flex-col gap-1 transition-all ${
                        temFichas ? "border-rose-400/30 bg-rose-500/[0.06]" : "border-white/5 bg-white/[0.01]"
                      } ${fimDeSemana ? "ring-1 ring-white/5" : ""}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[11px] font-black tabular-nums ${isHoje(c.dia) ? "text-rose-200 bg-rose-500/30 rounded-full w-5 h-5 inline-flex items-center justify-center" : "text-slate-300"}`}>{c.dia}</span>
                        {temFichas && <span className="text-[9px] font-bold text-rose-200">{fs.length}</span>}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        {fs.slice(0, 2).map((f: any) => (
                          <button
                            key={f.id}
                            onClick={() => setDetalheId(f.id)}
                            className="text-left rounded bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/30 px-1 py-0.5 text-[9px] font-bold text-rose-100 truncate"
                            title={`${f.companies?.name ?? ""} · ${f.horario_inicio ?? ""}`}
                          >
                            {f.companies?.name?.split(" ")[0] ?? "Ficha"} · {f.hora_extra_sabado_funcionarios?.length ?? 0}
                          </button>
                        ))}
                        {fs.length > 2 && (
                          <button onClick={() => setDetalheId(fs[2].id)} className="text-left text-[9px] font-bold text-slate-400 hover:text-rose-200">
                            +{fs.length - 2}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()
      ) : (
        <div className="grid gap-1.5">
          {filtradas.map((f: any) => {
            const d = new Date(f.data + "T12:00:00");
            const dia = DIAS[d.getDay()].slice(0, 3).toUpperCase();
            const dataCurta = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
            const horario = f.horario_inicio ? `${f.horario_inicio}–${f.horario_fim ?? ""}` : "—";
            const qtd = f.hora_extra_sabado_funcionarios?.length ?? 0;
            return (
              <button
                key={f.id}
                onClick={() => setDetalheId(f.id)}
                className="group w-full text-left rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-rose-400/30 px-3 py-2 transition-all"
              >
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-black text-slate-100 tabular-nums w-[58px]">{dataCurta}</span>
                  <span className="text-[9px] font-black uppercase tracking-widest bg-rose-500/15 text-rose-200 px-1.5 py-0.5 rounded w-[42px] text-center">{dia}</span>
                  {f.companies?.name && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 truncate max-w-[180px]">{f.companies.name}</span>
                  )}
                  <span className="text-xs text-slate-400 inline-flex items-center gap-1 tabular-nums">
                    <Clock className="h-3 w-3" /> {horario}
                  </span>
                  {f.setor && (
                    <span className="text-xs text-slate-400 inline-flex items-center gap-1 truncate max-w-[200px]">
                      <MapPin className="h-3 w-3" /> {f.setor}
                    </span>
                  )}
                  <span className="ml-auto text-xs text-slate-300 inline-flex items-center gap-1 font-semibold tabular-nums">
                    <Users className="h-3 w-3" /> {qtd}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Drawer de detalhes */}
      <Sheet open={!!detalheId} onOpenChange={(o) => !o && setDetalheId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md bg-[#1a0608]/95 backdrop-blur-sm border-l border-white/10 text-slate-100">
          {fichaDetalhe && (() => {
            const d = new Date(fichaDetalhe.data + "T12:00:00");
            const dia = DIAS[d.getDay()];
            return (
              <>
                <SheetHeader>
                  <SheetTitle className="text-2xl font-black text-rose-200">
                    {d.toLocaleDateString("pt-BR")}
                  </SheetTitle>
                  <SheetDescription className="text-slate-400">
                    {dia} · {fichaDetalhe.tipo_efetivo} · {fichaDetalhe.hora_extra_sabado_funcionarios?.length ?? 0} funcionários
                  </SheetDescription>
                </SheetHeader>
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
        </SheetContent>
      </Sheet>

      <HoraExtraSabadoDialog open={open} onOpenChange={setOpen} editId={editId} />
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
