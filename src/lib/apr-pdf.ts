import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { DEFAULT_TEXTO_GERAIS } from "@/lib/apr-defaults";

export { DEFAULT_TEXTO_GERAIS };

export type APRPdfRisco = {
  ordem: number;
  passo?: string | null;
  risco_nome: string;
  risco_categoria?: string | null;
  efeitos_danos?: string | null;
  probabilidade: number; // 1-3
  severidade: number;    // 1-3
  nivel_risco: number;   // P+S = 2..6
  acoes_preventivas?: string | null;
  epis: string[];
  nrs: string[];
  responsavel_acoes?: string | null;
};

export type APRPdfAssinatura = {
  papel: "EXECUTANTE" | "TST" | "ENCARREGADO";
  nome: string;
  cpf?: string | null;
  funcao?: string | null;
};

export type APRPdfParams = {
  logoUrl?: string | null;
  logoDataUrl?: string | null;
  matrizNome: string;
  matrizCnpj?: string | null;
  numero: string;
  data_emissao: string;
  data_inicio?: string | null;
  data_fim?: string | null;
  hora_inicio?: string | null;
  hora_fim?: string | null;
  hora_inicio_sexta?: string | null;
  hora_fim_sexta?: string | null;
  dias_semana?: string[] | null;
  validade_dias?: number | null;
  data_validade?: string | null;
  empresa_nome?: string | null;
  empresa_cnpj?: string | null;
  casco_numero?: string | null;
  casco_nome?: string | null;
  local?: string | null;
  setor?: string | null;
  atividade: string;
  servico_detalhado?: string | null;
  elaborado_por?: string | null;
  encarregado?: string | null;
  tst?: string | null;
  pte_numero?: string | null;
  condicoes_climaticas?: string | null;
  observacoes?: string | null;
  texto_gerais?: string | null;
  riscos: APRPdfRisco[];
  assinaturas: APRPdfAssinatura[];
  exige_pte?: boolean;
  ptes_vinculadas?: string[];
  /** PNG/JPEG data URL — assinatura do encarregado (opcional) */
  encSig?: string | null;
  /** PNG/JPEG data URL — assinatura do TST/SESMT (opcional) */
  tstSig?: string | null;
  /** Altura visual (px 20–140) escolhida pelo usuário p/ assinatura ENC */
  encSigHeight?: number | null;
  /** Altura visual (px 20–140) escolhida pelo usuário p/ assinatura TST */
  tstSigHeight?: number | null;
};

// Cores fixas (modelo homologado)
const C_HEADER = [220, 53, 69] as const;       // vermelho DMN
const C_TBL_HEAD = [255, 153, 0] as const;     // laranja cabeçalho tabela
const C_SUB = [254, 240, 217] as const;        // bege bandas
const C_BORDER = [0, 0, 0] as const;

function grauMeta(n: number) {
  switch (n) {
    case 2: return { label: "TRIVIAL", color: [16, 185, 129] as const };
    case 3: return { label: "TOLERÁVEL", color: [132, 204, 22] as const };
    case 4: return { label: "MODERADO", color: [234, 179, 8] as const };
    case 5: return { label: "SUBSTANCIAL", color: [249, 115, 22] as const };
    case 6: return { label: "INACEITÁVEL", color: [220, 38, 38] as const };
    default: return { label: "—", color: [200, 200, 200] as const };
  }
}

const PAGE_W = 297; // A4 landscape
const PAGE_H = 210;
const MARGIN = 6;
const CONTENT_W = PAGE_W - MARGIN * 2;
// Y onde começa o conteúdo da página (logo abaixo do cabeçalho completo:
// chrome ISO + bloco de identificação) — repetido em TODAS as páginas.
const CONTENT_TOP = 60;

