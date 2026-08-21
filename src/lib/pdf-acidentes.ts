import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import dmnLogoAsset from "@/assets/dmn-logo-acidentes-v2.png.asset.json";
import { EMPRESA_INFO } from "./empresa-info";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export type QuadroAcidente = {
  data_acidente: string;
  tipo: string;
  dias_perdidos?: number | null;
  dias_debitados?: number | null;
  company_id?: string | null;
};

export type QuadroHht = {
  ano: number;
  mes: number;
  hht: number | string;
  empregados_medio?: number | null;
  company_id?: string | null;
};

type Acidente = QuadroAcidente;
type Hht = QuadroHht;

export type LinhaQuadro = {
  label: string;
  empregados: number;
  hht: number;
  absoluto: number;
  afastLeve: number;
  afastGrave: number;
  semAfast: number;
  indiceRelativo: number;
  diasPerdidos: number;
  tf: number;
  tg: number;
  obitos: number;
};

const isComAfast = (t: string) => t === "COM_AFASTAMENTO" || t === "FATAL";
/** NBR 14280 / NR-04: acidente de trajeto não entra no quadro de acidentes típicos. */
const isTipico = (t: string) => t !== "TRAJETO";

function num(v: unknown) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function montaLinha(label: string, acids: Acidente[], hhtRows: Hht[]): LinhaQuadro {
  const tipicos = acids.filter((a) => isTipico(a.tipo));
  const comAfast = tipicos.filter((a) => isComAfast(a.tipo));
  const dias = (a: Acidente) => num(a.dias_perdidos) + num(a.dias_debitados);
  const hht = hhtRows.reduce((s, h) => s + num(h.hht), 0);
  const empregados = hhtRows.reduce((s, h) => s + num(h.empregados_medio), 0);
  const diasPerdidos = tipicos.reduce((s, a) => s + dias(a), 0);
  return {
    label,
    empregados,
    hht,
    absoluto: tipicos.length,
    afastLeve: comAfast.filter((a) => dias(a) <= 15).length,
    afastGrave: comAfast.filter((a) => dias(a) > 15).length,
    semAfast: tipicos.filter((a) => a.tipo === "SEM_AFASTAMENTO").length,
    indiceRelativo: empregados > 0 ? tipicos.length / empregados : 0,
    diasPerdidos,
    tf: hht > 0 ? (comAfast.length * 1_000_000) / hht : 0,
    tg: hht > 0 ? (diasPerdidos * 1_000_000) / hht : 0,
    obitos: tipicos.filter((a) => a.tipo === "FATAL").length,
  };
}

/** Cálculo oficial do quadro (NBR 14280) — usado pela tela e pelo PDF. */
export function calcularQuadroEstatistico(
  ano: number,
  acidentes: Acidente[],
  hht: Hht[],
): { meses: LinhaQuadro[]; total: LinhaQuadro } {
  const acidsAno = acidentes.filter((a) => {
    const d = new Date(`${String(a.data_acidente).slice(0, 10)}T00:00:00`);
    return d.getFullYear() === ano;
  });
  const hhtAno = hht.filter((h) => Number(h.ano) === ano);

  const meses = MESES.map((m, i) =>
    montaLinha(
      m,
      acidsAno.filter(
        (a) => new Date(`${String(a.data_acidente).slice(0, 10)}T00:00:00`).getMonth() === i,
      ),
      hhtAno.filter((h) => Number(h.mes) === i + 1),
    ),
  );

  const total = montaLinha("Total", acidsAno, hhtAno);
  // Nº médio de empregados no ano = média dos meses com lançamento de HHT
  const mesesComDado = meses.filter((m) => m.empregados > 0);
  total.empregados = mesesComDado.length
    ? Math.round(mesesComDado.reduce((s, m) => s + m.empregados, 0) / mesesComDado.length)
    : 0;
  total.indiceRelativo = total.empregados > 0 ? total.absoluto / total.empregados : 0;

  return { meses, total };
}

const n2 = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type DiasRow = {
  dias_sem_com_afast: number | null;
  dias_sem_registravel: number | null;
  ultimo_acidente_com_afast: string | null;
  ultimo_acidente_registravel: string | null;
  recorde_com_afast: number | null;
  recorde_registravel: number | null;
};


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

export type EmpresaQuadro = {
  nome?: string | null;
  cnpj?: string | null;
  endereco?: string | null;
  bairro?: string | null;
  cep?: string | null;
  cnae?: string | null;
  grau_risco?: string | null;
};

