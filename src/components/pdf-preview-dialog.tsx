import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Printer, X } from "lucide-react";
import type jsPDF from "jspdf";

export function PDFPreviewDialog({ open, onClose, doc, fileName }: {
  open: boolean;
  onClose: () => void;
  doc: jsPDF | null;
  fileName: string;
}) {
  const [url, setUrl] = useState<string>("");

  useEffect(() => {
    if (!doc || !open) { setUrl(""); return; }
    const blob = doc.output("blob");
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [doc, open]);

  function download() {
    if (doc) doc.save(fileName);
  }
  function print() {
    if (!url) return;
    const w = window.open(url, "_blank");
    if (w) {
      w.addEventListener("load", () => { try { w.focus(); w.print(); } catch {} });
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Visualizar formulário semanal — {fileName}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 min-h-0 border rounded overflow-hidden bg-slate-100">
          {url ? (
            <iframe src={url} title="Pré-visualização do PDF" className="w-full h-full" />
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Carregando...</div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}><X className="h-4 w-4 mr-1" />Fechar</Button>
          <Button variant="outline" onClick={print}><Printer className="h-4 w-4 mr-1" />Imprimir</Button>
          <Button onClick={download}><Download className="h-4 w-4 mr-1" />Baixar PDF</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}