function drawHeader(doc: jsPDF, p: APRPdfParams, pagina: number, totalPaginas: number) {
  const headerH = 18;
  doc.setLineWidth(0.4);
  doc.setDrawColor(0, 0, 0);
  doc.rect(MARGIN, MARGIN, CONTENT_W, headerH);
  // 3 colunas
  const cLogo = 28;
  const cMeta = 50;
  doc.line(MARGIN + cLogo, MARGIN, MARGIN + cLogo, MARGIN + headerH);
  doc.line(MARGIN + CONTENT_W - cMeta, MARGIN, MARGIN + CONTENT_W - cMeta, MARGIN + headerH);

  // Logo DMN — imagem oficial se disponível, senão fallback texto
  if (p.logoDataUrl) {
    try {
      doc.addImage(p.logoDataUrl, "PNG", MARGIN + 2, MARGIN + 1.5, cLogo - 4, headerH - 3, undefined, "FAST");
    } catch {
      doc.setFont("helvetica", "bold").setFontSize(13).text("DMN", MARGIN + cLogo / 2, MARGIN + headerH / 2 + 2, { align: "center" });
    }
  } else {
    doc.setFillColor(C_HEADER[0], C_HEADER[1], C_HEADER[2]);
    doc.roundedRect(MARGIN + 4, MARGIN + 4, cLogo - 8, headerH - 8, 1.5, 1.5, "F");
    doc.setTextColor(255, 255, 255).setFont("helvetica", "bold").setFontSize(13);
    doc.text("DMN", MARGIN + cLogo / 2, MARGIN + headerH / 2 + 2, { align: "center" });
    doc.setTextColor(0, 0, 0);
  }

  // Centro: nome + título
  const cx = MARGIN + cLogo + (CONTENT_W - cLogo - cMeta) / 2;
  doc.setFont("helvetica", "bold").setFontSize(15);
  doc.text("DMN ESTALEIRO DA AMAZONIA LTDA", cx, MARGIN + 7, { align: "center" });
  doc.setFontSize(10).setFont("helvetica", "normal");
  doc.text("APR – Análise Preliminar de Riscos", cx, MARGIN + 13, { align: "center" });

  // Direita: bloco ISO (fixo)
  const mx = MARGIN + CONTENT_W - cMeta;
  const innerH = headerH / 4;
  doc.setLineWidth(0.2);
  for (let i = 1; i < 4; i++) doc.line(mx, MARGIN + i * innerH, MARGIN + CONTENT_W, MARGIN + i * innerH);
  doc.setFont("helvetica", "bold").setFontSize(7);
  doc.text("CÓD.FOR-SEG 07", mx + 2, MARGIN + innerH - 1.5);
  doc.text("REVISÃO: 00", mx + 2, MARGIN + innerH * 2 - 1.5);
  doc.text("DATA: 30/08/2025", mx + 2, MARGIN + innerH * 3 - 1.5);
  doc.text(`PÁG.: ${String(pagina).padStart(2, "0")}/${String(totalPaginas).padStart(2, "0")}`, mx + 2, MARGIN + innerH * 4 - 1.5);
}

