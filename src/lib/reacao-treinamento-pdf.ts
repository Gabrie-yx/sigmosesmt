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
// ISO compliance: fundo dos campos = #E5E7EB, borda fina = #9CA3AF
const GRAY: [number, number, number] = [229, 231, 235]; // #E5E7EB
const BORDER_GRAY: [number, number, number] = [156, 163, 175]; // #9CA3AF
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

  doc.setLineWidth(0.4);
  doc.setDrawColor(BORDER_GRAY[0], BORDER_GRAY[1], BORDER_GRAY[2]);
  // Tipografia base — Helvetica (Arial-equivalente no jsPDF core)
  doc.setFont("helvetica", "normal");

  // ============ BORDA EXTERNA DA PÁGINA ============
  // O original tem um retângulo preto que envolve TODO o formulário até a
  // margem inferior — replicamos aqui.
  const outerH = pageH - margin * 2;
  doc.rect(margin, margin, contentW, outerH);

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
  // Coluna de rótulos com LARGURA ÚNICA para as 4 linhas — no original todos
  // os rótulos (EMPRESA, TREINAMENTO, DATA TREINAMENTO, INSTRUTOR) começam e
  // terminam no mesmo X, formando uma coluna cinza alinhada.
  const rowH = 6;
  const lblColW = 36; // largura única da coluna de rótulos à esquerda
  const labelText = (t: string, x: number, yy: number) => {
    doc.setFont("helvetica", "normal").setFontSize(9);
    doc.text(t, x + 1.5, yy + 4);
  };
  const valueText = (t: string, x: number, yy: number, maxW: number) => {
    doc.setFont("helvetica", "normal").setFontSize(9);
    doc.text(t, x + 1.5, yy + 4, { maxWidth: maxW - 3 });
  };

  // Bloco de 4 linhas — desenha uma única moldura externa + linhas horizontais
  // entre as linhas + linhas verticais SÓ onde há mudança de célula. Evita
  // strokes duplicados que criam efeito de "relevo".
  const blockTop = y;
  const blockH = rowH * 4;
  // moldura do bloco
  doc.rect(margin, blockTop, contentW, blockH);
  // separadores horizontais entre as 4 linhas
  for (let i = 1; i < 4; i++) {
    const hy = blockTop + i * rowH;
    doc.line(margin, hy, margin + contentW, hy);
  }
  // coluna cinza única (rótulos das 4 linhas)
  fillRect(doc, margin, blockTop, lblColW, blockH, GRAY);
  // divisor vertical do rótulo (uma linha só, cobrindo todo o bloco)
  doc.line(margin + lblColW, blockTop, margin + lblColW, blockTop + blockH);

  // Linha 1 — EMPRESA
  let ry = blockTop;
  labelText("EMPRESA:", margin, ry);
  valueText(p.empresa ?? "", margin + lblColW, ry, contentW - lblColW);
  ry += rowH;

  // Linha 2 — TREINAMENTO | CARGA HORÁRIA
  const lblCargaW = 30;
  const valCargaW = 26;
  const valTreinW = contentW - lblColW - lblCargaW - valCargaW;
  labelText("TREINAMENTO:", margin, ry);
  valueText(p.treinamento ?? "", margin + lblColW, ry, valTreinW);
  // separador vertical antes da célula CARGA HORÁRIA
  const xCarga = margin + lblColW + valTreinW;
  doc.line(xCarga, ry, xCarga, ry + rowH);
  fillRect(doc, xCarga, ry, lblCargaW, rowH, GRAY);
  labelText("CARGA HORÁRIA:", xCarga, ry);
  doc.line(xCarga + lblCargaW, ry, xCarga + lblCargaW, ry + rowH);
  valueText(p.cargaHoraria ?? "", xCarga + lblCargaW, ry, valCargaW);
  ry += rowH;

  // Linha 3 — DATA TREINAMENTO | TIPO | [X] INTERNO | [ ] EXTERNO
  const valDataW = 44;
  const lblTipoW = 16;
  const boxTipoW = 8;
  const intLblW = 24;
  const extLblW = 24;
  labelText("DATA TREINAMENTO:", margin, ry);
  valueText(p.data || "", margin + lblColW, ry, valDataW);
  let cx3 = margin + lblColW + valDataW;
  doc.line(cx3, ry, cx3, ry + rowH);
  fillRect(doc, cx3, ry, lblTipoW, rowH, GRAY);
  labelText("TIPO:", cx3, ry);
  cx3 += lblTipoW;
  doc.line(cx3, ry, cx3, ry + rowH);
  // checkbox INTERNO
  {
    const bs = rowH - 2.4;
    const bx = cx3 + (boxTipoW - bs) / 2;
    const by = ry + 1.2;
    doc.rect(bx, by, bs, bs);
    if (p.tipo === "INTERNO") {
      doc.setFont("helvetica", "normal").setFontSize(9);
      doc.text("X", bx + bs / 2, by + bs - 0.9, { align: "center" });
    }
  }
  cx3 += boxTipoW;
  doc.line(cx3, ry, cx3, ry + rowH);
  labelText("INTERNO", cx3, ry);
  cx3 += intLblW;
  doc.line(cx3, ry, cx3, ry + rowH);
  {
    const bs = rowH - 2.4;
    const bx = cx3 + (boxTipoW - bs) / 2;
    const by = ry + 1.2;
    doc.rect(bx, by, bs, bs);
    if (p.tipo === "EXTERNO") {
      doc.setFont("helvetica", "normal").setFontSize(9);
      doc.text("X", bx + bs / 2, by + bs - 0.9, { align: "center" });
    }
  }
  cx3 += boxTipoW;
  doc.line(cx3, ry, cx3, ry + rowH);
  labelText("EXTERNO", cx3, ry);
  ry += rowH;

  // Linha 4 — INSTRUTOR | INSTITUIÇÃO
  const lblInstitW = 26;
  const halfW = contentW / 2;
  const valInstW = halfW - lblColW;
  const valInstitW = contentW - halfW - lblInstitW;
  labelText("INSTRUTOR:", margin, ry);
  valueText(p.instrutor || "", margin + lblColW, ry, valInstW);
  const xInstit = margin + halfW;
  doc.line(xInstit, ry, xInstit, ry + rowH);
  fillRect(doc, xInstit, ry, lblInstitW, rowH, GRAY);
  labelText("INSTITUIÇÃO:", xInstit, ry);
  doc.line(xInstit + lblInstitW, ry, xInstit + lblInstitW, ry + rowH);
  valueText(p.instituicao || "", xInstit + lblInstitW, ry, valInstitW);
  // Redesenha separadores horizontais POR CIMA das faixas cinzas — os
  // fillRect() das células cinza (CARGA HORÁRIA, TIPO, INSTITUIÇÃO) e da
  // coluna de rótulos pintam por cima das linhas, então redesenhamos aqui.
  for (let i = 1; i < 4; i++) {
    const hy = blockTop + i * rowH;
    doc.line(margin, hy, margin + contentW, hy);
  }
  // Reforça a moldura externa (o fillRect da coluna esquerda cobre a borda
  // esquerda também).
  doc.rect(margin, blockTop, contentW, blockH);
  y = blockTop + blockH;

  // ============ INSTRUÇÕES (faixa cinza) ============
  // Fonte menor pra caber em 2 linhas sem vazar as bordas.
  doc.setFont("helvetica", "normal").setFontSize(8);
  const instrLines = [
    "Para que possamos aprimorar e adequar nossos treinamentos, solicitamos que preencha atentamente este questionário. Nos quesitos",
    '"Fatores de Avaliação", atribua uma nota de 1 a 4 e responda os questionamentos apresentados abaixo. Sua opinião é muito importante!',
  ];
  const instrH = instrLines.length * 4.2 + 3.5;
  fillRect(doc, margin, y, contentW, instrH, GRAY);
  doc.rect(margin, y, contentW, instrH);
  doc.text(instrLines, margin + contentW / 2, y + 4.2, { align: "center" });
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
    itens.forEach((it, idx) => {
      // Altura variável: texto centralizado; se o texto for longo o suficiente
      // para envolver, usa 2 linhas.
      doc.setFont("helvetica", "normal").setFontSize(9);
      const lines = doc.splitTextToSize(it, itemColW - 4);
      const itemH = Math.max(5.5, lines.length * 4 + 1.5);
      // borda externa da linha
      doc.rect(margin, y, contentW, itemH);
      // separadores de coluna
      for (let i = 0; i < 4; i++) {
        const cxCol = margin + itemColW + i * escalaColW;
        doc.line(cxCol, y, cxCol, y + itemH);
      }
      // texto do item — centralizado vertical e horizontalmente
      doc.text(lines, margin + itemColW / 2, y + itemH / 2 + 1.2 - (lines.length - 1) * 2, { align: "center" });
      // números 1..4 centralizados
      for (let i = 0; i < 4; i++) {
        const cxCol = margin + itemColW + i * escalaColW;
        doc.text(String(i + 1), cxCol + escalaColW / 2, y + itemH / 2 + 1.2, { align: "center" });
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

  function drawSecaoHeaderTitleOnly(titulo: string) {
    // Faixa de seção que só preenche em cinza a coluna do item; as 4 colunas
    // da escala ficam brancas (como o RECURSOS DIDÁTICOS no original).
    const h = 5;
    fillRect(doc, margin, y, itemColW, h, GRAY);
    doc.rect(margin, y, contentW, h);
    for (let i = 0; i < 4; i++) {
      const cxCol = margin + itemColW + i * escalaColW;
      doc.line(cxCol, y, cxCol, y + h);
    }
    doc.setFont("helvetica", "bold").setFontSize(9);
    doc.text(titulo, margin + itemColW / 2, y + 3.6, { align: "center" });
    y += h;
  }

  drawSecaoHeader("CONTEÚDO");
  drawItens(CONTEUDO_ITENS);
  drawSecaoHeader("INSTRUTOR");
  drawItens(INSTRUTOR_ITENS);
  drawSecaoHeaderTitleOnly("RECURSOS DIDÁTICOS");
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
    // checkbox — tamanho fixo (~14px = 3.7mm)
    const bs = 3.7;
    const bx = margin + geralLabelW + (geralBoxW - bs) / 2;
    const by = ry + (geralRowH - bs) / 2;
    doc.rect(bx, by, bs, bs);
    doc.setFont("helvetica", "normal").setFontSize(9);
    doc.text(label, margin + geralLabelW + geralBoxW + 2, ry + 4);
  });

  // ============ RODAPÉ FIXO NA BASE DA PÁGINA ============
  const footerH = 6;
  const footerY = pageH - margin - footerH;
  fillRect(doc, margin, footerY, contentW, footerH, GRAY);
  doc.setDrawColor(BORDER_GRAY[0], BORDER_GRAY[1], BORDER_GRAY[2]);
  doc.rect(margin, footerY, contentW, footerH);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold").setFontSize(8);
  const footerParts = [
    `CÓD.: ${p.codigo ?? "FORCP-GP-16"}`,
    `REVISÃO: ${p.revisao ?? "00"}`,
    `DATA: ${p.dataDocumento ?? "23/06/2025"}`,
    `PÁG.: 1 / 1`,
  ];
  const colW = contentW / footerParts.length;
  footerParts.forEach((t, i) => {
    doc.text(t, margin + colW * i + colW / 2, footerY + footerH / 2 + 1.4, { align: "center" });
  });

  return doc;
}