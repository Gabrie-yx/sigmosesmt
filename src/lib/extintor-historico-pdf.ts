import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import dmnLogo from "@/assets/dmn-logo.png";
import { calcularProximosPassos, formatMesAnoBR, isVencido } from "./extintor-regulatorio";

type Any = Record<string, any>;

function fmtBR(d?: string | null) {
  if (!d) return "—";
  const [y, m, day] = String(d).split("T")[0].split("-");
  return y && m && day ? `${day}/${m}/${y}` : String(d);
}
function fmtDT(d?: string | null) {
  if (!d) return "—";
  try { return new Date(d).toLocaleString("pt-BR"); } catch { return String(d); }
}

export async function gerarPdfHistoricoExtintor(
  extintor: Any,
  inspecoesIa: Any[],
  inspecoesManuais: Any[],
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210;
  const margin = 12;
  const contentW = pageW - margin * 2;

  // ===== Cabeçalho =====
  const drawHeader = () => {
    doc.setDrawColor(0); doc.setLineWidth(0.3);
    doc.rect(margin, margin, contentW, 18);
    doc.line(margin + 34, margin, margin + 34, margin + 18);
    doc.line(pageW - margin - 48, margin, pageW - margin - 48, margin + 18);
    try { doc.addImage(dmnLogo as any, "PNG", margin + 2, margin + 3, 30, 12); } catch {}
    doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text("HISTÓRICO DO EXTINTOR", pageW / 2, margin + 8, { align: "center" });
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.text("ABNT NBR 12962 · NR-23 · ISO 45001", pageW / 2, margin + 13, { align: "center" });
    doc.setFontSize(7);
    const ctrlX = pageW - margin - 46;
    ["CÓD: FOR-SFG 08-A", "REVISÃO: 00", `EMISSÃO: ${new Date().toLocaleDateString("pt-BR")}`, "PÁG: 01/01"]
      .forEach((t, i) => {
        const ry = margin + i * 4.5;
        doc.line(ctrlX, ry, pageW - margin, ry);
        doc.text(t, ctrlX + 2, ry + 3);
      });
  };
  drawHeader();

  let y = margin + 22;

  // ===== Identificação =====
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "grid",
    head: [["IDENTIFICAÇÃO DO EQUIPAMENTO", ""]],
    body: [
      ["Nº do extintor", String(extintor.numero ?? "—")],
      ["Tipo de agente", String(extintor.tipo_agente ?? "—")],
      ["Carga nominal", extintor.carga_nominal ? `${extintor.carga_nominal} ${extintor.carga_unidade ?? "kg"}` : "—"],
      ["Capacidade extintora", String(extintor.capacidade_extintora ?? "—")],
      ["Nº selo INMETRO", String(extintor.numero_selo_inmetro ?? "—")],
      ["Fabricante", String(extintor.fabricante ?? "—")],
      ["Área", String(extintor.area ?? "—")],
      ["Localização", String(extintor.localizacao ?? "—")],
      ["Status atual", String(extintor.status ?? "—")],
      ["Empresa responsável manutenção", String(extintor.empresa_responsavel ?? "—")],
    ],
    styles: { fontSize: 8.5, cellPadding: 1.6, lineColor: [0, 0, 0], lineWidth: 0.15 },
    headStyles: { fillColor: [185, 28, 28], textColor: [255, 255, 255], fontStyle: "bold", halign: "left" },
    columnStyles: { 0: { cellWidth: 70, fontStyle: "bold", fillColor: [248, 250, 252] }, 1: { cellWidth: contentW - 70 } },
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // ===== Próximos passos regulatórios =====
  const ultimaInsp =
    inspecoesManuais[0]?.data_inspecao
      ? inspecoesManuais[0].data_inspecao
      : inspecoesIa[0]?.inspecionado_em
      ? String(inspecoesIa[0].inspecionado_em).slice(0, 10)
      : null;

  const passos = calcularProximosPassos(extintor, ultimaInsp);
  const tag = (d: Date | null) => (isVencido(d) ? " (VENCIDO)" : "");

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "grid",
    head: [["PRÓXIMOS PASSOS REGULATÓRIOS (NBR 12962)", "PREVISÃO"]],
    body: [
      ["Próxima inspeção mensal (Manutenção de 1º Grau)", formatMesAnoBR(passos.proximaInspecaoMensal) + tag(passos.proximaInspecaoMensal)],
      ["Próxima recarga (Manutenção de 2º Grau)", formatMesAnoBR(passos.proximaRecarga) + tag(passos.proximaRecarga)],
      ["Próximo teste hidrostático (Manutenção de 3º Grau)", formatMesAnoBR(passos.proximoTesteHidrostatico) + tag(passos.proximoTesteHidrostatico)],
    ],
    styles: { fontSize: 9, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.15 },
    headStyles: { fillColor: [5, 150, 105], textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 120, fontStyle: "bold" }, 1: { cellWidth: contentW - 120, halign: "center", fontStyle: "bold" } },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 1 && /VENCIDO/.test(String(data.cell.raw))) {
        data.cell.styles.textColor = [185, 28, 28];
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // ===== Histórico de inspeções por foto =====
  if (inspecoesIa.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: "grid",
      head: [["DATA", "STATUS", "CONFIANÇA", "RESPONSÁVEL", "OBSERVAÇÕES / NÃO CONFORMIDADES"]],
      body: inspecoesIa.map((r) => [
        fmtDT(r.inspecionado_em),
        String(r.status_geral ?? "—"),
        r.confianca_ia != null ? `${Math.round(Number(r.confianca_ia) * 100)}%` : "—",
        r.assinado_por_nome ? `${r.assinado_por_nome}${r.assinado_por_cargo ? " · " + r.assinado_por_cargo : ""}` : "—",
        [
          Array.isArray(r.nao_conformidades) && r.nao_conformidades.length
            ? "NC: " + r.nao_conformidades.join("; ")
            : "",
          r.observacoes ? "Obs: " + r.observacoes : "",
        ].filter(Boolean).join("\n") || "—",
      ]),
      styles: { fontSize: 7.5, cellPadding: 1.4, lineColor: [0, 0, 0], lineWidth: 0.15, valign: "middle", overflow: "linebreak" },
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.5 },
      columnStyles: {
        0: { cellWidth: 28 }, 1: { cellWidth: 24, halign: "center" }, 2: { cellWidth: 18, halign: "center" },
        3: { cellWidth: 38 }, 4: { cellWidth: contentW - 28 - 24 - 18 - 38 },
      },
      didDrawPage: () => drawHeader(),
    });
    y = (doc as any).lastAutoTable.finalY + 4;
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
    doc.text(`Inspeções por foto · ${inspecoesIa.length} registro(s)`, margin, y - 1);
  }

  // ===== Histórico de inspeções manuais =====
  if (inspecoesManuais.length > 0) {
    autoTable(doc, {
      startY: y + 2,
      margin: { left: margin, right: margin },
      theme: "grid",
      head: [["DATA", "CONFORME", "RESPONSÁVEL", "DETALHE / NÃO CONFORMIDADE", "OBSERVAÇÕES"]],
      body: inspecoesManuais.map((r) => [
        fmtBR(r.data_inspecao),
        r.conforme ? "SIM" : "NÃO",
        `${r.responsavel_nome ?? "—"}${r.responsavel_registro ? " · " + r.responsavel_registro : ""}`,
        String(r.nao_conformidade ?? "—"),
        String(r.observacoes ?? "—"),
      ]),
      styles: { fontSize: 7.5, cellPadding: 1.4, lineColor: [0, 0, 0], lineWidth: 0.15, valign: "middle", overflow: "linebreak" },
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.5 },
      columnStyles: {
        0: { cellWidth: 22, halign: "center" }, 1: { cellWidth: 20, halign: "center" },
        2: { cellWidth: 46 }, 3: { cellWidth: 50 }, 4: { cellWidth: contentW - 22 - 20 - 46 - 50 },
      },
      didDrawPage: () => drawHeader(),
    });
    y = (doc as any).lastAutoTable.finalY + 4;
  }

  if (inspecoesIa.length === 0 && inspecoesManuais.length === 0) {
    doc.setFont("helvetica", "italic"); doc.setFontSize(9);
    doc.text("Nenhuma inspeção registrada para este equipamento.", margin, y + 6);
  }

  // ===== Rodapé legal =====
  const pageH = 297;
  doc.setFont("helvetica", "normal"); doc.setFontSize(7);
  doc.setTextColor(100);
  doc.text(
    "Documento gerado automaticamente pelo SIGMO. Serve como comprovante de manutenção para auditorias de ISO 45001, " +
    "fiscalização do Corpo de Bombeiros e seguradoras. Conforme ABNT NBR 12962 e NR-23.",
    margin, pageH - 10, { maxWidth: contentW },
  );
  doc.setTextColor(0);

  return doc;
}