function drawIdBlock(doc: jsPDF, p: APRPdfParams, yStart: number): number {
  let y = yStart;
  const rowH = 6;
  doc.setLineWidth(0.25);

  // Linha 1: CNPJ | Início | Fim | APR Nº | Validade (dias)
  const cells1: [string, string, number][] = [
    ["CNPJ:", p.matrizCnpj ?? "13.378.697/0001-80", 60],
    ["Início:", p.data_inicio ?? p.data_emissao, 45],
    ["Fim:", p.data_fim ?? (p.data_validade ?? ""), 45],
    ["APR Nº", p.numero, 65],
    ["Validade:", `${p.validade_dias ?? "—"} dia${(p.validade_dias ?? 0) > 1 ? "s" : ""}`, 50],
  ];
  let x = MARGIN;
  cells1.forEach(([lbl, val, w], i) => {
    const last = i === cells1.length - 1;
    const cw = last ? CONTENT_W - (x - MARGIN) : w;
    doc.rect(x, y, cw, rowH);
    doc.setFont("helvetica", "bold").setFontSize(7.5);
    doc.text(lbl, x + 1.2, y + 4);
    doc.setFont("helvetica", "normal").setFontSize(8);
    doc.text(String(val ?? "—"), x + (lbl.length * 1.4) + 8, y + 4);
    x += cw;
  });
  y += rowH;

  // Linha 2: ATIVIDADE PRINCIPAL | SERVIÇO DETALHADO
  const lH = 14;
  const wAt = CONTENT_W * 0.42;
  doc.rect(MARGIN, y, wAt, lH);
  doc.rect(MARGIN + wAt, y, CONTENT_W - wAt, lH);
  doc.setFont("helvetica", "bold").setFontSize(7.5);
  doc.text("ATIVIDADE PRINCIPAL:", MARGIN + 1.2, y + 3.5);
  doc.text("SERVIÇO DETALHADO:", MARGIN + wAt + 1.2, y + 3.5);
  doc.setFont("helvetica", "normal").setFontSize(8);
  const atvLines = doc.splitTextToSize(p.atividade ?? "—", wAt - 3);
  doc.text(atvLines.slice(0, 3), MARGIN + 1.2, y + 7);
  if (p.servico_detalhado) {
    const sLines = doc.splitTextToSize(p.servico_detalhado, CONTENT_W - wAt - 3);
    doc.text(sLines.slice(0, 3), MARGIN + wAt + 1.2, y + 7);
  }
  y += lH;

  // Linha 3: Elaborado por | Responsável pelo serviço | Local | Horário
  const c3: [string, string, number][] = [
    ["Elaborado por:", p.elaborado_por ?? p.tst ?? "—", 70],
    ["Responsável pelo serviço:", p.encarregado ?? p.empresa_nome ?? "—", 90],
    ["Local da Atividade:", p.local ?? "—", 60],
  ];
  x = MARGIN;
  c3.forEach(([lbl, val, w], i) => {
    const cw = w;
    doc.rect(x, y, cw, rowH * 2);
    doc.setFont("helvetica", "bold").setFontSize(7);
    doc.text(lbl, x + 1.2, y + 3.5);
    doc.setFont("helvetica", "normal").setFontSize(8);
    const lines = doc.splitTextToSize(String(val ?? "—"), cw - 3);
    doc.text(lines.slice(0, 2), x + 1.2, y + 8);
    x += cw;
  });
  // Horário (sempre por último) — layout limpo em 3 linhas
  const wH = CONTENT_W - (x - MARGIN);
  doc.rect(x, y, wH, rowH * 2);
  doc.setFont("helvetica", "bold").setFontSize(7);
  doc.text("Horário da atividade:", x + 1.2, y + 3.2);
  doc.setFont("helvetica", "normal").setFontSize(7);
  doc.text(`Seg–Qui:  ${p.hora_inicio ?? "--:--"} às ${p.hora_fim ?? "--:--"}`, x + 1.2, y + 6.6);
  doc.text(`Sexta:    ${p.hora_inicio_sexta ?? "--:--"} às ${p.hora_fim_sexta ?? "--:--"}`, x + 1.2, y + 9.4);
  if (p.dias_semana && p.dias_semana.length > 0) {
    doc.setFontSize(6.5).setTextColor(80, 80, 80);
    doc.text(`Dias: ${p.dias_semana.join(" · ")}`, x + 1.2, y + 11.6);
    doc.setTextColor(0, 0, 0);
  }
  y += rowH * 2;

  return y + 1;
}

