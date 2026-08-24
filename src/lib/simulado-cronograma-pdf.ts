// FOR-SEG 12 — Cronograma dos Simulados de Emergência (modelo homologado DMN).
// Layout fiel ao PDF original (A4 paisagem, 1 página): header com logo + bloco
// de código, grade ITEM/DESCRIÇÃO/LOCAL/AÇÃO PREPARATÓRIA/RESP + 12 meses,
// rodapé com "Elaborador:", "Aprovado gerente:" e legenda ○ ● ⊗.
import jsPDF from "jspdf";
import dmnLogo from "@/assets/dmn-logo.png";

/** Marcação de cada mês: vazio, planejado, realizado, transferido. */
export type MesMarca = "" | "P" | "R" | "T";

export type CronogramaLinha = {
  descricao: string;
  local?: string | null;
  acao_preparatoria?: string | null;
  responsavel?: string | null;
  meses: MesMarca[]; // 12 posições
};

export type CronogramaParams = {
  empresa: string;
  ano: number;
  revisao?: string;
  dataDocumento?: string; // ISO ou dd/mm/aaaa
  linhas: CronogramaLinha[];
  elaboradoPor?: string | null;
  elaboradoAssinatura?: string | null;
  aprovadoPor?: string | null;
  aprovadoAssinatura?: string | null;
};

export const MESES_ABREV = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

function fmtData(d?: string | null) {
  if (!d) return new Date().toLocaleDateString("pt-BR");
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
}

/** Desenha o símbolo da legenda no centro de uma célula. */
function drawMarca(doc: jsPDF, marca: MesMarca, cx: number, cy: number, r = 2.1) {
  if (!marca) return;
  doc.setLineWidth(0.3);
  doc.setDrawColor(0, 0, 0);
  if (marca === "R") {
    doc.setFillColor(0, 176, 80);
    doc.circle(cx, cy, r, "FD");
    return;
  }
  doc.setFillColor(255, 255, 255);
  doc.circle(cx, cy, r, "FD");
  if (marca === "T") {
    const k = r * 0.7;
    doc.line(cx - k, cy - k, cx + k, cy + k);
    doc.line(cx - k, cy + k, cx + k, cy - k);
  }
}

