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
const C_HEADER: [number, number, number] = [248, 215, 218]; // rosa pastel cabeçalhos seções
const C_BORDER: [number, number, number] = [150, 150, 150];
const C_BLUE_NOTE: [number, number, number] = [37, 99, 235];

const SIDE_X = 10;
const SIDE_W = 7;
const CONTENT_X = SIDE_X + SIDE_W; // sem espaço entre faixa e conteúdo
const CONTENT_R = 200;             // limite direito (A4 210 - margem 10)
const CONTENT_W = CONTENT_R - CONTENT_X;

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

function drawHeader(doc: jsPDF, logo: string | null, numero: string) {
  const y = 10;
  const h = 20;
  doc.setDrawColor(...C_BORDER);
  doc.setLineWidth(0.3);
  doc.rect(10, y, 190, h);
  // colunas
  doc.line(45, y, 45, y + h);
  doc.line(155, y, 155, y + h);

  // logo
  if (logo) {
    try { doc.addImage(logo, "PNG", 12, y + 2, 31, 16, undefined, "FAST"); } catch {}
  } else {
    doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text("DMN", 27.5, y + 11, { align: "center" });
  }

  // título
  doc.setFont("helvetica", "bold"); doc.setFontSize(15);
  doc.setTextColor(0);
  doc.text("Tratativa de Não Conformidade - TNC", 100, y + 12, { align: "center" });

  // metadados
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
  const mx = 157;
  doc.text("CÓD.: FORCP-SGI-05", mx, y + 4.5);
  doc.text("REVISÃO: 00", mx, y + 9);
  doc.text("DATA: 28/05/2025", mx, y + 13.5);
  doc.text("PÁG.: 1/1", mx, y + 18);
}

function drawSideBand(doc: jsPDF, yStart: number, yEnd: number, label: string) {
  doc.setFillColor(...C_HEADER);
  doc.rect(SIDE_X, yStart, SIDE_W, yEnd - yStart, "FD");
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  const cy = (yStart + yEnd) / 2;
  doc.text(label, SIDE_X + SIDE_W / 2 + 1.3, cy, { angle: 90, align: "center" });
}

// faixa rosa de título de seção, centralizada
function sectionBar(doc: jsPDF, y: number, text: string, x = CONTENT_X, w = CONTENT_W): number {
  const h = 6;
  doc.setFillColor(...C_HEADER);
  doc.setDrawColor(...C_BORDER);
  doc.rect(x, y, w, h, "FD");
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text(text, x + w / 2, y + 4.1, { align: "center" });
  return y + h;
}

