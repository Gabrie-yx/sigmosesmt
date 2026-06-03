import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

type Acidente = {
  data_acidente: string;
  tipo: string;
  vitima_nome?: string | null;
  vitima_setor?: string | null;
  vitima_cargo?: string | null;
  parte_corpo_atingida?: string | null;
  natureza_lesao?: string | null;
  dias_perdidos?: number | null;
  dias_debitados?: number | null;
  numero_cat?: string | null;
  local_acidente?: string | null;
  descricao?: string | null;
  agente_causador?: string | null;
  cid?: string | null;
};

type Hht = { ano: number; mes: number; hht: number | string };

type DiasRow = {
  dias_sem_com_afast: number | null;
  dias_sem_registravel: number | null;
  ultimo_acidente_com_afast: string | null;
  ultimo_acidente_registravel: string | null;
  recorde_com_afast: number | null;
  recorde_registravel: number | null;
};

function header(doc: jsPDF, titulo: string, codigo: string) {
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("SIGMO · Sistema de Gestão de SST", 14, 14);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`${codigo} — ${titulo}`, 14, 20);
  doc.text(`Emitido em ${new Date().toLocaleDateString("pt-BR")}`, doc.internal.pageSize.getWidth() - 14, 14, { align: "right" });
  doc.setLineWidth(0.4);
  doc.line(14, 23, doc.internal.pageSize.getWidth() - 14, 23);
}

function footer(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      `Página ${i} de ${pages} · NBR 14280 · Documento gerado eletronicamente pelo SIGMO`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: "center" }
    );
    doc.setTextColor(0);
  }
}

/** FOR-SEG 09 — Quadro Estatístico Anual de Acidentes */
export function gerarForSeg09(opts: {
  ano: number;
  acidentes: Acidente[];
  hht: Hht[];
  empresa?: string;
}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  header(doc, `Quadro Estatístico Anual de Acidentes — ${opts.ano}`, "FOR-SEG 09");

  doc.setFontSize(9);
  doc.text(`Empresa: ${opts.empresa || "Todas as empresas"}`, 14, 30);

  // === Tabela mensal ===
  const rowsMes = MESES.map((m, i) => {
    const acidsMes = opts.acidentes.filter(a => {
      const d = new Date(a.data_acidente);
      return d.getFullYear() === opts.ano && d.getMonth() === i;
    });
    const com = acidsMes.filter(a => a.tipo === "COM_AFASTAMENTO" || a.tipo === "FATAL").length;
    const sem = acidsMes.filter(a => a.tipo === "SEM_AFASTAMENTO").length;
    const traj = acidsMes.filter(a => a.tipo === "TRAJETO").length;
    const fat = acidsMes.filter(a => a.tipo === "FATAL").length;
    const dp = acidsMes.reduce((s, a) => s + (a.dias_perdidos || 0) + (a.dias_debitados || 0), 0);
    const hhtMes = opts.hht.filter(h => h.ano === opts.ano && h.mes === i + 1)
      .reduce((s, h) => s + Number(h.hht || 0), 0);
    const tf = hhtMes > 0 ? ((com * 1_000_000) / hhtMes).toFixed(2) : "—";
    const tg = hhtMes > 0 ? ((dp * 1_000_000) / hhtMes).toFixed(2) : "—";
    return [m, hhtMes.toLocaleString("pt-BR"), com, sem, traj, fat, acidsMes.length, dp, tf, tg];
  });

  // Totais
  const totC = rowsMes.reduce((s, r) => s + (r[3] as number), 0);
  const totS = rowsMes.reduce((s, r) => s + (r[4] as number), 0);
  const totT = rowsMes.reduce((s, r) => s + (r[5] as number), 0);
  const totF = rowsMes.reduce((s, r) => s + (r[6] as number), 0);
  const totGeral = rowsMes.reduce((s, r) => s + (r[7] as number), 0);
  const totDP = rowsMes.reduce((s, r) => s + (r[8] as number), 0);
  const totHHT = opts.hht.filter(h => h.ano === opts.ano).reduce((s, h) => s + Number(h.hht || 0), 0);
  const tfAno = totHHT > 0 ? ((totC * 1_000_000) / totHHT).toFixed(2) : "—";
  const tgAno = totHHT > 0 ? ((totDP * 1_000_000) / totHHT).toFixed(2) : "—";

  autoTable(doc, {
    startY: 34,
    head: [["Mês","HHT","C/ Afast.","S/ Afast.","Trajeto","Fatal","Total","Dias Perd.","TF","TG"]],
    body: [
      ...rowsMes,
      [
        { content: "TOTAL", styles: { fontStyle: "bold" } },
        { content: totHHT.toLocaleString("pt-BR"), styles: { fontStyle: "bold" } },
        { content: totC, styles: { fontStyle: "bold" } },
        { content: totS, styles: { fontStyle: "bold" } },
        { content: totT, styles: { fontStyle: "bold" } },
        { content: totF, styles: { fontStyle: "bold" } },
        { content: totGeral, styles: { fontStyle: "bold" } },
        { content: totDP, styles: { fontStyle: "bold" } },
        { content: tfAno, styles: { fontStyle: "bold", textColor: [220, 38, 38] } },
        { content: tgAno, styles: { fontStyle: "bold", textColor: [220, 38, 38] } },
      ],
    ],
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    styles: { halign: "center" },
    columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
    theme: "grid",
  });

  // Legenda fórmulas
  // @ts-expect-error lastAutoTable injected by plugin
  const yAfterTable = (doc.lastAutoTable?.finalY ?? 80) + 6;
  doc.setFontSize(8);
  doc.setTextColor(80);
  doc.text("TF = (Acidentes c/ afastamento × 1.000.000) ÷ HHT    |    TG = (Dias perdidos+debitados × 1.000.000) ÷ HHT", 14, yAfterTable);
  doc.setTextColor(0);

  // === Lista detalhada (acidentes do ano) ===
  const listaAno = opts.acidentes
    .filter(a => new Date(a.data_acidente).getFullYear() === opts.ano)
    .sort((a, b) => a.data_acidente.localeCompare(b.data_acidente));

  if (listaAno.length) {
    doc.addPage();
    header(doc, `Detalhamento dos acidentes — ${opts.ano}`, "FOR-SEG 09");
    autoTable(doc, {
      startY: 28,
      head: [["Data","CAT","Tipo","Vítima","Setor","Parte do corpo","Natureza","Dias"]],
      body: listaAno.map(a => [
        new Date(a.data_acidente).toLocaleDateString("pt-BR"),
        a.numero_cat || "—",
        a.tipo.replace("_"," "),
        a.vitima_nome || "—",
        a.vitima_setor || "—",
        a.parte_corpo_atingida || "—",
        a.natureza_lesao || "—",
        String((a.dias_perdidos || 0) + (a.dias_debitados || 0)),
      ]),
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      styles: { cellPadding: 1.5 },
      theme: "grid",
    });
  }

  // Assinatura
  doc.addPage();
  header(doc, "Aprovação e Assinatura", "FOR-SEG 09");
  doc.setFontSize(10);
  doc.text("Elaborado pelo SESMT — Serviço Especializado em Segurança e Medicina do Trabalho", 14, 50);
  doc.text(`Período de referência: Janeiro a Dezembro de ${opts.ano}`, 14, 60);

  doc.line(30, 130, 130, 130);
  doc.text("Técnico de Segurança do Trabalho", 80, 136, { align: "center" });

  doc.line(170, 130, 270, 130);
  doc.text("Arteniza — Responsável SESMT", 220, 136, { align: "center" });

  footer(doc);
  doc.save(`FOR-SEG-09_Quadro-Estatistico_${opts.ano}.pdf`);
}

