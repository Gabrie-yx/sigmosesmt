import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { LOGO_INSS_PNG_BASE64 } from "@/assets/logo-inss";

/**
 * Gerador de PPP fiel ao leiaute oficial (Anexo XV — IN PRES/INSS 128/2022).
 * Estrutura todos os campos numerados (1 a 18) e blocos "DADOS ADMINISTRATIVOS",
 * "REGISTROS AMBIENTAIS" e "RESPONSÁVEIS PELAS INFORMAÇÕES".
 */

export type PPPRisco = {
  periodo: string;
  tipo: string; // Físico / Químico / Biológico / Ergonômico / Acidente
  fator_risco: string; // ex: "Calor (07/10/2022 a 17/05/2023)"
  intensidade: string; // ex: "29,45 ºC" ou "NA"
  tecnica: string; // ex: "NHO06 - ..."
  epc_eficaz: string; // "Sim" | "Não" | "NA"
  epi_eficaz: string; // idem
  ca_epi: string;
};

export type PPPResponsavel = {
  periodo: string;
  cpf: string;
  registro: string; // Reg. Cons. de classe
  nome: string;
};

export type PPPCAT = { data: string; numero: string };

export type PPPLotacao = {
  periodo: string;
  cnpj: string;
  setor: string;
  cargo: string;
  funcao: string;
  cbo: string;
  gfip_esocial: string;
};

export type PPPProfissiografia = { periodo: string; descricao: string };

export type PPPDados = {
  // 1-3 Empresa
  empresa_cnpj: string;
  empresa_nome: string;
  empresa_cnae: string;
  // 4-6 Trabalhador
  trab_nome: string;
  trab_br_pdh: string; // BR/PDH (geralmente "NA")
  trab_cpf: string;
  // 7-11
  trab_nascimento: string; // DD/MM/AAAA
  trab_sexo: string; // Masculino / Feminino
  trab_matricula_esocial: string;
  trab_admissao: string; // DD/MM/AAAA
  regime_revezamento: string;
  // 12 CATs
  cats: PPPCAT[];
  // 13 Lotação e Atribuição
  lotacoes: PPPLotacao[];
  // 14 Profissiografia
  profissiografias: PPPProfissiografia[];
  // 15 Riscos
  riscos: PPPRisco[];
  // 15.9 NR-06 / NR-01 — 5 respostas Sim/Não
  nr_medidas_protecao: string;
  nr_funcionamento_epi: string;
  nr_prazo_validade: string;
  nr_periodicidade_troca: string;
  nr_higienizacao: string;
  // 16 Responsáveis
  responsaveis: PPPResponsavel[];
  // 17 Data emissão | 18 Representante Legal
  data_emissao: string; // DD/MM/AAAA
  rep_legal_cpf: string;
  rep_legal_nome: string;
  // Observações
  observacoes: string;
};

const BLACK: [number, number, number] = [0, 0, 0];
const WHITE: [number, number, number] = [255, 255, 255];
const TITLE_BLUE: [number, number, number] = [0, 92, 185];

const baseStyle = {
  fontSize: 7.5,
  cellPadding: 0.6,
  lineColor: BLACK,
  lineWidth: 0.15,
  textColor: BLACK,
  fillColor: WHITE,
  overflow: "linebreak" as const,
};
const headerCellStyle = { ...baseStyle, fillColor: WHITE, fontStyle: "bold" as const };
const sectionTitleStyle = { ...baseStyle, fillColor: WHITE, fontStyle: "bold" as const, halign: "center" as const, fontSize: 8, cellPadding: 0.8 };
const blockTitleStyle = { ...baseStyle, fillColor: WHITE, fontStyle: "bold" as const, halign: "left" as const, cellPadding: 0.6 };

function s(v: string | null | undefined): string {
  const t = (v ?? "").toString().trim();
  return t.length ? t : "";
}

