import jsPDF from "jspdf";
import logoUrl from "@/assets/dmn-logo.png";

function br(d?: string | null) {
  if (!d) return "";
  const isoDate = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (isoDate) return `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}`;
  const x = new Date(d);
  return isNaN(x.getTime()) ? d : x.toLocaleDateString("pt-BR");
}

export interface NCData {
  numero?: string | null;
  titulo: string;
  descricao?: string | null;
  origem?: string | null;
  severidade?: string | null;
  status?: string | null;
  data_identificacao?: string | null;
  data_limite?: string | null;
  emitente?: string | null;
  departamento?: string | null;
  enviado_para?: string | null;
  classificacao?: string | null;
  requisito?: string | null;
  norma?: string | null;
  reincidente?: boolean | null;
  abrangencia?: string | null;
  porques?: { p1?: string; p2?: string; p3?: string; p4?: string; p5?: string } | null;
  acoes_imediatas_lista?: Array<{ acao: string; responsavel?: string; prazo?: string }> | null;
  acoes_corretivas_lista?: Array<{ acao: string; responsavel?: string; prazo?: string }> | null;
  acoes_implementadas?: boolean | null;
  data_implementacao?: string | null;
  novo_prazo?: string | null;
  comentarios_implementacao?: string | null;
  prazo_verificacao_eficacia?: string | null;
  eficaz?: boolean | null;
  comentarios_eficacia?: string | null;
  data_fechamento?: string | null;
  responsavel_fechamento?: string | null;
}

const C_HEADER: [number, number, number] = [248, 215, 218];
const C_BORDER: [number, number, number] = [145, 145, 145];
const C_BLUE_NOTE: [number, number, number] = [37, 99, 235];

// Modelo homologado em A4 paisagem.
const PAGE_W = 297;
const PAGE_H = 210;
const SIDE_X = 14;
const SIDE_W = 7;
const CONTENT_X = SIDE_X + SIDE_W;
const CONTENT_R = 287;
const CONTENT_W = CONTENT_R - CONTENT_X;
const HEADER_Y = 5;
const HEADER_H = 16;
const GRID_Y = 24;
const ROW = 5;
const SECTION_H = 5;

async function loadLogo(): Promise<string | null> {
  try {
    const r = await fetch(logoUrl);
    const b = await r.blob();
    return await new Promise((res) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result as string);
      fr.onerror = () => res(null);
      fr.readAsDataURL(b);
    });
  } catch {
    return null;
  }
}

type CellOptions = {
  fill?: [number, number, number] | false;
  bold?: boolean;
  italic?: boolean;
  fontSize?: number;
  align?: "left" | "center" | "right";
  valign?: "top" | "middle" | "bottom";
  color?: [number, number, number];
  pad?: number;
  line?: boolean;
  maxLines?: number;
};

function setTextStyle(doc: jsPDF, options: CellOptions = {}) {
  const fontStyle = options.bold ? "bold" : options.italic ? "italic" : "normal";
  doc.setFont("helvetica", fontStyle);
  doc.setFontSize(options.fontSize ?? 7.2);
  doc.setTextColor(...(options.color ?? [0, 0, 0]));
}

function fitLines(doc: jsPDF, text: string, width: number, options: CellOptions = {}) {
  const pad = options.pad ?? 1.2;
  const lines = doc.splitTextToSize(String(text ?? ""), Math.max(2, width - pad * 2)) as string[];
  if (!options.maxLines || lines.length <= options.maxLines) return lines;
  const clipped = lines.slice(0, options.maxLines);
  clipped[clipped.length - 1] = `${clipped[clipped.length - 1].replace(/\.{1,3}$/, "")}...`;
  return clipped;
}

