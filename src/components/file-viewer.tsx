import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Printer, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  try {
    const response = await fetch(data.signedUrl);
    if (!response.ok) throw new Error("Não foi possível carregar o arquivo");
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const url = ext === "pdf" ? `${objectUrl}#toolbar=1&navpanes=0&view=FitH` : objectUrl;
    openFileViewer({ url, name: fname, mime: blob.type || mime, downloadUrl: objectUrl, objectUrl });
  } catch (e: any) {
    toast.error(e.message ?? "Não foi possível visualizar o arquivo");
    const url = ext === "pdf" ? `${data.signedUrl}#toolbar=1&navpanes=0&view=FitH` : data.signedUrl;
    openFileViewer({ url, name: fname, mime, downloadUrl: data.signedUrl });
  }
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

  function handlePrint() {
    if (!payload) return;
    if (isPdf) {
      const frame = document.getElementById("file-viewer-iframe") as HTMLIFrameElement | null;
      if (frame?.contentWindow) {
        try { frame.contentWindow.focus(); frame.contentWindow.print(); return; } catch {}
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
    <Dialog open={!!payload} onOpenChange={(o) => { if (!o) setPayload(null); }}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] p-0 flex flex-col gap-0">
        <DialogHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0">
          <DialogTitle className="text-sm truncate pr-4">{payload?.name}</DialogTitle>
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
          </div>
        </DialogHeader>
        <div className="flex-1 bg-slate-100 overflow-auto">
          {payload && (
            isImage ? (
              <div className="w-full h-full flex items-center justify-center p-4">
                <img src={payload.url} alt={payload.name} className="max-w-full max-h-full object-contain" />
              </div>
            ) : (
              <iframe id="file-viewer-iframe" src={payload.url} title={payload.name} className="w-full h-full border-0" />
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}