import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { loadTemplateBytes, getTemplateMeta, clearTemplateCache } from "@/lib/pdf-overlay-engine";
import { getTemplateSchema, isBoxMap, type Box, type BoxMap } from "@/lib/template-field-schemas";
import { detectarMapaPdf } from "@/lib/template-map-detect";

export const FICHA_TEMPLATE_CODIGO = "FOR-SEG-02";

/** Mapa salvo completo da revisão; senão o próprio sistema lê o PDF na hora (sem IA). */
async function resolverMapaFicha(tplBytes: Uint8Array | ArrayBuffer, pageW: number, pageH: number): Promise<BoxMap | null> {
  const schema = getTemplateSchema(FICHA_TEMPLATE_CODIGO)!;
  const completo = (m: unknown): m is BoxMap => isBoxMap(m) && schema.fields.every((f) => (m as BoxMap).boxes[f.key]);
  const escalar = (m: BoxMap): BoxMap => {
    const sx = pageW / m.pageW, sy = pageH / m.pageH;
    const boxes: Record<string, Box> = {};
    for (const [k, b] of Object.entries(m.boxes)) boxes[k] = { x: b.x * sx, top: b.top * sy, w: b.w * sx, h: b.h * sy };
    return { pageW, pageH, boxes };
  };
  const salvo = getTemplateMeta(FICHA_TEMPLATE_CODIGO)?.overlayMap;
  if (completo(salvo)) return escalar(salvo);
  try {
    const r = await detectarMapaPdf(FICHA_TEMPLATE_CODIGO, new Uint8Array(tplBytes as ArrayBuffer).slice());
    if (completo(r.map)) return escalar(r.map);
  } catch (e) {
    console.warn("[Ficha EPI] detecção automática falhou:", e);
  }
  return null;
}

/** Escreve dentro de uma caixa do mapa (coordenadas da CropBox, origem topo-esquerda). */
function putBox(page: PDFPage, b: Box, text: string | null | undefined, font: PDFFont, o: { size?: number; center?: boolean; min?: number; lines?: number } = {}) {
  const t = safe(String(text ?? "")).replace(/\s+/g, " ").trim();
  if (!t) return;
  const crop = page.getCropBox();
  const pad = 2;
  const avail = b.w - pad * 2;
  let size = o.size ?? 9;
  const maxLines = o.lines ?? 1;
  const wrap = (sz: number) => {
    const out: string[] = [];
    let cur = "";
    for (const w of t.split(" ")) {
      const cand = cur ? cur + " " + w : w;
      if (font.widthOfTextAtSize(cand, sz) <= avail || !cur) cur = cand; else { out.push(cur); cur = w; }
    }
    if (cur) out.push(cur);
    return out;
  };
  let lines = wrap(size);
  while (size > (o.min ?? 5) && (lines.length > maxLines || lines.some((l) => font.widthOfTextAtSize(l, size) > avail) || lines.length * size * 1.1 > b.h)) {
    size -= 0.25;
    lines = wrap(size);
  }
  lines = lines.slice(0, maxLines);
  const lh = size * 1.1;
  const blockH = lines.length * lh;
  let top = b.top + (b.h - blockH) / 2;
  for (const l of lines) {
    const w = font.widthOfTextAtSize(l, size);
    const x = crop.x + b.x + (o.center ? (b.w - w) / 2 : pad);
    const baseline = top + size * 0.8;
    page.drawText(l, { x, y: crop.y + crop.height - baseline, size, font, color: rgb(0, 0, 0) });
    top += lh;
  }
}

async function putImage(out: PDFDocument, page: PDFPage, b: Box, src: string) {
  const img = await embedSignature(out, src);
  if (!img) return;
  const crop = page.getCropBox();
  const sc = Math.min((b.w - 4) / img.width, (b.h - 2) / img.height);
  const w = img.width * sc, h = img.height * sc;
  page.drawImage(img, { x: crop.x + b.x + (b.w - w) / 2, y: crop.y + crop.height - b.top - (b.h + h) / 2, width: w, height: h });
}