function cell(doc: jsPDF, x: number, y: number, w: number, h: number, text = "", options: CellOptions = {}) {
  doc.setDrawColor(...C_BORDER);
  doc.setLineWidth(0.25);

  if (options.fill) {
    doc.setFillColor(...options.fill);
    doc.rect(x, y, w, h, "FD");
  } else if (options.line !== false) {
    doc.rect(x, y, w, h);
  }

  if (!text) return;

  setTextStyle(doc, options);
  const pad = options.pad ?? 1.2;
  const lines = fitLines(doc, text, w, options);
  const lineHeight = (options.fontSize ?? 7.2) * 0.34;
  const textHeight = Math.max(lineHeight, lines.length * lineHeight);
  const valign = options.valign ?? "middle";
  let textY = y + h / 2 - textHeight / 2 + lineHeight * 0.78;
  if (valign === "top") textY = y + pad + lineHeight * 0.75;
  if (valign === "bottom") textY = y + h - pad;

  const align = options.align ?? "left";
  const textX = align === "center" ? x + w / 2 : align === "right" ? x + w - pad : x + pad;
  doc.text(lines, textX, textY, { align, baseline: "alphabetic" });
}

function sectionBar(doc: jsPDF, y: number, text: string) {
  cell(doc, CONTENT_X, y, CONTENT_W, SECTION_H, text, {
    fill: C_HEADER,
    bold: true,
    align: "center",
    fontSize: 7.8,
  });
  return y + SECTION_H;
}

function drawHeader(doc: jsPDF, logo: string | null) {
  const x = SIDE_X;
  const w = CONTENT_R - SIDE_X;
  const logoW = 46;
  const metaW = 70;
  const titleW = w - logoW - metaW;

  doc.setDrawColor(...C_BORDER);
  doc.setLineWidth(0.35);
  doc.rect(x, HEADER_Y, w, HEADER_H);
  doc.line(x + logoW, HEADER_Y, x + logoW, HEADER_Y + HEADER_H);
  doc.line(x + logoW + titleW, HEADER_Y, x + logoW + titleW, HEADER_Y + HEADER_H);

  if (logo) {
    try {
      doc.addImage(logo, "PNG", x + 3, HEADER_Y + 1.6, 40, 12.8, undefined, "FAST");
    } catch {
      setTextStyle(doc, { bold: true, fontSize: 18, color: [190, 20, 25] });
      doc.text("DMN", x + logoW / 2, HEADER_Y + 10.5, { align: "center" });
    }
  } else {
    setTextStyle(doc, { bold: true, fontSize: 18, color: [190, 20, 25] });
    doc.text("DMN", x + logoW / 2, HEADER_Y + 10.5, { align: "center" });
  }

  setTextStyle(doc, { bold: true, fontSize: 12.5 });
  doc.text("Tratativa de Não Conformidade - TNC", x + logoW + titleW / 2, HEADER_Y + 10.2, { align: "center" });

  setTextStyle(doc, { fontSize: 7.2 });
  const mx = x + logoW + titleW + 3;
  doc.text("CÓD.: FORCP-SGI-05", mx, HEADER_Y + 3.4);
  doc.text("REVISÃO: 00", mx, HEADER_Y + 7.1);
  doc.text("DATA: 28/05/2025", mx, HEADER_Y + 10.8);
  doc.text("PÁG.: 1/1", mx, HEADER_Y + 14.5);
}

function drawSideBand(doc: jsPDF, yStart: number, yEnd: number, label: string) {
  doc.setFillColor(...C_HEADER);
  doc.setDrawColor(...C_BORDER);
  doc.setLineWidth(0.25);
  doc.rect(SIDE_X, yStart, SIDE_W, yEnd - yStart, "FD");
  setTextStyle(doc, { bold: true, fontSize: label.length > 12 ? 6 : 7.5 });
  doc.text(label, SIDE_X + SIDE_W / 2 + 0.5, (yStart + yEnd) / 2, {
    angle: 90,
    align: "center",
    baseline: "middle",
  });
}