function drawRiscosTable(doc: jsPDF, p: APRPdfParams, yStart: number) {
  // Cabeçalho duplo: "AVALIAÇÃO DO RISCO" agrupando P/S/G
  const head = [
    [
      { content: "PASSO A PASSO DA ATIVIDADE", rowSpan: 2 },
      { content: "RISCOS IDENTIFICADOS", rowSpan: 2 },
      { content: "EFEITOS / DANOS", rowSpan: 2 },
      { content: "AVALIAÇÃO DO RISCO", colSpan: 3 },
      { content: "AÇÕES PREVENTIVAS DOS RISCOS", rowSpan: 2 },
      { content: "EPI", rowSpan: 2 },
      { content: "RESPONSÁVEIS PELAS AÇÕES", rowSpan: 2 },
      { content: "NRs", rowSpan: 2 },
    ],
    ["P", "S", "G"],
  ];

  const body = p.riscos.map((r) => {
    // Use SOMENTE o que o usuário digitou no campo "passo a passo".
    const passo = (r.passo ?? "").trim();
    // Risco em duas linhas: nome \n (CATEGORIA)
    const riscoTexto = r.risco_categoria
      ? `${r.risco_nome}\n(${r.risco_categoria})`
      : r.risco_nome;
    return [
      passo,
      riscoTexto,
      r.efeitos_danos ?? "",
      String(r.probabilidade),
      String(r.severidade),
      String(r.nivel_risco),
      r.acoes_preventivas ?? "",
      (r.epis ?? []).join(", "),
      r.responsavel_acoes ?? "",
      (r.nrs ?? []).join(", "),
    ];
  });

  autoTable(doc, {
    head: head as any, body,
    startY: yStart,
    margin: { left: MARGIN, right: MARGIN, top: CONTENT_TOP },
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 1.4, valign: "middle", lineColor: [0, 0, 0], lineWidth: 0.15, textColor: 0 },
    headStyles: {
      fillColor: [C_TBL_HEAD[0], C_TBL_HEAD[1], C_TBL_HEAD[2]],
      textColor: 0, fontStyle: "bold", fontSize: 7.5, halign: "center", lineColor: [0, 0, 0], lineWidth: 0.3,
    },
    columnStyles: {
      0: { cellWidth: 38 },
      1: { cellWidth: 30, halign: "center" },
      2: { cellWidth: 28 },
      3: { cellWidth: 6, halign: "center" },
      4: { cellWidth: 6, halign: "center" },
      5: { cellWidth: 8, halign: "center", fontStyle: "bold" },
      6: { cellWidth: 65 },
      7: { cellWidth: 30 },
      8: { cellWidth: 30 },
      9: { cellWidth: "auto", halign: "center" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 5) {
        const r = p.riscos[data.row.index];
        if (r) {
          const m = grauMeta(r.nivel_risco);
          data.cell.styles.fillColor = [m.color[0], m.color[1], m.color[2]];
          data.cell.styles.textColor = r.nivel_risco >= 4 ? 255 : 0;
        }
      }
    },
    didDrawPage: () => {
      drawFullChrome(doc, p);
    },
  });
}

function drawFooter(doc: jsPDF) {
  doc.setFont("helvetica", "bold").setFontSize(8);
  doc.setTextColor(220, 38, 38);
  doc.text(
    '"NENHUM TRABALHO É TÃO URGENTE OU IMPORTANTE QUE NÃO POSSA SER PLANEJADO E EXECUTADO COM SEGURANÇA"',
    PAGE_W / 2, PAGE_H - 4, { align: "center" },
  );
  doc.setTextColor(0, 0, 0);
}

// Cabeçalho COMPLETO desenhado em TODAS as páginas (chrome ISO + identificação + rodapé).
function drawFullChrome(doc: jsPDF, p: APRPdfParams) {
  drawHeader(doc, p, doc.getCurrentPageInfo().pageNumber, doc.getNumberOfPages());
  drawFooter(doc);
  drawIdBlock(doc, p, MARGIN + 20);
}

