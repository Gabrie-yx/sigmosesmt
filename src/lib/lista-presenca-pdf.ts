import jsPDF from "jspdf";

export type ListaPresencaParams = {
  titulo: string;
  instrutor: string;
  assinaturaDataUrl?: string | null; // PNG signature data URL
  assunto: string;
  tipo: "INTERNO" | "EXTERNO" | "IN COMPANY" | "";
  data: string; // dd/mm/yyyy
  cargaHoraria: string;
  instituicao: string;
  local: string;
  participantes: { nome: string; empresa: string; cargo: string }[];
  codigo?: string;
  revisao?: string;
  dataDocumento?: string;
  logoDataUrl?: string | null;
};

const ROWS_FIRST = 15;
const ROWS_NEXT = 22;
const FOOTER_TEXT =
  '"O Grupo Atem se compromete a tratar os dados pessoais nos termos da sua Política de Gestão e Proteção de Dados Pessoais e da Lei Geral de Proteção de Dados (LGPD), sendo que os dados aqui tratados são para cumprimento de obrigação legal trabalhista e previdenciária pelo Grupo Atem."';

export function gerarListaPresenca(p: ListaPresencaParams): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 6;
  const contentW = pageW - margin * 2;
  const total = p.participantes.length;
  const totalPages = Math.max(1, 1 + Math.ceil(Math.max(0, total - ROWS_FIRST) / ROWS_NEXT));

  let pageIdx = 0;
  let participantIdx = 0;

  function getFooterLines() {
    doc.setFont("helvetica", "italic").setFontSize(5.8);
    return doc.splitTextToSize(FOOTER_TEXT, contentW - 6) as string[];
  }

  function getFooterTopY() {
    const lineHeightMm = 2.5;
    return pageH - margin - Math.max(7, getFooterLines().length * lineHeightMm + 2);
  }

  function fitTextToCell(text: string, x: number, y: number, w: number, h: number, options: { align?: "left" | "center"; bold?: boolean } = {}) {
    const align = options.align ?? "left";
    const style = options.bold ? "bold" : "normal";
    const availableW = Math.max(1, w - (align === "center" ? 2 : 3));
    let value = (text || "").toUpperCase().replace(/\s+/g, " ").trim();
    let fontSize = 8;

    doc.setFont("helvetica", style).setFontSize(fontSize);
    while (fontSize > 5.4 && doc.getTextWidth(value) > availableW) {
      fontSize -= 0.2;
      doc.setFontSize(fontSize);
    }

    if (doc.getTextWidth(value) > availableW) {
      while (value.length > 0 && doc.getTextWidth(`${value}...`) > availableW) {
        value = value.slice(0, -1).trimEnd();
      }
      value = value ? `${value}...` : "";
    }

    const textX = align === "center" ? x + w / 2 : x + 1.5;
    const textY = y + h / 2 + fontSize * 0.3528 * 0.35;
    doc.text(value, textX, textY, { align });
  }

  function drawHeader(pageNum: number) {
    doc.setLineWidth(0.3);
    const headerY = margin;
    const headerH = 16;
    // Outer rectangle
    doc.rect(margin, headerY, contentW, headerH);
    // 3 columns
    const c1W = 40; // logo
    const c3W = 55; // codigo block
    const c2W = contentW - c1W - c3W;
    doc.line(margin + c1W, headerY, margin + c1W, headerY + headerH);
    doc.line(margin + c1W + c2W, headerY, margin + c1W + c2W, headerY + headerH);

    // Logo: ATEM stylized
    if (p.logoDataUrl) {
      try { doc.addImage(p.logoDataUrl, "PNG", margin + 4, headerY + 2, 32, 12); } catch {}
    } else {
      // fallback ATEM wordmark
      doc.setFillColor(255, 165, 0);
      [0,1,2,3,4].forEach((i) => doc.circle(margin + 8 + i * 2, headerY + 4, 0.8, "F"));
      [0,1,2,3,4].forEach((i) => doc.circle(margin + 8 + i * 2, headerY + 6, 0.8, "F"));
      doc.setTextColor(20, 20, 80);
      doc.setFont("helvetica", "bold").setFontSize(18);
      doc.text("atem", margin + 20, headerY + 9);
      doc.setFontSize(6);
      doc.text("G R U P O", margin + 20, headerY + 13);
      doc.setTextColor(0, 0, 0);
    }

    // Title
    doc.setFont("helvetica", "bold").setFontSize(16);
    doc.text("LISTA DE PRESENÇA", margin + c1W + c2W / 2, headerY + 10, { align: "center" });

    // Codigo block
    doc.setFont("helvetica", "normal").setFontSize(8);
    const c3X = margin + c1W + c2W + 2;
    doc.text(`CÓD.: ${p.codigo ?? "FORCP-GP-05"}`, c3X, headerY + 4);
    doc.text(`REVISÃO: ${p.revisao ?? "01"}`, c3X, headerY + 8);
    doc.text(`DATA: ${p.dataDocumento ?? "23/06/2025"}`, c3X, headerY + 12);
    doc.text(`PÁG.: ${pageNum}/${totalPages}`, c3X, headerY + 15.5);

    let y = headerY + headerH;

    // Row: TÍTULO | INSTRUTOR | ASSINATURA
    const rowH = 14;
    doc.rect(margin, y, contentW, rowH);
    const colATitW = contentW * 0.40;
    const colBInsW = contentW * 0.32;
    const colCAssW = contentW - colATitW - colBInsW;
    doc.line(margin + colATitW, y, margin + colATitW, y + rowH);
    doc.line(margin + colATitW + colBInsW, y, margin + colATitW + colBInsW, y + rowH);
    doc.setFont("helvetica", "bold").setFontSize(8);
    doc.text("TÍTULO:", margin + 1.5, y + 3.5);
    doc.text("INSTRUTOR:", margin + colATitW + 1.5, y + 3.5);
    doc.text("ASSINATURA:", margin + colATitW + colBInsW + 1.5, y + 3.5);
    doc.setFont("helvetica", "normal").setFontSize(10);
    doc.text(p.titulo || "", margin + 2, y + 9, { maxWidth: colATitW - 4 });
    doc.text(p.instrutor || "", margin + colATitW + 2, y + 9, { maxWidth: colBInsW - 4 });
    if (p.assinaturaDataUrl) {
      try {
        doc.addImage(p.assinaturaDataUrl, "PNG", margin + colATitW + colBInsW + 2, y + 4, colCAssW - 4, rowH - 5);
      } catch {}
    }
    y += rowH;

    // Row: ASSUNTO | TIPO header
    const rowH2 = 5;
    doc.rect(margin, y, contentW, rowH2);
    const tipoColW = contentW * 0.55;
    doc.line(margin + (contentW - tipoColW), y, margin + (contentW - tipoColW), y + rowH2);
    doc.setFont("helvetica", "bold").setFontSize(8);
    doc.text("ASSUNTO:", margin + 1.5, y + 3.5);
    doc.text("TIPO", margin + (contentW - tipoColW) + tipoColW / 2, y + 3.5, { align: "center" });
    y += rowH2;

    // Assunto value | tipo subdivisions
    const rowH3 = 7;
    doc.rect(margin, y, contentW, rowH3);
    doc.line(margin + (contentW - tipoColW), y, margin + (contentW - tipoColW), y + rowH3);
    // Three subcells
    const tipoCellW = tipoColW / 3;
    const tipoStart = margin + (contentW - tipoColW);
    doc.line(tipoStart + tipoCellW, y, tipoStart + tipoCellW, y + rowH3);
    doc.line(tipoStart + 2 * tipoCellW, y, tipoStart + 2 * tipoCellW, y + rowH3);
    doc.setFont("helvetica", "normal").setFontSize(10);
    doc.text(p.assunto || "", margin + 2, y + 4.5, { maxWidth: contentW - tipoColW - 4 });
    doc.setFont("helvetica", "bold").setFontSize(9);
    const tipos: Array<["INTERNO" | "EXTERNO" | "IN COMPANY", number]> = [
      ["INTERNO", 0], ["EXTERNO", 1], ["IN COMPANY", 2]
    ];
    tipos.forEach(([label, i]) => {
      const cx = tipoStart + i * tipoCellW + tipoCellW / 2;
      const checked = p.tipo === label ? "X" : " ";
      doc.text(`${label} ( ${checked} )`, cx, y + 4.5, { align: "center" });
    });
    y += rowH3;

    // Row: DATA | C HORARIA | INSTITUIÇÃO | LOCAL
    const rowH4 = 7;
    doc.rect(margin, y, contentW, rowH4);
    const cw = [contentW * 0.16, contentW * 0.20, contentW * 0.32, contentW - contentW * 0.16 - contentW * 0.20 - contentW * 0.32];
    let cx = margin;
    cw.forEach((w, i) => { if (i > 0) doc.line(cx, y, cx, y + rowH4); cx += w; });
    doc.setFont("helvetica", "bold").setFontSize(8);
    const labels = ["DATA:", "C. HORÁRIA TOTAL:", "INSTITUIÇÃO:", "LOCAL:"];
    const values = [p.data, p.cargaHoraria, p.instituicao, p.local];
    cx = margin;
    labels.forEach((lab, i) => {
      doc.setFont("helvetica", "bold").setFontSize(8);
      doc.text(lab, cx + 1.5, y + 3.2);
      doc.setFont("helvetica", "normal").setFontSize(9);
      doc.text(values[i] || "", cx + 1.5, y + 6.2, { maxWidth: cw[i] - 3 });
      cx += cw[i];
    });
    y += rowH4;

    return y;
  }

  function drawTable(yStart: number, rowsCount: number) {
    // Header row 1: PARTICIPANTES | DATA E RUBRICA
    const partW = contentW * 0.55;
    const datW = contentW - partW;
    const headH = 5;
    doc.setLineWidth(0.3);
    doc.rect(margin, yStart, partW, headH);
    doc.rect(margin + partW, yStart, datW, headH);
    doc.setFont("helvetica", "bold").setFontSize(8);
    doc.text("PARTICIPANTES", margin + partW / 2, yStart + 3.5, { align: "center" });
    doc.text("DATA E RUBRICA", margin + partW + datW / 2, yStart + 3.5, { align: "center" });

    // Header row 2: N° | NOME | EMPRESA | CARGO | + 5 empty rubrica cols
    const subY = yStart + headH;
    const subH = 5;
    const colN = 8;
    const restPart = partW - colN;
    const colNome = restPart * 0.45;
    const colEmpresa = restPart * 0.30;
    const colCargo = restPart - colNome - colEmpresa;
    const subCols = [colN, colNome, colEmpresa, colCargo];
    let cx = margin;
    doc.setFont("helvetica", "bold").setFontSize(7);
    subCols.forEach((w, i) => {
      doc.rect(cx, subY, w, subH);
      const label = ["Nº", "NOME", "EMPRESA", "CARGO"][i];
      doc.text(label, cx + w / 2, subY + 3.5, { align: "center" });
      cx += w;
    });
    // 5 sub cols rubrica
    const rubCol = datW / 5;
    for (let i = 0; i < 5; i++) {
      doc.rect(margin + partW + i * rubCol, subY, rubCol, subH);
    }

    // Body rows — a tabela para antes da área real do rodapé LGPD.
    let ry = subY + subH;
    const availH = getFooterTopY() - 2 - ry;
    const rowH = Math.min(8, availH / rowsCount);
    for (let r = 0; r < rowsCount; r++) {
      cx = margin;
      const rowNum = participantIdx + 1;
      const part = p.participantes[participantIdx];
      participantIdx++;
      // N°
      doc.rect(cx, ry, subCols[0], rowH);
      fitTextToCell(String(rowNum), cx, ry, subCols[0], rowH, { align: "center" });
      cx += subCols[0];
      // NOME
      doc.rect(cx, ry, subCols[1], rowH);
      if (part) fitTextToCell(part.nome, cx, ry, subCols[1], rowH);
      cx += subCols[1];
      // EMPRESA
      doc.rect(cx, ry, subCols[2], rowH);
      if (part) fitTextToCell(part.empresa, cx, ry, subCols[2], rowH);
      cx += subCols[2];
      // CARGO
      doc.rect(cx, ry, subCols[3], rowH);
      if (part) fitTextToCell(part.cargo, cx, ry, subCols[3], rowH);
      cx += subCols[3];
      // 5 rubrica empty
      for (let i = 0; i < 5; i++) {
        doc.rect(margin + partW + i * rubCol, ry, rubCol, rowH);
      }
      ry += rowH;
    }
    return ry;
  }

  function drawFooter() {
    doc.setFont("helvetica", "italic").setFontSize(5.8);
    const lines = getFooterLines();
    const lineHeightMm = 2.5;
    lines.forEach((line, index) => {
      doc.text(line, pageW / 2, getFooterTopY() + 2.6 + index * lineHeightMm, {
        align: "center",
      });
    });
  }

  for (pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    if (pageIdx > 0) doc.addPage();
    const y = drawHeader(pageIdx + 1);
    const rowsThisPage = pageIdx === 0 ? ROWS_FIRST : ROWS_NEXT;
    drawTable(y, rowsThisPage);
    drawFooter();
  }

  return doc;
}
