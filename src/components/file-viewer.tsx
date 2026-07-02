import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, Printer, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { printImagePages, printPdf, renderPdfToImagePagesProgressive } from "@/lib/pdf-print";

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
  const [pdfPages, setPdfPages] = useState<string[]>([]);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    setPdfPages([]);
    setPdfError(null);

    if (!payload || payload.mime !== "application/pdf") {
      setPdfLoading(false);
      return;
    }

    const loadPdf = async () => {
      setPdfLoading(true);
      try {
        const res = await fetch(payload.downloadUrl ?? payload.url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        if (cancelled) return;
        const pages = await renderPdfToImagePagesProgressive(
          buf,
          (page) => {
            if (!cancelled) setPdfPages((current) => [...current, page]);
          },
          2,
        );
        if (!cancelled) setPdfPages(pages);
      } catch (e: any) {
        if (!cancelled) {
          setPdfError(e?.message ?? "Falha ao renderizar PDF");
          toast.error("Não foi possível visualizar o PDF dentro do SIGMO");
        }
      } finally {
        if (!cancelled) setPdfLoading(false);
      }
    };

    loadPdf();
    return () => {
      cancelled = true;
    };
  }, [payload]);

  async function handlePrint() {
    if (!payload) return;
    if (isPdf) {
      try {
        if (pdfPages.length) {
          await printImagePages(pdfPages, payload.name);
          return;
        }
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
          className="pdf-dialog fixed left-[50%] top-[50%] z-[121] flex h-[90vh] w-[calc(100vw-2rem)] max-w-5xl flex-col gap-0 overflow-hidden border border-white/15 bg-white p-0 shadow-2xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 sm:rounded-2xl"
          style={{ position: "fixed", transform: "translate(-50%, -50%)" }}
        >
        <div className="flex h-14 shrink-0 flex-row items-center justify-between gap-3 border-b border-white/10 px-4 py-2">
          <DialogPrimitive.Title className="min-w-0 flex-1 truncate pr-2 text-sm font-semibold text-slate-100">{payload?.name}</DialogPrimitive.Title>
          <div className="flex shrink-0 items-center gap-2">
            <Button size="sm" variant="outline" onClick={handlePrint} className="h-8 border-white/15 bg-white/10 text-slate-100 hover:bg-white/15 hover:text-white">
              <Printer className="h-4 w-4 mr-1" /> Imprimir
            </Button>
            <Button size="sm" variant="outline" onClick={handleDownload} className="h-8 border-white/15 bg-white/10 text-slate-100 hover:bg-white/15 hover:text-white">
              <Download className="h-4 w-4 mr-1" /> Baixar
            </Button>
            <Button size="icon" variant="ghost" onClick={() => payload && window.open(payload.url, "_blank")} className="h-8 w-8 text-slate-200 hover:bg-white/10 hover:text-white" title="Abrir em nova aba">
              <ExternalLink className="h-4 w-4" />
            </Button>
            <DialogPrimitive.Close className="ml-1 rounded-sm p-1 text-slate-300 opacity-80 hover:bg-white/10 hover:text-white hover:opacity-100" title="Fechar">
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden bg-slate-100">
          {payload && (
            isImage ? (
              <div className="w-full h-full flex items-center justify-center p-4">
                <img src={payload.url} alt={payload.name} className="max-w-full max-h-full object-contain" />
              </div>
            ) : isPdf ? (
              <div className="h-full overflow-y-auto bg-zinc-200 px-3 py-4 sm:px-6">
                {pdfLoading && !pdfPages.length ? (
                  <div className="flex h-full items-center justify-center text-sm font-medium text-slate-600">
                    Renderizando PDF no SIGMO...
                  </div>
                ) : pdfError ? (
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm text-slate-600">
                    <span>Não foi possível renderizar este PDF no modal.</span>
                    <Button size="sm" variant="outline" onClick={() => window.open(payload.url, "_blank")}>Abrir em nova aba</Button>
                  </div>
                ) : (
                  <div className="mx-auto flex w-full max-w-[980px] flex-col items-center gap-4">
                    {pdfPages.map((page, index) => (
                      <img
                        key={`${payload.url}-${index}`}
                        src={page}
                        alt={`Página ${index + 1} de ${payload.name}`}
                        className="block h-auto w-full rounded-sm border border-zinc-300 bg-white shadow-lg"
                      />
                    ))}
                    {pdfLoading && pdfPages.length > 0 && (
                      <div className="rounded-full bg-slate-900/80 px-4 py-2 text-xs font-semibold text-white shadow-lg">
                        Carregando próximas páginas...
                      </div>
                    )}
                  </div>
                )}
              </div>
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