function drawGeraisPage(doc: jsPDF, p: APRPdfParams) {
  doc.addPage();
  const chrome = () => {
    drawFullChrome(doc, p);
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(0, 0, 0);
    doc.text("GERAIS:", MARGIN, CONTENT_TOP + 2);
  };
  chrome();

  const txt = (p.texto_gerais && p.texto_gerais.trim()) || DEFAULT_TEXTO_GERAIS;
  // Cada linha numerada como uma row da tabela (sem bordas) para auto-paginar com cabeçalho.
  const items = txt.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  autoTable(doc, {
    startY: CONTENT_TOP + 6,
    margin: { left: MARGIN, right: MARGIN, top: CONTENT_TOP + 6 },
    body: items.map((t) => [t]),
    theme: "plain",
    styles: { fontSize: 9, cellPadding: { top: 1, bottom: 1, left: 1, right: 1 }, textColor: 0 },
    columnStyles: { 0: { cellWidth: CONTENT_W - 2 } },
    didDrawPage: () => { chrome(); },
  });

  // Aviso de exigência de PTE (após o GERAIS)
  if (p.exige_pte) {
    const lastY = (doc as any).lastAutoTable?.finalY ?? CONTENT_TOP + 6;
    const yStart = lastY + 4;
    const linhas = p.ptes_vinculadas && p.ptes_vinculadas.length > 0
      ? `PTE(s) vinculada(s): ${p.ptes_vinculadas.join(", ")}`
      : "NENHUMA PTE EMITIDA — PENDENTE DE EMISSÃO ANTES DO INÍCIO DA ATIVIDADE";
    doc.setFillColor(255, 243, 205);
    doc.setDrawColor(220, 53, 69);
    doc.setLineWidth(0.5);
    doc.rect(MARGIN, yStart, CONTENT_W, 14, "FD");
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(220, 53, 69);
    doc.text("⚠ ESTA ATIVIDADE EXIGE PERMISSÃO DE TRABALHO ESPECIAL (PTE)", MARGIN + 2, yStart + 5);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(0, 0, 0);
    doc.text("Emitir PTE conforme procedimento interno antes do início das atividades.", MARGIN + 2, yStart + 9);
    doc.setFont("helvetica", "bold").setFontSize(8.5);
    doc.text(linhas, MARGIN + 2, yStart + 12.5);
  }
}

