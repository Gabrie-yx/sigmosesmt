import jsPDF from "jspdf";

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

  if (p.logoDataUrl) {
    try { doc.addImage(p.logoDataUrl, "PNG", pageW / 2 - 18, y, 36, 16, undefined, "FAST"); } catch {}
  }
  y += 26;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("TERMO DE CONSENTIMENTO PARA USO DE", pageW / 2, y, { align: "center" });
  y += 6;
  doc.text("ASSINATURA ELETRÔNICA SIMPLES", pageW / 2, y, { align: "center" });
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
    "Declaro, por fim, que li e compreendi integralmente o presente termo e o assino de livre e " +
      "espontânea vontade.",
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
  const footer = `SIGMO · Termo registrado em ${p.dataAssinatura}${p.coletadoPorNome ? ` · Coletado por: ${p.coletadoPorNome}` : ""}`;
  doc.text(footer, pageW / 2, pageH - 10, { align: "center" });
  doc.setTextColor(0, 0, 0);

  return doc;
}