import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { baixarTemplateAtivoPorCodigo } from "@/lib/templates-documentos.functions";
import { OVERLAY_MAPS, type OverlayField } from "@/lib/pdf-overlay-maps";

/**
 * Motor genérico de overlay para templates homologados.
 * Nunca redesenha o formulário: baixa o PDF oficial e desenha só os
 * campos variáveis por cima, nas coordenadas de OVERLAY_MAPS.
 */

export type RenderOverlayInput = {
  codigo: string;
  fields?: Record<string, string | undefined>;
  checkboxes?: Record<string, boolean | string | undefined>;
  templatePdfBytes?: Uint8Array;
};

const _cache = new Map<string, Uint8Array>();

export async function loadTemplateBytes(codigo: string): Promise<Uint8Array> {
  const hit = _cache.get(codigo);
  if (hit) return hit;
  const res = await baixarTemplateAtivoPorCodigo({ data: { codigo } });
  const bin = atob(res.base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  _cache.set(codigo, bytes);
  return bytes;
}

function truncateToWidth(text: string, font: PDFFont, size: number, maxW: number): string {
  if (!text) return "";
  if (font.widthOfTextAtSize(text, size) <= maxW) return text;
  const ell = "…";
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    const w = font.widthOfTextAtSize(text.slice(0, mid) + ell, size);
    if (w <= maxW) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo) + ell;
}

export async function renderOverlay(input: RenderOverlayInput): Promise<Blob> {
  const map = OVERLAY_MAPS[input.codigo];
  if (!map) {
    throw new Error(
      `Sem mapeamento de overlay para o template ${input.codigo}. ` +
      `Adicione em src/lib/pdf-overlay-maps.ts depois de medir os campos no PDF-mãe.`,
    );
  }
  const bytes = input.templatePdfBytes ?? (await loadTemplateBytes(input.codigo));
  const pdf = await PDFDocument.load(bytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const H = map.pageHeight;
  const black = rgb(0, 0, 0);

  const drawField = (value: string | undefined, f: OverlayField) => {
    if (!value) return;
    const page = pdf.getPage(f.page ?? 0);
    const size = f.size ?? 9;
    const chosen = f.bold ? fontBold : font;
    const t = truncateToWidth(String(value), chosen, size, f.maxW);
    page.drawText(t, {
      x: f.x,
      y: H - f.top + (f.baselineOffset ?? 4.2),
      size,
      font: chosen,
      color: black,
    });
  };

  for (const [key, cfg] of Object.entries(map.fields)) {
    drawField(input.fields?.[key], cfg);
  }

  for (const [key, cfg] of Object.entries(map.checkboxes ?? {})) {
    const raw = input.checkboxes?.[key];
    if (!raw) continue;
    const page = pdf.getPage(cfg.page ?? 0);
    const mark = raw === true ? "X" : String(raw).toUpperCase();
    const size = cfg.size ?? (mark.length > 1 ? 4.2 : 5.2);
    const w = fontBold.widthOfTextAtSize(mark, size);
    page.drawText(mark, {
      x: cfg.cx - w / 2,
      y: H - cfg.cy - size / 2 + 1.1,
      size,
      font: fontBold,
      color: black,
    });
  }

  const out = await pdf.save();
  return new Blob([out as BlobPart], { type: "application/pdf" });
}

export async function preloadTemplate(codigo: string): Promise<Uint8Array> {
  return loadTemplateBytes(codigo);
}