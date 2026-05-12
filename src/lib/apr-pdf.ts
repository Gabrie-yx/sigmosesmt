import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
};

export const DEFAULT_TEXTO_GERAIS = `01 - Em caso de ILUMINAÇÃO DEFICIENTE nos locais das atividades, fazer uso de refletores ou lanternas para atividades pontuais.
02 - Em caso de EMERGÊNCIA operacionalizar as ações do PAE - Plano de atendimento a Emergência.
03 - Antes do início da atividade com uso de SOLDA, OXI-GÁS OU LIXADEIRA (serviço a quente), verificar se existe a presença de INFLAMÁVEIS (óleo ou graxa, tinta, solvente etc) nas proximidades, não iniciar o serviço e retirar o material inflamável.
04 - NÃO manusear o manômetro do cilindro de oxigênio com as mãos ou luvas sujas de óleo e graxa, "risco de explosão".
05 - Fazer a DESTINAÇÃO DOS RESÍDUOS gerados nas atividades corretamente ou mantê-los segregados e isolados adequadamente. NUNCA jogar no rio ou lixeiras comuns.
06 - Qualquer DEFEITO que apresente máquinas ou acessórios deve ser informado IMEDIATAMENTE ao responsável pelo serviço.
07 - Manter EXTINTOR no local, nas atividades à quente.
08 - DIVULGAR os Procedimentos executivos relacionados à atividade.
09 - PROIBIDO EXECUTAR qualquer atividade que não esteja prevista nesta APR.
10 - Em caso de ACIDENTE ou INCIDENTE comunicar imediatamente ao SESMT, Encarregado, Supervisor.

Com a intenção de preservar a sua segurança, bem como a dos demais trabalhadores do DMN ESTALEIRO, os seguintes comportamentos serão considerados inaceitáveis, ou seja, está colocando a sua vida em risco e serão penalizados com medidas disciplinares:
• Execução de tarefa crítica sem permissão e/ou sem seguir o procedimento (altura, a quente, içamento de cargas, espaço confinado, elétrica);
• Retirada da proteção de partes móveis de máquinas e equipamentos;
• Não usar corretamente os Equipamentos de Proteção Individuais;
• Operar máquinas pesadas sem autorização.`;

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

  // Logo DMN
  doc.setFillColor(C_HEADER[0], C_HEADER[1], C_HEADER[2]);
  doc.roundedRect(MARGIN + 4, MARGIN + 4, cLogo - 8, headerH - 8, 1.5, 1.5, "F");
  doc.setTextColor(255, 255, 255).setFont("helvetica", "bold").setFontSize(13);
  doc.text("DMN", MARGIN + cLogo / 2, MARGIN + headerH / 2 + 2, { align: "center" });
  doc.setTextColor(0, 0, 0);

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

  // Linha 1: CNPJ | Início | Fim | APR Nº | Elaborado | Página
  const cells1: [string, string, number][] = [
    ["CNPJ:", p.matrizCnpj ?? "13.378.697/0001-80", 60],
    ["Início:", p.data_inicio ?? p.data_emissao, 45],
    ["Fim:", p.data_fim ?? (p.data_validade ?? ""), 45],
    ["APR Nº", p.numero, 65],
    ["Elaborado:", p.data_emissao, 50],
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
    const last = i === c3.length - 1;
    const cw = last ? CONTENT_W - (x - MARGIN) - 65 : w;
    doc.rect(x, y, cw, rowH * 2);
    doc.setFont("helvetica", "bold").setFontSize(7);
    doc.text(lbl, x + 1.2, y + 3.5);
    doc.setFont("helvetica", "normal").setFontSize(8);
    const lines = doc.splitTextToSize(String(val ?? "—"), cw - 3);
    doc.text(lines.slice(0, 2), x + 1.2, y + 8);
    x += cw;
  });
  // Horário (sempre por último)
  const wH = CONTENT_W - (x - MARGIN);
  doc.rect(x, y, wH, rowH * 2);
  doc.setFont("helvetica", "bold").setFontSize(7);
  doc.text("Horário:", x + 1.2, y + 3.5);
  doc.setFont("helvetica", "normal").setFontSize(8);
  doc.text(`${p.hora_inicio ?? "--:--"} às ${p.hora_fim ?? "--:--"}`, x + 1.2, y + 8);
  if (p.casco_numero) doc.text(`Casco: ${p.casco_numero}`, x + 1.2, y + 11);
  y += rowH * 2;

  return y + 1;
}

