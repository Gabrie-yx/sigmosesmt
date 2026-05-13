import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import dmnLogo from "@/assets/dmn-logo.png";

export type OrdemFull = {
  id: string;
  numero: string;
  data_solicitacao: string | null;
  casco: string | null;
  tipo_produto: string | null;
  solicitante: string | null;
  qtde_itens: number | null;
  observacoes: string | null;
  status: string;
  codigo_formulario?: string | null;
  revisao?: string | null;
  pagina?: string | null;
  mtart?: string | null;
  itens?: Array<{
    id: string;
    item: number;
    descricao_material: string;
    unidade_medida: string | null;
    grupo_compradores: string | null;
    ncm: string | null;
    centro: string | null;
    deposito: string | null;
    grupo_mercadorias: string | null;
    setor_atividade: string | null;
    grupo_categ_item_ger: string | null;
    classe_avaliacao: string | null;
    determ_preco: string | null;
    controle_preco: string | null;
    origem_material: string | null;
    utilizacao_material: string | null;
    codigo_sap?: string | null;
    ocorrencia?: string | null;
  }>;
};

// Cabeçalhos das colunas conforme formulário homologado FOR-PROD 01
// Cores: Y = amarelo, B = azul, G = cinza padrão
type ColTone = "Y" | "B" | "G";
const COLS: { label: string; key: keyof NonNullable<OrdemFull["itens"]>[number] | "item" | "data_solicitacao"; tone: ColTone; w: number }[] = [
  { label: "ITEM",                 key: "item",                  tone: "G", w: 10 },
  { label: "DATA\nSOLICITAÇÃO",    key: "data_solicitacao",      tone: "Y", w: 22 },
  { label: "DESCRIÇÃO DO MATERIAL",key: "descricao_material",    tone: "Y", w: 50 },
  { label: "UNIDADE\nMEDIDA",      key: "unidade_medida",        tone: "G", w: 16 },
  { label: "GRUPO\nCOMPRADORES",   key: "grupo_compradores",     tone: "G", w: 18 },
  { label: "NCM",                  key: "ncm",                   tone: "G", w: 18 },
  { label: "CENTRO",               key: "centro",                tone: "G", w: 14 },
  { label: "DEPÓSITO",             key: "deposito",              tone: "G", w: 14 },
  { label: "GRUPO DE\nMERCADORIAS",key: "grupo_mercadorias",     tone: "B", w: 20 },
  { label: "SETOR DE\nATIVIDADE",  key: "setor_atividade",       tone: "G", w: 16 },
  { label: "GR. CATEG.\nITEM GER", key: "grupo_categ_item_ger",  tone: "G", w: 18 },
  { label: "CLASSE DE\nAVALIAÇÃO", key: "classe_avaliacao",      tone: "B", w: 18 },
  { label: "Determ.\npreço",       key: "determ_preco",          tone: "G", w: 14 },
  { label: "CONTROLE\nPREÇO",      key: "controle_preco",        tone: "G", w: 16 },
  { label: "ORIGEM DO\nMATERIAL",  key: "origem_material",       tone: "Y", w: 20 },
  { label: "UTILIZAÇÃO DO\nMATERIAL", key: "utilizacao_material",tone: "Y", w: 26 },
  { label: "CÓDIGO SAP",           key: "codigo_sap" as any,     tone: "G", w: 18 },
  { label: "OCORRÊNCIA",           key: "ocorrencia" as any,     tone: "G", w: 22 },
];

const TONE_FILL: Record<ColTone, [number, number, number]> = {
  Y: [255, 242, 0],   // amarelo
  B: [91, 155, 213],  // azul
  G: [217, 217, 217], // cinza claro
};

