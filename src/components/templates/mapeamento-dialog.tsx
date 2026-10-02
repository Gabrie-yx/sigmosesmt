import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Wand2, Save, Loader2, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  obterMapeamentoVersao,
  salvarMapeamentoVersao,
  detectarMapeamentoIA,
} from "@/lib/templates-documentos.functions";
import { getTemplateSchema, isBoxMap, type Box, type BoxMap } from "@/lib/template-field-schemas";
import { clearTemplateCache } from "@/lib/pdf-overlay-engine";
import { refineMap, type Raster } from "@/lib/template-map-refine";

function b64ToBytes(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function dataUrlToRaster(url: string): Promise<Raster> {
  const im = new Image();
  im.src = url;
  await im.decode();
  const c = document.createElement("canvas");
  c.width = im.naturalWidth;
  c.height = im.naturalHeight;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(im, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height);
  return { data: d.data, width: d.width, height: d.height, channels: 4 };
}

/** Renderiza a 1ª página do PDF e devolve imagem + tamanho em pontos. */
export async function renderPrimeiraPagina(bytes: Uint8Array) {
  const [{ renderPdfToImagePages }, { PDFDocument }] = await Promise.all([
    import("@/lib/pdf-print"),
    import("pdf-lib"),
  ]);
  const doc = await PDFDocument.load(bytes);
  // A imagem é renderizada pela CropBox (pdfjs), não pela MediaBox do arquivo.
  const { width, height } = doc.getPage(0).getCropBox();
  const [img] = await renderPdfToImagePages(bytes.slice(), 2);
  return { img, pageW: width, pageH: height };
}

/**
 * Mapeamento automático: renderiza o PDF novo, a IA localiza cada campo
 * e o mapa fica gravado na revisão (status AUTO). Usado após upload e
 * sempre que o painel detecta uma revisão sem mapeamento.
 */
export async function autoMapearVersao(
  versionId: string,
  codigo: string,
  fns: { obter: (a: any) => Promise<any>; detectar: (a: any) => Promise<any>; salvar: (a: any) => Promise<any> },
) {
  const schema = getTemplateSchema(codigo);
  if (!schema) return null;
  const v = await fns.obter({ data: { versionId } });
  const { img, pageW, pageH } = await renderPrimeiraPagina(b64ToBytes(v.base64));
  const res = await fns.detectar({
    data: {
      versionId,
      imageDataUrl: img,
      pageW,
      pageH,
      fields: schema.fields.map((f) => ({ key: f.key, label: f.label, hint: f.hint })),
    },
  });
  // Ajuste fino nos pixels: encaixa nas bordas, pula rótulos, acha "( )".
  const raster = await dataUrlToRaster(img);
  const map = refineMap(res.map as BoxMap, schema.fields, raster);
  await fns.salvar({ data: { versionId, map, status: "AUTO" } });
  clearTemplateCache(codigo);
  return { map, detectados: res.detectados as number, total: res.total as number };
}

const KIND_COLOR: Record<string, string> = {
  text: "border-sky-500 bg-sky-400/15",
  check: "border-fuchsia-500 bg-fuchsia-400/20",
  sig: "border-emerald-500 bg-emerald-400/10",
  row: "border-amber-500 bg-amber-400/10",
  col: "border-orange-500 bg-orange-400/10",
};

export function MapeamentoDialog({
  versionId,
  codigo,
  revisao,
  onClose,
}: {
  versionId: string;
  codigo: string;
  revisao: number;
  onClose: () => void;
}) {
  const schema = getTemplateSchema(codigo)!;
  const obter = useServerFn(obterMapeamentoVersao);
  const salvar = useServerFn(salvarMapeamentoVersao);
  const detectar = useServerFn(detectarMapeamentoIA);
  const qc = useQueryClient();

  const [img, setImg] = useState<string | null>(null);
  const [page, setPage] = useState<{ w: number; h: number } | null>(null);
  const [boxes, setBoxes] = useState<Record<string, Box>>({});
  const [status, setStatus] = useState("PENDENTE");
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState<"load" | "ia" | "save" | null>("load");
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ key: string; mode: "move" | "resize"; sx: number; sy: number; b: Box } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const v = await obter({ data: { versionId } });
        const r = await renderPrimeiraPagina(b64ToBytes(v.base64));
        setImg(r.img);
        setPage({ w: r.pageW, h: r.pageH });
        setStatus(v.overlayStatus);
        const def = schema.defaultMap;
        if (isBoxMap(v.overlayMap)) {
          const sx = r.pageW / v.overlayMap.pageW, sy = r.pageH / v.overlayMap.pageH;
          const b: Record<string, Box> = {};
          for (const [k, x] of Object.entries(v.overlayMap.boxes)) b[k] = { x: x.x * sx, top: x.top * sy, w: x.w * sx, h: x.h * sy };
          setBoxes(b);
        } else if (def && Math.abs(def.pageW - r.pageW) < 1 && Math.abs(def.pageH - r.pageH) < 1) {
          setBoxes({ ...def.boxes });
        }
      } catch (e: any) {
        toast.error(e?.message ?? "Falha ao abrir o PDF.");
      } finally {
        setBusy(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionId]);

  const scale = () => (wrapRef.current && page ? wrapRef.current.clientWidth / page.w : 1);

  function onPointerDown(e: React.PointerEvent, key: string, mode: "move" | "resize") {
    e.stopPropagation();
    e.preventDefault();
    setSel(key);
    drag.current = { key, mode, sx: e.clientX, sy: e.clientY, b: boxes[key] };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const k = scale();
    const dx = (e.clientX - d.sx) / k, dy = (e.clientY - d.sy) / k;
    setBoxes((prev) => ({
      ...prev,
      [d.key]:
        d.mode === "move"
          ? { ...d.b, x: d.b.x + dx, top: d.b.top + dy }
          : { ...d.b, w: Math.max(4, d.b.w + dx), h: Math.max(4, d.b.h + dy) },
    }));
  }
  function onPointerUp() {
    drag.current = null;
  }

  function adicionar(key: string) {
    if (!page) return;
    const kind = schema.fields.find((f) => f.key === key)?.kind;
    const w = kind === "check" ? 8 : kind === "sig" ? 150 : kind === "row" ? page.w * 0.9 : 120;
    const h = kind === "check" ? 8 : kind === "sig" ? 45 : 14;
    setBoxes((p) => ({ ...p, [key]: { x: page.w / 2 - w / 2, top: page.h / 2 - h / 2, w, h } }));
    setSel(key);
  }

  async function rodarIA() {
    setBusy("ia");
    try {
      const res = await autoMapearVersao(versionId, codigo, { obter, detectar, salvar });
      if (res) {
        setBoxes(res.map.boxes);
        setStatus("AUTO");
        toast.success(`IA localizou ${res.detectados} de ${res.total} campos. Confira e salve.`);
        qc.invalidateQueries({ queryKey: ["document-templates"] });
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Falha na detecção automática.");
    } finally {
      setBusy(null);
    }
  }

  async function salvarRevisado() {
    if (!page) return;
    const faltando = schema.fields.filter((f) => !boxes[f.key]).map((f) => f.label);
    if (faltando.length) return toast.error(`Faltam campos: ${faltando.join(", ")}`);
    setBusy("save");
    try {
      const round = (n: number) => Math.round(n * 10) / 10;
      const b: Record<string, Box> = {};
      for (const [k, x] of Object.entries(boxes)) b[k] = { x: round(x.x), top: round(x.top), w: round(x.w), h: round(x.h) };
      await salvar({ data: { versionId, map: { pageW: page.w, pageH: page.h, boxes: b }, status: "REVISADO" } });
      clearTemplateCache(codigo);
      qc.invalidateQueries({ queryKey: ["document-templates"] });
      toast.success("Mapeamento salvo. Os próximos documentos já saem alinhados.");
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar.");
    } finally {
      setBusy(null);
    }
  }

  const k = scale();

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            Mapear campos — {codigo} Rev.{String(revisao).padStart(2, "0")}
            <Badge variant="outline">
              {status === "REVISADO" ? "Revisado" : status === "AUTO" ? "Detectado pela IA · revisar" : "Pendente"}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Arraste as caixas para onde cada informação deve ser escrita; puxe o canto inferior direito para redimensionar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-4 min-h-0 flex-1 overflow-hidden">
          <div className="flex-1 overflow-auto border rounded-md bg-muted/30">
            {busy === "load" || !img ? (
              <div className="p-10 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando PDF…
              </div>
            ) : (
              <div
                ref={wrapRef}
                className="relative w-full select-none touch-none"
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerDown={() => setSel(null)}
              >
                <img src={img} alt="PDF do template" className="w-full block" draggable={false} />
                {schema.fields.map((f) => {
                  const b = boxes[f.key];
                  if (!b) return null;
                  return (
                    <div
                      key={f.key}
                      onPointerDown={(e) => onPointerDown(e, f.key, "move")}
                      className={`absolute border cursor-move ${KIND_COLOR[f.kind]} ${sel === f.key ? "ring-2 ring-primary z-10" : ""}`}
                      style={{ left: b.x * k, top: b.top * k, width: b.w * k, height: b.h * k }}
                      title={f.label}
                    >
                      {sel === f.key && (
                        <span className="absolute -top-5 left-0 text-[10px] px-1 rounded bg-primary text-primary-foreground whitespace-nowrap">
                          {f.label}
                        </span>
                      )}
                      <span
                        onPointerDown={(e) => onPointerDown(e, f.key, "resize")}
                        className="absolute -right-1 -bottom-1 w-2.5 h-2.5 bg-primary cursor-se-resize rounded-sm"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="w-60 shrink-0 overflow-auto space-y-1 text-sm">
            {schema.fields.map((f) => (
              <div
                key={f.key}
                onClick={() => (boxes[f.key] ? setSel(f.key) : adicionar(f.key))}
                className={`flex items-center justify-between gap-2 px-2 py-1 rounded cursor-pointer hover:bg-muted ${sel === f.key ? "bg-muted" : ""}`}
              >
                <span className="flex items-center gap-2 truncate">
                  <span className={`w-2.5 h-2.5 rounded-sm border ${KIND_COLOR[f.kind]}`} />
                  <span className="truncate">{f.label}</span>
                </span>
                {!boxes[f.key] && <Plus className="w-3.5 h-3.5 text-destructive shrink-0" />}
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={rodarIA} disabled={!!busy}>
            {busy === "ia" ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Wand2 className="w-4 h-4 mr-1" />}
            Detectar automaticamente
          </Button>
          <Button onClick={salvarRevisado} disabled={!!busy || !page}>
            {busy === "save" ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            Salvar mapeamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
