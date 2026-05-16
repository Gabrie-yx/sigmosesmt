import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoUrl from "@/assets/dmn-logo.png";

function br(d?: string | null) {
  if (!d) return "—";
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

// Cores institucionais
const C_PRIMARY: [number, number, number] = [127, 29, 29];   // vinho DMN
const C_EMITENTE: [number, number, number] = [30, 64, 175];  // azul
const C_RECEPTOR: [number, number, number] = [180, 83, 9];   // âmbar/laranja
const C_SGI: [number, number, number] = [21, 128, 61];       // verde
const C_LIGHT: [number, number, number] = [241, 245, 249];

const SIDE_X = 10;          // posição x da faixa lateral
const SIDE_W = 8;           // largura da faixa lateral
const CONTENT_X = SIDE_X + SIDE_W + 2; // x do conteúdo
const CONTENT_R = 200;      // limite direito do conteúdo (A4 = 210, margem 10)

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
  // Cabeçalho institucional (3 colunas: logo | título | metadados) - estilo FORCP
  const y = 10;
  const h = 18;
  // moldura
  doc.setDrawColor(120);
  doc.setLineWidth(0.3);
  doc.rect(10, y, 190, h);
  // colunas
  doc.line(45, y, 45, y + h);
  doc.line(150, y, 150, y + h);

  // Coluna 1 - logo
  if (logo) {
    try { doc.addImage(logo, "PNG", 12, y + 2, 31, 14, undefined, "FAST"); } catch {}
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...C_PRIMARY);
    doc.text("DMN", 28, y + 8, { align: "center" });
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("ESTALEIRO", 28, y + 12, { align: "center" });
    doc.setTextColor(0);
  }

  // Coluna 2 - título
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...C_PRIMARY);
  doc.text("Tratativa de Não Conformidade", 97.5, y + 8, { align: "center" });
  doc.setFontSize(11);
  doc.text("- TNC -", 97.5, y + 14, { align: "center" });
  doc.setTextColor(0);

  // Coluna 3 - metadados
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const mx = 152;
  doc.text(`CÓD.: FORCP-SGI-05`, mx, y + 4);
  doc.line(150, y + 5.5, 200, y + 5.5);
  doc.text(`REVISÃO: 00`, mx, y + 9);
  doc.line(150, y + 10.5, 200, y + 10.5);
  doc.text(`DATA: 28/05/2025`, mx, y + 14);
  doc.line(150, y + 15.5, 200, y + 15.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text(`Nº ${numero || "—"}`, 198, y + 19.5, { align: "right" });
}

function drawSideBand(
  doc: jsPDF,
  yStart: number,
  yEnd: number,
  label: string,
  color: [number, number, number],
) {
  doc.setFillColor(...color);
  doc.rect(SIDE_X, yStart, SIDE_W, yEnd - yStart, "F");
  // texto rotacionado
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  const cy = (yStart + yEnd) / 2;
  doc.text(label, SIDE_X + SIDE_W / 2 + 1.2, cy, { angle: 90, align: "center" });
  doc.setTextColor(0);
}