function build(ordem: OrdemFull): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = 297;
  const margin = 6;
  const data = ordem.data_solicitacao
    ? new Date(ordem.data_solicitacao).toLocaleDateString("pt-BR")
    : "";

  const isHalb = (ordem.mtart ?? "").toUpperCase() === "HALB";
  const tituloProduto = isHalb ? "HALB ( PRODUTO SEMIACABADO)" : "FERT ( PRODUTO ACABADO)";
  const titulo = `MATERIAIS - ${tituloProduto}`;

  // ===== Cabeçalho institucional =====
  const headerH = 18;
  doc.setDrawColor(0); doc.setLineWidth(0.3);
  doc.rect(margin, margin, pageW - margin * 2, headerH);

  // Logo (se carregar)
  try {
    doc.addImage(dmnLogo as any, "PNG", margin + 1.5, margin + 2, 30, 14);
  } catch { /* ignora se asset indisponível */ }

  // Título central
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(0);
  doc.text(titulo, pageW / 2, margin + headerH / 2 + 1, { align: "center" });

  // Bloco de controle (direita) - 4 linhas
  const ctrlW = 50;
  const ctrlX = pageW - margin - ctrlW;
  const ctrlRowH = headerH / 4;
  const ctrlRows = [
    `CÓD.: ${ordem.codigo_formulario ?? "FOR-PROD 01"}`,
    `REVISÃO: ${ordem.revisao ?? "00"}`,
    `DATA: ${data || "01/08/2025"}`,
    `PÁG. ${ordem.pagina ?? "01/01"}`,
  ];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  ctrlRows.forEach((txt, i) => {
    const y = margin + i * ctrlRowH;
    doc.rect(ctrlX, y, ctrlW, ctrlRowH);
    doc.text(txt, ctrlX + 2, y + ctrlRowH / 2 + 1);
  });

  // ===== Faixa SOLICITAÇÃO =====
  const solY = margin + headerH;
  const solH = 6;
  doc.setFillColor(217, 217, 217);
  doc.rect(margin, solY, pageW - margin * 2, solH, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("SOLICITAÇÃO", pageW / 2, solY + solH / 2 + 1, { align: "center" });

  // ===== Tabela =====
  // normaliza largura das colunas para preencher a página
  const tableW = pageW - margin * 2;
  const sumW = COLS.reduce((s, c) => s + c.w, 0);
  const factor = tableW / sumW;

  const itens = ordem.itens ?? [];
  // Garante pelo menos 8 linhas (formulário em branco quando faltarem itens)
  const minRows = 8;
  const rows: any[][] = [];
  for (let i = 0; i < Math.max(minRows, itens.length); i++) {
    const it: any = itens[i];
    rows.push(
      COLS.map((c) => {
        if (!it) return "";
        if (c.key === "item") return it.item ?? i + 1;
        if (c.key === "data_solicitacao") return data;
        return (it as any)[c.key] ?? "";
      })
    );
  }

  autoTable(doc, {
    startY: solY + solH,
    margin: { left: margin, right: margin },
    theme: "grid",
    tableWidth: tableW,
    styles: {
      fontSize: 6.5,
      cellPadding: 1.2,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      textColor: [0, 0, 0],
      overflow: "linebreak",
      valign: "middle",
      halign: "center",
      minCellHeight: 8,
    },
    headStyles: {
      fontStyle: "bold",
      fontSize: 6.8,
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
      halign: "center",
      valign: "middle",
      minCellHeight: 12,
    },
    head: [COLS.map((c) => c.label)],
    body: rows,
    columnStyles: Object.fromEntries(
      COLS.map((c, i) => [i, { cellWidth: c.w * factor }])
    ) as any,
    didParseCell: (d) => {
      if (d.section === "head") {
        const tone = COLS[d.column.index].tone;
        d.cell.styles.fillColor = TONE_FILL[tone];
      }
    },
  });

  return doc;
}

export function gerarPdfOrdem(ordem: OrdemFull) {
  const doc = build(ordem);
  doc.save(`${ordem.numero.replace(/\//g, "-")}.pdf`);
}

export function imprimirOrdem(ordem: OrdemFull) {
  const doc = build(ordem);
  doc.autoPrint();
  const blob = doc.output("bloburl");
  const w = window.open(blob as any, "_blank");
  if (!w) {
    doc.save(`${ordem.numero.replace(/\//g, "-")}.pdf`);
  }
}