export function gerarPPPPdf(
  d: PPPDados,
  opts?: { numero?: string | null; assinaturaDataUrl?: string | null },
): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210;
  const pageH = 297;
  const margin = 10; // margens laterais
  const marginY = 7; // margens superior/inferior (cabeçalho/rodapé)
  const contentW = pageW - margin * 2;

  // ===== Cabeçalho oficial (logo Previdência Social + título) =====
  let y = marginY;
  // Caixa do cabeçalho com borda fina
  const headerH = 14;
  doc.setDrawColor(0);
  doc.setLineWidth(0.2);
  doc.rect(margin, y, contentW, headerH);
  try {
    // Logo Previdência Social — aspect ratio ~1.66:1
    doc.addImage(LOGO_INSS_PNG_BASE64, "PNG", margin + 2, y + 1, 20, 12);
  } catch {
    // se falhar embed da imagem, segue sem logo
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(TITLE_BLUE[0], TITLE_BLUE[1], TITLE_BLUE[2]);
  doc.text("PERFIL PROFISSIOGRÁFICO PREVIDENCIÁRIO (PPP)", margin + 26, y + headerH / 2 + 1.5);
  doc.setTextColor(0);
  if (opts?.numero) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(`Nº ${opts.numero}`, pageW - margin - 2, y + 4, { align: "right" });
  }
  y += headerH + 0.5;

  // ===================== DADOS ADMINISTRATIVOS =====================
  y = sectionTitleRow(doc, "DADOS ADMINISTRATIVOS", margin, y, contentW);

  // Linha 1-3: CNPJ | Nome Empresarial | CNAE
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "grid",
    tableWidth: contentW,
    head: [["1 Nº CNPJ do Domicílio Tributário/CEI/CAEPF/CNO", "2 Nome Empresarial", "3 CNAE"]],
    body: [[s(d.empresa_cnpj), s(d.empresa_nome), s(d.empresa_cnae)]],
    styles: baseStyle,
    headStyles: headerCellStyle,
    columnStyles: { 0: { cellWidth: 70 }, 2: { cellWidth: 30 } },
  });
  y = (doc as any).lastAutoTable.finalY;

  // Linha 4-6: Nome | BR/PDH | CPF
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "grid",
    tableWidth: contentW,
    head: [["4 Nome do Trabalhador", "5 BR/PDH", "6 CPF nº"]],
    body: [[s(d.trab_nome), s(d.trab_br_pdh), s(d.trab_cpf)]],
    styles: baseStyle,
    headStyles: headerCellStyle,
    columnStyles: { 1: { cellWidth: 25, halign: "center" }, 2: { cellWidth: 35, halign: "center" } },
  });
  y = (doc as any).lastAutoTable.finalY;

  // Linha 7-11
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "grid",
    tableWidth: contentW,
    head: [["7 Data Nascimento", "8 Sexo (F/M)", "9 Matrícula eSocial", "10 Data Admissão", "11 Regime Revezamento"]],
    body: [[s(d.trab_nascimento), s(d.trab_sexo), s(d.trab_matricula_esocial), s(d.trab_admissao), s(d.regime_revezamento)]],
    styles: { ...baseStyle },
    headStyles: { ...headerCellStyle },
  });
  y = (doc as any).lastAutoTable.finalY;

  // 12 CAT
  y = blockTitleRow(doc, "12 - CAT REGISTRADA", margin, y, contentW);
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "grid",
    tableWidth: contentW,
    head: [["12.1 Data do Registro", "12.2 Número da CAT"]],
    body: d.cats.length > 0 ? d.cats.map((c) => [s(c.data), s(c.numero)]) : [["", ""]],
    styles: baseStyle,
    headStyles: headerCellStyle,
  });
  y = (doc as any).lastAutoTable.finalY;

  // 13 Lotação e Atribuição
  y = blockTitleRow(doc, "13 - Lotação e Atribuição", margin, y, contentW);
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "grid",
    tableWidth: contentW,
    head: [["13.1 Período", "13.2 CNPJ/CEI/CAEPF/CNO", "13.3 Setor", "13.4 Cargo", "13.5 Função", "13.6 CBO", "13.7 GFIP/eSocial"]],
    body: d.lotacoes.length > 0
      ? d.lotacoes.map((l) => [s(l.periodo), s(l.cnpj), s(l.setor), s(l.cargo), s(l.funcao), s(l.cbo), s(l.gfip_esocial)])
      : [["", "", "", "", "", "", ""]],
    styles: { ...baseStyle, fontSize: 7 },
    headStyles: { ...headerCellStyle, fontSize: 7 },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 30 },
      5: { cellWidth: 16 },
      6: { cellWidth: 22 },
    },
  });
  y = (doc as any).lastAutoTable.finalY;

  // 14 Profissiografia
  y = blockTitleRow(doc, "14 - Profissiografia", margin, y, contentW);
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "grid",
    tableWidth: contentW,
    head: [["14.1 Período", "14.2 Descrição das Atividades"]],
    body: d.profissiografias.length > 0
      ? d.profissiografias.map((p) => [s(p.periodo), s(p.descricao)])
      : [["", ""]],
    styles: baseStyle,
    headStyles: headerCellStyle,
    columnStyles: { 0: { cellWidth: 30 } },
  });
  y = (doc as any).lastAutoTable.finalY;

  // ===================== REGISTROS AMBIENTAIS =====================
  if (y > pageH - 60) { doc.addPage(); y = marginY; }
  y = sectionTitleRow(doc, "REGISTROS AMBIENTAIS", margin, y, contentW);
  y = blockTitleRow(doc, "15 - Exposição a Fatores de Riscos", margin, y, contentW);
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "grid",
    tableWidth: contentW,
    head: [["15.1 Período", "15.2 Tipo", "15.3 Fator de Risco", "15.4 Intensidade/Concentração", "15.5 Técnica Utilizada", "15.6 EPC Eficaz (S/N)", "15.7 EPI Eficaz (S/N)", "15.8 CA EPI"]],
    body: d.riscos.length > 0
      ? d.riscos.map((r) => [s(r.periodo), s(r.tipo), s(r.fator_risco), s(r.intensidade), s(r.tecnica), s(r.epc_eficaz), s(r.epi_eficaz), s(r.ca_epi)])
      : [["", "", "", "", "", "", "", ""]],
    styles: { ...baseStyle, fontSize: 6.8 },
    headStyles: { ...headerCellStyle, fontSize: 6.8, valign: "middle" },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 16 },
      3: { cellWidth: 22 },
      5: { cellWidth: 14 },
      6: { cellWidth: 14 },
      7: { cellWidth: 16 },
    },
  });
  y = (doc as any).lastAutoTable.finalY;

  // 15.9 NR-06 / NR-01
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "grid",
    tableWidth: contentW,
    head: [[
      { content: "15.9 Atendimento aos requisitos das NR-06 e NR-01 do MTP pelos EPIs informados (*)", styles: { ...headerCellStyle } },
      { content: "(S/N)", styles: { ...headerCellStyle, halign: "center" } },
    ]],
    body: [
      ["Foi tentada a implementação de medidas de proteção coletiva, de caráter administrativo ou de organização do trabalho, optando-se pelo EPI por inviabilidade técnica, insuficiência ou interinidade, ou ainda em caráter complementar ou emergencial?", s(d.nr_medidas_protecao)],
      ["Foram observadas as condições de funcionamento e do uso ininterrupto do EPI ao longo do tempo, conforme especificação técnica do fabricante, ajustada às condições de campo?", s(d.nr_funcionamento_epi)],
      ["Foi observado o prazo de validade, conforme Certificado de Aprovação - CA do MTP?", s(d.nr_prazo_validade)],
      ["Foi observada a periodicidade de troca definida pelos programas ambientais, comprovada mediante recibo assinado pelo usuário em época própria?", s(d.nr_periodicidade_troca)],
      ["Foi observada a higienização?", s(d.nr_higienizacao)],
    ],
    styles: { ...baseStyle, fontSize: 7 },
    columnStyles: { 1: { cellWidth: 18, halign: "center" } },
  });
  y = (doc as any).lastAutoTable.finalY;

  // 16 Responsável pelos Registros Ambientais
  y = blockTitleRow(doc, "16 - Responsável pelos Registros Ambientais", margin, y, contentW);
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "grid",
    tableWidth: contentW,
    head: [["16.1 Período", "16.2 CPF nº", "16.3 Reg. Cons. de classe", "16.4 Nome do profissional legalmente habilitado"]],
    body: d.responsaveis.length > 0
      ? d.responsaveis.map((r) => [s(r.periodo), s(r.cpf), s(r.registro), s(r.nome)])
      : [["", "", "", ""]],
    styles: baseStyle,
    headStyles: headerCellStyle,
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 30 },
      2: { cellWidth: 40 },
    },
  });
  y = (doc as any).lastAutoTable.finalY;

  // ===================== RESPONSÁVEIS PELAS INFORMAÇÕES =====================
  if (y > pageH - 80) { doc.addPage(); y = marginY; }
  y = sectionTitleRow(doc, "RESPONSÁVEIS PELAS INFORMAÇÕES", margin, y, contentW);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  const decl =
    "Declaramos, para todos fins de direito, que as informações prestadas neste documento são verídicas e foram transcritas fielmente dos registros administrativos, das demonstrações ambientais e dos programas médicos de responsabilidade da empresa. É de nosso conhecimento que a prestação de informações falsas neste documento constitui crime de falsificação de documento público, nos termos do art. 297 do Código Penal e, também, que tais informações são de caráter privativo do trabalhador, constituindo crime, nos termos da Lei nº 9.029, de 13 de abril de 1995, práticas discriminatórias decorrentes de sua exigibilidade por outrem, bem como de sua divulgação para terceiros, ressalvado quando exigida pelos órgãos públicos competentes.";
  const lines = doc.splitTextToSize(decl, contentW - 2);
  doc.text(lines, margin + 1, y + 2.5);
  y += lines.length * 2.8 + 1.5;

  // 17 + 18
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "grid",
    tableWidth: contentW,
    head: [[
      { content: "17 Data da Emissão do PPP", styles: headerCellStyle },
      { content: "18 Representante Legal da Empresa", colSpan: 2, styles: headerCellStyle },
    ]],
    body: [
      [s(d.data_emissao), { content: "18.1 Nº CPF do Representante Legal", styles: { fillColor: WHITE, fontStyle: "bold" } } as any, { content: "18.2 Nome do Representante Legal", styles: { fillColor: WHITE, fontStyle: "bold" } } as any],
      [{ content: "", rowSpan: 1 } as any, s(d.rep_legal_cpf), s(d.rep_legal_nome)],
      [{ content: "", rowSpan: 1 } as any, { content: "_____________________________________\n(Assinatura física ou eletrônica)", colSpan: 2, styles: { halign: "center", minCellHeight: 12 } } as any],
    ],
    styles: baseStyle,
    columnStyles: { 0: { cellWidth: 35, valign: "middle" } },
  });
  y = (doc as any).lastAutoTable.finalY;

  // Estampa a assinatura do trabalhador (quando disponível) sobre a linha da última linha da tabela 17/18
  if (opts?.assinaturaDataUrl) {
    try {
      const lastY = y;
      const sigW = 40;
      const sigH = 14;
      const sigX = margin + 35 + (contentW - 35) / 2 - sigW / 2;
      const sigY = lastY - sigH - 2;
      doc.addImage(opts.assinaturaDataUrl, "PNG", sigX, sigY, sigW, sigH);
    } catch {
      // se a imagem falhar, mantém a linha em branco
    }
  }

  // Observações
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "grid",
    tableWidth: contentW,
    head: [[{ content: "Observações", styles: { ...headerCellStyle, halign: "center" } }]],
    body: [[{ content: s(d.observacoes) || " ", styles: { minCellHeight: 10 } }]],
    styles: baseStyle,
  });
  y = (doc as any).lastAutoTable.finalY;

  // Rodapé
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(120);
    doc.text(`Página ${p} de ${pageCount}`, pageW - margin, pageH - marginY + 3, { align: "right" });
    doc.setTextColor(0);
  }

  return doc;
}

