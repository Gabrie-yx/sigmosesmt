import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { drawPdfHeader } from "./pdf-header";

export type PcmsoAnaliticoOpts = {
  ano: number;
  coordenador?: { nome: string; crm: string; crm_uf: string } | null;
  totalAtivos: number;
  cobertura: { vigente: number; vencido: number; sem: number };
  examesPorNatureza: { natureza: string; total: number }[];
  aptidao: { aptos: number; aptos_restr: number; inaptos: number; nao_informado: number };
  atestados: { total: number; dias: number; top_cid: { cid: string; n: number }[] };
  agravos: { encaminhados: number; anamneses: number };
  observacoes?: string;
};

export function gerarPcmsoAnaliticoPdf(opts: PcmsoAnaliticoOpts): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 12;

  const pctVigente = opts.totalAtivos
    ? Math.round((opts.cobertura.vigente / opts.totalAtivos) * 100)
    : 0;
  const totalExames = opts.examesPorNatureza.reduce((s, r) => s + r.total, 0);

  let y = drawPdfHeader(doc, {
    titulo: `Relatório Analítico Anual do PCMSO — ${opts.ano}`,
    subtitulo: "NR-07 item 7.6.1 · Portaria MTP nº 6.734/2020 · ISO 45001",
    filtros: [
      `Coordenador PCMSO: ${opts.coordenador ? `${opts.coordenador.nome} — CRM ${opts.coordenador.crm}/${opts.coordenador.crm_uf}` : "NÃO CADASTRADO (não conformidade)"}`,
      `Trabalhadores ativos: ${opts.totalAtivos}`,
    ],
    kpis: [
      { label: "Exames realizados", value: totalExames, tone: "neutral" },
      { label: "Cobertura ASO", value: `${pctVigente}%`, tone: pctVigente >= 95 ? "success" : pctVigente >= 80 ? "warning" : "danger" },
      { label: "Aptos", value: opts.aptidao.aptos, tone: "success" },
      { label: "Inaptos", value: opts.aptidao.inaptos, tone: opts.aptidao.inaptos ? "danger" : "success" },
    ],
  });
  y += 2;

  // 1. Introdução
  y = section(doc, "1. INTRODUÇÃO", y);
  y = para(
    doc,
    `Este documento apresenta o Relatório Analítico Anual do PCMSO referente ao ano-base ${opts.ano}, ` +
      "em atendimento ao item 7.6.1 da NR-07 (Portaria MTP nº 6.734/2020). Consolida as ações de vigilância " +
      "médica ocupacional, exames realizados, aptidões, absenteísmo por atestados e encaminhamentos, com " +
      "propostas para o próximo ciclo do programa.",
    y,
  );

  // 2. Universo
  y = section(doc, "2. UNIVERSO E COBERTURA DO PCMSO", y);
  autoTable(doc, {
    startY: y, margin: { left: M, right: M }, theme: "grid",
    styles: { fontSize: 9, cellPadding: 2, lineColor: [203, 213, 225], lineWidth: 0.2 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold", fontSize: 9 },
    head: [["Indicador", "Valor"]],
    body: [
      ["Trabalhadores ATIVOS no fim do período", String(opts.totalAtivos)],
      ["ASO VIGENTE (dentro do prazo)", `${opts.cobertura.vigente}  (${pctVigente}%)`],
      ["ASO VENCIDO", String(opts.cobertura.vencido)],
      ["Sem ASO registrado", String(opts.cobertura.sem)],
    ],
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // 3. Exames por natureza
  y = section(doc, "3. EXAMES REALIZADOS POR NATUREZA", y);
  if (opts.examesPorNatureza.length === 0) {
    y = para(doc, "Nenhum exame registrado no período.", y);
  } else {
    autoTable(doc, {
      startY: y, margin: { left: M, right: M }, theme: "grid",
      styles: { fontSize: 9, cellPadding: 2, lineColor: [203, 213, 225], lineWidth: 0.2 },
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold", fontSize: 9 },
      head: [["Natureza (NR-07 7.4.1)", "Realizados", "% do total"]],
      body: opts.examesPorNatureza.map((r) => [
        r.natureza,
        String(r.total),
        totalExames ? `${Math.round((r.total / totalExames) * 100)}%` : "0%",
      ]),
      columnStyles: { 1: { halign: "center" }, 2: { halign: "center" } },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // 4. Aptidão
  y = section(doc, "4. RESULTADOS DE APTIDÃO", y);
  autoTable(doc, {
    startY: y, margin: { left: M, right: M }, theme: "grid",
    styles: { fontSize: 9, cellPadding: 2, lineColor: [203, 213, 225], lineWidth: 0.2 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold", fontSize: 9 },
    head: [["Conclusão do ASO", "Nº de exames"]],
    body: [
      ["Apto sem restrições", String(opts.aptidao.aptos)],
      ["Apto com restrições", String(opts.aptidao.aptos_restr)],
      ["Inapto", String(opts.aptidao.inaptos)],
      ["Não informado", String(opts.aptidao.nao_informado)],
    ],
    columnStyles: { 1: { halign: "center" } },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // 5. Absenteísmo
  y = section(doc, "5. ABSENTEÍSMO POR ATESTADOS MÉDICOS", y);
  autoTable(doc, {
    startY: y, margin: { left: M, right: M }, theme: "grid",
    styles: { fontSize: 9, cellPadding: 2, lineColor: [203, 213, 225], lineWidth: 0.2 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold", fontSize: 9 },
    head: [["Indicador", "Valor"]],
    body: [
      ["Atestados registrados no ano", String(opts.atestados.total)],
      ["Total de dias de afastamento", String(opts.atestados.dias)],
      ["Média de dias por atestado", opts.atestados.total ? (opts.atestados.dias / opts.atestados.total).toFixed(1) : "0"],
    ],
  });
  y = (doc as any).lastAutoTable.finalY + 4;
  if (opts.atestados.top_cid.length) {
    autoTable(doc, {
      startY: y, margin: { left: M, right: M }, theme: "grid",
      styles: { fontSize: 9, cellPadding: 2, lineColor: [203, 213, 225], lineWidth: 0.2 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold", fontSize: 9 },
      head: [["Top CID-10", "Ocorrências"]],
      body: opts.atestados.top_cid.map((r) => [r.cid || "—", String(r.n)]),
      columnStyles: { 1: { halign: "center" } },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // 6. Agravos e encaminhamentos
  y = section(doc, "6. AGRAVOS À SAÚDE E ENCAMINHAMENTOS", y);
  autoTable(doc, {
    startY: y, margin: { left: M, right: M }, theme: "grid",
    styles: { fontSize: 9, cellPadding: 2, lineColor: [203, 213, 225], lineWidth: 0.2 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold", fontSize: 9 },
    head: [["Indicador", "Valor"]],
    body: [
      ["Anamneses ocupacionais lavradas", String(opts.agravos.anamneses)],
      ["Encaminhamentos / convocações emitidas", String(opts.agravos.encaminhados)],
    ],
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // 7. Conclusão e propostas
  if (y > H - 60) { doc.addPage(); y = M; }
  y = section(doc, "7. CONCLUSÃO E PROPOSTAS PARA O PRÓXIMO CICLO", y);
  const concl: string[] = [];
  if (pctVigente < 95) concl.push(`Cobertura de ASO vigente em ${pctVigente}% — abaixo da meta institucional (95%). Reforçar convocações e monitoramento de vencimentos.`);
  else concl.push(`Cobertura de ASO vigente em ${pctVigente}% — dentro da meta institucional (≥ 95%).`);
  if (opts.aptidao.inaptos > 0) concl.push(`${opts.aptidao.inaptos} colaborador(es) considerado(s) inapto(s) — revisar realocação, reabilitação e nexo com riscos do PGR.`);
  if (opts.aptidao.aptos_restr > 0) concl.push(`${opts.aptidao.aptos_restr} caso(s) com restrições — verificar cumprimento das restrições pelas lideranças (NR-07 7.5.2).`);
  if (!opts.coordenador) concl.push("NÃO CONFORMIDADE: sem coordenador PCMSO ativo cadastrado. Regularizar imediatamente (NR-07 7.3.2).");
  if (opts.atestados.dias > opts.totalAtivos * 3) concl.push("Absenteísmo elevado (> 3 dias/trabalhador/ano) — investigar causas ocupacionais e cruzar com PGR/Psicossocial.");
  concl.push("Integrar resultados ao próximo ciclo do PCMSO e ao Plano de Ação do PGR (NR-01 1.5.5).");
  if (opts.observacoes) concl.push(`Observações do coordenador: ${opts.observacoes}`);
  for (const c of concl) y = bullet(doc, c, y);

  // Assinatura
  y = Math.max(y + 10, H - 40);
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.3);
  doc.line(M + 40, y, W - M - 40, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(opts.coordenador?.nome ?? "Coordenador do PCMSO", W / 2, y + 5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(
    opts.coordenador ? `Médico do Trabalho — CRM ${opts.coordenador.crm}/${opts.coordenador.crm_uf}` : "Coordenador PCMSO (não cadastrado)",
    W / 2,
    y + 9,
    { align: "center" },
  );

  // Rodapé
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`SIGMO · Relatório Analítico PCMSO ${opts.ano} · NR-07 item 7.6.1`, M, H - 6);
    doc.text(`Página ${p} de ${pageCount}`, W - M, H - 6, { align: "right" });
  }

  return doc;
}

function section(doc: jsPDF, texto: string, y: number): number {
  const M = 12;
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  if (y > H - 20) { doc.addPage(); y = M; }
  doc.setFillColor(15, 23, 42);
  doc.rect(M, y, W - M * 2, 6.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text(texto, M + 2, y + 4.6);
  doc.setTextColor(0, 0, 0);
  return y + 10;
}

function para(doc: jsPDF, texto: string, y: number): number {
  const M = 12;
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  const lines = doc.splitTextToSize(texto, W - M * 2);
  for (const l of lines) {
    if (y > H - 15) { doc.addPage(); y = M; }
    doc.text(l, M, y);
    y += 4.5;
  }
  return y + 2;
}

function bullet(doc: jsPDF, texto: string, y: number): number {
  const M = 12;
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  const lines = doc.splitTextToSize(texto, W - M * 2 - 5);
  for (let i = 0; i < lines.length; i++) {
    if (y > H - 15) { doc.addPage(); y = M; }
    doc.text(i === 0 ? "•" : " ", M, y);
    doc.text(lines[i], M + 4, y);
    y += 4.5;
  }
  return y + 1;
}