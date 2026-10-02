import type jsPDF from "jspdf";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type PDFImage } from "pdf-lib";
import { loadTemplateBytes, getTemplateMeta } from "@/lib/pdf-overlay-engine";
import type { RcPdfReq, RcPdfItem, RcPdfCotacao } from "./requisicao-compra-pdf";

/** Código do PDF-mãe da RC no painel de Templates Homologados. */
export const RC_TEMPLATE_CODIGO = "FOR-SEG-03";

/**
 * Coordenadas medidas no PDF-mãe (página 554.4 x 513.1 pt).
 * `c` = centro vertical da linha, medido a partir do topo.
 * Se uma nova revisão mudar o layout, ajuste só aqui.
 */
const MAP = {
  header: {
    data:        { x: 311, c: 84.2, maxW: 230 },
    numero:      { x: 364, c: 105.1, maxW: 178 },
    solicitante: { x: 72, c: 105.1, maxW: 205 },
    setor:       { x: 46, c: 123.8, maxW: 230 },
    fornecedor:  { x: 347, c: 123.8, maxW: 200 },
    obraConst:   { x: 118, c: 144, maxW: 162 },
    obraManut:   { x: 388, c: 144, maxW: 160 },
  },
  check: { material: { cx: 180.5, cy: 84.2 }, servico: { cx: 231.3, cy: 84.2 } },
  items: {
    firstC: 185, step: 20.52, perPage: 10,
    desc: { x: 52, maxW: 262 }, qtde: { x: 322.6, maxW: 46 },
    unid: { x: 373, maxW: 46 }, obs: { x: 425, maxW: 119 },
  },
  sig: {
    boxes: [{ x: 10, w: 179 }, { x: 190, w: 178 }, { x: 370, w: 177 }],
    top: 420, bottom: 470, dataC: 481.7,
    dataX: [40, 220, 400],
  },
};

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

  const sorted = [...itens].sort((a, b) => (a.item_numero ?? 0) - (b.item_numero ?? 0));
  const pages = Math.max(1, Math.ceil(sorted.length / MAP.items.perPage));

  const [solImg, supImg] = await Promise.all([
    embedImage(pdf, req.signature_solicitante),
    embedImage(pdf, req.decidido_assinatura_url),
  ]);

  for (let p = 0; p < pages; p++) {
    const [page] = await pdf.copyPages(tpl, [0]);
    pdf.addPage(page);
    const H = page.getHeight();
    const txt = (pg: PDFPage, v: string | null | undefined, x: number, c: number, maxW: number, size = 8, f = font) => {
      if (!v) return;
      pg.drawText(fit(String(v), f, size, maxW), { x, y: H - c - size * 0.35, size, font: f, color: black });
    };

    // Cabeçalho
    const h = MAP.header;
    txt(page, fmtBR(req.data_requisicao), h.data.x, h.data.c, h.data.maxW);
    txt(page, req.numero, h.numero.x, h.numero.c, h.numero.maxW, 8, bold);
    txt(page, req.solicitante, h.solicitante.x, h.solicitante.c, h.solicitante.maxW);
    txt(page, req.setor, h.setor.x, h.setor.c, h.setor.maxW);
    txt(page, req.fornecedor, h.fornecedor.x, h.fornecedor.c, h.fornecedor.maxW);
    txt(page, req.obra_construcao, h.obraConst.x, h.obraConst.c, h.obraConst.maxW);
    txt(page, req.obra_manutencao, h.obraManut.x, h.obraManut.c, h.obraManut.maxW);

    const mark = req.classificacao === "SERVICO" ? MAP.check.servico : MAP.check.material;
    const mw = bold.widthOfTextAtSize("X", 7);
    page.drawText("X", { x: mark.cx - mw / 2, y: H - mark.cy - 2.4, size: 7, font: bold, color: black });

    // Itens
    const slice = sorted.slice(p * MAP.items.perPage, (p + 1) * MAP.items.perPage);
    if (p > 0) {
      // renumera a coluna ITEM nas páginas de continuação (11, 12, ...)
      for (let i = 0; i < MAP.items.perPage; i++) {
        const c = MAP.items.firstC + i * MAP.items.step;
        page.drawRectangle({ x: 12, y: H - c - 6, width: 34, height: 12, color: rgb(1, 1, 1) });
        txt(page, String(p * MAP.items.perPage + i + 1).padStart(2, "0"), 20, c, 24);
      }
    }
    slice.forEach((it, i) => {
      const c = MAP.items.firstC + i * MAP.items.step;
      const m = MAP.items;
      txt(page, it.descricao, m.desc.x, c, m.desc.maxW);
      txt(page, it.quantidade != null ? String(it.quantidade) : "", m.qtde.x, c, m.qtde.maxW);
      txt(page, it.unidade, m.unid.x, c, m.unid.maxW);
      txt(page, it.observacao, m.obs.x, c, m.obs.maxW, 7);
    });

    // Assinaturas
    const s = MAP.sig;
    const drawSig = (img: PDFImage | null, idx: number, nome?: string | null) => {
      const b = s.boxes[idx];
      const areaH = s.bottom - s.top - (nome ? 8 : 0);
      if (img) {
        const scale = Math.min((b.w - 20) / img.width, areaH / img.height);
        const w = img.width * scale, hh = img.height * scale;
        page.drawImage(img, { x: b.x + (b.w - w) / 2, y: H - s.top - areaH + (areaH - hh) / 2, width: w, height: hh });
      }
      if (nome) {
        const t = fit(nome, font, 6.5, b.w - 8);
        page.drawText(t, { x: b.x + (b.w - font.widthOfTextAtSize(t, 6.5)) / 2, y: H - s.bottom + 1, size: 6.5, font, color: black });
      }
    };
    drawSig(solImg, 0, req.solicitante);
    txt(page, solImg ? fmtBR(req.data_requisicao) : "", s.dataX[0], s.dataC, 120);
    if (supImg || req.decidido_por_nome) {
      drawSig(supImg, 1, req.decidido_por_nome);
      txt(page, fmtBR(req.decidido_em), s.dataX[1], s.dataC, 120);
    }
    if (req.cotador_nome) {
      drawSig(null, 2, req.cotador_nome);
      txt(page, fmtBR(req.cotacao_at), s.dataX[2], s.dataC, 120);
    }

    // Status + paginação + selo
    txt(page, `STATUS: ${statusLabel.toUpperCase()}`, 10, 498, 300, 6.5, bold);
    if (pages > 1) txt(page, `Pág. ${p + 1}/${pages}`, 500, 498, 50, 6.5);
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
