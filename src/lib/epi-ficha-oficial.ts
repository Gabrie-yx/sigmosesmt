import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { loadTemplateBytes } from "@/lib/pdf-overlay-engine";

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
};

const PAGE_H = 595.2;
const ROWS_PER_PAGE = 17;
const ROW_TOP0 = 55.0;
const ROW_H = 21.0;

/** Colunas da grade (x0, x1) medidas no PDF oficial. */
const COL = {
  qt: [10, 36],
  und: [36, 62],
  espec: [62, 222],
  ca: [222, 280],
  assEmp: [280, 420],
  dataEntrega: [420, 470],
  motivo: [470, 530],
  dataDevol: [530, 595],
  assReceb: [595, 665],
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
  const m = raw.match(/motivo\s*:\s*([^—\-\n]+)/i);
  const key = (m ? m[1] : raw).trim().toLowerCase();
  return MOTIVO_CODE[key] ?? (m ? m[1].trim() : raw);
}

function fit(text: string, font: PDFFont, size: number, maxW: number) {
  if (!text) return "";
  if (font.widthOfTextAtSize(text, size) <= maxW) return text;
  let out = text;
  while (out.length > 1 && font.widthOfTextAtSize(out + "…", size) > maxW) out = out.slice(0, -1);
  return out + "…";
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
  opts: { x: number; top: number; maxW: number; size?: number; font: PDFFont; center?: boolean },
) {
  const t = safe(String(text ?? "")).trim();
  if (!t) return;
  const size = opts.size ?? 9;
  const shown = fit(t, opts.font, size, opts.maxW);
  const w = opts.font.widthOfTextAtSize(shown, size);
  const x = opts.center ? opts.x + (opts.maxW - w) / 2 : opts.x;
  page.drawText(shown, { x, y: PAGE_H - opts.top, size, font: opts.font, color: rgb(0, 0, 0) });
}

async function embedSignature(pdf: PDFDocument, dataUrl: string) {
  try {
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

export async function buildFichaOficialBytes(blocks: FichaOficialBlock[]): Promise<Uint8Array> {
  if (!blocks.length) throw new Error("Nenhuma ficha para gerar.");
  const templateBytes = await loadTemplateBytes("FOR-SEG-02");
  const template = await PDFDocument.load(templateBytes);
  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  const bold = await out.embedFont(StandardFonts.HelveticaBold);

  for (const block of blocks) {
    const chunks: FichaOficialEntrega[][] = [];
    for (let i = 0; i < Math.max(block.entregas.length, 1); i += ROWS_PER_PAGE) {
      chunks.push(block.entregas.slice(i, i + ROWS_PER_PAGE));
    }

    for (let c = 0; c < chunks.length; c++) {
      const [p1, p2] = await out.copyPages(template, [0, 1]);
      out.addPage(p1);
      out.addPage(p2);

      const e = block.emp;
      // Cabeçalho (página 1) - Reajustado conforme Rev. 06/08/2026 e orientações visuais
      drawText(p1, e.empresa, { x: 52, top: 101, maxW: 465, size: 9, font: bold });
      drawText(p1, brDate(e.admissao), { x: 546, top: 101, maxW: 170, size: 9, font });
      drawText(p1, e.nome, { x: 38, top: 123, maxW: 480, size: 9, font: bold });
      if (e.demissao) drawText(p1, brDate(e.demissao), { x: 546, top: 123, maxW: 74, size: 9, font });
      drawText(p1, e.funcao, { x: 43, top: 148, maxW: 200, size: 9, font });
      drawText(p1, e.matricula, { x: 309, top: 148, maxW: 180, size: 9, font });
      drawText(p1, `${c + 1}/${chunks.length}`, { x: 536, top: 148, maxW: 60, size: 9, font });
      // Nome da empresa dentro do termo de responsabilidade
      drawText(p1, e.empresa, { x: 236, top: 191.5, maxW: 168, size: 7.5, font, center: true });
      // Local e data
      drawText(p1, block.localData, { x: 84, top: 624, maxW: 200, size: 9, font });

      // Grade de entregas (página 2)
      const rows = chunks[c];
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const top = ROW_TOP0 + ROW_H * i + 13.5;
        const cell = (col: readonly [number, number] | number[], text: string, size = 6.5, center = true) =>
          drawText(p2, text, { x: col[0] + 1, top, maxW: col[1] - col[0] - 2, size, font, center });

        cell(COL.qt, r.qtd != null ? String(r.qtd) : "");
        cell(COL.und, r.und ?? "UN");
        drawText(p2, [r.item, r.tamanho ? `(${r.tamanho})` : ""].filter(Boolean).join(" "), {
          x: COL.espec[0] + 2, top, maxW: COL.espec[1] - COL.espec[0] - 4, size: 6.5, font,
        });
        cell(COL.ca, r.ca ?? "");
        cell(COL.dataEntrega, brDate(r.data_entrega));
        cell(COL.motivo, motivoCurto(r), 7);
        cell(COL.dataDevol, brDate(r.data_devolucao));

        if (r.assinatura_snapshot) {
          const img = await embedSignature(out, r.assinatura_snapshot);
          if (img) {
            const boxW = COL.assEmp[1] - COL.assEmp[0] - 8;
            const boxH = ROW_H - 6;
            const scale = Math.min(boxW / img.width, boxH / img.height);
            const w = img.width * scale;
            const h = img.height * scale;
            p2.drawImage(img, {
              x: COL.assEmp[0] + (COL.assEmp[1] - COL.assEmp[0] - w) / 2,
              y: PAGE_H - (ROW_TOP0 + ROW_H * (i + 1)) + (ROW_H - h) / 2,
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