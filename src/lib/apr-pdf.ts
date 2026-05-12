import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type APRPdfRisco = {
  ordem: number;
  risco_nome: string;
  risco_categoria?: string | null;
  efeitos_danos?: string | null;
  probabilidade: number;
  severidade: number;
  nivel_risco: number;
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
  hora_inicio?: string | null;
  hora_fim?: string | null;
  data_validade?: string | null;
  empresa_nome?: string | null;
  empresa_cnpj?: string | null;
  casco_numero?: string | null;
  casco_nome?: string | null;
  local?: string | null;
  setor?: string | null;
  atividade: string;
  encarregado?: string | null;
  tst?: string | null;
  pte_numero?: string | null;
  condicoes_climaticas?: string | null;
  observacoes?: string | null;
  riscos: APRPdfRisco[];
  assinaturas: APRPdfAssinatura[];
};

function nivelLabel(n: number) {
  if (n <= 4) return { label: "BAIXO", color: [16, 185, 129] as [number, number, number] };
  if (n <= 9) return { label: "MÉDIO", color: [234, 179, 8] as [number, number, number] };
  if (n <= 14) return { label: "ALTO", color: [249, 115, 22] as [number, number, number] };
  return { label: "CRÍTICO", color: [220, 38, 38] as [number, number, number] };
}

