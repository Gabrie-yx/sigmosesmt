import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type DDSFormParams = {
  matrizNome: string;       // "J C S CONSTRUÇÃO NAVAL"
  matrizCnpj: string;       // CNPJ matriz
  codigo: string;           // "FOR-SEG 06"
  revisao: string;          // "00"
  dataDocumento: string;    // "30/08/2025"
  pagina: string;           // "01/02"
  empresaNome: string;
  empresaCnpj?: string | null;
  localSetor: string;
  periodoTexto: string;     // "04/05 à 08/05/2026"
  horaTexto: string;        // "07h30min às 07h40min"
  assuntos: string;         // "29- ... / 58- ... / 52- ..."
  funcionarios: { nome: string; funcao?: string | null }[];
  encarregado?: string | null;
  responsavelSesmt?: string | null;
  assinaturaResponsavelDataUrl?: string | null;
};

export function gerarFormularioSemanalDDS(p: DDSFormParams, existingDoc?: jsPDF): jsPDF {
  const doc = existingDoc ?? new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  if (existingDoc) {
    doc.addPage("a4", "landscape");
  }
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 6;

  // Cabeçalho — bloco 3 colunas
  const headerY = margin;
  const headerH = 14;
  doc.setLineWidth(0.3);
  doc.rect(margin, headerY, pageW - margin * 2, headerH);
  // coluna 1 — matriz
  const c1W = 70;
  doc.line(margin + c1W, headerY, margin + c1W, headerY + headerH);
  doc.setFont("helvetica", "bold").setFontSize(9);
  doc.text(p.matrizNome, margin + c1W / 2, headerY + 5, { align: "center" });
  doc.setFontSize(8);
  doc.text(`CNPJ: ${p.matrizCnpj}`, margin + c1W / 2, headerY + 9.5, { align: "center" });
  // coluna 2 — título
  const c3W = 55;
  const c2W = pageW - margin * 2 - c1W - c3W;
  doc.line(margin + c1W + c2W, headerY, margin + c1W + c2W, headerY + headerH);
  doc.setFont("helvetica", "bold").setFontSize(9);
  doc.text(
    "Diálogo Diário de Segurança, Meio Ambiente e Saúde\nResponsabilidade Social  -  DDSMS-RS",
    margin + c1W + c2W / 2,
    headerY + 6,
    { align: "center" }
  );
  // coluna 3 — código
  doc.setFont("helvetica", "normal").setFontSize(8);
  const c3X = margin + c1W + c2W + 2;
  doc.text(`CÓD.: ${p.codigo}`, c3X, headerY + 3.5);
  doc.text(`REVISÃO: ${p.revisao}`, c3X, headerY + 7);
  doc.text(`DATA: ${p.dataDocumento}`, c3X, headerY + 10.5);
  doc.text(`PÁG.: ${p.pagina}`, c3X, headerY + 14 - 0.5);

  // Bloco empresa
  let y = headerY + headerH;
  const rowH = 6;
  doc.rect(margin, y, pageW - margin * 2, rowH);
  doc.setFont("helvetica", "bold").setFontSize(10);
  doc.text(`EMPRESA:  ${p.empresaNome}`, margin + 2, y + 4);
  doc.text(`CNPJ: ${p.empresaCnpj ?? ""}`, margin + (pageW - margin * 2) / 2, y + 4);
  y += rowH;
  doc.rect(margin, y, pageW - margin * 2, rowH);
  doc.setFont("helvetica", "bold").setFontSize(9);
  doc.text("Local/Setor:", margin + 2, y + 4);
  doc.setFont("helvetica", "italic");
  doc.text(p.localSetor, margin + 24, y + 4);
  y += rowH;
  doc.rect(margin, y, pageW - margin * 2, rowH);
  const halfW = (pageW - margin * 2) / 2;
  doc.line(margin + halfW, y, margin + halfW, y + rowH);
  doc.setFont("helvetica", "bold");
  doc.text("Data:", margin + 2, y + 4);
  doc.setFont("helvetica", "italic");
  doc.text(p.periodoTexto, margin + 14, y + 4);
  doc.setFont("helvetica", "bold");
  doc.text("Hora:", margin + halfW + 2, y + 4);
  doc.setFont("helvetica", "italic");
  doc.text(p.horaTexto, margin + halfW + 14, y + 4);
  y += rowH;

  // Faixa "ASSUNTOS ABORDADOS NA SEMANA"
  doc.setFillColor(220, 220, 220);
  doc.rect(margin, y, pageW - margin * 2, rowH, "FD");
  doc.setFont("helvetica", "bold").setFontSize(9);
  doc.text("ASSUNTOS ABORDADOS NA SEMANA", pageW / 2, y + 4, { align: "center" });
  y += rowH;
  doc.rect(margin, y, pageW - margin * 2, rowH);
  doc.setFont("helvetica", "normal").setFontSize(8);
  doc.text(p.assuntos, pageW / 2, y + 4, { align: "center" });
  y += rowH;

  // Tabela de funcionários
  const head = [[
    { content: "#", rowSpan: 2 },
    { content: "NOME DO FUNCIONÁRIO", rowSpan: 2 },
    { content: "FUNÇÃO", rowSpan: 2 },
    { content: "ASSINATURA DE PARTICIPAÇÃO", colSpan: 5 },
  ], [
    { content: "SEGUNDA" },
    { content: "TERÇA" },
    { content: "QUARTA" },
    { content: "QUINTA" },
    { content: "SEXTA" },
  ]];

  // Linhas mínimas para preencher visualmente a página, sem estourar para uma página em branco.
  // Em A4 paisagem, descontando cabeçalho (~50mm) e rodapé de assinatura (~30mm), cabem ~18 linhas de 6mm.
  // Aperta o layout para caber mais linhas em uma única página A4 paisagem.
  const MAX_ROWS_PER_PAGE = 22;
  const rows = [...p.funcionarios];
  if (rows.length < MAX_ROWS_PER_PAGE) {
    while (rows.length < MAX_ROWS_PER_PAGE) rows.push({ nome: "", funcao: "" });
  }

  const body = rows.map((f, i) => [
    String(i + 1),
    f.nome ?? "",
    f.funcao ?? "",
    "", "", "", "", "",
  ]);

  autoTable(doc, {
    head: head as any,
    body,
    startY: y,
    theme: "grid",
    // Reserva ~30mm no rodapé para o bloco de assinatura — evita que o autoTable
    // crie uma página extra só para acomodar 1-2 linhas que não couberam.
    margin: { left: margin, right: margin, bottom: 28 },
    rowPageBreak: "avoid",
    styles: { fontSize: 7.5, cellPadding: 0.6, lineColor: [0, 0, 0], lineWidth: 0.2, minCellHeight: 4.6 },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: "bold", halign: "center", lineColor: [0, 0, 0], lineWidth: 0.2 },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 60 },
      2: { cellWidth: 40 },
      3: { cellWidth: "auto" },
      4: { cellWidth: "auto" },
      5: { cellWidth: "auto" },
      6: { cellWidth: "auto" },
      7: { cellWidth: "auto" },
    },
  });

  // Desenha o rodapé de assinatura SEMPRE na última página gerada pelo autoTable
  // desta empresa (funciona tanto pra tabela de 1 página quanto pra multi-páginas).
  const lastPage = doc.getNumberOfPages();
  doc.setPage(lastPage);
  const bannerY = pageH - 24;
  doc.setFillColor(220, 220, 220);
  doc.rect(margin, bannerY, pageW - margin * 2, 5, "FD");
  doc.setFont("helvetica", "bold").setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.text("CONVERSEI COM OS EMPREGADOS ACIMA, A RESPEITO DOS ASSUNTOS CONFORME INDICADOS PELOS CÓDIGOS E TEMAS NO FORMULÁRIO.",
    pageW / 2, bannerY + 3.5, { align: "center" });
  const sigY = bannerY + 14;
  doc.setLineWidth(0.3);
  doc.line(margin + 20, sigY, margin + 110, sigY);
  doc.line(pageW - margin - 110, sigY, pageW - margin - 20, sigY);
  doc.setFont("helvetica", "normal").setFontSize(8);
  doc.text(p.encarregado ?? "", margin + 65, sigY - 1, { align: "center" });
  doc.text(p.responsavelSesmt ?? "", pageW - margin - 65, sigY - 1, { align: "center" });
  if (p.assinaturaResponsavelDataUrl) {
    try {
      const imgW = 50;
      const imgH = 18;
      const cx = pageW - margin - 65;
      doc.addImage(p.assinaturaResponsavelDataUrl, "PNG", cx - imgW / 2, sigY - imgH, imgW, imgH);
    } catch {
      // ignora se imagem inválida
    }
  }
  doc.setFont("helvetica", "bold");
  doc.text("ENCARREGADO / DESIGNADO", margin + 65, sigY + 4, { align: "center" });
  doc.text("SESMT", pageW - margin - 65, sigY + 4, { align: "center" });

  return doc;
}