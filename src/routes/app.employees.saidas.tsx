import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, Eye, Pencil, Trash2, PenLine, LogOut, MousePointerClick, UserCog, Copy, FileSpreadsheet, Calendar as CalIcon } from "lucide-react";
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
import type jsPDF from "jspdf";
import dmnLogo from "@/assets/dmn-logo.png";

export const Route = createFileRoute("/app/employees/saidas")({
  component: SaidasPage,
  errorComponent: ({ error }) => <div className="p-6 text-rose-600">Erro: {String(error?.message ?? error)}</div>,
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

function csvEscape(v: any) {
  const s = v == null ? "" : String(v);
  if (/[",;\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function downloadCSV(filename: string, rows: string[][]) {
  const csv = "\ufeff" + rows.map((r) => r.map(csvEscape).join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
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
          <Button onClick={() => setRelOpen(true)} variant="outline" className="text-[11px] font-black uppercase tracking-widest rounded-xl px-4 py-3 h-auto border-rose-200 text-rose-700 hover:bg-rose-50">
            <FileSpreadsheet className="h-4 w-4 mr-2" />Relatório
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
        <div className="space-y-6">
          {mesesOrdenados.map((ym) => {
            const datas = Object.keys(meses[ym]).sort((a, b) => b.localeCompare(a));
            const totalMes = datas.reduce((s, d) => s + meses[ym][d].length, 0);
            return (
              <section key={ym} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <header className="flex items-center justify-between gap-3 px-5 py-3 bg-gradient-to-r from-rose-50 via-white to-white border-b border-slate-200">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                      <CalIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black uppercase tracking-tight text-slate-900">{mesLabel(ym)}</h3>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{totalMes} autorização{totalMes === 1 ? "" : "ões"}</p>
                    </div>
                  </div>
                </header>
                <div className="p-4 md:p-5 space-y-5">
                  {datas.map((data) => (
                    <div key={data} className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-black uppercase tracking-widest text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md">
                          {formatDateBR(data)}
                        </span>
                        {isEditor && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 text-[10px] font-black uppercase tracking-widest text-rose-700 hover:text-rose-800 hover:bg-rose-50 rounded-lg border border-rose-200"
                    onClick={() => {
                      const first = meses[ym][data][0];
                      const empIds = meses[ym][data].map((r: any) => r.employee_id);
                      setEditId(null);
                      setDuplicateData({
                        company_id: first.company_id,
                        employee_ids: empIds,
                        horario_saida: first.horario_saida,
                        tipo: first.tipo,
                        com_retorno: first.com_retorno,
                        horario_retorno: first.horario_retorno,
                        motivo: first.motivo,
                        observacao: first.observacao
                      });
                      setOpen(true);
                    }}
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
                  const iniciais = (emp?.nome ?? "—").split(" ").filter(Boolean).slice(0,2).map((s: string) => s[0]?.toUpperCase()).join("");
                  
                  return (
                    <div key={r.id} className="group relative rounded-xl border border-slate-200 bg-white p-3 shadow-sm hover:shadow-md hover:border-rose-300 transition-all flex items-center gap-3">
                      <Avatar className="h-10 w-10 ring-2 ring-slate-100 shrink-0">
                        {emp?.foto_url ? <AvatarImage src={emp.foto_url} alt={emp.nome} /> : null}
                        <AvatarFallback className="text-xs font-black text-rose-700 bg-rose-100">{iniciais || "?"}</AvatarFallback>
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
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-black text-rose-700 bg-rose-50 ring-1 ring-rose-200 px-1.5 py-0.5 rounded uppercase">{r.horario_saida}</span>
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">{emp?.roles?.name ?? "—"}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-slate-100 text-slate-500 hover:text-slate-900" onClick={() => gerarPdf(r.id)} title="Visualizar PDF">
                          <Eye className="h-4 w-4" />
                        </Button>
                        {isEditor && (
                          <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-rose-50 text-slate-500 hover:text-rose-700" onClick={() => {
                            setEditId(null);
                            setDuplicateData({
                              company_id: r.company_id,
                              employee_ids: [r.employee_id],
                              horario_saida: r.horario_saida,
                              tipo: r.tipo,
                              com_retorno: r.com_retorno,
                              horario_retorno: r.horario_retorno,
                              motivo: r.motivo,
                              observacao: r.observacao
                            });
                            setOpen(true);
                          }} title="Repetir autorização hoje">
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-slate-100 text-slate-500 hover:text-slate-900" onClick={() => { setEditId(r.id); setDuplicateData(null); setOpen(true); }} title="Editar">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {isAdmin && (
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-rose-700 hover:bg-rose-50" onClick={() => { if (confirm("Excluir esta autorização?")) del.mutate(r.id); }} title="Excluir">
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
              </section>
            );
          })}
        </div>
      )}

      <SaidaExpedienteDialog open={open} onOpenChange={setOpen} editId={editId} duplicateData={duplicateData} />

      <RelatorioSaidasDialog open={relOpen} onClose={() => setRelOpen(false)} rows={rows ?? []} />

      <PDFPreviewDialog
        open={!!previewDoc}
        onClose={() => { setPreviewDoc(null); setPreviewRowId(null); }}
        doc={previewDoc}
        fileName={previewFileName}
        title="Autorização de saída"
        signable={false}
      />
      {!!previewDoc && previewRowId && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] flex flex-wrap items-center justify-center gap-2 bg-white/95 backdrop-blur border-2 border-rose-300 shadow-2xl rounded-xl px-3 py-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-rose-700 mr-1">Assinar:</span>
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
            className="bg-rose-600 hover:bg-rose-700 text-white"
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

function RelatorioSaidasDialog({ open, onClose, rows }: { open: boolean; onClose: () => void; rows: any[] }) {
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
    const header = ["Data", "Funcionário", "Cargo", "Empresa", "Horário Saída", "Com Retorno", "Horário Retorno", "Motivo"];
    const linhas = filtradas
      .sort((a: any, b: any) => (a.data + a.horario_saida).localeCompare(b.data + b.horario_saida))
      .map((r: any) => [
        formatDateBR(r.data),
        r.employees?.nome ?? "",
        r.employees?.roles?.name ?? "",
        r.companies?.name ?? "",
        r.horario_saida ?? "",
        r.com_retorno ? "Sim" : "Não",
        r.horario_retorno ?? "",
        r.motivo ?? "",
      ]);
    const sufixo = periodo === "semana" ? "semana" : periodo === "mes" ? "mes" : `${from}_a_${to}`;
    downloadCSV(`saidas-expediente-${sufixo}.csv`, [header, ...linhas]);
    toast.success(`${linhas.length} registro(s) exportado(s)`);
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
          <Button onClick={gerar} className="bg-rose-600 hover:bg-rose-700 text-white">
            <FileSpreadsheet className="h-4 w-4 mr-2" />Baixar CSV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}