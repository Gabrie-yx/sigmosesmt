import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { drawPdfHeader } from "./pdf-header";

export type MedItem = {
  descricao: string;
  apresentacao: string;
  unidade: string;
  quantidade: number | string;
  justificativa?: string;
};

/**
 * Lista padrão do ambulatório DMN — uso diário (analgésicos, antitérmicos,
 * antiácidos, colírios, curativos básicos, antissépticos).
 * Não inclui medicação controlada (Portaria 344/98) — esses dependem de
 * prescrição médica e não vão para requisição de uso livre.
 */
export const MEDICAMENTOS_AMBULATORIO_PADRAO: MedItem[] = [
  // Analgésicos / antitérmicos
  { descricao: "Dipirona Sódica 500mg",                 apresentacao: "Comprimido",     unidade: "CX c/ 20", quantidade: 4 },
  { descricao: "Paracetamol 750mg",                     apresentacao: "Comprimido",     unidade: "CX c/ 20", quantidade: 3 },
  { descricao: "Ibuprofeno 600mg",                      apresentacao: "Comprimido",     unidade: "CX c/ 20", quantidade: 2 },
  { descricao: "Dorflex (Orfenadrina+Dipirona+Cafeína)",apresentacao: "Comprimido",     unidade: "CX c/ 30", quantidade: 3 },
  { descricao: "Buscopan Composto",                     apresentacao: "Comprimido",     unidade: "CX c/ 20", quantidade: 2 },

  // Estômago / gastrite
  { descricao: "Omeprazol 20mg",                        apresentacao: "Cápsula",        unidade: "CX c/ 28", quantidade: 3 },
  { descricao: "Hidróxido de Alumínio + Magnésio",      apresentacao: "Suspensão 240ml",unidade: "FRASCO",   quantidade: 6 },
  { descricao: "Sais para Reidratação Oral",            apresentacao: "Sachê",          unidade: "UN",       quantidade: 20 },

  // Alergia
  { descricao: "Loratadina 10mg",                       apresentacao: "Comprimido",     unidade: "CX c/ 12", quantidade: 2 },

  // Olhos / vias aéreas
  { descricao: "Colírio Lubrificante (Lágrima Artif.)", apresentacao: "Frasco 15ml",    unidade: "FRASCO",   quantidade: 6 },
  { descricao: "Soro Fisiológico 0,9% — flaconete 5ml", apresentacao: "Flaconete",      unidade: "UN",       quantidade: 50 },
  { descricao: "Soro Fisiológico 0,9% — 250ml",         apresentacao: "Frasco",         unidade: "FRASCO",   quantidade: 8 },

  // Pele / uso tópico
  { descricao: "Sulfadiazina de Prata 1% (queimadura)", apresentacao: "Pomada 50g",     unidade: "TUBO",     quantidade: 3 },
  { descricao: "Diclofenaco Dietilamônio Gel",          apresentacao: "Bisnaga 60g",    unidade: "TUBO",     quantidade: 3 },
  { descricao: "Protetor Solar FPS 50+",                apresentacao: "Frasco 120ml",   unidade: "FRASCO",   quantidade: 8 },
  { descricao: "Repelente de Insetos (Icaridina)",      apresentacao: "Spray 100ml",    unidade: "UN",       quantidade: 6 },

  // Antissépticos
  { descricao: "Álcool Etílico 70% líquido",            apresentacao: "1 Litro",        unidade: "UN",       quantidade: 6 },
  { descricao: "Álcool Gel 70%",                        apresentacao: "Frasco 500ml",   unidade: "FRASCO",   quantidade: 8 },
  { descricao: "PVP-I Tópico (Iodopovidona)",           apresentacao: "Frasco 100ml",   unidade: "FRASCO",   quantidade: 4 },
  { descricao: "Clorexidina Aquosa 0,2%",               apresentacao: "Frasco 100ml",   unidade: "FRASCO",   quantidade: 4 },

  // Curativos
  { descricao: "Bandagem Adesiva (Band-Aid)",           apresentacao: "Caixa 35un",     unidade: "CX",       quantidade: 6 },
  { descricao: "Gaze Estéril 7,5 x 7,5 cm",             apresentacao: "Pacote c/ 10",   unidade: "PCT",      quantidade: 15 },
  { descricao: "Atadura de Crepe 10cm",                 apresentacao: "Rolo",           unidade: "UN",       quantidade: 15 },
  { descricao: "Esparadrapo 10cm x 4,5m",               apresentacao: "Rolo",           unidade: "UN",       quantidade: 6 },
  { descricao: "Micropore 25mm",                        apresentacao: "Rolo",           unidade: "UN",       quantidade: 6 },

  // Insumos / EPI ambulatório
  { descricao: "Luva de Procedimento (Nitrílica) — M",  apresentacao: "Caixa c/ 100",   unidade: "CX",       quantidade: 2 },
  { descricao: "Termômetro Digital",                    apresentacao: "Axilar",         unidade: "UN",       quantidade: 2 },
  { descricao: "Compressa Fria Instantânea",            apresentacao: "Bolsa descart.", unidade: "UN",       quantidade: 6 },
];

