import type jsPDF from "jspdf";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type PDFImage } from "pdf-lib";
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
    if (f.widthOfTextAtSize(t.slice(0, mid) + "…", size) <= maxW) lo = mid; else hi = mid - 1;
  }
  return t.slice(0, lo) + "…";
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
  const pageSize = tpl.getPage(0).getSize();
  const map = resolveMap(getTemplateMeta(RC_TEMPLATE_CODIGO)?.overlayMap, pageSize.width, pageSize.height);
  const B = (k: string): Box | null => map.boxes[k] ?? null;

  const rf = B("row_first"), rl = B("row_last");
  let perPage = 10, step = 20.5, rowTop0 = 175, rowH = 20.5;
  if (rf) {
    rowTop0 = rf.top; rowH = rf.h;
    if (rl && rl.top > rf.top) {
      perPage = Math.max(1, Math.round((rl.top - rf.top) / rf.h) + 1);
      step = perPage > 1 ? (rl.top - rf.top) / (perPage - 1) : rf.h;
    } else { perPage = 1; step = rf.h; }
  }

  const sorted = [...itens].sort((a, b) => (a.item_numero ?? 0) - (b.item_numero ?? 0));
  const pages = Math.max(1, Math.ceil(sorted.length / perPage));

  const [solImg, supImg] = await Promise.all([
    embedImage(pdf, req.signature_solicitante),
    embedImage(pdf, req.decidido_assinatura_url),
  ]);

  for (let p = 0; p < pages; p++) {
    const [page] = await pdf.copyPages(tpl, [0]);
    pdf.addPage(page);
    const H = page.getHeight();
    const inBox = (v: string | null | undefined, b: Box | null, size = 8, f = font, c?: number) => {
      if (!v || !b) return;
      const cy = c ?? b.top + b.h / 2;
      page.drawText(fit(String(v), f, size, b.w - 4), { x: b.x + 2, y: H - cy - size * 0.35, size, font: f, color: black });
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
      page.drawText("X", { x: mark.x + mark.w / 2 - mw / 2, y: H - (mark.top + mark.h / 2) - size * 0.35, size, font: bold, color: black });
    }

    // Itens
    const slice = sorted.slice(p * perPage, (p + 1) * perPage);
    const colItem = B("col_item");
    if (p > 0 && colItem) {
      // renumera a coluna ITEM nas páginas de continuação (11, 12, ...)
      for (let i = 0; i < perPage; i++) {
        const c = rowTop0 + i * step + rowH / 2;
        page.drawRectangle({ x: colItem.x + 1.5, y: H - c - rowH / 2 + 1.5, width: colItem.w - 3, height: rowH - 3, color: rgb(1, 1, 1) });
        const t = String(p * perPage + i + 1).padStart(2, "0");
        page.drawText(t, { x: colItem.x + colItem.w / 2 - font.widthOfTextAtSize(t, 8) / 2, y: H - c - 2.8, size: 8, font, color: black });
      }
    }
    slice.forEach((it, i) => {
      const c = rowTop0 + i * step + rowH / 2;
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
        page.drawImage(img, { x: b.x + (b.w - w) / 2, y: H - b.top - areaH + (areaH - hh) / 2, width: w, height: hh });
      }
      if (nome) {
        const t = fit(nome, font, 6.5, b.w - 8);
        page.drawText(t, { x: b.x + (b.w - font.widthOfTextAtSize(t, 6.5)) / 2, y: H - b.top - b.h + 1, size: 6.5, font, color: black });
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
    const footY = H - 15;
    page.drawText(fit(`STATUS: ${statusLabel.toUpperCase()}`, bold, 6.5, 300), { x: 10, y: footY, size: 6.5, font: bold, color: black });
    if (pages > 1) page.drawText(`Pág. ${p + 1}/${pages}`, { x: page.getWidth() - 50, y: footY, size: 6.5, font, color: black });
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