/**
 * Ficha de Entrega de EPI no PDF-mãe homologado (FOR-SEG 02, rev. 06/08/2026).
 * Nunca redesenha o formulário: baixa o template ativo do painel e estampa
 * apenas os campos variáveis nas coordenadas medidas no PDF oficial.
 *
 * Página 1 = termo de responsabilidade + cabeçalho do funcionário
 * Página 2 = grade de entregas (17 linhas). Acima disso, o par de páginas
 * é repetido (igual a papel: nova folha, mesmo termo).
 */

export type FichaOficialEmp = {
  nome?: string | null;
  matricula?: string | null;
  cpf?: string | null;
  funcao?: string | null;
  empresa?: string | null;
  admissao?: string | null;
  demissao?: string | null;
};

export type FichaOficialEntrega = {
  qtd?: number | null;
  item?: string | null;
  tamanho?: string | null;
  und?: string | null;
  ca?: string | null;
  data_entrega?: string | null;
  data_devolucao?: string | null;
  motivo?: string | null;
  observacoes?: string | null;
  assinatura_snapshot?: string | null;
};

export type FichaOficialBlock = {
  emp: FichaOficialEmp;
  entregas: FichaOficialEntrega[];
  /** Texto do campo "Local e Data" (ex.: "Belém, 30/07/2026"). */
  localData?: string | null;
  /** Assinatura do empregado (data URL ou URL pública) — campo da página 1. */
  assinaturaEmpregado?: string | null;
};

const PAGE_H = 595.2;
const ROWS_PER_PAGE = 15;
/** Grade medida no PDF-mãe (FOR-SEG 02 rev. 04/08/2026):
 *  cabeçalho da tabela termina em y=78,9 (do topo) e há 15 linhas de 23,37pt. */
const ROW_TOP0 = 78.9;
const ROW_H = 23.37;

/** Colunas da grade (x0, x1) — medidas nas linhas verticais do template. */
const COL = {
  qt: [10.1, 41.3],
  und: [41.3, 67.9],
  espec: [67.9, 232.0],
  ca: [232.0, 296.1],
  assEmp: [296.1, 451.4],
  dataEntrega: [451.4, 513.3],
  motivo: [513.3, 587.9],
  dataDevol: [587.9, 647.2],
  assReceb: [647.2, 769.1],
} as const;

const MOTIVO_CODE: Record<string, string> = {
  danificado: "1",
  "desgaste natural": "2",
  extravio: "3",
  "mal uso": "4",
  furto: "5",
  "uso temporário": "6",
  "uso temporario": "6",
  temporário: "6",
  temporario: "6",
};

function brDate(s?: string | null) {
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR");
}

function motivoCurto(e: FichaOficialEntrega): string {
  const raw = (e.motivo ?? e.observacoes ?? "").trim();
  if (!raw) return "";
  // Se for "Motivo: X" ou apenas "X", tenta mapear para o código numérico
  const m = raw.match(/motivo\s*:\s*([^—\-\n]+)/i);
  const key = (m ? m[1] : raw).trim().toLowerCase();
  return MOTIVO_CODE[key] ?? (m ? m[1].trim() : raw);
}

/** Remove caracteres fora do WinAnsi que quebram o embed das fontes padrão. */
function safe(text: string) {
  return (text ?? "").replace(/[\u0100-\uFFFF]/g, (c) => {
    const map: Record<string, string> = { "\u2018": "'", "\u2019": "'", "\u201C": '"', "\u201D": '"', "\u2013": "-", "\u2014": "-", "\u2026": "..." };
    return map[c] ?? "";
  });
}

