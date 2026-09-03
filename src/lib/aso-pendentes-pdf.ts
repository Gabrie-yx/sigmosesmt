import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import dmnLogo from "@/assets/dmn-logo.png";

export type LinhaAsoPendente = {
  matricula: string | null;
  nome: string;
  cargo: string;
  empresa: string;
  ultimo: string | null;      // dd/mm/aaaa
  vencimento: string | null;  // dd/mm/aaaa
  situacao: "VENCIDO" | "SEM ASO" | "A VENCER";
  dias: number | null;        // negativo = atraso
};

export function gerarPdfAsoPendentes(
  linhas: LinhaAsoPendente[],
  opts: { empresaLabel?: string; situacaoLabel?: string; periodoLabel?: string } = {},
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = 297;
  const margin = 10;
  const contentW = pageW - margin * 2;
  const hojeBR = new Date().toLocaleDateString("pt-BR");

  const headerH = 20;
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(margin, margin, contentW, headerH);
  try { doc.addImage(dmnLogo as any, "PNG", margin + 3, margin + 4, 32, 12); } catch { /* noop */ }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("RELATÓRIO DE ASOs ATRASADOS / SEM ASO", pageW / 2, margin + 8, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(
    `Empresa: ${opts.empresaLabel ?? "Todas"}   •   Situação: ${opts.situacaoLabel ?? "Vencidos e sem ASO"}   •   ${opts.periodoLabel ?? "Período: todo o histórico"}   •   Total: ${linhas.length}`,
    pageW / 2, margin + 14, { align: "center" },
  );
  doc.setFontSize(7.5);
  doc.text(`Emitido em ${hojeBR}`, pageW - margin - 3, margin + 5, { align: "right" });

  const rows = linhas.map((l, i) => [
    String(i + 1).padStart(3, "0"),
    l.matricula ?? "—",
    l.nome,
    l.cargo || "—",
    l.empresa || "—",
    l.ultimo ?? "—",
    l.vencimento ?? "—",
    l.situacao,
    l.dias === null ? "—" : l.dias < 0 ? `${Math.abs(l.dias)} d em atraso` : `${l.dias} d`,
  ]);

  const startY = margin + headerH + 4;
  autoTable(doc, {
    startY,
    margin: { top: startY, left: margin, right: margin, bottom: 18 },
    theme: "grid",
    head: [["#", "Matrícula", "Nome", "Cargo / Função", "Empresa", "Último ASO", "Vencimento", "Situação", "Prazo"]],
    body: rows,
    styles: { font: "helvetica", fontSize: 8, cellPadding: 1.6, lineColor: [40, 40, 40], lineWidth: 0.15 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold", fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 20 },
      2: { cellWidth: 62 },
      3: { cellWidth: 45 },
      4: { cellWidth: 45 },
      5: { cellWidth: 22, halign: "center" },
      6: { cellWidth: 22, halign: "center" },
      7: { cellWidth: 22, halign: "center" },
      8: { cellWidth: 29, halign: "center" },
    },
    didParseCell: (d) => {
      if (d.section === "body" && d.column.index === 7) {
        const v = String(d.cell.raw);
        if (v === "VENCIDO") d.cell.styles.textColor = [180, 30, 30];
        else if (v === "SEM ASO") d.cell.styles.textColor = [140, 80, 0];
      }
    },
    didDrawPage: () => {
      const h = doc.internal.pageSize.getHeight();
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7);
      doc.text(
        "Base legal: NR-07 (PCMSO) — exame periódico obrigatório. Relatório gerado pelo SIGMO.",
        margin, h - 8,
      );
      doc.setFont("helvetica", "normal");
      doc.text(`Página ${doc.getNumberOfPages()}`, pageW - margin, h - 8, { align: "right" });
    },
  });

  return doc;
}
