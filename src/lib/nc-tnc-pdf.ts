import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoUrl from "@/assets/dmn-logo.png";

function br(d?: string | null) {
  if (!d) return "";
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

// Cores institucionais (rosa claro do formulário homologado)
const C_HEADER: [number, number, number] = [248, 215, 218];
const C_BORDER: [number, number, number] = [150, 150, 150];
const C_BLUE_NOTE: [number, number, number] = [37, 99, 235];

// Layout A4 (210 x 297) - tudo deve caber em 1 página
const PAGE_W = 210;
const SIDE_X = 10;
const SIDE_W = 5;
const CONTENT_X = SIDE_X + SIDE_W;
const CONTENT_R = PAGE_W - 8;
const CONTENT_W = CONTENT_R - CONTENT_X;

// estilos compactos compartilhados pelo autoTable
const TIGHT = {
  fontSize: 7,
  cellPadding: 0.6,
  lineColor: C_BORDER,
  textColor: 0,
  valign: "middle" as const,
  minCellHeight: 3.6,
};

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
  } catch { return null; }
}

function drawHeader(doc: jsPDF, logo: string | null, _numero: string) {
  const y = 5;
  const h = 13;
  doc.setDrawColor(...C_BORDER);
  doc.setLineWidth(0.3);
  doc.rect(SIDE_X, y, PAGE_W - SIDE_X - 8, h);
  doc.line(SIDE_X + 30, y, SIDE_X + 30, y + h);
  doc.line(150, y, 150, y + h);

  if (logo) {
    try { doc.addImage(logo, "PNG", SIDE_X + 1, y + 1.2, 26, 10.5, undefined, "FAST"); } catch {}
  } else {
    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text("DMN", SIDE_X + 14, y + 8, { align: "center" });
  }

  doc.setFont("helvetica", "bold"); doc.setFontSize(11.5);
  doc.setTextColor(0);
  doc.text("Tratativa de Não Conformidade - TNC", 92, y + 8, { align: "center" });

  doc.setFont("helvetica", "normal"); doc.setFontSize(6.5);
  const mx = 152;
  doc.text("CÓD.: FORCP-SGI-05", mx, y + 2.8);
  doc.text("REVISÃO: 00", mx, y + 6);
  doc.text("DATA: 28/05/2025", mx, y + 9.2);
  doc.text("PÁG.: 1/1", mx, y + 12.4);
}

function drawSideBand(doc: jsPDF, yStart: number, yEnd: number, label: string) {
  doc.setFillColor(...C_HEADER);
  doc.setDrawColor(...C_BORDER);
  doc.rect(SIDE_X, yStart, SIDE_W, yEnd - yStart, "FD");
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  const h = yEnd - yStart;
  // jsPDF angle=90 escreve de baixo para cima; usamos charWidth ~1.5mm @ size 7
  const approxCharW = 1.5;
  const needed = label.length * approxCharW;
  let fontSize = 7;
  if (needed > h - 2) fontSize = Math.max(5, Math.floor(((h - 2) / label.length) / 0.4));
  doc.setFontSize(fontSize);
  const cy = (yStart + yEnd) / 2;
  doc.text(label, SIDE_X + SIDE_W / 2 + 0.8, cy, { angle: 90, align: "center" });
}

function sectionBar(doc: jsPDF, y: number, text: string, x = CONTENT_X, w = CONTENT_W): number {
  const h = 4;
  doc.setFillColor(...C_HEADER);
  doc.setDrawColor(...C_BORDER);
  doc.rect(x, y, w, h, "FD");
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text(text, x + w / 2, y + 2.8, { align: "center" });
  return y + h;
}

