import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type jsPDF from "jspdf";
import { loadTemplateBytes, getTemplateMeta } from "@/lib/pdf-overlay-engine";
import { getTemplateSchema, isBoxMap, type Box, type BoxMap } from "@/lib/template-field-schemas";
import { detectarMapaPdf } from "@/lib/template-map-detect";
import { gerarFormularioSemanalDDS, type DDSFormParams } from "@/lib/dds-formulario-semanal-pdf";

export const DDS_TEMPLATE_CODIGO = "FOR-SEG-06";

/**
 * Lista de Presença DDS no PDF-mãe homologado (FOR-SEG-06).
 * Uma ou mais folhas por empresa (16 linhas por folha) + o verso com os códigos no fim.
 * Plano B: se o template não puder ser lido, usa o layout desenhado em código.
 */
export async function gerarListaPresencaDDS(blocos: DDSFormParams[]): Promise<jsPDF> {
  try {
    const bytes = await gerarOverlay(blocos);
    if (bytes) return shim(bytes);
  } catch (e) {
    console.warn("[DDS] template homologado indisponível, usando layout antigo:", e);
  }
  let doc: jsPDF | undefined;
  for (const b of blocos) doc = gerarFormularioSemanalDDS(b, doc);
  return doc!;
}

/** Objeto compatível com o visualizador (output/save), embrulhando os bytes do pdf-lib. */
function shim(bytes: Uint8Array): jsPDF {
  const blob = () => new Blob([bytes as BlobPart], { type: "application/pdf" });
  return {
    output: (t?: string) => (t === "arraybuffer" ? bytes.slice().buffer : t === "blob" ? blob() : URL.createObjectURL(blob())),
    save: (name: string) => {
      const url = URL.createObjectURL(blob());
      const a = document.createElement("a");
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    },
  } as unknown as jsPDF;
}

async function resolverMapa(tpl: Uint8Array, pageW: number, pageH: number): Promise<BoxMap | null> {
  const schema = getTemplateSchema(DDS_TEMPLATE_CODIGO)!;
  const completo = (m: unknown): m is BoxMap => isBoxMap(m) && schema.fields.every((f) => (m as BoxMap).boxes[f.key]);
  const escalar = (m: BoxMap): BoxMap => {
    const sx = pageW / m.pageW, sy = pageH / m.pageH;
    const boxes: Record<string, Box> = {};
    for (const [k, b] of Object.entries(m.boxes)) boxes[k] = { x: b.x * sx, top: b.top * sy, w: b.w * sx, h: b.h * sy };
    return { pageW, pageH, boxes };
  };
  const salvo = getTemplateMeta(DDS_TEMPLATE_CODIGO)?.overlayMap;
  if (completo(salvo)) return escalar(salvo);
  try {
    const r = await detectarMapaPdf(DDS_TEMPLATE_CODIGO, tpl.slice());
    if (completo(r.map)) return escalar(r.map);
  } catch (e) {
    console.warn("[DDS] detecção automática falhou:", e);
  }
  return null;
}

function safe(t: string) {
  return (t ?? "").replace(/[\u0100-\uFFFF]/g, (c) => ({ "\u2018": "'", "\u2019": "'", "\u201C": '"', "\u201D": '"', "\u2013": "-", "\u2014": "-", "\u2026": "..." } as Record<string, string>)[c] ?? "");
}

function putBox(page: PDFPage, b: Box, text: string | null | undefined, font: PDFFont, o: { size?: number; center?: boolean; min?: number } = {}) {
  const t = safe(String(text ?? "")).replace(/\s+/g, " ").trim();
  if (!t) return;
  const crop = page.getCropBox();
  const avail = b.w - 4;
  let size = Math.min(o.size ?? 9, b.h * 0.75);
  while (size > (o.min ?? 5) && font.widthOfTextAtSize(t, size) > avail) size -= 0.25;
  let s = t;
  while (s.length > 1 && font.widthOfTextAtSize(s, size) > avail) s = s.slice(0, -2) + "…".replace("…", ".");
  const w = font.widthOfTextAtSize(s, size);
  const x = crop.x + b.x + (o.center ? (b.w - w) / 2 : 2);
  const baseline = b.top + b.h / 2 + size * 0.35;
  page.drawText(s, { x, y: crop.y + crop.height - baseline, size, font, color: rgb(0, 0, 0) });
}

async function embedImg(pdf: PDFDocument, src: string) {
  try {
    let buf: Uint8Array;
    if (src.startsWith("data:")) {
      const bin = atob(src.split(",")[1] ?? "");
      buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    } else {
      const res = await fetch(src);
      if (!res.ok) return null;
      buf = new Uint8Array(await res.arrayBuffer());
    }
    return buf[0] === 0x89 && buf[1] === 0x50 ? await pdf.embedPng(buf) : await pdf.embedJpg(buf);
  } catch {
    return null;
  }
}

