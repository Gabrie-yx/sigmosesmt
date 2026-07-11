import jsPDF from "jspdf";
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

let _atemCache: string | null = null;
async function loadAtemLogo(): Promise<string> {
  if (_atemCache) return _atemCache;
  const r = await fetch(atemLogoUrl);
  const b = await r.blob();
  _atemCache = await new Promise<string>((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(String(fr.result));
    fr.onerror = rej;
    fr.readAsDataURL(b);
  });
  return _atemCache;
}

// Cores auxiliares — o original usa apenas cinza claro nos rótulos e nas
// faixas de seção. Nada mais.
const GRAY: [number, number, number] = [217, 217, 217];
const DOT_GRAY: [number, number, number] = [140, 140, 140];

function fillRect(doc: jsPDF, x: number, y: number, w: number, h: number, rgb: [number, number, number]) {
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  doc.rect(x, y, w, h, "F");
}

export async function gerarAvaliacaoReacao(p: ReacaoTreinamentoParams): Promise<jsPDF> {
  const atem = await loadAtemLogo();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentW = pageW - margin * 2;

  doc.setLineWidth(0.3);
  doc.setDrawColor(0, 0, 0);

  // ============ HEADER ============
  // 3 colunas: [atem logo] | [título centralizado] | [bloco de controle]
  const headerH = 16;
  const c1W = 32;
  const c3W = 46;
  const c2W = contentW - c1W - c3W;
  doc.rect(margin, margin, contentW, headerH);
  doc.line(margin + c1W, margin, margin + c1W, margin + headerH);
  doc.line(margin + c1W + c2W, margin, margin + c1W + c2W, margin + headerH);
  // atem logo (centralizado na célula)
  try {
    const props = doc.getImageProperties(atem);
    const maxW = c1W - 4;
    const maxH = headerH - 4;
    const r = Math.min(maxW / props.width, maxH / props.height);
    const w = props.width * r;
    const h = props.height * r;
    doc.addImage(atem, "PNG", margin + (c1W - w) / 2, margin + (headerH - h) / 2, w, h);
  } catch {}
  // título
  doc.setFont("helvetica", "normal").setFontSize(12);
  doc.text("AVALIAÇÃO DE REAÇÃO DO TREINAMENTO", margin + c1W + c2W / 2, margin + headerH / 2 + 1.2, { align: "center" });
  // controle
  doc.setFont("helvetica", "bold").setFontSize(8);
  const c3X = margin + c1W + c2W + 2;
  doc.text(`CÓD.: ${p.codigo ?? "FORCP-GP-16"}`, c3X, margin + 3.5);
  doc.text(`REVISÃO: ${p.revisao ?? "00"}`, c3X, margin + 7.2);
  doc.text(`DATA: ${p.dataDocumento ?? "23/06/2025"}`, c3X, margin + 10.9);
  doc.text(`PÁG.: 1 / 1`, c3X, margin + 14.6);

  let y = margin + headerH;

  // ============ DADOS DO TREINAMENTO ============
  // Cada label é uma célula cinza fixa; ao lado, célula branca para o valor.
  const rowH = 6;
  const labelText = (t: string, x: number, yy: number) => {
    doc.setFont("helvetica", "normal").setFontSize(9);
    doc.text(t, x + 1.5, yy + 4);
  };
  const valueText = (t: string, x: number, yy: number, maxW: number) => {
    doc.setFont("helvetica", "normal").setFontSize(9);
    doc.text(t, x + 1.5, yy + 4, { maxWidth: maxW - 3 });
  };

  // Linha 1: EMPRESA
  const lblEmpresaW = 28;
  fillRect(doc, margin, y, lblEmpresaW, rowH, GRAY);
  doc.rect(margin, y, contentW, rowH);
  doc.line(margin + lblEmpresaW, y, margin + lblEmpresaW, y + rowH);
  labelText("EMPRESA:", margin, y);
  valueText(p.empresa ?? "", margin + lblEmpresaW, y, contentW - lblEmpresaW);
  y += rowH;

  // Linha 2: TREINAMENTO | CARGA HORÁRIA
  const lblTreinW = 28;
  const lblCargaW = 30;
  const valCargaW = 26;
  const valTreinW = contentW - lblTreinW - lblCargaW - valCargaW;
  doc.rect(margin, y, contentW, rowH);
  fillRect(doc, margin, y, lblTreinW, rowH, GRAY);
  fillRect(doc, margin + lblTreinW + valTreinW, y, lblCargaW, rowH, GRAY);
  let cx = margin;
  labelText("TREINAMENTO:", cx, y); cx += lblTreinW; doc.line(cx, y, cx, y + rowH);
  valueText(p.treinamento ?? "", cx, y, valTreinW); cx += valTreinW; doc.line(cx, y, cx, y + rowH);
  labelText("CARGA HORÁRIA:", cx, y); cx += lblCargaW; doc.line(cx, y, cx, y + rowH);
  valueText(p.cargaHoraria ?? "", cx, y, valCargaW);
  y += rowH;

  // Linha 3: DATA TREINAMENTO | TIPO: | INTERNO [ ] | EXTERNO [ ]
  const lblDataW = 32;
  const valDataW = 40;
  const lblTipoW = 16;
  const boxTipoW = 6;
  const intLblW = 22;
  const extLblW = 22;
  const restW = contentW - lblDataW - valDataW - lblTipoW - boxTipoW - intLblW - boxTipoW - extLblW;
  doc.rect(margin, y, contentW, rowH);
  cx = margin;
  fillRect(doc, cx, y, lblDataW, rowH, GRAY);
  labelText("DATA TREINAMENTO:", cx, y); cx += lblDataW; doc.line(cx, y, cx, y + rowH);
  valueText(p.data || "", cx, y, valDataW); cx += valDataW; doc.line(cx, y, cx, y + rowH);
  fillRect(doc, cx, y, lblTipoW, rowH, GRAY);
  labelText("TIPO:", cx, y); cx += lblTipoW; doc.line(cx, y, cx, y + rowH);
  // caixa INTERNO
  if (p.tipo === "INTERNO") {
    doc.setFont("helvetica", "bold").setFontSize(11);
    doc.text("X", cx + boxTipoW / 2, y + 4.3, { align: "center" });
  }
  cx += boxTipoW; doc.line(cx, y, cx, y + rowH);
  labelText("INTERNO", cx, y); cx += intLblW; doc.line(cx, y, cx, y + rowH);
  if (p.tipo === "EXTERNO") {
    doc.setFont("helvetica", "bold").setFontSize(11);
    doc.text("X", cx + boxTipoW / 2, y + 4.3, { align: "center" });
  }
  cx += boxTipoW; doc.line(cx, y, cx, y + rowH);
  labelText("EXTERNO", cx, y); cx += extLblW;
  if (restW > 0.1) { doc.line(cx, y, cx, y + rowH); }
  y += rowH;

  // Linha 4: INSTRUTOR | INSTITUIÇÃO
  const lblInstW = 22;
  const lblInstitW = 24;
  const halfW = contentW / 2;
  const valInstW = halfW - lblInstW;
  const valInstitW = contentW - halfW - lblInstitW;
  doc.rect(margin, y, contentW, rowH);
  cx = margin;
  fillRect(doc, cx, y, lblInstW, rowH, GRAY);
  labelText("INSTRUTOR:", cx, y); cx += lblInstW; doc.line(cx, y, cx, y + rowH);
  valueText(p.instrutor || "", cx, y, valInstW); cx += valInstW; doc.line(cx, y, cx, y + rowH);
  fillRect(doc, cx, y, lblInstitW, rowH, GRAY);
  labelText("INSTITUIÇÃO:", cx, y); cx += lblInstitW; doc.line(cx, y, cx, y + rowH);
  valueText(p.instituicao || "", cx, y, valInstitW);
  y += rowH;

  // ============ INSTRUÇÕES (faixa cinza) ============
  const instrLines = doc.splitTextToSize(INSTRUCOES, contentW - 6);
  const instrH = instrLines.length * 4 + 3;
  fillRect(doc, margin, y, contentW, instrH, GRAY);
  doc.rect(margin, y, contentW, instrH);
  doc.setFont("helvetica", "bold").setFontSize(8.5);
  doc.text(instrLines, margin + 3, y + 4);
  y += instrH;

  // ============ FATORES DE AVALIAÇÃO ============
  const escalaColW = 22;
  const itemColW = contentW - escalaColW * 4;
  const headRowH = 6;
  doc.rect(margin, y, contentW, headRowH);
  doc.setFont("helvetica", "bold").setFontSize(9);
  // sublinhado nos cabeçalhos (como no original)
  doc.text("FATORES DE AVALIAÇÃO", margin + itemColW / 2, y + 4, { align: "center" });
  const underline = (text: string, cxCenter: number, yy: number) => {
    const w = doc.getTextWidth(text);
    doc.line(cxCenter - w / 2, yy + 0.7, cxCenter + w / 2, yy + 0.7);
  };
  underline("FATORES DE AVALIAÇÃO", margin + itemColW / 2, y + 4);
  let xh = margin + itemColW;
  ESCALA.forEach(([n, l]) => {
    doc.line(xh, y, xh, y + headRowH);
    const t = `${n} - ${l}`;
    doc.setFont("helvetica", "bold").setFontSize(9);
    doc.text(t, xh + escalaColW / 2, y + 4, { align: "center" });
    underline(t, xh + escalaColW / 2, y + 4);
    xh += escalaColW;
  });
  y += headRowH;

  function drawSecaoHeader(titulo: string) {
    fillRect(doc, margin, y, contentW, 5, GRAY);
    doc.rect(margin, y, contentW, 5);
    doc.setFont("helvetica", "bold").setFontSize(9);
    doc.text(titulo, margin + contentW / 2, y + 3.6, { align: "center" });
    y += 5;
  }

  function drawItens(itens: string[]) {
    const itemH = 5.5;
    itens.forEach((it, idx) => {
      // borda externa da linha
      doc.rect(margin, y, contentW, itemH);
      // separadores de coluna
      for (let i = 0; i < 4; i++) {
        const cxCol = margin + itemColW + i * escalaColW;
        doc.line(cxCol, y, cxCol, y + itemH);
      }
      // texto do item — centralizado, fonte 9
      doc.setFont("helvetica", "normal").setFontSize(9);
      doc.text(it, margin + itemColW / 2, y + 3.7, { align: "center", maxWidth: itemColW - 4 });
      // números 1..4 centralizados
      for (let i = 0; i < 4; i++) {
        const cxCol = margin + itemColW + i * escalaColW;
        doc.text(String(i + 1), cxCol + escalaColW / 2, y + 3.7, { align: "center" });
      }
      // separador pontilhado entre itens da mesma seção
      if (idx < itens.length - 1) {
        doc.setLineDashPattern([0.4, 0.6], 0);
        doc.setDrawColor(DOT_GRAY[0], DOT_GRAY[1], DOT_GRAY[2]);
        doc.line(margin + 1, y + itemH, margin + itemColW - 1, y + itemH);
        doc.setDrawColor(0, 0, 0);
        doc.setLineDashPattern([], 0);
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

  // ============ CAMPOS ABERTOS ============
  function campoAberto(titulo: string, alturaMm: number) {
    doc.setFont("helvetica", "bold").setFontSize(9);
    doc.text(titulo, margin + 0.5, y + 3.2);
    y += 4;
    doc.rect(margin, y, contentW, alturaMm);
    y += alturaMm;
  }

  campoAberto(
    "Em que este treinamento contribuirá para seu desenvolvimento profissional na Empresa?",
    28,
  );
  campoAberto(
    "Indique quais os pontos fortes e os pontos de melhoria do curso realizado:",
    28,
  );

  y += 1;

  // ============ "De maneira geral, o treinamento:" ============
  const geralRowH = 6;
  const geralBlockH = geralRowH * AVAL_GERAL.length;
  const geralLabelW = 55;
  const geralBoxW = 12;
  doc.rect(margin, y, contentW, geralBlockH);
  doc.line(margin + geralLabelW, y, margin + geralLabelW, y + geralBlockH);
  doc.line(margin + geralLabelW + geralBoxW, y, margin + geralLabelW + geralBoxW, y + geralBlockH);
  doc.setFont("helvetica", "bold").setFontSize(9);
  doc.text("De maneira geral, o treinamento:", margin + 2, y + geralRowH * 1.5 + 1);
  AVAL_GERAL.forEach((label, i) => {
    const ry = y + i * geralRowH;
    if (i > 0) doc.line(margin + geralLabelW, ry, margin + contentW, ry);
    doc.setFont("helvetica", "normal").setFontSize(9);
    doc.text(label, margin + geralLabelW + geralBoxW + 2, ry + 4);
  });

  return doc;
}