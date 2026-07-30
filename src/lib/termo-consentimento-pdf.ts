import jsPDF from "jspdf";
import dmnLogo from "@/assets/dmn-logo.png";
import { EMPRESA_INFO } from "./empresa-info";

export const TERMO_VERSAO_ATUAL = 2;

export type TermoModalidade = "ELETRONICA" | "PAPEL_DIGITALIZADO";

export type TermoConsentimentoPdfParams = {
  funcionarioNome: string;
  cpf?: string | null;
  rg?: string | null;
  cargo?: string | null;
  empresa?: string | null;
  dataAssinatura: string;       // dd/mm/yyyy
  dataExtenso: string;          // "30 de junho de 2026"
  cidade?: string | null;       // default: Manaus/AM
  assinaturaDataUrl?: string | null;
  logoDataUrl?: string | null;
  coletadoPorNome?: string | null;
  /**
   * Opt-in do BLOCO 2 (uso da foto). true = SIM, false = NÃO,
   * null/undefined = campo em branco para marcação de próprio punho
   * (usado na via impressa antes da coleta).
   */
  consenteImagem?: boolean | null;
  /** ELETRONICA: assina em tela. PAPEL_DIGITALIZADO: imprime, assina à mão e digitaliza. */
  modalidade?: TermoModalidade;
  /** Encarregado pelo Tratamento de Dados (LGPD art. 41). */
  dpoNome?: string | null;
  dpoEmail?: string | null;
  /** Código/hash de verificação impresso no rodapé. */
  codigoVerificacao?: string | null;
  /** Marca d'água "VIA PARA ASSINATURA" (usado na geração da via em branco). */
  viaParaAssinatura?: boolean;
};

const DPO_FALLBACK_NOME = "SESMT — DMN Estaleiro da Amazônia";
const DPO_FALLBACK_EMAIL = EMPRESA_INFO.contato;

/**
 * TERMO DE CONSENTIMENTO E CIÊNCIA — versão 2 (revisão LGPD).
 *
 * Estrutura em 3 blocos, com bases legais segregadas:
 *   BLOCO 1 — Assinatura eletrônica simples (Lei 14.063/2020 art. 4º I; CC arts. 219 e 225)
 *             SEM cláusula de ratificação retroativa (opt-in prospectivo).
 *   BLOCO 2 — Uso de imagem/fotografia no sistema (LGPD art. 7º I — consentimento específico).
 *   BLOCO 3 — Dados de saúde ocupacional (LGPD art. 11 §2º "a" — obrigação legal;
 *             bloco INFORMATIVO, não depende de consentimento).
 *
 * Suporta duas modalidades de coleta:
 *   - ELETRONICA: assinatura capturada em tela no ato da leitura.
 *   - PAPEL_DIGITALIZADO: via impressa, assinada de próprio punho sobre o texto,
 *     digitalizada integralmente e anexada ao SIGMO.
 */
