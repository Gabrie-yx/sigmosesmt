import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import dmnLogo from "@/assets/dmn-logo.png";

type Emp = Record<string, any>;

function fmtBR(d?: string | null) {
  if (!d) return "";
  const [y, m, day] = d.split("T")[0].split("-");
  return y && m && day ? `${day}/${m}/${y}` : d;
}

export function gerarPdfListagemFuncionarios(
  employees: Emp[],
  companyMap: Map<string, string>,
  roleMap: Map<string, string>,
  opts: { empresaLabel?: string; statusLabel?: string; periodoAdmissao?: string; periodoDesligamento?: string; avisoSemAdmissao?: string } = {},
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210;
  const margin = 10;
  const contentW = pageW - margin * 2;
  const hojeBR = new Date().toLocaleDateString("pt-BR");

  const sorted = [...employees].sort((a, b) =>
    String(a.nome ?? "").localeCompare(String(b.nome ?? ""), "pt-BR"),
  );

  const rows = sorted.map((e, idx) => [
    String(idx + 1).padStart(3, "0"),
    e.matricula ?? "—",
    e.nome ?? "",
    e.cpf ?? "—",
    roleMap.get(e.role_id) ?? "—",
    companyMap.get(e.company_id) ?? "—",
    fmtBR(e.admissao) || "—",
    fmtBR(e.data_desligamento) || "—",
    e.status ?? "—",
  ]);

  const drawHeader = () => {
    const y = margin;
    const hasPeriodo = !!(opts.periodoAdmissao || opts.periodoDesligamento);
    const headerH = hasPeriodo ? 23 : 18;
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.rect(margin, y, contentW, headerH);
    try { doc.addImage(dmnLogo as any, "PNG", margin + 3, y + 3, 32, 12); } catch { /* noop */ }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("LISTAGEM DE FUNCIONÁRIOS", pageW / 2, y + 8, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    const sub = `Empresa: ${opts.empresaLabel ?? "Todas"}   •   Status: ${opts.statusLabel ?? "Todos"}   •   Total: ${employees.length}`;
    doc.text(sub, pageW / 2, y + 13.5, { align: "center" });
    if (hasPeriodo) {
      doc.setFontSize(7.5);
      const parts: string[] = [];
      if (opts.periodoAdmissao) parts.push(`Admissões: ${opts.periodoAdmissao}`);
      if (opts.periodoDesligamento) parts.push(`Desligamentos: ${opts.periodoDesligamento}`);
      doc.text(parts.join("   •   "), pageW / 2, y + 18, { align: "center" });
    }
    doc.setFontSize(7.5);
    doc.text(`Emitido em ${hojeBR}`, pageW - margin - 3, y + 5, { align: "right" });
    if (opts.avisoSemAdmissao) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7);
      doc.setTextColor(180, 100, 0);
      doc.text(`⚠ ${opts.avisoSemAdmissao}`, pageW / 2, y + headerH + 3, { align: "center" });
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
    }
  };

  drawHeader();

  autoTable(doc, {
    startY: margin + (opts.periodoAdmissao || opts.periodoDesligamento ? 27 : 22) + (opts.avisoSemAdmissao ? 5 : 0),
    margin: { top: margin + (opts.periodoAdmissao || opts.periodoDesligamento ? 27 : 22) + (opts.avisoSemAdmissao ? 5 : 0), left: margin, right: margin, bottom: 20 },
    theme: "grid",
    tableWidth: contentW,
    head: [["Nº", "Matrícula", "Nome", "CPF", "Cargo", "Empresa", "Admissão", "Desligamento", "Status"]],
    body: rows,
    styles: {
      fontSize: 7,
      cellPadding: 1.6,
      lineColor: [0, 0, 0],
      lineWidth: 0.15,
      textColor: [0, 0, 0],
      valign: "middle",
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
      fontSize: 7,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 9, halign: "center" },
      1: { cellWidth: 16, halign: "center" },
      2: { cellWidth: 44 },
      3: { cellWidth: 22, halign: "center" },
      4: { cellWidth: 24 },
      5: { cellWidth: 26 },
      6: { cellWidth: 15, halign: "center" },
      7: { cellWidth: 15, halign: "center" },
      8: { cellWidth: 19, halign: "center" },
    },
    didDrawPage: (data) => {
      drawHeader();
      const pageCount = (doc as any).internal.getNumberOfPages();
      const pageCur = (data as any).pageNumber;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(
        `Página ${pageCur} de ${pageCount}`,
        pageW - margin,
        297 - 6,
        { align: "right" },
      );
      doc.text(
        "SESMT • DMN Estaleiro",
        margin,
        297 - 6,
      );
    },
  });

  return doc;
}