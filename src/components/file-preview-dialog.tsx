import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Printer, Loader2 } from "lucide-react";

/**
 * Visualizador interno de arquivos (PDF ou imagem) já armazenados.
 * Nunca abre nova aba: baixa o blob e renderiza dentro do sistema.
 */
export function FilePreviewDialog({
  open,
  onClose,
  url,
  fileName,
  title,
}: {
  open: boolean;
  onClose: () => void;
  url: string | null;
  fileName: string;
  title?: string;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [mime, setMime] = useState<string>("application/pdf");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    let revoke: string | null = null;
    let cancelado = false;

    if (open && url) {
      setCarregando(true);
      setErro(null);
      fetch(url)
        .then(async (r) => {
          if (!r.ok) throw new Error(`Não foi possível carregar o arquivo (HTTP ${r.status}).`);
          const blob = await r.blob();
          if (cancelado) return;
          const objUrl = URL.createObjectURL(blob);
          revoke = objUrl;
          setMime(blob.type || (fileName.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/*"));
          setBlobUrl(objUrl);
        })
        .catch((e: any) => {
          if (!cancelado) setErro(e?.message ?? "Falha ao carregar o arquivo.");
        })
        .finally(() => {
          if (!cancelado) setCarregando(false);
        });
    }

    return () => {
      cancelado = true;
      setBlobUrl(null);
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [open, url, fileName]);

  const baixar = () => {
    if (!blobUrl) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const imprimir = () => {
    const iframe = document.getElementById("file-preview-frame") as HTMLIFrameElement | null;
    try {
      iframe?.contentWindow?.focus();
      iframe?.contentWindow?.print();
    } catch {
      /* silencioso */
    }
  };

  const isImagem = mime.startsWith("image/");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {title ?? "Visualizar documento"} — {fileName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 rounded-lg border border-border bg-muted/30 overflow-auto flex items-center justify-center">
          {carregando && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando documento…
            </div>
          )}
          {!carregando && erro && (
            <div className="p-6 text-center text-sm text-destructive">{erro}</div>
          )}
          {!carregando && !erro && blobUrl && (
            isImagem ? (
              <img src={blobUrl} alt={fileName} className="max-w-full max-h-full object-contain" />
            ) : (
              <iframe id="file-preview-frame" src={blobUrl} title={fileName} className="w-full h-full" />
            )
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          {!isImagem && (
            <Button variant="outline" onClick={imprimir} disabled={!blobUrl}>
              <Printer className="h-4 w-4 mr-1" /> Imprimir
            </Button>
          )}
          <Button onClick={baixar} disabled={!blobUrl}>
            <Download className="h-4 w-4 mr-1" /> Baixar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}