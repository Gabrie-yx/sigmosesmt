// Painel de saídas VALIDADAS pela portaria — cards mensais + relatório PDF
// filtrável por período e por empresa. Fonte: portaria_saidas_funcionarios
// (validada_at) cruzada com employee_saidas_expediente + employees + companies.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { ArrowLeft, FileText, Calendar as CalIcon, ChevronRight, LogOut, Clock3 } from "lucide-react";
import { SignedAvatarImg } from "@/components/signed-avatar-img";
import { formatDateBR } from "@/lib/utils-date";
import { toast } from "sonner";
import type jsPDF from "jspdf";

export const Route = createFileRoute("/app/portaria/saidas")({
  component: SaidasPortariaPage,
  head: () => ({
    meta: [
      { title: "Saídas da Portaria · SIGMO" },
      { name: "description", content: "Painel mensal das saídas de funcionário validadas pela portaria, com relatório em PDF." },
    ],
  }),
});

const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
function mesLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return `${MESES[m - 1].charAt(0).toUpperCase()}${MESES[m - 1].slice(1)} de ${y}`;
}
function fmtHora(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

type Row = {
  id: string;
  validada_at: string;
  observacao_portaria: string | null;
  saida: {
    id: string; data: string; tipo: string | null; horario_saida: string | null;
    com_retorno: boolean | null; horario_retorno: string | null;
    motivo: string | null; company_id: string | null;
  } | null;
  emp: { id: string; nome: string | null; matricula: string | null; cpf: string | null; foto_url: string | null; roles?: { name: string | null } | null } | null;
  company: { id: string; name: string | null } | null;
};

function SaidasPortariaPage() {
  const [busca, setBusca] = useState("");
  const [relOpen, setRelOpen] = useState(false);
  const [mesAberto, setMesAberto] = useState<string | null>(null);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["portaria-saidas-todas"],
    queryFn: async () => {
      // Janela de 12 meses pro painel abrir rápido. Relatório custom refaz busca própria.
      const desde = new Date(); desde.setMonth(desde.getMonth() - 12);
      const { data: vals, error } = await supabase
        .from("portaria_saidas_funcionarios")
        .select("id, saida_expediente_id, employee_id, validada_at, observacao_portaria")
        .gte("validada_at", desde.toISOString())
        .order("validada_at", { ascending: false });
      if (error) throw error;
      const list = vals ?? [];
      if (!list.length) return [] as Row[];
      const saidaIds = Array.from(new Set(list.map((v) => v.saida_expediente_id).filter(Boolean) as string[]));
      const empIds = Array.from(new Set(list.map((v) => v.employee_id).filter(Boolean) as string[]));
      const [saidasRes, empsRes] = await Promise.all([
        saidaIds.length
          ? supabase.from("employee_saidas_expediente")
              .select("id, data, tipo, horario_saida, com_retorno, horario_retorno, motivo, company_id")
              .in("id", saidaIds)
          : Promise.resolve({ data: [] as any[] }),
        empIds.length
          ? supabase.from("employees").select("id, nome, matricula, cpf, foto_url, roles(name)").in("id", empIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const compIds = Array.from(new Set((saidasRes.data ?? []).map((s: any) => s.company_id).filter(Boolean)));
      const compsRes = compIds.length
        ? await supabase.from("companies").select("id, name").in("id", compIds)
        : { data: [] as any[] };
      const sMap = new Map((saidasRes.data ?? []).map((s: any) => [s.id, s]));
      const eMap = new Map((empsRes.data ?? []).map((e: any) => [e.id, e]));
      const cMap = new Map((compsRes.data ?? []).map((c: any) => [c.id, c]));
      return list.map((v: any) => {
        const saida = sMap.get(v.saida_expediente_id) ?? null;
        return {
          id: v.id,
          validada_at: v.validada_at,
          observacao_portaria: v.observacao_portaria,
          saida,
          emp: eMap.get(v.employee_id) ?? null,
          company: saida?.company_id ? cMap.get(saida.company_id) ?? null : null,
        } as Row;
      });
    },
    staleTime: 60_000,
  });

  const filtradas = useMemo(() => {
    const s = busca.trim().toLowerCase();
    return (rows ?? []).filter((r) => {
      if (!s) return true;
      return (
        (r.emp?.nome ?? "").toLowerCase().includes(s) ||
        (r.emp?.matricula ?? "").toLowerCase().includes(s) ||
        (r.company?.name ?? "").toLowerCase().includes(s) ||
        (r.saida?.motivo ?? "").toLowerCase().includes(s)
      );
    });
  }, [rows, busca]);

  // Agrupamento por MÊS da validação
  const meses = useMemo(() => {
    const m: Record<string, Row[]> = {};
    for (const r of filtradas) {
      const ym = r.validada_at.slice(0, 7);
      if (!m[ym]) m[ym] = [];
      m[ym].push(r);
    }
    return m;
  }, [filtradas]);
  const mesesOrdenados = Object.keys(meses).sort((a, b) => b.localeCompare(a));

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-30 bg-gradient-to-b from-primary/95 to-primary/85 text-primary-foreground border-b border-primary/40 shadow-lg">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-2.5">
          <Link to="/app/portaria" className="h-10 w-10 rounded-xl bg-white/15 hover:bg-white/25 grid place-items-center ring-1 ring-white/25 shrink-0" aria-label="Voltar">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-foreground/70 leading-none">Portaria</p>
            <h1 className="truncate text-lg md:text-xl font-black leading-tight mt-0.5">Saídas durante o expediente</h1>
          </div>
          <Button
            onClick={() => setRelOpen(true)}
            variant="outline"
            className="text-[11px] font-black uppercase tracking-widest rounded-xl h-10 px-3 md:px-4 bg-white/10 border-white/30 text-primary-foreground hover:bg-white/20 hover:text-primary-foreground"
          >
            <FileText className="h-4 w-4 md:mr-2" />
            <span className="hidden md:inline">Relatório PDF</span>
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 pt-4 space-y-4">
        <Input
          placeholder="Buscar por nome, matrícula, empresa ou motivo…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="max-w-md h-11"
        />

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-44 rounded-2xl bg-muted animate-pulse" />)}
          </div>
        ) : mesesOrdenados.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <LogOut className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Nenhuma saída validada pela portaria</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {mesesOrdenados.map((ym) => {
              const arr = meses[ym];
              const empresas = new Set(arr.map((r) => r.company?.id).filter(Boolean) as string[]);
              return (
                <MesCard key={ym} ym={ym} total={arr.length} empresasCount={empresas.size} onClick={() => setMesAberto(ym)} />
              );
            })}
          </div>
        )}
      </div>

      <RelatorioSaidasDialog open={relOpen} onClose={() => setRelOpen(false)} rows={rows ?? []} />

      <MesDetalheDialog ym={mesAberto} onClose={() => setMesAberto(null)} meses={meses} />
    </div>
  );
}

