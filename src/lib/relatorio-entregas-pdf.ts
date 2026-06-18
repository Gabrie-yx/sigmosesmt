import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type EntregaRow = {
  data_entrega: string; // ISO
  epi_nome: string;
  epi_codigo: string;
  ca: string | null;
  nome_colaborador: string;
  cpf_colaborador: string;
  quantidade: number;
};

export type RelatorioEntregasOpts = {
  rows: EntregaRow[];
  inicio: string; // YYYY-MM-DD
  fim: string;
  agrupamento: "semanal" | "mensal";
  filtroEpi?: string | null;
  responsavel?: string | null;
};

function brDate(s: string) {
  const d = new Date(s);
  return d.toLocaleDateString("pt-BR");
}
function brDateOnly(s: string) {
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

// Segunda-feira como início da semana (ISO)
function weekKey(iso: string): { key: string; label: string } {
  const d = new Date(iso);
  const day = (d.getDay() + 6) % 7; // 0 = segunda
  const monday = new Date(d);
  monday.setDate(d.getDate() - day);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const key = monday.toISOString().slice(0, 10);
  const label = `Semana de ${monday.toLocaleDateString("pt-BR")} a ${sunday.toLocaleDateString("pt-BR")}`;
  return { key, label };
}
function monthKey(iso: string): { key: string; label: string } {
  const d = new Date(iso);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }).replace(/^./, (c) => c.toUpperCase());
  return { key, label };
}

export function buildRelatorioEntregasPdf(opts: RelatorioEntregasOpts): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 12;

  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, W, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("RELATÓRIO DE ENTREGAS DE EPI", M, 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(`Emitido em ${new Date().toLocaleString("pt-BR")}`, W - M, 11, { align: "right" });

  doc.setTextColor(0, 0, 0);
  let y = 23;
  doc.setFontSize(8);
  const meta: string[] = [];
  meta.push(`Período: ${brDateOnly(opts.inicio)} a ${brDateOnly(opts.fim)}`);
  meta.push(`Agrupamento: ${opts.agrupamento === "semanal" ? "Semanal" : "Mensal"}`);
  if (opts.filtroEpi) meta.push(`EPI: ${opts.filtroEpi}`);
  if (opts.responsavel) meta.push(`Responsável: ${opts.responsavel}`);
  doc.text(meta.join("   ·   "), M, y);
  y += 4;

  // Agrupar
  const groupOf = opts.agrupamento === "semanal" ? weekKey : monthKey;
  const buckets = new Map<string, { label: string; rows: EntregaRow[]; total: number }>();
  for (const r of opts.rows) {
    const { key, label } = groupOf(r.data_entrega);
    let b = buckets.get(key);
    if (!b) { b = { label, rows: [], total: 0 }; buckets.set(key, b); }
    b.rows.push(r);
    b.total += r.quantidade ?? 0;
  }
  const sortedKeys = Array.from(buckets.keys()).sort();

  const totalGeral = opts.rows.reduce((a, r) => a + (r.quantidade ?? 0), 0);
  doc.setFont("helvetica", "bold");
  doc.text(
    `Total de entregas no período: ${opts.rows.length} registros · ${totalGeral} unidade(s)`,
    M, y,
  );
  y += 2;

  // Tabela resumo por grupo
  autoTable(doc, {
    startY: y + 2,
    margin: { left: M, right: M, bottom: 14 },
    head: [["Período", "Registros", "Unidades entregues"]],
    body: sortedKeys.map((k) => {
      const b = buckets.get(k)!;
      return [b.label, String(b.rows.length), String(b.total)];
    }),
    foot: [["TOTAL", String(opts.rows.length), String(totalGeral)]],
    styles: { font: "helvetica", fontSize: 9, cellPadding: 1.8 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, halign: "center" },
    footStyles: { fillColor: [226, 232, 240], textColor: 0, fontStyle: "bold" },
    columnStyles: {
      1: { halign: "center", cellWidth: 30 },
      2: { halign: "center", cellWidth: 45, fontStyle: "bold" },
    },
    didDrawPage: () => {
      const page = doc.getNumberOfPages();
      doc.setFontSize(7); doc.setTextColor(120);
      doc.text(`SIGMO · Relatório de Entregas EPI · página ${page}`, W / 2, H - 6, { align: "center" });
      doc.setTextColor(0);
    },
  });

  // Detalhamento por grupo
  for (const k of sortedKeys) {
    const b = buckets.get(k)!;
    const lastY = (doc as any).lastAutoTable?.finalY ?? y;
    let startY = lastY + 8;
    if (startY > H - 30) { doc.addPage(); startY = M + 6; }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setFillColor(241, 245, 249);
    doc.rect(M, startY - 4, W - 2 * M, 6, "F");
    doc.text(`${b.label}   —   ${b.rows.length} entrega(s) · ${b.total} un.`, M + 2, startY);

    autoTable(doc, {
      startY: startY + 3,
      margin: { left: M, right: M, bottom: 14 },
      head: [["Data", "EPI", "CA", "Colaborador", "CPF", "Qtd"]],
      body: b.rows
        .slice()
        .sort((a, c) => a.data_entrega.localeCompare(c.data_entrega))
        .map((r) => [
          brDate(r.data_entrega),
          r.epi_nome,
          r.ca ?? "—",
          r.nome_colaborador || "—",
          r.cpf_colaborador || "—",
          String(r.quantidade ?? 0),
        ]),
      styles: { font: "helvetica", fontSize: 7.5, cellPadding: 1.2 },
      headStyles: { fillColor: [71, 85, 105], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 22, halign: "center" },
        2: { cellWidth: 18, halign: "center" },
        4: { cellWidth: 26 },
        5: { cellWidth: 12, halign: "center", fontStyle: "bold" },
      },
    });
  }

  // Assinatura
  const finalY = (doc as any).lastAutoTable?.finalY ?? y;
  let sy = finalY + 14;
  if (sy > H - 25) { doc.addPage(); sy = M + 20; }
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.line(M + 20, sy, M + 90, sy);
  doc.line(W - M - 90, sy, W - M - 20, sy);
  doc.setFontSize(8);
  doc.text("Responsável SESMT", M + 30, sy + 4);
  doc.text("Visto / Gestão", W - M - 70, sy + 4);

  return doc;
}

export function downloadRelatorioEntregasPdf(opts: RelatorioEntregasOpts) {
  const doc = buildRelatorioEntregasPdf(opts);
  doc.save(`relatorio-entregas-epi-${opts.inicio}-a-${opts.fim}.pdf`);
}