import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type EstoqueItemPdf = {
  codigo_material: string;
  nome_material: string;
  ca: string | null;
  ca_validade: string | null;
  quantidade_atual: number;
  estoque_minimo: number;
  ultimo_fornecedor: string | null;
};

export type EstoqueSesmtPdfOpts = {
  items: EstoqueItemPdf[];
  empresa?: string;
  responsavel?: string;
  filtroAtivo?: string | null;
};

function brDate(s?: string | null) {
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR");
}

function statusOf(qtd: number, min: number): { label: string; color: [number, number, number] } {
  if (qtd === 0) return { label: "ZERADO", color: [220, 38, 38] };
  if (min > 0 && qtd <= min) return { label: "BAIXO", color: [202, 138, 4] };
  return { label: "OK", color: [22, 163, 74] };
}

export function buildEstoqueSesmtPdf(opts: EstoqueSesmtPdfOpts): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 12;

  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, W, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("INVENTÁRIO DE ESTOQUE — SESMT", M, 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(
    `Emitido em ${new Date().toLocaleString("pt-BR")}`,
    W - M,
    11,
    { align: "right" },
  );

  doc.setTextColor(0, 0, 0);
  let y = 23;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const meta: string[] = [];
  if (opts.empresa) meta.push(`Empresa: ${opts.empresa}`);
  if (opts.responsavel) meta.push(`Responsável: ${opts.responsavel}`);
  if (opts.filtroAtivo) meta.push(`Filtro: "${opts.filtroAtivo}"`);
  meta.push(`Total de itens listados: ${opts.items.length}`);
  doc.text(meta.join("   ·   "), M, y);
  y += 5;

  // Totais
  const totalUnid = opts.items.reduce((a, i) => a + (i.quantidade_atual ?? 0), 0);
  const zerados = opts.items.filter((i) => (i.quantidade_atual ?? 0) === 0).length;
  const baixos = opts.items.filter(
    (i) => (i.quantidade_atual ?? 0) > 0 && (i.estoque_minimo ?? 0) > 0 && (i.quantidade_atual ?? 0) <= (i.estoque_minimo ?? 0),
  ).length;

  doc.setFont("helvetica", "bold");
  doc.text(
    `Total em mãos: ${totalUnid} un.   ·   Zerados: ${zerados}   ·   Abaixo do mínimo: ${baixos}`,
    M,
    y,
  );
  y += 3;

  const rows = opts.items.map((i, idx) => {
    const s = statusOf(i.quantidade_atual ?? 0, i.estoque_minimo ?? 0);
    return [
      String(idx + 1),
      i.codigo_material ?? "",
      i.nome_material ?? "",
      i.ca ?? "—",
      brDate(i.ca_validade) || "—",
      String(i.quantidade_atual ?? 0),
      String(i.estoque_minimo ?? 0),
      s.label,
      i.ultimo_fornecedor ?? "—",
      "", // assinatura/contagem física
    ];
  });

  autoTable(doc, {
    startY: y + 2,
    margin: { left: M, right: M, bottom: 16 },
    head: [[
      "#",
      "Código",
      "Produto",
      "CA",
      "Val. CA",
      "Qtd",
      "Mín.",
      "Status",
      "Último fornecedor",
      "Contagem física",
    ]],
    body: rows,
    styles: { font: "helvetica", fontSize: 8, cellPadding: 1.6, lineColor: [200, 200, 200], lineWidth: 0.1 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold", halign: "center" },
    columnStyles: {
      0: { halign: "center", cellWidth: 8 },
      1: { cellWidth: 22 },
      2: { cellWidth: 80 },
      3: { cellWidth: 18, halign: "center" },
      4: { cellWidth: 18, halign: "center" },
      5: { cellWidth: 12, halign: "center", fontStyle: "bold" },
      6: { cellWidth: 12, halign: "center" },
      7: { cellWidth: 18, halign: "center", fontStyle: "bold" },
      8: { cellWidth: 40 },
      9: { cellWidth: 30 },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 7) {
        const item = opts.items[data.row.index];
        if (item) {
          const s = statusOf(item.quantidade_atual ?? 0, item.estoque_minimo ?? 0);
          data.cell.styles.textColor = s.color;
        }
      }
    },
    didDrawPage: () => {
      const page = doc.getNumberOfPages();
      doc.setFontSize(7);
      doc.setTextColor(120);
      doc.text(
        `SIGMO · Inventário Estoque SESMT · página ${page}`,
        W / 2,
        H - 6,
        { align: "center" },
      );
      doc.setTextColor(0);
    },
  });

  // Bloco de assinatura na última página
  const finalY = (doc as any).lastAutoTable?.finalY ?? y;
  let sy = finalY + 12;
  if (sy > H - 30) {
    doc.addPage();
    sy = M + 10;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.line(M, sy, M + 90, sy);
  doc.line(W - M - 90, sy, W - M, sy);
  doc.setFontSize(8);
  doc.text("Responsável SESMT (contagem)", M, sy + 4);
  doc.text("Conferente / Testemunha", W - M - 90, sy + 4);

  return doc;
}

export function openEstoqueSesmtPdf(opts: EstoqueSesmtPdfOpts) {
  const doc = buildEstoqueSesmtPdf(opts);
  const blobUrl = doc.output("bloburl");
  window.open(blobUrl, "_blank");
}

export function downloadEstoqueSesmtPdf(opts: EstoqueSesmtPdfOpts) {
  const doc = buildEstoqueSesmtPdf(opts);
  doc.save(`inventario-estoque-sesmt-${new Date().toISOString().slice(0, 10)}.pdf`);
}