function MesCard({ ym, total, empresasCount, onClick }: { ym: string; total: number; empresasCount: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative rounded-2xl p-[1.5px] overflow-hidden text-left transition-transform hover:scale-[1.015] focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
      style={{
        background: "linear-gradient(135deg, rgba(69,10,10,0.92) 0%, rgba(15,118,110,0.62) 48%, rgba(251,191,36,0.72) 100%)",
        boxShadow:
          "0 0 0 1px rgba(120,53,15,0.42), 0 0 18px rgba(45,212,191,0.22), 0 0 36px rgba(245,158,11,0.15), 0 24px 56px -22px rgba(13,148,136,0.35), 0 18px 48px -22px rgba(120,53,15,0.24)",
      }}
    >
      <div
        className="relative rounded-2xl overflow-hidden flex flex-col w-full p-5 min-h-[180px]"
        style={{
          background:
            "radial-gradient(120% 80% at 0% 0%, rgba(120,53,15,0.38) 0%, rgba(15,23,42,0) 55%), " +
            "radial-gradient(120% 80% at 100% 100%, rgba(20,184,166,0.27) 0%, rgba(15,23,42,0) 55%), " +
            "linear-gradient(160deg, #0b1228 0%, #0a0f22 45%, #070b1a 100%)",
        }}
      >
        <div aria-hidden className="pointer-events-none absolute -top-3 left-[30%] h-6 w-40 rounded-full"
          style={{ background: "radial-gradient(ellipse at center, rgba(207,250,254,0.95) 0%, rgba(103,232,249,0.65) 30%, rgba(34,211,238,0.25) 60%, rgba(34,211,238,0) 80%)", filter: "blur(6px)", mixBlendMode: "screen" }} />
        <div aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12), inset 0 0 0 1px rgba(148,163,184,0.08), inset 0 -40px 80px -40px rgba(20,184,166,0.22)" }} />

        <div className="relative flex items-center justify-between mb-3">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300/90 flex items-center gap-1.5">
            <CalIcon className="h-3 w-3" /> Mensal
          </span>
          <ChevronRight className="h-4 w-4 text-cyan-300/60 group-hover:text-cyan-200 group-hover:translate-x-0.5 transition-all" />
        </div>

        <div className="relative flex-1 flex flex-col justify-center">
          <h3 className="text-2xl font-black uppercase tracking-tight text-white leading-tight">{mesLabel(ym)}</h3>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-5xl font-black text-amber-300" style={{ textShadow: "0 0 20px rgba(245,158,11,0.42)" }}>
              {total}
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">
              saída{total === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        <div className="relative flex items-center justify-between pt-3 mt-3 border-t border-slate-700/60">
          <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400">
            {empresasCount} empresa{empresasCount === 1 ? "" : "s"}
          </span>
          <span className="text-[9.5px] font-black uppercase tracking-wider text-cyan-300/80">Ver detalhes</span>
        </div>
      </div>
    </button>
  );
}