/** "29- Tema / 58- Outro / Tema livre" → "29 / 58 / Tema livre" (a folha pede os códigos; o verso tem os temas). */
export function codigosAssuntos(assuntos: string) {
  return assuntos
    .split(" / ")
    .map((s) => s.trim())
    .filter((s) => s && s !== "—")
    .map((s) => s.match(/^(\d{1,3})\s*[-–.]/)?.[1] ?? s)
    .join(" / ");
}

async function gerarOverlay(blocos: DDSFormParams[]): Promise<Uint8Array | null> {
  if (!blocos.length) return null;
  const tpl = await loadTemplateBytes(DDS_TEMPLATE_CODIGO);
  const src = await PDFDocument.load(tpl);
  const crop0 = src.getPage(0).getCropBox();
  const map = await resolverMapa(tpl, crop0.width, crop0.height);
  if (!map) return null;
  const B = map.boxes;
  const rf = B.row_first, rl = B.row_last;
  const nRows = Math.max(1, Math.round((rl.top - rf.top) / rf.h) + 1);
  const pitch = nRows > 1 ? (rl.top - rf.top) / (nRows - 1) : rf.h;

  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  const bold = await out.embedFont(StandardFonts.HelveticaBold);
  const temVerso = src.getPageCount() > 1;

  for (const p of blocos) {
    const funcs = p.funcionarios.length ? p.funcionarios : [];
    const folhas = Math.max(1, Math.ceil(funcs.length / nRows));
    const encImg = p.assinaturaEncarregadoDataUrl ? await embedImg(out, p.assinaturaEncarregadoDataUrl) : null;
    const sesImg = p.assinaturaResponsavelDataUrl ? await embedImg(out, p.assinaturaResponsavelDataUrl) : null;
    for (let f = 0; f < folhas; f++) {
      const [pg] = await out.copyPages(src, [0]);
      out.addPage(pg);
      const crop = pg.getCropBox();
      // O PDF-mãe já traz o nome de uma empresa impresso: cobre antes de escrever.
      const e = B.empresa;
      pg.drawRectangle({ x: crop.x + e.x - 1, y: crop.y + crop.height - e.top - e.h, width: e.w, height: e.h, color: rgb(1, 1, 1) });
      putBox(pg, e, p.empresaNome, bold, { size: 9 });
      putBox(pg, B.local_setor, p.localSetor, font, { size: 9 });
      putBox(pg, B.data, p.periodoTexto, font, { size: 9 });
      putBox(pg, B.assuntos, codigosAssuntos(p.assuntos), bold, { size: 8 });
      const slice = funcs.slice(f * nRows, (f + 1) * nRows);
      slice.forEach((fu, i) => {
        const top = rf.top + i * pitch;
        putBox(pg, { ...B.col_nome, top, h: rf.h }, fu.nome, font, { size: 8.5 });
        putBox(pg, { ...B.col_funcao, top, h: rf.h }, fu.funcao ?? "", font, { size: 7.5 });
      });
      const sig = async (b: Box, nome: string | null | undefined, img: Awaited<ReturnType<typeof embedImg>>) => {
        const nomeBox = { x: b.x, top: b.top + b.h - 10, w: b.w, h: 10 };
        if (img) {
          const area = { x: b.x, top: b.top, w: b.w, h: b.h - (nome ? 10 : 0) };
          const sc = Math.min((area.w - 4) / img.width, (area.h - 1) / img.height);
          const w = img.width * sc, h = img.height * sc;
          pg.drawImage(img, { x: crop.x + area.x + (area.w - w) / 2, y: crop.y + crop.height - area.top - area.h, width: w, height: h });
        }
        putBox(pg, nomeBox, nome, font, { size: 8, center: true });
      };
      await sig(B.sig_encarregado, p.encarregado, encImg);
      await sig(B.sig_sesmt, p.responsavelSesmt, sesImg);
      const meta = getTemplateMeta(DDS_TEMPLATE_CODIGO);
      const selo = `${DDS_TEMPLATE_CODIGO} · Rev.${String(meta?.revisao ?? 0).padStart(2, "0")} · folha ${f + 1}/${folhas} · emitido pelo SIGMO em ${new Date().toLocaleDateString("pt-BR")}`;
      pg.drawText(selo, { x: crop.x + 14, y: crop.y + 6, size: 5.2, font, color: rgb(0.45, 0.45, 0.45) });
    }
  }
  if (temVerso) {
    const [v] = await out.copyPages(src, [1]);
    out.addPage(v);
  }
  return await out.save();
}
