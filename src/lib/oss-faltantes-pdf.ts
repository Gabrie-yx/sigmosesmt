import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import dmnLogo from "@/assets/dmn-logo.png";

export type FaltanteRow = {
  nome: string;
  cpf: string | null;
  matricula: string | null;
  cargo: string | null;
  empresa: string | null;
  motivo: "NUNCA_RECEBEU" | "CARGO_MUDOU" | "VENCIDA";
  detalhe: string;
};

const MOTIVO_LABEL: Record<FaltanteRow["motivo"], string> = {
  NUNCA_RECEBEU: "Nunca recebeu",
  CARGO_MUDOU: "Mudou de cargo",
  VENCIDA: "OS vencida",
};

/**
 * Relatório de funcionários ativos SEM Ordem de Serviço de Segurança vigente.
 * NR-01 item 1.4.1 "c" — evidência de pendência de entrega da OSS.
 */
export function gerarPdfFaltantesOss(
  rows: FaltanteRow[],
  opts: { empresaLabel?: string; cargoLabel?: string; situacaoLabel?: string } = {},
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210;
  const margin = 10;
  const contentW = pageW - margin * 2;
  const hojeBR = new Date().toLocaleDateString("pt-BR");

  const sorted = [...rows].sort(
    (a, b) =>
      String(a.empresa ?? "").localeCompare(String(b.empresa ?? ""), "pt-BR") ||
      String(a.nome ?? "").localeCompare(String(b.nome ?? ""), "pt-BR"),
  );

  const body = sorted.map((r, i) => [
    String(i + 1).padStart(3, "0"),
    r.matricula ?? "—",
    r.nome,
    r.cpf ?? "—",
    r.cargo ?? "—",
    r.empresa ?? "—",
    MOTIVO_LABEL[r.motivo],
    r.detalhe,
  ]);

  const drawHeader = () => {
    const y = margin;
    const headerH = 22;
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.rect(margin, y, contentW, headerH);
    try { doc.addImage(dmnLogo as any, "PNG", margin + 3, y + 4, 32, 12); } catch { /* noop */ }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12.5);
    doc.text("FUNCIONÁRIOS SEM ORDEM DE SERVIÇO VIGENTE", pageW / 2, y + 8, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(
      `Empresa: ${opts.empresaLabel ?? "Todas"}   •   Cargo: ${opts.cargoLabel ?? "Todos"}   •   Situação: ${opts.situacaoLabel ?? "Todas"}   •   Total: ${rows.length}`,
      pageW / 2, y + 13.5, { align: "center" },
    );
    doc.setFontSize(7);
    doc.text("NR-01 item 1.4.1 alínea \"c\" — entrega de OSS na admissão, mudança de cargo ou revisão.", pageW / 2, y + 18.5, { align: "center" });
    doc.setFontSize(7.5);
    doc.text(`Emitido em ${hojeBR}`, pageW - margin - 3, y + 5, { align: "right" });
  };

  drawHeader();
  const top = margin + 26;

  autoTable(doc, {
    startY: top,
    margin: { top, left: margin, right: margin, bottom: 18 },
    theme: "grid",
    tableWidth: contentW,
    head: [["Nº", "Matrícula", "Nome", "CPF", "Cargo", "Empresa", "Situação", "Detalhe"]],
    body,
    styles: {
      fontSize: 7, cellPadding: 1.6, lineColor: [0, 0, 0], lineWidth: 0.15,
      textColor: [0, 0, 0], valign: "middle", overflow: "linebreak",
    },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold", halign: "center", fontSize: 7 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 9, halign: "center" },
      1: { cellWidth: 15, halign: "center" },
      2: { cellWidth: 40 },
      3: { cellWidth: 22, halign: "center" },
      4: { cellWidth: 26 },
      5: { cellWidth: 24 },
      6: { cellWidth: 20, halign: "center" },
      7: { cellWidth: 34 },
    },
    didDrawPage: (data) => {
      drawHeader();
      const pageCount = (doc as any).internal.getNumberOfPages();
      const pageCur = (data as any).pageNumber;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(`Página ${pageCur} de ${pageCount}`, pageW - margin, 291, { align: "right" });
      doc.text("SESMT • DMN Estaleiro", margin, 291);
    },
  });

  return doc;
}
