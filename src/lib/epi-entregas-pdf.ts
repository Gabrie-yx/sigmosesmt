import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import dmnLogo from "@/assets/dmn-logo.png";

export type EntregaRow = {
  data_entrega: string | null;
  item: string | null;
  ca: string | null;
  tamanho: string | null;
  qtd: number | null;
  motivo_entrega: string | null;
  colaborador: string;
  matricula: string | null;
  cpf: string | null;
  cargo: string | null;
  empresa: string | null;
};

const MOTIVO_LABEL: Record<string, string> = {
  PRIMEIRA_ENTREGA: "1ª Entrega",
  TROCA_DESGASTE: "Troca",
  EMPRESTIMO: "Empréstimo",
  PERDA_EXTRAVIO: "Perda/Extravio",
};

function fmtBR(d?: string | null) {
  if (!d) return "—";
  const s = d.split("T")[0];
  const [y, m, day] = s.split("-");
  return y && m && day ? `${day}/${m}/${y}` : d;
}

export function gerarPdfEntregasEpi(
  rows: EntregaRow[],
  opts: {
    periodoLabel?: string;
    filtros?: string;
  } = {},
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = 297;
  const pageH = 210;
  const margin = 8;
  const contentW = pageW - margin * 2;
  const hojeBR = new Date().toLocaleDateString("pt-BR");

  const body = rows.map((r, i) => [
    String(i + 1).padStart(3, "0"),
    fmtBR(r.data_entrega),
    r.matricula ?? "—",
    r.colaborador,
    r.cargo ?? "—",
    r.item ?? "—",
    r.ca ?? "—",
    r.tamanho ?? "—",
    String(r.qtd ?? 0),
    MOTIVO_LABEL[r.motivo_entrega ?? ""] ?? (r.motivo_entrega ?? "—"),
  ]);

  const drawHeader = () => {
    const y = margin;
    const headerH = 16;
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.rect(margin, y, contentW, headerH);
    try { doc.addImage(dmnLogo as any, "PNG", margin + 3, y + 2.5, 28, 11); } catch { /* noop */ }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("FICHA DE ENTREGA DE EPI — NR-06", pageW / 2, y + 7, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const sub = `${opts.periodoLabel ?? "Período: todos"}   •   ${opts.filtros ?? "Filtros: nenhum"}   •   Total: ${rows.length}`;
    doc.text(sub, pageW / 2, y + 12, { align: "center" });
    doc.setFontSize(7);
    doc.text(`Emitido em ${hojeBR}`, pageW - margin - 3, y + 5, { align: "right" });
  };

  drawHeader();

  autoTable(doc, {
    startY: margin + 18,
    margin: { top: margin + 18, left: margin, right: margin, bottom: 14 },
    theme: "grid",
    tableWidth: contentW,
    head: [["Nº", "Data", "Matrícula", "Colaborador", "Cargo", "EPI", "CA", "Tam.", "Qtd", "Motivo"]],
    body,
    styles: {
      fontSize: 7.5,
      cellPadding: 1.4,
      lineColor: [0, 0, 0],
      lineWidth: 0.12,
      textColor: [0, 0, 0],
      valign: "middle",
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
      fontSize: 7.5,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 20, halign: "center" },
      2: { cellWidth: 20, halign: "center" },
      3: { cellWidth: 55 },
      4: { cellWidth: 35 },
      5: { cellWidth: 60 },
      6: { cellWidth: 18, halign: "center" },
      7: { cellWidth: 14, halign: "center" },
      8: { cellWidth: 12, halign: "center" },
      9: { cellWidth: 27, halign: "center" },
    },
    didDrawPage: (data) => {
      drawHeader();
      const pageCount = (doc as any).internal.getNumberOfPages();
      const pageCur = (data as any).pageNumber;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(`Página ${pageCur} de ${pageCount}`, pageW - margin, pageH - 5, { align: "right" });
      doc.text("SESMT • DMN Estaleiro — Documento conforme NR-06", margin, pageH - 5);
    },
  });

  return doc;
}