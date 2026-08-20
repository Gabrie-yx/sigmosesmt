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
  },
) {
  const t = safe(String(text ?? "")).trim();
  if (!t) return;
  const size = opts.size ?? 9;
  const paddingX = opts.paddingX ?? 2;

  const words = t.split(" ");
  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const w = words[i];
    const width = opts.font.widthOfTextAtSize(currentLine + " " + w, size);
    if (width < opts.maxW - (paddingX * 2)) {
      currentLine += " " + w;
    } else {
      lines.push(currentLine);
      currentLine = w;
    }
  }
  lines.push(currentLine);

  const lineHeight = size * 1.1;
  const totalH = lines.length * lineHeight;
  
  let startY: number;
  if (opts.vCenterInRow && opts.rowH) {
    // top é o topo da célula. Centraliza o bloco de texto na altura da linha.
    startY = PAGE_H - opts.top - (opts.rowH - totalH) / 2 - size;
  } else {
    // fallback para o comportamento antigo (baseline centralizada)
    startY = PAGE_H - opts.top + (totalH / 2) - size;
  }

  for (const line of lines.slice(0, 3)) { // Permite até 3 linhas se couber
    const w = opts.font.widthOfTextAtSize(line, size);
    const x = opts.center ? opts.x + (opts.maxW - w) / 2 : opts.x + paddingX;
    page.drawText(line, { x, y: startY, size, font: opts.font, color: rgb(0, 0, 0) });
    startY -= lineHeight;
  }
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

      const e = { ...block.emp, empresa: "Estaleiro DMN" };
      // Cabeçalho (página 1) — coordenadas medidas nos rótulos do PDF-mãe.
      // Rótulos: Empresa: (x1 55,8 / base 99) · Nome: (x1 39,8 / base 121)
      //          Função: (x1 48,2 / base 143) · Matrícula: (x1 314,2) · Folha: (x1 540,6)
      //          Data de Admissão: (x1 629,4 / base 99) · Data de Demissão: (linha 662–747)
      drawText(p1, e.empresa, { x: 59, top: 99, maxW: 460, size: 9, font: bold, vCenterInRow: true, rowH: 15 });
      drawText(p1, brDate(e.admissao), { x: 634, top: 99, maxW: 100, size: 9, font, vCenterInRow: true, rowH: 15 });
      drawText(p1, e.nome, { x: 43, top: 121, maxW: 480, size: 9, font: bold, vCenterInRow: true, rowH: 15 });
      drawText(p1, e.funcao, { x: 52, top: 143, maxW: 200, size: 9, font, vCenterInRow: true, rowH: 15 });
      if (e.demissao) drawText(p1, brDate(e.demissao), { x: 667, top: 122.8, maxW: 78, size: 9, font, vCenterInRow: true, rowH: 15 });
      drawText(p1, e.matricula, { x: 318, top: 143.4, maxW: 180, size: 9, font, vCenterInRow: true, rowH: 15 });
      // "Folha:" recebe a paginação da ficha (o campo PÁG. é fixo do template).
      drawText(p1, `${c + 1}/${chunks.length}`, { x: 544, top: 143.4, maxW: 60, size: 9, font, vCenterInRow: true, rowH: 15 });
      // Lacuna "recebi da empresa ____" (underscores de x 249,6 a 408,2 / base 189)
      drawText(p1, e.empresa, { x: 250, top: 189, maxW: 158, size: 8, font, center: true, vCenterInRow: true, rowH: 12 });
      // "Local e Data:" (linha de x 78,8 a 290 / base 562,5)
      drawText(p1, block.localData, { x: 82, top: 562.5, maxW: 205, size: 9, font, vCenterInRow: true, rowH: 15 });


      // Adiciona cabeçalho cinza se for a primeira vez na página (grade de entregas)
      const headerTop = ROW_TOP0 - ROW_H;
      const drawHeader = (col: readonly [number, number] | number[], text: string) => {
        p2.drawRectangle({
          x: col[0],
          y: PAGE_H - headerTop - ROW_H,
          width: col[1] - col[0],
          height: ROW_H,
          color: GRAY_HEADER,
        });
        p2.drawRectangle({
          x: col[0],
          y: PAGE_H - headerTop - ROW_H,
          width: col[1] - col[0],
          height: ROW_H,
          borderColor: GRAY_BORDER,
          borderWidth: 0.5,
        });
        drawText(p2, text, { 
          x: col[0], 
          top: headerTop, 
          maxW: col[1] - col[0], 
          size: 7, 
          font: bold, 
          center: true, 
          vCenterInRow: true, 
          rowH: ROW_H 
        });
      };

      drawHeader(COL.qt, "QT");
      drawHeader(COL.und, "UND");
      drawHeader(COL.espec, "Especificação");
      drawHeader(COL.ca, "CA");
      drawHeader(COL.assEmp, "Assinatura");
      drawHeader(COL.dataEntrega, "Entrega");
      drawHeader(COL.motivo, "Mot.");
      drawHeader(COL.dataDevol, "Devolução");
      drawHeader(COL.assReceb, "Ass. Receb.");

      // Grade de entregas (página 2)
      const rows = chunks[c];

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const rowTop = ROW_TOP0 + ROW_H * i;
        
        const cell = (col: readonly [number, number] | number[], text: string, size = 7, center = true, paddingX = 2, isHeader = false) => {
          if (isHeader) {
            // Desenha o fundo cinza para o cabeçalho
            p2.drawRectangle({
              x: col[0],
              y: PAGE_H - rowTop - ROW_H,
              width: col[1] - col[0],
              height: ROW_H,
              color: GRAY_HEADER,
            });
            // Desenha as bordas
            p2.drawRectangle({
              x: col[0],
              y: PAGE_H - rowTop - ROW_H,
              width: col[1] - col[0],
              height: ROW_H,
              borderColor: GRAY_BORDER,
              borderWidth: 0.5,
            });
          }
          
          return drawText(p2, text, { 
            x: col[0], 
            top: rowTop, 
            maxW: col[1] - col[0], 
            size, 
            font: isHeader ? bold : font, 
            center, 
            vCenterInRow: true, 
            rowH: ROW_H,
            paddingX 
          });
        };


        cell(COL.qt, r.qtd != null ? String(r.qtd) : "");
        cell(COL.und, r.und ?? "UN");
        
        // Especificação com padding lateral de 10px e alinhamento à esquerda
        cell(COL.espec, [r.item, r.tamanho ? `(${r.tamanho})` : ""].filter(Boolean).join(" "), 7, false, 10);
        
        cell(COL.ca, r.ca ?? "");
        cell(COL.dataEntrega, brDate(r.data_entrega));
        cell(COL.motivo, motivoCurto(r));
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
              y: PAGE_H - rowTop - (ROW_H + h) / 2,
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