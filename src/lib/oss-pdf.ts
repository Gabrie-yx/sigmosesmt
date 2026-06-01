import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type OSSPdfData = {
  numero?: string | null;
  revisao: number;
  emitido_em?: string | null;
  expira_em?: string | null;
  funcionario: {
    nome: string;
    cpf?: string | null;
    matricula?: string | null;
    admissao?: string | null;
  };
  cargo: string;
  setor?: string | null;
  empresa?: string | null;
  conteudo: {
    descricao_atividades: string;
    riscos_texto: string;
    medidas_preventivas: string;
    epis_obrigatorios: string;
    proibicoes: string;
    penalidades: string;
    procedimentos_emergencia: string;
  };
};

function brDate(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

export function buildOssPdf(data: OSSPdfData): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const margin = 12;

  // Cabeçalho
  doc.setFillColor(160, 24, 24);
  doc.rect(0, 0, W, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("ORDEM DE SERVIÇO DE SEGURANÇA", W / 2, 8, { align: "center" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("NR-01 item 1.4.1 alínea \"c\" — Obrigação do empregador", W / 2, 14, { align: "center" });

  doc.setTextColor(0, 0, 0);
  let y = 24;

  // Bloco identificação
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: "bold" },
    body: [
      [{ content: "Funcionário", styles: { fontStyle: "bold", fillColor: [245, 245, 245] } }, data.funcionario.nome,
       { content: "Matrícula", styles: { fontStyle: "bold", fillColor: [245, 245, 245] } }, data.funcionario.matricula ?? "—"],
      [{ content: "CPF", styles: { fontStyle: "bold", fillColor: [245, 245, 245] } }, data.funcionario.cpf ?? "—",
       { content: "Admissão", styles: { fontStyle: "bold", fillColor: [245, 245, 245] } }, brDate(data.funcionario.admissao)],
      [{ content: "Cargo", styles: { fontStyle: "bold", fillColor: [245, 245, 245] } }, data.cargo,
       { content: "Setor", styles: { fontStyle: "bold", fillColor: [245, 245, 245] } }, data.setor ?? "—"],
      [{ content: "Empresa", styles: { fontStyle: "bold", fillColor: [245, 245, 245] } }, data.empresa ?? "—",
       { content: "Revisão", styles: { fontStyle: "bold", fillColor: [245, 245, 245] } }, `Rev. ${data.revisao}`],
      [{ content: "Emitido em", styles: { fontStyle: "bold", fillColor: [245, 245, 245] } }, brDate(data.emitido_em),
       { content: "Validade", styles: { fontStyle: "bold", fillColor: [245, 245, 245] } }, brDate(data.expira_em)],
    ],
    columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 70 }, 2: { cellWidth: 22 }, 3: { cellWidth: "auto" } },
  });
  // @ts-expect-error lastAutoTable typing
  y = doc.lastAutoTable.finalY + 4;

  const sections: Array<{ title: string; body: string }> = [
    { title: "1. DESCRIÇÃO DAS ATIVIDADES", body: data.conteudo.descricao_atividades },
    { title: "2. RISCOS OCUPACIONAIS", body: data.conteudo.riscos_texto },
    { title: "3. MEDIDAS PREVENTIVAS", body: data.conteudo.medidas_preventivas },
    { title: "4. EPIs OBRIGATÓRIOS", body: data.conteudo.epis_obrigatorios },
    { title: "5. PROIBIÇÕES", body: data.conteudo.proibicoes },
    { title: "6. PROCEDIMENTOS DE EMERGÊNCIA", body: data.conteudo.procedimentos_emergencia },
    { title: "7. PENALIDADES", body: data.conteudo.penalidades },
  ];

  const drawSection = (title: string, body: string) => {
    const text = body && body.trim() ? body.trim() : "— (não informado)";
    // Estimar altura
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(text, W - margin * 2 - 4);
    const blockH = 6 + lines.length * 3.8 + 3;
    if (y + blockH > H - 50) {
      doc.addPage();
      y = margin;
    }
    // título
    doc.setFillColor(220, 38, 38);
    doc.rect(margin, y, W - margin * 2, 5.5, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(title, margin + 2, y + 4);
    y += 5.5;
    // corpo
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setDrawColor(200);
    doc.rect(margin, y, W - margin * 2, lines.length * 3.8 + 2);
    doc.text(lines, margin + 2, y + 3.5);
    y += lines.length * 3.8 + 4;
  };

  for (const s of sections) drawSection(s.title, s.body);

  // Termo de ciência
  if (y > H - 55) { doc.addPage(); y = margin; }
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  const termo =
    "Declaro ter recebido, lido e compreendido as instruções, riscos, medidas preventivas, EPIs obrigatórios, proibições, procedimentos de emergência e penalidades descritos nesta Ordem de Serviço de Segurança, comprometendo-me a cumpri-los integralmente no exercício de minhas funções, conforme previsto na NR-01 e art. 158 da CLT.";
  const tLines = doc.splitTextToSize(termo, W - margin * 2);
  doc.text(tLines, margin, y + 4);
  y += tLines.length * 3.5 + 8;

  // Assinaturas
  if (y > H - 35) { doc.addPage(); y = margin; }
  const colW = (W - margin * 2 - 10) / 2;
  doc.setDrawColor(0);
  doc.line(margin, y + 15, margin + colW, y + 15);
  doc.line(margin + colW + 10, y + 15, margin + colW * 2 + 10, y + 15);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Assinatura do Trabalhador", margin + colW / 2, y + 19, { align: "center" });
  doc.text("Assinatura do SESMT / Encarregado", margin + colW + 10 + colW / 2, y + 19, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(data.funcionario.nome, margin + colW / 2, y + 23, { align: "center" });
  doc.text("Data: ____/____/______", margin + colW + 10 + colW / 2, y + 23, { align: "center" });

  // Rodapé em todas as páginas
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text(
      `OSS · ${data.cargo} · Rev. ${data.revisao} · Emitido ${brDate(data.emitido_em)} · Página ${i}/${total}`,
      W / 2, H - 6, { align: "center" },
    );
  }

  return doc;
}