export async function generateTNCPdf(nc: NCData): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const logo = await loadLogo();
  drawHeader(doc, logo, nc.numero ?? "");

  // ============ EMITENTE ============
  const emitenteStart = 20;
  let y = emitenteStart;

  // 1- ANÁLISE DA TRATATIVA
  y = sectionBar(doc, y, "1- ANÁLISE DA TRATATIVA");

  // Identificação empresa
  autoTable(doc, {
    startY: y,
    margin: { left: CONTENT_X, right: PAGE_W - CONTENT_R },
    theme: "grid",
    styles: { ...TIGHT },
    body: [[{ content: "IDENTIFICAÇÃO DA EMPRESA DO GRUPO: ", styles: { fontStyle: "bold" } } as any, "DMN Estaleiro"]],
    columnStyles: { 0: { cellWidth: 62 } },
  });
  y = (doc as any).lastAutoTable.finalY;

  const w1 = 24, w2 = 46, w3 = 24, w4 = 38;
  const w5 = CONTENT_W - (w1 + w2 + w3 + w4);

  autoTable(doc, {
    startY: y,
    margin: { left: CONTENT_X, right: PAGE_W - CONTENT_R },
    theme: "grid",
    styles: { ...TIGHT },
    body: [
      [
        { content: "Emitente:", styles: { fontStyle: "bold" } } as any,
        nc.emitente ?? "",
        { content: "Data Abertura:", styles: { fontStyle: "bold" } } as any,
        br(nc.data_identificacao),
        { content: `Nº TNC: ${nc.numero ?? ""}`, styles: { fontStyle: "bold", halign: "center" } } as any,
      ],
      [
        { content: "Departamento:", styles: { fontStyle: "bold" } } as any,
        nc.departamento ?? "",
        { content: "Enviado para:", styles: { fontStyle: "bold" } } as any,
        nc.enviado_para ?? "",
        { content: "Origem da Ocorrência", styles: { fontStyle: "bold", halign: "center", fillColor: C_HEADER } } as any,
      ],
      [
        { content: "Classificação:", styles: { fontStyle: "bold" } } as any,
        nc.classificacao ?? "Não Conformidade",
        { content: "Requisito:", styles: { fontStyle: "bold" } } as any,
        nc.requisito ?? "",
        { content: nc.origem ?? "", styles: { halign: "center", valign: "middle" }, rowSpan: 2 } as any,
      ],
      [
        { content: "Reincidente?", styles: { fontStyle: "bold" } } as any,
        nc.reincidente == null ? "" : nc.reincidente ? "Sim" : "Não",
        { content: "Norma:", styles: { fontStyle: "bold" } } as any,
        nc.norma ?? "ISO 9001:2015",
      ],
    ],
    columnStyles: {
      0: { cellWidth: w1 },
      1: { cellWidth: w2 },
      2: { cellWidth: w3 },
      3: { cellWidth: w4 },
      4: { cellWidth: w5 },
    },
  });
  y = (doc as any).lastAutoTable.finalY;

  // 2- DESCRIÇÃO DO PROBLEMA
  y = sectionBar(doc, y, "2- DESCRIÇÃO DO PROBLEMA");
  autoTable(doc, {
    startY: y, margin: { left: CONTENT_X, right: PAGE_W - CONTENT_R }, theme: "grid",
    styles: { ...TIGHT, minCellHeight: 10, cellPadding: 1.1 },
    body: [[nc.descricao ?? ""]],
  });
  y = (doc as any).lastAutoTable.finalY;

  drawSideBand(doc, emitenteStart, y, "EMITENTE");

  // ============ RECEPTOR ============
  const receptorStart = y;

  // 3- ABRANGÊNCIA
  y = sectionBar(doc, y, "3- ABRANGÊNCIA DA NÃO CONFORMIDADE");
  autoTable(doc, {
    startY: y, margin: { left: CONTENT_X, right: PAGE_W - CONTENT_R }, theme: "grid",
    styles: { ...TIGHT, minCellHeight: 8, cellPadding: 1.1 },
    body: [[nc.abrangencia ?? ""]],
  });
  y = (doc as any).lastAutoTable.finalY;

  // 4- AÇÕES IMEDIATAS
  const wAcao = CONTENT_W - 44 - 26;
  autoTable(doc, {
    startY: y, margin: { left: CONTENT_X, right: PAGE_W - CONTENT_R }, theme: "grid",
    head: [[
      { content: "4- AÇÕES IMEDIATAS", styles: { halign: "center", fillColor: C_HEADER, textColor: 0, fontStyle: "bold", fontSize: 7.5 } } as any,
      { content: "RESPONSÁVEL", styles: { halign: "center", fillColor: C_HEADER, textColor: 0, fontStyle: "bold", fontSize: 7.5 } } as any,
      { content: "PRAZO", styles: { halign: "center", fillColor: C_HEADER, textColor: 0, fontStyle: "bold", fontSize: 7.5 } } as any,
    ]],
    body: ((nc.acoes_imediatas_lista ?? []).length
      ? (nc.acoes_imediatas_lista ?? []).map(a => [a.acao, a.responsavel ?? "", br(a.prazo) || a.prazo || ""])
      : [["", "", ""]]),
    styles: { ...TIGHT },
    columnStyles: {
      0: { cellWidth: wAcao },
      1: { cellWidth: 44, halign: "center" },
      2: { cellWidth: 26, halign: "center" },
    },
  });
  y = (doc as any).lastAutoTable.finalY;

  // 5- ANÁLISE DA CAUSA RAIZ
  y = sectionBar(doc, y, "5- ANÁLISE DA CAUSA RAIZ");
  const p = nc.porques ?? {};
  autoTable(doc, {
    startY: y, margin: { left: CONTENT_X, right: PAGE_W - CONTENT_R }, theme: "grid",
    styles: { ...TIGHT },
    body: [
      [{ content: "1º Por que?", styles: { fontStyle: "bold" } } as any, p.p1 ?? ""],
      [{ content: "2º Por que?", styles: { fontStyle: "bold" } } as any, p.p2 ?? ""],
      [{ content: "3º Por que?", styles: { fontStyle: "bold" } } as any, p.p3 ?? ""],
      [{ content: "4º Por que?", styles: { fontStyle: "bold" } } as any, p.p4 ?? ""],
      [{ content: "5º Por que?", styles: { fontStyle: "bold" } } as any, p.p5 ?? ""],
    ],
    columnStyles: { 0: { cellWidth: 22 } },
  });
  y = (doc as any).lastAutoTable.finalY;

  // Observação em azul
  doc.setFont("helvetica", "italic");
  doc.setFontSize(6);
  doc.setTextColor(...C_BLUE_NOTE);
  doc.text(
    "Observação: pode utilizar anexos e relatórios complementares caso os campos deste formulário não sejam suficientes.",
    CONTENT_X + 1, y + 2.2,
  );
  doc.setTextColor(0);
  y += 3;

  // 6- AÇÕES CORRETIVAS
  autoTable(doc, {
    startY: y, margin: { left: CONTENT_X, right: PAGE_W - CONTENT_R }, theme: "grid",
    head: [
      [{ content: "6- AÇÕES CORRETIVAS", colSpan: 3, styles: { halign: "center", fillColor: C_HEADER, textColor: 0, fontStyle: "bold", fontSize: 7.5 } } as any],
      [
        { content: "AÇÕES", styles: { halign: "center", fillColor: C_HEADER, textColor: 0, fontStyle: "bold", fontSize: 7 } } as any,
        { content: "RESPONSÁVEL", styles: { halign: "center", fillColor: C_HEADER, textColor: 0, fontStyle: "bold", fontSize: 7 } } as any,
        { content: "PRAZO", styles: { halign: "center", fillColor: C_HEADER, textColor: 0, fontStyle: "bold", fontSize: 7 } } as any,
      ],
    ],
    body: ((nc.acoes_corretivas_lista ?? []).length
      ? (nc.acoes_corretivas_lista ?? []).map(a => [a.acao, a.responsavel ?? "", br(a.prazo) || a.prazo || ""])
      : [["", "", ""]]),
    styles: { ...TIGHT },
    columnStyles: {
      0: { cellWidth: wAcao },
      1: { cellWidth: 44, halign: "center" },
      2: { cellWidth: 26, halign: "center" },
    },
  });
  y = (doc as any).lastAutoTable.finalY;

  drawSideBand(doc, receptorStart, y, "RECEPTOR");

  // ============ EMITENTE / RECEPTOR / SGI ============
  const sgiStart = y;

  const cA = 52, cB = 22, cC = 22, cD = 14;
  const cE = CONTENT_W - (cA + cB + cC + cD);
  autoTable(doc, {
    startY: y, margin: { left: CONTENT_X, right: PAGE_W - CONTENT_R }, theme: "grid",
    styles: { ...TIGHT },
    body: [
      [
        { content: "As ações foram implementadas?", styles: { fontStyle: "bold" } } as any,
        { content: "SIM", styles: { halign: "center", fontStyle: "bold" } } as any,
        { content: "NÃO", styles: { halign: "center", fontStyle: "bold" } } as any,
        { content: "Data:", styles: { fontStyle: "bold" } } as any,
        { content: br(nc.data_implementacao) || nc.data_implementacao || "", styles: { halign: "center" } } as any,
      ],
      [
        "",
        { content: nc.acoes_implementadas === true ? "X" : "", styles: { halign: "center", fontStyle: "bold" } } as any,
        { content: nc.acoes_implementadas === false ? "X" : "", styles: { halign: "center", fontStyle: "bold" } } as any,
        { content: "Novo Prazo:", styles: { fontStyle: "bold" } } as any,
        { content: br(nc.novo_prazo) || nc.novo_prazo || "", styles: { halign: "center" } } as any,
      ],
    ],
    columnStyles: {
      0: { cellWidth: cA },
      1: { cellWidth: cB },
      2: { cellWidth: cC },
      3: { cellWidth: cD },
      4: { cellWidth: cE },
    },
  });
  y = (doc as any).lastAutoTable.finalY;

  // Comentários da implementação
  autoTable(doc, {
    startY: y, margin: { left: CONTENT_X, right: PAGE_W - CONTENT_R }, theme: "grid",
    styles: { ...TIGHT, minCellHeight: 6 },
    body: [
      [{ content: "Comentários:", styles: { fontStyle: "bold" } } as any,
       nc.comentarios_implementacao ?? ""],
    ],
    columnStyles: { 0: { cellWidth: 22 }, 1: { cellWidth: CONTENT_W - 22 } },
  });
  y = (doc as any).lastAutoTable.finalY;

  // 7- VERIFICAÇÃO DA EFICÁCIA
  y = sectionBar(doc, y, "7- VERIFICAÇÃO DA EFICÁCIA");

  autoTable(doc, {
    startY: y, margin: { left: CONTENT_X, right: PAGE_W - CONTENT_R }, theme: "grid",
    styles: { ...TIGHT },
    body: [
      [{ content: "Prazo para verificação da Eficácia:", styles: { fontStyle: "bold" } } as any,
       { content: br(nc.prazo_verificacao_eficacia) || nc.prazo_verificacao_eficacia || "", colSpan: 4 } as any],
      [
        { content: "A Ação Corretiva foi eficaz?", styles: { fontStyle: "bold" } } as any,
        { content: "SIM", styles: { halign: "center", fontStyle: "bold" } } as any,
        { content: nc.eficaz === true ? "X" : "", styles: { halign: "center", fontStyle: "bold" } } as any,
        { content: "NÃO", styles: { halign: "center", fontStyle: "bold" } } as any,
        { content: nc.eficaz === false ? "X" : "", styles: { halign: "center", fontStyle: "bold" } } as any,
      ],
      [{ content: "Comentários:", styles: { fontStyle: "bold" } } as any,
       { content: nc.comentarios_eficacia ?? "", colSpan: 4 } as any],
      [
        { content: "Data fechamento:", styles: { fontStyle: "bold" } } as any,
        { content: br(nc.data_fechamento), styles: { halign: "center" } } as any,
        { content: "Responsável:", styles: { fontStyle: "bold" } } as any,
        { content: nc.responsavel_fechamento ?? "", colSpan: 2 } as any,
      ],
    ],
    columnStyles: {
      0: { cellWidth: 48 },
      1: { cellWidth: (CONTENT_W - 48) / 4 },
      2: { cellWidth: (CONTENT_W - 48) / 4 },
      3: { cellWidth: (CONTENT_W - 48) / 4 },
      4: { cellWidth: (CONTENT_W - 48) / 4 },
    },
  });
  y = (doc as any).lastAutoTable.finalY;

  drawSideBand(doc, sgiStart, y, "EMITENTE / RECEPTOR / SGI");

  // Rodapé
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFontSize(6);
  doc.setTextColor(120);
  doc.text("DMN Estaleiro · FORCP-SGI-05 · Revisão 00 · 28/05/2025", SIDE_X, pageH - 3);
  doc.text(`Emitido em ${new Date().toLocaleString("pt-BR")}`, CONTENT_R, pageH - 3, { align: "right" });

  // Se por algum motivo gerou uma 2ª página, removê-la para manter A4 único
  const total = (doc as any).getNumberOfPages?.() ?? doc.internal.pages.length - 1;
  if (total > 1) {
    for (let i = total; i > 1; i--) doc.deletePage(i);
  }

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
