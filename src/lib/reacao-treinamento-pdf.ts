import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { baixarTemplateAtivoPorCodigo } from "@/lib/templates-documentos.functions";

export type ReacaoTreinamentoParams = {
  empresa?: string;
  data: string; // dd/mm/yyyy
  tipo: "INTERNO" | "EXTERNO" | "";
  instrutor: string;
  instituicao: string;
  treinamento?: string;
  cargaHoraria?: string;
  tstNome?: string;
  tstAssinaturaDataUrl?: string | null;
  codigo?: string;
  revisao?: string;
  dataDocumento?: string;
  /** Bytes do PDF-template já baixados (evita 1 request por cópia num lote) */
  templatePdfBytes?: Uint8Array;
};

/**
 * Coordenadas dos campos variáveis do FORCP-GP-16 (Avaliação de Reação
 * do Treinamento — Revisão 01). Extraídas do PDF oficial homologado no
 * SIGMO. Se o template mudar (nova revisão com layout diferente), é só
 * remedir os campos e atualizar aqui.
 *
 * pdf-lib usa origem no canto inferior-esquerdo (y cresce pra cima).
 * Página A4 = 595.20 x 841.80 pt.
 */
const PAGE_H = 841.8;
const FIELDS = {
  empresa:      { x: 130, top: 150.2, bottom: 166.6, maxW: 420, fontSize: 9 },
  treinamento:  { x: 130, top: 166.4, bottom: 181.8, maxW: 245, fontSize: 9 },
  cargaHoraria: { x: 456, top: 166.4, bottom: 181.8, maxW:  90, fontSize: 9 },
  data:         { x: 130, top: 181.6, bottom: 197.0, maxW:  80, fontSize: 9 },
  instrutor:    { x: 130, top: 196.8, bottom: 212.2, maxW: 180, fontSize: 9 },
  instituicao:  { x: 436, top: 196.8, bottom: 212.2, maxW: 118, fontSize: 9 },
  // Checkboxes: célula inteira (cinza) — só marcamos um "X" bem centrado.
  checkInterno: { cx: 301.6, cy: 189.3 },
  checkExterno: { cx: 369.9, cy: 189.3 },
};

function toY(topOrBot: number, offsetUp = 4.2): number {
  // baseline dentro da célula: um pouco acima da borda inferior
  return PAGE_H - topOrBot + offsetUp;
}

let _templateCache: Uint8Array | null = null;
async function loadTemplate(): Promise<Uint8Array> {
  if (_templateCache) return _templateCache;
  const res = await baixarTemplateAtivoPorCodigo({ data: { codigo: "FORCP-GP-16" } });
  const bin = atob(res.base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  _templateCache = bytes;
  return bytes;
}

function truncateToWidth(
  text: string,
  font: import("pdf-lib").PDFFont,
  size: number,
  maxW: number,
): string {
  if (!text) return "";
  if (font.widthOfTextAtSize(text, size) <= maxW) return text;
  const ell = "…";
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    const w = font.widthOfTextAtSize(text.slice(0, mid) + ell, size);
    if (w <= maxW) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo) + ell;
}

/**
 * Gera uma Avaliação de Reação de Treinamento sobrepondo os campos
 * variáveis (empresa, treinamento, data, instrutor…) no PDF oficial
 * homologado do template FORCP-GP-16. Zero redesenho — bordas, tabelas,
 * cabeçalho e rodapé vêm do PDF original com fidelidade 100%.
 */
export async function gerarAvaliacaoReacao(p: ReacaoTreinamentoParams): Promise<Blob> {
  const bytes = p.templatePdfBytes ?? (await loadTemplate());
  const pdf = await PDFDocument.load(bytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.getPage(0);
  const black = rgb(0, 0, 0);

  const drawField = (
    text: string | undefined,
    f: { x: number; top: number; bottom: number; maxW: number; fontSize: number },
  ) => {
    if (!text) return;
    const t = truncateToWidth(text, font, f.fontSize, f.maxW);
    page.drawText(t, {
      x: f.x,
      y: toY(f.bottom, 4.2),
      size: f.fontSize,
      font,
      color: black,
    });
  };

  drawField(p.empresa, FIELDS.empresa);
  drawField(p.treinamento, FIELDS.treinamento);
  drawField(p.cargaHoraria, FIELDS.cargaHoraria);
  drawField(p.data, FIELDS.data);
  drawField(p.instrutor, FIELDS.instrutor);
  drawField(p.instituicao, FIELDS.instituicao);

  // Checkbox: "X" centralizado na célula
  const markX = (cx: number, cy: number) => {
    const size = 10;
    const w = fontBold.widthOfTextAtSize("X", size);
    page.drawText("X", {
      x: cx - w / 2,
      y: PAGE_H - cy - size / 2 + 1,
      size,
      font: fontBold,
      color: black,
    });
  };
  if (p.tipo === "INTERNO") markX(FIELDS.checkInterno.cx, FIELDS.checkInterno.cy);
  if (p.tipo === "EXTERNO") markX(FIELDS.checkExterno.cx, FIELDS.checkExterno.cy);

  const out = await pdf.save();
  return new Blob([out as BlobPart], { type: "application/pdf" });
}

/** Baixa o template uma vez pra reaproveitar em geração em lote. */
export async function preloadTemplateReacao(): Promise<Uint8Array> {
  return loadTemplate();
}