function sectionTitle(doc: jsPDF, y: number, text: string, color: [number, number, number]) {
  doc.setFillColor(...color);
  doc.rect(CONTENT_X, y, CONTENT_R - CONTENT_X, 5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(text, CONTENT_X + 2, y + 3.6);
  doc.setTextColor(0);
  return y + 5;
}

export async function generateTNCPdf(nc: NCData): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const logo = await loadLogo();

  drawHeader(doc, logo, nc.numero ?? "");

  // ============ DIVISÃO: EMITENTE ============
  const emitenteStart = 30;
  let y = emitenteStart;

  y = sectionTitle(doc, y, "1 — ANÁLISE DA TRATATIVA", C_EMITENTE);
  autoTable(doc, {
    startY: y,
    margin: { left: CONTENT_X, right: 10 },
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.5, lineColor: [180, 180, 180] },
    body: [
      ["Emitente:", nc.emitente ?? "—", "Data abertura:", br(nc.data_identificacao), "Nº TNC:", nc.numero ?? "—"],
      ["Departamento:", nc.departamento ?? "—", "Enviado para:", nc.enviado_para ?? "—", "Origem:", nc.origem ?? "—"],
      ["Classificação:", nc.classificacao ?? "Não Conformidade", "Requisito:", nc.requisito ?? "—", "Severidade:", nc.severidade ?? "—"],
      ["Reincidente?", nc.reincidente ? "Sim" : "Não", "Norma:", nc.norma ?? "ISO 9001:2015", "Status:", nc.status ?? "—"],
    ],
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 26, fillColor: C_LIGHT },
      2: { fontStyle: "bold", cellWidth: 26, fillColor: C_LIGHT },
      4: { fontStyle: "bold", cellWidth: 22, fillColor: C_LIGHT },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 2;

  y = sectionTitle(doc, y, "2 — DESCRIÇÃO DO PROBLEMA", C_EMITENTE);
  autoTable(doc, {
    startY: y, margin: { left: CONTENT_X, right: 10 }, theme: "grid",
    styles: { fontSize: 9, cellPadding: 2.5, minCellHeight: 18, lineColor: [180, 180, 180] },
    body: [[nc.descricao ?? "—"]],
  });
  y = (doc as any).lastAutoTable.finalY + 2;

  y = sectionTitle(doc, y, "3 — ABRANGÊNCIA DA NÃO CONFORMIDADE", C_EMITENTE);
  autoTable(doc, {
    startY: y, margin: { left: CONTENT_X, right: 10 }, theme: "grid",
    styles: { fontSize: 9, cellPadding: 2.5, minCellHeight: 12, lineColor: [180, 180, 180] },
    body: [[nc.abrangencia ?? "—"]],
  });
  y = (doc as any).lastAutoTable.finalY + 2;

  drawSideBand(doc, emitenteStart - 1, y, "EMITENTE", C_EMITENTE);

  // ============ DIVISÃO: RECEPTOR ============
  const receptorStart = y + 1;
  y = receptorStart + 1;

  y = sectionTitle(doc, y, "4 — AÇÕES IMEDIATAS", C_RECEPTOR);
  autoTable(doc, {
    startY: y, margin: { left: CONTENT_X, right: 10 }, theme: "grid",
    head: [["AÇÕES", "RESPONSÁVEL", "PRAZO"]],
    body: (nc.acoes_imediatas_lista ?? []).length
      ? (nc.acoes_imediatas_lista ?? []).map((a) => [a.acao, a.responsavel ?? "—", br(a.prazo)])
      : [["—", "—", "—"]],
    headStyles: { fillColor: C_RECEPTOR, textColor: 255, fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 1.8, lineColor: [180, 180, 180] },
    columnStyles: { 1: { cellWidth: 45 }, 2: { cellWidth: 30 } },
  });
  y = (doc as any).lastAutoTable.finalY + 2;

  y = sectionTitle(doc, y, "5 — ANÁLISE DA CAUSA RAIZ (Técnica dos 5 Porquês)", C_RECEPTOR);
  const p = nc.porques ?? {};
  autoTable(doc, {
    startY: y, margin: { left: CONTENT_X, right: 10 }, theme: "grid",
    styles: { fontSize: 8, cellPadding: 2, lineColor: [180, 180, 180] },
    body: [
      ["1º Por quê?", p.p1 ?? "—"],
      ["2º Por quê?", p.p2 ?? "—"],
      ["3º Por quê?", p.p3 ?? "—"],
      ["4º Por quê?", p.p4 ?? "—"],
      ["5º Por quê?", p.p5 ?? "—"],
    ],
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 28, fillColor: C_LIGHT } },
  });
  y = (doc as any).lastAutoTable.finalY + 2;

  if (y > 215) { doc.addPage(); drawHeader(doc, logo, nc.numero ?? ""); y = 30; }

  y = sectionTitle(doc, y, "6 — AÇÕES CORRETIVAS", C_RECEPTOR);
  autoTable(doc, {
    startY: y, margin: { left: CONTENT_X, right: 10 }, theme: "grid",
    head: [["AÇÕES", "RESPONSÁVEL", "PRAZO"]],
    body: (nc.acoes_corretivas_lista ?? []).length
      ? (nc.acoes_corretivas_lista ?? []).map((a) => [a.acao, a.responsavel ?? "—", br(a.prazo)])
      : [["—", "—", "—"]],
    headStyles: { fillColor: C_RECEPTOR, textColor: 255, fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 1.8, lineColor: [180, 180, 180] },
    columnStyles: { 1: { cellWidth: 45 }, 2: { cellWidth: 30 } },
  });
  y = (doc as any).lastAutoTable.finalY + 1;

  autoTable(doc, {
    startY: y, margin: { left: CONTENT_X, right: 10 }, theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.8, lineColor: [180, 180, 180] },
    body: [
      ["As ações foram implementadas?",
       nc.acoes_implementadas == null ? "—" : nc.acoes_implementadas ? "SIM" : "NÃO",
       "Data:", br(nc.data_implementacao), "Novo prazo:", br(nc.novo_prazo)],
      ["Comentários:", { content: nc.comentarios_implementacao ?? "—", colSpan: 5 } as any],
    ],
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 42, fillColor: C_LIGHT },
      2: { fontStyle: "bold", cellWidth: 14, fillColor: C_LIGHT },
      4: { fontStyle: "bold", cellWidth: 22, fillColor: C_LIGHT },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 2;

  drawSideBand(doc, receptorStart, y, "RECEPTOR", C_RECEPTOR);

  // ============ DIVISÃO: EMITENTE / RECEPTOR / SGI ============
  if (y > 240) { doc.addPage(); drawHeader(doc, logo, nc.numero ?? ""); y = 30; }
  const sgiStart = y + 1;
  y = sgiStart + 1;

  y = sectionTitle(doc, y, "7 — VERIFICAÇÃO DA EFICÁCIA", C_SGI);
  autoTable(doc, {
    startY: y, margin: { left: CONTENT_X, right: 10 }, theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.8, lineColor: [180, 180, 180] },
    body: [
      ["Prazo verificação:", br(nc.prazo_verificacao_eficacia),
       "A ação foi eficaz?", nc.eficaz == null ? "—" : nc.eficaz ? "SIM" : "NÃO"],
      ["Observações / Comentários:", { content: nc.comentarios_eficacia ?? "—", colSpan: 3 } as any],
      ["Data fechamento:", br(nc.data_fechamento), "Responsável:", nc.responsavel_fechamento ?? "—"],
    ],
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 42, fillColor: C_LIGHT },
      2: { fontStyle: "bold", cellWidth: 38, fillColor: C_LIGHT },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 2;

  drawSideBand(doc, sgiStart, y, "EMITENTE / RECEPTOR / SGI", C_SGI);

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