function drawIdentification(doc: jsPDF, y: number, nc: NCData) {
  const c = [34, 65, 35, 54, 78];
  const x = CONTENT_X;

  cell(doc, x, y, 88, ROW, "IDENTIFICAÇÃO DA EMPRESA DO GRUPO:", { bold: true });
  cell(doc, x + 88, y, CONTENT_W - 88, ROW, "DMN Estaleiro");
  y += ROW;

  cell(doc, x, y, c[0], ROW, "Emitente:", { bold: true });
  cell(doc, x + c[0], y, c[1], ROW, nc.emitente ?? "");
  cell(doc, x + c[0] + c[1], y, c[2], ROW, "Data Abertura:", { bold: true });
  cell(doc, x + c[0] + c[1] + c[2], y, c[3], ROW, br(nc.data_identificacao));
  cell(doc, x + c[0] + c[1] + c[2] + c[3], y, c[4], ROW, `Nº TNC: ${nc.numero ?? ""}`, { bold: true, align: "center" });
  y += ROW;

  cell(doc, x, y, c[0], ROW, "Departamento:", { bold: true });
  cell(doc, x + c[0], y, c[1], ROW, nc.departamento ?? "");
  cell(doc, x + c[0] + c[1], y, c[2], ROW, "Enviado para:", { bold: true });
  cell(doc, x + c[0] + c[1] + c[2], y, c[3], ROW, nc.enviado_para ?? "");
  cell(doc, x + c[0] + c[1] + c[2] + c[3], y, c[4], ROW, "Origem da Ocorrência", { fill: C_HEADER, bold: true, align: "center" });
  y += ROW;

  const originX = x + c[0] + c[1] + c[2] + c[3];
  cell(doc, x, y, c[0], ROW, "Classificação:", { bold: true });
  cell(doc, x + c[0], y, c[1], ROW, nc.classificacao ?? "Não Conformidade");
  cell(doc, x + c[0] + c[1], y, c[2], ROW, "Requisito:", { bold: true });
  cell(doc, x + c[0] + c[1] + c[2], y, c[3], ROW, nc.requisito ?? "");
  cell(doc, originX, y, c[4], ROW * 2, nc.origem ?? "", { align: "center", fontSize: 7.8 });
  y += ROW;

  cell(doc, x, y, c[0], ROW, "Reincidente?", { bold: true });
  cell(doc, x + c[0], y, c[1], ROW, nc.reincidente == null ? "" : nc.reincidente ? "Sim" : "Não");
  cell(doc, x + c[0] + c[1], y, c[2], ROW, "Norma:", { bold: true });
  cell(doc, x + c[0] + c[1] + c[2], y, c[3], ROW, nc.norma ?? "ISO 9001:2015");
  y += ROW;

  return y;
}

function listRows<T>(items: T[] | null | undefined, count: number, mapper: (item: T) => string[]) {
  const rows = (items ?? []).slice(0, count).map(mapper);
  while (rows.length < count) rows.push(["", "", ""]);
  return rows;
}

function drawActionsTable(
  doc: jsPDF,
  y: number,
  title: string,
  rows: string[][],
  options: { titleRow?: boolean; rowHeight?: number } = {},
) {
  const actionW = 168;
  const respW = 62;
  const prazoW = CONTENT_W - actionW - respW;
  const rowH = options.rowHeight ?? 5;

  if (options.titleRow) {
    cell(doc, CONTENT_X, y, CONTENT_W, SECTION_H, title, { fill: C_HEADER, bold: true, align: "center", fontSize: 7.8 });
    y += SECTION_H;
    cell(doc, CONTENT_X, y, actionW, SECTION_H, "AÇÕES", { fill: C_HEADER, bold: true, align: "center", fontSize: 7.3 });
  } else {
    cell(doc, CONTENT_X, y, actionW, SECTION_H, title, { fill: C_HEADER, bold: true, align: "center", fontSize: 7.8 });
  }
  cell(doc, CONTENT_X + actionW, y, respW, SECTION_H, "RESPONSÁVEL", { fill: C_HEADER, bold: true, align: "center", fontSize: 7.3 });
  cell(doc, CONTENT_X + actionW + respW, y, prazoW, SECTION_H, "PRAZO", { fill: C_HEADER, bold: true, align: "center", fontSize: 7.3 });
  y += SECTION_H;

  rows.forEach((r) => {
    cell(doc, CONTENT_X, y, actionW, rowH, r[0], { fontSize: 7.1, maxLines: 2 });
    cell(doc, CONTENT_X + actionW, y, respW, rowH, r[1], { align: "center", fontSize: 7.1, maxLines: 1 });
    cell(doc, CONTENT_X + actionW + respW, y, prazoW, rowH, r[2], { align: "center", fontSize: 7.1, maxLines: 1 });
    y += rowH;
  });

  return y;
}

