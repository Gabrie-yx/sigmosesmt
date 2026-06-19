import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, Eye, Pencil, Trash2, PenLine, LogOut, MousePointerClick, Copy, FileText, Calendar as CalIcon, ChevronRight } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import { SaidaExpedienteDialog } from "@/components/saida-expediente-dialog";
import { SignaturePadDialog } from "@/components/signature-pad-dialog";
import { PdfSignerDialog } from "@/components/pdf-signer-dialog";
import { PDFPreviewDialog } from "@/components/pdf-preview-dialog";
import { gerarSaidaExpedientePDF } from "@/lib/saida-expediente-pdf";
import { formatDateBR } from "@/lib/utils-date";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { drawPdfHeader } from "@/lib/pdf-header";
import dmnLogo from "@/assets/dmn-logo.png";

export const Route = createFileRoute("/app/employees/saidas")({
  component: SaidasPage,
  errorComponent: ({ error }) => <div className="p-6 text-red-700">Erro: {String(error?.message ?? error)}</div>,
  notFoundComponent: () => <div className="p-6">Não encontrado</div>,
});

async function imageToDataUrl(src: string): Promise<string | null> {
  try {
    const r = await fetch(src); const b = await r.blob();
    return await new Promise((res) => { const fr = new FileReader(); fr.onloadend = () => res(fr.result as string); fr.readAsDataURL(b); });
  } catch { return null; }
}

const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
function dataExtenso(iso: string) {
  const [y,m,d] = iso.split("-").map(Number);
  return `${String(d).padStart(2,"0")} de ${MESES[m-1]} de ${y}`;
}

function mesLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return `${MESES[m - 1].charAt(0).toUpperCase()}${MESES[m - 1].slice(1)} de ${y}`;
}

// ISO week (segunda como início)
function isoWeek(iso: string) {
  const d = new Date(iso + "T00:00:00");
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  const week = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  return { year: d.getFullYear(), week };
}