/** Linha-título de seção (texto centralizado em negrito, fundo branco, com borda). */
function sectionTitleRow(doc: jsPDF, title: string, x: number, y: number, w: number): number {
  autoTable(doc, {
    startY: y,
    margin: { left: x, right: x },
    theme: "grid",
    tableWidth: w,
    body: [[{ content: title, styles: sectionTitleStyle }]],
    styles: baseStyle,
  });
  return (doc as any).lastAutoTable.finalY;
}

/** Linha-título de bloco (esquerda, negrito, fundo branco). */
function blockTitleRow(doc: jsPDF, title: string, x: number, y: number, w: number): number {
  autoTable(doc, {
    startY: y,
    margin: { left: x, right: x },
    theme: "grid",
    tableWidth: w,
    body: [[{ content: title, styles: blockTitleStyle }]],
    styles: baseStyle,
  });
  return (doc as any).lastAutoTable.finalY;
}

/** Helpers pra construir o objeto PPPDados a partir dos dados do sistema. */
export function emptyPPPDados(): PPPDados {
  return {
    empresa_cnpj: "", empresa_nome: "", empresa_cnae: "",
    trab_nome: "", trab_br_pdh: "NA", trab_cpf: "",
    trab_nascimento: "", trab_sexo: "", trab_matricula_esocial: "",
    trab_admissao: "", regime_revezamento: "NA",
    cats: [],
    lotacoes: [],
    profissiografias: [],
    riscos: [],
    nr_medidas_protecao: "Não",
    nr_funcionamento_epi: "Não",
    nr_prazo_validade: "Não",
    nr_periodicidade_troca: "Não",
    nr_higienizacao: "Não",
    responsaveis: [],
    data_emissao: new Date().toLocaleDateString("pt-BR"),
    rep_legal_cpf: "",
    rep_legal_nome: "",
    observacoes: "",
  };
}