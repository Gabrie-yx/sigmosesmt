import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, Eye, Pencil, Trash2, PenLine, LogOut, MousePointerClick, UserCog, Copy } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
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

function SaidasPage() {
  const qc = useQueryClient();
  const { user, isEditor, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [duplicateData, setDuplicateData] = useState<any>(null);
  const [busca, setBusca] = useState("");
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
        .select("*, employees(id,nome,cpf,rg,role_id,foto_url,roles(name))")
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

  // Agrupar por data
  const grupos = filtradas.reduce((acc: any, r: any) => {
    const data = r.data;
    if (!acc[data]) acc[data] = [];
    acc[data].push(r);
    return acc;
  }, {});

  const datasOrdenadas = Object.keys(grupos).sort((a, b) => b.localeCompare(a));

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
        {isEditor && (
          <Button onClick={() => { setEditId(null); setDuplicateData(null); setOpen(true); }} className="bg-[#0f172a] hover:bg-brand text-white text-[11px] font-black uppercase tracking-widest rounded-xl px-5 py-3 h-auto shadow-lg">
            <Plus className="h-4 w-4 mr-2" />Nova autorização
          </Button>
        )}
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
        <div className="space-y-8">
          {datasOrdenadas.map((data) => (
            <div key={data} className="space-y-3">
              <div className="flex items-center gap-4">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                  {formatDateBR(data)}
                </h3>
                {isEditor && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 text-[10px] font-black uppercase tracking-widest text-brand hover:text-brand hover:bg-brand/5 rounded-lg border border-slate-100 hover:border-brand/20 bg-white shadow-sm"
                    onClick={() => {
                      const first = grupos[data][0];
                      const empIds = grupos[data].map((r: any) => r.employee_id);
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
                <div className="h-px flex-1 bg-slate-100"></div>
              </div>
              
              <div className="grid gap-3 sm:grid-cols-2">
                {grupos[data].map((r: any) => {
                  const sigFunc = !!r.assinatura_funcionario;
                  const sigSesmt = !!r.assinatura_sesmt;
                  const sigSupervisor = !!r.assinatura_supervisor;
                  const emp = r.employees;
                  const iniciais = (emp?.nome ?? "—").split(" ").filter(Boolean).slice(0,2).map((s: string) => s[0]?.toUpperCase()).join("");
                  
                  return (
                    <div key={r.id} className="group relative rounded-xl border border-slate-100 bg-white p-3 shadow-sm hover:shadow-md hover:border-brand/20 transition-all flex items-center gap-4">
                      <Avatar className="h-10 w-10 ring-2 ring-slate-50 shrink-0">
                        {emp?.foto_url ? <AvatarImage src={emp.foto_url} alt={emp.nome} /> : null}
                        <AvatarFallback className="text-xs font-black text-slate-700">{iniciais || "?"}</AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[13px] font-black text-slate-900 leading-tight truncate uppercase tracking-tight">{emp?.nome ?? "—"}</p>
                          <div className="flex gap-1 shrink-0">
                            <span className={`w-2 h-2 rounded-full ${sigFunc ? "bg-emerald-500" : "bg-slate-200"}`} title="Assinatura Funcionário" />
                            <span className={`w-2 h-2 rounded-full ${sigSesmt ? "bg-emerald-500" : "bg-slate-200"}`} title="Assinatura SESMT" />
                            <span className={`w-2 h-2 rounded-full ${sigSupervisor ? "bg-emerald-500" : "bg-slate-200"}`} title="Assinatura Supervisor" />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded uppercase">{r.horario_saida}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">{emp?.roles?.name ?? "—"}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-slate-100" onClick={() => gerarPdf(r.id)} title="Visualizar PDF">
                          <Eye className="h-4 w-4 text-slate-600" />
                        </Button>
                        {isEditor && (
                          <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-brand/5 hover:text-brand" onClick={() => {
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
                        <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-slate-100" onClick={() => { setEditId(r.id); setDuplicateData(null); setOpen(true); }} title="Editar">
                          <Pencil className="h-3.5 w-3.5 text-slate-600" />
                        </Button>
                        {isAdmin && (
                          <Button size="icon" variant="ghost" className="h-8 w-8 hover:text-rose-600 hover:bg-rose-50" onClick={() => { if (confirm("Excluir esta autorização?")) del.mutate(r.id); }} title="Excluir">
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
      )}

      <SaidaExpedienteDialog open={open} onOpenChange={setOpen} editId={editId} />

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