function MesDetalheDialog({ ym, onClose, meses }: { ym: string | null; onClose: () => void; meses: Record<string, Row[]> }) {
  if (!ym) return null;
  const arr = meses[ym] ?? [];
  // agrupa por data (YYYY-MM-DD do validada_at)
  const porDia = new Map<string, Row[]>();
  for (const r of arr) {
    const d = r.validada_at.slice(0, 10);
    if (!porDia.has(d)) porDia.set(d, []);
    porDia.get(d)!.push(r);
  }
  const dias = Array.from(porDia.keys()).sort((a, b) => b.localeCompare(a));

  return (
    <Dialog open={!!ym} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col border border-white/15 text-white shadow-2xl"
        style={{
          background:
            "radial-gradient(120% 80% at 0% 0%, rgba(20,184,166,0.18) 0%, rgba(15,23,42,0) 55%), " +
            "radial-gradient(120% 80% at 100% 100%, rgba(244,63,94,0.18) 0%, rgba(15,23,42,0) 55%), " +
            "linear-gradient(160deg, rgba(15,23,42,0.9) 0%, rgba(15,23,42,0.75) 100%)",
          backdropFilter: "blur(24px) saturate(160%)",
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-3">
            <CalIcon className="h-5 w-5 text-cyan-300" />
            {mesLabel(ym)}
            <span className="text-[10px] font-black uppercase tracking-widest text-cyan-200/90 bg-white/10 ring-1 ring-white/15 px-2 py-0.5 rounded">
              {arr.length} saída{arr.length === 1 ? "" : "s"}
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto pr-1 space-y-5 py-2">
          {dias.map((d) => (
            <div key={d} className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-black uppercase tracking-widest text-white bg-white/10 ring-1 ring-white/15 px-2.5 py-1 rounded-md backdrop-blur">
                  {formatDateBR(d)}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
                  {porDia.get(d)!.length} registro{porDia.get(d)!.length === 1 ? "" : "s"}
                </span>
                <div className="h-px flex-1 bg-white/10" />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {porDia.get(d)!.map((r) => (
                  <div key={r.id} className="rounded-xl border border-white/15 bg-white/5 backdrop-blur-xl p-3 flex items-center gap-3">
                    {r.emp?.foto_url ? (
                      <SignedAvatarImg src={r.emp.foto_url} className="h-11 w-11 rounded-full object-cover object-top border border-white/20 shrink-0" />
                    ) : (
                      <div className="h-11 w-11 rounded-full bg-white/10 grid place-items-center text-[10px] font-black text-cyan-100 shrink-0">
                        {r.emp?.nome?.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase() ?? "?"}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-black text-white leading-tight truncate uppercase tracking-tight">{r.emp?.nome ?? "—"}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] font-black text-cyan-100 bg-cyan-400/10 ring-1 ring-cyan-300/30 px-1.5 py-0.5 rounded uppercase inline-flex items-center gap-0.5">
                          <Clock3 className="h-2.5 w-2.5" /> {fmtHora(r.validada_at)}
                        </span>
                        {r.saida?.tipo && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-200">{r.saida.tipo}</span>
                        )}
                        {r.company?.name && (
                          <span className="text-[9px] font-bold text-slate-300 uppercase tracking-wider truncate">{r.company.name}</span>
                        )}
                        <span className={`text-[9px] font-black uppercase tracking-wider rounded px-1.5 py-0.5 ${
                          r.saida?.com_retorno ? "bg-amber-500/20 text-amber-200" : "bg-emerald-500/20 text-emerald-200"
                        }`}>
                          {r.saida?.com_retorno ? `Retorna ${r.saida.horario_retorno?.slice(0,5) ?? ""}` : "Sem retorno"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RelatorioSaidasDialog({ open, onClose, rows }: { open: boolean; onClose: () => void; rows: Row[] }) {
  const hoje = new Date();
  const isoHoje = hoje.toISOString().slice(0, 10);
  const seg = new Date(hoje); seg.setDate(seg.getDate() - ((seg.getDay() + 6) % 7));
  const isoSeg = seg.toISOString().slice(0, 10);
  const dom = new Date(seg); dom.setDate(dom.getDate() + 6);
  const isoDom = dom.toISOString().slice(0, 10);
  const isoMesInicio = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`;

  const [periodo, setPeriodo] = useState<"semana" | "mes" | "custom">("mes");
  const [empresaId, setEmpresaId] = useState<string>("__all__");
  const [de, setDe] = useState(isoMesInicio);
  const [ate, setAte] = useState(isoHoje);
  const [previewDoc, setPreviewDoc] = useState<jsPDF | null>(null);
  const [previewName, setPreviewName] = useState("relatorio-saidas-portaria.pdf");

  const empresas = useMemo(() => {
    return Array.from(
      new Map(
        (rows ?? [])
          .filter((r) => r.company?.id)
          .map((r) => [r.company!.id, { id: r.company!.id, name: r.company!.name ?? "—" }])
      ).values()
    ).sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  }, [rows]);

  function resolver() {
    if (periodo === "semana") return { from: isoSeg, to: isoDom };
    if (periodo === "mes") return { from: isoMesInicio, to: isoHoje };
    return { from: de, to: ate };
  }

  async function gerar() {
    const { from, to } = resolver();
    const fromDt = `${from}T00:00:00`;
    const toDt = `${to}T23:59:59`;
    const filtradas = (rows ?? []).filter((r) => {
      if (r.validada_at < fromDt || r.validada_at > toDt) return false;
      if (empresaId !== "__all__" && r.company?.id !== empresaId) return false;
      return true;
    });
    if (!filtradas.length) {
      toast.error("Nenhuma saída validada nesse período");
      return;
    }
    const ordenadas = [...filtradas].sort((a, b) => a.validada_at.localeCompare(b.validada_at));
    const empresaSel = empresaId !== "__all__" ? empresas.find((e) => e.id === empresaId)?.name : null;
    const periodoLbl = periodo === "semana" ? "Semana atual" : periodo === "mes" ? "Mês atual" : "Período personalizado";
    const totalRet = ordenadas.filter((r) => r.saida?.com_retorno).length;

    const [{ default: JsPDF }, { default: autoTable }, { drawPdfHeader }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
      import("@/lib/pdf-header"),
    ]);
    const doc = new JsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const yStart = drawPdfHeader(doc, {
      titulo: "Relatório de Saídas Validadas pela Portaria",
      subtitulo: `${periodoLbl} · ${formatDateBR(from)} → ${formatDateBR(to)}`,
      filtros: [
        `Empresa: ${empresaSel ?? "Todas"}`,
        `Total: ${ordenadas.length}`,
        `Com retorno: ${totalRet}`,
        `Sem retorno: ${ordenadas.length - totalRet}`,
      ],
    });
    autoTable(doc, {
      startY: yStart + 2,
      head: [["Data", "Hora Val.", "Funcionário", "Matrícula", "Cargo", "Empresa", "Tipo", "Retorno", "Motivo"]],
      body: ordenadas.map((r) => [
        formatDateBR(r.validada_at.slice(0, 10)),
        fmtHora(r.validada_at),
        r.emp?.nome ?? "—",
        r.emp?.matricula ?? "—",
        r.emp?.roles?.name ?? "—",
        r.company?.name ?? "—",
        r.saida?.tipo ?? "—",
        r.saida?.com_retorno ? `Sim (${r.saida.horario_retorno?.slice(0,5) ?? ""})` : "Não",
        r.saida?.motivo ?? "",
      ]),
      styles: { fontSize: 8.5, cellPadding: 2 },
      headStyles: { fillColor: [11, 18, 40], textColor: 255, fontStyle: "bold", fontSize: 8.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 18, halign: "center" },
        2: { cellWidth: 50 },
        3: { cellWidth: 22, halign: "center" },
        4: { cellWidth: 34 },
        5: { cellWidth: 40 },
        6: { cellWidth: 20, halign: "center" },
        7: { cellWidth: 26, halign: "center" },
      },
      margin: { left: 10, right: 10 },
    });
    const sufixo = periodo === "semana" ? "semana" : periodo === "mes" ? "mes" : `${from}_a_${to}`;
    setPreviewName(`relatorio-saidas-portaria-${sufixo}.pdf`);
    setPreviewDoc(doc);
    toast.success(`${ordenadas.length} registro(s) no relatório`);
    onClose();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-black uppercase tracking-tight">Relatório de saídas</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Período</Label>
              <Select value={periodo} onValueChange={(v) => setPeriodo(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semana">Semana atual ({formatDateBR(isoSeg)} → {formatDateBR(isoDom)})</SelectItem>
                  <SelectItem value="mes">Mês atual ({formatDateBR(isoMesInicio)} → {formatDateBR(isoHoje)})</SelectItem>
                  <SelectItem value="custom">Período personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {periodo === "custom" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">De</Label>
                  <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Até</Label>
                  <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Empresa</Label>
              <Select value={empresaId} onValueChange={setEmpresaId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas as empresas</SelectItem>
                  {empresas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={gerar} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <FileText className="h-4 w-4 mr-2" />Gerar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!!previewDoc && (
        <LazyPreview doc={previewDoc} fileName={previewName} onClose={() => setPreviewDoc(null)} />
      )}
    </>
  );
}

function LazyPreview({ doc, fileName, onClose }: { doc: jsPDF; fileName: string; onClose: () => void }) {
  const [Comp, setComp] = useState<any>(null);
  if (!Comp) {
    import("@/components/pdf-preview-dialog").then((m) => setComp(() => m.PDFPreviewDialog));
    return null;
  }
  return <Comp open={true} onClose={onClose} doc={doc} fileName={fileName} title="Relatório de saídas · Portaria" signable={false} />;
}