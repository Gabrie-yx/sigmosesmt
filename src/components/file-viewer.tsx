import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Download, Printer, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { printPdf } from "@/lib/pdf-print";

type ViewerPayload = { url: string; name: string; mime?: string; downloadUrl?: string; objectUrl?: string };
const listeners = new Set<(p: ViewerPayload | null) => void>();

export function openFileViewer(p: ViewerPayload) {
  listeners.forEach((l) => l(p));
}

export async function openStorageFile(bucket: string, path: string, name?: string) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 600);
  if (error || !data) {
    toast.error(error?.message ?? "Não foi possível abrir o arquivo");
    return;
  }
  const fname = name ?? path.split("/").pop() ?? "arquivo";
  const ext = fname.split(".").pop()?.toLowerCase();
  const mime =
    ext === "pdf" ? "application/pdf" :
    ext === "png" ? "image/png" :
    ext === "jpg" || ext === "jpeg" ? "image/jpeg" :
    ext === "webp" ? "image/webp" : undefined;
  // Abrir direto via signed URL — evita blob:// (bloqueado pelo Chrome em <object>/<iframe> para PDF)
  // e elimina o download pesado inicial que travava a abertura do modal.
  openFileViewer({ url: data.signedUrl, name: fname, mime, downloadUrl: data.signedUrl });
}

export function FileViewerHost() {
  const [payload, setPayload] = useState<ViewerPayload | null>(null);

  useEffect(() => {
    listeners.add(setPayload);
    return () => { listeners.delete(setPayload); };
  }, []);

  useEffect(() => {
    return () => {
      if (payload?.objectUrl) URL.revokeObjectURL(payload.objectUrl);
    };
  }, [payload]);

  const isImage = payload?.mime?.startsWith("image/");
  const isPdf = payload?.mime === "application/pdf";

  async function handlePrint() {
    if (!payload) return;
    if (isPdf) {
      try {
        const res = await fetch(payload.downloadUrl ?? payload.url);
        const blob = await res.blob();
        await printPdf(blob, payload.name);
        return;
      } catch (e: any) {
        toast.error(e.message ?? "Falha ao imprimir PDF");
        return;
      }
    }
    const w = window.open(payload.url, "_blank");
    if (!w) { toast.error("Permita pop-ups para imprimir"); return; }
    w.addEventListener("load", () => { try { w.focus(); w.print(); } catch {} });
  }

  async function handleDownload() {
    if (!payload) return;
    try {
      const res = await fetch(payload.downloadUrl ?? payload.url);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = payload.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch (e: any) {
      toast.error(e.message ?? "Falha no download");
    }
  }

  return (
    <DialogPrimitive.Root open={!!payload} onOpenChange={(o) => { if (!o) setPayload(null); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="modal-glass-scope glass-card dialog-glass-shine fixed left-[50%] top-[50%] z-[121] grid w-[calc(100vw-2rem)] max-w-5xl h-[90vh] gap-0 overflow-hidden p-0 duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 sm:rounded-2xl flex flex-col"
          style={{ position: "fixed", transform: "translate(-50%, -50%)" }}
        >
        <div className="px-4 py-3 border-b flex flex-row items-center justify-between space-y-0">
          <DialogPrimitive.Title className="text-sm font-semibold truncate pr-4">{payload?.name}</DialogPrimitive.Title>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1" /> Imprimir
            </Button>
            <Button size="sm" variant="outline" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-1" /> Baixar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => payload && window.open(payload.url, "_blank")}>
              <ExternalLink className="h-4 w-4" />
            </Button>
            <DialogPrimitive.Close className="rounded-sm opacity-70 hover:opacity-100 ml-1">
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>
        </div>
        <div className="flex-1 bg-slate-100 overflow-auto">
          {payload && (
            isImage ? (
              <div className="w-full h-full flex items-center justify-center p-4">
                <img src={payload.url} alt={payload.name} className="max-w-full max-h-full object-contain" />
              </div>
            ) : isPdf ? (
              <object data={payload.url} type="application/pdf" className="w-full h-full">
                <iframe src={payload.url} title={payload.name} className="w-full h-full border-0" />
              </object>
            ) : (
              <iframe src={payload.url} title={payload.name} className="w-full h-full border-0" />
            )
          )}
        </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}