function drawText(
  page: PDFPage,
  text: string | null | undefined,
  opts: { 
    x: number; 
    top: number; 
    maxW: number; 
    size?: number; 
    font: PDFFont; 
    center?: boolean;
    vCenterInRow?: boolean; // Se verdadeiro, 'top' é o topo da célula e centralizamos verticalmente
    rowH?: number;
    paddingX?: number;
    /** Reduz a fonte até o texto caber em UMA linha dentro de maxW. */
    shrinkToFit?: boolean;
    minSize?: number;
  },
) {
  const t = safe(String(text ?? "")).trim();
  if (!t) return;
  let size = opts.size ?? 9;
  const paddingX = opts.paddingX ?? 2;
  const avail = opts.maxW - paddingX * 2;

  if (opts.shrinkToFit) {
    const min = opts.minSize ?? 5.5;
    while (size > min && opts.font.widthOfTextAtSize(t, size) > avail) {
      size -= 0.25;
    }
  }

  const words = t.split(" ");
  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const w = words[i];
    const width = opts.font.widthOfTextAtSize(currentLine + " " + w, size);
    if (width < avail) {
      currentLine += " " + w;
    } else {
      lines.push(currentLine);
      currentLine = w;
    }
  }
  lines.push(currentLine);

  // Campos de linha única (cabeçalho/lacunas) não podem transbordar para a
  // linha de baixo e sobrepor o termo de responsabilidade.
  const maxLines = opts.shrinkToFit ? 1 : 3;

  const lineHeight = size * 1.1;
  const totalH = Math.min(lines.length, maxLines) * lineHeight;

  // O template tem MediaBox deslocado (origem != 0,0). Todas as coordenadas
  // deste arquivo são medidas a partir do canto superior esquerdo VISÍVEL.
  const box = page.getMediaBox();
  const topY = box.y + box.height;
  const ox = box.x;

  let startY: number;
  if (opts.vCenterInRow && opts.rowH) {
    // top é o topo da célula. Centraliza o bloco de texto na altura da linha.
    startY = topY - opts.top - (opts.rowH - totalH) / 2 - size;
  } else {
    // fallback para o comportamento antigo (baseline centralizada)
    startY = topY - opts.top + (totalH / 2) - size;
  }

  for (const line of lines.slice(0, maxLines)) {
    const w = opts.font.widthOfTextAtSize(line, size);
    const x = ox + (opts.center ? opts.x + (opts.maxW - w) / 2 : opts.x + paddingX);
    page.drawText(line, { x, y: startY, size, font: opts.font, color: rgb(0, 0, 0) });
    startY -= lineHeight;
  }
}


async function embedSignature(pdf: PDFDocument, dataUrl: string) {
  try {
    if (!dataUrl.startsWith("data:")) {
      const res = await fetch(dataUrl);
      if (!res.ok) return null;
      const buf = new Uint8Array(await res.arrayBuffer());
      const type = res.headers.get("content-type") ?? "";
      const png = type.includes("png") || (buf[0] === 0x89 && buf[1] === 0x50);
      return png ? await pdf.embedPng(buf) : await pdf.embedJpg(buf);
    }
    const isPng = dataUrl.includes("image/png");
    const b64 = dataUrl.split(",")[1] ?? "";
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return isPng ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
  } catch {
    return null;
  }
}

