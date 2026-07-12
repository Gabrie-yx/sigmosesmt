import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, PenLine, Printer, X } from "lucide-react";
import { formatDateBR } from "@/lib/utils-date";
import { printPdf, renderPdfToImagePagesProgressive } from "@/lib/pdf-print";
import { SignaturePadDialog } from "@/components/signature-pad-dialog";
import { gerarPtePdf, type PtePdfParams } from "@/lib/pte-pdf";

interface Props {
  open: boolean;
  onClose: () => void;
  pt: any;
  apr?: any;
  casco?: any;
  company?: any;
  employees?: any[];
}

function isWeekend(date?: string | null) {
  if (!date) return null;
  const d = new Date(`${date.split("T")[0]}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.getDay() === 0 || d.getDay() === 6;
}

function includesAny(source: string, terms: string[]) {
  const normalized = source.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return terms.some((term) => normalized.includes(term));
}

export function PtPdfPreview({ open, onClose, pt, apr, casco, company, employees = [] }: Props) {
  const [assinaturaTst, setAssinaturaTst] = useState<string | null>(null);
  const [padOpen, setPadOpen] = useState(false);
  const [pages, setPages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const tokenRef = useRef(0);

  const params = useMemo<PtePdfParams | null>(() => {
    if (!pt) return null;
    const employeeMap = new Map((employees ?? []).map((e: any) => [e.id, e]));
    const employeeName = (id?: string | null) => (id ? employeeMap.get(id)?.nome : "");
    const encarregado = pt.encarregado_nome
      ?? employeeName(pt.requisitante_id)
      ?? pt.employee_name
      ?? "";
    const localTexto = [pt.local, casco ? `CASCO ${casco.numero}${casco.nome ? ` — ${casco.nome}` : ""}` : null]
      .filter(Boolean).join(" · ");
    const sourceText = [pt.tipo_pt, pt.risco, pt.local, apr?.atividade_descricao].filter(Boolean).join(" ");
    return {
      numero: pt.numero,
      data_inicio: formatDateBR(pt.data_emissao || pt.data),
      hora_inicio: pt.hora_inicio ?? "",
      data_fim: formatDateBR(pt.validade_ate || pt.data_emissao || pt.data),
      hora_fim: pt.hora_fim ?? "",
      empresa: company?.name ?? "",
      encarregado,
      local_descricao: localTexto,
      tipo_pt: pt.tipo_pt,
      mao_obra: pt.mao_obra ?? null,
      fim_de_semana: isWeekend(pt.data_emissao || pt.data),
      area_restrita: pt.area_restrita ?? null,
      atividades: {
        movimentacao_cargas: includesAny(sourceText, ["icamento", "movimentacao", "carga", "guindaste"]),
        manutencao_civil: includesAny(sourceText, ["manutencao civil", "civil", "alvenaria", "concreto"]),
        gases_inflamaveis: includesAny(sourceText, ["gas", "gases", "inflamavel", "inflamaveis"]),
        altura_telhados: includesAny(sourceText, ["altura", "telhado", "andaime"]),
        demolicao_escavacao: includesAny(sourceText, ["demolicao", "escavacao", "vala"]),
        eletricidade: includesAny(sourceText, ["eletric", "loto", "alta tensao"]),
        outros: false,
      },
      assinatura_tst_data_url: assinaturaTst,
    };
  }, [pt, apr, casco, company, employees, assinaturaTst]);

  useEffect(() => {
    if (!open || !params) return;
    const token = ++tokenRef.current;
    setLoading(true);
    setError(null);
    setPages([]);
    blobRef.current = null;
    (async () => {
      try {
        const blob = await gerarPtePdf(params);
        if (tokenRef.current !== token) return;
        blobRef.current = blob;
        const buf = await blob.arrayBuffer();
        await renderPdfToImagePagesProgressive(buf, (page) => {
          if (tokenRef.current !== token) return;
          setPages((prev) => [...prev, page]);
        }, 2);
      } catch (e: any) {
        if (tokenRef.current === token) setError(e?.message ?? "Falha ao gerar PDF");
      } finally {
        if (tokenRef.current === token) setLoading(false);
      }
    })();
    return () => { tokenRef.current++; };
  }, [open, params]);

  if (!pt) return null;

  const handleDownload = () => {
    const blob = blobRef.current; if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${pt.numero || "PTE"}.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handlePrint = async () => {
    const blob = blobRef.current; if (!blob) return;
    await printPdf(blob, `${pt.numero || "PTE"}.pdf`);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden p-0 bg-popover text-popover-foreground border-border">
          <DialogHeader className="sr-only">
            <DialogTitle>Permissão de Trabalho Especial — {pt.numero}</DialogTitle>
            <DialogDescription>Overlay sobre o PDF homologado FOR-SEG-04.</DialogDescription>
          </DialogHeader>

          <div className="border-b border-border px-4 py-3 flex flex-wrap items-center justify-between gap-3 bg-card">
            <div>
              <div className="text-xs font-black uppercase tracking-widest text-foreground">FOR-SEG-04 — {pt.numero}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">PDF homologado com campos preenchidos</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setPadOpen(true)} size="sm" variant="outline">
                <PenLine className="h-4 w-4 mr-1" /> {assinaturaTst ? "Refazer assinatura" : "Assinar (TST)"}
              </Button>
              <Button onClick={handleDownload} size="sm" variant="outline" disabled={loading || !blobRef.current}>
                <Download className="h-4 w-4 mr-1" /> Baixar PDF
              </Button>
              <Button onClick={handlePrint} size="sm" disabled={loading || !blobRef.current}>
                <Printer className="h-4 w-4 mr-1" /> Imprimir
              </Button>
              <Button onClick={onClose} size="sm" variant="outline" aria-label="Fechar">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="max-h-[calc(95vh-65px)] overflow-auto bg-muted p-4">
            {error ? (
              <div className="text-sm text-destructive p-6 text-center">Não foi possível gerar o PDF: {error}</div>
            ) : pages.length === 0 ? (
              <div className="text-sm text-muted-foreground p-6 text-center">
                {loading ? "Aplicando dados no PDF homologado…" : "Aguardando…"}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                {pages.map((p, i) => (
                  <img key={i} src={p} alt={`Página ${i + 1}`} className="w-full max-w-[860px] bg-white shadow-md border border-border" />
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <SignaturePadDialog
        open={padOpen}
        onClose={() => setPadOpen(false)}
        onConfirm={(r) => { setAssinaturaTst(r.dataUrl); setPadOpen(false); }}
        title="Assinatura do TST"
      />
    </>
  );
}

const EMPTY = "\u00a0";

const pteDocumentCss = `
  .pte-document-root { width: 210mm; margin: 0 auto; background: #e7e5e4; color: #111827; font-family: Arial, Helvetica, sans-serif; }
  .pte-sheet { width: 210mm; min-height: 297mm; margin: 0 auto 16px; padding: 7mm; background: #fff; box-shadow: 0 18px 45px rgba(0,0,0,.18); box-sizing: border-box; }
  .pte-sheet * { box-sizing: border-box; }
  .pte-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .pte-table td, .pte-table th { border: 1px solid #111827; padding: 2.2mm 2.4mm; vertical-align: middle; font-size: 8.2pt; line-height: 1.18; color: #111827; }
  .pte-table th { font-weight: 700; text-transform: uppercase; background: #f3f4f6; }
  .pte-title { font-size: 12.8pt; font-weight: 800; text-align: center; letter-spacing: .02em; }
  .pte-subtitle { font-size: 7.2pt; text-align: center; font-weight: 700; text-transform: uppercase; }
  .pte-logo { font-size: 14pt; font-weight: 900; text-align: center; letter-spacing: .08em; }
  .pte-label { display: block; margin-bottom: 1.2mm; font-size: 6.5pt; font-weight: 800; text-transform: uppercase; color: #374151; }
  .pte-value { display: block; min-height: 11pt; font-size: 8.4pt; font-weight: 700; text-transform: uppercase; overflow-wrap: anywhere; }
  .pte-value.normal { text-transform: none; font-weight: 600; }
  .pte-small { font-size: 6.8pt; line-height: 1.12; }
  .pte-section { margin-top: 2.5mm; }
  .pte-section-title { padding: 1.6mm 2.2mm; border: 1px solid #111827; border-bottom: 0; background: #e5e7eb; font-size: 7.4pt; font-weight: 900; text-transform: uppercase; letter-spacing: .03em; }
  .pte-check-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.1mm 3mm; }
  .pte-check { display: inline-flex; align-items: center; gap: 1.4mm; min-height: 12pt; font-size: 7.4pt; font-weight: 700; text-transform: uppercase; }
  .pte-box { width: 11pt; height: 11pt; border: 1.3px solid #111827; display: inline-flex; align-items: center; justify-content: center; font-size: 9pt; font-weight: 900; line-height: 1; flex: 0 0 auto; }
  .pte-line { min-height: 18pt; border-bottom: 1px solid #111827; padding-top: 2mm; font-size: 8pt; font-weight: 700; overflow-wrap: anywhere; }
  .pte-signature-cell { height: 24mm; vertical-align: bottom !important; text-align: center; }
  .pte-signature-img { max-width: 46mm; max-height: 14mm; display: block; margin: 0 auto 1mm; object-fit: contain; }
  .pte-signature-line { border-top: 1px solid #111827; padding-top: 1mm; font-size: 6.8pt; font-weight: 800; text-transform: uppercase; }
  .pte-muted { color: #4b5563; font-weight: 600; }
  .pte-page-break { break-before: page; page-break-before: always; }
  @media print {
    .pte-document-root { background: #fff !important; }
    .pte-sheet { margin: 0 !important; box-shadow: none !important; break-after: page; page-break-after: always; }
    .pte-sheet:last-child { break-after: auto; page-break-after: auto; }
  }
`;

const printCss = `
  @page { size: A4; margin: 0; }
  .sigmo-print-html-root { width: 210mm !important; padding: 0 !important; }
  .pte-document-root { background: #fff !important; }
  .pte-sheet { margin: 0 !important; box-shadow: none !important; break-after: page; page-break-after: always; }
  .pte-sheet:last-child { break-after: auto; page-break-after: auto; }
`;

function mark(checked: boolean) {
  return checked ? "X" : "";
}

function valueOrBlank(value: unknown) {
  const text = value == null ? "" : String(value).trim();
  return text || EMPTY;
}