export function gerarAPR(p: APRPdfParams): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 8;
  const contentW = pageW - margin * 2;

  // ================= CABEÇALHO =================
  doc.setLineWidth(0.4);
  const headerH = 16;
  doc.rect(margin, margin, contentW, headerH);
  // 3 colunas
  const c1 = 60, c3 = 50;
  doc.line(margin + c1, margin, margin + c1, margin + headerH);
  doc.line(margin + contentW - c3, margin, margin + contentW - c3, margin + headerH);

  // Empresa
  doc.setFont("helvetica", "bold").setFontSize(9);
  doc.text(p.matrizNome, margin + c1 / 2, margin + 6, { align: "center" });
  if (p.matrizCnpj) {
    doc.setFontSize(7).setFont("helvetica", "normal");
    doc.text(`CNPJ: ${p.matrizCnpj}`, margin + c1 / 2, margin + 10, { align: "center" });
  }

  // Título
  doc.setFont("helvetica", "bold").setFontSize(13);
  doc.text("APR", margin + c1 + (contentW - c1 - c3) / 2, margin + 7, { align: "center" });
  doc.setFontSize(8).setFont("helvetica", "normal");
  doc.text("ANÁLISE PRELIMINAR DE RISCO", margin + c1 + (contentW - c1 - c3) / 2, margin + 12, { align: "center" });

  // Numero / data
  doc.setFont("helvetica", "bold").setFontSize(9);
  doc.text(p.numero, margin + contentW - c3 / 2, margin + 6, { align: "center" });
  doc.setFontSize(7).setFont("helvetica", "normal");
  doc.text(`Data: ${p.data_emissao}`, margin + contentW - c3 / 2, margin + 10, { align: "center" });
  if (p.data_validade) {
    doc.text(`Validade: ${p.data_validade}`, margin + contentW - c3 / 2, margin + 13.5, { align: "center" });
  }

  // ================= IDENTIFICAÇÃO =================
  let y = margin + headerH + 2;
  const linhaH = 6;

  function row(label1: string, val1: string, label2?: string, val2?: string) {
    doc.setLineWidth(0.2);
    doc.rect(margin, y, contentW, linhaH);
    if (label2 !== undefined) {
      doc.line(margin + contentW / 2, y, margin + contentW / 2, y + linhaH);
    }
    doc.setFont("helvetica", "bold").setFontSize(7);
    doc.text(label1, margin + 1.5, y + 4);
    doc.setFont("helvetica", "normal").setFontSize(8);
    doc.text(val1 || "—", margin + 22, y + 4);
    if (label2 !== undefined) {
      doc.setFont("helvetica", "bold").setFontSize(7);
      doc.text(label2, margin + contentW / 2 + 1.5, y + 4);
      doc.setFont("helvetica", "normal").setFontSize(8);
      doc.text(val2 || "—", margin + contentW / 2 + 22, y + 4);
    }
    y += linhaH;
  }

  row("EMPRESA:", p.empresa_nome ?? "—", "CNPJ:", p.empresa_cnpj ?? "—");
  const cascoTxt = p.casco_numero ? `${p.casco_numero}${p.casco_nome ? " - " + p.casco_nome : ""}` : "—";
  row("CASCO:", cascoTxt, "PTE Nº:", p.pte_numero ?? "—");
  row("LOCAL:", p.local ?? "—", "SETOR:", p.setor ?? "—");
  row(
    "HORÁRIO:",
    `${p.hora_inicio ?? "--:--"} às ${p.hora_fim ?? "--:--"}`,
    "CLIMA:",
    p.condicoes_climaticas ?? "—",
  );

  // Atividade — bloco maior
  doc.rect(margin, y, contentW, 12);
  doc.setFont("helvetica", "bold").setFontSize(7);
  doc.text("DESCRIÇÃO DA ATIVIDADE:", margin + 1.5, y + 3.5);
  doc.setFont("helvetica", "normal").setFontSize(8);
  const atvLines = doc.splitTextToSize(p.atividade ?? "—", contentW - 3);
  doc.text(atvLines.slice(0, 2), margin + 1.5, y + 7);
  y += 12 + 2;

  // ================= MATRIZ DE RISCO (legenda) =================
  doc.setFont("helvetica", "bold").setFontSize(8);
  doc.text("MATRIZ DE RISCO (Probabilidade × Severidade)", margin, y);
  y += 1;
  const legendH = 6;
  const legW = contentW / 4;
  const legends = [
    { label: "BAIXO (1-4)", color: [16, 185, 129] },
    { label: "MÉDIO (5-9)", color: [234, 179, 8] },
    { label: "ALTO (10-14)", color: [249, 115, 22] },
    { label: "CRÍTICO (15-25)", color: [220, 38, 38] },
  ];
  legends.forEach((lg, i) => {
    const x = margin + i * legW;
    doc.setFillColor(lg.color[0], lg.color[1], lg.color[2]);
    doc.rect(x, y + 1, legW, legendH, "F");
    doc.setTextColor(255, 255, 255).setFont("helvetica", "bold").setFontSize(7);
    doc.text(lg.label, x + legW / 2, y + 5, { align: "center" });
  });
  doc.setTextColor(0, 0, 0);
  y += legendH + 3;

  // ================= TABELA DE RISCOS =================
  const head = [["#", "RISCO", "EFEITOS / DANOS", "P", "S", "NR", "AÇÕES PREVENTIVAS", "EPIs", "NRs", "RESP."]];
  const body = p.riscos.map((r) => {
    const nv = nivelLabel(r.nivel_risco);
    return [
      String(r.ordem),
      r.risco_nome + (r.risco_categoria ? `\n[${r.risco_categoria}]` : ""),
      r.efeitos_danos ?? "",
      String(r.probabilidade),
      String(r.severidade),
      `${r.nivel_risco}\n${nv.label}`,
      r.acoes_preventivas ?? "",
      (r.epis ?? []).join(", "),
      (r.nrs ?? []).join(", "),
      r.responsavel_acoes ?? "",
    ];
  });

  autoTable(doc, {
    head,
    body,
    startY: y,
    margin: { left: margin, right: margin },
    theme: "grid",
    styles: { fontSize: 6.5, cellPadding: 1.2, valign: "middle", lineColor: [120, 120, 120] },
    headStyles: { fillColor: [153, 27, 27], textColor: 255, fontStyle: "bold", fontSize: 7, halign: "center" },
    columnStyles: {
      0: { cellWidth: 7, halign: "center" },
      1: { cellWidth: 26 },
      2: { cellWidth: 28 },
      3: { cellWidth: 7, halign: "center" },
      4: { cellWidth: 7, halign: "center" },
      5: { cellWidth: 14, halign: "center", fontStyle: "bold" },
      6: { cellWidth: 36 },
      7: { cellWidth: 24 },
      8: { cellWidth: 16, halign: "center" },
      9: { cellWidth: "auto" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 5) {
        const r = p.riscos[data.row.index];
        if (r) {
          const nv = nivelLabel(r.nivel_risco);
          data.cell.styles.fillColor = nv.color;
          data.cell.styles.textColor = 255;
        }
      }
    },
  });

  let afterTableY = (doc as any).lastAutoTable.finalY + 4;

  // ================= OBSERVAÇÕES =================
  if (p.observacoes && p.observacoes.trim().length > 0) {
    if (afterTableY > pageH - 80) { doc.addPage(); afterTableY = margin; }
    doc.setFont("helvetica", "bold").setFontSize(8);
    doc.text("OBSERVAÇÕES GERAIS:", margin, afterTableY);
    afterTableY += 2;
    const obsLines = doc.splitTextToSize(p.observacoes, contentW - 3);
    const obsH = Math.max(10, obsLines.length * 3.5 + 4);
    doc.setLineWidth(0.2);
    doc.rect(margin, afterTableY, contentW, obsH);
    doc.setFont("helvetica", "normal").setFontSize(7.5);
    doc.text(obsLines, margin + 1.5, afterTableY + 4);
    afterTableY += obsH + 4;
  }

  // ================= ASSINATURAS =================
  // Quebra de página se faltar espaço
  const exec = p.assinaturas.filter((a) => a.papel === "EXECUTANTE");
  const tst = p.assinaturas.find((a) => a.papel === "TST");
  const enc = p.assinaturas.find((a) => a.papel === "ENCARREGADO");

  const sigBlockH = 18 + Math.ceil(exec.length / 2) * 18 + 30;
  if (afterTableY + sigBlockH > pageH - margin) {
    doc.addPage();
    afterTableY = margin;
  }

  doc.setFont("helvetica", "bold").setFontSize(9);
  doc.text("ASSINATURAS DA EQUIPE EXECUTANTE", margin, afterTableY);
  afterTableY += 3;

  // Cabeçalho da tabela executantes
  autoTable(doc, {
    startY: afterTableY,
    margin: { left: margin, right: margin },
    theme: "grid",
    head: [["NOME", "CPF", "FUNÇÃO", "ASSINATURA"]],
    body: exec.length > 0
      ? exec.map((a) => [a.nome, a.cpf ?? "", a.funcao ?? "", ""])
      : [["", "", "", ""], ["", "", "", ""], ["", "", "", ""]],
    styles: { fontSize: 7.5, cellPadding: 2, minCellHeight: 12, valign: "middle" },
    headStyles: { fillColor: [153, 27, 27], textColor: 255, fontStyle: "bold", halign: "center" },
    columnStyles: {
      0: { cellWidth: 55 },
      1: { cellWidth: 30 },
      2: { cellWidth: 35 },
      3: { cellWidth: "auto" },
    },
  });
  afterTableY = (doc as any).lastAutoTable.finalY + 4;

  // Encarregado e TST
  if (afterTableY + 28 > pageH - margin) { doc.addPage(); afterTableY = margin; }
  const colW = (contentW - 4) / 2;

  function caixaAssin(x: number, yy: number, papel: string, nome: string, fnc?: string | null) {
    doc.setLineWidth(0.3);
    doc.rect(x, yy, colW, 24);
    doc.setFont("helvetica", "bold").setFontSize(7);
    doc.text(papel, x + 2, yy + 4);
    doc.setFont("helvetica", "normal").setFontSize(8);
    doc.text(nome || "_______________________________", x + 2, yy + 18);
    doc.setLineWidth(0.2);
    doc.line(x + 2, yy + 18.5, x + colW - 2, yy + 18.5);
    doc.setFontSize(6.5).setFont("helvetica", "italic");
    doc.text("Assinatura", x + colW / 2, yy + 22, { align: "center" });
    if (fnc) {
      doc.setFont("helvetica", "normal").setFontSize(7);
      doc.text(fnc, x + colW - 2, yy + 4, { align: "right" });
    }
  }

  caixaAssin(margin, afterTableY, "ENCARREGADO RESPONSÁVEL", enc?.nome ?? "", enc?.funcao);
  caixaAssin(margin + colW + 4, afterTableY, "TÉCNICO DE SEGURANÇA (TST)", tst?.nome ?? "", tst?.funcao);
  afterTableY += 26;

  // Rodapé
  doc.setFont("helvetica", "italic").setFontSize(6);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `APR emitida em ${p.data_emissao}${p.data_validade ? ` — válida até ${p.data_validade}` : ""}. Documento gerado pelo Sistema SGI.`,
    pageW / 2,
    pageH - 4,
    { align: "center" },
  );

  return doc;
}