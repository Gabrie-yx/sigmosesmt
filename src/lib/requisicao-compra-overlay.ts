import type jsPDF from "jspdf";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage } from "pdf-lib";
import { loadTemplateBytes, getTemplateMeta } from "@/lib/pdf-overlay-engine";
import { getTemplateSchema, isBoxMap, type BoxMap, type Box } from "@/lib/template-field-schemas";
import type { RcPdfReq, RcPdfItem, RcPdfCotacao } from "./requisicao-compra-pdf";

/** Código do PDF-mãe da RC no painel de Templates Homologados. */
export const RC_TEMPLATE_CODIGO = "FOR-SEG-03";

function fmtBR(d?: string | null) {
  if (!d) return "";
  const [y, m, day] = d.split("T")[0].split("-");
  return day && m && y ? `${day}/${m}/${y}` : d;
}

function fit(t: string, f: PDFFont, size: number, maxW: number) {
  if (!t) return "";
  if (f.widthOfTextAtSize(t, size) <= maxW) return t;
  let lo = 0, hi = t.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (f.widthOfTextAtSize(t.slice(0, mid) + "...", size) <= maxW) lo = mid; else hi = mid - 1;
  }
  return t.slice(0, lo) + "...";
}

/** Lê os números impressos na coluna ITEM: cada linha pode ter altura diferente. */
async function lerCentrosLinhas(bytes: Uint8Array, coluna: Box, primeira: Box, ultima: Box): Promise<number[]> {
  const pdfjs = await import("pdfjs-dist");
  // @ts-ignore — Vite entrega o worker como URL na versão usada pelo projeto.
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  try {
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const numeros = content.items.flatMap((item) => {
      if (!("str" in item) || !/^\d{1,3}$/.test(item.str.trim())) return [];
      const [x, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
      if (x < coluna.x - 2 || x > coluna.x + coluna.w + 2 || y < primeira.top || y > ultima.top + ultima.h + 4) return [];
      return [{ n: Number(item.str.trim()), y }];
    }).sort((a, b) => a.n - b.n);
    if (numeros.length < 2 || numeros[0].n !== 1 || numeros.some((v, i) => v.n !== i + 1) || (numeros.at(-1)?.y ?? 0) < ultima.top) {
      throw new Error("Não foi possível identificar as linhas numeradas do formulário.");
    }
    // A primeira caixa revisada fixa o centro da linha 1; diferenças entre as
    // linhas vêm do próprio PDF, sem presumir altura uniforme ou contar por h.
    return numeros.map((v) => primeira.top + primeira.h / 2 + v.y - numeros[0].y);
  } finally {
    doc.destroy();
  }
}

async function embedImage(pdf: PDFDocument, src?: string | null): Promise<PDFImage | null> {
  if (!src) return null;
  try {
    const buf = new Uint8Array(await (await fetch(src)).arrayBuffer());
    const isPng = buf[0] === 0x89 && buf[1] === 0x50;
    return isPng ? await pdf.embedPng(buf) : await pdf.embedJpg(buf);
  } catch {
    return null;
  }
}

/**
 * Usa o mapa salvo na revisão; escala se o tamanho da página for diferente.
 * Sem mapa salvo, usa o padrão só se a página tiver o mesmo tamanho do PDF medido.
 */
export function resolveMap(saved: unknown, pageW: number, pageH: number): BoxMap {
  const def = getTemplateSchema(RC_TEMPLATE_CODIGO)!.defaultMap!;
  const sameAsDefault = Math.abs(def.pageW - pageW) < 1 && Math.abs(def.pageH - pageH) < 1;
  const scale = (m: BoxMap): BoxMap => {
    const sx = pageW / m.pageW, sy = pageH / m.pageH;
    const boxes: Record<string, Box> = {};
    for (const [k, b] of Object.entries(m.boxes)) boxes[k] = { x: b.x * sx, top: b.top * sy, w: b.w * sx, h: b.h * sy };
    return { pageW, pageH, boxes };
  };
  if (isBoxMap(saved) && Object.keys(saved.boxes).length > 0) {
    const m = scale(saved);
    if (sameAsDefault) for (const [k, b] of Object.entries(def.boxes)) m.boxes[k] ??= b;
    return m;
  }
  if (sameAsDefault) return def;
  throw new Error("Revisão do FOR-SEG-03 sem mapeamento de campos — abra o painel de Templates.");
}

export async function gerarRcOverlayBytes(
  req: RcPdfReq,
  itens: RcPdfItem[],
  cotacoes: RcPdfCotacao[],
  statusLabel: string,
): Promise<Uint8Array> {
  const tplBytes = await loadTemplateBytes(RC_TEMPLATE_CODIGO);
  const tpl = await PDFDocument.load(tplBytes);
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0, 0, 0);

  // Mapa da revisão emitida (gerado por IA/ajustado no painel) → senão o padrão medido.
  const pageSize = tpl.getPage(0).getCropBox();
  const map = resolveMap(getTemplateMeta(RC_TEMPLATE_CODIGO)?.overlayMap, pageSize.width, pageSize.height);
  const B = (k: string): Box | null => map.boxes[k] ?? null;

  const rf = B("row_first"), rl = B("row_last"), colItem = B("col_item");
  if (!rf || !rl || !colItem) throw new Error("Mapeamento das linhas da requisição incompleto.");
  const centros = await lerCentrosLinhas(tplBytes, colItem, rf, rl);
  const perPage = centros.length;

  const sorted = [...itens].sort((a, b) => (a.item_numero ?? 0) - (b.item_numero ?? 0));
  const pages = Math.max(1, Math.ceil(sorted.length / perPage));

  const [solImg, supImg] = await Promise.all([
    embedImage(pdf, req.signature_solicitante),
    embedImage(pdf, req.decidido_assinatura_url),
  ]);

  for (let p = 0; p < pages; p++) {
    const [page] = await pdf.copyPages(tpl, [0]);
    pdf.addPage(page);
    // Caixas são medidas na imagem da CropBox, cuja origem pode NÃO ser (0,0).
    // O PDF exportado pelo Excel usa MediaBox/CropBox com x=-8.39, y=+8.39.
    const crop = page.getCropBox();
    const X = (x: number) => crop.x + x;
    const Y = (top: number) => crop.y + crop.height - top;
    const inBox = (v: string | null | undefined, b: Box | null, size = 8, f = font, c?: number) => {
      if (!v || !b) return;
      const cy = c ?? b.top + b.h / 2;
      page.drawText(fit(String(v), f, size, b.w - 4), { x: X(b.x + 2), y: Y(cy) - size * 0.35, size, font: f, color: black });
    };

    // Cabeçalho
    inBox(fmtBR(req.data_requisicao), B("data"));
    inBox(req.numero, B("numero"), 8, bold);
    inBox(req.solicitante, B("solicitante"));
    inBox(req.setor, B("setor"));
    inBox(req.fornecedor, B("fornecedor"));
    inBox(req.obra_construcao, B("obra_construcao"));
    inBox(req.obra_manutencao, B("obra_manutencao"));

    const mark = B(req.classificacao === "SERVICO" ? "chk_servico" : "chk_material");
    if (mark) {
      const size = Math.max(5, Math.min(8, mark.h));
      const mw = bold.widthOfTextAtSize("X", size);
      page.drawText("X", { x: X(mark.x + mark.w / 2 - mw / 2), y: Y(mark.top + mark.h / 2) - size * 0.35, size, font: bold, color: black });
    }

    // Itens
    const slice = sorted.slice(p * perPage, (p + 1) * perPage);
    if (p > 0) {
      // renumera a coluna ITEM nas páginas de continuação (11, 12, ...)
      for (let i = 0; i < perPage; i++) {
        const c = centros[i];
        const upper = i === 0 ? rf.top : (centros[i - 1] + c) / 2;
        const lower = i === perPage - 1 ? rl.top + rl.h : (c + centros[i + 1]) / 2;
        page.drawRectangle({ x: X(colItem.x + 1.5), y: Y(lower - 1.5), width: colItem.w - 3, height: lower - upper - 3, color: rgb(1, 1, 1) });
        const t = String(p * perPage + i + 1).padStart(2, "0");
        page.drawText(t, { x: X(colItem.x + colItem.w / 2 - font.widthOfTextAtSize(t, 8) / 2), y: Y(c) - 2.8, size: 8, font, color: black });
      }
    }
    slice.forEach((it, i) => {
      const c = centros[i];
      inBox(it.descricao, B("col_desc"), 8, font, c);
      inBox(it.quantidade != null ? String(it.quantidade) : "", B("col_qtde"), 8, font, c);
      inBox(it.unidade, B("col_unid"), 8, font, c);
      inBox(it.observacao, B("col_obs"), 7, font, c);
    });

    // Assinaturas
    const drawSig = (img: PDFImage | null, b: Box | null, nome?: string | null) => {
      if (!b) return;
      const areaH = b.h - (nome ? 8 : 0);
      if (img) {
        const scale = Math.min((b.w - 20) / img.width, areaH / img.height);
        const w = img.width * scale, hh = img.height * scale;
        page.drawImage(img, { x: X(b.x + (b.w - w) / 2), y: Y(b.top + areaH) + (areaH - hh) / 2, width: w, height: hh });
      }
      if (nome) {
        const t = fit(nome, font, 6.5, b.w - 8);
        page.drawText(t, { x: X(b.x + (b.w - font.widthOfTextAtSize(t, 6.5)) / 2), y: Y(b.top + b.h) + 1, size: 6.5, font, color: black });
      }
    };
    drawSig(solImg, B("sig_solicitante"), req.solicitante);
    if (solImg) inBox(fmtBR(req.data_requisicao), B("data_solicitante"));
    if (supImg || req.decidido_por_nome) {
      drawSig(supImg, B("sig_supervisor"), req.decidido_por_nome);
      inBox(fmtBR(req.decidido_em), B("data_supervisor"));
    }
    if (req.cotador_nome) {
      drawSig(null, B("sig_compras"), req.cotador_nome);
      inBox(fmtBR(req.cotacao_at), B("data_compras"));
    }

    // Status + paginação
    const footY = 15;
    page.drawText(fit(`STATUS: ${statusLabel.toUpperCase()}`, bold, 6.5, 300), { x: X(10), y: crop.y + footY, size: 6.5, font: bold, color: black });
    if (pages > 1) page.drawText(`Pág. ${p + 1}/${pages}`, { x: X(crop.width - 50), y: crop.y + footY, size: 6.5, font, color: black });
  }

  // Página complementar: indeferimento e cotações
  const motivo = req.status === "INDEFERIDA" ? req.motivo_indeferimento : null;
  if (motivo || cotacoes.length > 0) {
    const tplSize = pdf.getPage(0).getSize();
    const page = pdf.addPage([tplSize.width, tplSize.height]);
    const H = tplSize.height;
    let y = H - 30;
    page.drawText(`Requisição Nº ${req.numero} — informações complementares`, { x: 20, y, size: 10, font: bold });
    y -= 20;
    if (motivo) {
      page.drawText("MOTIVO DO INDEFERIMENTO:", { x: 20, y, size: 8, font: bold, color: rgb(0.7, 0, 0) });
      y -= 12;
      for (const line of wrap(motivo, font, 8, tplSize.width - 40)) {
        page.drawText(line, { x: 20, y, size: 8, font });
        y -= 11;
      }
      y -= 10;
    }
    if (cotacoes.length > 0) {
      page.drawText("COTAÇÕES", { x: 20, y, size: 8, font: bold });
      y -= 14;
      const cols = [20, 40, 220, 300, 370, 470];
      ["#", "Fornecedor", "Valor", "Prazo", "Pagamento", "Frete"].forEach((t, i) =>
        page.drawText(t, { x: cols[i], y, size: 7.5, font: bold }));
      y -= 12;
      cotacoes.forEach((c, i) => {
        const f = c.is_vencedora ? bold : font;
        const vals = [
          String(i + 1),
          (c.is_vencedora ? "★ " : "") + c.fornecedor,
          c.valor != null ? c.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—",
          c.prazo_entrega_dias != null ? `${c.prazo_entrega_dias} dias` : "—",
          c.condicao_pagamento ?? "—",
          c.frete ?? "—",
        ];
        vals.forEach((v, j) => {
          const maxW = (cols[j + 1] ?? tplSize.width - 20) - cols[j] - 6;
          page.drawText(fit(v.replace("★", "*"), f, 7.5, maxW), { x: cols[j], y, size: 7.5, font: f });
        });
        y -= 11;
      });
    }
  }

  // Selo de rastreabilidade (ISO 9001 4.4)
  const meta = getTemplateMeta(RC_TEMPLATE_CODIGO);
  const rev = meta?.fonte === "painel" ? `Rev.${String(meta.revisao).padStart(2, "0")}` : "Rev. embarcada";
  const selo = `${RC_TEMPLATE_CODIGO} · ${rev} · emitido pelo SIGMO em ${new Date().toLocaleDateString("pt-BR")}`;
  for (const pg of pdf.getPages()) {
    pg.drawText(selo, { x: 300, y: 6, size: 5.2, font, color: rgb(0.45, 0.45, 0.45) });
  }

  return pdf.save();
}

