import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, Eye, Pencil, Trash2, PenLine, LogOut, MousePointerClick, UserCog } from "lucide-react";
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
          <Button onClick={() => { setEditId(null); setOpen(true); }} className="bg-[#0f172a] hover:bg-brand text-white text-[11px] font-black uppercase tracking-widest rounded-xl px-5 py-3 h-auto shadow-lg">
            <Plus className="h-4 w-4 mr-2" />Nova autorização
          </Button>
        )}
      </div>

      <Input className="mb-4 max-w-md" placeholder="Buscar por nome, data ou motivo…" value={busca} onChange={(e) => setBusca(e.target.value)} />

      {isLoading ? (
        <div className="grid gap-3">{Array.from({length:3}).map((_,i)=><div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse"/>)}</div>
      ) : filtradas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <LogOut className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold uppercase tracking-widest text-slate-500">Nenhuma autorização registrada</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtradas.map((r: any) => {
            const sigFunc = !!r.assinatura_funcionario;
            const sigSesmt = !!r.assinatura_sesmt;
            const sigSupervisor = !!r.assinatura_supervisor;
            const emp = r.employees;
            const iniciais = (emp?.nome ?? "—").split(" ").filter(Boolean).slice(0,2).map((s: string) => s[0]?.toUpperCase()).join("");
            return (
              <div key={r.id} className="rounded-2xl border bg-white p-4 shadow-sm hover:shadow-md transition-all flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <Avatar className="h-14 w-14 ring-2 ring-slate-100 shrink-0">
                    {emp?.foto_url ? <AvatarImage src={emp.foto_url} alt={emp.nome} /> : null}
                    <AvatarFallback className="text-sm font-black text-slate-700">{iniciais || "?"}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-black text-slate-900 leading-tight truncate">{emp?.nome ?? "—"}</p>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate">{emp?.roles?.name ?? "—"}</p>
                    {emp?.id && (
                      <Link
                        to="/app/employees/$id"
                        params={{ id: emp.id }}
                        className="inline-flex items-center gap-1 mt-1 text-[10px] font-black uppercase tracking-widest text-brand hover:underline"
                      >
                        <UserCog className="h-3 w-3" /> Editar ficha
                      </Link>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{formatDateBR(r.data)}</span>
                  <span className="text-[10px] font-black uppercase tracking-widest bg-rose-100 text-rose-700 px-2 py-0.5 rounded">{r.horario_saida}</span>
                  <span className="text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{r.tipo === "PESSOAL" ? "Pessoal" : "A serviço"}</span>
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${r.com_retorno ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{r.com_retorno ? `retorno ${r.horario_retorno ?? ""}` : "sem retorno"}</span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${sigFunc ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>Func {sigFunc ? "✓" : "—"}</span>
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${sigSesmt ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>SESMT {sigSesmt ? "✓" : "—"}</span>
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${sigSupervisor ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>Sup/Enc {sigSupervisor ? "✓" : "—"}</span>
                </div>

                {r.motivo && <p className="text-xs text-slate-600 line-clamp-2"><b>Motivo:</b> {r.motivo}</p>}

                <div className="flex items-center justify-end gap-1 pt-2 border-t border-slate-100">
                  <Button size="sm" variant="outline" onClick={() => gerarPdf(r.id)}><Eye className="h-3.5 w-3.5 mr-1.5" />PDF</Button>
                  {isEditor && <Button size="icon" variant="ghost" onClick={() => { setEditId(r.id); setOpen(true); }} title="Editar autorização"><Pencil className="h-4 w-4" /></Button>}
                  {isAdmin && <Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir esta autorização?")) del.mutate(r.id); }} title="Excluir"><Trash2 className="h-4 w-4 text-rose-500" /></Button>}
                </div>
              </div>
            );
          })}
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