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
function inRange(iso: string | null | undefined, ini: string, fim: string) {
  if (!iso) return false;
  const d = String(iso).slice(0, 10);
  return d >= ini && d <= fim;
}

export type AuditoriaInput = {
  periodoInicio: string; // YYYY-MM-DD
  periodoFim: string;    // YYYY-MM-DD
  extintores: Any[];
  inspecoesFoto: Any[];
  inspecoesManual: Any[];
  emitidoPor?: string | null;
};

export async function gerarPdfAuditoriaExtintores(input: AuditoriaInput) {
  const { periodoInicio, periodoFim, extintores, inspecoesFoto, inspecoesManual, emitidoPor } = input;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210;
  const pageH = 297;
  const margin = 12;
  const contentW = pageW - margin * 2;

  const drawHeader = () => {
    doc.setDrawColor(0); doc.setLineWidth(0.3);
    doc.rect(margin, margin, contentW, 18);
    doc.line(margin + 34, margin, margin + 34, margin + 18);
    doc.line(pageW - margin - 48, margin, pageW - margin - 48, margin + 18);
    try { doc.addImage(dmnLogo as any, "PNG", margin + 2, margin + 3, 30, 12); } catch {}
    doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text("RELATÓRIO DE AUDITORIA DE EXTINTORES", pageW / 2, margin + 8, { align: "center" });
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.text("ABNT NBR 12962 · NR-23 · ISO 45001 · ISO 9001", pageW / 2, margin + 13, { align: "center" });
    doc.setFontSize(7);
    const ctrlX = pageW - margin - 46;
    [
      "CÓD: FOR-SFG 08-AUD",
      "REVISÃO: 00",
      `EMISSÃO: ${new Date().toLocaleDateString("pt-BR")}`,
      `PÁG: ${doc.getCurrentPageInfo().pageNumber.toString().padStart(2, "0")}`,
    ].forEach((t, i) => {
      const ry = margin + i * 4.5;
      doc.line(ctrlX, ry, pageW - margin, ry);
      doc.text(t, ctrlX + 2, ry + 3);
    });
  };
  drawHeader();

  let y = margin + 22;

  // ===== Cabeçalho do período =====
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "grid",
    body: [
      ["Período auditado", `${fmtBR(periodoInicio)} a ${fmtBR(periodoFim)}`],
      ["Total de extintores no parque", String(extintores.length)],
      ["Emitido por", emitidoPor || "—"],
      ["Data de emissão", new Date().toLocaleString("pt-BR")],
    ],
    styles: { fontSize: 9, cellPadding: 1.8, lineColor: [0, 0, 0], lineWidth: 0.15 },
    columnStyles: { 0: { cellWidth: 70, fontStyle: "bold", fillColor: [248, 250, 252] }, 1: { cellWidth: contentW - 70 } },
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // ===== 1. Resumo Executivo =====
  const fotosPer = inspecoesFoto.filter((r) => inRange(r.inspecionado_em, periodoInicio, periodoFim));
  const manuaisPer = inspecoesManual.filter((r) => inRange(r.data_inspecao, periodoInicio, periodoFim));

  let totC = 0, totNC = 0, totRev = 0;
  fotosPer.forEach((r) => {
    const s = String(r.status_geral ?? "").toUpperCase();
    if (s === "CONFORME") totC++;
    else if (s === "NAO_CONFORME" || s === "NÃO_CONFORME") totNC++;
    else if (s === "PRECISA_REVISAO" || s === "PENDENTE_REVISAO") totRev++;
  });
  manuaisPer.forEach((r) => {
    if (r.conforme === true) totC++;
    else if (r.conforme === false) totNC++;
  });
  const totalInsp = totC + totNC + totRev;
  const pctConf = totalInsp > 0 ? Math.round((totC / totalInsp) * 100) : 0;

  const indisponiveis = extintores.filter((e) => {
    const s = String(e.status ?? "").toUpperCase();
    return s === "EM_MANUTENCAO" || s === "BAIXADO" || s === "VENCIDO";
  });

  doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text("1. RESUMO EXECUTIVO", margin, y);
  y += 3;
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "grid",
    head: [["Indicador", "Valor"]],
    body: [
      ["% Conformidade no período", `${pctConf}%`],
      ["Total de inspeções realizadas", String(totalInsp)],
      ["Conformes (C)", String(totC)],
      ["Não Conformes (NC)", String(totNC)],
      ["Precisam revisão / pendentes", String(totRev)],
      ["Extintores indisponíveis (manutenção/baixado/vencido)", `${indisponiveis.length} de ${extintores.length}`],
    ],
    styles: { fontSize: 9, cellPadding: 1.8, lineColor: [0, 0, 0], lineWidth: 0.15 },
    headStyles: { fillColor: [185, 28, 28], textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 130, fontStyle: "bold" }, 1: { cellWidth: contentW - 130, halign: "center", fontStyle: "bold" } },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 1) {
        const raw = String(data.cell.raw);
        if (data.row.index === 0) {
          const v = parseInt(raw, 10);
          if (!Number.isNaN(v)) {
            data.cell.styles.textColor = v >= 90 ? [5, 150, 105] : v >= 70 ? [202, 138, 4] : [185, 28, 28];
          }
        }
        if (data.row.index === 3 && raw !== "0") data.cell.styles.textColor = [185, 28, 28];
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 5;

  // ===== 2. Vencimentos regulatórios =====
  doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text("2. VENCIMENTOS REGULATÓRIOS (NBR 12962)", margin, y);
  y += 3;

  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const diasAte = (d: Date | null) => d ? Math.ceil((d.getTime() - hoje.getTime()) / 86400000) : null;

  type Linha = { ext: Any; tipo: string; previsao: Date | null; dias: number | null };
  const linhas: Linha[] = [];
  extintores.forEach((e) => {
    // pega última inspeção (manual ou foto) pra calcular mensal
    const ultMan = inspecoesManual.find((r) => r.extintor_id === e.id);
    const ultFoto = inspecoesFoto.find((r) => r.extintor_id === e.id);
    const ult = ultMan?.data_inspecao ?? (ultFoto?.inspecionado_em ? String(ultFoto.inspecionado_em).slice(0, 10) : null);
    const p = calcularProximosPassos(e, ult);
    linhas.push({ ext: e, tipo: "Inspeção mensal (1º grau)", previsao: p.proximaInspecaoMensal, dias: diasAte(p.proximaInspecaoMensal) });
    linhas.push({ ext: e, tipo: "Recarga (2º grau)", previsao: p.proximaRecarga, dias: diasAte(p.proximaRecarga) });
    linhas.push({ ext: e, tipo: "Teste hidrostático (3º grau)", previsao: p.proximoTesteHidrostatico, dias: diasAte(p.proximoTesteHidrostatico) });
  });

  const venc = linhas.filter((l) => isVencido(l.previsao));
  const ate30 = linhas.filter((l) => l.dias != null && l.dias >= 0 && l.dias <= 30);
  const ate60 = linhas.filter((l) => l.dias != null && l.dias > 30 && l.dias <= 60);
  const ate90 = linhas.filter((l) => l.dias != null && l.dias > 60 && l.dias <= 90);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "grid",
    head: [["Faixa", "Quantidade"]],
    body: [
      ["VENCIDOS", String(venc.length)],
      ["A vencer em até 30 dias", String(ate30.length)],
      ["A vencer em 31–60 dias", String(ate60.length)],
      ["A vencer em 61–90 dias", String(ate90.length)],
    ],
    styles: { fontSize: 9, cellPadding: 1.8, lineColor: [0, 0, 0], lineWidth: 0.15 },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 130, fontStyle: "bold" }, 1: { cellWidth: contentW - 130, halign: "center", fontStyle: "bold" } },
    didParseCell: (data) => {
      if (data.section === "body" && data.row.index === 0 && data.column.index === 1 && String(data.cell.raw) !== "0") {
        data.cell.styles.textColor = [185, 28, 28];
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 3;

  // Detalhe de vencidos + a vencer (até 30 dias) — só se houver
  const criticos = [...venc, ...ate30].sort((a, b) => {
    const da = a.previsao?.getTime() ?? 0;
    const db = b.previsao?.getTime() ?? 0;
    return da - db;
  });
  if (criticos.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: "grid",
      head: [["Extintor", "Área / Localização", "Manutenção", "Previsão", "Situação"]],
      body: criticos.map((l) => [
        String(l.ext.numero ?? "—"),
        `${l.ext.area ?? "—"}${l.ext.localizacao ? " · " + l.ext.localizacao : ""}`,
        l.tipo,
        formatMesAnoBR(l.previsao),
        isVencido(l.previsao) ? "VENCIDO" : `${l.dias} dia(s)`,
      ]),
      styles: { fontSize: 7.5, cellPadding: 1.4, lineColor: [0, 0, 0], lineWidth: 0.15, overflow: "linebreak" },
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.5 },
      columnStyles: {
        0: { cellWidth: 24, halign: "center", fontStyle: "bold" },
        1: { cellWidth: 60 },
        2: { cellWidth: 46 },
        3: { cellWidth: 32, halign: "center" },
        4: { cellWidth: contentW - 24 - 60 - 46 - 32, halign: "center", fontStyle: "bold" },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 4 && String(data.cell.raw) === "VENCIDO") {
          data.cell.styles.textColor = [185, 28, 28];
        }
      },
      didDrawPage: () => drawHeader(),
    });
    y = (doc as any).lastAutoTable.finalY + 5;
  } else {
    y += 2;
  }

  // ===== 3. Histórico de inspeções no período =====
  doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text("3. INSPEÇÕES NO PERÍODO", margin, y);
  y += 3;

  const mapExt = new Map(extintores.map((e) => [e.id, e]));
  const histRows: any[] = [];
  fotosPer.forEach((r) => {
    const e = mapExt.get(r.extintor_id);
    histRows.push({
      data: r.inspecionado_em,
      tipo: "Foto/IA",
      ext: e?.numero ?? "—",
      area: e?.area ?? "—",
      status: String(r.status_geral ?? "—"),
      resp: r.assinado_por_nome ?? "—",
    });
  });
  manuaisPer.forEach((r) => {
    const e = mapExt.get(r.extintor_id);
    histRows.push({
      data: r.data_inspecao,
      tipo: "Manual",
      ext: e?.numero ?? "—",
      area: e?.area ?? "—",
      status: r.conforme ? "CONFORME" : "NÃO CONFORME",
      resp: r.responsavel_nome ?? "—",
    });
  });
  histRows.sort((a, b) => String(b.data).localeCompare(String(a.data)));

  if (histRows.length === 0) {
    doc.setFont("helvetica", "italic"); doc.setFontSize(9);
    doc.text("Nenhuma inspeção registrada no período.", margin, y + 4);
    y += 8;
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: "grid",
      head: [["Data", "Tipo", "Extintor", "Área", "Status", "Responsável"]],
      body: histRows.map((r) => [
        r.tipo === "Foto/IA" ? fmtDT(r.data) : fmtBR(r.data),
        r.tipo,
        String(r.ext),
        String(r.area),
        r.status,
        String(r.resp),
      ]),
      styles: { fontSize: 7.5, cellPadding: 1.4, lineColor: [0, 0, 0], lineWidth: 0.15, overflow: "linebreak" },
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.5 },
      columnStyles: {
        0: { cellWidth: 32 },
        1: { cellWidth: 18, halign: "center" },
        2: { cellWidth: 22, halign: "center", fontStyle: "bold" },
        3: { cellWidth: 38 },
        4: { cellWidth: 30, halign: "center", fontStyle: "bold" },
        5: { cellWidth: contentW - 32 - 18 - 22 - 38 - 30 },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 4) {
          const v = String(data.cell.raw).toUpperCase();
          if (v.includes("NAO") || v.includes("NÃO")) data.cell.styles.textColor = [185, 28, 28];
          else if (v === "CONFORME") data.cell.styles.textColor = [5, 150, 105];
        }
      },
      didDrawPage: () => drawHeader(),
    });
    y = (doc as any).lastAutoTable.finalY + 5;
  }

  // ===== 4. Não conformidades abertas =====
  doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text("4. NÃO CONFORMIDADES IDENTIFICADAS", margin, y);
  y += 3;

  const ncRows: any[] = [];
  fotosPer.forEach((r) => {
    const e = mapExt.get(r.extintor_id);
    const ncs: string[] = Array.isArray(r.nao_conformidades) ? r.nao_conformidades : [];
    if (ncs.length === 0) return;
    ncRows.push({
      data: String(r.inspecionado_em).slice(0, 10),
      ext: e?.numero ?? "—",
      area: e?.area ?? "—",
      origem: "Foto/IA",
      detalhe: ncs.join("; "),
      acao: "—",
    });
  });
  manuaisPer.forEach((r) => {
    if (r.conforme !== false) return;
    const e = mapExt.get(r.extintor_id);
    ncRows.push({
      data: r.data_inspecao,
      ext: e?.numero ?? "—",
      area: e?.area ?? "—",
      origem: "Manual",
      detalhe: r.nao_conformidade ?? r.observacoes ?? "—",
      acao: "—",
    });
  });
  ncRows.sort((a, b) => String(b.data).localeCompare(String(a.data)));

  if (ncRows.length === 0) {
    doc.setFont("helvetica", "italic"); doc.setFontSize(9);
    doc.text("Nenhuma não conformidade identificada no período. Parabéns!", margin, y + 4);
    y += 8;
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: "grid",
      head: [["Data", "Extintor", "Área", "Origem", "Descrição da NC", "5W2H"]],
      body: ncRows.map((r) => [fmtBR(r.data), String(r.ext), String(r.area), r.origem, String(r.detalhe), r.acao]),
      styles: { fontSize: 7.5, cellPadding: 1.4, lineColor: [0, 0, 0], lineWidth: 0.15, overflow: "linebreak", valign: "top" },
      headStyles: { fillColor: [185, 28, 28], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.5 },
      columnStyles: {
        0: { cellWidth: 22, halign: "center" },
        1: { cellWidth: 22, halign: "center", fontStyle: "bold" },
        2: { cellWidth: 34 },
        3: { cellWidth: 18, halign: "center" },
        4: { cellWidth: contentW - 22 - 22 - 34 - 18 - 22 },
        5: { cellWidth: 22, halign: "center" },
      },
      didDrawPage: () => drawHeader(),
    });
    y = (doc as any).lastAutoTable.finalY + 5;
  }

  // ===== Rodapé legal em todas as páginas =====
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(100);
    doc.text(
      "Relatório gerado automaticamente pelo SIGMO. Documento de evidência para auditorias internas/externas (ISO 9001, ISO 45001), " +
      "Corpo de Bombeiros e seguradoras. Conforme ABNT NBR 12962 e NR-23.",
      margin, pageH - 8, { maxWidth: contentW },
    );
    doc.text(`Página ${i} de ${total}`, pageW - margin, pageH - 4, { align: "right" });
    doc.setTextColor(0);
  }

  return doc;
}