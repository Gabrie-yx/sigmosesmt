import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type FichaMensalBlock = {
  employee: {
    id: string;
    nome: string;
    matricula?: string | null;
    cpf?: string | null;
    funcao?: string | null;
    empresa?: string | null;
  };
  ano: number;
  mes: number; // 1-12
  entregas: Array<{
    qtd?: number | null;
    item?: string | null;
    tamanho?: string | null;
    ca?: string | null;
    data_entrega?: string | null;
    motivo_entrega?: string | null;
  }>;
};

const MESES = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];

const TERMO_RESUMIDO =
  "Declaro, para os devidos fins, que recebi da empresa os Equipamentos de Proteção Individual (EPIs) relacionados acima, " +
  "no período indicado, ciente das obrigações da NR-06 (subitem 6.7.1): usar apenas para a finalidade a que se destinam; " +
  "responsabilizar-me pela guarda e conservação; comunicar qualquer alteração que os torne impróprios para uso; " +
  "cumprir as determinações da empresa sobre o uso adequado. Estou ciente do art. 158 da CLT e das sanções disciplinares " +
  "previstas pelo não uso do EPI, inclusive demissão por justa causa.";

function brDate(s?: string | null) {
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR");
}

function renderBlock(doc: jsPDF, b: FichaMensalBlock) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;

  // Header
  doc.setDrawColor(0); doc.setLineWidth(0.3);
  doc.rect(M, M, W - 2 * M, 16);
  doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  doc.text("FICHA MENSAL CONSOLIDADA DE ENTREGA DE EPIs", W / 2, M + 7, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text(`Conforme NR-06 — Período: ${MESES[b.mes - 1]} / ${b.ano}`, W / 2, M + 13, { align: "center" });

  let y = M + 20;

  // Dados
  doc.setFont("helvetica", "bold"); doc.setFontSize(9);
  doc.text("Funcionário:", M, y);
  doc.setFont("helvetica", "normal");
  doc.text(b.employee.nome ?? "", M + 24, y);
  doc.setFont("helvetica", "bold");
  doc.text("Matrícula:", W - M - 70, y);
  doc.setFont("helvetica", "normal");
  doc.text(b.employee.matricula ?? "—", W - M - 50, y);
  y += 5;

  doc.setFont("helvetica", "bold"); doc.text("CPF:", M, y);
  doc.setFont("helvetica", "normal"); doc.text(b.employee.cpf ?? "—", M + 24, y);
  doc.setFont("helvetica", "bold"); doc.text("Função:", W - M - 70, y);
  doc.setFont("helvetica", "normal"); doc.text(b.employee.funcao ?? "—", W - M - 50, y);
  y += 5;

  doc.setFont("helvetica", "bold"); doc.text("Empresa:", M, y);
  doc.setFont("helvetica", "normal"); doc.text(b.employee.empresa ?? "—", M + 24, y);
  y += 6;

  // Table
  autoTable(doc, {
    startY: y,
    head: [["DATA", "QTD", "ITEM / DESCRIÇÃO", "TAM.", "CA", "MOTIVO"]],
    body: b.entregas.map((e) => [
      brDate(e.data_entrega),
      String(e.qtd ?? ""),
      e.item ?? "",
      e.tamanho ?? "",
      e.ca ?? "",
      e.motivo_entrega ?? "",
    ]),
    theme: "grid",
    margin: { left: M, right: M },
    styles: { fontSize: 8.5, cellPadding: 1.8, lineColor: [0, 0, 0], lineWidth: 0.15 },
    headStyles: { fillColor: [220, 230, 241], textColor: 0, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 22, halign: "center" },
      1: { cellWidth: 14, halign: "center" },
      2: { cellWidth: "auto" as any },
      3: { cellWidth: 16, halign: "center" },
      4: { cellWidth: 22, halign: "center" },
      5: { cellWidth: 40 },
    },
  });

  // Termo
  const afterTable = (doc as any).lastAutoTable.finalY + 6;
  doc.setFont("helvetica", "italic"); doc.setFontSize(8);
  const lines = doc.splitTextToSize(TERMO_RESUMIDO, W - 2 * M);
  doc.text(lines, M, afterTable);

  // Assinaturas
  const sigY = H - 28;
  const colW = (W - 2 * M) / 2 - 6;
  doc.setDrawColor(0);
  doc.line(M, sigY, M + colW, sigY);
  doc.line(W - M - colW, sigY, W - M, sigY);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
  doc.text("Assinatura do Funcionário", M + colW / 2, sigY + 4, { align: "center" });
  doc.text("Téc. Seg. do Trabalho / Almoxarifado", W - M - colW / 2, sigY + 4, { align: "center" });

  doc.setFontSize(7); doc.setTextColor(120);
  doc.text(
    `Total de entregas neste mês: ${b.entregas.length}  •  Gerado em ${new Date().toLocaleDateString("pt-BR")}`,
    W / 2, H - 8, { align: "center" }
  );
  doc.setTextColor(0);
}

export function buildFichaMensalPdf(blocks: FichaMensalBlock[]) {
  if (!blocks.length) throw new Error("Nenhum bloco para gerar");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  blocks.forEach((b, i) => {
    if (i > 0) doc.addPage();
    renderBlock(doc, b);
  });
  return doc;
}

export function openFichaMensalPdf(blocks: FichaMensalBlock[], filename = "Fichas_Mensais_EPI.pdf") {
  const doc = buildFichaMensalPdf(blocks);
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  return { url, blob, filename };
}