export function gerarTermoConsentimentoPDF(p: TermoConsentimentoPdfParams): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 22;
  const maxW = pageW - margin * 2;
  const lineH = 4.5;
  const FOOT_LIMIT = pageH - 22;
  const modalidade: TermoModalidade = p.modalidade ?? "ELETRONICA";
  const dpoNome = p.dpoNome?.trim() || DPO_FALLBACK_NOME;
  const dpoEmail = p.dpoEmail?.trim() || DPO_FALLBACK_EMAIL;

  let y = 18;

  const drawHeader = () => {
    const headTop = 12;
    const logoW = 30;
    const logoH = 17;
    try {
      doc.addImage(
        (p.logoDataUrl ?? (dmnLogo as unknown as string)),
        "PNG", margin, headTop, logoW, logoH, undefined, "FAST",
      );
    } catch {}
    const infoX = margin + logoW + 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(EMPRESA_INFO.razao_social, infoX, headTop + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(`CNPJ ${EMPRESA_INFO.cnpj}`, infoX, headTop + 9.5);
    doc.text(EMPRESA_INFO.endereco, infoX, headTop + 13);
    doc.text(`${EMPRESA_INFO.cidade_uf_cep}   ·   ${EMPRESA_INFO.contato}`, infoX, headTop + 16.5);
    doc.setTextColor(0, 0, 0);
    doc.setDrawColor(178, 34, 34);
    doc.setLineWidth(0.6);
    doc.line(margin, headTop + logoH + 3, pageW - margin, headTop + logoH + 3);
    doc.setLineWidth(0.2);
    return headTop + logoH + 11;
  };

  const novaPagina = () => {
    doc.addPage();
    y = drawHeader();
  };

  const ensure = (need: number) => {
    if (y + need > FOOT_LIMIT) novaPagina();
  };

  const paragrafo = (txt: string, opts?: { bold?: boolean; size?: number }) => {
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    doc.setFontSize(opts?.size ?? 9.5);
    const lines = doc.splitTextToSize(txt, maxW) as string[];
    ensure(lines.length * lineH);
    doc.text(lines, margin, y, { align: "justify", maxWidth: maxW });
    y += lines.length * lineH;
  };

  const tituloBloco = (txt: string) => {
    ensure(14);
    y += 3.5;
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y - 4.2, maxW, 6.4, "F");
    doc.setDrawColor(178, 34, 34);
    doc.setLineWidth(0.9);
    doc.line(margin, y - 4.2, margin, y + 2.2);
    doc.setLineWidth(0.2);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(txt, margin + 2.5, y);
    doc.setTextColor(0, 0, 0);
    y += 7;
  };

  const checkbox = (marcado: boolean | null | undefined, label: string) => {
    ensure(8);
    const box = 3.8;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.35);
    doc.rect(margin + 1, y - 3.1, box, box);
    doc.setLineWidth(0.2);
    if (marcado === true) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("X", margin + 1.9, y - 0.2);
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text(label, margin + box + 5, y);
    y += 6.4;
  };

  y = drawHeader();

  // ===== Título =====
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("TERMO DE CONSENTIMENTO E DE CIÊNCIA", pageW / 2, y, { align: "center" });
  y += 5.5;
  doc.setFontSize(10.5);
  doc.text("TRATAMENTO DE DADOS PESSOAIS — LGPD (Lei nº 13.709/2018)", pageW / 2, y, { align: "center" });
  y += 4.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  doc.text(
    `Versão ${TERMO_VERSAO_ATUAL} · Lei nº 14.063/2020 · Código Civil arts. 219 e 225 · NR-01`,
    pageW / 2, y, { align: "center" },
  );
  doc.setTextColor(0, 0, 0);
  y += 8;

  // ===== Identificação =====
  tituloBloco("1. IDENTIFICAÇÃO DAS PARTES");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  [
    `CONTROLADOR: ${EMPRESA_INFO.razao_social} — CNPJ ${EMPRESA_INFO.cnpj}`,
    `Encarregado (DPO): ${dpoNome} — ${dpoEmail}`,
    "",
    `TITULAR: ${p.funcionarioNome}`,
    `CPF: ${p.cpf ?? "—"}     RG: ${p.rg ?? "—"}`,
    `Cargo: ${p.cargo ?? "—"}`,
    `Unidade/Empresa: ${p.empresa ?? "—"}`,
  ].forEach((l) => {
    if (!l) { y += 2; return; }
    ensure(lineH);
    doc.text(l, margin, y);
    y += lineH;
  });
  y += 2;

  paragrafo(
    "Este termo é lido pelo titular ANTES da coleta da assinatura. Cada bloco abaixo trata de uma " +
    "finalidade distinta, com base legal própria, e pode ser aceito ou recusado de forma independente, " +
    "sem qualquer prejuízo ao vínculo empregatício ou ao acesso a direitos trabalhistas.",
    { size: 9 },
  );

  // ===== BLOCO 1 =====
  tituloBloco("BLOCO 1 — USO DE ASSINATURA ELETRÔNICA SIMPLES (consentimento)");
  paragrafo(
    "Finalidade: permitir que a reprodução gráfica da minha assinatura, por mim fornecida e armazenada " +
    "no sistema SIGMO, seja aposta em documentos internos de Saúde e Segurança do Trabalho por mim " +
    "previamente conhecidos e aprovados — Ordens de Serviço (NR-01), Fichas de Entrega de EPI, Listas de " +
    "Presença de DDS, treinamentos e integração, APRs, Permissões de Trabalho e demais registros do SGI.",
  );
  paragrafo(
    "Base legal: Lei nº 14.063/2020, art. 4º, inciso I (assinatura eletrônica simples) c/c arts. 219 e 225 " +
    "do Código Civil, e LGPD art. 7º, inciso I (consentimento).",
  );
  paragrafo(
    "Este consentimento produz efeitos APENAS A PARTIR DE SUA ASSINATURA, não alcançando documentos " +
    "emitidos anteriormente. Estou ciente de que: (i) a assinatura é armazenada em ambiente controlado, " +
    "com acesso restrito a usuários autorizados; (ii) toda aposição gera registro em trilha de auditoria " +
    "com usuário responsável, data, hora e documento de destino; (iii) posso solicitar a qualquer momento " +
    "o extrato dos documentos em que minha assinatura foi utilizada.",
  );
  checkbox(p.viaParaAssinatura ? null : true, "AUTORIZO o uso da minha assinatura eletrônica simples, nos limites acima.");

  // ===== BLOCO 2 =====
  tituloBloco("BLOCO 2 — USO DE FOTOGRAFIA (IMAGEM) NO SISTEMA (consentimento específico)");
  paragrafo(
    "Finalidade: uso da minha fotografia EXCLUSIVAMENTE para identificação interna no sistema SIGMO — " +
    "ficha cadastral, crachá, listas internas de identificação, conferência de entrega de EPI, " +
    "controle de presença em treinamentos e rastreabilidade de registros de SST.",
  );
  paragrafo(
    "FICA EXPRESSAMENTE VEDADO o uso da minha imagem para finalidade publicitária, comercial, " +
    "institucional externa, redes sociais, site, campanhas de marketing ou qualquer divulgação a terceiros " +
    "estranhos à relação de trabalho, salvo mediante novo consentimento específico e por escrito.",
  );
  paragrafo(
    "Base legal: LGPD art. 7º, inciso I (consentimento específico e destacado). A recusa NÃO impede minha " +
    "admissão, permanência ou acesso a qualquer benefício, e o sistema deixará de exibir minha fotografia.",
  );
  ensure(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Assinale sua escolha:", margin, y);
  y += 6;
  checkbox(p.consenteImagem === true ? true : null,
    "SIM — autorizo o uso da minha fotografia para identificação interna no sistema.");
  checkbox(p.consenteImagem === false ? true : null,
    "NÃO — não autorizo o uso da minha fotografia.");

  // ===== BLOCO 3 =====
  tituloBloco("BLOCO 3 — DADOS DE SAÚDE OCUPACIONAL (ciência — não depende de consentimento)");
  paragrafo(
    "DECLARO ESTAR CIENTE de que a empresa trata dados pessoais sensíveis relativos à minha saúde " +
    "ocupacional — ASO, exames complementares, atestados, restrições, imunizações e registros de acidentes " +
    "— para CUMPRIMENTO DE OBRIGAÇÃO LEGAL E REGULATÓRIA, nos termos do art. 11, §2º, alínea \"a\", da LGPD, " +
    "c/c NR-01, NR-07 e legislação previdenciária.",
  );
  paragrafo(
    "Por decorrer de obrigação legal, esse tratamento NÃO depende do meu consentimento e não pode ser " +
    "revogado enquanto perdurar o dever legal de guarda. O acesso ao conteúdo clínico é restrito ao médico " +
    "coordenador do PCMSO e a profissionais de saúde vinculados, observado o sigilo profissional; ao " +
    "empregador é disponibilizada apenas a informação de aptidão e as restrições aplicáveis à função.",
  );

  // ===== Direitos, guarda e revogação =====
  tituloBloco("2. DIREITOS DO TITULAR, GUARDA E REVOGAÇÃO");
  paragrafo(
    "Estou ciente de que posso, a qualquer tempo e gratuitamente, exercer os direitos do art. 18 da LGPD: " +
    "confirmação da existência de tratamento, acesso, correção, anonimização, portabilidade, informação " +
    "sobre compartilhamento, revogação do consentimento e OPOSIÇÃO a tratamento realizado com fundamento " +
    "diverso do consentimento.",
  );
  paragrafo(
    `Canal de exercício de direitos e revogação: ${dpoNome} — ${dpoEmail}, ou requerimento escrito ao SESMT, ` +
    "com protocolo de recebimento. A revogação cessa o uso futuro, sem invalidar os documentos legitimamente " +
    "emitidos enquanto o consentimento vigorava.",
  );
  paragrafo(
    "Compartilhamento e armazenamento: os dados são armazenados em servidor próprio da DMN, em infraestrutura " +
    "sob controle da empresa, e somente são compartilhados com clínicas de medicina ocupacional, órgãos " +
    "fiscalizadores, eSocial e autoridades públicas quando exigido por lei ou contrato. Prazo de guarda: " +
    "o previsto na legislação trabalhista, previdenciária e de SST, inclusive os 20 anos aplicáveis a " +
    "registros ocupacionais.",
  );

  // ===== Declaração final =====
  tituloBloco("3. DECLARAÇÃO FINAL");
  paragrafo(
    modalidade === "PAPEL_DIGITALIZADO"
      ? "Declaro que LI E COMPREENDI integralmente este termo, em via impressa que me foi entregue antes da " +
        "assinatura, que minhas escolhas nos quadros acima foram por mim assinaladas, e que assino de " +
        "próprio punho, de livre e espontânea vontade, recebendo uma via."
      : "Declaro que LI E COMPREENDI integralmente este termo, exibido em tela antes da coleta da " +
        "assinatura, que minhas escolhas nos quadros acima foram por mim indicadas, e que assino " +
        "eletronicamente, de livre e espontânea vontade, recebendo uma via.",
  );

  // ===== Assinatura =====
  y += 4;
  ensure(46);
  const cidade = p.cidade ?? "Manaus/AM";
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(`${cidade}, ${p.dataExtenso}.`, margin, y);
  y += 20;

  const boxW = 92;
  const boxX = pageW / 2 - boxW / 2;
  if (modalidade === "ELETRONICA" && p.assinaturaDataUrl) {
    try {
      doc.addImage(p.assinaturaDataUrl, "PNG", boxX + 11, y - 15, boxW - 22, 15, undefined, "FAST");
    } catch {}
  }
  doc.setDrawColor(0, 0, 0);
  doc.line(boxX, y, boxX + boxW, y);
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(p.funcionarioNome.toUpperCase(), pageW / 2, y, { align: "center" });
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`CPF: ${p.cpf ?? "—"}`, pageW / 2, y, { align: "center" });
  y += 4;
  doc.setFontSize(7.5);
  doc.setTextColor(110, 110, 110);
  doc.text(
    modalidade === "PAPEL_DIGITALIZADO"
      ? "Assinatura de próprio punho sobre a via impressa — documento digitalizado integralmente e arquivado no SIGMO."
      : "Assinatura eletrônica simples coletada em tela no ato da leitura (Lei 14.063/2020, art. 4º, I).",
    pageW / 2, y, { align: "center" },
  );
  doc.setTextColor(0, 0, 0);

  // Testemunha na via de papel
  if (modalidade === "PAPEL_DIGITALIZADO") {
    y += 16;
    ensure(20);
    doc.setDrawColor(0, 0, 0);
    doc.line(margin, y, margin + 78, y);
    doc.line(pageW - margin - 78, y, pageW - margin, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text("Responsável pela coleta (SESMT/RH)", margin, y);
    doc.text("Testemunha (nome e CPF)", pageW - margin - 78, y);
  }

  // ===== Marca d'água da via em branco =====
  if (p.viaParaAssinatura) {
    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(40);
      doc.setTextColor(203, 213, 225);
      const gs = (doc as any).GState;
      if (gs) (doc as any).setGState(new gs({ opacity: 0.16 }));
      doc.text("VIA PARA ASSINATURA", pageW / 2, pageH / 2, { align: "center", angle: 32 });
      if (gs) (doc as any).setGState(new gs({ opacity: 1 }));
      doc.setTextColor(0, 0, 0);
    }
  }

  // ===== Rodapé em todas as páginas =====
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2);
    doc.setTextColor(110, 110, 110);
    doc.setDrawColor(203, 213, 225);
    doc.line(margin, pageH - 14, pageW - margin, pageH - 14);
    const modalTxt = modalidade === "PAPEL_DIGITALIZADO" ? "assinatura manuscrita digitalizada" : "assinatura eletrônica em tela";
    const linha1 =
      `SIGMO · Termo v${TERMO_VERSAO_ATUAL} (${modalTxt}) registrado em ${p.dataAssinatura}` +
      (p.coletadoPorNome ? ` · coletado por ${p.coletadoPorNome}` : "");
    doc.text(linha1, margin, pageH - 10);
    doc.text(`Pág. ${i}/${totalPages}`, pageW - margin, pageH - 10, { align: "right" });
    if (p.codigoVerificacao) {
      doc.text(`Verificação: ${p.codigoVerificacao}`, margin, pageH - 6.6);
    }
    doc.setTextColor(0, 0, 0);
  }

  return doc;
}