/** FOR-SEG 10 — Dias sem Acidente */
export function gerarForSeg10(opts: {
  empresas: { id: string; name: string }[];
  dias: (DiasRow & { company_id: string })[];
}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  header(doc, "Controle de Dias sem Acidente de Trabalho", "FOR-SEG 10");

  doc.setFontSize(9);
  doc.text(`Data de emissão: ${new Date().toLocaleDateString("pt-BR")}`, 14, 30);

  const rows = opts.empresas.map(emp => {
    const d = opts.dias.find(x => x.company_id === emp.id);
    return [
      emp.name,
      d?.dias_sem_com_afast ?? "—",
      d?.ultimo_acidente_com_afast ? new Date(d.ultimo_acidente_com_afast).toLocaleDateString("pt-BR") : "Nenhum",
      d?.recorde_com_afast ?? 0,
      d?.dias_sem_registravel ?? "—",
      d?.ultimo_acidente_registravel ? new Date(d.ultimo_acidente_registravel).toLocaleDateString("pt-BR") : "Nenhum",
    ];
  });

  autoTable(doc, {
    startY: 36,
    head: [["Empresa / Unidade","Dias s/ Afast.","Último c/ Afast.","Recorde","Dias s/ Registr.","Último Registr."]],
    body: rows.length ? rows : [["Sem empresas cadastradas","—","—","—","—","—"]],
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    theme: "grid",
  });

  // @ts-expect-error lastAutoTable injected by plugin
  const y = (doc.lastAutoTable?.finalY ?? 100) + 12;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Metodologia (NBR 14280):", 14, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const linhas = [
    "• Contador zera somente em acidente COM AFASTAMENTO ou FATAL.",
    "• Recorde = maior intervalo histórico sem acidente registrável da unidade.",
    "• Atualização automática a cada novo registro lançado no sistema.",
  ];
  linhas.forEach((l, i) => doc.text(l, 14, y + 6 + i * 5));

  // Assinaturas
  doc.line(20, y + 60, 90, y + 60);
  doc.text("Técnico de Segurança", 55, y + 66, { align: "center" });
  doc.line(115, y + 60, 185, y + 60);
  doc.text("Arteniza — SESMT", 150, y + 66, { align: "center" });

  footer(doc);
  doc.save(`FOR-SEG-10_Dias-sem-Acidente_${new Date().toISOString().slice(0,10)}.pdf`);
}