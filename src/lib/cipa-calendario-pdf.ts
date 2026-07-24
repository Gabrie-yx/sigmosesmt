// FOR-SEG 11 — Calendário de Reuniões da CIPA (modelo homologado DMN).
// Layout fiel ao PDF original: título vermelho, tabela colorida (STATUS amarelo),
// legenda R/P/RP/NC e rodapé de aprovação. Header direito com selo CIPA + código.
import jsPDF from "jspdf";
import dmnLogo from "@/assets/dmn-logo.png";

export type CipaCalendarioLinha = {
  numero: number;
  mes: string;
  horario: string;
  status: "R" | "P" | "RP" | "NC";
  reprogramado: string;
  statusReprog: "" | "R" | "P" | "RP" | "NC";
};

export type CipaCalendarioParams = {
  razaoSocial: string;
  gestao: string; // ex.: "2024/2025"
  linhas: CipaCalendarioLinha[];
  dataEmissao?: string;
  dataRevisao?: string;
  elaboradoPor?: string;
  aprovadoPor?: string;
  revisao?: string; // ex.: "00"
};

const STATUS_LABEL: Record<CipaCalendarioLinha["status"], string> = {
  R: "R - REALIZADO",
  P: "P - PROGRAMADO",
  RP: "RP - REPROGRAMADO",
  NC: "NC - NÃO CONFORME",
};

const STATUS_FILL: Record<CipaCalendarioLinha["status"], [number, number, number]> = {
  R: [146, 208, 80],   // verde
  P: [255, 255, 0],    // amarelo
  RP: [237, 125, 49],  // laranja
  NC: [255, 0, 0],     // vermelho
};

function fmt(d?: string) {
  if (!d) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return d;
}

/** Desenha um selo circular "CIPA +" (verde) simulando o carimbo do modelo. */
function drawCipaBadge(doc: jsPDF, cx: number, cy: number, r: number) {
  // círculo externo verde
  doc.setFillColor(0, 130, 60);
  doc.circle(cx, cy, r, "F");
  // círculo interno branco
  doc.setFillColor(255, 255, 255);
  doc.circle(cx, cy, r - 1.2, "F");
  // cruz verde
  const cw = r * 0.9;
  const ct = r * 0.28;
  doc.setFillColor(0, 130, 60);
  doc.rect(cx - ct / 2, cy - cw / 2, ct, cw, "F");
  doc.rect(cx - cw / 2, cy - ct / 2, cw, ct, "F");
  // texto CIPA sobreposto (branco em cima da cruz)
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(4.2);
  doc.text("CIPA", cx, cy - r * 0.15, { align: "center" });
  doc.setFontSize(2.8);
  doc.text("SEGURANÇA", cx, cy + r * 0.55, { align: "center" });
}

