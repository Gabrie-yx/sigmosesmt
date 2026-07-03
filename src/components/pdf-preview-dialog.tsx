import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Printer, X, PenLine, ImagePlus } from "lucide-react";
import type jsPDF from "jspdf";
import { printPdf, renderPdfToImagePagesProgressive } from "@/lib/pdf-print";
import { SignaturePadDialog } from "@/components/signature-pad-dialog";

export function PDFPreviewDialog({ open, onClose, doc, fileName, title, signable, encSig, sesmtSig, onChangeEncSig, onChangeSesmtSig, onRequestSign, hasSignature, signatureLabels, useSignatureGallery }: {
  open: boolean;
  onClose: () => void;
  doc: jsPDF | null;
  fileName: string;
  title?: string;
  signable?: boolean;
  encSig?: string | null;
  sesmtSig?: string | null;
  onChangeEncSig?: (v: string | null) => void;
  onChangeSesmtSig?: (v: string | null) => void;
  onRequestSign?: () => void;
  hasSignature?: boolean;
  /** Sobrescreve as labels dos dois slots de assinatura. */
  signatureLabels?: { enc?: string; sesmt?: string };
  /** Quando true, ao clicar em "Assinar" abre o SignaturePadDialog (galeria/desenhar/importar). */
  useSignatureGallery?: boolean;
}) {
  // Renderizamos as páginas com PDF.js em <canvas> — o visualizador nativo de
  // PDF do Chrome é desativado dentro de iframes com sandbox (preview do
  // Lovable), então tanto blob: quanto data: URIs aparecem quebrados.
  const [pages, setPages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const renderTokenRef = useRef(0);
  const [galleryTarget, setGalleryTarget] = useState<null | ((v: string | null) => void)>(null);

  useEffect(() => {
    if (!doc || !open) { setPages([]); setLoadError(null); return; }
    const token = ++renderTokenRef.current;
    setLoading(true);
    setLoadError(null);
    setPages([]);
    (async () => {
      try {
        // Renderiza página a página em JPEG (scale 2) — a 1ª página aparece
        // rápido em vez de esperar todas em PNG scale 3.
        await renderPdfToImagePagesProgressive(
          doc.output("arraybuffer") as ArrayBuffer,
          (pageDataUrl) => {
            if (renderTokenRef.current !== token) return;
            setPages((prev) => [...prev, pageDataUrl]);
          },
          2,
        );
      } catch (e: any) {
        console.error("[PDFPreview] render error", e);
        if (renderTokenRef.current === token) setLoadError(e?.message ?? "Falha ao renderizar PDF");
      } finally {
        if (renderTokenRef.current === token) setLoading(false);
      }
    })();
    return () => { renderTokenRef.current++; };
  }, [doc, open]);

  function download() {
    if (!doc) return;
    try {
      const blob = doc.output("blob") as Blob;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      doc.save(fileName);
    }
  }
  async function print() {
    if (!doc) return;
    // Impressão nativa do PDF (vetor) — preserva o texto preto sólido.
    // Fallback automático para raster está dentro de printPdf().
    const blob = doc.output("blob") as Blob;
    await printPdf(blob, fileName);
  }

  async function pickSignature(set: (v: string | null) => void) {
    if (useSignatureGallery) {
      setGalleryTarget(() => set);
      return;
    }
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "image/png,image/jpeg";
    inp.onchange = async () => {
      const f = inp.files?.[0]; if (!f) return;
      if (f.size > 5 * 1024 * 1024) return;
      try {
        const bm = await createImageBitmap(f, { imageOrientation: "from-image" } as any);
        const scale = Math.min(1, 800 / bm.width);
        const w = Math.round(bm.width * scale), h = Math.round(bm.height * scale);
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        c.getContext("2d")!.drawImage(bm, 0, 0, w, h);
        set(c.toDataURL("image/png"));
      } catch {
        const r = new FileReader();
        r.onload = () => set(String(r.result || ""));
        r.readAsDataURL(f);
      }
    };
    inp.click();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="pdf-dialog light-paper max-w-6xl w-[95vw] h-[90vh] flex flex-col bg-white text-slate-900 border-slate-200 shadow-2xl">
        <DialogHeader>
          <DialogTitle>{title ?? "Visualizar PDF"} — {fileName}</DialogTitle>
        </DialogHeader>
        {signable && (
          <div className="flex flex-wrap items-center gap-2 rounded p-2 text-xs border border-rose-900/40 bg-gradient-to-r from-[#1a0510] via-[#2a0814] to-[#1a0510] text-rose-100">
            <span className="font-bold uppercase tracking-wide text-rose-300/80">Assinaturas:</span>
            {([
              { label: signatureLabels?.enc ?? "Encarregado", val: encSig ?? null, set: onChangeEncSig },
              { label: signatureLabels?.sesmt ?? "SESMT", val: sesmtSig ?? null, set: onChangeSesmtSig },
            ] as const).map((s) => (
              <div key={s.label} className="flex items-center gap-1.5">
                <span className="text-rose-200/80">{s.label}:</span>
                {s.val ? (
                  <>
                    <img src={s.val} alt={s.label} className="h-7 border border-rose-900/40 bg-white object-contain px-1 rounded" />
                    <Button type="button" variant="ghost" size="sm" className="text-rose-200 hover:text-rose-50 hover:bg-rose-900/40" onClick={() => s.set?.(null)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </>
                ) : (
                  <Button type="button" variant="outline" size="sm" className="border-rose-500/50 bg-rose-950/40 text-rose-100 hover:bg-rose-900/60 hover:text-rose-50" onClick={() => s.set && pickSignature(s.set)}>
                    <PenLine className="h-3.5 w-3.5 mr-1" />Assinar
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="flex-1 min-h-0 border rounded overflow-y-auto bg-slate-200">
          {loadError ? (
            <div className="h-full flex items-center justify-center text-sm text-destructive px-6 text-center">
              Não foi possível exibir a pré-visualização ({loadError}). Use "Baixar PDF" para abrir o arquivo.
            </div>
          ) : pages.length > 0 ? (
            <div className="flex flex-col items-center gap-4 p-4">
              {pages.map((p, i) => (
                <img
                  key={i}
                  src={p}
                  alt={`Página ${i + 1}`}
                  className="w-full max-w-[860px] bg-white shadow-md border border-slate-300"
                />
              ))}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              {loading ? "Gerando pré-visualização..." : "Carregando..."}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}><X className="h-4 w-4 mr-1" />Fechar</Button>
          {onRequestSign && (
            <Button variant="outline" onClick={onRequestSign} className="border-rose-300 text-rose-700 hover:bg-rose-50">
              <PenLine className="h-4 w-4 mr-1" />{hasSignature ? "Refazer assinatura" : "Assinar agora"}
            </Button>
          )}
          <Button variant="outline" onClick={print}><Printer className="h-4 w-4 mr-1" />Imprimir</Button>
          <Button onClick={download}><Download className="h-4 w-4 mr-1" />Baixar PDF</Button>
        </DialogFooter>
        <SignaturePadDialog
          open={!!galleryTarget}
          onClose={() => setGalleryTarget(null)}
          onConfirm={(r) => {
            const set = galleryTarget;
            setGalleryTarget(null);
            if (set) set(r.dataUrl);
          }}
          title="Inserir assinatura no PDF"
        />
      </DialogContent>
    </Dialog>
  );
}