import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import dmnLogo from "@/assets/dmn-logo.png";

export type PacoteRescisaoDados = {
  emp: { nome: string; cpf?: string | null; matricula?: string | null; admissao?: string | null };
  company?: { name?: string | null; cnpj?: string | null } | null;
  role?: { name?: string | null } | null;
  data_desligamento: string; // YYYY-MM-DD
  motivo: string;
  motivo_detalhe?: string | null;
  aso: { data?: string | null; aptidao?: string | null; dispensado?: boolean; dispensa_justificativa?: string | null };
  ppp_numero?: string | null;
  epis_devolvidos: Array<{ item: string; ca?: string | null; qtd: number; data_entrega?: string | null }>;
  epis_pendentes: Array<{ item: string; ca?: string | null; qtd: number; data_entrega?: string | null }>;
  oss_afetadas: Array<{ codigo?: string | null; template?: string | null; status_antes?: string | null; status_depois?: string | null }>;
  checklist: Record<string, boolean>;
  observacoes?: string | null;
  responsavel_tst?: string | null;
  sha256?: string | null;
};

function br(d?: string | null) {
  if (!d) return "___/___/______";
  const iso = String(d).split("T")[0];
  const [y, m, day] = iso.split("-");
  return y && m && day ? `${day}/${m}/${y}` : String(d);
}

const CHECKLIST_LABELS: Record<string, string> = {
  epis_devolvidos: "EPIs devolvidos / baixa registrada (NR-06 item 6.6.1 'g')",
  aso_demissional: "ASO demissional emitido (NR-07 item 7.5.15.4)",
  equipamentos_devolvidos: "Equipamentos / crachá / uniforme devolvidos",
  ferramentas_devolvidas: "Ferramentas devolvidas",
  acessos_revogados: "Acessos físicos e de sistema revogados",
  ppp_pendente: "PPP entregue ao colaborador (CLT art. 168 §2º)",
};