export function buildCipaCalendarioPdf(p: CipaCalendarioParams): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 8;

  // ================= HEADER =================
  const headerH = 22;
  // moldura externa do header
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(M, M, W - 2 * M, headerH);

  // coluna esquerda: logo
  const logoBoxW = 40;
  doc.line(M + logoBoxW, M, M + logoBoxW, M + headerH);
  try {
    doc.addImage(dmnLogo as unknown as string, "PNG", M + 4, M + 3, logoBoxW - 8, headerH - 6, undefined, "FAST");
  } catch {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(178, 34, 34);
    doc.text("DMN", M + logoBoxW / 2, M + headerH / 2 + 2, { align: "center" });
  }

  // coluna direita: código/revisão/data/pág
  const codeBoxW = 60;
  const codeX = W - M - codeBoxW;
  doc.line(codeX, M, codeX, M + headerH);
  const badgeBoxW = 22;
  doc.line(codeX - badgeBoxW, M, codeX - badgeBoxW, M + headerH);

  // selo CIPA
  drawCipaBadge(doc, codeX - badgeBoxW / 2, M + headerH / 2, headerH / 2 - 2);

  // texto do bloco de código
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const codeLineH = headerH / 4;
  const cxText = codeX + 3;
  doc.text(`CÓD.: FOR-SEG 11`, cxText, M + codeLineH - 1);
  doc.text(`REVISÃO:${p.revisao ?? "00"}`, cxText, M + codeLineH * 2 - 1);
  doc.text(`DATA: ${fmt(p.dataEmissao) || new Date().toLocaleDateString("pt-BR")}`, cxText, M + codeLineH * 3 - 1);
  doc.text(`PÁG.: 01/01`, cxText, M + codeLineH * 4 - 1);

  // título central (vermelho, 2 linhas)
  doc.setTextColor(220, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  const tituloX = M + logoBoxW + (codeX - badgeBoxW - (M + logoBoxW)) / 2;
  doc.text(`Calendário de Reuniões da CIPA ${p.razaoSocial}`, tituloX, M + 10, { align: "center" });
  doc.text(p.gestao, tituloX, M + 17, { align: "center" });

  // ================= TABELA =================
  let y = M + headerH;
  const cols = [
    { key: "num", label: "Nº. REUNIÃO", w: 40 },
    { key: "mes", label: "MÊS", w: 45 },
    { key: "hora", label: "HORÁRIO", w: 40 },
    { key: "status", label: "STATUS", w: 55 },
    { key: "reprog", label: "REPROGRAMADO", w: 50 },
    { key: "statusRp", label: "STATUS DA REPROGRAMAÇÃO", w: 0 },
  ];
  const usadaCols = cols.reduce((s, c) => s + c.w, 0);
  cols[cols.length - 1].w = W - 2 * M - usadaCols;

  // header da tabela (azul claro)
  const rowH = 10;
  doc.setFillColor(180, 199, 231);
  doc.rect(M, y, W - 2 * M, rowH, "F");
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  doc.rect(M, y, W - 2 * M, rowH);
  let cx = M;
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  for (const c of cols) {
    doc.rect(cx, y, c.w, rowH);
    doc.text(c.label, cx + c.w / 2, y + rowH / 2 + 1.5, { align: "center" });
    cx += c.w;
  }
  y += rowH;

  // linhas
  const linhas = p.linhas.length ? p.linhas : Array.from({ length: 12 }, (_, i) => ({
    numero: i + 1, mes: "", horario: "", status: "P" as const, reprogramado: "", statusReprog: "" as const,
  }));
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  for (const l of linhas) {
    if (y + rowH > H - 40) { doc.addPage(); y = M; }
    cx = M;
    // borda da linha
    doc.rect(M, y, W - 2 * M, rowH);
    // colunas
    const vals = [String(l.numero), l.mes, l.horario, STATUS_LABEL[l.status], l.reprogramado, l.statusReprog ? STATUS_LABEL[l.statusReprog] : ""];
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i];
      // fill STATUS (col 3) e STATUS DA REPROGRAMAÇÃO (col 5)
      if (i === 3) {
        const f = STATUS_FILL[l.status];
        doc.setFillColor(f[0], f[1], f[2]);
        doc.rect(cx, y, c.w, rowH, "F");
      } else if (i === 5 && l.statusReprog) {
        const f = STATUS_FILL[l.statusReprog];
        doc.setFillColor(f[0], f[1], f[2]);
        doc.rect(cx, y, c.w, rowH, "F");
      }
      doc.setDrawColor(0, 0, 0);
      doc.rect(cx, y, c.w, rowH);
      doc.setTextColor(i === 3 || (i === 5 && l.statusReprog) ? 0 : 30);
      const bold = i === 3 || (i === 5 && l.statusReprog);
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.text(vals[i] ?? "", cx + c.w / 2, y + rowH / 2 + 1.5, { align: "center" });
      cx += c.w;
    }
    y += rowH;
  }

  // ================= LEGENDA =================
  y += 6;
  const legItems: { label: string; fill: [number, number, number] }[] = [
    { label: "R - REALIZADO", fill: STATUS_FILL.R },
    { label: "P - PROGRAMADO", fill: STATUS_FILL.P },
    { label: "RP - REPROGRAMADO", fill: STATUS_FILL.RP },
    { label: "NC - NÃO CONFORME", fill: STATUS_FILL.NC },
  ];
  const legTotalW = W - 2 * M;
  const legLabelW = 40;
  const legCellW = (legTotalW - legLabelW) / legItems.length;
  const legH = 8;
  // "LEGENDA"
  doc.setDrawColor(0, 0, 0);
  doc.rect(M, y, legLabelW, legH);
  doc.setFillColor(255, 255, 255);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("LEGENDA", M + legLabelW / 2, y + legH / 2 + 1.5, { align: "center" });
  let lx = M + legLabelW;
  for (const it of legItems) {
    doc.setFillColor(it.fill[0], it.fill[1], it.fill[2]);
    doc.rect(lx, y, legCellW, legH, "F");
    doc.rect(lx, y, legCellW, legH);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(it.label, lx + legCellW / 2, y + legH / 2 + 1.5, { align: "center" });
    lx += legCellW;
  }
  y += legH;

  // ================= RODAPÉ APROVAÇÃO =================
  const footCols = [
    { label: "Data de emissão", value: fmt(p.dataEmissao) },
    { label: "Data Revisão", value: fmt(p.dataRevisao) },
    { label: "Elaborado por:", value: p.elaboradoPor ?? "" },
    { label: "", value: "" },
    { label: "Aprovado por:", value: p.aprovadoPor ?? "" },
    { label: "", value: "" },
  ];
  const footW = (W - 2 * M) / footCols.length;
  const footH1 = 6;
  const footH2 = 12;
  let fx = M;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  for (const c of footCols) {
    doc.rect(fx, y, footW, footH1);
    doc.text(c.label, fx + footW / 2, y + footH1 / 2 + 1.5, { align: "center" });
    fx += footW;
  }
  fx = M;
  doc.setFont("helvetica", "normal");
  for (const c of footCols) {
    doc.rect(fx, y + footH1, footW, footH2);
    if (c.value) doc.text(c.value, fx + footW / 2, y + footH1 + footH2 / 2 + 1.5, { align: "center" });
    fx += footW;
  }

  return doc;
}