export async function buildFichaOficialBytes(
  blocks: FichaOficialBlock[],
  templateOverride?: ArrayBuffer | Uint8Array,
): Promise<Uint8Array> {
  if (!blocks.length) throw new Error("Nenhuma ficha para gerar.");
  if (!templateOverride) clearTemplateCache(FICHA_TEMPLATE_CODIGO);
  const templateBytes = templateOverride ?? (await loadTemplateBytes(FICHA_TEMPLATE_CODIGO));
  const template = await PDFDocument.load(templateBytes);
  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  const bold = await out.embedFont(StandardFonts.HelveticaBold);

  const crop0 = template.getPage(0).getCropBox();
  const map = template.getPageCount() >= 2 ? await resolverMapaFicha(templateBytes, crop0.width, crop0.height) : null;
  if (map) {
    const B = (k: string) => map.boxes[k];
    const rf = B("p2_row_first"), rl = B("p2_row_last");
    const nRows = Math.max(1, Math.round((rl.top - rf.top) / rf.h) + 1);
    const pitch = nRows > 1 ? (rl.top - rf.top) / (nRows - 1) : rf.h;
    for (const block of blocks) {
      const chunks: FichaOficialEntrega[][] = [];
      for (let i = 0; i < Math.max(block.entregas.length, 1); i += nRows) chunks.push(block.entregas.slice(i, i + nRows));
      for (let c = 0; c < chunks.length; c++) {
        const [p1, p2] = await out.copyPages(template, [0, 1]);
        out.addPage(p1);
        out.addPage(p2);
        const e = { ...block.emp, empresa: block.emp.empresa || "Estaleiro DMN" };
        putBox(p1, B("empresa"), e.empresa, bold);
        putBox(p1, B("admissao"), brDate(e.admissao), font);
        putBox(p1, B("nome"), e.nome, bold);
        if (e.demissao) {
          // Lacuna impressa "____/____/_____" (4+1+4+1+5 caracteres): cada parte no seu espaço.
          const [d, m, a] = brDate(e.demissao).split("/");
          const b = B("demissao"), u = b.w / 15;
          putBox(p1, { ...b, x: b.x, w: u * 4 }, d, font, { center: true });
          putBox(p1, { ...b, x: b.x + u * 5, w: u * 4 }, m, font, { center: true });
          putBox(p1, { ...b, x: b.x + u * 10, w: u * 5 }, a, font, { center: true });
        }
        putBox(p1, B("funcao"), e.funcao, font);
        putBox(p1, B("matricula"), e.matricula, font);
        putBox(p1, B("folha"), `${c + 1}/${chunks.length}`, font);
        putBox(p1, B("empresa_termo"), e.empresa, font, { size: 8, center: true });
        putBox(p1, B("local_data"), block.localData, font);
        if (block.assinaturaEmpregado) await putImage(out, p1, B("sig_empregado"), block.assinaturaEmpregado);
        const rows = chunks[c];
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          const top = rf.top + pitch * i;
          const cell = (k: string) => ({ ...B(k), top, h: rf.h });
          putBox(p2, cell("p2_col_qt"), r.qtd != null ? String(r.qtd) : "", font, { size: 8, center: true });
          putBox(p2, cell("p2_col_und"), r.und ?? "UN", font, { size: 8, center: true });
          putBox(p2, cell("p2_col_espec"), [r.item, r.tamanho ? `(${r.tamanho})` : ""].filter(Boolean).join(" "), font, { size: 7.5, lines: 2 });
          putBox(p2, cell("p2_col_ca"), r.ca ?? "", font, { size: 8, center: true });
          putBox(p2, cell("p2_col_data_entrega"), brDate(r.data_entrega), font, { size: 8, center: true });
          putBox(p2, cell("p2_col_motivo"), motivoCurto(r), font, { size: 8, center: true, lines: 2 });
          putBox(p2, cell("p2_col_data_devol"), brDate(r.data_devolucao), font, { size: 8, center: true });
          if (r.assinatura_snapshot) await putImage(out, p2, cell("p2_col_ass_emp"), r.assinatura_snapshot);
        }
      }
    }
    return await out.save();
  }
  // Plano B: coordenadas medidas à mão na rev. 04/08/2026 (só se o PDF não puder ser lido).

  for (const block of blocks) {
    const chunks: FichaOficialEntrega[][] = [];
    for (let i = 0; i < Math.max(block.entregas.length, 1); i += ROWS_PER_PAGE) {
      chunks.push(block.entregas.slice(i, i + ROWS_PER_PAGE));
    }

    for (let c = 0; c < chunks.length; c++) {
      const [p1, p2] = await out.copyPages(template, [0, 1]);
      out.addPage(p1);
      out.addPage(p2);

      // Empresa do cabeçalho = empregadora do funcionário (contratada).
      const e = { ...block.emp, empresa: block.emp.empresa || "Estaleiro DMN" };
      // Cabeçalho (página 1) — coordenadas medidas nos rótulos do PDF-mãe
      // (rev. 04/08/2026): Empresa/Data de Admissão em y 85 · Nome/Data de
      // Demissão em y 104,4 · Função/Matrícula/Folha em y 124.
      const R = 14.7;
      const fit = { shrinkToFit: true, vCenterInRow: true, rowH: R } as const;
      drawText(p1, e.empresa, { x: 69, top: 85, maxW: 395, size: 9, font: bold, ...fit });
      drawText(p1, brDate(e.admissao), { x: 582, top: 85, maxW: 92, size: 9, font, ...fit });
      drawText(p1, e.nome, { x: 62, top: 104.4, maxW: 402, size: 9, font: bold, ...fit });
      if (e.demissao) drawText(p1, brDate(e.demissao), { x: 576, top: 104.4, maxW: 95, size: 9, font, ...fit });
      drawText(p1, e.funcao, { x: 66, top: 123.8, maxW: 155, size: 8, font, ...fit });
      drawText(p1, e.matricula, { x: 297, top: 124, maxW: 140, size: 9, font, ...fit });
      // "Folha:" recebe a paginação da ficha (o campo PÁG. é fixo do template).
      drawText(p1, `${c + 1}/${chunks.length}`, { x: 487, top: 124, maxW: 60, size: 9, font, ...fit });
      // Lacuna "recebi da empresa ______," (x 221,4 → 359,6 / linha y 162,8)
      drawText(p1, "Estaleiro DMN", { x: 221.4, top: 162.8, maxW: 138, size: 8, minSize: 5, font, center: true, shrinkToFit: true, vCenterInRow: true, rowH: 12.1 });
      // "Local e Data:" (linha de x 75,6 a 261,2 / y 491,3)
      drawText(p1, block.localData, { x: 78, top: 491.3, maxW: 180, size: 9, font, vCenterInRow: true, rowH: 15.4 });

      // "Assinatura do Empregado: ____" (linha de x 392 a 616 / baseline y 100,4)
      if (block.assinaturaEmpregado) {
        const sig = await embedSignature(out, block.assinaturaEmpregado);
        if (sig) {
          const zoneX = 392, zoneW = 222, maxH = 34;
          const scale = Math.min(zoneW / sig.width, maxH / sig.height);
          const w = sig.width * scale;
          const h = sig.height * scale;
          p1.drawImage(sig, {
            x: zoneX + (zoneW - w) / 2,
            y: 102,
            width: w,
            height: h,
          });
        }
      }


      // O cabeçalho da tabela já existe no template — nunca redesenhar.
      // Grade de entregas (página 2)
      const rows = chunks[c];

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const rowTop = ROW_TOP0 + ROW_H * i;

        const cell = (col: readonly [number, number] | number[], text: string, size = 7.5, center = true, paddingX = 3) =>
          drawText(p2, text, {
            x: col[0],
            top: rowTop,
            maxW: col[1] - col[0],
            size,
            font,
            center,
            vCenterInRow: true,
            rowH: ROW_H,
            paddingX,
          });

        cell(COL.qt, r.qtd != null ? String(r.qtd) : "");
        cell(COL.und, r.und ?? "UN");
        cell(COL.espec, [r.item, r.tamanho ? `(${r.tamanho})` : ""].filter(Boolean).join(" "), 7, false, 4);
        cell(COL.ca, r.ca ?? "");
        cell(COL.dataEntrega, brDate(r.data_entrega));
        cell(COL.motivo, motivoCurto(r));
        cell(COL.dataDevol, brDate(r.data_devolucao));

        if (r.assinatura_snapshot) {
          const img = await embedSignature(out, r.assinatura_snapshot);
          if (img) {
            const box2 = p2.getMediaBox();
            const boxW = COL.assEmp[1] - COL.assEmp[0] - 8;
            const boxH = ROW_H - 6;
            const scale = Math.min(boxW / img.width, boxH / img.height);
            const w = img.width * scale;
            const h = img.height * scale;
            p2.drawImage(img, {
              x: box2.x + COL.assEmp[0] + (COL.assEmp[1] - COL.assEmp[0] - w) / 2,
              y: box2.y + box2.height - rowTop - (ROW_H + h) / 2,
              width: w,
              height: h,
            });
          }
        }
      }

    }
  }

  return await out.save();
}

/**
 * Adaptador mínimo com a interface que o PDFPreviewDialog consome
 * (output/save), permitindo exibir o PDF-mãe dentro do sistema.
 */
export function bytesToPreviewDoc(bytes: Uint8Array, fileName: string) {
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return {
    output: (type?: string) => (type === "blob" ? new Blob([buf as BlobPart], { type: "application/pdf" }) : buf),
    save: (name?: string) => {
      const url = URL.createObjectURL(new Blob([buf as BlobPart], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = name ?? fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  } as any;
}