function drawImplementation(doc: jsPDF, y: number, nc: NCData) {
  const c1 = 80;
  const c2 = 34;
  const c3 = 34;
  const c4 = 22;
  const c5 = CONTENT_W - c1 - c2 - c3 - c4;

  cell(doc, CONTENT_X, y, c1, ROW, "As ações foram implementadas?", { bold: true });
  cell(doc, CONTENT_X + c1, y, c2, ROW, "SIM", { bold: true, align: "center" });
  cell(doc, CONTENT_X + c1 + c2, y, c3, ROW, "NÃO", { bold: true, align: "center" });
  cell(doc, CONTENT_X + c1 + c2 + c3, y, c4, ROW, "Data:", { bold: true });
  cell(doc, CONTENT_X + c1 + c2 + c3 + c4, y, c5, ROW, br(nc.data_implementacao) || nc.data_implementacao || "", { align: "center" });
  y += ROW;

  cell(doc, CONTENT_X, y, c1, 8, "");
  cell(doc, CONTENT_X + c1, y, c2, 8, nc.acoes_implementadas === true ? "X" : "", { bold: true, align: "center" });
  cell(doc, CONTENT_X + c1 + c2, y, c3, 8, nc.acoes_implementadas === false ? "X" : "", { bold: true, align: "center" });
  cell(doc, CONTENT_X + c1 + c2 + c3, y, c4, 8, "Novo\nPrazo:", { bold: true, valign: "middle", fontSize: 7 });
  cell(doc, CONTENT_X + c1 + c2 + c3 + c4, y, c5, 8, br(nc.novo_prazo) || nc.novo_prazo || "", { align: "center" });
  y += 8;

  cell(doc, CONTENT_X, y, 34, 8, "Comentários:", { bold: true });
  cell(doc, CONTENT_X + 34, y, CONTENT_W - 34, 8, nc.comentarios_implementacao ?? "", { fontSize: 7, maxLines: 2 });
  return y + 8;
}

function drawEffectiveness(doc: jsPDF, y: number, nc: NCData) {
  y = sectionBar(doc, y, "7- VERIFICAÇÃO DA EFICÁCIA");

  const labelW = 74;
  const colW = (CONTENT_W - labelW) / 4;
  cell(doc, CONTENT_X, y, labelW, ROW, "Prazo para verificação da Eficácia:", { bold: true });
  cell(doc, CONTENT_X + labelW, y, CONTENT_W - labelW, ROW, br(nc.prazo_verificacao_eficacia) || nc.prazo_verificacao_eficacia || "");
  y += ROW;

  cell(doc, CONTENT_X, y, labelW, ROW, "A Ação Corretiva foi eficaz?", { bold: true });
  cell(doc, CONTENT_X + labelW, y, colW, ROW, "SIM", { bold: true, align: "center" });
  cell(doc, CONTENT_X + labelW + colW, y, colW, ROW, nc.eficaz === true ? "X" : "", { bold: true, align: "center" });
  cell(doc, CONTENT_X + labelW + colW * 2, y, colW, ROW, "NÃO", { bold: true, align: "center" });
  cell(doc, CONTENT_X + labelW + colW * 3, y, colW, ROW, nc.eficaz === false ? "X" : "", { bold: true, align: "center" });
  y += ROW;

  cell(doc, CONTENT_X, y, labelW, ROW, "Comentários:", { bold: true });
  cell(doc, CONTENT_X + labelW, y, CONTENT_W - labelW, ROW, nc.comentarios_eficacia ?? "", { fontSize: 7, maxLines: 1 });
  y += ROW;

  cell(doc, CONTENT_X, y, labelW, ROW, "Data fechamento:", { bold: true });
  cell(doc, CONTENT_X + labelW, y, 54, ROW, br(nc.data_fechamento));
  cell(doc, CONTENT_X + labelW + 54, y, 52, ROW, "Responsável:", { bold: true });
  cell(doc, CONTENT_X + labelW + 106, y, CONTENT_W - labelW - 106, ROW, nc.responsavel_fechamento ?? "");
  return y + ROW;
}

