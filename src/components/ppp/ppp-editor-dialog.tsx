import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, Send, Download, FileSignature, Lock, Printer, X } from "lucide-react";
import { toast } from "sonner";
import { gerarPPPPdf, emptyPPPDados, type PPPDados, type PPPRisco } from "@/lib/ppp-pdf";
import { PDFPreviewDialog } from "@/components/pdf-preview-dialog";
import type jsPDF from "jspdf";

/** Formata YYYY-MM-DD -> DD/MM/YYYY */
function fmtBR(d?: string | null) {
  if (!d) return "";
  const iso = String(d).split("T")[0];
  const [y, m, day] = iso.split("-");
  return y && m && day ? `${day}/${m}/${y}` : String(d);
}

function tipoFromCategoria(cat?: string | null): string {
  switch ((cat ?? "").toUpperCase()) {
    case "FISICO": return "Físico";
    case "QUIMICO": return "Químico";
    case "BIOLOGICO": return "Biológico";
    case "ERGONOMICO": return "Ergonômicos";
    case "ACIDENTE": return "Acidente";
    default: return "—";
  }
}

type AnyRow = any;

export function PPPEditorDialog({
  open, onOpenChange, employee, company, role,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employee: AnyRow | null;
  company: AnyRow | null;
  role: AnyRow | null;
}) {
  const qc = useQueryClient();
  const empId = employee?.id;
  const [pppId, setPppId] = useState<string | null>(null);
  const [status, setStatus] = useState<"RASCUNHO" | "EMITIDO" | "CANCELADO">("RASCUNHO");
  const [numero, setNumero] = useState<string | null>(null);
  const [dados, setDados] = useState<PPPDados>(() => emptyPPPDados());
  const [saving, setSaving] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<jsPDF | null>(null);

  const isFinal = status === "EMITIDO";

  useQuery({
    queryKey: ["ppp-load", empId, open],
    enabled: !!empId && open,
    queryFn: async () => {
      const { data: rasc } = await supabase
        .from("ppp_emissoes" as any)
        .select("*")
        .eq("employee_id", empId)
        .eq("status", "RASCUNHO")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (rasc) {
        setPppId((rasc as any).id);
        setStatus("RASCUNHO");
        setNumero(null);
        setDados({ ...emptyPPPDados(), ...((rasc as any).dados as PPPDados) });
        return rasc;
      }
      const defaults = await buildDefaults(employee, company, role);
      setPppId(null);
      setStatus("RASCUNHO");
      setNumero(null);
      setDados(defaults);
      return null;
    },
  });

  async function handleSave(newStatus: "RASCUNHO" | "EMITIDO") {
    if (!empId) return;
    setSaving(true);
    try {
      const payload: any = {
        employee_id: empId,
        company_id: company?.id ?? null,
        role_id: role?.id ?? null,
        status: newStatus,
        dados,
        observacoes: dados.observacoes,
      };
      const res = pppId
        ? await supabase.from("ppp_emissoes" as any).update(payload).eq("id", pppId).select("*").single()
        : await supabase.from("ppp_emissoes" as any).insert(payload).select("*").single();
      if (res.error) throw res.error;
      const row: any = res.data;
      setPppId(row.id);
      setStatus(row.status);
      setNumero(row.numero ?? null);
      qc.invalidateQueries({ queryKey: ["ppp-list", empId] });
      toast.success(newStatus === "EMITIDO" ? `PPP ${row.numero} emitido!` : "Rascunho salvo.");
    } catch (e: any) {
      console.error("[ppp-save]", e);
      toast.error("Erro ao salvar: " + (e?.message ?? "desconhecido"));
    } finally {
      setSaving(false);
    }
  }

  function handleDownloadPdf() {
    try {
      const doc = gerarPPPPdf(dados, { numero });
      setPreviewDoc(doc);
    } catch (e: any) {
      console.error("[ppp-pdf]", e);
      toast.error("Erro ao gerar PDF: " + (e?.message ?? "desconhecido"));
    }
  }

  function handlePrint() {
    window.print();
  }

  const set = <K extends keyof PPPDados>(k: K, v: PPPDados[K]) =>
    setDados((d) => ({ ...d, [k]: v }));

  const upd = <K extends keyof PPPDados>(key: K, i: number, val: any) => {
    setDados((d) => {
      const arr = [...(d[key] as any[])];
      arr[i] = val;
      return { ...d, [key]: arr };
    });
  };

  const fileSafeName = (employee?.nome ?? "funcionario").toLowerCase().replace(/\s+/g, "_");

  return (
    <>
      {/* CSS específico de impressão — esconde tudo menos o formulário */}
      <style>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          body * { visibility: hidden !important; }
          .ppp-print-area, .ppp-print-area * { visibility: visible !important; }
          .ppp-print-area {
            position: absolute !important; left: 0 !important; top: 0 !important;
            width: 100% !important; padding: 0 !important; margin: 0 !important;
            box-shadow: none !important; background: white !important;
          }
          .no-print, [data-no-print="true"] { display: none !important; }
          .ppp-input { border: 0 !important; padding: 0 !important; box-shadow: none !important; background: transparent !important; }
        }
        .ppp-form { font-family: Arial, Helvetica, sans-serif; color: #000; background: white; }
        .ppp-form .cell { border: 1px solid #000; padding: 4px 6px; vertical-align: top; }
        .ppp-form .label { font-size: 8.5px; font-weight: 700; color: #000; line-height: 1.15; display: block; }
        .ppp-form .val { font-size: 10px; min-height: 14px; padding: 1px 0; }
        .ppp-form .ppp-input {
          width: 100%; border: 0; outline: 0; font-family: inherit;
          font-size: 10px; padding: 1px 2px; background: transparent; color: #000;
        }
        .ppp-form .ppp-input:focus { background: #fffbe6; outline: 1px dashed #c084fc; }
        .ppp-form .ppp-textarea {
          width: 100%; border: 0; outline: 0; font-family: inherit;
          font-size: 10px; padding: 2px; background: transparent; color: #000; resize: vertical;
        }
        .ppp-form .ppp-textarea:focus { background: #fffbe6; outline: 1px dashed #c084fc; }
        .ppp-form .section-band {
          background: #000; color: #fff; font-weight: 700; text-align: center;
          padding: 3px 0; font-size: 10.5px; letter-spacing: 0.5px; text-transform: uppercase;
        }
        .ppp-form .block-title {
          background: #e6e6e6; font-weight: 700; padding: 3px 6px; font-size: 10px;
          border: 1px solid #000; border-bottom: 0;
        }
        .ppp-form table { width: 100%; border-collapse: collapse; }
        .ppp-form .head-th { background: #eee; font-size: 8.5px; font-weight: 700; text-align: center; }
      `}</style>

      <Dialog open={open} onOpenChange={(v) => { if (!saving) onOpenChange(v); }}>
        <DialogContent className="max-w-[900px] max-h-[95vh] overflow-hidden flex flex-col p-0 gap-0">
          {/* Toolbar (oculta na impressão) */}
          <div data-no-print="true" className="no-print flex items-center justify-between gap-3 px-4 py-3 border-b bg-white sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <FileSignature className="h-5 w-5 text-violet-700" />
              <div>
                <div className="text-sm font-bold">PPP — Perfil Profissiográfico Previdenciário</div>
                <div className="text-[11px] text-slate-500">
                  {isFinal && numero ? (
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200" variant="outline">
                      <Lock className="h-3 w-3 mr-1" />{numero}
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-700 border-amber-200" variant="outline">Rascunho</Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {!isFinal && (
                <Button size="sm" variant="secondary" onClick={() => handleSave("RASCUNHO")} disabled={saving} className="gap-1.5">
                  <Save className="h-3.5 w-3.5" /> Rascunho
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={handlePrint} disabled={saving} className="gap-1.5">
                <Printer className="h-3.5 w-3.5" /> Imprimir
              </Button>
              <Button size="sm" variant="outline" onClick={handleDownloadPdf} disabled={saving} className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> Baixar PDF
              </Button>
              {!isFinal && (
                <Button size="sm" onClick={() => handleSave("EMITIDO")} disabled={saving} className="gap-1.5 bg-violet-700 hover:bg-violet-800">
                  <Send className="h-3.5 w-3.5" /> Emitir final
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Área imprimível */}
          <div className="flex-1 overflow-y-auto bg-slate-100 p-4">
            <div className="ppp-print-area mx-auto bg-white shadow-md" style={{ width: "190mm", padding: "8mm" }}>
              <PPPForm dados={dados} isFinal={isFinal} numero={numero} set={set} upd={upd} setDados={setDados} employeeSig={employee?.assinatura_url ?? null} />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PDFPreviewDialog
        open={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        doc={previewDoc}
        fileName={`PPP_${fileSafeName}${numero ? `_${numero.replace(/[/]/g, "-")}` : ""}.pdf`}
        title="PPP — Pré-visualização"
      />
    </>
  );
}

/* ============================== FORM ============================== */

function PPPForm({
  dados, isFinal, numero, set, upd, setDados, employeeSig,
}: {
  dados: PPPDados;
  isFinal: boolean;
  numero: string | null;
  set: <K extends keyof PPPDados>(k: K, v: PPPDados[K]) => void;
  upd: <K extends keyof PPPDados>(key: K, i: number, val: any) => void;
  setDados: React.Dispatch<React.SetStateAction<PPPDados>>;
  employeeSig: string | null;
}) {
  const ro = isFinal;

  return (
    <div className="ppp-form">
      {/* Cabeçalho */}
      <div style={{ textAlign: "center", marginBottom: 6 }}>
        <div style={{ fontSize: 9, marginBottom: 2 }}>Previdência Social</div>
        <div style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase" }}>
          PERFIL PROFISSIOGRÁFICO PREVIDENCIÁRIO (PPP)
        </div>
        {numero && (
          <div style={{ fontSize: 9, marginTop: 2 }}>Nº {numero}</div>
        )}
      </div>

      {/* SEÇÃO I */}
      <div className="section-band">DADOS ADMINISTRATIVOS</div>

      <table>
        <tbody>
          <tr>
            <td className="cell" style={{ width: "38%" }}>
              <span className="label">1 Nº CNPJ do Domicílio Tributário/CEI/CAEPF/CNO</span>
              <Inp ro={ro} value={dados.empresa_cnpj} onChange={(v) => set("empresa_cnpj", v)} />
            </td>
            <td className="cell" style={{ width: "44%" }}>
              <span className="label">2 Nome Empresarial</span>
              <Inp ro={ro} value={dados.empresa_nome} onChange={(v) => set("empresa_nome", v)} />
            </td>
            <td className="cell" style={{ width: "18%" }}>
              <span className="label">3 CNAE</span>
              <Inp ro={ro} value={dados.empresa_cnae} onChange={(v) => set("empresa_cnae", v)} />
            </td>
          </tr>
          <tr>
            <td className="cell">
              <span className="label">4 Nome do Trabalhador</span>
              <Inp ro={ro} value={dados.trab_nome} onChange={(v) => set("trab_nome", v)} />
            </td>
            <td className="cell">
              <span className="label">5 BR/PDH</span>
              <Inp ro={ro} value={dados.trab_br_pdh} onChange={(v) => set("trab_br_pdh", v)} />
            </td>
            <td className="cell">
              <span className="label">6 CPF nº</span>
              <Inp ro={ro} value={dados.trab_cpf} onChange={(v) => set("trab_cpf", v)} />
            </td>
          </tr>
        </tbody>
      </table>

      <table>
        <tbody>
          <tr>
            <td className="cell" style={{ width: "18%" }}>
              <span className="label">7 Data do Nascimento</span>
              <Inp ro={ro} value={dados.trab_nascimento} onChange={(v) => set("trab_nascimento", v)} placeholder="DD/MM/AAAA" />
            </td>
            <td className="cell" style={{ width: "14%" }}>
              <span className="label">8 Sexo (F/M)</span>
              <Inp ro={ro} value={dados.trab_sexo} onChange={(v) => set("trab_sexo", v)} />
            </td>
            <td className="cell" style={{ width: "28%" }}>
              <span className="label">9 Matrícula do Trabalhador no eSocial</span>
              <Inp ro={ro} value={dados.trab_matricula_esocial} onChange={(v) => set("trab_matricula_esocial", v)} />
            </td>
            <td className="cell" style={{ width: "20%" }}>
              <span className="label">10 Data de Admissão</span>
              <Inp ro={ro} value={dados.trab_admissao} onChange={(v) => set("trab_admissao", v)} placeholder="DD/MM/AAAA" />
            </td>
            <td className="cell" style={{ width: "20%" }}>
              <span className="label">11 Regime de Revezamento</span>
              <Inp ro={ro} value={dados.regime_revezamento} onChange={(v) => set("regime_revezamento", v)} />
            </td>
          </tr>
        </tbody>
      </table>

      {/* 12 CAT */}
      <BlockTitle title="12 - CAT REGISTRADA" right={
        !ro && <SmallAddBtn onClick={() => set("cats", [...dados.cats, { data: "", numero: "" }])} />
      } />
      <table>
        <thead>
          <tr>
            <th className="cell head-th" style={{ width: "30%" }}>12.1 Data do Registro</th>
            <th className="cell head-th">12.2 Número da CAT</th>
            {!ro && <th className="cell head-th" style={{ width: "8%" }}></th>}
          </tr>
        </thead>
        <tbody>
          {dados.cats.length === 0 && (
            <tr><td className="cell" style={{ height: 18 }} colSpan={ro ? 2 : 3}></td></tr>
          )}
          {dados.cats.map((c, i) => (
            <tr key={i}>
              <td className="cell"><Inp ro={ro} value={c.data} onChange={(v) => upd("cats", i, { ...c, data: v })} placeholder="DD/MM/AAAA" /></td>
              <td className="cell"><Inp ro={ro} value={c.numero} onChange={(v) => upd("cats", i, { ...c, numero: v })} /></td>
              {!ro && <td className="cell" style={{ textAlign: "center" }}><RmBtn onClick={() => set("cats", dados.cats.filter((_, j) => j !== i))} /></td>}
            </tr>
          ))}
        </tbody>
      </table>

      {/* 13 Lotação */}
      <BlockTitle title="13 - Lotação e Atribuição" right={
        !ro && <SmallAddBtn onClick={() => set("lotacoes", [...dados.lotacoes, { periodo: "", cnpj: "", setor: "", cargo: "", funcao: "", cbo: "", gfip_esocial: "00" }])} label="Adicionar período" />
      } />
      {dados.lotacoes.length === 0 && (
        <div className="cell" style={{ height: 24 }} />
      )}
      {dados.lotacoes.map((l, i) => (
        <table key={i}>
          <tbody>
            <tr>
              <td className="cell" style={{ width: "26%", verticalAlign: "top" }} rowSpan={6}>
                <span className="label">13.1 - Período</span>
                <Inp ro={ro} value={l.periodo} onChange={(v) => upd("lotacoes", i, { ...l, periodo: v })} placeholder="DD/MM/AAAA a DD/MM/AAAA" />
                {!ro && (
                  <div style={{ marginTop: 8 }}>
                    <RmBtn onClick={() => set("lotacoes", dados.lotacoes.filter((_, j) => j !== i))} />
                  </div>
                )}
              </td>
              <td className="cell" style={{ width: "26%" }}><span className="label">13.2 - Nº CNPJ/CEI/CAEPF/CNO</span></td>
              <td className="cell"><Inp ro={ro} value={l.cnpj} onChange={(v) => upd("lotacoes", i, { ...l, cnpj: v })} /></td>
            </tr>
            <tr>
              <td className="cell"><span className="label">13.3 - Setor</span></td>
              <td className="cell"><Inp ro={ro} value={l.setor} onChange={(v) => upd("lotacoes", i, { ...l, setor: v })} /></td>
            </tr>
            <tr>
              <td className="cell"><span className="label">13.4 - Cargo</span></td>
              <td className="cell"><Inp ro={ro} value={l.cargo} onChange={(v) => upd("lotacoes", i, { ...l, cargo: v })} /></td>
            </tr>
            <tr>
              <td className="cell"><span className="label">13.5 - Função</span></td>
              <td className="cell"><Inp ro={ro} value={l.funcao} onChange={(v) => upd("lotacoes", i, { ...l, funcao: v })} /></td>
            </tr>
            <tr>
              <td className="cell"><span className="label">13.6 - CBO</span></td>
              <td className="cell"><Inp ro={ro} value={l.cbo} onChange={(v) => upd("lotacoes", i, { ...l, cbo: v })} /></td>
            </tr>
            <tr>
              <td className="cell"><span className="label">13.7 - Código GFIP/eSocial</span></td>
              <td className="cell"><Inp ro={ro} value={l.gfip_esocial} onChange={(v) => upd("lotacoes", i, { ...l, gfip_esocial: v })} /></td>
            </tr>
          </tbody>
        </table>
      ))}

      {/* 14 Profissiografia */}
      <BlockTitle title="14 - Profissiografia" right={
        !ro && <SmallAddBtn onClick={() => set("profissiografias", [...dados.profissiografias, { periodo: "", descricao: "" }])} label="Adicionar período" />
      } />
      <table>
        <thead>
          <tr>
            <th className="cell head-th" style={{ width: "26%" }}>14.1 - Período</th>
            <th className="cell head-th">14.2 - Descrição Atividades</th>
            {!ro && <th className="cell head-th" style={{ width: "8%" }}></th>}
          </tr>
        </thead>
        <tbody>
          {dados.profissiografias.length === 0 && (
            <tr><td className="cell" colSpan={ro ? 2 : 3} style={{ height: 40 }}></td></tr>
          )}
          {dados.profissiografias.map((p, i) => (
            <tr key={i}>
              <td className="cell" style={{ verticalAlign: "top" }}>
                <Inp ro={ro} value={p.periodo} onChange={(v) => upd("profissiografias", i, { ...p, periodo: v })} />
              </td>
              <td className="cell">
                <Txt ro={ro} value={p.descricao} onChange={(v) => upd("profissiografias", i, { ...p, descricao: v })} rows={4} />
              </td>
              {!ro && <td className="cell" style={{ textAlign: "center" }}><RmBtn onClick={() => set("profissiografias", dados.profissiografias.filter((_, j) => j !== i))} /></td>}
            </tr>
          ))}
        </tbody>
      </table>

      {/* SEÇÃO II */}
      <div className="section-band" style={{ marginTop: 6 }}>REGISTROS AMBIENTAIS</div>

      <BlockTitle title="15 - Exposição a Fatores de Riscos" right={
        !ro && <SmallAddBtn onClick={() => set("riscos", [...dados.riscos, { periodo: "", tipo: "Físico", fator_risco: "", intensidade: "NA", tecnica: "NA", epc_eficaz: "NA", epi_eficaz: "NA", ca_epi: "" }])} label="Adicionar risco" />
      } />
      <table>
        <thead>
          <tr>
            <th className="cell head-th">15.1 Período</th>
            <th className="cell head-th">15.2 Tipo</th>
            <th className="cell head-th">15.3 Fator de Risco</th>
            <th className="cell head-th">15.4 Intensidade/ Concentração</th>
            <th className="cell head-th">15.5 Técnica Utilizada</th>
            <th className="cell head-th">15.6 EPC Eficaz (S/N)</th>
            <th className="cell head-th">15.7 EPI Eficaz (S/N)</th>
            <th className="cell head-th">15.8 CA EPI</th>
            {!ro && <th className="cell head-th"></th>}
          </tr>
        </thead>
        <tbody>
          {dados.riscos.length === 0 && (
            <tr><td className="cell" colSpan={ro ? 8 : 9} style={{ height: 18 }}></td></tr>
          )}
          {dados.riscos.map((r, i) => (
            <tr key={i}>
              <td className="cell"><Inp ro={ro} value={r.periodo} onChange={(v) => upd("riscos", i, { ...r, periodo: v })} /></td>
              <td className="cell"><Inp ro={ro} value={r.tipo} onChange={(v) => upd("riscos", i, { ...r, tipo: v })} /></td>
              <td className="cell"><Inp ro={ro} value={r.fator_risco} onChange={(v) => upd("riscos", i, { ...r, fator_risco: v })} /></td>
              <td className="cell"><Inp ro={ro} value={r.intensidade} onChange={(v) => upd("riscos", i, { ...r, intensidade: v })} /></td>
              <td className="cell"><Inp ro={ro} value={r.tecnica} onChange={(v) => upd("riscos", i, { ...r, tecnica: v })} /></td>
              <td className="cell" style={{ textAlign: "center" }}><Inp ro={ro} value={r.epc_eficaz} onChange={(v) => upd("riscos", i, { ...r, epc_eficaz: v })} /></td>
              <td className="cell" style={{ textAlign: "center" }}><Inp ro={ro} value={r.epi_eficaz} onChange={(v) => upd("riscos", i, { ...r, epi_eficaz: v })} /></td>
              <td className="cell"><Inp ro={ro} value={r.ca_epi} onChange={(v) => upd("riscos", i, { ...r, ca_epi: v })} /></td>
              {!ro && <td className="cell" style={{ textAlign: "center" }}><RmBtn onClick={() => set("riscos", dados.riscos.filter((_, j) => j !== i))} /></td>}
            </tr>
          ))}
        </tbody>
      </table>

      {/* 15.9 NR-06/NR-01 */}
      <table style={{ marginTop: 2 }}>
        <thead>
          <tr>
            <th className="cell head-th" style={{ textAlign: "left", padding: "4px 6px" }}>
              15.9 Atendimento aos requisitos das NR-06 e NR-01 do MTP pelos EPIs informados (*)
            </th>
            <th className="cell head-th" style={{ width: "12%" }}>(S/N)</th>
          </tr>
        </thead>
        <tbody>
          {[
            ["nr_medidas_protecao", "Foi tentada a implementação de medidas de proteção coletiva, de caráter administrativo ou de organização do trabalho, optando-se pelo EPI por inviabilidade técnica, insuficiência ou interinidade, ou ainda em caráter complementar ou emergencial?"],
            ["nr_funcionamento_epi", "Foram observadas as condições de funcionamento e do uso ininterrupto do EPI ao longo do tempo, conforme especificação técnica do fabricante, ajustada às condições de campo?"],
            ["nr_prazo_validade", "Foi observado o prazo de validade, conforme Certificado de Aprovação - CA do MTP?"],
            ["nr_periodicidade_troca", "Foi observada a periodicidade de troca definida pelos programas ambientais, comprovada mediante recibo assinado pelo usuário em época própria?"],
            ["nr_higienizacao", "Foi observada a higienização?"],
          ].map(([k, q]) => (
            <tr key={k}>
              <td className="cell" style={{ fontSize: 9.5 }}>{q}</td>
              <td className="cell" style={{ textAlign: "center" }}>
                <Inp ro={ro} value={(dados as any)[k]} onChange={(v) => set(k as any, v as any)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 16 Responsável pelos Registros Ambientais */}
      <BlockTitle title="16 - Responsável pelos Registros Ambientais" right={
        !ro && <SmallAddBtn onClick={() => set("responsaveis", [...dados.responsaveis, { periodo: "", cpf: "", registro: "", nome: "" }])} />
      } />
      <table>
        <thead>
          <tr>
            <th className="cell head-th" style={{ width: "24%" }}>16.1 Período</th>
            <th className="cell head-th" style={{ width: "18%" }}>16.2 CPF nº</th>
            <th className="cell head-th" style={{ width: "22%" }}>16.3 Reg. Cons. de classe</th>
            <th className="cell head-th">16.4 Nome do profissional legalmente habilitado</th>
            {!ro && <th className="cell head-th" style={{ width: "6%" }}></th>}
          </tr>
        </thead>
        <tbody>
          {dados.responsaveis.length === 0 && (
            <tr><td className="cell" colSpan={ro ? 4 : 5} style={{ height: 18 }}></td></tr>
          )}
          {dados.responsaveis.map((r, i) => (
            <tr key={i}>
              <td className="cell"><Inp ro={ro} value={r.periodo} onChange={(v) => upd("responsaveis", i, { ...r, periodo: v })} /></td>
              <td className="cell"><Inp ro={ro} value={r.cpf} onChange={(v) => upd("responsaveis", i, { ...r, cpf: v })} /></td>
              <td className="cell"><Inp ro={ro} value={r.registro} onChange={(v) => upd("responsaveis", i, { ...r, registro: v })} /></td>
              <td className="cell"><Inp ro={ro} value={r.nome} onChange={(v) => upd("responsaveis", i, { ...r, nome: v })} /></td>
              {!ro && <td className="cell" style={{ textAlign: "center" }}><RmBtn onClick={() => set("responsaveis", dados.responsaveis.filter((_, j) => j !== i))} /></td>}
            </tr>
          ))}
        </tbody>
      </table>

      {/* SEÇÃO III */}
      <div className="section-band" style={{ marginTop: 6 }}>RESPONSÁVEIS PELAS INFORMAÇÕES</div>
      <div className="cell" style={{ fontSize: 9, textAlign: "justify", lineHeight: 1.35 }}>
        Declaramos, para todos fins de direito, que as informações prestadas neste documento são verídicas e foram transcritas fielmente dos registros administrativos, das demonstrações ambientais e dos programas médicos de responsabilidade da empresa. É de nosso conhecimento que a prestação de informações falsas neste documento constitui crime de falsificação de documento público, nos termos do art. 297 do Código Penal e, também, que tais informações são de caráter privativo do trabalhador, constituindo crime, nos termos da Lei nº 9.029, de 13 de abril de 1995, práticas discriminatórias decorrentes de sua exigibilidade por outrem, bem como de sua divulgação para terceiros, ressalvado quando exigida pelos órgãos públicos competentes.
      </div>

      <table>
        <tbody>
          <tr>
            <td className="cell" style={{ width: "30%", verticalAlign: "top" }} rowSpan={2}>
              <span className="label">17 Data da Emissão do PPP</span>
              <Inp ro={ro} value={dados.data_emissao} onChange={(v) => set("data_emissao", v)} placeholder="DD/MM/AAAA" />
            </td>
            <td className="cell head-th" colSpan={2} style={{ textAlign: "left" }}>
              18 Representante Legal da Empresa
            </td>
          </tr>
          <tr>
            <td className="cell" style={{ width: "26%" }}>
              <span className="label">18.1 Nº CPF do Representante Legal</span>
              <Inp ro={ro} value={dados.rep_legal_cpf} onChange={(v) => set("rep_legal_cpf", v)} />
            </td>
            <td className="cell">
              <span className="label">18.2 Nome do Representante Legal</span>
              <Inp ro={ro} value={dados.rep_legal_nome} onChange={(v) => set("rep_legal_nome", v)} />
            </td>
          </tr>
          <tr>
            <td className="cell" colSpan={3} style={{ textAlign: "center", padding: "14px 6px" }}>
              {employeeSig ? (
                <img src={employeeSig} alt="Assinatura" style={{ maxHeight: 50, display: "inline-block" }} />
              ) : null}
              <div style={{ borderTop: "1px solid #000", margin: "0 auto", width: "60%", marginTop: 4 }} />
              <div style={{ fontSize: 9, marginTop: 2 }}>(Assinatura física ou eletrônica)</div>
            </td>
          </tr>
        </tbody>
      </table>

      <BlockTitle title="Observações" />
      <div className="cell">
        <Txt ro={ro} value={dados.observacoes} onChange={(v) => set("observacoes", v)} rows={3} />
      </div>
    </div>
  );
}

/* ============================== Subcomponentes ============================== */

function Inp({ ro, value, onChange, placeholder }: { ro: boolean; value: string; onChange: (v: string) => void; placeholder?: string }) {
  if (ro) return <div className="val">{value || "\u00A0"}</div>;
  return <input className="ppp-input" value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />;
}

function Txt({ ro, value, onChange, rows = 3 }: { ro: boolean; value: string; onChange: (v: string) => void; rows?: number }) {
  if (ro) return <div className="val" style={{ whiteSpace: "pre-wrap" }}>{value || "\u00A0"}</div>;
  return <textarea className="ppp-textarea" rows={rows} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
}

function BlockTitle({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="block-title" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span>{title}</span>
      <span data-no-print="true" className="no-print">{right}</span>
    </div>
  );
}

function SmallAddBtn({ onClick, label = "Adicionar" }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} className="no-print inline-flex items-center gap-1 text-[10px] font-bold text-violet-700 hover:text-violet-900">
      <Plus className="h-3 w-3" /> {label}
    </button>
  );
}

function RmBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="no-print inline-flex items-center text-rose-600 hover:text-rose-800">
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}

/* ============================== Defaults ============================== */

async function buildDefaults(emp: AnyRow, company: AnyRow | null, role: AnyRow | null): Promise<PPPDados> {
  const d = emptyPPPDados();
  // Empresa
  d.empresa_cnpj = company?.cnpj ?? "";
  d.empresa_nome = company?.name ?? "";
  d.empresa_cnae = company?.cnae ?? "";
  // Trabalhador
  d.trab_nome = emp?.nome ?? "";
  d.trab_cpf = emp?.cpf ?? "";
  d.trab_nascimento = fmtBR(emp?.data_nascimento);
  d.trab_sexo = emp?.sexo ?? "";
  d.trab_matricula_esocial = emp?.pis ?? emp?.matricula ?? "";
  d.trab_admissao = fmtBR(emp?.admissao);

  const periodo = `${fmtBR(emp?.admissao) || "—"} a atual`;
  // Lotação — CBO vem do CARGO (role), não do funcionário
  d.lotacoes = [{
    periodo,
    cnpj: company?.cnpj ?? "",
    setor: emp?.setor ?? role?.setor ?? "",
    cargo: role?.name ?? "",
    funcao: role?.name ?? "",
    cbo: role?.cbo ?? "",
    gfip_esocial: "00",
  }];
  // Profissiografia — do cargo
  d.profissiografias = [{
    periodo,
    descricao: role?.atividades ?? role?.descricao_atividades ?? "",
  }];

  // Riscos do cargo
  if (emp?.role_id) {
    const { data: rs } = await supabase
      .from("cargo_riscos")
      .select("*, catalogo_riscos(nome, categoria, codigo_esocial)")
      .eq("role_id", emp.role_id)
      .eq("ativo", true);

    d.riscos = ((rs as any[]) ?? []).map((r: any) => {
      const nome = r.catalogo_riscos?.nome ?? "—";
      const cat = tipoFromCategoria(r.catalogo_riscos?.categoria);
      const intensidade = r.intensidade != null ? `${r.intensidade}${r.unidade ? " " + r.unidade : ""}` : "NA";
      return {
        periodo,
        tipo: cat,
        fator_risco: nome,
        intensidade,
        tecnica: r.tecnica_medicao ?? "NA",
        epc_eficaz: "NA",
        epi_eficaz: r.epi_atenuacao_db != null ? "Sim" : "NA",
        ca_epi: r.ca_epi ?? "",
      } as PPPRisco;
    });
  }

  d.data_emissao = new Date().toLocaleDateString("pt-BR");
  return d;
}