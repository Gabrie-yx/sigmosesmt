import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

export type AssinaturaResult = { dataUrl: string; height: number };

export function SignaturePadDialog({
  open,
  onClose,
  onConfirm,
  title = "Assinatura do responsável",
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (r: AssinaturaResult) => void;
  title?: string;
}) {
  const [signature, setSignature] = useState<string | null>(null);
  const [height, setHeight] = useState(80);

  useEffect(() => { if (open) { setSignature(null); setHeight(80); } }, [open]);

  const onUpload = (file: File | null) => {
    if (!file) return;
    if (file.type !== "image/png") { toast.error("A assinatura deve estar no formato PNG"); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("Arquivo muito grande (máx. 2MB)"); return; }
    const reader = new FileReader();
    reader.onload = () => setSignature(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="border-2 border-black bg-white text-black">
          <div className="font-bold text-center uppercase border-b border-black p-1.5 text-[12px]">
            Assinatura do Técnico em Segurança do Trabalho
          </div>
          <div className="min-h-32 flex items-center justify-center p-3">
            {signature ? (
              <div className="flex flex-col items-center gap-1 w-full">
                <img src={signature} alt="Assinatura" style={{ height: `${height}px` }} className="object-contain max-w-full" />
                <div className="flex items-center gap-2 w-full px-2 pt-2">
                  <span className="text-[10px] text-muted-foreground">Tamanho</span>
                  <input
                    type="range" min={20} max={140} step={2}
                    value={height}
                    onChange={(e) => setHeight(Number(e.target.value))}
                    className="flex-1 accent-red-700"
                  />
                  <button type="button" onClick={() => setSignature(null)} className="text-[10px] text-red-700 hover:underline">
                    Remover
                  </button>
                </div>
              </div>
            ) : (
              <label className="cursor-pointer text-[12px] text-red-700 hover:underline px-3 py-2 border border-dashed border-red-700/50 rounded">
                Enviar assinatura (PNG)
                <input type="file" accept="image/png" className="hidden" onChange={(e) => onUpload(e.target.files?.[0] ?? null)} />
              </label>
            )}
          </div>
        </div>
        <div className="rounded-md bg-amber-50 border border-amber-200 p-2 text-[11px] text-amber-900 leading-snug">
          <strong>Dica:</strong> envie um <strong>PNG com fundo transparente</strong> contendo
          <strong> apenas o desenho da sua assinatura</strong> (sem moldura, sem prints da tela).
          O sistema centraliza e posiciona logo acima da linha “Técnico em Segurança do Trabalho”.
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}><X className="h-4 w-4 mr-1" />Cancelar</Button>
          <Button
            onClick={() => signature && onConfirm({ dataUrl: signature, height })}
            disabled={!signature}
          >
            <Check className="h-4 w-4 mr-1" />Inserir no PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
