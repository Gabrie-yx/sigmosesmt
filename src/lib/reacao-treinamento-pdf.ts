import jsPDF from "jspdf";
import dmnLogoUrl from "@/assets/dmn-logo.png";
import atemLogoUrl from "@/assets/atem-logo.png";

export type ReacaoTreinamentoParams = {
  empresa?: string;
  data: string; // dd/mm/yyyy
  tipo: "INTERNO" | "EXTERNO" | "";
  instrutor: string;
  instituicao: string;
  treinamento?: string;
  cargaHoraria?: string;
  tstNome?: string;
  tstAssinaturaDataUrl?: string | null;
  codigo?: string;
  revisao?: string;
  dataDocumento?: string;
};

const CONTEUDO_ITENS = [
  "Consistência das informações",
  "Volume de informações",
  "Aplicabilidade no trabalho",
  "Carga horária",
];
const INSTRUTOR_ITENS = [
  "Conhecimento sobre o assunto",
  "Clareza e objetividade na exposição de idéias",
  "Esclarecimento de dúvidas do grupo",
  "Relacionamento com o grupo e estímulo à participação",
  "Cumprimento do programa",
];
const RECURSOS_ITENS = [
  "Projetor de slides (data show), apostila, atividades, filmes, entre outros",
];

const ESCALA = [
  ["1", "Ruim"],
  ["2", "Regular"],
  ["3", "Bom"],
  ["4", "Ótimo"],
];

const AVAL_GERAL = [
  "Superou suas necessidades e expectativas.",
  "Atendeu plenamente suas necessidades e expectativas.",
  "Atendeu parcialmente suas necessidades e expectativas.",
  "Não atendeu suas necessidades e expectativas.",
];

const INSTRUCOES =
  'Para que possamos aprimorar e adequar nossos treinamentos, solicitamos que preencha atentamente este questionário. Nos quesitos "Fatores de Avaliação", atribua uma nota de 1 a 4 e responda os questionamentos apresentados abaixo. Sua opinião é muito importante!';

let _logosCache: { dmn: string; atem: string } | null = null;
async function loadLogos() {
  if (_logosCache) return _logosCache;
  const toDataUrl = async (url: string) => {
    const r = await fetch(url);
    const b = await r.blob();
    return await new Promise<string>((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result));
      fr.onerror = rej;
      fr.readAsDataURL(b);
    });
  };
  const [dmn, atem] = await Promise.all([toDataUrl(dmnLogoUrl), toDataUrl(atemLogoUrl)]);
  _logosCache = { dmn, atem };
  return _logosCache;
}