export function buildSimuladoCronogramaPdf(p: CronogramaParams): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 8;
  const RIGHT = W - M;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);

  // ===================== HEADER =====================
  const headerH = 20;
  doc.rect(M, M, W - 2 * M, headerH);
  const logoW = 42;
  const codeW = 46;
  doc.line(M + logoW, M, M + logoW, M + headerH);
  doc.line(RIGHT - codeW, M, RIGHT - codeW, M + headerH);

  try {
    doc.addImage(dmnLogo as unknown as string, "PNG", M + 4, M + 3, logoW - 8, headerH - 6, undefined, "FAST");
  } catch {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(178, 34, 34);
    doc.text("DMN", M + logoW / 2, M + headerH / 2 + 2, { align: "center" });
  }

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  const titulo = `CRONOGRAMA DOS SIMULADOS DE EMERGÊNCIA ${p.empresa.toUpperCase()} ${p.ano}`;
  const tituloX = M + logoW + (RIGHT - codeW - (M + logoW)) / 2;
  const tituloLinhas = doc.splitTextToSize(titulo, RIGHT - codeW - (M + logoW) - 6) as string[];
  const t0 = M + headerH / 2 - ((tituloLinhas.length - 1) * 5) / 2 + 1.6;
  tituloLinhas.forEach((l, i) => doc.text(l, tituloX, t0 + i * 5, { align: "center" }));

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const lh = headerH / 4;
  const cx = RIGHT - codeW + 2;
  doc.text("FOR-SEG 12", cx, M + lh - 1.2);
  doc.text(`REVISÃO: ${p.revisao ?? "00"}`, cx, M + lh * 2 - 1.2);
  doc.text(`DATA: ${fmtData(p.dataDocumento)}`, cx, M + lh * 3 - 1.2);
  doc.text("PÁG. 01/01", cx, M + lh * 4 - 1.2);

  // ===================== GRADE =====================
  const footerH = 26;
  const tableTop = M + headerH;
  const tableBottom = H - M - footerH;
  const headRowH = 11;

  const colItem = 13;
  const colDesc = 44;
  const colLocal = 26;
  const colAcao = 54;
  const colResp = 38;
  const fixedW = colItem + colDesc + colLocal + colAcao + colResp;
  const mesesW = W - 2 * M - fixedW;
  const mesW = mesesW / 12;

  const xItem = M;
  const xDesc = xItem + colItem;
  const xLocal = xDesc + colDesc;
  const xAcao = xLocal + colLocal;
  const xResp = xAcao + colAcao;
  const xMeses = xResp + colResp;

  // cabeçalho cinza
  doc.setFillColor(191, 191, 191);
  doc.rect(M, tableTop, W - 2 * M, headRowH, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);

  const midY = tableTop + headRowH / 2;
  const put = (txt: string, x0: number, w: number, y: number) => {
    const lines = doc.splitTextToSize(txt, w - 2) as string[];
    const y0 = y - ((lines.length - 1) * 3) / 2;
    lines.forEach((l, i) => doc.text(l, x0 + w / 2, y0 + i * 3 + 1, { align: "center" }));
  };
  put("ITEM", xItem, colItem, midY);
  put("DESCRIÇÃO DO SIMULADO", xDesc, colDesc, midY);
  put("LOCAL", xLocal, colLocal, midY);
  put("AÇÃO PREPARATÓRIA", xAcao, colAcao, midY);
  put("RESP:", xResp, colResp, midY);
  put("MESES", xMeses, mesesW, tableTop + headRowH / 4);

  // linha divisória do bloco MESES + siglas
  doc.line(xMeses, tableTop + headRowH / 2, RIGHT, tableTop + headRowH / 2);
  MESES_ABREV.forEach((mm, i) => {
    doc.text(mm, xMeses + mesW * i + mesW / 2, tableTop + headRowH - 2.6, { align: "center" });
  });

  // colunas verticais do cabeçalho
  [xDesc, xLocal, xAcao, xResp, xMeses].forEach((x) => doc.line(x, tableTop, x, tableTop + headRowH));
  for (let i = 1; i < 12; i++) {
    const x = xMeses + mesW * i;
    doc.line(x, tableTop + headRowH / 2, x, tableTop + headRowH);
  }

  // corpo
  const linhas = p.linhas.length ? p.linhas : [];
  const bodyTop = tableTop + headRowH;
  const bodyH = tableBottom - bodyTop;
  const rowH = linhas.length ? Math.min(34, bodyH / linhas.length) : bodyH;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);

  linhas.forEach((l, idx) => {
    const y = bodyTop + rowH * idx;
    doc.rect(M, y, W - 2 * M, rowH);
    [xDesc, xLocal, xAcao, xResp, xMeses].forEach((x) => doc.line(x, y, x, y + rowH));
    for (let i = 1; i < 12; i++) doc.line(xMeses + mesW * i, y, xMeses + mesW * i, y + rowH);

    const cy = y + rowH / 2;
    put(String(idx + 1), xItem, colItem, cy);
    put(l.descricao ?? "", xDesc, colDesc, cy);
    put(l.local ?? "", xLocal, colLocal, cy);
    put(l.acao_preparatoria ?? "", xAcao, colAcao, cy);
    put(l.responsavel ?? "", xResp, colResp, cy);

    for (let i = 0; i < 12; i++) {
      drawMarca(doc, (l.meses?.[i] ?? "") as MesMarca, xMeses + mesW * i + mesW / 2, cy);
    }
  });

  // fecha o corpo até a base da tabela
  if (linhas.length) {
    const used = bodyTop + rowH * linhas.length;
    if (used < tableBottom) {
      doc.rect(M, used, W - 2 * M, tableBottom - used);
      [xDesc, xLocal, xAcao, xResp, xMeses].forEach((x) => doc.line(x, used, x, tableBottom));
    }
  }

  // ===================== RODAPÉ =====================
  const fTop = tableBottom;
  doc.rect(M, fTop, W - 2 * M, footerH);
  const legendaW = 58;
  const xLegenda = RIGHT - legendaW;
  const xAprov = M + (xLegenda - M) / 2;
  doc.line(xAprov, fTop, xAprov, fTop + footerH);
  doc.line(xLegenda, fTop, xLegenda, fTop + footerH);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("Elaborador:", M + (xAprov - M) / 2, fTop + 4.5, { align: "center" });
  doc.text("Aprovado gerente:", xAprov + (xLegenda - xAprov) / 2, fTop + 4.5, { align: "center" });

  const drawAss = (img: string | null | undefined, nome: string | null | undefined, x0: number, x1: number) => {
    const cxa = x0 + (x1 - x0) / 2;
    if (img) {
      try {
        const w = Math.min(52, x1 - x0 - 10);
        doc.addImage(img, "PNG", cxa - w / 2, fTop + 6, w, 12, undefined, "FAST");
      } catch { /* assinatura inválida — segue sem imagem */ }
    }
    if (nome) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.text(nome, cxa, fTop + footerH - 2.5, { align: "center" });
    }
  };
  drawAss(p.elaboradoAssinatura, p.elaboradoPor, M, xAprov);
  drawAss(p.aprovadoAssinatura, p.aprovadoPor, xAprov, xLegenda);

  // legenda
  const lx = xLegenda + 8;
  const ly = fTop + 6.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  ([["P", "PLANEJADO"], ["R", "REALIZADO"], ["T", "TRANSFERIDO"]] as const).forEach(([mk, lb], i) => {
    const y = ly + i * 6;
    drawMarca(doc, mk as MesMarca, lx, y, 2.1);
    doc.text(lb, lx + 5, y + 1.2);
  });

  return doc;
}