function drawRiscosTable(doc: jsPDF, p: APRPdfParams, yStart: number) {
  const head = [[
    "PASSO A PASSO DA ATIVIDADE",
    "RISCOS IDENTIFICADOS",
    "EFEITOS / DANOS",
    "P", "S", "G",
    "AÇÕES PREVENTIVAS DOS RISCOS",
    "EPI",
    "RESPONSÁVEIS PELAS AÇÕES",
    "NRs",
  ]];

  const body = p.riscos.map((r) => {
    const passo = r.passo ?? `${r.ordem}. ${r.risco_categoria ?? ""}`.trim();
    return [
      passo,
      r.risco_nome + (r.risco_categoria ? `\n[${r.risco_categoria}]` : ""),
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
    head, body,
    startY: yStart,
    margin: { left: MARGIN, right: MARGIN, top: MARGIN + 20 },
    theme: "grid",
    styles: { fontSize: 7, cellPadding: 1.4, valign: "middle", lineColor: [0, 0, 0], lineWidth: 0.15, textColor: 0 },
    headStyles: {
      fillColor: [C_TBL_HEAD[0], C_TBL_HEAD[1], C_TBL_HEAD[2]],
      textColor: 0, fontStyle: "bold", fontSize: 7.5, halign: "center", lineColor: [0, 0, 0], lineWidth: 0.3,
    },
    columnStyles: {
      0: { cellWidth: 38 },
      1: { cellWidth: 30 },
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
      drawHeader(doc, p, doc.getCurrentPageInfo().pageNumber, doc.getNumberOfPages());
      drawFooter(doc);
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

function drawGeraisPage(doc: jsPDF, p: APRPdfParams) {
  doc.addPage();
  drawHeader(doc, p, doc.getCurrentPageInfo().pageNumber, doc.getNumberOfPages());
  drawFooter(doc);

  let y = MARGIN + 22;
  doc.setFont("helvetica", "bold").setFontSize(11);
  doc.text("GERAIS:", MARGIN, y);
  y += 5;
  doc.setFont("helvetica", "normal").setFontSize(9);
  const txt = (p.texto_gerais && p.texto_gerais.trim()) || DEFAULT_TEXTO_GERAIS;
  const lines = doc.splitTextToSize(txt, CONTENT_W - 2);
  doc.text(lines, MARGIN + 1, y);
}

function drawLegendaAssinaturas(doc: jsPDF, p: APRPdfParams) {
  doc.addPage();
  drawHeader(doc, p, doc.getCurrentPageInfo().pageNumber, doc.getNumberOfPages());
  drawFooter(doc);

  let y = MARGIN + 22;
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

  // ASSINATURAS
  doc.setFont("helvetica", "bold").setFontSize(13);
  doc.text("A S S I N A T U R A S", PAGE_W / 2, y + 3, { align: "center" });
  y += 8;

  const tst = p.assinaturas.find((a) => a.papel === "TST");
  const enc = p.assinaturas.find((a) => a.papel === "ENCARREGADO");
  const sigW = CONTENT_W / 2 - 4;
  const sigH = 40;

  function caixaAssin(x: number, papel: string, nome: string, fnc?: string | null) {
    doc.setLineWidth(0.4);
    doc.rect(x, y, sigW, sigH);
    doc.setFillColor(245, 245, 245);
    doc.rect(x, y, sigW, 7, "F");
    doc.rect(x, y, sigW, 7);
    doc.setFont("helvetica", "bold").setFontSize(10);
    doc.text(papel, x + sigW / 2, y + 5, { align: "center" });
    doc.setFont("helvetica", "normal").setFontSize(9);
    if (nome) doc.text(nome, x + sigW / 2, y + 22, { align: "center" });
    doc.setLineWidth(0.3);
    doc.line(x + 6, y + sigH - 8, x + sigW - 6, y + sigH - 8);
    doc.setFontSize(7).setFont("helvetica", "italic");
    doc.text("Assinatura", x + sigW / 2, y + sigH - 4, { align: "center" });
    if (fnc) {
      doc.setFont("helvetica", "normal").setFontSize(7);
      doc.text(fnc, x + sigW / 2, y + 28, { align: "center" });
    }
  }
  caixaAssin(MARGIN, "Técnico em Segurança do Trabalho", tst?.nome ?? "", tst?.funcao);
  caixaAssin(MARGIN + sigW + 8, "Responsável pelo Serviço", enc?.nome ?? "", enc?.funcao);
}

function drawAnexoExecutantes(doc: jsPDF, p: APRPdfParams) {
  doc.addPage();
  drawHeader(doc, p, doc.getCurrentPageInfo().pageNumber, doc.getNumberOfPages());
  drawFooter(doc);

  let y = MARGIN + 22;
  doc.setFont("helvetica", "bold").setFontSize(13);
  doc.text("ANEXO I – ASSINATURA DOS EXECUTANTES DO SERVIÇO", PAGE_W / 2, y, { align: "center" });
  y += 4;

  const exec = p.assinaturas.filter((a) => a.papel === "EXECUTANTE");
  // Garante mínimo de 14 linhas no papel
  const totalLinhas = Math.max(14, exec.length);
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
    startY: y + 2,
    margin: { left: MARGIN, right: MARGIN, top: MARGIN + 22 },
    head: [["Nº", "NOME", "ASSINATURA"]],
    body,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2.5, minCellHeight: 11, lineColor: [0, 0, 0], lineWidth: 0.2, valign: "middle" },
    headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: "bold", halign: "center", lineColor: [0, 0, 0], lineWidth: 0.3 },
    columnStyles: {
      0: { cellWidth: 14, halign: "center", fontStyle: "bold" },
      1: { cellWidth: 110 },
      2: { cellWidth: "auto" },
    },
    didDrawPage: () => {
      drawHeader(doc, p, doc.getCurrentPageInfo().pageNumber, doc.getNumberOfPages());
      drawFooter(doc);
    },
  });
}

export function gerarAPR(p: APRPdfParams): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  // Página(s) 1..N: cabeçalho + identificação + tabela de riscos
  drawHeader(doc, p, 1, 1); // total ajustado depois
  drawFooter(doc);
  const yAfterId = drawIdBlock(doc, p, MARGIN + 20);
  drawRiscosTable(doc, p, yAfterId);

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
    // Limpa área do cabeçalho (cobre com branco) e redesenha com paginação correta
    doc.setFillColor(255, 255, 255);
    doc.rect(MARGIN, MARGIN, CONTENT_W, 18, "F");
    drawHeader(doc, p, i, total);
  }

  return doc;
}
