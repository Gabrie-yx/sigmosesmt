import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Printer, X, PenLine, ImagePlus } from "lucide-react";
import type jsPDF from "jspdf";

export function PDFPreviewDialog({ open, onClose, doc, fileName, title, signable, encSig, sesmtSig, onChangeEncSig, onChangeSesmtSig }: {
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
}) {
  const [url, setUrl] = useState<string>("");
  const iframeRef = useRef<HTMLIFrameElement>(null);

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
    try {
      iframeRef.current?.contentWindow?.focus();
      iframeRef.current?.contentWindow?.print();
    } catch {
      window.open(url, "_blank");
    }
  }

  async function pickSignature(set: (v: string | null) => void) {
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
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title ?? "Visualizar PDF"} — {fileName}</DialogTitle>
        </DialogHeader>
        {signable && (
          <div className="flex flex-wrap items-center gap-2 border rounded p-2 bg-slate-50 text-xs">
            <span className="font-bold uppercase text-slate-600">Assinaturas:</span>
            {([
              { label: "Encarregado", val: encSig ?? null, set: onChangeEncSig },
              { label: "SESMT", val: sesmtSig ?? null, set: onChangeSesmtSig },
            ] as const).map((s) => (
              <div key={s.label} className="flex items-center gap-1.5">
                <span className="text-slate-500">{s.label}:</span>
                {s.val ? (
                  <>
                    <img src={s.val} alt={s.label} className="h-7 border bg-white object-contain px-1 rounded" />
                    <Button type="button" variant="ghost" size="sm" onClick={() => s.set?.(null)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </>
                ) : (
                  <Button type="button" variant="outline" size="sm" onClick={() => s.set && pickSignature(s.set)}>
                    <PenLine className="h-3.5 w-3.5 mr-1" />Assinar
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="flex-1 min-h-0 border rounded overflow-hidden bg-slate-100">
          {url ? (
            <iframe ref={iframeRef} src={url} title="Pré-visualização do PDF" className="w-full h-full" />
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