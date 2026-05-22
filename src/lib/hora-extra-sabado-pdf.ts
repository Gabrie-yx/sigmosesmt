import jsPDF from "jspdf";

export type HoraExtraPdfParams = {
  data: string; // dd/mm/yyyy
  diaSemana: string;
  turno?: string | null;
  horario?: string | null;
  setor?: string | null;
  centroCusto?: string | null;
  tipoEfetivo: "DMN" | "MEI" | "TERCEIRIZADO";
  empresaNome?: string | null;
  observacao?: string | null;
  funcionarios: {
    nome: string;
    transporte: boolean;
    alimentacao: boolean;
    presenca?: string | null;
  }[];
  logoDataUrl?: string | null;
};

export function gerarHoraExtraSabadoPDF(p: HoraExtraPdfParams): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 8;
  const contentW = pageW - margin * 2;

  // Header: logo | título
  const headerH = 18;
  doc.setLineWidth(0.3);
  doc.rect(margin, margin, contentW, headerH);
  const logoColW = 45;
  doc.line(margin + logoColW, margin, margin + logoColW, margin + headerH);

  if (p.logoDataUrl) {
    try {
      doc.addImage(p.logoDataUrl, "PNG", margin + 4, margin + 2, logoColW - 8, headerH - 4, undefined, "FAST");
    } catch {}
  } else {
    doc.setFont("helvetica", "bold").setFontSize(14);
    doc.text("DMN", margin + logoColW / 2, margin + headerH / 2 + 2, { align: "center" });
  }

  doc.setFont("helvetica", "bold").setFontSize(14);
  doc.text("FORMULÁRIO DE HORA EXTRA", margin + logoColW + (contentW - logoColW) / 2, margin + headerH / 2 + 1.5, { align: "center" });

  // Info block
  let y = margin + headerH;
  const infoH = 26;
  doc.rect(margin, y, contentW, infoH);
  const infoColW = contentW / 2;
  doc.line(margin + infoColW, y, margin + infoColW, y + infoH);

  // Left column
  doc.setFont("helvetica", "bold").setFontSize(9);
  doc.setTextColor(220, 38, 38);
  doc.text(`Data: ${p.data}`, margin + 2, y + 5);
  doc.setTextColor(0, 0, 0);
  doc.text(p.diaSemana.toUpperCase(), margin + 2, y + 10);
  doc.text(`Turno: ${p.turno ?? "—"}`, margin + 2, y + 15);
  doc.text(`Horário: ${p.horario ?? "—"}`, margin + 2, y + 20);

  // Right column
  doc.text(`SETOR: ${p.setor ?? "—"}`, margin + infoColW + 2, y + 5);
  doc.text(`C.C.: ${p.centroCusto ?? "—"}`, margin + infoColW + 2, y + 10);

  doc.setFont("helvetica", "normal").setFontSize(9);
  const mark = (b: boolean) => (b ? "X" : " ");
  doc.text(`EFETIVO     ( ${mark(p.tipoEfetivo === "DMN")} ) DMN`, margin + infoColW + 2, y + 16);
  doc.text(`MEI                ( ${mark(p.tipoEfetivo === "MEI")} )`, margin + infoColW + 2, y + 20);
  doc.text(`PRESTADOR DE SERVIÇO ( ${mark(p.tipoEfetivo === "TERCEIRIZADO")} ) TERCERIZADOS`, margin + infoColW + 2, y + 24);

  // FUNCIONÁRIO(S) label row
  y += infoH;
  const labelH = 7;
  doc.rect(margin, y, contentW, labelH);
  doc.setFont("helvetica", "bold").setFontSize(9);
  doc.text("FUNCIONÁRIO(S):", margin + 2, y + 5);

  // EQUIPE banner
  y += labelH;
  const bannerH = 7;
  doc.setFillColor(180, 198, 220);
  doc.rect(margin, y, contentW, bannerH, "F");
  doc.rect(margin, y, contentW, bannerH);
  doc.setTextColor(0, 0, 0);
  doc.text(`EQUIPE ${p.tipoEfetivo === "DMN" ? "EFETIVO" : p.tipoEfetivo} - ${p.diaSemana.toUpperCase()}`, margin + contentW / 2, y + 5, { align: "center" });

  // Table header
  y += bannerH;
  const headRowH = 9;
  const colIt = 10;
  const colNome = 70;
  const colTrans = 26;
  const colAlim = 24;
  const colPres = 26;
  const colAss = contentW - colIt - colNome - colTrans - colAlim - colPres;

  doc.rect(margin, y, contentW, headRowH);
  let x = margin;
  doc.line(x + colIt, y, x + colIt, y + headRowH); x += colIt;
  doc.line(x + colNome, y, x + colNome, y + headRowH); x += colNome;
  doc.line(x + colTrans, y, x + colTrans, y + headRowH); x += colTrans;
  doc.line(x + colAlim, y, x + colAlim, y + headRowH); x += colAlim;
  doc.line(x + colPres, y, x + colPres, y + headRowH);

  doc.setFont("helvetica", "bold").setFontSize(8);
  doc.text("IT", margin + colIt / 2, y + 6, { align: "center" });
  doc.text("NOME COMPLETO", margin + colIt + colNome / 2, y + 6, { align: "center" });
  doc.text("TRANSPORTE", margin + colIt + colNome + colTrans / 2, y + 6, { align: "center" });
  doc.text("ALIMENTAÇÃO", margin + colIt + colNome + colTrans + colAlim / 2, y + 6, { align: "center" });
  doc.setFontSize(7);
  doc.text("(P) Presente (F)", margin + colIt + colNome + colTrans + colAlim + colPres / 2, y + 4, { align: "center" });
  doc.text("Faltou", margin + colIt + colNome + colTrans + colAlim + colPres / 2, y + 7.5, { align: "center" });
  doc.setFontSize(8);
  doc.text("ASSINATURA", margin + colIt + colNome + colTrans + colAlim + colPres + colAss / 2, y + 6, { align: "center" });

  y += headRowH;

  // Rows
  const rowH = 9;
  const maxRows = Math.floor((pageH - margin - y) / rowH);
  const rowsToDraw = Math.max(p.funcionarios.length, Math.min(20, maxRows));

  doc.setFont("helvetica", "normal").setFontSize(9);

  for (let i = 0; i < rowsToDraw; i++) {
    if (y + rowH > pageH - margin) {
      doc.addPage();
      y = margin;
    }
    const f = p.funcionarios[i];
    // Borders
    doc.rect(margin, y, contentW, rowH);
    let xx = margin;
    doc.line(xx + colIt, y, xx + colIt, y + rowH); xx += colIt;
    doc.line(xx + colNome, y, xx + colNome, y + rowH); xx += colNome;
    doc.line(xx + colTrans, y, xx + colTrans, y + rowH); xx += colTrans;
    doc.line(xx + colAlim, y, xx + colAlim, y + rowH); xx += colAlim;
    doc.line(xx + colPres, y, xx + colPres, y + rowH);

    if (f) {
      doc.setTextColor(0, 0, 0);
      doc.text(String(i + 1), margin + colIt / 2, y + 6, { align: "center" });
      const nome = f.nome.length > 38 ? f.nome.substring(0, 36) + "…" : f.nome;
      doc.text(nome.toUpperCase(), margin + colIt + 2, y + 6);
      // Transporte: line for "no" or X
      if (f.transporte) {
        doc.setTextColor(220, 38, 38);
        doc.text("X", margin + colIt + colNome + colTrans / 2, y + 6, { align: "center" });
      } else {
        doc.setDrawColor(0, 0, 0);
        doc.line(margin + colIt + colNome + 5, y + 6, margin + colIt + colNome + colTrans - 5, y + 6);
      }
      // Alimentação
      if (f.alimentacao) {
        doc.setTextColor(220, 38, 38);
        doc.text("X", margin + colIt + colNome + colTrans + colAlim / 2, y + 6, { align: "center" });
      }
      // Presença
      if (f.presenca) {
        doc.setTextColor(0, 0, 0);
        doc.text(f.presenca, margin + colIt + colNome + colTrans + colAlim + colPres / 2, y + 6, { align: "center" });
      }
      doc.setTextColor(0, 0, 0);
    }
    y += rowH;
  }

  // Observação
  if (p.observacao && y + 20 < pageH - margin) {
    y += 3;
    doc.setFont("helvetica", "bold").setFontSize(8);
    doc.text("OBSERVAÇÃO:", margin, y + 4);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(p.observacao, contentW - 4);
    doc.text(lines, margin, y + 8);
  }

  return doc;
}