/** FOR-SEG 09 — Quadro Estatístico Anual de Acidentes (retorna o doc; nunca salva direto) */
export function gerarForSeg09(opts: {
  ano: number;
  acidentes: Acidente[];
  hht: Hht[];
  empresa?: EmpresaQuadro | string;
  responsavel?: string | null;
  /** compatibilidade com chamadas antigas */
  cnpj?: string;
  endereco?: string;
  bairro?: string;
  cep?: string;
  cnae?: string;
  grau_risco?: string;
}): jsPDF {
  const emp: EmpresaQuadro =
    typeof opts.empresa === "string" || opts.empresa == null
      ? {
          nome: (opts.empresa as string) || EMPRESA_INFO.razao_social,
          cnpj: opts.cnpj,
          endereco: opts.endereco,
          bairro: opts.bairro,
          cep: opts.cep,
          cnae: opts.cnae,
          grau_risco: opts.grau_risco,
        }
      : opts.empresa;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // ===== Cabeçalho rígido FOR-SEG 09 =====
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(10, 10, pageWidth - 20, 25);
  doc.line(60, 10, 60, 35);
  doc.line(pageWidth - 65, 10, pageWidth - 65, 35);

  try {
    doc.addImage(dmnLogoAsset.url, "PNG", 15, 12, 40, 20);
  } catch {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("DMN", 35, 20, { align: "center" });
    doc.setFontSize(8);
    doc.text("ESTALEIRO", 35, 25, { align: "center" });
  }

  doc.setFont("times", "bold");
  doc.setFontSize(18);
  doc.text("Quadro Estatístico de Acidentes de Trabalho", pageWidth / 2 - 2, 24, { align: "center" });
  doc.setFont("times", "normal");
  doc.setFontSize(10);
  doc.text(`Exercício ${opts.ano}`, pageWidth / 2 - 2, 30, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  const rightX = pageWidth - 63;
  doc.text("CÓG.:", rightX, 16);
  doc.text("REVISÃO:", rightX, 21);
  doc.text("DATA:", rightX, 26);
  doc.text("PÁG.:", rightX, 31);
  doc.setFont("helvetica", "normal");
  doc.text("FOR-SEG 09", rightX + 16, 16);
  doc.text("00", rightX + 16, 21);
  doc.text("30/08/2025", rightX + 16, 26);
  doc.text("01/01", rightX + 16, 31);

  // Faixa
  doc.setFillColor(180, 180, 180);
  doc.rect(10, 35, pageWidth - 20, 5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text("ACIDENTES COM VÍTIMA", pageWidth / 2, 38.5, { align: "center" });

  // ===== Identificação da empresa =====
  doc.setFontSize(9);
  doc.setLineWidth(0.2);
  doc.rect(10, 42, pageWidth - 20, 26);
  doc.line(10, 48.5, pageWidth - 10, 48.5);
  doc.line(10, 55, pageWidth - 10, 55);
  doc.line(10, 61.5, pageWidth - 10, 61.5);
  doc.line(pageWidth - 65, 61.5, pageWidth - 65, 68);

  const par = (labelX: number, label: string, valueX: number, value: string, y: number) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, labelX, y);
    doc.setFont("helvetica", "normal");
    doc.text(value || "—", valueX, y);
  };

  const bairroMatch = EMPRESA_INFO.endereco.match(/—\s*(.*)$/);
  const cepMatch = EMPRESA_INFO.cidade_uf_cep.match(/CEP\s*([\d.-]+)/);

  par(12, "Empresa:", 30, emp.nome || EMPRESA_INFO.razao_social, 46);
  par(12, "CNPJ:", 30, emp.cnpj || EMPRESA_INFO.cnpj, 52.5);
  par(12, "Endereço:", 30, emp.endereco || EMPRESA_INFO.endereco, 59);
  par(117, "Bairro:", 130, emp.bairro || (bairroMatch ? bairroMatch[1] : "DISTRITO INDUSTRIAL II"), 59);
  par(pageWidth - 63, "CEP:", pageWidth - 48, emp.cep || (cepMatch ? cepMatch[1] : "69.082-200"), 59);
  par(12, "CNAE:", 30, emp.cnae || "30.11-3-01", 65.5);
  par(67, "Grau de risco:", 92, emp.grau_risco || "03", 65.5);
  par(pageWidth - 63, "DATA:", pageWidth - 48, new Date().toLocaleDateString("pt-BR"), 65.5);

  // ===== Tabela =====
  const { meses, total } = calcularQuadroEstatistico(opts.ano, opts.acidentes, opts.hht);

  const linhaCells = (l: LinhaQuadro, bold: boolean) => {
    const style = bold
      ? { fontStyle: "bold" as const, fillColor: [190, 190, 190] as [number, number, number] }
      : undefined;
    const cell = (content: string) => (style ? { content, styles: style } : { content });
    return [
      style
        ? { content: l.label, styles: style }
        : { content: l.label, styles: { fontStyle: "bold" as const, fontSize: 10 } },
      cell(l.empregados ? String(l.empregados) : ""),
      cell(l.hht > 0 ? l.hht.toLocaleString("pt-BR") : ""),
      cell(String(l.absoluto)),
      cell(String(l.afastLeve)),
      cell(String(l.afastGrave)),
      cell(String(l.semAfast)),
      cell(n2(l.indiceRelativo)),
      cell(String(l.diasPerdidos)),
      cell(n2(l.tf)),
      cell(String(l.obitos)),
    ];
  };

  autoTable(doc, {
    startY: 72,
    margin: { left: 10, right: 10 },
    head: [[
      "Mês",
      "Número de empregados",
      "HHT",
      "Nº Absoluto",
      "Nº Absoluto com afastamento <= 15 dias",
      "Nº Absoluto com afastamento > 15 dias",
      "Nº Absoluto sem Afastamento",
      "Índice Relativo total de empregados",
      "Dias / homens Perdidos",
      "Taxa de frequência",
      "Óbitos",
    ]],
    body: [...meses.map((m) => linhaCells(m, false)), linhaCells(total, true)],
    headStyles: {
      fillColor: [180, 180, 180],
      textColor: 0,
      fontSize: 7,
      halign: "center",
      valign: "middle",
      lineWidth: 0.2,
      lineColor: 0,
      fontStyle: "bold",
      minCellHeight: 12,
    },
    bodyStyles: {
      fontSize: 8,
      halign: "center",
      valign: "middle",
      lineWidth: 0.2,
      lineColor: 0,
      minCellHeight: 7,
    },
    theme: "grid",
    styles: { overflow: "linebreak", cellPadding: 1, minCellWidth: 10 },
  });

  // @ts-expect-error lastAutoTable injected by plugin
  const afterTable = doc.lastAutoTable.finalY as number;

  // Indicadores consolidados (ISO 9001/45001 — análise crítica)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(
    `Taxa de Frequência (anual): ${n2(total.tf)}   |   Taxa de Gravidade (anual): ${n2(total.tg)}   |   HHT total: ${total.hht.toLocaleString("pt-BR")} h`,
    10,
    afterTable + 6,
  );
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(
    "TF = (acidentes com afastamento × 1.000.000) / HHT · TG = ((dias perdidos + debitados) × 1.000.000) / HHT — NBR 14280. Acidentes de trajeto não são computados no quadro de acidentes típicos.",
    10,
    afterTable + 10.5,
  );

  const finalY = afterTable + 22;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("RESPONSÁVEL:", 10, finalY);
  doc.line(38, finalY, 130, finalY);
  if (opts.responsavel) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(opts.responsavel, 40, finalY - 1.5);
  }

  return doc;
}


