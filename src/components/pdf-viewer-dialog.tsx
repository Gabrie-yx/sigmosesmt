import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Printer, X, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type PdfJsModule = typeof import("pdfjs-dist");
let pdfjsPromise: Promise<PdfJsModule> | null = null;
async function loadPdfJs(): Promise<PdfJsModule> {
  if (typeof window === "undefined") throw new Error("pdfjs only available in browser");
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const lib = await import("pdfjs-dist");
      // @ts-ignore
      const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
      lib.GlobalWorkerOptions.workerSrc = workerUrl;
      return lib;
    })();
  }
  return pdfjsPromise;
}

export function PDFViewerDialog({ 
  open, 
  onClose, 
  pdfPath, 
  fileName 
}: {
  open: boolean;
  onClose: () => void;
  pdfPath: string | null;
  fileName: string;
}) {
  const [blobUrl, setBlobUrl] = useState<string>("");
  const [pages, setPages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    if (!pdfPath || !open) { 
      setBlobUrl("");
      setPages([]);
      setErrorMsg("");
      return; 
    }

    let createdBlobUrl: string | null = null;
    let cancelled = false;
    const loadUrl = async () => {
      setLoading(true);
      setErrorMsg("");
      setPages([]);
      try {
        const { data, error } = await supabase.storage
          .from("sesmt-docs")
          .createSignedUrl(pdfPath, 3600);
        if (error) throw error;
        if (cancelled) return;

        const resp = await fetch(data.signedUrl);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const arrayBuffer = await resp.arrayBuffer();
        if (cancelled) return;
        const pdfBlob = new Blob([arrayBuffer], { type: "application/pdf" });
        createdBlobUrl = URL.createObjectURL(pdfBlob);
        setBlobUrl(createdBlobUrl);

        const pdfjsLib = await loadPdfJs();
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
        const renderedPages: string[] = [];
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
          if (cancelled) return;
          const page = await pdf.getPage(pageNumber);
          const viewport = page.getViewport({ scale: 2 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Canvas indisponível");
          await page.render({ canvasContext: context, viewport, canvas }).promise;
          renderedPages.push(canvas.toDataURL("image/png"));
        }
        if (!cancelled) setPages(renderedPages);
      } catch (err: any) {
        console.error("Erro ao carregar PDF:", err);
        setErrorMsg("Não foi possível carregar o documento.");
        toast.error("Não foi possível carregar o documento.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadUrl();
    return () => {
      cancelled = true;
      if (createdBlobUrl) URL.revokeObjectURL(createdBlobUrl);
    };
  }, [pdfPath, open]);

  function download() {
    if (!blobUrl) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName;
    a.click();
  }

  function print() {
    if (!pages.length) return;
    const w = window.open("", "_blank");
    if (!w) return;
    const imgs = pages.map((page) => `<img src="${page}" />`).join("");
    w.document.write(`<!DOCTYPE html><html><head><title>${fileName}</title><style>
      @page { size: A4; margin: 0; }
      * { margin: 0; padding: 0; }
      img { display: block; width: 100%; page-break-after: always; }
      img:last-child { page-break-after: auto; }
    </style></head><body>${imgs}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { try { w.print(); } catch { /* noop */ } }, 400);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="pdf-dialog max-w-6xl w-[95vw] h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Visualizar Documento — {fileName}
          </DialogTitle>
          <DialogDescription>
            Documento renderizado dentro do SIGMO, sem depender do visualizador nativo do navegador.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 min-h-0 bg-slate-200 overflow-y-auto relative">
          {loading ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground animate-pulse">Carregando documento...</div>
          ) : pages.length ? (
            <div className="flex flex-col items-center gap-4 p-4">
              {pages.map((page, index) => (
                <img
                  key={index}
                  src={page}
                  alt={`Página ${index + 1} de ${fileName}`}
                  className="w-full max-w-[920px] bg-white shadow-md border border-slate-300"
                />
              ))}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              {errorMsg || "Documento não disponível."}
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-slate-50">
          <Button variant="ghost" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Fechar
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={print} disabled={!pages.length}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
            <Button onClick={download} disabled={!blobUrl}>
              <Download className="h-4 w-4 mr-2" />
              Baixar PDF
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