function wrap(text: string, f: PDFFont, size: number, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\n/)) {
    let line = "";
    for (const w of para.split(/\s+/)) {
      const t = line ? `${line} ${w}` : w;
      if (f.widthOfTextAtSize(t, size) > maxW && line) { out.push(line); line = w; } else line = t;
    }
    out.push(line);
  }
  return out;
}

/**
 * Adapta os bytes do pdf-lib à pequena parte da API do jsPDF usada pelas telas
 * (preview, imprimir, baixar), pra não precisar mexer em nenhuma delas.
 */
export function wrapBytesAsJsPdf(bytes: Uint8Array): jsPDF {
  const ab = bytes.slice().buffer as ArrayBuffer;
  const blob = () => new Blob([ab], { type: "application/pdf" });
  const b64 = () => {
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  };
  const adapter = {
    output(type?: string) {
      switch (type) {
        case "arraybuffer": return ab;
        case "blob": return blob();
        case "bloburl": case "bloburi": return URL.createObjectURL(blob());
        case "datauristring": case "dataurlstring": return `data:application/pdf;base64,${b64()}`;
        default: {
          let bin = "";
          for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
          return bin;
        }
      }
    },
    save(name = "documento.pdf") {
      const url = URL.createObjectURL(blob());
      const a = document.createElement("a");
      a.href = url; a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    },
  };
  return adapter as unknown as jsPDF;
}