export async function generateTNCPdf(nc: NCData): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const logo = await loadLogo();
  drawHeader(doc, logo, nc.numero ?? "");

  // ============ EMITENTE ============
  const emitenteStart = 32;
  let y = emitenteStart;

  // 1- ANÁLISE DA TRATATIVA
  y = sectionBar(doc, y, "1- ANÁLISE DA TRATATIVA");

  // Identificação empresa
  autoTable(doc, {
    startY: y,
    margin: { left: CONTENT_X, right: 10 },
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 1.5, lineColor: C_BORDER, textColor: 0 },
    body: [[{ content: "IDENTIFICAÇÃO DA EMPRESA DO GRUPO: ", styles: { fontStyle: "bold" } } as any, "DMN Estaleiro"]],
    columnStyles: { 0: { cellWidth: 70 } },
  });
  y = (doc as any).lastAutoTable.finalY;

  // Grid principal: 5 colunas (label/val/label/val/origem-merged)
  // larguras: 28 | 50 | 28 | 40 | resto(~37)
  const w1 = 26, w2 = 48, w3 = 28, w4 = 40;
  const w5 = CONTENT_W - (w1 + w2 + w3 + w4);

  autoTable(doc, {
    startY: y,
    margin: { left: CONTENT_X, right: 10 },
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 1.5, lineColor: C_BORDER, textColor: 0, valign: "middle" },
    body: [
      [
        { content: "Emitente:", styles: { fontStyle: "bold" } } as any,
        nc.emitente ?? "",
        { content: "Data da Abertura:", styles: { fontStyle: "bold" } } as any,
        br(nc.data_identificacao),
        { content: "Nº TNC:", styles: { fontStyle: "bold", halign: "left" }, rowSpan: 1 } as any,
      ],
      [
        { content: "", styles: {} } as any, "", "", "",
        { content: nc.numero ?? "", styles: { halign: "center", fontStyle: "bold" } } as any,
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
    startY: y, margin: { left: CONTENT_X, right: 10 }, theme: "grid",
    styles: { fontSize: 9.5, cellPadding: 2.5, minCellHeight: 18, lineColor: C_BORDER, textColor: 0 },
    body: [[nc.descricao ?? ""]],
  });
  y = (doc as any).lastAutoTable.finalY;

  // 3- ABRANGÊNCIA
  y = sectionBar(doc, y, "3- ABRANGÊNCIA DA NÃO CONFORMIDADE");
  autoTable(doc, {
    startY: y, margin: { left: CONTENT_X, right: 10 }, theme: "grid",
    styles: { fontSize: 9.5, cellPadding: 2.5, minCellHeight: 14, lineColor: C_BORDER, textColor: 0 },
    body: [[nc.abrangencia ?? ""]],
  });
  y = (doc as any).lastAutoTable.finalY;

  drawSideBand(doc, emitenteStart, y, "EMITENTE");

  // ============ RECEPTOR ============
  const receptorStart = y;

  // 4- AÇÕES IMEDIATAS (header 3 colunas)
  const wAcao = CONTENT_W - 50 - 30;
  autoTable(doc, {
    startY: y, margin: { left: CONTENT_X, right: 10 }, theme: "grid",
    head: [[
      { content: "4- AÇÕES IMEDIATAS", styles: { halign: "center", fillColor: C_HEADER, textColor: 0, fontStyle: "bold", fontSize: 9.5 } } as any,
      { content: "RESPONSÁVEIS", styles: { halign: "center", fillColor: C_HEADER, textColor: 0, fontStyle: "bold", fontSize: 9 } } as any,
      { content: "PRAZO", styles: { halign: "center", fillColor: C_HEADER, textColor: 0, fontStyle: "bold", fontSize: 9 } } as any,
    ]],
    body: ((nc.acoes_imediatas_lista ?? []).length
      ? (nc.acoes_imediatas_lista ?? []).map(a => [a.acao, a.responsavel ?? "", br(a.prazo)])
      : [["", "", ""], ["", "", ""]]),
    styles: { fontSize: 9, cellPadding: 1.5, lineColor: C_BORDER, textColor: 0, minCellHeight: 6 },
    columnStyles: {
      0: { cellWidth: wAcao },
      1: { cellWidth: 50, halign: "center" },
      2: { cellWidth: 30, halign: "center" },
    },
  });
  y = (doc as any).lastAutoTable.finalY;

  // 5- ANÁLISE DA CAUSA RAIZ
  y = sectionBar(doc, y, "5- ANÁLISE DA CAUSA RAIZ");
  const p = nc.porques ?? {};
  autoTable(doc, {
    startY: y, margin: { left: CONTENT_X, right: 10 }, theme: "grid",
    styles: { fontSize: 9, cellPadding: 1.8, lineColor: C_BORDER, textColor: 0 },
    body: [
      [{ content: "1º Por que?", styles: { fontStyle: "bold" } } as any, p.p1 ?? ""],
      [{ content: "2º Por que?", styles: { fontStyle: "bold" } } as any, p.p2 ?? ""],
      [{ content: "3º Por que?", styles: { fontStyle: "bold" } } as any, p.p3 ?? ""],
      [{ content: "4º Por que?", styles: { fontStyle: "bold" } } as any, p.p4 ?? ""],
      [{ content: "5º Por que?", styles: { fontStyle: "bold" } } as any, p.p5 ?? ""],
    ],
    columnStyles: { 0: { cellWidth: 28 } },
  });
  y = (doc as any).lastAutoTable.finalY;

  // Observação em azul
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...C_BLUE_NOTE);
  doc.text(
    "Observação: Pode utilizar anexos e relatórios complementares caso os campos deste formulário não sejam suficientes.",
    CONTENT_X + 2, y + 3.2,
  );
  doc.setTextColor(0);
  y += 5;

  if (y > 235) { doc.addPage(); drawHeader(doc, logo, nc.numero ?? ""); y = 32; }

  // 6- AÇÕES CORRETIVAS
  autoTable(doc, {
    startY: y, margin: { left: CONTENT_X, right: 10 }, theme: "grid",
    head: [
      [{ content: "6- AÇÕES CORRETIVAS", colSpan: 3, styles: { halign: "center", fillColor: C_HEADER, textColor: 0, fontStyle: "bold", fontSize: 9.5 } } as any],
      [
        { content: "AÇÕES", styles: { halign: "center", fillColor: C_HEADER, textColor: 0, fontStyle: "bold" } } as any,
        { content: "RESPONSÁVEL", styles: { halign: "center", fillColor: C_HEADER, textColor: 0, fontStyle: "bold" } } as any,
        { content: "PRAZO", styles: { halign: "center", fillColor: C_HEADER, textColor: 0, fontStyle: "bold" } } as any,
      ],
    ],
    body: ((nc.acoes_corretivas_lista ?? []).length
      ? (nc.acoes_corretivas_lista ?? []).map(a => [a.acao, a.responsavel ?? "", br(a.prazo)])
      : [["", "", ""], ["", "", ""]]),
    styles: { fontSize: 9, cellPadding: 1.5, lineColor: C_BORDER, textColor: 0, minCellHeight: 6 },
    columnStyles: {
      0: { cellWidth: wAcao },
      1: { cellWidth: 50, halign: "center" },
      2: { cellWidth: 30, halign: "center" },
    },
  });
  y = (doc as any).lastAutoTable.finalY;

  drawSideBand(doc, receptorStart, y, "RECEPTOR");

  // ============ EMITENTE / RECEPTOR / SGI ============
  const sgiStart = y;

  // "As ações foram implementadas?" + SIM/NÃO + Data
  // larguras: 60 | 35 | 35 | 22 | resto
  const cA = 60, cB = 35, cC = 35, cD = 18;
  const cE = CONTENT_W - (cA + cB + cC + cD);
  autoTable(doc, {
    startY: y, margin: { left: CONTENT_X, right: 10 }, theme: "grid",
    styles: { fontSize: 9, cellPadding: 1.6, lineColor: C_BORDER, textColor: 0, valign: "middle" },
    body: [
      [
        { content: "As ações foram implementadas?", styles: { fontStyle: "bold" } } as any,
        { content: "SIM", styles: { halign: "center", fontStyle: "bold" } } as any,
        { content: "NÃO", styles: { halign: "center", fontStyle: "bold" } } as any,
        { content: "Data:", styles: { fontStyle: "bold" } } as any,
        "",
      ],
      [
        "",
        { content: nc.acoes_implementadas === true ? "VERDADEIRO" : "FALSO", styles: { halign: "center" } } as any,
        { content: nc.acoes_implementadas === false ? "VERDADEIRO" : "FALSO", styles: { halign: "center" } } as any,
        "",
        { content: br(nc.data_implementacao), styles: { halign: "center" } } as any,
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

  // Comentários / Novo prazo / Implementado na data / Comentários
  autoTable(doc, {
    startY: y, margin: { left: CONTENT_X, right: 10 }, theme: "grid",
    styles: { fontSize: 9, cellPadding: 1.6, lineColor: C_BORDER, textColor: 0 },
    body: [
      [{ content: "Comentários:", styles: { fontStyle: "bold", cellWidth: 28 } } as any,
       { content: nc.comentarios_implementacao ?? "", colSpan: 3 } as any],
      [{ content: "Novo Prazo:", styles: { fontStyle: "bold" } } as any,
       br(nc.novo_prazo),
       { content: "Implementado na data:", styles: { fontStyle: "bold" } } as any,
       br(nc.data_implementacao)],
      [{ content: "Comentários:", styles: { fontStyle: "bold" } } as any,
       { content: nc.comentarios_implementacao ?? "", colSpan: 3 } as any],
    ],
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 70 },
      2: { cellWidth: 40 },
      3: { cellWidth: CONTENT_W - 28 - 70 - 40 },
    },
  });
  y = (doc as any).lastAutoTable.finalY;

  // 7- VERIFICAÇÃO DA EFICÁCIA
  y = sectionBar(doc, y, "7- VERIFICAÇÃO DA EFICÁCIA");

  autoTable(doc, {
    startY: y, margin: { left: CONTENT_X, right: 10 }, theme: "grid",
    styles: { fontSize: 9, cellPadding: 1.6, lineColor: C_BORDER, textColor: 0, valign: "middle" },
    body: [
      [{ content: "Prazo para verificação da Eficácia:", styles: { fontStyle: "bold" } } as any,
       { content: br(nc.prazo_verificacao_eficacia), colSpan: 4 } as any],
      [{ content: "Observações:", styles: { fontStyle: "bold" } } as any,
       { content: nc.comentarios_eficacia ?? "", colSpan: 4 } as any],
      [
        { content: "A Ação Corretiva foi eficaz?", styles: { fontStyle: "bold" } } as any,
        { content: nc.eficaz === true ? "VERDADEIRO" : "FALSO", styles: { halign: "center", fontStyle: "bold" } } as any,
        { content: "SIM", styles: { halign: "center", fontStyle: "bold" } } as any,
        { content: nc.eficaz === false ? "VERDADEIRO" : "FALSO", styles: { halign: "center", fontStyle: "bold" } } as any,
        { content: "NÃO", styles: { halign: "center", fontStyle: "bold" } } as any,
      ],
      [{ content: "Comentários:", styles: { fontStyle: "bold" } } as any,
       { content: nc.comentarios_eficacia ?? "", colSpan: 4 } as any],
      [
        { content: "Data fechamento:", styles: { fontStyle: "bold" } } as any,
        { content: br(nc.data_fechamento), colSpan: 1 } as any,
        { content: "Responsável:", styles: { fontStyle: "bold" } } as any,
        { content: nc.responsavel_fechamento ?? "", colSpan: 2 } as any,
      ],
    ],
    columnStyles: {
      0: { cellWidth: 56 },
      1: { cellWidth: (CONTENT_W - 56) / 4 },
      2: { cellWidth: (CONTENT_W - 56) / 4 },
      3: { cellWidth: (CONTENT_W - 56) / 4 },
      4: { cellWidth: (CONTENT_W - 56) / 4 },
    },
  });
  y = (doc as any).lastAutoTable.finalY;

  drawSideBand(doc, sgiStart, y, "EMITENTE / RECEPTOR / SGI");

  // Rodapé
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFontSize(7);
  doc.setTextColor(120);
  doc.text("DMN Estaleiro · FORCP-SGI-05 · Revisão 00 · 28/05/2025", 10, pageH - 6);
  doc.text(`Emitido em ${new Date().toLocaleString("pt-BR")}`, 200, pageH - 6, { align: "right" });

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
