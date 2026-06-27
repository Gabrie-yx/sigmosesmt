import { useEffect, useRef, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Save, Trash2, MousePointerClick, X, Library, Pencil, Move, PenTool, Download, Printer } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PDFDocument } from "pdf-lib";
import { degrees } from "pdf-lib";
import { SignaturePadDialog, type AssinaturaResult } from "@/components/signature-pad-dialog";
import { SignatureGallery } from "@/components/signature-gallery";
import { ScrollArea } from "@/components/ui/scroll-area";
import { printPdf } from "@/lib/pdf-print";

// pdfjs-dist usa DOMMatrix / Path2D — só pode carregar no browser.
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

type Placement = {
  id: string;
  page: number;
  // Coordenadas em VIEWPORT do pdfjs (origem top-left, scale=1, em pontos PDF).
  // Ou seja: como o pdfjs RENDERIZA a página (já considerando /Rotate).
  // A transformação para o sistema da MediaBox (pdf-lib) é feita só na hora de salvar.
  x: number;
  y: number;
  width: number;
  height: number;
  // Rotação (graus CW) da página no momento do posicionamento (0/90/180/270).
  rotation: number;
  dataUrl: string;
  nome: string;
  cargo: string;
};

type SavedSig = {
  id: string;
  nome: string;
  cargo: string | null;
  imagem_data_url: string;
};

async function fetchBytes(src: PdfSignerInput): Promise<Uint8Array> {
  if (src instanceof Uint8Array) return src;
  if (src instanceof Blob) return new Uint8Array(await src.arrayBuffer());
  if (src instanceof ArrayBuffer) return new Uint8Array(src);
  
  // If it's a string, check if it's a URL or a storage path
  let url = src;
  if (!src.startsWith("http") && !src.startsWith("data:")) {
    const { data, error } = await supabase.storage.from("sesmt-docs").createSignedUrl(src, 3600);
    if (error) throw error;
    url = data.signedUrl;
  }
  
  const res = await fetch(url);
  return new Uint8Array(await res.arrayBuffer());
}

async function fetchImageBytes(src: string): Promise<Uint8Array> {
  const value = String(src ?? "").trim();
  if (!value) throw new Error("Assinatura sem imagem válida.");

  if (value.startsWith("data:") || value.startsWith("blob:") || /^https?:\/\//i.test(value)) {
    const res = await fetch(value);
    if (!res.ok) throw new Error("Não foi possível ler a imagem da assinatura.");
    return new Uint8Array(await res.arrayBuffer());
  }

  const rawBase64 = value.includes(",") ? value.split(",").pop() ?? "" : value;
  const normalized = rawBase64.replace(/\s/g, "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  try {
    return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  } catch {
    throw new Error("Uma das assinaturas está com imagem inválida. Reimporte/desenhe a assinatura e tente salvar novamente.");
  }
}

async function rasterizeImageToPngBytes(src: string): Promise<Uint8Array> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível converter a assinatura para PNG."));
    image.src = src;
  });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, img.naturalWidth || img.width);
  canvas.height = Math.max(1, img.naturalHeight || img.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível preparar a assinatura para o PDF.");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Não foi possível gerar PNG da assinatura."))), "image/png"),
  );
  return new Uint8Array(await blob.arrayBuffer());
}

export type PdfSignerInput = Uint8Array | Blob | ArrayBuffer | string;