function SaidasPage() {
  const qc = useQueryClient();
  const { user, isEditor, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [duplicateData, setDuplicateData] = useState<any>(null);
  const [busca, setBusca] = useState("");
  const [relOpen, setRelOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<jsPDF | null>(null);
  const [previewFileName, setPreviewFileName] = useState("autorizacao-saida.pdf");
  const [previewRowId, setPreviewRowId] = useState<string | null>(null);
  const [previewTerceira, setPreviewTerceira] = useState(false);
  const [sigOpen, setSigOpen] = useState<null | "FUNC" | "SESMT" | "SUPERVISOR">(null);
  const [mesAberto, setMesAberto] = useState<string | null>(null);
  const [visualSignerBytes, setVisualSignerBytes] = useState<Uint8Array | null>(null);
  const [visualSignerName, setVisualSignerName] = useState("");
  const [visualSignerRef, setVisualSignerRef] = useState<string | undefined>(undefined);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["saidas-expediente"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_saidas_expediente")
        .select("*, employees(id,nome,cpf,rg,role_id,foto_url,roles(name)), companies(id,name)")
        .order("data", { ascending: false }).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("employee_saidas_expediente").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["saidas-expediente"] }); toast.success("Excluído"); },
    onError: (e: any) => toast.error(e.message),
  });

  async function gerarPdf(id: string) {
    const { data: row, error } = await supabase
      .from("employee_saidas_expediente")
        .select("*, employees(id,nome,cpf,rg,role_id,roles(name)), companies(id,name,type,encarregado1,encarregado2)")
      .eq("id", id).maybeSingle();
    if (error || !row) return toast.error(error?.message ?? "Não encontrado");
    const emp: any = (row as any).employees;
    const comp: any = (row as any).companies;
    const terceira = comp?.type === "TERCEIRIZADO";
    const logo = await imageToDataUrl(dmnLogo);
    const doc = gerarSaidaExpedientePDF({
      funcionarioNome: emp?.nome ?? "—",
      rg: emp?.rg ?? null, cpf: emp?.cpf ?? null,
      cargo: emp?.roles?.name ?? null,
      data: formatDateBR(row.data),
      dataExtenso: dataExtenso(row.data),
      horarioSaida: row.horario_saida,
      tipo: row.tipo as any,
      comRetorno: row.com_retorno, horarioRetorno: row.horario_retorno,
      motivo: row.motivo, observacao: row.observacao,
      logoDataUrl: logo,
      assinaturaFuncionarioDataUrl: row.assinatura_funcionario,
      assinaturaSesmtDataUrl: row.assinatura_sesmt,
      assinaturaSupervisorDataUrl: (row as any).assinatura_supervisor ?? null,
      sesmtNome: (user as any)?.user_metadata?.full_name ?? null,
      empresaNome: comp?.name ?? null,
      empresaTerceira: terceira,
      encarregadoNome: comp?.encarregado2 ?? comp?.encarregado1 ?? null,
    });
    setPreviewFileName(`autorizacao-saida-${emp?.nome?.replace(/\s+/g,"-")}-${row.data}.pdf`);
    setPreviewDoc(doc);
    setPreviewRowId(id);
    setPreviewTerceira(terceira);
  }

  async function salvarAssinatura(tipo: "FUNC" | "SESMT" | "SUPERVISOR", dataUrl: string) {
    if (!previewRowId) return;
    const patch: any =
      tipo === "FUNC"
        ? { assinatura_funcionario: dataUrl }
        : tipo === "SESMT"
        ? { assinatura_sesmt: dataUrl, assinado_sesmt_por: user?.id ?? null, assinado_sesmt_em: new Date().toISOString() }
        : { assinatura_supervisor: dataUrl, assinado_supervisor_por: user?.id ?? null, assinado_supervisor_em: new Date().toISOString() };
    const { error } = await supabase.from("employee_saidas_expediente").update(patch).eq("id", previewRowId);
    if (error) return toast.error(error.message);
    toast.success("Assinatura salva");
    await gerarPdf(previewRowId);
  }

  const filtradas = (rows ?? []).filter((r: any) => {
    if (!busca.trim()) return true;
    const s = busca.toLowerCase();
    return (r.employees?.nome ?? "").toLowerCase().includes(s) || (r.data ?? "").includes(s) || (r.motivo ?? "").toLowerCase().includes(s);
  });

  // Agrupar por MÊS → DATA
  const meses: Record<string, Record<string, any[]>> = {};
  for (const r of filtradas) {
    const ym = (r.data ?? "").slice(0, 7); // YYYY-MM
    const d = r.data;
    if (!ym) continue;
    if (!meses[ym]) meses[ym] = {};
    if (!meses[ym][d]) meses[ym][d] = [];
    meses[ym][d].push(r);
  }
  const mesesOrdenados = Object.keys(meses).sort((a, b) => b.localeCompare(a));

  return (
    <div className="p-6 md:p-8 animate-fadeIn">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link to="/app/employees" className="rounded-full p-2 hover:bg-slate-100"><ArrowLeft className="h-4 w-4" /></Link>
          <div>
            <h2 className="heading-display text-3xl md:text-4xl text-brand">Saídas durante o expediente</h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">Autorizações com assinatura do funcionário e SESMT</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setRelOpen(true)} variant="outline" className="text-[11px] font-black uppercase tracking-widest rounded-xl px-4 py-3 h-auto border-red-300 text-red-800 hover:bg-red-50">
            <FileText className="h-4 w-4 mr-2" />Relatório PDF
          </Button>
          {isEditor && (
            <Button onClick={() => { setEditId(null); setDuplicateData(null); setOpen(true); }} className="bg-[#0f172a] hover:bg-brand text-white text-[11px] font-black uppercase tracking-widest rounded-xl px-5 py-3 h-auto shadow-lg">
              <Plus className="h-4 w-4 mr-2" />Nova autorização
            </Button>
          )}
        </div>
      </div>

      <Input className="mb-6 max-w-md bg-white border-slate-200 shadow-sm" placeholder="Buscar por nome, data ou motivo…" value={busca} onChange={(e) => setBusca(e.target.value)} />

      {isLoading ? (
        <div className="grid gap-3">{Array.from({length:3}).map((_,i)=><div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse"/>)}</div>
      ) : filtradas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <LogOut className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold uppercase tracking-widest text-slate-500">Nenhuma autorização registrada</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {mesesOrdenados.map((ym) => {
            const datas = Object.keys(meses[ym]);
            const totalMes = datas.reduce((s, d) => s + meses[ym][d].length, 0);
            const empresasMes = new Set<string>();
            for (const d of datas) for (const r of meses[ym][d]) if (r.companies?.name) empresasMes.add(r.companies.name);
            return (
              <MesCard
                key={ym}
                ym={ym}
                total={totalMes}
                empresasCount={empresasMes.size}
                onClick={() => setMesAberto(ym)}
              />
            );
          })}
        </div>
      )}

      <SaidaExpedienteDialog open={open} onOpenChange={setOpen} editId={editId} duplicateData={duplicateData} />

      <RelatorioSaidasDialog
        open={relOpen}
        onClose={() => setRelOpen(false)}
        rows={rows ?? []}
        onPreview={(doc, name) => { setPreviewDoc(doc); setPreviewFileName(name); setPreviewRowId(null); setPreviewTerceira(false); }}
      />

      <MesDetalheDialog
        ym={mesAberto}
        onClose={() => setMesAberto(null)}
        meses={meses}
        isEditor={isEditor}
        isAdmin={isAdmin}
        onView={(id) => gerarPdf(id)}
        onEdit={(id) => { setEditId(id); setDuplicateData(null); setOpen(true); setMesAberto(null); }}
        onDelete={(id) => { if (confirm("Excluir esta autorização?")) del.mutate(id); }}
        onRepeat={(r) => {
          setEditId(null);
          setDuplicateData({
            company_id: r.company_id,
            employee_ids: [r.employee_id],
            horario_saida: r.horario_saida,
            tipo: r.tipo,
            com_retorno: r.com_retorno,
            horario_retorno: r.horario_retorno,
            motivo: r.motivo,
            observacao: r.observacao,
          });
          setOpen(true);
          setMesAberto(null);
        }}
        onRepeatLote={(rowsDia) => {
          const first = rowsDia[0];
          const empIds = rowsDia.map((r: any) => r.employee_id);
          setEditId(null);
          setDuplicateData({
            company_id: first.company_id,
            employee_ids: empIds,
            horario_saida: first.horario_saida,
            tipo: first.tipo,
            com_retorno: first.com_retorno,
            horario_retorno: first.horario_retorno,
            motivo: first.motivo,
            observacao: first.observacao,
          });
          setOpen(true);
          setMesAberto(null);
        }}
      />

      <PDFPreviewDialog
        open={!!previewDoc}
        onClose={() => { setPreviewDoc(null); setPreviewRowId(null); }}
        doc={previewDoc}
        fileName={previewFileName}
        title="Autorização de saída"
        signable={false}
      />
      {!!previewDoc && previewRowId && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] flex flex-wrap items-center justify-center gap-2 bg-white/95 backdrop-blur border-2 border-red-500 shadow-2xl rounded-xl px-3 py-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-red-800 mr-1">Assinar:</span>
          <Button size="sm" variant="outline" className="border-slate-300" onClick={() => setSigOpen("SESMT")}>
            <PenLine className="h-3.5 w-3.5 mr-1" />TST (SESMT)
          </Button>
          <Button size="sm" variant="outline" className="border-slate-300" onClick={() => setSigOpen("FUNC")}>
            <PenLine className="h-3.5 w-3.5 mr-1" />Funcionário
          </Button>
          <Button size="sm" variant="outline" className="border-slate-300" onClick={() => setSigOpen("SUPERVISOR")}>
            <PenLine className="h-3.5 w-3.5 mr-1" />{previewTerceira ? "Encarregado" : "Supervisor Geral"}
          </Button>
          <Button
            size="sm"
            className="bg-red-800 hover:bg-red-900 text-white"
            onClick={() => {
              if (!previewDoc) return;
              const ab = previewDoc.output("arraybuffer") as ArrayBuffer;
              setVisualSignerBytes(new Uint8Array(ab));
              setVisualSignerName(previewFileName);
              setVisualSignerRef(previewRowId ?? undefined);
            }}
          >
            <MousePointerClick className="h-3.5 w-3.5 mr-1" />Assinador Visual
          </Button>
        </div>
      )}
      <SignaturePadDialog
        open={!!sigOpen}
        onClose={() => setSigOpen(null)}
        onConfirm={async (r) => { const t = sigOpen; setSigOpen(null); if (t) await salvarAssinatura(t, r.dataUrl); }}
        title={sigOpen === "FUNC" ? "Assinatura do funcionário" : sigOpen === "SESMT" ? "Assinatura do TST" : (previewTerceira ? "Assinatura do Encarregado" : "Assinatura do Supervisor Geral")}
      />
      <PdfSignerDialog
        open={!!visualSignerBytes}
        onClose={() => setVisualSignerBytes(null)}
        source={visualSignerBytes}
        nomeArquivo={visualSignerName}
        modulo="saida_expediente"
        referenciaId={visualSignerRef}
      />
    </div>
  );
}

