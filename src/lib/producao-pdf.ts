import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
  }>;
};

function build(ordem: OrdemFull): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const data = ordem.data_solicitacao
    ? new Date(ordem.data_solicitacao).toLocaleDateString("pt-BR")
    : "—";

  // Cabeçalho
  doc.setFillColor(245, 158, 11);
  doc.rect(0, 0, 297, 14, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("ORDEM DE PRODUÇÃO", 10, 9);
  doc.setFontSize(10);
  doc.text(ordem.numero, 287, 9, { align: "right" });

  doc.setTextColor(20, 20, 20);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Formulário: ${ordem.codigo_formulario ?? "FOR-PROD 01"}   Rev.: ${ordem.revisao ?? "00"}   Pág.: ${ordem.pagina ?? "01/01"}`, 10, 19);

  // Cabeçalho dados
  autoTable(doc, {
    startY: 23,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 1.8 },
    headStyles: { fillColor: [255, 237, 213], textColor: 60, fontStyle: "bold" },
    body: [
      [{ content: "Data", styles: { fontStyle: "bold" } }, data,
       { content: "Casco", styles: { fontStyle: "bold" } }, ordem.casco ?? "—",
       { content: "Tipo de Produto", styles: { fontStyle: "bold" } }, ordem.tipo_produto ?? "—"],
      [{ content: "Solicitante", styles: { fontStyle: "bold" } }, ordem.solicitante ?? "—",
       { content: "Qtde. Itens", styles: { fontStyle: "bold" } }, ordem.qtde_itens?.toString() ?? "—",
       { content: "Status", styles: { fontStyle: "bold" } }, ordem.status],
    ],
  });

  // Itens
  const itens = ordem.itens ?? [];
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 4,
    theme: "striped",
    styles: { fontSize: 7.5, cellPadding: 1.2, overflow: "linebreak" },
    headStyles: { fillColor: [245, 158, 11], textColor: 255, fontStyle: "bold" },
    head: [["#", "Descrição", "UM", "NCM", "Centro", "Depósito", "Gr. Merc.", "Setor", "Gr. Compr.", "Cl. Aval."]],
    body: itens.map((it) => [
      it.item, it.descricao_material, it.unidade_medida ?? "", it.ncm ?? "",
      it.centro ?? "", it.deposito ?? "", it.grupo_mercadorias ?? "",
      it.setor_atividade ?? "", it.grupo_compradores ?? "", it.classe_avaliacao ?? "",
    ]),
  });

  if (ordem.observacoes) {
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 4,
      theme: "plain",
      styles: { fontSize: 9 },
      body: [[{ content: "Observações", styles: { fontStyle: "bold" } }], [ordem.observacoes]],
    });
  }

  // Rodapé assinatura
  const finalY = Math.max((doc as any).lastAutoTable.finalY + 20, 180);
  doc.setDrawColor(120);
  doc.line(30, finalY, 130, finalY);
  doc.line(167, finalY, 267, finalY);
  doc.setFontSize(8);
  doc.text("Assinatura do Solicitante", 80, finalY + 4, { align: "center" });
  doc.text("Assinatura do Responsável", 217, finalY + 4, { align: "center" });

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