/** FOR-SEG 10 — Dias sem Acidente */
export function gerarForSeg10(opts: {
  empresas: { id: string; name: string }[];
  dias: (DiasRow & { company_id: string })[];
}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  const header = () => {
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.rect(10, 10, pageWidth - 20, 25);
    doc.line(60, 10, 60, 35);
    doc.line(pageWidth - 65, 10, pageWidth - 65, 35);
    
    try {
      doc.addImage(dmnLogoAsset.url, "PNG", 15, 12, 40, 20);
    } catch (e) {}
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Controle de Dias sem Acidente de Trabalho", (pageWidth / 2) - 2, 23, { align: "center" });
    
    doc.setFontSize(8);
    const rightX = pageWidth - 63;
    doc.text("CÓG.:", rightX, 16);
    doc.text("REVISÃO:", rightX, 21);
    doc.text("DATA:", rightX, 26);
    doc.text("PÁG.:", rightX, 31);
    
    doc.setFont("helvetica", "normal");
    doc.text("FOR-SEG 10", rightX + 15, 16);
    doc.text("00", rightX + 15, 21);
    doc.text(new Date().toLocaleDateString("pt-BR"), rightX + 15, 26);
    doc.text("01/01", rightX + 15, 31);
  };

  header();

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
    startY: 40,
    head: [["Empresa / Unidade","Dias s/ Afast.","Último c/ Afast.","Recorde","Dias s/ Registr.","Último Registr."]],
    body: rows.length ? rows : [["Sem empresas cadastradas","—","—","—","—","—"]],
    headStyles: { fillColor: [240, 240, 240], textColor: 0, fontSize: 9, fontStyle: "bold", halign: "center" },
    bodyStyles: { fontSize: 8, halign: "center" },
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
  doc.text("SESMT - Estaleiro DMN", 150, y + 66, { align: "center" });

  footer(doc);
  doc.save(`FOR-SEG-10_Dias-sem-Acidente_${new Date().toISOString().slice(0,10)}.pdf`);
}