function drawLegendaAssinaturas(doc: jsPDF, p: APRPdfParams) {
  doc.addPage();
  drawFullChrome(doc, p);

  let y = CONTENT_TOP + 2;
  doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(220, 38, 38);
  doc.text("ATENÇÃO: AO OBSERVAR OUTRO RISCO NÃO PREVISTO NESTA APR, PARALISAR O TRABALHO IMEDIATAMENTE E COMUNICAR AO SESMT", PAGE_W / 2, y, { align: "center" });
  doc.setTextColor(0, 0, 0);
  y += 4;

  // Bloco 1: Riscos Ambientais + Atender hierarquia
  const colW = CONTENT_W / 2;
  const blockH = 14;
  doc.setLineWidth(0.3);
  doc.rect(MARGIN, y, colW, blockH);
  doc.rect(MARGIN + colW, y, colW, blockH);
  doc.setFont("helvetica", "bold").setFontSize(8);
  doc.text("Riscos Ambientais - Classificar:", MARGIN + 1.5, y + 4);
  doc.text("Atender a Hierarquia:", MARGIN + colW + 1.5, y + 4);
  doc.setFont("helvetica", "normal").setFontSize(7.5);
  doc.text("1 – Físico   2 – Químico   3 – Biológico   4 – Ergonômico   5 – Mecânico/Acidentes.", MARGIN + 1.5, y + 9);
  doc.text("CA - Controles Administrativos / EPC - Equipamentos de Proteção Coletivas /", MARGIN + colW + 1.5, y + 8);
  doc.text("EPI - Equipamentos de Proteção Individual.", MARGIN + colW + 1.5, y + 11.5);
  y += blockH;

  // Avaliação do risco — escala P+S
  doc.rect(MARGIN, y, 50, 16);
  doc.setFont("helvetica", "bold").setFontSize(8);
  doc.text("AVALIAÇÃO DO RISCO", MARGIN + 25, y + 9, { align: "center" });

  const subW = (CONTENT_W - 50) / 2;
  // PROBABILIDADE
  doc.rect(MARGIN + 50, y, subW, 5);
  doc.setFontSize(7).setFont("helvetica", "bold");
  doc.text("PROBABILIDADE (FREQUÊNCIA)", MARGIN + 50 + subW / 2, y + 3.5, { align: "center" });
  // SEVERIDADE
  doc.rect(MARGIN + 50 + subW, y, subW, 5);
  doc.text("SEVERIDADE (IMPACTO)", MARGIN + 50 + subW + subW / 2, y + 3.5, { align: "center" });

  // sub-células P (Baixa/Média/Alta)
  const pillW = subW / 3;
  const pills = [
    { l: "BAIXA (1)", c: [16, 185, 129] },
    { l: "MÉDIA (2)", c: [234, 179, 8] },
    { l: "ALTA (3)", c: [220, 38, 38] },
  ];
  pills.forEach((pl, i) => {
    doc.setFillColor(pl.c[0], pl.c[1], pl.c[2]);
    doc.rect(MARGIN + 50 + i * pillW, y + 5, pillW, 11, "F");
    doc.rect(MARGIN + 50 + i * pillW, y + 5, pillW, 11);
    doc.setTextColor(255, 255, 255).setFont("helvetica", "bold").setFontSize(8);
    doc.text(pl.l, MARGIN + 50 + i * pillW + pillW / 2, y + 11, { align: "center" });
  });
  pills.forEach((pl, i) => {
    doc.setFillColor(pl.c[0], pl.c[1], pl.c[2]);
    doc.rect(MARGIN + 50 + subW + i * pillW, y + 5, pillW, 11, "F");
    doc.rect(MARGIN + 50 + subW + i * pillW, y + 5, pillW, 11);
    doc.text(pl.l, MARGIN + 50 + subW + i * pillW + pillW / 2, y + 11, { align: "center" });
  });
  doc.setTextColor(0, 0, 0);
  y += 16;

  // Grau do risco — somatório P+S
  doc.setFillColor(245, 245, 245);
  doc.rect(MARGIN, y, CONTENT_W, 5, "F");
  doc.rect(MARGIN, y, CONTENT_W, 5);
  doc.setFont("helvetica", "bold").setFontSize(8);
  doc.text("GRAU DO RISCO: (SOMATÓRIO DA PROBABILIDADE + SEVERIDADE)", MARGIN + CONTENT_W / 2, y + 3.5, { align: "center" });
  y += 5;
  const graus = [
    { v: 2, l: "TRIVIAL", c: [16, 185, 129] },
    { v: 3, l: "TOLERÁVEL", c: [132, 204, 22] },
    { v: 4, l: "MODERADO", c: [234, 179, 8] },
    { v: 5, l: "SUBSTANCIAL", c: [249, 115, 22] },
    { v: 6, l: "INACEITÁVEL", c: [220, 38, 38] },
  ];
  const gw = CONTENT_W / 5;
  graus.forEach((g, i) => {
    doc.setFillColor(g.c[0], g.c[1], g.c[2]);
    doc.rect(MARGIN + i * gw, y, gw, 8, "F");
    doc.rect(MARGIN + i * gw, y, gw, 8);
    doc.setTextColor(g.v >= 4 ? 255 : 0, g.v >= 4 ? 255 : 0, g.v >= 4 ? 255 : 0);
    doc.setFont("helvetica", "bold").setFontSize(9);
    doc.text(`${g.v} = ${g.l}`, MARGIN + i * gw + gw / 2, y + 5.5, { align: "center" });
  });
  doc.setTextColor(0, 0, 0);
  y += 12;

  // Frase de segurança em vermelho
  doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(220, 38, 38);
  doc.text(
    "“NENHUM TRABALHO É TÃO URGENTE OU IMPORTANTE QUE NÃO POSSA SER PLANEJADO E EXECUTADO COM SEGURANÇA”",
    PAGE_W / 2,
    y + 4,
    { align: "center" },
  );
  doc.setTextColor(0, 0, 0);
  y += 7;

  // Cabeçalho "RELAÇÃO DOS ENVOLVIDOS:"
  doc.setLineWidth(0.3);
  doc.rect(MARGIN, y, CONTENT_W, 6);
  doc.setFont("helvetica", "bold").setFontSize(9);
  doc.text("RELAÇÃO DOS ENVOLVIDOS:", PAGE_W / 2, y + 4, { align: "center" });
  y += 6;

  // Tabela: Elaborador (esq) | Executantes da Atividade (dir)
  const colLeftW = CONTENT_W * 0.42;
  const colRightW = CONTENT_W - colLeftW;
  const headerH = 6;

  // Header
  doc.setFillColor(219, 234, 247);
  doc.rect(MARGIN, y, colLeftW, headerH, "F");
  doc.rect(MARGIN + colLeftW, y, colRightW, headerH, "F");
  doc.rect(MARGIN, y, colLeftW, headerH);
  doc.rect(MARGIN + colLeftW, y, colRightW, headerH);
  doc.setFont("helvetica", "bold").setFontSize(9);
  doc.text("Elaborador", MARGIN + colLeftW / 2, y + 4, { align: "center" });
  doc.text(
    "EXECUTANTES DA ATIVIDADE",
    MARGIN + colLeftW + colRightW / 2,
    y + 4,
    { align: "center" },
  );
  y += headerH;

  // Corpo: 8 linhas de executantes à direita; bloco único à esquerda
  const linhasExec = 8;
  const rowH = 7;
  const bodyH = rowH * linhasExec;

  // Caixa Elaborador (lado esquerdo, em branco para preenchimento manual)
  // Caixa Elaborador — dividida em 2: ENCARREGADO (topo) e TST/SESMT (base)
  const elabH = bodyH / 2;
  const drawSigSlot = (sy: number, label: string, sig?: string | null, heightPx?: number | null) => {
    doc.rect(MARGIN, sy, colLeftW, elabH);
    doc.setFillColor(245, 245, 245);
    doc.rect(MARGIN, sy, colLeftW, 5, "F");
    doc.rect(MARGIN, sy, colLeftW, 5);
    doc.setFont("helvetica", "bold").setFontSize(7.5).setTextColor(0, 0, 0);
    doc.text(label, MARGIN + colLeftW / 2, sy + 3.5, { align: "center" });
    // linha de assinatura
    const lineY = sy + elabH - 6;
    doc.setLineWidth(0.2);
    doc.line(MARGIN + 3, lineY, MARGIN + colLeftW - 3, lineY);
    doc.setFont("helvetica", "normal").setFontSize(6.5).setTextColor(90, 90, 90);
    doc.text("Assinatura", MARGIN + colLeftW / 2, lineY + 3, { align: "center" });
    doc.setTextColor(0, 0, 0);
    if (sig) {
      try {
        const areaY = sy + 6;
        const areaH = lineY - areaY - 0.5;
        const areaW = colLeftW - 6;
        const areaX = MARGIN + 3;
        const fmt = sig.startsWith("data:image/jpeg") ? "JPEG" : "PNG";
        // preserva proporção e centraliza no slot
        const props: any = (doc as any).getImageProperties?.(sig) ?? { width: areaW, height: areaH };
        const ratio = props.width / props.height;
        // Altura escolhida pelo usuário (px 20–140) vira a altura-alvo no PDF.
        // Antes era tratada só como limite máximo; em assinaturas largas isso
        // deixava o desenho com o mesmo tamanho mesmo após mexer no slider.
        const frac = heightPx == null ? 1 : Math.max(0.15, Math.min(1, heightPx / 140));
        let drawH = areaH * frac;
        let drawW = drawH * ratio;
        if (drawW > areaW) { drawW = areaW; drawH = drawW / ratio; }
        const dx = areaX + (areaW - drawW) / 2;
        const dy = areaY + (areaH - drawH) / 2;
        doc.addImage(sig, fmt, dx, dy, drawW, drawH, undefined, "FAST");
      } catch {
        /* noop */
      }
    }
  };
  drawSigSlot(y, "ENCARREGADO", p.encSig, p.encSigHeight ?? null);
  drawSigSlot(y + elabH, "TÉCNICO DE SEGURANÇA DO TRABALHO (SESMT)", p.tstSig, p.tstSigHeight ?? null);

  // Linhas Executantes (lado direito) — apenas numeradas, em branco
  doc.setFont("helvetica", "bold").setFontSize(9);
  for (let i = 0; i < linhasExec; i++) {
    const ry = y + i * rowH;
    doc.rect(MARGIN + colLeftW, ry, colRightW, rowH);
    doc.text(`${i + 1} -`, MARGIN + colLeftW + 2, ry + 4.7);
  }
}

