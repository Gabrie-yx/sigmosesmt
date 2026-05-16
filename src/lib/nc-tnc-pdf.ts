import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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

export function generateTNCPdf(nc: NCData): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  let y = 12;

  // Cabeçalho
  doc.setFillColor(127, 29, 29);
  doc.rect(10, y, W - 20, 14, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Tratativa de Não Conformidade - TNC", 14, y + 6);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("CÓD.: FORCP-SGI-05  ·  REVISÃO: 00  ·  DATA: 28/05/2025", 14, y + 11);
  doc.setTextColor(0, 0, 0);
  y += 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("1 — ANÁLISE DA TRATATIVA", 10, y);
  y += 2;

  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.5 },
    body: [
      ["Emitente:", nc.emitente ?? "—", "Data da Abertura:", br(nc.data_identificacao), "Nº TNC:", nc.numero ?? "—"],
      ["Departamento:", nc.departamento ?? "—", "Enviado para:", nc.enviado_para ?? "—", "Origem:", nc.origem ?? "—"],
      ["Classificação:", nc.classificacao ?? "Não Conformidade", "Requisito:", nc.requisito ?? "—", "Severidade:", nc.severidade ?? "—"],
      ["Reincidente?", nc.reincidente ? "Sim" : "Não", "Norma:", nc.norma ?? "ISO 9001:2015", "Status:", nc.status ?? "—"],
    ],
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 28 },
      2: { fontStyle: "bold", cellWidth: 28 },
      4: { fontStyle: "bold", cellWidth: 28 },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  doc.setFont("helvetica", "bold");
  doc.text("2 — DESCRIÇÃO DO PROBLEMA", 10, y); y += 2;
  autoTable(doc, { startY: y, theme: "grid", styles: { fontSize: 9, cellPadding: 2 }, body: [[nc.descricao ?? "—"]] });
  y = (doc as any).lastAutoTable.finalY + 4;

  doc.setFont("helvetica", "bold");
  doc.text("3 — ABRANGÊNCIA DA NÃO CONFORMIDADE", 10, y); y += 2;
  autoTable(doc, { startY: y, theme: "grid", styles: { fontSize: 9, cellPadding: 2 }, body: [[nc.abrangencia ?? "—"]] });
  y = (doc as any).lastAutoTable.finalY + 4;

  doc.setFont("helvetica", "bold");
  doc.text("4 — AÇÕES IMEDIATAS", 10, y); y += 2;
  autoTable(doc, {
    startY: y, theme: "grid",
    head: [["AÇÕES", "RESPONSÁVEL", "PRAZO"]],
    body: (nc.acoes_imediatas_lista ?? []).map((a) => [a.acao, a.responsavel ?? "—", a.prazo ?? "—"]),
    headStyles: { fillColor: [127, 29, 29], textColor: 255, fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 1.5 },
    columnStyles: { 1: { cellWidth: 45 }, 2: { cellWidth: 35 } },
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  doc.setFont("helvetica", "bold");
  doc.text("5 — ANÁLISE DA CAUSA RAIZ (5 Porquês)", 10, y); y += 2;
  const p = nc.porques ?? {};
  autoTable(doc, {
    startY: y, theme: "grid", styles: { fontSize: 8, cellPadding: 1.5 },
    body: [
      ["1º Por quê?", p.p1 ?? "—"],
      ["2º Por quê?", p.p2 ?? "—"],
      ["3º Por quê?", p.p3 ?? "—"],
      ["4º Por quê?", p.p4 ?? "—"],
      ["5º Por quê?", p.p5 ?? "—"],
    ],
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 28 } },
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  if (y > 230) { doc.addPage(); y = 12; }

  doc.setFont("helvetica", "bold");
  doc.text("6 — AÇÕES CORRETIVAS", 10, y); y += 2;
  autoTable(doc, {
    startY: y, theme: "grid",
    head: [["AÇÕES", "RESPONSÁVEL", "PRAZO"]],
    body: (nc.acoes_corretivas_lista ?? []).map((a) => [a.acao, a.responsavel ?? "—", a.prazo ?? "—"]),
    headStyles: { fillColor: [127, 29, 29], textColor: 255, fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 1.5 },
    columnStyles: { 1: { cellWidth: 45 }, 2: { cellWidth: 35 } },
  });
  y = (doc as any).lastAutoTable.finalY + 2;

  autoTable(doc, {
    startY: y, theme: "grid", styles: { fontSize: 8, cellPadding: 1.5 },
    body: [
      ["As ações foram implementadas?", nc.acoes_implementadas == null ? "—" : nc.acoes_implementadas ? "SIM" : "NÃO",
       "Data:", br(nc.data_implementacao), "Novo prazo:", br(nc.novo_prazo)],
      ["Comentários:", { content: nc.comentarios_implementacao ?? "—", colSpan: 5 } as any],
    ],
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 38 }, 2: { fontStyle: "bold", cellWidth: 14 }, 4: { fontStyle: "bold", cellWidth: 22 } },
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  if (y > 240) { doc.addPage(); y = 12; }

  doc.setFont("helvetica", "bold");
  doc.text("7 — VERIFICAÇÃO DA EFICÁCIA", 10, y); y += 2;
  autoTable(doc, {
    startY: y, theme: "grid", styles: { fontSize: 8, cellPadding: 1.5 },
    body: [
      ["Prazo para verificação:", br(nc.prazo_verificacao_eficacia), "A ação foi eficaz?", nc.eficaz == null ? "—" : nc.eficaz ? "SIM" : "NÃO"],
      ["Comentários:", { content: nc.comentarios_eficacia ?? "—", colSpan: 3 } as any],
      ["Data fechamento:", br(nc.data_fechamento), "Responsável:", nc.responsavel_fechamento ?? "—"],
    ],
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 38 }, 2: { fontStyle: "bold", cellWidth: 38 } },
  });

  return doc;
}

export function downloadTNC(nc: NCData) {
  const doc = generateTNCPdf(nc);
  doc.save(`TNC-${nc.numero ?? "rascunho"}.pdf`);
}

export function printTNC(nc: NCData) {
  const doc = generateTNCPdf(nc);
  doc.autoPrint();
  window.open(doc.output("bloburl"), "_blank");
}