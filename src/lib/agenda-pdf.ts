import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { EMPRESA_INFO } from "@/lib/empresa-info";
import { formatDateBR } from "@/lib/utils-date";

export type AgendaItem = {
  tipo: "ASO" | "CONVOCACAO" | "TREINAMENTO" | "SEM_ASO";
  employeeNome: string;
  cargo?: string;
  titulo: string;
  data: string; // ISO
  diasAteVencer: number;
  detalhe?: string;
};

export type AgendaPdfParams = {
  janelaLabel: string;
  tipoLabel: string;
  itens: AgendaItem[];
  geradoPor?: string;
};

const TIPO_LABEL: Record<AgendaItem["tipo"], string> = {
  ASO: "ASO",
  CONVOCACAO: "Convocação",
  TREINAMENTO: "Treino",
  SEM_ASO: "Sem ASO",
};

function statusInfo(dias: number): { label: string; color: [number, number, number] } {
  if (dias < 0) return { label: `Vencido ${Math.abs(dias)}d`, color: [185, 28, 28] };
  if (dias <= 7) return { label: `${dias}d`, color: [220, 38, 38] };
  if (dias <= 30) return { label: `${dias}d`, color: [217, 119, 6] };
  if (dias <= 60) return { label: `${dias}d`, color: [202, 138, 4] };
  return { label: `${dias}d`, color: [22, 163, 74] };
}

export function gerarAgendaInteligentePDF(p: AgendaPdfParams): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 10;

  // ---- Cabeçalho ----
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("AGENDA INTELIGENTE — SST", margin, 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`${EMPRESA_INFO.razao_social}  ·  CNPJ ${EMPRESA_INFO.cnpj}`, margin, 15);
  doc.text(EMPRESA_INFO.endereco + "  ·  " + EMPRESA_INFO.cidade_uf_cep, margin, 19);

  doc.setFontSize(8);
  const right = pageW - margin;
  const dataGer = new Date().toLocaleString("pt-BR");
  doc.text(`Emitido em: ${dataGer}`, right, 10, { align: "right" });
  doc.text(`Janela: ${p.janelaLabel}  ·  Tipo: ${p.tipoLabel}`, right, 15, { align: "right" });
  doc.text(`Total: ${p.itens.length} pendência(s)`, right, 19, { align: "right" });

  // ---- KPIs ----
  const kpi = {
    vencidos: p.itens.filter(i => i.diasAteVencer < 0).length,
    semana: p.itens.filter(i => i.diasAteVencer >= 0 && i.diasAteVencer <= 7).length,
    mes: p.itens.filter(i => i.diasAteVencer > 7 && i.diasAteVencer <= 30).length,
    prox: p.itens.filter(i => i.diasAteVencer > 30 && i.diasAteVencer <= 90).length,
  };
  const kpis: Array<[string, number, [number, number, number]]> = [
    ["VENCIDOS", kpi.vencidos, [185, 28, 28]],
    ["7 DIAS", kpi.semana, [217, 119, 6]],
    ["30 DIAS", kpi.mes, [202, 138, 4]],
    ["60–90 DIAS", kpi.prox, [22, 163, 74]],
  ];
  const kpiW = (pageW - margin * 2 - 6) / 4;
  let kx = margin;
  const ky = 27;
  kpis.forEach(([lbl, val, col]) => {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(...col);
    doc.setLineWidth(0.5);
    doc.roundedRect(kx, ky, kpiW, 14, 2, 2, "FD");
    doc.setTextColor(...col);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text(lbl, kx + 3, ky + 5);
    doc.setFontSize(14);
    doc.text(String(val), kx + 3, ky + 12);
    kx += kpiW + 2;
  });

  // ---- Tabela ----
  autoTable(doc, {
    startY: ky + 18,
    margin: { left: margin, right: margin },
    head: [["#", "Colaborador", "Cargo", "Tipo", "Pendência", "Detalhe", "Data alvo", "Status"]],
    body: p.itens.map((it, i) => {
      const s = statusInfo(it.diasAteVencer);
      return [
        String(i + 1),
        it.employeeNome,
        it.cargo ?? "—",
        TIPO_LABEL[it.tipo],
        it.titulo,
        it.detalhe ?? "—",
        formatDateBR(it.data),
        s.label,
      ];
    }),
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 1.6,
      textColor: [15, 23, 42],
      lineColor: [203, 213, 225],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 55, fontStyle: "bold" },
      2: { cellWidth: 40 },
      3: { cellWidth: 22, halign: "center" },
      4: { cellWidth: 52 },
      5: { cellWidth: 50 },
      6: { cellWidth: 22, halign: "center" },
      7: { cellWidth: 25, halign: "center", fontStyle: "bold" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 7) {
        const it = p.itens[data.row.index];
        if (it) {
          const s = statusInfo(it.diasAteVencer);
          data.cell.styles.textColor = s.color;
        }
      }
    },
    didDrawPage: () => {
      const ph = doc.internal.pageSize.getHeight();
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(
        "SIGMO · Agenda Inteligente SST · NR-1 / NR-7 · ISO 9001 / 45001",
        margin, ph - 5,
      );
      doc.text(
        `Página ${doc.getNumberOfPages()}`,
        pageW - margin, ph - 5, { align: "right" },
      );
    },
  });

  return doc;
}