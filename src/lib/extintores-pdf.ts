import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import dmnLogo from "@/assets/dmn-logo.png";

export const EXTINTORES_CHECKLIST_NC = [
  { id: 1, label: "Pintura" },
  { id: 2, label: "Gatilho" },
  { id: 3, label: "Trava de segurança" },
  { id: 4, label: "Lacre quebrado" },
  { id: 5, label: "Bico quebrado/entupido" },
  { id: 6, label: "Mangote" },
  { id: 7, label: "Difusor (extintor CO₂)" },
  { id: 8, label: "Obstruído por objetos" },
  { id: 9, label: "Sinalização horizontal (piso)" },
  { id: 10, label: "Sinalização vertical (parede)" },
  { id: 11, label: "Carga vencida" },
  { id: 12, label: "Teste hidrostático vencido" },
];

type ExtintorPdf = Record<string, any>;
type InspecaoPdf = Record<string, any>;

function fmtBR(d?: string | null) {
  if (!d) return "";
  const [y, m, day] = d.split("T")[0].split("-");
  return y && m && day ? `${day}/${m}/${y}` : d;
}

function fmtMesAno(d?: string | null) {
  if (!d) return "";
  const dt = new Date(`${d.split("T")[0]}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return "";
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${meses[dt.getMonth()]}/${String(dt.getFullYear()).slice(-2)}`;
}

export function gerarPdfPlanilhaExtintores(extintores: ExtintorPdf[], inspecoes: InspecaoPdf[]) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = 297;
  const margin = 6;
  const contentW = pageW - margin * 2;
  const hojeBR = new Date().toLocaleDateString("pt-BR");

  const ultInsp = new Map<string, InspecaoPdf>();
  [...inspecoes]
    .sort((a, b) => String(b.data_inspecao ?? "").localeCompare(String(a.data_inspecao ?? "")))
    .forEach((i) => { if (i.extintor_id && !ultInsp.has(i.extintor_id)) ultInsp.set(i.extintor_id, i); });

  const rows = [...extintores]
    .filter((e) => e.status !== "BAIXADO")
    .sort((a, b) => String(a.area ?? "").localeCompare(String(b.area ?? "")) || String(a.numero ?? "").localeCompare(String(b.numero ?? "")))
    .map((e, idx) => {
      const insp = ultInsp.get(e.id);
      const ncs = Array.isArray(insp?.nc_codigos) ? insp.nc_codigos.join(", ") : "";
      return [
        String(idx + 1).padStart(2, "0"),
        e.numero ?? "",
        e.area ?? "",
        e.localizacao ?? "",
        e.tipo_agente ?? "",
        e.carga_nominal ? `${e.carga_nominal}${e.carga_unidade ? ` ${e.carga_unidade}` : ""}` : "",
        e.capacidade_extintora ?? "",
        e.numero_selo_inmetro ?? "",
        fmtBR(e.data_ultima_recarga),
        fmtMesAno(e.proxima_recarga),
        e.proximo_teste_hidrostatico ?? "",
        ncs,
        insp?.observacoes ?? "",
      ];
    });

  while (rows.length < 5) rows.push(Array(13).fill(""));

  const drawHeader = () => {
    const y = margin;
    const headerH = 16;
    doc.setDrawColor(0);
    doc.setLineWidth(0.25);
    doc.rect(margin, y, contentW, headerH);
    doc.line(margin + 35, y, margin + 35, y + headerH);
    doc.line(pageW - margin - 52, y, pageW - margin - 52, y + headerH);
    try { doc.addImage(dmnLogo as any, "PNG", margin + 3, y + 3, 28, 10); } catch {}
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("PLANILHA DE INSPEÇÃO DE EXTINTORES", pageW / 2, y + 9.5, { align: "center" });
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    const ctrlX = pageW - margin - 50;
    ["CÓD: FOR-SFG 08", "REVISÃO: 00", "DATA: 30/08/2025", "PÁG: 01/01"].forEach((t, i) => {
      const rowY = y + i * 4;
      doc.line(ctrlX, rowY, pageW - margin, rowY);
      doc.text(t, ctrlX + 2, rowY + 2.8);
    });
    doc.rect(margin, y + headerH, contentW, 8);
    doc.line(margin + 82, y + headerH, margin + 82, y + headerH + 8);
    doc.line(pageW - margin - 42, y + headerH, pageW - margin - 42, y + headerH + 8);
    doc.setFontSize(7.5);
    doc.text("EMPRESA: DMN ESTALEIRO", margin + 2, y + headerH + 5.2);
    doc.text("RESPONSÁVEL PELA INSPEÇÃO: Téc. Segurança — Francisco Bandeira — CRP-0016640/AM-MTE", margin + 84, y + headerH + 5.2);
    doc.text(`DATA: ${hojeBR}`, pageW - margin - 40, y + headerH + 5.2);
  };

  drawHeader();

  autoTable(doc, {
    startY: margin + 24,
    margin: { left: margin, right: margin, bottom: 28 },
    theme: "grid",
    tableWidth: contentW,
    head: [["Nº", "Nº do\nExtintor", "ÁREA", "LOCALIZAÇÃO", "TIPO\nAGENTE", "CARGA\nNOMINAL\nKg/L", "PESO -\nCapac.\nExtintora", "Nº SELO\nDO\nINMETRO", "Recarga", "Próx.\nRecarga", "Teste\nHidrostático", "Não Conformidade", "OBSERVAÇÕES"]],
    body: rows,
    styles: { fontSize: 6.2, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0], valign: "middle", overflow: "linebreak" },
    headStyles: { fillColor: [243, 244, 246], textColor: [0, 0, 0], fontStyle: "bold", halign: "center", valign: "middle", fontSize: 6.2, minCellHeight: 11 },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" }, 1: { cellWidth: 15, halign: "center" }, 2: { cellWidth: 23 }, 3: { cellWidth: 42 },
      4: { cellWidth: 16, halign: "center" }, 5: { cellWidth: 17, halign: "center" }, 6: { cellWidth: 22, halign: "center" },
      7: { cellWidth: 22, halign: "center" }, 8: { cellWidth: 18, halign: "center" }, 9: { cellWidth: 18, halign: "center" },
      10: { cellWidth: 18, halign: "center" }, 11: { cellWidth: 34, halign: "center" }, 12: { cellWidth: 34 },
    },
    didDrawPage: () => drawHeader(),
  });

  const finalY = (doc as any).lastAutoTable?.finalY ?? 165;
  const legendY = Math.min(finalY + 3, 174);
  doc.setFont("helvetica", "bold"); doc.setFontSize(6.5);
  doc.text("LEGENDA:", margin, legendY);
  doc.setFont("helvetica", "normal");
  doc.text(EXTINTORES_CHECKLIST_NC.map((it) => `${it.id}.${it.label}`).join("  "), margin + 14, legendY, { maxWidth: contentW - 14 });
  const sigY = 190;
  [["Encarregado de Produção", 52], ["Técnico em Segurança do Trabalho", 148.5], ["Supervisor Administrativo", 245]].forEach(([label, x]) => {
    doc.line(Number(x) - 34, sigY, Number(x) + 34, sigY);
    doc.text(String(label), Number(x), sigY + 4, { align: "center" });
  });

  return doc;
}