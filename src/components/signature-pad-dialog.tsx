import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, X, Pencil, Upload, Eraser, BookmarkPlus, Trash2, Library } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AssinaturaResult = { dataUrl: string; height: number };

// Recorta bordas vazias e (para JPG/WEBP) remove fundo branco -> transparente
function processUploadedSignature(img: HTMLImageElement, isPng: boolean): string {
  const MAX = 1200;
  const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const src = document.createElement("canvas");
  src.width = w; src.height = h;
  const sctx = src.getContext("2d")!;
  sctx.drawImage(img, 0, 0, w, h);
  const imgData = sctx.getImageData(0, 0, w, h);
  const d = imgData.data;

  // Se não for PNG, remove fundo claro -> alpha 0
  if (!isPng) {
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      // pixel claro -> transparente
      if (r > 230 && g > 230 && b > 230) {
        d[i + 3] = 0;
      } else {
        // escurece levemente para o traço ficar nítido
        const k = 0.85;
        d[i] = Math.round(r * k);
        d[i + 1] = Math.round(g * k);
        d[i + 2] = Math.round(b * k);
      }
    }
    sctx.putImageData(imgData, 0, 0);
  }

  // Bounding box dos pixels visíveis (alpha > 10)
  let minX = w, minY = h, maxX = 0, maxY = 0, found = false;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 10) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        found = true;
      }
    }
  }
  if (!found) return src.toDataURL("image/png");

  const pad = 6;
  const sx = Math.max(0, minX - pad), sy = Math.max(0, minY - pad);
  const sw = Math.min(w - sx, maxX - minX + pad * 2);
  const sh = Math.min(h - sy, maxY - minY + pad * 2);
  const out = document.createElement("canvas");
  out.width = sw; out.height = sh;
  out.getContext("2d")!.drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);
  return out.toDataURL("image/png");
}

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
  const [tab, setTab] = useState<"draw" | "upload" | "saved">("saved");
  const [saveNome, setSaveNome] = useState("");
  const [saveCargo, setSaveCargo] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const lastPt = useRef<{ x: number; y: number } | null>(null);
  const hasStroke = useRef(false);
  const qc = useQueryClient();

  const { data: salvas = [] } = useQuery({
    queryKey: ["assinaturas-salvas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assinaturas_salvas")
        .select("id,nome,cargo,imagem_data_url,created_at")
        .order("nome", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const salvarMut = useMutation({
    mutationFn: async (payload: { nome: string; cargo: string; imagem_data_url: string }) => {
      const { error } = await supabase.from("assinaturas_salvas").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Assinatura salva na galeria");
      qc.invalidateQueries({ queryKey: ["assinaturas-salvas"] });
      setSaveNome(""); setSaveCargo("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const excluirMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("assinaturas_salvas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Assinatura removida");
      qc.invalidateQueries({ queryKey: ["assinaturas-salvas"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao remover"),
  });

  useEffect(() => {
    if (open) {
      setSignature(null); setHeight(80); setTab("saved"); hasStroke.current = false;
      setSaveNome(""); setSaveCargo("");
    }
  }, [open]);

  // Setup canvas
  useEffect(() => {
    if (!open || tab !== "draw") return;
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = Math.round(rect.width * dpr);
    c.height = Math.round(rect.height * dpr);
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0a0a0a";
    ctx.clearRect(0, 0, c.width, c.height);
    hasStroke.current = false;
  }, [open, tab]);

  const getPt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    drawing.current = true;
    lastPt.current = getPt(e);
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const p = getPt(e);
    if (lastPt.current) {
      ctx.beginPath();
      ctx.moveTo(lastPt.current.x, lastPt.current.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    lastPt.current = p;
    hasStroke.current = true;
  };
  const onUp = () => { drawing.current = false; lastPt.current = null; };

  const limparCanvas = () => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    hasStroke.current = false;
  };

  // Crop transparente e exporta PNG
  const exportDesenho = (): string | null => {
    const c = canvasRef.current; if (!c) return null;
    if (!hasStroke.current) return null;
    const ctx = c.getContext("2d"); if (!ctx) return null;
    const { width, height: h } = c;
    const img = ctx.getImageData(0, 0, width, h).data;
    let minX = width, minY = h, maxX = 0, maxY = 0, found = false;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < width; x++) {
        if (img[(y * width + x) * 4 + 3] > 10) {
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
          found = true;
        }
      }
    }
    if (!found) return null;
    const pad = 8;
    const sx = Math.max(0, minX - pad), sy = Math.max(0, minY - pad);
    const sw = Math.min(width - sx, maxX - minX + pad * 2);
    const sh = Math.min(h - sy, maxY - minY + pad * 2);
    const out = document.createElement("canvas");
    out.width = sw; out.height = sh;
    out.getContext("2d")!.drawImage(c, sx, sy, sw, sh, 0, 0, sw, sh);
    return out.toDataURL("image/png");
  };

  const onUpload = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Envie uma imagem (PNG, JPG, WEBP...)"); return; }
    if (file.size > 8 * 1024 * 1024) { toast.error("Arquivo muito grande (máx. 8MB)"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      const img = new Image();
      img.onload = () => {
        try {
          const processed = processUploadedSignature(img, file.type === "image/png");
          setSignature(processed);
          // ajusta altura inicial proporcional pra preview ficar bonita
          setHeight(80);
        } catch {
          setSignature(src);
        }
      };
      img.onerror = () => toast.error("Não consegui ler a imagem");
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {signature ? (
          <div className="border-2 border-black bg-white text-black p-3">
            <div className="flex flex-col items-center gap-1 w-full">
              <img src={signature} alt="Assinatura" style={{ height: `${height}px`, width: "auto" }} className="object-contain max-w-full" />
              <div className="flex items-center gap-2 w-full px-2 pt-2">
                <span className="text-[10px] text-muted-foreground">Tamanho</span>
                <input type="range" min={20} max={140} step={2} value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                  className="flex-1 accent-red-700" />
                <button type="button" onClick={() => setSignature(null)} className="text-[10px] text-red-700 hover:underline">
                  Refazer
                </button>
              </div>
            </div>
            <div className="mt-3 border-t pt-3 space-y-2">
              <p className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                <BookmarkPlus className="h-3.5 w-3.5" /> Salvar na galeria compartilhada (opcional)
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Nome (ex.: Anderson Soares)" value={saveNome} onChange={(e) => setSaveNome(e.target.value)} className="h-8 text-xs" />
                <Input placeholder="Cargo (ex.: Supervisor Geral)" value={saveCargo} onChange={(e) => setSaveCargo(e.target.value)} className="h-8 text-xs" />
              </div>
              <Button type="button" size="sm" variant="outline" className="w-full"
                disabled={!saveNome.trim() || !saveCargo.trim() || salvarMut.isPending}
                onClick={() => salvarMut.mutate({ nome: saveNome.trim(), cargo: saveCargo.trim(), imagem_data_url: signature })}>
                <BookmarkPlus className="h-3.5 w-3.5 mr-1" />
                {salvarMut.isPending ? "Salvando..." : "Salvar para reutilizar depois"}
              </Button>
            </div>
          </div>
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v as "draw" | "upload" | "saved")}>
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="saved"><Library className="h-3.5 w-3.5 mr-1.5" />Galeria</TabsTrigger>
              <TabsTrigger value="draw"><Pencil className="h-3.5 w-3.5 mr-1.5" />Desenhar</TabsTrigger>
              <TabsTrigger value="upload"><Upload className="h-3.5 w-3.5 mr-1.5" />Importar</TabsTrigger>
            </TabsList>
            <TabsContent value="saved" className="mt-2">
              {salvas.length === 0 ? (
                <div className="text-[12px] text-muted-foreground border-2 border-dashed rounded p-6 text-center">
                  Nenhuma assinatura salva ainda. Desenhe ou importe uma e salve na galeria pra reutilizar nos próximos PDFs.
                </div>
              ) : (
                <div className="max-h-64 overflow-auto divide-y border rounded">
                  {salvas.map((s: any) => (
                    <div key={s.id} className="flex items-center gap-3 p-2 hover:bg-muted/50">
                      <img src={s.imagem_data_url} alt={s.nome} className="h-10 w-24 object-contain bg-white border rounded" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold truncate">{s.nome}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{s.cargo}</div>
                      </div>
                      <Button type="button" size="sm" variant="default" onClick={() => { setSignature(s.imagem_data_url); setHeight(80); }}>
                        Usar
                      </Button>
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-red-700"
                        onClick={() => { if (confirm(`Remover assinatura de ${s.nome}?`)) excluirMut.mutate(s.id); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="draw" className="mt-2">
              <div className="border-2 border-black bg-white rounded">
                <canvas
                  ref={canvasRef}
                  onPointerDown={onDown}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                  onPointerLeave={onUp}
                  onPointerCancel={onUp}
                  className="w-full h-48 touch-none cursor-crosshair block"
                  style={{ touchAction: "none" }}
                />
              </div>
              <div className="flex justify-between items-center mt-2">
                <p className="text-[11px] text-muted-foreground">Assine usando mouse, caneta ou dedo</p>
                <Button type="button" size="sm" variant="ghost" onClick={limparCanvas}>
                  <Eraser className="h-3.5 w-3.5 mr-1" />Limpar
                </Button>
              </div>
              <div className="flex justify-end mt-2">
                <Button type="button" size="sm" onClick={() => {
                  const url = exportDesenho();
                  if (!url) { toast.error("Desenhe sua assinatura primeiro"); return; }
                  setSignature(url);
                }}>Usar assinatura</Button>
              </div>
            </TabsContent>
            <TabsContent value="upload" className="mt-2">
              <label className="cursor-pointer flex flex-col items-center justify-center gap-2 text-[12px] text-red-700 hover:bg-red-50 px-3 py-8 border-2 border-dashed border-red-700/50 rounded">
                <Upload className="h-5 w-5" />
                <span>Clique para enviar PNG, JPG ou WEBP</span>
                <input type="file" accept="image/png,image/jpeg,image/webp,image/*" className="hidden"
                  onChange={(e) => onUpload(e.target.files?.[0] ?? null)} />
              </label>
            </TabsContent>
          </Tabs>
        )}
        <div className="rounded-md bg-amber-50 border border-amber-200 p-2 text-[11px] text-amber-900 leading-snug">
          <strong>Dica:</strong> você pode <strong>desenhar</strong> direto na tela ou
          <strong> importar um PNG transparente</strong> com apenas o traçado da assinatura.
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