export function PdfSignerDialog({
  open,
  onClose,
  source,
  nomeArquivo,
  modulo = "avulso",
  referenciaId,
  onSigned,
  documentId,
}: {
  open: boolean;
  onClose: () => void;
  source: PdfSignerInput | null;
  nomeArquivo: string;
  modulo?: string;
  referenciaId?: string;
  onSigned?: (info: { path: string; signedBytes: Uint8Array }) => void;
  documentId?: string;
}) {
  const qc = useQueryClient();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const pdfDocRef = useRef<any>(null);
  const bytesRef = useRef<Uint8Array | null>(null);

  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [pageSize, setPageSize] = useState({ w: 0, h: 0 }); // PDF points
  const [pageRotation, setPageRotation] = useState(0); // graus CW (0/90/180/270)
  const [renderScale, setRenderScale] = useState(1.0); // canvas px / pt
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [picking, setPicking] = useState(false);
  const [pendingSig, setPendingSig] = useState<{ dataUrl: string; nome: string; cargo: string } | null>(null);
  const [openPad, setOpenPad] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeDocumentId, setActiveDocumentId] = useState<string | undefined>(documentId);

  const { data: userSigs = [] } = useQuery({
    queryKey: ["user-signatures"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_signatures")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: open,
  });

  const { data: savedSigs = [] } = useQuery({
    queryKey: ["assinaturas-salvas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assinaturas_salvas")
        .select("id,nome,cargo,imagem_data_url")
        .order("nome");
      if (error) throw error;
      return data as SavedSig[];
    },
    enabled: open,
  });

  // Load PDF and existing placements when source/documentId changes
  useEffect(() => {
    if (!open || !source) return;
    let cancelled = false;
    setLoadError(null);
    setPlacements([]);
    setPageNum(1);

    const loadData = async () => {
      try {
        setActiveDocumentId(documentId);
        const bytes = await fetchBytes(source);
        if (cancelled) return;
        bytesRef.current = bytes;
        const pdfjsLib = await loadPdfJs();
        const loadingTask = pdfjsLib.getDocument({ data: bytes.slice(0) });
        const pdf = await loadingTask.promise;
        if (cancelled) return;
        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);
      } catch (e: any) {
        console.error("[PdfSigner] load error", e);
        setLoadError(e?.message ?? "Falha ao carregar PDF");
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [open, source, documentId]);

  // Render current page
  const renderPage = useCallback(async () => {
    const pdf = pdfDocRef.current;
    const canvas = canvasRef.current;
    if (!pdf || !canvas) return;
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: renderScale });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    const ptVp = page.getViewport({ scale: 1 });
    setPageSize({ w: ptVp.width, h: ptVp.height });
    setPageRotation(((page.rotate ?? 0) % 360 + 360) % 360);
  }, [pageNum, renderScale]);

  useEffect(() => {
    if (open && pdfDocRef.current) renderPage();
  }, [open, renderPage, numPages]);

  function handleCanvasClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!pendingSig) {
      toast.info("Escolha uma assinatura primeiro (lateral direita).");
      return;
    }
    const rect = overlayRef.current!.getBoundingClientRect();
    const xCssPx = e.clientX - rect.left;
    const yCssPx = e.clientY - rect.top;
    // Convert CSS px -> PDF points. canvas is sized at renderScale * pt, but is displayed via CSS at rect width.
    const ptsPerCssX = pageSize.w / rect.width;
    const ptsPerCssY = pageSize.h / rect.height;
    // sig default height in pt
    const sigHeightPt = 36;
    // compute width by image aspect ratio
    const img = new Image();
    img.onload = () => {
      const aspect = img.naturalWidth / img.naturalHeight;
      const widthPt = sigHeightPt * aspect;
      // Centro da assinatura no ponto do clique — em coords do VIEWPORT (top-left).
      const xPt = xCssPx * ptsPerCssX - widthPt / 2;
      const yPt = yCssPx * ptsPerCssY - sigHeightPt / 2;
      const xClamped = Math.max(0, Math.min(pageSize.w - widthPt, xPt));
      const yClamped = Math.max(0, Math.min(pageSize.h - sigHeightPt, yPt));
      setPlacements((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          page: pageNum,
          x: xClamped,
          y: yClamped,
          width: widthPt,
          height: sigHeightPt,
          rotation: pageRotation,
          dataUrl: pendingSig.dataUrl,
          nome: pendingSig.nome,
          cargo: pendingSig.cargo,
        },
      ]);
      toast.success(`Assinatura de ${pendingSig.nome} posicionada na página ${pageNum}`);
    };
    img.src = pendingSig.dataUrl;
  }

  // Drag-move / resize handlers
  function startMove(e: React.PointerEvent, id: string) {
    e.stopPropagation();
    e.preventDefault();
    const rect = overlayRef.current!.getBoundingClientRect();
    const ptsPerCssX = pageSize.w / rect.width;
    const ptsPerCssY = pageSize.h / rect.height;
    const startX = e.clientX;
    const startY = e.clientY;
    const initial = placements.find((p) => p.id === id);
    if (!initial) return;
    const initX = initial.x;
    const initY = initial.y;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const onMove = (ev: PointerEvent) => {
      const dxPt = (ev.clientX - startX) * ptsPerCssX;
      const dyPt = (ev.clientY - startY) * ptsPerCssY;
      setPlacements((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                x: Math.max(0, Math.min(pageSize.w - p.width, initX + dxPt)),
                y: Math.max(0, Math.min(pageSize.h - p.height, initY + dyPt)),
              }
            : p,
        ),
      );
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function startResize(e: React.PointerEvent, id: string) {
    e.stopPropagation();
    e.preventDefault();
    const rect = overlayRef.current!.getBoundingClientRect();
    const ptsPerCssX = pageSize.w / rect.width;
    const ptsPerCssY = pageSize.h / rect.height;
    const startX = e.clientX;
    const startY = e.clientY;
    const initial = placements.find((p) => p.id === id);
    if (!initial) return;
    const initW = initial.width;
    const initH = initial.height;
    const aspect = initW / initH;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const onMove = (ev: PointerEvent) => {
      const dxPt = (ev.clientX - startX) * ptsPerCssX;
      let newW = Math.max(20, initW + dxPt);
      let newH = newW / aspect;
      if (newH < 12) { newH = 12; newW = newH * aspect; }
      setPlacements((prev) =>
        prev.map((p) => (p.id === id ? { ...p, width: newW, height: newH } : p)),
      );
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  const saveSignedPdf = async () => {
    if (!bytesRef.current) return;
    if (placements.length === 0) {
      toast.error("Adicione ao menos uma assinatura.");
      return;
    }
    setSaving(true);
    try {
      const pdfDoc = await PDFDocument.load(bytesRef.current.slice(0));
      const pages = pdfDoc.getPages();
      for (const p of placements) {
        const page = pages[p.page - 1];
        if (!page) continue;
        const buf = await fetchImageBytes(p.dataUrl);
        const png = await pdfDoc.embedPng(buf).catch(async () => {
          try {
            return await pdfDoc.embedJpg(buf);
          } catch {
            return await pdfDoc.embedPng(await rasterizeImageToPngBytes(p.dataUrl));
          }
        });
        // Coordenadas armazenadas são em VIEWPORT do pdfjs (top-left, já considerando /Rotate).
        // Converter para o sistema da MediaBox (pdf-lib, bottom-left) compensando a rotação.
        const mw = page.getWidth();
        const mh = page.getHeight();
        const rot = (((p.rotation ?? page.getRotation().angle) % 360) + 360) % 360;
        const sw = p.width;
        const sh = p.height;
        let drawX = p.x;
        let drawY = mh - p.y - sh;
        let drawRot = 0;
        if (rot === 90) {
          drawX = mw - p.y;
          drawY = p.x;
          drawRot = 90;
        } else if (rot === 180) {
          drawX = mw - p.x;
          drawY = p.y + sh;
          drawRot = 180;
        } else if (rot === 270) {
          drawX = mw - p.y - sh;
          drawY = mh - p.x;
          drawRot = 270;
        }
        page.drawImage(png, {
          x: drawX,
          y: drawY,
          width: sw,
          height: sh,
          rotate: degrees(drawRot),
        });
      }
      const signedBytes = new Uint8Array(await pdfDoc.save());

      // Identificamos se é um Termo de Responsabilidade pelo nome do arquivo
      const isTermoPerda = nomeArquivo.toLowerCase().includes("termo_perda");
      
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? "anon";
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const safeName = nomeArquivo.replace(/[^\w.\-]+/g, "_");
      
      // Se for Termo de Perda, salvamos em uma pasta específica para facilitar a organização
      const folder = isTermoPerda ? "termos_perda" : "assinados";
      const path = `${uid}/${ts}_${safeName}`;
      const fullPath = `${folder}/${path}`;
      
      const blob = new Blob([signedBytes], { type: "application/pdf" });
      const { error: upErr } = await supabase.storage.from("sesmt-docs").upload(fullPath, blob, {
        contentType: "application/pdf",
        upsert: false,
      });
      if (upErr) throw upErr;

      const userEmail = userData.user?.email ?? null;
      const docData = {
        nome_arquivo: nomeArquivo,
        modulo: isTermoPerda ? "termo_perda" : modulo,
        referencia_id: referenciaId ?? null,
        pdf_assinado_path: fullPath,
        assinaturas: placements.map((p) => ({
          id: p.id,
          nome: p.nome,
          cargo: p.cargo,
          page: p.page,
          x: p.x,
          y: p.y,
          width: p.width,
          height: p.height,
          rotation: p.rotation,
          dataUrl: p.dataUrl,
        })),
        total_assinaturas: placements.length,
        assinado_por: userData.user?.id ?? null,
        assinado_por_email: userEmail,
        assinado_por_nome: userEmail,
        status: 'signed',
        updated_at: new Date().toISOString(),
      };

      const targetDocumentId = activeDocumentId ?? documentId;
      if (targetDocumentId) {
        const { error: updErr } = await (supabase as any)
          .from("documentos_assinados")
          .update(docData)
          .eq("id", targetDocumentId);
        if (updErr) throw updErr;
      } else {
        const { data: inserted, error: insErr } = await (supabase as any)
          .from("documentos_assinados")
          .insert(docData)
          .select("id")
          .single();
        if (insErr) throw insErr;
        if (inserted?.id) setActiveDocumentId(inserted.id);
      }

      qc.invalidateQueries({ queryKey: ["documentos-assinados"] });
      qc.invalidateQueries({ queryKey: ["signed-docs", referenciaId] });
      
      toast.success(isTermoPerda 
        ? "Termo de Responsabilidade assinado e arquivado com sucesso!" 
        : "Documento assinado e salvo com sucesso!"
      );
      
      bytesRef.current = signedBytes;
      setPlacements([]);
      const pdfjsLib = await loadPdfJs();
      const pdf = await pdfjsLib.getDocument({ data: signedBytes.slice(0) }).promise;
      pdfDocRef.current = pdf;
      setNumPages(pdf.numPages);
      setPageNum((p) => Math.min(p, pdf.numPages));
      await renderPage();
      onSigned?.({ path: fullPath, signedBytes });
      return signedBytes;
    } catch (e: any) {
      console.error(e);
      toast.error("Falha ao salvar: " + (e?.message ?? "erro desconhecido"));
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    await saveSignedPdf();
  };

  const pickSaved = (s: SavedSig) => {
    setPendingSig({ dataUrl: s.imagem_data_url, nome: s.nome, cargo: s.cargo ?? "" });
    setPicking(true);
  };

  const handlePadConfirm = (r: AssinaturaResult) => {
    setPendingSig({ dataUrl: r.dataUrl, nome: "Avulsa", cargo: "" });
    setPicking(true);
    setOpenPad(false);
  };

  const currentPlacements = placements.filter((p) => p.page === pageNum);

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="pdf-dialog light-paper bg-white max-w-[95vw] w-[1400px] h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-4 py-3 border-b bg-white">
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <MousePointerClick className="h-5 w-5 text-rose-600" />
              Assinador Visual — {nomeArquivo}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 grid grid-cols-[1fr_320px] min-h-0">
            {/* Viewer */}
            <div className="bg-slate-100 flex flex-col min-h-0">
              {/* Controls */}
              <div className="px-3 py-2 border-b bg-white flex items-center gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => setPageNum((p) => Math.max(1, p - 1))} disabled={pageNum <= 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium">
                  Página {pageNum} de {numPages || "…"}
                </span>
                <Button size="sm" variant="outline" onClick={() => setPageNum((p) => Math.min(numPages, p + 1))} disabled={pageNum >= numPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <div className="ml-2 flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setRenderScale((s) => Math.max(0.75, s - 0.25))}>-</Button>
                  <span className="text-xs self-center">{Math.round(renderScale * 100)}%</span>
                  <Button size="sm" variant="ghost" onClick={() => setRenderScale((s) => Math.min(3, s + 0.25))}>+</Button>
                </div>
                {picking && pendingSig && (
                  <div className="ml-auto flex items-center gap-2 bg-rose-50 border border-rose-300 rounded px-2 py-1 text-xs">
                    <span className="font-bold text-rose-700">Clique no PDF para posicionar:</span>
                    <span>{pendingSig.nome}{pendingSig.cargo ? ` — ${pendingSig.cargo}` : ""}</span>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { setPicking(false); setPendingSig(null); }}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>

              <ScrollArea className="flex-1">
                <div className="p-4 flex justify-center">
                  {loadError ? (
                    <div className="text-sm text-destructive p-8">Erro ao carregar PDF: {loadError}</div>
                  ) : (
                    <div className="relative inline-block shadow-lg" style={{ cursor: picking ? "crosshair" : "default" }}>
                      <canvas ref={canvasRef} className="block bg-white" />
                      <div
                        ref={overlayRef}
                        className="absolute inset-0"
                        onClick={handleCanvasClick}
                      >
                        {currentPlacements.map((p) => {
                          const rect = overlayRef.current?.getBoundingClientRect();
                          if (!rect || !pageSize.w) return null;
                          const cssPerPtX = rect.width / pageSize.w;
                          const cssPerPtY = rect.height / pageSize.h;
                          const leftCss = p.x * cssPerPtX;
                          const topCss = p.y * cssPerPtY;
                          const wCss = p.width * cssPerPtX;
                          const hCss = p.height * cssPerPtY;
                          return (
                            <div
                              key={p.id}
                              className="absolute border-2 border-rose-500 bg-rose-500/10 group select-none"
                              style={{ left: leftCss, top: topCss, width: wCss, height: hCss }}
                              onClick={(ev) => ev.stopPropagation()}
                              onPointerDown={(ev) => startMove(ev, p.id)}
                            >
                              <img src={p.dataUrl} alt="" draggable={false} className="w-full h-full object-contain pointer-events-none" />
                              <button
                                type="button"
                                className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full h-5 w-5 flex items-center justify-center opacity-0 group-hover:opacity-100"
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  setPlacements((prev) => prev.filter((x) => x.id !== p.id));
                                }}
                                title="Remover"
                              >
                                <X className="h-3 w-3" />
                              </button>
                              <div
                                onPointerDown={(ev) => startResize(ev, p.id)}
                                className="absolute -bottom-1.5 -right-1.5 h-4 w-4 bg-rose-600 border-2 border-white rounded-sm cursor-nwse-resize opacity-0 group-hover:opacity-100"
                                title="Redimensionar (arraste)"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>

            {/* Right panel: signature picker */}
            <div className="border-l bg-white flex flex-col min-h-0">
              <div className="px-3 py-2 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Library className="h-4 w-4 text-rose-600" />
                  <span className="font-bold text-sm">Galeria</span>
                </div>
                <SignatureGallery 
                  trigger={
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600">
                      <PenTool className="h-4 w-4" />
                    </Button>
                  }
                />
              </div>
              <ScrollArea className="flex-1">
                <div className="p-3 space-y-4">
                  {/* Minhas Assinaturas (user_signatures) */}
                  {userSigs.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Minhas Assinaturas</div>
                      {userSigs.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setPendingSig({ dataUrl: s.signature_data, nome: s.label, cargo: "" });
                            setPicking(true);
                          }}
                          className={`w-full border rounded-md p-2 hover:border-rose-400 hover:bg-rose-50 text-left transition ${
                            pendingSig?.dataUrl === s.signature_data ? "border-rose-500 ring-2 ring-rose-200" : "border-slate-200"
                          }`}
                        >
                          <img src={s.signature_data} alt={s.label} className="h-12 w-full object-contain bg-slate-50 rounded mb-1" />
                          <div className="text-xs font-semibold truncate">{s.label}</div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Assinaturas do Sistema (assinaturas_salvas) */}
                  <div className="space-y-2">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assinaturas do Sistema</div>
                    {savedSigs.length === 0 && userSigs.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        Nenhuma assinatura encontrada.
                      </p>
                    )}
                    {savedSigs.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => pickSaved(s)}
                        className={`w-full border rounded-md p-2 hover:border-rose-400 hover:bg-rose-50 text-left transition ${
                          pendingSig?.dataUrl === s.imagem_data_url ? "border-rose-500 ring-2 ring-rose-200" : "border-slate-200"
                        }`}
                      >
                        <img src={s.imagem_data_url} alt={s.nome} className="h-12 w-full object-contain bg-slate-50 rounded mb-1" />
                        <div className="text-xs font-semibold truncate">{s.nome}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{s.cargo || "—"}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </ScrollArea>
              <div className="border-t p-2 space-y-2">
                <Button variant="outline" size="sm" className="w-full" onClick={() => setOpenPad(true)}>
                  <Pencil className="h-4 w-4 mr-1" /> Desenhar / Importar
                </Button>
                <div className="text-[11px] text-muted-foreground px-1">
                  {placements.length} assinatura(s) posicionada(s)
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t px-4 py-3 flex-shrink-0">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button
              variant="outline"
              onClick={async () => {
                const bytes = placements.length > 0 ? await saveSignedPdf() : bytesRef.current;
                if (!bytes) { toast.error("PDF ainda não carregado"); return; }
                const blob = new Blob([bytes.slice()], { type: "application/pdf" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = nomeArquivo || "documento.pdf";
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              <Download className="h-4 w-4 mr-1" /> Baixar
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                const bytes = placements.length > 0 ? await saveSignedPdf() : bytesRef.current;
                if (!bytes) { toast.error("PDF ainda não carregado"); return; }
                try {
                  await printPdf(bytes.slice(), nomeArquivo || "documento.pdf");
                } catch (e) {
                  toast.error("Não foi possível abrir a impressão");
                }
              }}
            >
              <Printer className="h-4 w-4 mr-1" /> Imprimir
            </Button>
            <Button
              variant="outline"
              onClick={() => setPlacements([])}
              disabled={saving || placements.length === 0}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Limpar tudo
            </Button>
            <Button onClick={handleSave} disabled={saving || placements.length === 0} className="bg-rose-600 hover:bg-rose-700">
              <Save className="h-4 w-4 mr-1" />
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SignaturePadDialog
        open={openPad}
        onClose={() => setOpenPad(false)}
        onConfirm={handlePadConfirm}
        title="Nova assinatura"
      />
    </>
  );
}