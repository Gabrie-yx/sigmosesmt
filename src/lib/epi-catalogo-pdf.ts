import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import dmnLogo from "@/assets/dmn-logo.png";

export type CatalogoEpiRow = {
  codigo_material: string;
  nome_material: string;
  ca: string | null;
  ca_validade: string | null;
  quantidade_atual: number;
  estoque_minimo: number;
};

function fmtBR(d?: string | null) {
  if (!d) return "—";
  const s = d.split("T")[0];
  const [y, m, day] = s.split("-");
  return y && m && day ? `${day}/${m}/${y}` : d;
}

export function gerarPdfCatalogoEpi(rows: CatalogoEpiRow[]) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210;
  const pageH = 297;
  const margin = 10;
  const contentW = pageW - margin * 2;
  const hojeBR = new Date().toLocaleDateString("pt-BR");
  const today = new Date().toISOString().slice(0, 10);

  const criticos = rows.filter((r) => r.quantidade_atual <= r.estoque_minimo).length;
  const caVencidos = rows.filter((r) => r.ca_validade && r.ca_validade < today).length;

  const drawHeader = () => {
    const y = margin;
    const headerH = 18;
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.rect(margin, y, contentW, headerH);
    try { doc.addImage(dmnLogo as any, "PNG", margin + 3, y + 3, 28, 11); } catch { /* noop */ }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("CATÁLOGO DE EPIs — SESMT", pageW / 2, y + 7.5, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const sub = `Total: ${rows.length}   •   Críticos: ${criticos}   •   CAs vencidos: ${caVencidos}`;
    doc.text(sub, pageW / 2, y + 13, { align: "center" });
    doc.setFontSize(7);
    doc.text(`Emitido em ${hojeBR}`, pageW - margin - 3, y + 5, { align: "right" });
  };

  drawHeader();

  const body = rows.map((r, i) => {
    const caVencido = r.ca_validade && r.ca_validade < today;
    const baixo = r.quantidade_atual <= r.estoque_minimo;
    const status = baixo ? (r.quantidade_atual === 0 ? "ZERADO" : "BAIXO") : "OK";
    return [
      String(i + 1).padStart(3, "0"),
      r.codigo_material || "—",
      r.nome_material,
      r.ca || "—",
      r.ca_validade ? `${fmtBR(r.ca_validade)}${caVencido ? " ⚠" : ""}` : "—",
      String(r.quantidade_atual),
      String(r.estoque_minimo),
      status,
    ];
  });

  autoTable(doc, {
    startY: margin + 20,
    margin: { top: margin + 20, left: margin, right: margin, bottom: 14 },
    theme: "grid",
    tableWidth: contentW,
    head: [["Nº", "Código", "Nome do EPI", "CA", "Val. CA", "Qtd", "Mín.", "Status"]],
    body,
    styles: {
      fontSize: 8,
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
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 22, halign: "center" },
      2: { cellWidth: 70 },
      3: { cellWidth: 20, halign: "center" },
      4: { cellWidth: 24, halign: "center" },
      5: { cellWidth: 14, halign: "center" },
      6: { cellWidth: 14, halign: "center" },
      7: { cellWidth: 16, halign: "center", fontStyle: "bold" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 7) {
        const v = String(data.cell.raw ?? "");
        if (v === "ZERADO") data.cell.styles.textColor = [185, 28, 28];
        else if (v === "BAIXO") data.cell.styles.textColor = [180, 83, 9];
        else data.cell.styles.textColor = [21, 128, 61];
      }
      if (data.section === "body" && data.column.index === 4) {
        const v = String(data.cell.raw ?? "");
        if (v.includes("⚠")) data.cell.styles.textColor = [185, 28, 28];
      }
    },
    didDrawPage: (data) => {
      drawHeader();
      const pageCount = (doc as any).internal.getNumberOfPages();
      const pageCur = (data as any).pageNumber;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(`Página ${pageCur} de ${pageCount}`, pageW - margin, pageH - 5, { align: "right" });
      doc.text("SESMT • DMN Estaleiro — Catálogo de EPIs (NR-06)", margin, pageH - 5);
    },
  });

  return doc;
}