export async function gerarAvaliacaoReacao(p: ReacaoTreinamentoParams): Promise<jsPDF> {
  const logos = await loadLogos();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentW = pageW - margin * 2;

  // ===== HEADER =====
  const headerH = 18;
  doc.setLineWidth(0.3);
  doc.rect(margin, margin, contentW, headerH);
  const c1W = 42; // logos (DMN + atem)
  const c3W = 46; // control block
  const c2W = contentW - c1W - c3W;
  doc.line(margin + c1W, margin, margin + c1W, margin + headerH);
  doc.line(margin + c1W + c2W, margin, margin + c1W + c2W, margin + headerH);

  // DMN logo
  try { doc.addImage(logos.dmn, "PNG", margin + 2, margin + 3, 18, 12); } catch {}
  // atem logo
  try { doc.addImage(logos.atem, "PNG", margin + 22, margin + 3, 18, 12); } catch {}

  doc.setFont("helvetica", "bold").setFontSize(13);
  doc.text("AVALIAÇÃO DE REAÇÃO DO TREINAMENTO", margin + c1W + c2W / 2, margin + headerH / 2 + 1.5, { align: "center" });

  doc.setFont("helvetica", "bold").setFontSize(8);
  const c3X = margin + c1W + c2W + 2;
  doc.text(`CÓD.: ${p.codigo ?? "FORCP-GP-16"}`, c3X, margin + 4);
  doc.text(`REVISÃO: ${p.revisao ?? "00"}`, c3X, margin + 8.5);
  doc.text(`DATA: ${p.dataDocumento ?? "23/06/2025"}`, c3X, margin + 13);
  doc.text(`PÁG.: 1 / 1`, c3X, margin + 17);

  let y = margin + headerH;

  // ===== DADOS DO TREINAMENTO (estrutura exata do print) =====
  const rowH = 6;

  // EMPRESA (full)
  doc.rect(margin, y, contentW, rowH);
  doc.setFont("helvetica", "bold").setFontSize(8);
  doc.text("EMPRESA:", margin + 1.5, y + 4);
  doc.setFont("helvetica", "bold").setFontSize(9);
  doc.text(
    p.empresa ?? "DMN ESTALEIRO DA AMAZONIA LTDA",
    margin + contentW / 2,
    y + 4,
    { align: "center" },
  );
  y += rowH;

  // TREINAMENTO (full)
  doc.rect(margin, y, contentW, rowH);
  doc.setFont("helvetica", "bold").setFontSize(8);
  doc.text("TREINAMENTO:", margin + 1.5, y + 4);
  doc.setFont("helvetica", "normal").setFontSize(9);
  doc.text(p.treinamento ?? "", margin + 30, y + 4, { maxWidth: contentW - 32 });
  y += rowH;

  // DATA TREINAMENTO | TIPO: INTERNO | EXTERNO | CARGA HORÁRIA
  // Layout columns (mm): data label+val 60 | TIPO label 18 | INTERNO 30 | EXTERNO 30 | CARGA label+val rest
  const colDataW = 60;
  const colTipoLabelW = 18;
  const colIntW = 30;
  const colExtW = 30;
  const colCargaW = contentW - (colDataW + colTipoLabelW + colIntW + colExtW);
  doc.rect(margin, y, contentW, rowH);
  let xx = margin;
  // DATA TREINAMENTO
  doc.setFont("helvetica", "bold").setFontSize(8);
  doc.text("DATA TREINAMENTO:", xx + 1.5, y + 4);
  doc.setFont("helvetica", "normal").setFontSize(9);
  doc.text(p.data || "", xx + 36, y + 4);
  xx += colDataW; doc.line(xx, y, xx, y + rowH);
  // TIPO label
  doc.setFont("helvetica", "bold").setFontSize(8);
  doc.text("TIPO:", xx + 1.5, y + 4);
  xx += colTipoLabelW; doc.line(xx, y, xx, y + rowH);
  // INTERNO
  doc.text("INTERNO", xx + 1.5, y + 4);
  // checkbox
  doc.rect(xx + colIntW - 6, y + 1.5, 3, 3);
  if (p.tipo === "INTERNO") {
    doc.setFont("helvetica", "bold").setFontSize(9);
    doc.text("X", xx + colIntW - 5.2, y + 4);
  }
  xx += colIntW; doc.line(xx, y, xx, y + rowH);
  // EXTERNO
  doc.setFont("helvetica", "bold").setFontSize(8);
  doc.text("EXTERNO", xx + 1.5, y + 4);
  doc.rect(xx + colExtW - 6, y + 1.5, 3, 3);
  if (p.tipo === "EXTERNO") {
    doc.setFont("helvetica", "bold").setFontSize(9);
    doc.text("X", xx + colExtW - 5.2, y + 4);
  }
  xx += colExtW; doc.line(xx, y, xx, y + rowH);
  // CARGA HORÁRIA
  doc.setFont("helvetica", "bold").setFontSize(8);
  doc.text("CARGA HORÁRIA:", xx + 1.5, y + 4);
  doc.setFont("helvetica", "normal").setFontSize(9);
  doc.text(p.cargaHoraria ?? "", xx + 28, y + 4);
  y += rowH;

  // INSTRUTOR | INSTITUIÇÃO
  doc.rect(margin, y, contentW, rowH);
  const instCol = contentW * 0.55;
  doc.line(margin + instCol, y, margin + instCol, y + rowH);
  doc.setFont("helvetica", "bold").setFontSize(8);
  doc.text("INSTRUTOR:", margin + 1.5, y + 4);
  doc.setFont("helvetica", "normal").setFontSize(9);
  doc.text(p.instrutor || "", margin + 22, y + 4, { maxWidth: instCol - 24 });
  doc.setFont("helvetica", "bold").setFontSize(8);
  doc.text("INSTITUIÇÃO:", margin + instCol + 1.5, y + 4);
  doc.setFont("helvetica", "normal").setFontSize(9);
  doc.text(p.instituicao || "DMN ESTALEIRO DA AMAZONIA LTDA", margin + instCol + 24, y + 4, {
    maxWidth: contentW - instCol - 25,
  });
  y += rowH + 1.5;

  // ===== INSTRUÇÕES (caixa amarela clara) =====
  doc.setFillColor(255, 248, 200);
  doc.setDrawColor(0, 0, 0);
  const instrLines = doc.splitTextToSize(INSTRUCOES, contentW - 6);
  const instrH = instrLines.length * 4 + 4;
  doc.rect(margin, y, contentW, instrH, "FD");
  doc.setFont("helvetica", "bold").setFontSize(8.5);
  doc.text(instrLines, margin + contentW / 2, y + 4, { align: "center" });
  y += instrH + 2;

  // ===== FATORES DE AVALIAÇÃO — cabeçalho =====
  const escalaColW = 22;
  const itemColW = contentW - escalaColW * 4;
  doc.setFillColor(255, 255, 255);
  const headRowH = 6;
  doc.rect(margin, y, contentW, headRowH);
  doc.setFont("helvetica", "bold").setFontSize(9);
  doc.text("FATORES DE AVALIAÇÃO", margin + itemColW / 2, y + 4, { align: "center" });
  let xh = margin + itemColW;
  ESCALA.forEach(([n, l]) => {
    doc.line(xh, y, xh, y + headRowH);
    doc.setFont("helvetica", "bold").setFontSize(8);
    doc.text(`${n} - ${l}`, xh + escalaColW / 2, y + 4, { align: "center" });
    xh += escalaColW;
  });
  y += headRowH;

  function drawSecaoHeader(titulo: string) {
    doc.setFillColor(225, 225, 225);
    doc.rect(margin, y, contentW, 5, "FD");
    doc.setFont("helvetica", "bold").setFontSize(8);
    doc.text(titulo, margin + contentW / 2, y + 3.5, { align: "center" });
    y += 5;
  }

  function drawItens(itens: string[]) {
    const itemH = 5.5;
    doc.setFont("helvetica", "normal").setFontSize(8);
    itens.forEach((it) => {
      doc.rect(margin, y, itemColW, itemH);
      doc.text(it, margin + itemColW / 2, y + 3.7, { align: "center", maxWidth: itemColW - 4 });
      for (let i = 0; i < 4; i++) {
        const cx = margin + itemColW + i * escalaColW;
        doc.rect(cx, y, escalaColW, itemH);
        doc.setFont("helvetica", "normal").setFontSize(9);
        doc.text(String(i + 1), cx + escalaColW / 2, y + 3.7, { align: "center" });
        doc.setFont("helvetica", "normal").setFontSize(8);
      }
      y += itemH;
    });
  }

  drawSecaoHeader("CONTEÚDO");
  drawItens(CONTEUDO_ITENS);
  drawSecaoHeader("INSTRUTOR");
  drawItens(INSTRUTOR_ITENS);
  drawSecaoHeader("RECURSOS DIDÁTICOS");
  drawItens(RECURSOS_ITENS);

  y += 2;

  // ===== CAMPOS ABERTOS =====
  function campoAberto(titulo: string, alturaLinhas = 4) {
    doc.setFont("helvetica", "bold").setFontSize(8.5);
    doc.text(titulo, margin, y + 3);
    y += 4.5;
    const lineH = 5;
    const totalH = alturaLinhas * lineH;
    doc.rect(margin, y, contentW, totalH);
    doc.setDrawColor(200, 200, 200);
    for (let i = 1; i < alturaLinhas; i++) {
      doc.line(margin + 2, y + i * lineH, margin + contentW - 2, y + i * lineH);
    }
    doc.setDrawColor(0, 0, 0);
    y += totalH + 2;
  }

  campoAberto("Em que este treinamento contribuirá para seu desenvolvimento profissional na Empresa?", 4);
  campoAberto("Indique quais os pontos fortes e os pontos de melhoria do curso realizado:", 4);

  // ===== AVALIAÇÃO GERAL ("De maneira geral, o treinamento") =====
  const geralRowH = 6;
  const geralBlockH = geralRowH * AVAL_GERAL.length;
  doc.rect(margin, y, contentW, geralBlockH);
  // coluna do rótulo à esquerda
  const labelColW = 55;
  doc.line(margin + labelColW, y, margin + labelColW, y + geralBlockH);
  doc.setFont("helvetica", "bold").setFontSize(9);
  doc.text("De maneira geral, o treinamento", margin + 2, y + 4);
  // opções stacked à direita
  AVAL_GERAL.forEach((label, i) => {
    const ry = y + i * geralRowH;
    if (i > 0) {
      doc.setDrawColor(180, 180, 180);
      doc.line(margin + labelColW, ry, margin + contentW, ry);
      doc.setDrawColor(0, 0, 0);
    }
    doc.rect(margin + labelColW + 3, ry + 1, 4, 4);
    doc.setFont("helvetica", "normal").setFontSize(9);
    doc.text(label, margin + labelColW + 10, ry + 4);
  });
  y += geralBlockH + 3;

  // ===== VALIDAÇÃO TST =====
  doc.setFillColor(245, 230, 230);
  doc.rect(margin, y, contentW, 5, "FD");
  doc.setFont("helvetica", "bold").setFontSize(8);
  doc.text("VALIDAÇÃO TÉCNICO EM SEGURANÇA", margin + contentW / 2, y + 3.5, { align: "center" });
  y += 5;

  const tstH = 20;
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