function drawAnexoExecutantes(doc: jsPDF, p: APRPdfParams) {
  doc.addPage();
  const chrome = () => {
    drawFullChrome(doc, p);
    doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(0, 0, 0);
    doc.text("ANEXO I – ASSINATURA DOS EXECUTANTES DO SERVIÇO", PAGE_W / 2, CONTENT_TOP + 3, { align: "center" });
  };
  chrome();

  const exec = p.assinaturas.filter((a) => a.papel === "EXECUTANTE");
  // Garante mínimo de 25 linhas (linhas estreitas para máximo aproveitamento)
  const totalLinhas = Math.max(25, exec.length);
  const body: string[][] = [];
  for (let i = 0; i < totalLinhas; i++) {
    const a = exec[i];
    body.push([
      String(i + 1).padStart(2, "0"),
      a?.nome ?? "",
      "",
    ]);
  }

  autoTable(doc, {
    startY: CONTENT_TOP + 7,
    margin: { left: MARGIN, right: MARGIN, top: CONTENT_TOP + 7 },
    head: [["Nº", "NOME", "ASSINATURA"]],
    body,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: { top: 0.6, bottom: 0.6, left: 1.2, right: 1.2 }, minCellHeight: 5.5, lineColor: [0, 0, 0], lineWidth: 0.2, valign: "middle" },
    headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: "bold", halign: "center", lineColor: [0, 0, 0], lineWidth: 0.3 },
    columnStyles: {
      0: { cellWidth: 12, halign: "center", fontStyle: "bold" },
      1: { cellWidth: 130 },
      2: { cellWidth: "auto" },
    },
    didDrawPage: () => { chrome(); },
  });
}

