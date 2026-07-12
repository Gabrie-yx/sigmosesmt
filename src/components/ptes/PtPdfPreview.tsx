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
  const [blob, setBlob] = useState<Blob | null>(null);
  const tokenRef = useRef(0);

  const params = useMemo<PtePdfParams | null>(() => {
    if (!pt) return null;
    const employeeMap = new Map((employees ?? []).map((e: any) => [e.id, e]));
    const employeeName = (id?: string | null) => (id ? employeeMap.get(id)?.nome : "");
    const dados = (pt.dados ?? {}) as any;
    const atv = (dados.atividades ?? {}) as any;
    const encarregado = (dados.encarregado_nome && String(dados.encarregado_nome).trim())
      || employeeName(pt.requisitante_id)
      || pt.employee_name
      || "";
    const localTexto = [pt.local, casco ? `CASCO ${casco.numero}${casco.nome ? ` — ${casco.nome}` : ""}` : null]
      .filter(Boolean).join(" · ");
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
      mao_obra: (dados.mao_obra ?? null) as any,
      fim_de_semana: isWeekend(pt.data_emissao || pt.data),
      area_restrita: typeof dados.area_restrita === "boolean" ? dados.area_restrita : null,
      atividades: {
        movimentacao_cargas: !!atv.movimentacao_cargas,
        manutencao_civil: !!atv.manutencao_civil,
        gases_inflamaveis: !!atv.gases_inflamaveis,
        altura_telhados: !!atv.altura_telhados,
        demolicao_escavacao: !!atv.demolicao_escavacao,
        eletricidade: !!atv.eletricidade,
        outros: !!atv.outros,
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
    setBlob(null);
    (async () => {
      try {
        const b = await gerarPtePdf(params);
        if (tokenRef.current !== token) return;
        setBlob(b);
        const buf = await b.arrayBuffer();
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
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${pt.numero || "PTE"}.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handlePrint = async () => {
    if (!blob) return;
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
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">PDF homologado preenchido com dados da PT</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setPadOpen(true)} size="sm" variant="outline">
                <PenLine className="h-4 w-4 mr-1" /> {assinaturaTst ? "Refazer assinatura" : "Assinar (TST)"}
              </Button>
              <Button onClick={handleDownload} size="sm" variant="outline" disabled={loading || !blob}>
                <Download className="h-4 w-4 mr-1" /> Baixar PDF
              </Button>
              <Button onClick={handlePrint} size="sm" disabled={loading || !blob}>
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
