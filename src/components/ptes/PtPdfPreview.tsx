import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Printer, X, Download, PenLine } from "lucide-react";
import { formatDateBR } from "@/lib/utils-date";
import { PT_TIPOS } from "@/lib/constants";
import { printHtmlContent } from "@/lib/pdf-print";
import { hasOverlay } from "@/lib/pdf-overlay-maps";
import { gerarPtePdf } from "@/lib/pte-pdf";
import { SignaturePadDialog } from "@/components/signature-pad-dialog";

interface Props {
  open: boolean;
  onClose: () => void;
  pt: any;
  apr?: any;
  casco?: any;
  company?: any;
}

export function PtPdfPreview({ open, onClose, pt, apr, casco, company }: Props) {
  const overlayCodigo = pt?.tipo_pt === "PET" ? "FOR-SEG-05" : "FOR-SEG-04";
  const useOverlay = pt ? hasOverlay(overlayCodigo) : false;
  const [assinaturaTst, setAssinaturaTst] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [padOpen, setPadOpen] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const overlayParams = useMemo(() => {
    if (!pt) return null;
    const fmt = (d?: string | null) => d ? formatDateBR(d) : "";
    return {
      numero: pt.numero,
      data_inicio: fmt(pt.data_emissao || pt.data),
      hora_inicio: pt.hora_inicio ?? "",
      data_fim: fmt(pt.validade_ate || pt.data_emissao || pt.data),
      hora_fim: pt.hora_fim ?? "",
      empresa: company?.name ?? "",
      encarregado: pt.encarregado_nome ?? pt.supervisor_entrada_nome ?? "",
      local_descricao: [pt.local, pt.descricao].filter(Boolean).join(" — "),
      tipo_pt: pt.tipo_pt,
      area_restrita: pt.area_restrita ?? null,
      mao_obra: pt.mao_obra ?? null,
      fim_de_semana: pt.fim_de_semana ?? null,
      assinatura_tst_data_url: assinaturaTst,
    };
  }, [pt, company, assinaturaTst]);

  useEffect(() => {
    if (!open || !useOverlay || !overlayParams) return;
    let revoked: string | null = null;
    let cancelled = false;
    setPdfLoading(true);
    setPdfError(null);
    gerarPtePdf(overlayParams)
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        revoked = url;
        setPdfUrl(url);
      })
      .catch((e) => !cancelled && setPdfError(String(e?.message ?? e)))
      .finally(() => !cancelled && setPdfLoading(false));
    return () => { cancelled = true; if (revoked) URL.revokeObjectURL(revoked); };
  }, [open, useOverlay, overlayParams]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!pt) return null;
  const tipoInfo = PT_TIPOS.find((t) => t.value === pt.tipo_pt) ?? PT_TIPOS[0];

  const handleDownloadOverlay = () => {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = `${pt.numero || "PTE"}.pdf`;
    a.click();
  };
  const handlePrintOverlay = () => {
    if (!pdfUrl) return;
    const w = window.open(pdfUrl, "_blank");
    if (w) setTimeout(() => { try { w.focus(); w.print(); } catch {} }, 500);
  };

  const handlePrint = async () => {
    const node = document.getElementById("pt-print-area");
    if (!node) return window.print();
    await printHtmlContent(node.innerHTML, pt.numero, `
        .sigmo-print-html-root { font-family: -apple-system, system-ui, sans-serif; color: #0f172a; font-size: 11px; }
        h1,h2,h3 { margin: 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        td, th { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; vertical-align: top; }
        th { background: #f1f5f9; font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; }
        .header { border-bottom: 3px solid #991b1b; padding-bottom: 8px; margin-bottom: 12px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; margin: 8px 0; }
        .label { font-size: 8px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 0.06em; }
        .value { font-size: 11px; font-weight: 600; color: #0f172a; }
        .sig { margin-top: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
        .sig-box { border-top: 1px solid #64748b; padding-top: 4px; text-align: center; font-size: 9px; text-transform: uppercase; }
    `);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto p-0">
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
          <div className="text-xs font-black uppercase tracking-widest text-slate-700">
            {useOverlay ? "PDF Homologado — " : "Pré-visualização — "}{pt.numero}
          </div>
          <div className="flex gap-2">
            {useOverlay ? (
              <>
                <Button onClick={() => setPadOpen(true)} size="sm" variant="outline">
                  <PenLine className="h-4 w-4 mr-1" />
                  {assinaturaTst ? "Refazer assinatura" : "Assinar (TST)"}
                </Button>
                <Button onClick={handleDownloadOverlay} size="sm" variant="outline" disabled={!pdfUrl}>
                  <Download className="h-4 w-4 mr-1" /> Baixar
                </Button>
                <Button onClick={handlePrintOverlay} size="sm" disabled={!pdfUrl} className="bg-[#991b1b] hover:bg-[#7f1d1d] text-white">
                  <Printer className="h-4 w-4 mr-1" /> Imprimir
                </Button>
              </>
            ) : (
              <Button onClick={handlePrint} size="sm" className="bg-[#991b1b] hover:bg-[#7f1d1d] text-white">
                <Printer className="h-4 w-4 mr-1" /> Imprimir / PDF
              </Button>
            )}
            <Button onClick={onClose} size="sm" variant="outline">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {useOverlay ? (
          <div className="bg-slate-100 p-4" style={{ minHeight: "70vh" }}>
            {pdfLoading && !pdfUrl && (
              <div className="text-center text-sm text-slate-500 py-20">Carregando PDF homologado…</div>
            )}
            {pdfError && (
              <div className="text-center text-sm text-red-600 py-20">
                Erro ao gerar PDF: {pdfError}
                <div className="text-xs text-slate-500 mt-2">
                  Verifique se o PDF-mãe está subido em Templates de Documentos ({overlayCodigo}).
                </div>
              </div>
            )}
            {pdfUrl && (
              <iframe
                title={`PDF ${pt.numero}`}
                src={pdfUrl}
                className="w-full rounded shadow border border-slate-300"
                style={{ height: "78vh", background: "white" }}
              />
            )}
            {assinaturaTst && (
              <div className="mt-2 text-[10px] text-emerald-700 font-bold uppercase tracking-wider text-center">
                ✓ Assinatura do TST aplicada
              </div>
            )}
          </div>
        ) : (
        <div id="pt-print-area" className="p-8 bg-white text-slate-900">
          <div className="header">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-black text-[#991b1b]">{tipoInfo.label}</h1>
                <div className="text-[10px] font-bold text-slate-500 uppercase mt-1">
                  Normativa: {tipoInfo.nr} • SIGMO SST
                </div>
              </div>
              <div className="text-right">
                <div className="label">Número</div>
                <div className="text-lg font-black text-slate-900">{pt.numero}</div>
                <div className="label mt-2">Status</div>
                <div className={`text-xs font-black uppercase ${pt.status === "ATIVA" ? "text-orange-600" : "text-slate-500"}`}>
                  {pt.status}
                </div>
              </div>
            </div>
          </div>

          <div className="grid">
            <div>
              <div className="label">Data de Emissão</div>
              <div className="value">{formatDateBR(pt.data_emissao || pt.data)}</div>
            </div>
            <div>
              <div className="label">Validade</div>
              <div className="value">
                {pt.validade_tipo === "TURNO" && "Turno (até fim do expediente)"}
                {pt.validade_tipo === "24H" && "24 horas"}
                {pt.validade_tipo === "CUSTOM" && (pt.validade_ate ? formatDateBR(pt.validade_ate) : "Personalizada")}
              </div>
            </div>
            <div>
              <div className="label">Horário Início</div>
              <div className="value">{pt.hora_inicio ?? "—"}</div>
            </div>
            <div>
              <div className="label">Horário Fim</div>
              <div className="value">{pt.hora_fim ?? "—"}</div>
            </div>
            <div>
              <div className="label">Local / Instalação</div>
              <div className="value">{pt.local ?? "—"}</div>
            </div>
            <div>
              <div className="label">Casco / Frente</div>
              <div className="value">{casco ? `Casco ${casco.numero}${casco.nome ? ` — ${casco.nome}` : ""}` : "—"}</div>
            </div>
            <div>
              <div className="label">Empresa Executante</div>
              <div className="value">{company?.name ?? "—"}</div>
            </div>
            <div>
              <div className="label">Executante</div>
              <div className="value">{pt.employee_name ?? "—"}</div>
            </div>
          </div>

          <table>
            <thead><tr><th>APR Vinculada</th><th>Classificação de Risco</th></tr></thead>
            <tbody>
              <tr>
                <td>{apr ? `APR ${apr.numero} — ${apr.atividade_descricao ?? ""}` : (pt.emergencia_sem_apr ? `⚠️ EMERGÊNCIA SEM APR — ${pt.emergencia_justificativa ?? ""}` : "—")}</td>
                <td>{pt.risco ?? "—"}</td>
              </tr>
            </tbody>
          </table>

          <div className="sig">
            <div className="sig-box">
              Emitente (SESMT / Supervisor)<br/>
              <span style={{ fontSize: 8, color: "#94a3b8" }}>Nome / Matrícula / Assinatura</span>
            </div>
            <div className="sig-box">
              Executante<br/>
              <span style={{ fontSize: 8, color: "#94a3b8" }}>{pt.employee_name ?? "Nome / Matrícula / Assinatura"}</span>
            </div>
          </div>

          <div style={{ marginTop: 20, fontSize: 8, color: "#94a3b8", textAlign: "center" }}>
            Documento gerado pelo SIGMO — Sistema Integrado de Gestão Modular.
            Esta PT é válida apenas dentro da janela e local declarados. Qualquer alteração nas condições exige nova emissão.
          </div>
        </div>
        )}
      </DialogContent>
    </Dialog>
    <SignaturePadDialog
      open={padOpen}
      onClose={() => setPadOpen(false)}
      onConfirm={(r) => { setAssinaturaTst(r.dataUrl); setPadOpen(false); }}
      title="Assinatura do Técnico de Segurança do Trabalho"
    />
    </>
  );
}