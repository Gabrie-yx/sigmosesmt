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
  const [url, setUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!pdfPath || !open) { 
      setUrl(""); 
      return; 
    }

    const loadUrl = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.storage
          .from("sesmt-docs")
          .createSignedUrl(pdfPath, 3600);
        
        if (error) throw error;
        setUrl(data.signedUrl);
      } catch (err: any) {
        console.error("Erro ao carregar PDF:", err);
        toast.error("Não foi possível carregar o documento.");
      } finally {
        setLoading(false);
      }
    };

    loadUrl();
  }, [pdfPath, open]);

  function download() {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.target = "_blank";
    a.click();
  }

  function print() {
    if (!url) return;
    try {
      iframeRef.current?.contentWindow?.focus();
      iframeRef.current?.contentWindow?.print();
    } catch {
      window.open(url, "_blank");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Visualizar Documento — {fileName}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 min-h-0 bg-slate-100 flex items-center justify-center relative">
          {loading ? (
            <div className="text-sm text-muted-foreground animate-pulse">Carregando documento...</div>
          ) : url ? (
            <iframe 
              ref={iframeRef} 
              src={url} 
              title="Pré-visualização do PDF" 
              className="w-full h-full border-0" 
            />
          ) : (
            <div className="text-sm text-muted-foreground">Documento não disponível.</div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-slate-50">
          <Button variant="ghost" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Fechar
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={print} disabled={!url}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
            <Button onClick={download} disabled={!url}>
              <Download className="h-4 w-4 mr-2" />
              Baixar PDF
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
