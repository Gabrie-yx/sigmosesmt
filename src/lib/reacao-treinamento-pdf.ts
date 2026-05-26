import jsPDF from "jspdf";

export type ReacaoTreinamentoParams = {
  empresa?: string;
  data: string; // dd/mm/yyyy
  tipo: "INTERNO" | "EXTERNO" | "";
  instrutor: string;
  instituicao: string;
  tstNome?: string;
  tstAssinaturaDataUrl?: string | null;
  codigo?: string;
  revisao?: string;
  dataDocumento?: string;
  logoDataUrl?: string | null;
};

const CONTEUDO_ITENS = [
  "Os objetivos do treinamento foram claramente apresentados",
  "O conteúdo do treinamento atendeu aos objetivos propostos",
  "O conteúdo abordado é aplicável às atividades que desempenho",
  "A carga horária foi adequada ao conteúdo",
];
const INSTRUTOR_ITENS = [
  "Demonstrou domínio do conteúdo apresentado",
  "Apresentou o conteúdo com clareza e objetividade",
  "Estimulou a participação dos treinandos",
  "Esclareceu as dúvidas apresentadas",
  "Cumpriu o horário e o cronograma estabelecidos",
];
const RECURSOS_ITENS = [
  "Os recursos didáticos utilizados foram adequados (material, projeção, ambiente)",
];

const ESCALA = [
  ["4", "ÓTIMO"],
  ["3", "BOM"],
  ["2", "REGULAR"],
  ["1", "RUIM"],
];

const AVAL_GERAL = [
  "Superou as expectativas",
  "Atendeu plenamente",
  "Atendeu parcialmente",
  "Não atendeu",
];