function RelatorioSaidasDialog({ open, onClose, rows, onPreview }: { open: boolean; onClose: () => void; rows: any[]; onPreview: (doc: jsPDF, fileName: string) => void }) {
  const hoje = new Date();
  const isoHoje = hoje.toISOString().slice(0, 10);
  // segunda da semana atual
  const seg = new Date(hoje);
  seg.setDate(seg.getDate() - ((seg.getDay() + 6) % 7));
  const isoSeg = seg.toISOString().slice(0, 10);
  const dom = new Date(seg); dom.setDate(dom.getDate() + 6);
  const isoDom = dom.toISOString().slice(0, 10);
  const isoMesInicio = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`;

  const [periodo, setPeriodo] = useState<"semana" | "mes" | "custom">("mes");
  const [empresaId, setEmpresaId] = useState<string>("__all__");
  const [de, setDe] = useState(isoMesInicio);
  const [ate, setAte] = useState(isoHoje);

  const empresas = Array.from(
    new Map(
      (rows ?? [])
        .filter((r) => r.companies?.id)
        .map((r) => [r.companies.id, { id: r.companies.id, name: r.companies.name }])
    ).values()
  ).sort((a: any, b: any) => a.name.localeCompare(b.name));

  function resolverIntervalo() {
    if (periodo === "semana") return { from: isoSeg, to: isoDom };
    if (periodo === "mes") return { from: isoMesInicio, to: isoHoje };
    return { from: de, to: ate };
  }

  function gerar() {
    const { from, to } = resolverIntervalo();
    const filtradas = (rows ?? []).filter((r: any) => {
      if (!r.data) return false;
      if (r.data < from || r.data > to) return false;
      if (empresaId !== "__all__" && r.company_id !== empresaId) return false;
      return true;
    });
    if (!filtradas.length) {
      toast.error("Nenhuma saída no período selecionado");
      return;
    }
    const ordenadas = [...filtradas].sort((a: any, b: any) => (a.data + a.horario_saida).localeCompare(b.data + b.horario_saida));
    const empresaSel = empresaId !== "__all__" ? (empresas.find((e: any) => e.id === empresaId) as any)?.name : null;
    const periodoLbl = periodo === "semana" ? "Semana atual" : periodo === "mes" ? "Mês atual" : "Período personalizado";
    const totalRet = ordenadas.filter((r: any) => r.com_retorno).length;

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const yStart = drawPdfHeader(doc, {
      titulo: "Relatório de Saídas durante o Expediente",
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
      head: [["Data", "Funcionário", "Cargo", "Empresa", "Saída", "Retorno", "Horário Ret.", "Motivo"]],
      body: ordenadas.map((r: any) => [
        formatDateBR(r.data),
        r.employees?.nome ?? "",
        r.employees?.roles?.name ?? "",
        r.companies?.name ?? "",
        r.horario_saida ?? "",
        r.com_retorno ? "Sim" : "Não",
        r.horario_retorno ?? "—",
        r.motivo ?? "",
      ]),
      styles: { fontSize: 8.5, cellPadding: 2 },
      headStyles: { fillColor: [11, 18, 40], textColor: 255, fontStyle: "bold", fontSize: 8.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 55 },
        2: { cellWidth: 38 },
        3: { cellWidth: 45 },
        4: { cellWidth: 16, halign: "center" },
        5: { cellWidth: 18, halign: "center" },
        6: { cellWidth: 22, halign: "center" },
      },
      margin: { left: 10, right: 10 },
    });
    const sufixo = periodo === "semana" ? "semana" : periodo === "mes" ? "mes" : `${from}_a_${to}`;
    onPreview(doc, `relatorio-saidas-${sufixo}.pdf`);
    toast.success(`${ordenadas.length} registro(s) no relatório`);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-black uppercase tracking-tight">Relatório de saídas</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-600">Período</Label>
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
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-600">De</Label>
                <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-600">Até</Label>
                <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-600">Empresa</Label>
            <Select value={empresaId} onValueChange={setEmpresaId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas as empresas</SelectItem>
                {empresas.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={gerar} className="bg-red-800 hover:bg-red-900 text-white">
            <FileText className="h-4 w-4 mr-2" />Gerar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MesCard({ ym, total, empresasCount, onClick }: { ym: string; total: number; empresasCount: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative rounded-2xl p-[1.5px] overflow-hidden text-left transition-transform hover:scale-[1.015] focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
      style={{
        background: "linear-gradient(135deg, rgba(127,29,29,0.9) 0%, rgba(15,118,110,0.55) 45%, rgba(34,211,238,0.65) 100%)",
        boxShadow:
          "0 0 0 1px rgba(127,29,29,0.45), " +
          "0 0 18px rgba(45,212,191,0.22), " +
          "0 0 36px rgba(16,185,129,0.18), " +
          "0 24px 56px -22px rgba(13,148,136,0.35), " +
          "0 18px 48px -22px rgba(16,185,129,0.24)",
      }}
    >
      <div
        className="relative rounded-2xl overflow-hidden flex flex-col w-full p-5 min-h-[180px]"
        style={{
          background:
            "radial-gradient(120% 80% at 0% 0%, rgba(136,8,8,0.45) 0%, rgba(15,23,42,0) 55%), " +
            "radial-gradient(120% 80% at 100% 100%, rgba(16,185,129,0.25) 0%, rgba(15,23,42,0) 55%), " +
            "linear-gradient(160deg, #0b1228 0%, #0a0f22 45%, #070b1a 100%)",
        }}
      >
        {/* top highlight */}
        <div aria-hidden className="pointer-events-none absolute -top-3 left-[30%] h-6 w-40 rounded-full"
          style={{
            background: "radial-gradient(ellipse at center, rgba(207,250,254,0.95) 0%, rgba(103,232,249,0.65) 30%, rgba(34,211,238,0.25) 60%, rgba(34,211,238,0) 80%)",
            filter: "blur(6px)", mixBlendMode: "screen",
          }} />
        <div aria-hidden className="pointer-events-none absolute -top-1 left-[34%] h-1 w-28 rounded-full"
          style={{ background: "linear-gradient(90deg, rgba(34,211,238,0) 0%, rgba(207,250,254,1) 50%, rgba(34,211,238,0) 100%)", filter: "blur(1.5px)" }} />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
          style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 40%, transparent 100%)" }} />
        <div aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), inset 0 0 0 1px rgba(148,163,184,0.08), inset 0 -40px 80px -40px rgba(16,185,129,0.20)" }} />
        <div aria-hidden className="pointer-events-none absolute -top-20 -left-16 h-56 w-56 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(153,27,27,0.55) 0%, rgba(136,8,8,0) 70%)", filter: "blur(10px)" }} />
        <div aria-hidden className="pointer-events-none absolute -bottom-20 -right-16 h-56 w-56 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(52,211,153,0.40) 0%, rgba(52,211,153,0) 70%)", filter: "blur(10px)" }} />

        <div className="relative flex items-center justify-between mb-3">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300/90 flex items-center gap-1.5">
            <CalIcon className="h-3 w-3" /> Mensal
          </span>
          <ChevronRight className="h-4 w-4 text-cyan-300/60 group-hover:text-cyan-200 group-hover:translate-x-0.5 transition-all" />
        </div>

        <div className="relative flex-1 flex flex-col justify-center">
          <h3 className="text-2xl font-black uppercase tracking-tight text-white leading-tight">{mesLabel(ym)}</h3>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-5xl font-black text-red-400" style={{ textShadow: "0 0 20px rgba(127,29,29,0.65)" }}>
              {total}
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">
              autorização{total === 1 ? "" : "ões"}
            </span>
          </div>
        </div>

        <div className="relative flex items-center justify-between pt-3 mt-3 border-t border-slate-700/60">
          <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-400">
            {empresasCount} empresa{empresasCount === 1 ? "" : "s"}
          </span>
          <span className="text-[9.5px] font-black uppercase tracking-wider text-cyan-300/80">
            Ver detalhes
          </span>
        </div>
      </div>
    </button>
  );
}

function MesDetalheDialog({
  ym, onClose, meses, isEditor, isAdmin, onView, onEdit, onDelete, onRepeat, onRepeatLote,
}: {
  ym: string | null;
  onClose: () => void;
  meses: Record<string, Record<string, any[]>>;
  isEditor: boolean;
  isAdmin: boolean;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onRepeat: (row: any) => void;
  onRepeatLote: (rowsDia: any[]) => void;
}) {
  if (!ym) return null;
  const datas = Object.keys(meses[ym] ?? {}).sort((a, b) => b.localeCompare(a));
  const total = datas.reduce((s, d) => s + meses[ym][d].length, 0);

  return (
    <Dialog open={!!ym} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl max-h-[88vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-black uppercase tracking-tight text-slate-900 flex items-center gap-3">
            <CalIcon className="h-5 w-5 text-red-700" />
            {mesLabel(ym)}
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              {total} autorização{total === 1 ? "" : "ões"}
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto pr-1 space-y-5 py-2">
          {datas.map((data) => (
            <div key={data} className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md">
                  {formatDateBR(data)}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  {meses[ym][data].length} saída{meses[ym][data].length === 1 ? "" : "s"}
                </span>
                {isEditor && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[10px] font-black uppercase tracking-widest text-red-800 hover:text-red-900 hover:bg-red-50 rounded-lg border border-red-300"
                    onClick={() => onRepeatLote(meses[ym][data])}
                  >
                    <Copy className="h-3 w-3 mr-1.5" /> Repetir Lote
                  </Button>
                )}
                <div className="h-px flex-1 bg-slate-200"></div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {meses[ym][data].map((r: any) => {
                  const sigFunc = !!r.assinatura_funcionario;
                  const sigSesmt = !!r.assinatura_sesmt;
                  const sigSupervisor = !!r.assinatura_supervisor;
                  const emp = r.employees;
                  const iniciais = (emp?.nome ?? "—").split(" ").filter(Boolean).slice(0, 2).map((s: string) => s[0]?.toUpperCase()).join("");
                  return (
                    <div key={r.id} className="group relative rounded-xl border border-slate-200 bg-white p-3 shadow-sm hover:shadow-md hover:border-red-500 transition-all flex items-center gap-3">
                      <Avatar className="h-10 w-10 ring-2 ring-slate-100 shrink-0">
                        {emp?.foto_url ? <AvatarImage src={emp.foto_url} alt={emp.nome} /> : null}
                        <AvatarFallback className="text-xs font-black text-red-800 bg-red-100">{iniciais || "?"}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[12px] font-black text-slate-900 leading-tight truncate uppercase tracking-tight">{emp?.nome ?? "—"}</p>
                          <div className="flex gap-1 shrink-0">
                            <span className={`w-2 h-2 rounded-full ${sigFunc ? "bg-emerald-500" : "bg-slate-200"}`} title="Assinatura Funcionário" />
                            <span className={`w-2 h-2 rounded-full ${sigSesmt ? "bg-emerald-500" : "bg-slate-200"}`} title="Assinatura SESMT" />
                            <span className={`w-2 h-2 rounded-full ${sigSupervisor ? "bg-emerald-500" : "bg-slate-200"}`} title="Assinatura Supervisor" />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[10px] font-black text-red-800 bg-red-50 ring-1 ring-red-300 px-1.5 py-0.5 rounded uppercase">{r.horario_saida}</span>
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">{emp?.roles?.name ?? "—"}</span>
                          {r.companies?.name && <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate">{r.companies.name}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-slate-100 text-slate-500 hover:text-slate-900" onClick={() => onView(r.id)} title="Visualizar PDF">
                          <Eye className="h-4 w-4" />
                        </Button>
                        {isEditor && (
                          <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-red-50 text-slate-500 hover:text-red-800" onClick={() => onRepeat(r)} title="Repetir autorização hoje">
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-slate-100 text-slate-500 hover:text-slate-900" onClick={() => onEdit(r.id)} title="Editar">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {isAdmin && (
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-red-800 hover:bg-red-50" onClick={() => onDelete(r.id)} title="Excluir">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}