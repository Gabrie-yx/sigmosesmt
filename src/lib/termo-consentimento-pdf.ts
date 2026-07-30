import jsPDF from "jspdf";
import dmnLogo from "@/assets/dmn-logo.png";
import { EMPRESA_INFO } from "./empresa-info";

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
  /** Consentimento específico para uso da FOTO (imagem) dentro do sistema. Default: true */
  consenteImagem?: boolean;
};

/**
 * Termo de Consentimento de Uso de Assinatura Eletrônica Simples
 * Base legal:
 *   - Lei 14.063/2020 (assinatura eletrônica simples — art. 4º, I)
 *   - LGPD (Lei 13.709/2018), art. 7º, V e art. 9º
 *   - Código Civil (CC/2002), arts. 219 e 225
 *
 * Inclui cláusula EXPLÍCITA de ratificação retroativa: protege todas as
 * assinaturas já coletadas e estampadas em documentos internos antes da
 * data deste termo.
 */
export function gerarTermoConsentimentoPDF(p: TermoConsentimentoPdfParams): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 22;
  let y = 18;

  // ===== Cabeçalho institucional =====
  const headTop = 12;
  const logoW = 30;
  const logoH = 17;
  try {
    doc.addImage(
      (p.logoDataUrl ?? (dmnLogo as unknown as string)),
      "PNG",
      margin,
      headTop,
      logoW,
      logoH,
      undefined,
      "FAST",
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

  y = headTop + logoH + 12;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("TERMO DE CONSENTIMENTO PARA USO DE ASSINATURA", pageW / 2, y, { align: "center" });
  y += 6;
  doc.text("ELETRÔNICA SIMPLES E DE IMAGEM (FOTO) NO SISTEMA", pageW / 2, y, { align: "center" });
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(90, 90, 90);
  doc.text("Lei nº 14.063/2020 · LGPD nº 13.709/2018 · Código Civil arts. 219 e 225", pageW / 2, y, { align: "center" });
  doc.setTextColor(0, 0, 0);
  y += 10;

  // Identificação
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("IDENTIFICAÇÃO DO COLABORADOR", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const ident: string[] = [
    `Nome: ${p.funcionarioNome}`,
    `CPF: ${p.cpf ?? "—"}    RG: ${p.rg ?? "—"}`,
    `Cargo: ${p.cargo ?? "—"}`,
    `Empresa: ${p.empresa ?? "—"}`,
  ];
  ident.forEach((l) => { doc.text(l, margin, y); y += 5; });
  y += 3;

  // Corpo
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("DECLARAÇÃO E CONSENTIMENTO", margin, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const body = [
    "Pelo presente instrumento, eu, identificado acima, DECLARO ter ciência de que a empresa DMN " +
      "e suas contratadas utilizam o sistema SIGMO (Sistema Integrado de Gestão Modular) " +
      "para emissão de documentos internos de Saúde e Segurança do Trabalho (SST), " +
      "incluindo, sem se limitar a: Ordens de Serviço (OS/NR-01), Atestados de Saúde Ocupacional (ASO), " +
      "Fichas de Entrega de EPI, Termos de Responsabilidade, Listas de Presença de treinamentos, DDS, " +
      "Integração, APRs, PT/PTEs e demais registros do SGI.",
    "",
    "AUTORIZO, de forma livre, informada e inequívoca, o uso da minha ASSINATURA DIGITALIZADA " +
      "(reprodução gráfica da minha assinatura manuscrita) cadastrada no SIGMO para ser aposta " +
      "automaticamente nos documentos eletrônicos acima descritos, com o mesmo valor jurídico de minha " +
      "assinatura manuscrita em papel, nos termos do art. 4º, inciso I, da Lei 14.063/2020 " +
      "(assinatura eletrônica simples) e dos arts. 219 e 225 do Código Civil.",
    "",
    "RATIFICO EXPRESSAMENTE, para todos os fins de direito, o uso já realizado da minha assinatura " +
      "digitalizada em quaisquer documentos eletrônicos emitidos pelo SIGMO ANTERIORMENTE à data deste " +
      "termo, reconhecendo-os como válidos, autênticos e oponíveis a mim, como se tivessem sido por mim " +
      "assinados de próprio punho na data de cada emissão.",
    "",
    "ESTOU CIENTE de que: (i) a empresa armazena minha assinatura em ambiente controlado, com acesso " +
      "restrito a usuários autorizados; (ii) cada estampagem é registrada em trilha de auditoria " +
      "(usuário responsável, data/hora e documento de destino); (iii) o tratamento desse dado pessoal " +
      "é realizado com base no art. 7º, V, da LGPD (execução de contrato de trabalho) e art. 7º, II " +
      "(cumprimento de obrigação legal/regulatória de SST); (iv) posso a qualquer tempo requerer a " +
      "REVOGAÇÃO deste consentimento por escrito ao SESMT, hipótese em que o uso futuro será cessado, " +
      "sem prejuízo da validade dos documentos já emitidos.",
    "",
  ];

  const lineH = 4.6;
  const maxW = pageW - margin * 2;
  body.forEach((para) => {
    if (para === "") { y += 2; return; }
    const lines = doc.splitTextToSize(para, maxW);
    if (y + lines.length * lineH > pageH - 80) {
      doc.addPage();
      y = margin;
    }
    doc.text(lines, margin, y, { align: "justify", maxWidth: maxW });
    y += lines.length * lineH;
  });

  // ---- Bloco específico e destacado: USO DE IMAGEM (FOTO) ----
  const consenteImagem = p.consenteImagem !== false;
  const imgBody = [
    "AUTORIZO, de forma livre, informada, específica e destacada, o uso da minha FOTOGRAFIA " +
      "(imagem de rosto) EXCLUSIVAMENTE PARA FINS DE IDENTIFICAÇÃO INTERNA DENTRO DO SISTEMA SIGMO, " +
      "a saber: cadastro/ficha do colaborador, crachá e listas internas de identificação, controle de " +
      "presença e rastreabilidade de entregas de EPI, treinamentos e demais registros internos de SST.",
    "",
    "FICA EXPRESSAMENTE VEDADO o uso da minha imagem para finalidade publicitária, comercial, " +
      "institucional externa, redes sociais, site, campanhas de marketing ou qualquer divulgação a " +
      "terceiros estranhos à relação de trabalho, salvo mediante novo consentimento específico e por escrito.",
    "",
    "ESTOU CIENTE de que a foto é armazenada em ambiente controlado, com acesso restrito a usuários " +
      "autorizados, tratada com base no art. 7º, I e V, da LGPD, e de que posso REVOGAR este " +
      "consentimento a qualquer tempo por escrito ao SESMT, hipótese em que a imagem será removida do " +
      "sistema, ressalvada a guarda legal obrigatória de registros de SST.",
  ];

  if (y + 46 > pageH - 80) { doc.addPage(); y = margin; }
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("CONSENTIMENTO ESPECÍFICO — USO DE IMAGEM (FOTO) NO SISTEMA", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  imgBody.forEach((para) => {
    if (para === "") { y += 2; return; }
    const lines = doc.splitTextToSize(para, maxW);
    if (y + lines.length * lineH > pageH - 80) { doc.addPage(); y = margin; }
    doc.text(lines, margin, y, { align: "justify", maxWidth: maxW });
    y += lines.length * lineH;
  });

  // Opt-in explícito (SIM/NÃO)
  y += 3;
  if (y + 10 > pageH - 80) { doc.addPage(); y = margin; }
  doc.setDrawColor(0, 0, 0);
  const box = 3.6;
  doc.rect(margin, y - 3, box, box);
  if (consenteImagem) doc.text("X", margin + 0.8, y - 0.2);
  doc.text("SIM, autorizo o uso da minha foto no sistema, nos limites acima.", margin + box + 3, y);
  y += 6;
  doc.rect(margin, y - 3, box, box);
  if (!consenteImagem) doc.text("X", margin + 0.8, y - 0.2);
  doc.text("NÃO autorizo o uso da minha foto no sistema.", margin + box + 3, y);
  y += 8;

  const fecho = doc.splitTextToSize(
    "Declaro, por fim, que li e compreendi integralmente o presente termo, inclusive o bloco específico " +
      "de uso de imagem, e o assino de livre e espontânea vontade.",
    maxW,
  );
  if (y + fecho.length * lineH > pageH - 80) { doc.addPage(); y = margin; }
  doc.text(fecho, margin, y, { align: "justify", maxWidth: maxW });
  y += fecho.length * lineH;

  // Local e data
  y += 6;
  if (y > pageH - 70) { doc.addPage(); y = margin; }
  const cidade = p.cidade ?? "Manaus/AM";
  doc.setFont("helvetica", "normal");
  doc.text(`${cidade}, ${p.dataExtenso}.`, margin, y);
  y += 18;

  // Bloco assinatura
  const boxW = 90;
  const boxX = pageW / 2 - boxW / 2;
  if (p.assinaturaDataUrl) {
    try {
      doc.addImage(p.assinaturaDataUrl, "PNG", boxX + 10, y - 14, boxW - 20, 14, undefined, "FAST");
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

  // Rodapé
  doc.setFontSize(7.5);
  doc.setTextColor(110, 110, 110);
  const footer = `SIGMO · Termo registrado e coletado automaticamente em ${p.dataAssinatura}${p.coletadoPorNome ? ` por ${p.coletadoPorNome}` : ""}`;
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, pageH - 14, pageW - margin, pageH - 14);
  doc.text(footer, pageW / 2, pageH - 10, { align: "center" });
  doc.setTextColor(0, 0, 0);

  return doc;
}