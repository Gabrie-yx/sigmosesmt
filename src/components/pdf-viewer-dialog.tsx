import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Printer, X, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!pdfPath || !open) { 
      setBlobUrl("");
      setErrorMsg("");
      return; 
    }

    let createdBlobUrl: string | null = null;
    let cancelled = false;
    const loadUrl = async () => {
      setLoading(true);
      setErrorMsg("");
      try {
        const { data, error } = await supabase.storage
          .from("sesmt-docs")
          .createSignedUrl(pdfPath, 3600);
        if (error) throw error;
        if (cancelled) return;
        // Baixamos como blob e exibimos via blob: URL — necessário porque
        // Chrome bloqueia PDFs cross-origin dentro de iframes aninhados
        // (preview do Lovable). Mesmo origem == sem bloqueio.
        const resp = await fetch(data.signedUrl);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        if (cancelled) return;
        const pdfBlob = blob.type === "application/pdf"
          ? blob
          : new Blob([blob], { type: "application/pdf" });
        createdBlobUrl = URL.createObjectURL(pdfBlob);
        setBlobUrl(createdBlobUrl);
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
    if (!blobUrl) return;
    try {
      iframeRef.current?.contentWindow?.focus();
      iframeRef.current?.contentWindow?.print();
    } catch {/* silent */}
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="pdf-dialog max-w-6xl w-[95vw] h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Visualizar Documento — {fileName}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 min-h-0 bg-slate-100 flex items-center justify-center relative">
          {loading ? (
            <div className="text-sm text-muted-foreground animate-pulse">Carregando documento...</div>
          ) : blobUrl ? (
            <iframe
              ref={iframeRef}
              src={blobUrl}
              title="Pré-visualização do PDF"
              className="w-full h-full border-0"
            />
          ) : (
            <div className="text-sm text-muted-foreground">
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
            <Button variant="outline" onClick={print} disabled={!blobUrl}>
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