export async function generateTNCPdf(nc: NCData): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: [PAGE_W, PAGE_H], orientation: "landscape" });
  const logo = await loadLogo();

  drawHeader(doc, logo);

  // ============ EMITENTE ============
  const emitenteStart = GRID_Y;
  let y = emitenteStart;
  y = sectionBar(doc, y, "1- ANÁLISE DA TRATATIVA");
  y = drawIdentification(doc, y, nc);

  y = sectionBar(doc, y, "2- DESCRIÇÃO DO PROBLEMA");
  cell(doc, CONTENT_X, y, CONTENT_W, 13, nc.descricao ?? "", { valign: "middle", fontSize: 7.2, maxLines: 4 });
  y += 13;
  drawSideBand(doc, emitenteStart, y, "EMITENTE");

  // ============ RECEPTOR ============
  const receptorStart = y;
  y = sectionBar(doc, y, "3- ABRANGÊNCIA DA NÃO CONFORMIDADE");
  cell(doc, CONTENT_X, y, CONTENT_W, 10, nc.abrangencia ?? "", { valign: "top", fontSize: 7.2, maxLines: 3 });
  y += 10;

  y = drawActionsTable(
    doc,
    y,
    "4- AÇÕES IMEDIATAS",
    listRows(nc.acoes_imediatas_lista, 3, (a) => [a.acao, a.responsavel ?? "", br(a.prazo) || a.prazo || ""]),
  );

  y = sectionBar(doc, y, "5- ANÁLISE DA CAUSA RAIZ");
  const p = nc.porques ?? {};
  const whyLabelW = 34;
  [
    ["1º Por que?", p.p1 ?? ""],
    ["2º Por que?", p.p2 ?? ""],
    ["3º Por que?", p.p3 ?? ""],
    ["4º Por que?", p.p4 ?? ""],
    ["5º Por que?", p.p5 ?? ""],
  ].forEach(([label, value]) => {
    cell(doc, CONTENT_X, y, whyLabelW, ROW, label, { bold: true });
    cell(doc, CONTENT_X + whyLabelW, y, CONTENT_W - whyLabelW, ROW, value, { fontSize: 7, maxLines: 1 });
    y += ROW;
  });

  setTextStyle(doc, { italic: true, fontSize: 6.2, color: C_BLUE_NOTE });
  doc.text(
    "Observação: pode utilizar anexos e relatórios complementares caso os campos deste formulário não sejam suficientes.",
    CONTENT_X + 1,
    y + 2.8,
  );
  doc.setTextColor(0);
  y += 4;
  drawSideBand(doc, receptorStart, y, "RECEPTOR");

  // ============ EMITENTE / RECEPTOR / SGI ============
  const sgiStart = y;

  y = drawActionsTable(
    doc,
    y,
    "6- AÇÕES CORRETIVAS",
    listRows(nc.acoes_corretivas_lista, 1, (a) => [a.acao, a.responsavel ?? "", br(a.prazo) || a.prazo || ""]),
    { titleRow: true, rowHeight: 5 },
  );

  y = drawImplementation(doc, y, nc);
  y = drawEffectiveness(doc, y, nc);
  drawSideBand(doc, sgiStart, y, "EMITENTE / RECEPTOR / SGI");

  const pageH = doc.internal.pageSize.getHeight();
  setTextStyle(doc, { fontSize: 6, color: [120, 120, 120] });
  doc.text("DMN Estaleiro · FORCP-SGI-05 · Revisão 00 · 28/05/2025", SIDE_X, pageH - 3);
  doc.text(`Emitido em ${new Date().toLocaleString("pt-BR")}`, CONTENT_R, pageH - 3, { align: "right" });

  return doc;
}

export async function downloadTNC(nc: NCData) {
  const doc = await generateTNCPdf(nc);
  doc.save(`TNC-${nc.numero ?? "rascunho"}.pdf`);
}

export async function printTNC(nc: NCData) {
  const doc = await generateTNCPdf(nc);
  doc.autoPrint();
  window.open(doc.output("bloburl"), "_blank");
}