async function loadImageDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function trimSignatureImage(dataUrl: string): Promise<string> {
  if (!dataUrl.startsWith("data:image/") || typeof document === "undefined") return dataUrl;
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = dataUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx || canvas.width === 0 || canvas.height === 0) return dataUrl;
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let minX = canvas.width, minY = canvas.height, maxX = -1, maxY = -1;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        const ink = a > 24 && (r < 245 || g < 245 || b < 245) && (r + g + b) / 3 < 238;
        if (ink) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
      }
    }
    if (maxX < minX || maxY < minY) return dataUrl;
    const pad = Math.max(4, Math.round(Math.max(maxX - minX, maxY - minY) * 0.06));
    const sx = Math.max(0, minX - pad), sy = Math.max(0, minY - pad);
    const sw = Math.min(canvas.width - sx, maxX - minX + 1 + pad * 2);
    const sh = Math.min(canvas.height - sy, maxY - minY + 1 + pad * 2);
    const out = document.createElement("canvas");
    out.width = sw;
    out.height = sh;
    out.getContext("2d")?.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
    return out.toDataURL("image/png");
  } catch {
    return dataUrl;
  }
}

export async function gerarAPR(p: APRPdfParams): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  // Pré-carrega o logotipo (uma única vez)
  if (!p.logoDataUrl && p.logoUrl) {
    p.logoDataUrl = await loadImageDataUrl(p.logoUrl);
  }
  if (p.encSig) p.encSig = await trimSignatureImage(p.encSig);
  if (p.tstSig) p.tstSig = await trimSignatureImage(p.tstSig);

  // Página(s) 1..N: cabeçalho + identificação + tabela de riscos
  drawFullChrome(doc, p);
  drawRiscosTable(doc, p, CONTENT_TOP);

  // Página GERAIS
  drawGeraisPage(doc, p);

  // Página legenda + assinaturas TST/Resp
  drawLegendaAssinaturas(doc, p);

  // Página ANEXO I executantes
  drawAnexoExecutantes(doc, p);

  // Reescreve cabeçalhos com total correto
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    // Atualiza apenas o número da página (canto sup. direito) com o total correto
    doc.setFillColor(255, 255, 255);
    doc.rect(MARGIN, MARGIN, CONTENT_W, 18, "F");
    drawHeader(doc, p, i, total);
  }

  return doc;
}