export type RequisicaoMedicamentosOpts = {
  numero?: string;
  setor?: string;
  solicitante: string;
  responsavelTST?: string;
  responsavelAprovador?: string;
  observacoes?: string;
  itens: MedItem[];
};

function hoje(): string {
  return new Date().toLocaleDateString("pt-BR");
}

export function buildRequisicaoMedicamentosPdf(opts: RequisicaoMedicamentosOpts): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 12;

  const totalItens = opts.itens.length;
  const totalUnid = opts.itens.reduce((a, i) => a + Number(i.quantidade || 0), 0);

  const y = drawPdfHeader(doc, {
    titulo: "Requisição de Medicamentos — Ambulatório SESMT",
    subtitulo: "Reposição de itens de uso diário (NR-07 / PCMSO)",
    responsavel: opts.solicitante,
    filtros: [
      opts.numero ? `Nº ${opts.numero}` : "Nº ____/2026",
      `Data: ${hoje()}`,
      opts.setor ? `Setor: ${opts.setor}` : "Setor: SESMT",
    ],
    kpis: [
      { label: "Itens", value: totalItens, tone: "neutral" },
      { label: "Unidades totais", value: totalUnid, tone: "success" },
    ],
  });

  const rows = opts.itens.map((it, idx) => [
    String(idx + 1),
    it.descricao,
    it.apresentacao,
    it.unidade,
    String(it.quantidade ?? ""),
    it.justificativa ?? "Reposição de estoque",
    "", // recebido (preenchido manual)
  ]);

  autoTable(doc, {
    startY: y + 1,
    margin: { left: M, right: M, bottom: 16 },
    head: [["#", "Medicamento / Insumo", "Apresentação", "Unidade", "Qtd", "Justificativa", "Recebido"]],
    body: rows,
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 1.6, lineColor: [200, 200, 200], lineWidth: 0.1, valign: "middle" },
    headStyles: { fillColor: [127, 29, 29], textColor: 255, fontStyle: "bold", halign: "center" },
    columnStyles: {
      0: { halign: "center", cellWidth: 8 },
      1: { cellWidth: 62, fontStyle: "bold" },
      2: { cellWidth: 30 },
      3: { cellWidth: 20, halign: "center" },
      4: { cellWidth: 12, halign: "center", fontStyle: "bold" },
      5: { cellWidth: 35 },
      6: { cellWidth: 18 },
    },
    didDrawPage: () => {
      const page = doc.getNumberOfPages();
      doc.setFontSize(7);
      doc.setTextColor(120);
      doc.text(`SIGMO · Requisição de Medicamentos · página ${page}`, W / 2, H - 6, { align: "center" });
      doc.setTextColor(0);
    },
  });

  let cy = (doc as any).lastAutoTable?.finalY ?? y;
  cy += 8;

  // Observações
  if (cy > H - 60) { doc.addPage(); cy = M + 10; }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Observações:", M, cy);
  cy += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const obs = opts.observacoes?.trim() || "Itens de uso diário do ambulatório, sem medicação controlada (Portaria SVS/MS 344/98). Validade mínima exigida: 12 meses na entrega.";
  const lines = doc.splitTextToSize(obs, W - 2 * M);
  doc.text(lines, M, cy);
  cy += lines.length * 4 + 6;

  // Assinaturas
  if (cy > H - 35) { doc.addPage(); cy = M + 10; }
  const colW = (W - 2 * M - 10) / 3;
  const sy = cy + 14;
  [0, 1, 2].forEach((i) => {
    const x = M + i * (colW + 5);
    doc.line(x, sy, x + colW, sy);
  });
  doc.setFontSize(8);
  doc.text(`Solicitante\n${opts.solicitante}`, M, sy + 4);
  doc.text(`TST Responsável\n${opts.responsavelTST ?? ""}`, M + colW + 5, sy + 4);
  doc.text(`Aprovação / Compras\n${opts.responsavelAprovador ?? ""}`, M + 2 * (colW + 5), sy + 4);

  return doc;
}

export function downloadRequisicaoMedicamentosPdf(opts: RequisicaoMedicamentosOpts) {
  const doc = buildRequisicaoMedicamentosPdf(opts);
  doc.save(`requisicao-medicamentos-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function previewRequisicaoMedicamentosPdf(opts: RequisicaoMedicamentosOpts): string {
  const doc = buildRequisicaoMedicamentosPdf(opts);
  return doc.output("dataurlstring");
}