export function gerarPacoteRescisaoPdf(d: PacoteRescisaoDados): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const H = 297;
  const M = 15;
  const innerW = W - M * 2;
  let y = M;

  // Cabeçalho
  const hdrH = 22;
  const logoW = 38;
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(M, y, innerW, hdrH);
  doc.line(M + logoW, y, M + logoW, y + hdrH);
  try {
    doc.addImage(dmnLogo as any, "PNG", M + 3, y + 3, logoW - 6, hdrH - 6);
  } catch {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(178, 34, 34);
    doc.text("DMN", M + logoW / 2, y + 11, { align: "center" });
    doc.setTextColor(0);
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("TERMO DE ENCERRAMENTO — SAÚDE E SEGURANÇA DO TRABALHO", M + logoW + (innerW - logoW) / 2, y + 9, { align: "center" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("NR-01 · NR-07 · NR-06 · ISO 9001 §7.5 · ISO 45001 §8.1.3", M + logoW + (innerW - logoW) / 2, y + 15, { align: "center" });
  y += hdrH + 6;

  // Identificação
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 1.5, lineColor: [0, 0, 0], textColor: [0, 0, 0] },
    headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: "bold" },
    head: [[{ content: "IDENTIFICAÇÃO", colSpan: 4, styles: { halign: "center", fillColor: [0, 0, 0], textColor: [255, 255, 255] } }]],
    body: [
      [{ content: "Trabalhador", styles: { fontStyle: "bold" } }, { content: d.emp.nome, colSpan: 3 }],
      [{ content: "CPF", styles: { fontStyle: "bold" } }, d.emp.cpf ?? "—", { content: "Matrícula", styles: { fontStyle: "bold" } }, d.emp.matricula ?? "—"],
      [{ content: "Empresa", styles: { fontStyle: "bold" } }, d.company?.name ?? "—", { content: "CNPJ", styles: { fontStyle: "bold" } }, d.company?.cnpj ?? "—"],
      [{ content: "Cargo", styles: { fontStyle: "bold" } }, d.role?.name ?? "—", { content: "Admissão", styles: { fontStyle: "bold" } }, br(d.emp.admissao)],
      [{ content: "Desligamento", styles: { fontStyle: "bold" } }, br(d.data_desligamento), { content: "Motivo", styles: { fontStyle: "bold" } }, d.motivo],
    ],
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // ASO
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 1.5, lineColor: [0, 0, 0], textColor: [0, 0, 0] },
    head: [[{ content: "1. ASO DEMISSIONAL (NR-07 item 7.5.15.4)", colSpan: 2, styles: { halign: "left", fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: "bold" } }]],
    body: d.aso.dispensado
      ? [
          [{ content: "Situação", styles: { fontStyle: "bold" } }, "DISPENSADO — último ASO válido dentro do prazo NR-07 (135 dias risco 1/2 · 90 dias risco 3/4)."],
          [{ content: "Justificativa", styles: { fontStyle: "bold" } }, d.aso.dispensa_justificativa ?? "—"],
        ]
      : [
          [{ content: "Data do exame", styles: { fontStyle: "bold" } }, br(d.aso.data)],
          [{ content: "Aptidão", styles: { fontStyle: "bold" } }, d.aso.aptidao ?? "—"],
        ],
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // EPIs
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.5, lineColor: [0, 0, 0], textColor: [0, 0, 0] },
    head: [
      [{ content: "2. DEVOLUÇÃO DE EPIs (NR-06 item 6.6.1 'g')", colSpan: 4, styles: { halign: "left", fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: "bold" } }],
      [
        { content: "EPI", styles: { fontStyle: "bold", fillColor: [230, 230, 230] } },
        { content: "CA", styles: { fontStyle: "bold", fillColor: [230, 230, 230] } },
        { content: "Qtd", styles: { fontStyle: "bold", fillColor: [230, 230, 230], halign: "center" } },
        { content: "Situação", styles: { fontStyle: "bold", fillColor: [230, 230, 230], halign: "center" } },
      ],
    ],
    body: [
      ...d.epis_devolvidos.map((e) => [e.item, e.ca ?? "—", { content: String(e.qtd), styles: { halign: "center" as const } }, { content: "DEVOLVIDO", styles: { halign: "center" as const, textColor: [0, 100, 0] as [number, number, number], fontStyle: "bold" as const } }]),
      ...d.epis_pendentes.map((e) => [e.item, e.ca ?? "—", { content: String(e.qtd), styles: { halign: "center" as const } }, { content: "PENDENTE", styles: { halign: "center" as const, textColor: [178, 34, 34] as [number, number, number], fontStyle: "bold" as const } }]),
      ...(d.epis_devolvidos.length + d.epis_pendentes.length === 0 ? [[{ content: "Nenhum EPI em posse do trabalhador na data do desligamento.", colSpan: 4, styles: { halign: "center" as const, textColor: [100, 100, 100] as [number, number, number] } }]] : []),
    ],
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // OSs
  if (y > H - 90) { doc.addPage(); y = M; }
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.5, lineColor: [0, 0, 0], textColor: [0, 0, 0] },
    head: [
      [{ content: "3. ORDENS DE SERVIÇO — PRESERVAÇÃO (NR-01 item 1.4.1 'c')", colSpan: 3, styles: { halign: "left", fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: "bold" } }],
      [
        { content: "OS", styles: { fontStyle: "bold", fillColor: [230, 230, 230] } },
        { content: "Descrição", styles: { fontStyle: "bold", fillColor: [230, 230, 230] } },
        { content: "Situação final", styles: { fontStyle: "bold", fillColor: [230, 230, 230], halign: "center" } },
      ],
    ],
    body: d.oss_afetadas.length
      ? d.oss_afetadas.map((o) => [o.codigo ?? "—", o.template ?? "—", { content: o.status_depois ?? "SUBSTITUIDO", styles: { halign: "center" as const, fontStyle: "bold" as const } }])
      : [[{ content: "Nenhuma OS ativa. Histórico permanece preservado conforme retenção legal.", colSpan: 3, styles: { halign: "center" as const, textColor: [100, 100, 100] as [number, number, number] } }]],
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // PPP
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 1.5, lineColor: [0, 0, 0], textColor: [0, 0, 0] },
    head: [[{ content: "4. PPP — PERFIL PROFISSIOGRÁFICO PREVIDENCIÁRIO (CLT art. 168 §2º)", colSpan: 2, styles: { halign: "left", fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: "bold" } }]],
    body: [
      [{ content: "Situação", styles: { fontStyle: "bold" } }, d.ppp_numero ? `Emitido — Nº ${d.ppp_numero}` : "Rascunho gerado — a ser conferido e assinado pelo Representante Legal"],
      [{ content: "Responsabilidade", styles: { fontStyle: "bold" } }, "Entrega ao trabalhador de responsabilidade do RH / Representante Legal da empresa."],
    ],
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // Checklist
  if (y > H - 70) { doc.addPage(); y = M; }
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 1.5, lineColor: [0, 0, 0], textColor: [0, 0, 0] },
    head: [[{ content: "5. CHECKLIST DE SAÍDA", colSpan: 2, styles: { halign: "left", fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: "bold" } }]],
    body: Object.keys(CHECKLIST_LABELS).map((k) => [
      { content: d.checklist?.[k] ? "☑" : "☐", styles: { halign: "center" as const, cellWidth: 8, fontStyle: "bold" as const } },
      CHECKLIST_LABELS[k],
    ]),
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  if (d.observacoes) {
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      theme: "grid",
      styles: { fontSize: 8.5, cellPadding: 2, lineColor: [0, 0, 0] },
      head: [[{ content: "OBSERVAÇÕES", styles: { halign: "left", fillColor: [0, 0, 0], textColor: [255, 255, 255], fontStyle: "bold" } }]],
      body: [[d.observacoes]],
    });
    y = (doc as any).lastAutoTable.finalY + 4;
  }

  // Assinaturas
  if (y > H - 55) { doc.addPage(); y = M; }
  y += 8;
  const colW = (innerW - 6) / 2;
  doc.setDrawColor(0);
  doc.line(M, y, M + colW, y);
  doc.line(M + colW + 6, y, M + innerW, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Responsável SST (TST): ${d.responsavel_tst ?? ""}`, M, y + 4);
  doc.text(`Trabalhador: ${d.emp.nome}`, M + colW + 6, y + 4);
  doc.text(`CPF: ${d.emp.cpf ?? ""}`, M + colW + 6, y + 8);

  // Rodapé com hash
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(6.5);
    doc.setTextColor(120);
    doc.text(
      `Documento gerado eletronicamente em ${new Date().toLocaleString("pt-BR")} · SHA-256: ${d.sha256 ?? "—"}`,
      M, H - 8
    );
    doc.text(`Página ${p}/${pageCount}`, W - M, H - 8, { align: "right" });
    doc.setTextColor(0);
  }
  return doc;
}