export function gerarAvaliacaoReacao(p: ReacaoTreinamentoParams): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentW = pageW - margin * 2;

  // ===== HEADER =====
  const headerH = 16;
  doc.setLineWidth(0.3);
  doc.rect(margin, margin, contentW, headerH);
  const c1W = 32; // logo
  const c3W = 50; // control
  const c2W = contentW - c1W - c3W;
  doc.line(margin + c1W, margin, margin + c1W, margin + headerH);
  doc.line(margin + c1W + c2W, margin, margin + c1W + c2W, margin + headerH);

  if (p.logoDataUrl) {
    try { doc.addImage(p.logoDataUrl, "PNG", margin + 2, margin + 2, 28, 12); } catch {}
  } else {
    doc.setFont("helvetica", "bold").setFontSize(14);
    doc.text("DMN", margin + c1W / 2, margin + 10, { align: "center" });
  }

  doc.setFont("helvetica", "bold").setFontSize(13);
  doc.text("AVALIAÇÃO DE REAÇÃO DO TREINAMENTO", margin + c1W + c2W / 2, margin + 10, { align: "center" });

  doc.setFont("helvetica", "normal").setFontSize(8);
  const c3X = margin + c1W + c2W + 2;
  doc.text(`CÓD.: ${p.codigo ?? "FORCP-GP-16"}`, c3X, margin + 4);
  doc.text(`REVISÃO: ${p.revisao ?? "00"}`, c3X, margin + 8);
  doc.text(`DATA: ${p.dataDocumento ?? "23/06/2025"}`, c3X, margin + 12);
  doc.text(`PÁG.: 1/1`, c3X, margin + 15.5);

  let y = margin + headerH;

  // ===== DADOS DO TREINAMENTO =====
  doc.setFillColor(230, 230, 230);
  doc.rect(margin, y, contentW, 5, "FD");
  doc.setFont("helvetica", "bold").setFontSize(8);
  doc.text("DADOS DO TREINAMENTO", margin + contentW / 2, y + 3.5, { align: "center" });
  y += 5;

  const dadosRowH = 6;
  // Empresa | Data
  doc.rect(margin, y, contentW, dadosRowH);
  doc.line(margin + contentW * 0.65, y, margin + contentW * 0.65, y + dadosRowH);
  doc.setFont("helvetica", "bold").setFontSize(7);
  doc.text("EMPRESA:", margin + 1.5, y + 2.5);
  doc.text("DATA:", margin + contentW * 0.65 + 1.5, y + 2.5);
  doc.setFont("helvetica", "normal").setFontSize(9);
  doc.text(p.empresa ?? "DMN ESTALEIRO DA AMAZONIA LTDA", margin + 1.5, y + 5.5);
  doc.text(p.data || "", margin + contentW * 0.65 + 1.5, y + 5.5);
  y += dadosRowH;

  // Tipo (interno/externo) - checkboxes
  doc.rect(margin, y, contentW, dadosRowH);
  doc.setFont("helvetica", "bold").setFontSize(7);
  doc.text("TIPO:", margin + 1.5, y + 2.5);
  doc.setFont("helvetica", "normal").setFontSize(9);
  const tipos: Array<["INTERNO" | "EXTERNO", number]> = [["INTERNO", 0], ["EXTERNO", 1]];
  tipos.forEach(([label, i]) => {
    const cx = margin + 25 + i * 50;
    const checked = p.tipo === label ? "X" : " ";
    doc.text(`( ${checked} ) ${label}`, cx, y + 4.5);
  });
  y += dadosRowH;

  // Instrutor | Instituicao
  doc.rect(margin, y, contentW, dadosRowH);
  doc.line(margin + contentW * 0.5, y, margin + contentW * 0.5, y + dadosRowH);
  doc.setFont("helvetica", "bold").setFontSize(7);
  doc.text("INSTRUTOR:", margin + 1.5, y + 2.5);
  doc.text("INSTITUIÇÃO:", margin + contentW * 0.5 + 1.5, y + 2.5);
  doc.setFont("helvetica", "normal").setFontSize(9);
  doc.text(p.instrutor || "", margin + 1.5, y + 5.5, { maxWidth: contentW * 0.5 - 3 });
  doc.text(p.instituicao || "", margin + contentW * 0.5 + 1.5, y + 5.5, { maxWidth: contentW * 0.5 - 3 });
  y += dadosRowH + 2;

  // ===== ESCALA =====
  doc.setFont("helvetica", "bold").setFontSize(8);
  doc.text("ESCALA DE AVALIAÇÃO:", margin, y + 3);
  doc.setFont("helvetica", "normal").setFontSize(8);
  doc.text(
    ESCALA.map(([n, l]) => `${n} = ${l}`).join("   |   "),
    margin + 45,
    y + 3,
  );
  y += 6;

  // ===== TABELA DE AVALIAÇÃO =====
  function drawSecao(titulo: string, itens: string[]) {
    const itemColW = contentW - 4 * 10;
    // header da seção
    doc.setFillColor(230, 230, 230);
    doc.rect(margin, y, contentW, 5, "FD");
    doc.setFont("helvetica", "bold").setFontSize(8);
    doc.text(titulo, margin + 1.5, y + 3.5);
    // escala header à direita
    let xh = margin + itemColW;
    ESCALA.forEach(([n]) => {
      doc.rect(xh, y, 10, 5);
      doc.text(n, xh + 5, y + 3.5, { align: "center" });
      xh += 10;
    });
    y += 5;

    doc.setFont("helvetica", "normal").setFontSize(8);
    itens.forEach((it) => {
      const rowH = 7;
      doc.rect(margin, y, itemColW, rowH);
      doc.text(it, margin + 1.5, y + 4.5, { maxWidth: itemColW - 3 });
      for (let i = 0; i < 4; i++) {
        doc.rect(margin + itemColW + i * 10, y, 10, rowH);
        doc.circle(margin + itemColW + i * 10 + 5, y + rowH / 2, 1.6);
      }
      y += rowH;
    });
  }

  drawSecao("CONTEÚDO", CONTEUDO_ITENS);
  drawSecao("INSTRUTOR", INSTRUTOR_ITENS);
  drawSecao("RECURSOS DIDÁTICOS", RECURSOS_ITENS);

  y += 2;

  // ===== CAMPOS ABERTOS =====
  function campoAberto(titulo: string, alturaLinhas = 3) {
    doc.setFillColor(230, 230, 230);
    doc.rect(margin, y, contentW, 5, "FD");
    doc.setFont("helvetica", "bold").setFontSize(8);
    doc.text(titulo, margin + 1.5, y + 3.5);
    y += 5;
    const lineH = 5;
    const totalH = alturaLinhas * lineH;
    doc.rect(margin, y, contentW, totalH);
    doc.setDrawColor(200, 200, 200);
    for (let i = 1; i < alturaLinhas; i++) {
      doc.line(margin + 2, y + i * lineH, margin + contentW - 2, y + i * lineH);
    }
    doc.setDrawColor(0, 0, 0);
    y += totalH;
  }

  campoAberto("EM QUE ESTE TREINAMENTO CONTRIBUIRÁ NO DESEMPENHO DAS SUAS ATIVIDADES?", 3);
  campoAberto("PONTOS FORTES E PONTOS DE MELHORIA:", 3);

  y += 2;

  // ===== AVALIAÇÃO GERAL =====
  doc.setFillColor(230, 230, 230);
  doc.rect(margin, y, contentW, 5, "FD");
  doc.setFont("helvetica", "bold").setFontSize(8);
  doc.text("AVALIAÇÃO GERAL DO TREINAMENTO (assinale apenas uma opção)", margin + 1.5, y + 3.5);
  y += 5;

  doc.rect(margin, y, contentW, 7);
  doc.setFont("helvetica", "normal").setFontSize(9);
  const colW = contentW / 4;
  AVAL_GERAL.forEach((label, i) => {
    const cx = margin + i * colW + 4;
    doc.circle(cx, y + 3.5, 1.6);
    doc.text(label, cx + 3, y + 4.5, { maxWidth: colW - 8 });
    if (i > 0) doc.line(margin + i * colW, y, margin + i * colW, y + 7);
  });
  y += 7 + 4;

  // ===== VALIDAÇÃO TST =====
  doc.setFillColor(245, 230, 230);
  doc.rect(margin, y, contentW, 5, "FD");
  doc.setFont("helvetica", "bold").setFontSize(8);
  doc.text("VALIDAÇÃO TÉCNICO EM SEGURANÇA", margin + contentW / 2, y + 3.5, { align: "center" });
  y += 5;

  const tstH = 22;
  doc.rect(margin, y, contentW, tstH);
  const tstCol1 = contentW * 0.5;
  doc.line(margin + tstCol1, y, margin + tstCol1, y + tstH);
  doc.setFont("helvetica", "bold").setFontSize(7);
  doc.text("NOME:", margin + 1.5, y + 3);
  doc.text("ASSINATURA:", margin + tstCol1 + 1.5, y + 3);
  doc.setFont("helvetica", "normal").setFontSize(9);
  doc.text(p.tstNome ?? "", margin + 1.5, y + 8);
  // linha pra data
  doc.setFont("helvetica", "bold").setFontSize(7);
  doc.text("DATA:", margin + 1.5, y + 15);
  doc.line(margin + 12, y + 17, margin + tstCol1 - 4, y + 17);

  if (p.tstAssinaturaDataUrl) {
    try {
      const props = doc.getImageProperties(p.tstAssinaturaDataUrl);
      const maxW = tstCol1 - 8;
      const maxH = tstH - 8;
      const r = Math.min(maxW / props.width, maxH / props.height);
      const w = props.width * r;
      const h = props.height * r;
      doc.addImage(
        p.tstAssinaturaDataUrl,
        "PNG",
        margin + tstCol1 + (tstCol1 - w) / 2,
        y + 5 + (maxH - h) / 2,
        w,
        h,
      );
    } catch {}
  }
  y += tstH;

  // Rodapé
  doc.setFont("helvetica", "italic").setFontSize(6);
  doc.text(
    "Avaliação anônima — Kirkpatrick Nível 1 (Reação). Formulário homologado FORCP-GP-16.",
    pageW / 2,
    pageH - 6,
    { align: "center" },
  );

  return doc;
}