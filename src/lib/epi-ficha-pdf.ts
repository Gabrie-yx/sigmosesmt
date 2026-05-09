import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type EmpInfo = {
  nome?: string | null;
  cpf?: string | null;
  admissao?: string | null;
  matricula?: string | null;
};
type CompanyInfo = { name?: string | null };
type RoleInfo = { name?: string | null };
type EpiRow = {
  qtd?: number | null;
  item?: string | null;
  tamanho?: string | null;
  ca?: string | null;
  data_entrega?: string | null;
  data_devolucao?: string | null;
  observacoes?: string | null;
};

function brDate(s?: string | null) {
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR");
}

const MOTIVO_CODE: Record<string, string> = {
  "danificado": "1",
  "desgaste natural": "2",
  "extravio": "3",
  "mal uso": "4",
  "furto": "5",
  "uso temporário": "6",
  "uso temporario": "6",
  "temporário": "6",
  "temporario": "6",
};

function extractMotivo(obs?: string | null): string {
  if (!obs) return "";
  const m = obs.match(/motivo\s*:\s*([^—\-\n]+)/i);
  const raw = (m ? m[1] : obs).trim().toLowerCase();
  return MOTIVO_CODE[raw] ?? "";
}

const TERMO_INTRO =
  "Declaro para todos os efeitos legais que recebi da empresa ____________________________, os Equipamentos de proteção individual relacionados abaixo, para serem usados no desempenho de minhas funções, ciente das obrigações constantes na NR-06 da portaria 3214/78, subitem 6.6.1, que são:";
const TERMO_ITEMS = [
  "1 - Usar o fornecido pela organização, observado o disposto no item 6.5.2;",
  "2 - Utilizar apenas para a finalidade a que se destina;",
  "3 - Responsabilizar-se pela limpeza, guarda e conservação;",
  "4 - Comunicar à organização quando extraviado, danificado ou qualquer alteração que o torne impróprio para uso; e",
  "5 - Cumprir as determinações da organização sobre o uso adequado.",
  "6 - Reembolsarei a empresa em caso de perda ou dano, por atos de negligência ou mau uso;",
  "7 - Sou ciente das orientações e recomendações previstas ao uso de EPI;",
  "8 - Declaro ter obtido treinamento para utilização adequada dos EPIs e, ainda, conhecer a utilização dos mesmos é obrigatória, além de saber a maneira correta do uso, prazo de validade, bem como dos riscos que estou sujeito pelo não uso do equipamento de proteção individual;",
];
const TERMO_OUTRO =
  "Declaro também que me encontro ciente e coloco minha anuência as disposições do art.462 e 1a da CLT, autorizando o desconto proporcional ao custo da reparação do dano que eventualmente vier a provocar nos EPIs em questão, já que atesto tê-lo recebido em perfeitas condições, da disposição legal constante na NR-01, subitem 1.4.2.1, de que constitui ato faltoso e recusa injustificada de usar e EPI ora fornecido pela empresa incorrendo nas penalidades previstas em lei.";
const TERMO_CIENCIA = [
  "1 - Do que preconiza a NR-6 - item 6.6 e seus subitens.",
  "2 - Do que estabelece a CLT no Artigo 158 combinado à alinea H e Artigo 482;",
  "' A falta de uso dos EPI's fornecidos pela empregadora, constitui ato faltoso, sujeito às sanções disciplinares previstas na legislação, no Regulamento interno e nas Normas de Segurança da Empresa, aplicáveis, inclusive e especialmente, a demissão por justa causa;",
  "3 - A empregadora fica autorizada a descontar do meu salário, das gratificações ou de qualquer outra remuneração ou indenização a que tenho direito, os valores devidos aos EPIs e Uniformes, que estiverem sob minha guarda e por ventura forem extraviados e/ou danificados por dolo ou culpa;",
  "4 - É obrigatório, no ato do recebimento de um EPI, a entrega do correspondente usado, em poder do empregado;",
  "5 - É proibido o descarte de EPI's usados pelo colaborador, nas lixeiras ou em qualquer outro local. Deve-se entregar no setor de Segurança (atendendo o item anterior). Finalmente, declaro que estou de acordo com todos os termos da presente, razão pela qual assino por livre e espontânea vontade.",
];

export function buildEpiFichaPdf(opts: {
  emp: EmpInfo;
  company: CompanyInfo | null;
  role: RoleInfo | null;
  epis: EpiRow[];
}) {
  const { emp, company, role, epis } = opts;
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 8;

  /* ============ PAGE 1 — Front ============ */
  // Header bar
  doc.setDrawColor(0); doc.setLineWidth(0.3);
  doc.rect(M, M, W - 2 * M, 14);
  // Logo placeholder
  doc.rect(M, M, 32, 14);
  doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text("DMN", M + 16, M + 6, { align: "center" });
  doc.setFontSize(7); doc.setFont("helvetica", "normal");
  doc.text("ESTALEIRO", M + 16, M + 11, { align: "center" });
  // Title
  doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  doc.text("FICHA DE CONTROLE E REGISTRO DE ENTREGA DE EPI's", W / 2, M + 9, { align: "center" });
  // Code box
  const codeX = W - M - 50;
  doc.rect(codeX, M, 50, 14);
  doc.setFontSize(7); doc.setFont("helvetica", "normal");
  doc.text("CÓD: FOR-SEG 02", codeX + 2, M + 3.5);
  doc.text("REVISÃO: 30/08/2025", codeX + 2, M + 7);
  doc.text(`DATA: ${new Date().toLocaleDateString("pt-BR")}`, codeX + 2, M + 10.5);
  doc.text("PÁG.: 01/02", codeX + 2, M + 13.5);

  let y = M + 14;

  // Info fields
  const fieldH = 7;
  const drawField = (x: number, w: number, label: string, value: string) => {
    doc.setFillColor(220, 230, 241); doc.rect(x, y, 22, fieldH, "FD");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8);
    doc.text(label, x + 1.5, y + fieldH / 2 + 1);
    doc.rect(x + 22, y, w - 22, fieldH);
    doc.setFont("helvetica", "normal");
    doc.text(value, x + 23, y + fieldH / 2 + 1);
  };

  // Row 1: Empresa | Data Admissão
  drawField(M, (W - 2 * M) * 0.65, "Empresa:", company?.name ?? "");
  drawField(M + (W - 2 * M) * 0.65, (W - 2 * M) * 0.35, "Data de Admissão:", brDate(emp.admissao));
  y += fieldH;

  // Row 2: Nome | Data Demissão
  drawField(M, (W - 2 * M) * 0.65, "Nome:", emp.nome ?? "");
  drawField(M + (W - 2 * M) * 0.65, (W - 2 * M) * 0.35, "Data de Demissão:", "");
  y += fieldH;

  // Row 3: Função | CPF | Folha
  const w1 = (W - 2 * M) * 0.40, w2 = (W - 2 * M) * 0.25, w3 = (W - 2 * M) * 0.35;
  drawField(M, w1, "Função:", role?.name ?? "");
  drawField(M + w1, w2, "CPF:", emp.cpf ?? "");
  drawField(M + w1 + w2, w3, "Folha:", emp.matricula ?? "");
  y += fieldH;

  // Termo de Responsabilidade title bar
  doc.setFillColor(220, 220, 220);
  doc.rect(M, y, W - 2 * M, 6, "FD");
  doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text("TERMO DE RESPONSABILIDADE", W / 2, y + 4.2, { align: "center" });
  y += 6;

  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  const writeText = (txt: string, lh = 3.6, bg?: [number, number, number]) => {
    const lines = doc.splitTextToSize(txt, W - 2 * M - 4);
    const h = lines.length * lh + 1.5;
    if (bg) { doc.setFillColor(bg[0], bg[1], bg[2]); doc.rect(M, y, W - 2 * M, h, "F"); }
    doc.text(lines, M + 2, y + lh);
    y += h;
  };

  writeText(TERMO_INTRO);
  TERMO_ITEMS.forEach((t) => writeText(t, 3.6, [220, 230, 241]));
  writeText(TERMO_OUTRO);
  doc.setFont("helvetica", "normal");
  writeText("Declaro ainda, ter plena ciência:");
  TERMO_CIENCIA.forEach((t) => writeText(t, 3.6, [220, 230, 241]));

  /* ============ PAGE 2 — Back ============ */
  doc.addPage();
  let y2 = M;

  // Motivo da Substituição header
  const motivos = [
    ["1", "Danificado"], ["2", "Desgaste Natural"], ["3", "Extravio"],
    ["4", "Mal Uso"], ["5", "Furto"], ["6", "Temporário"],
  ];
  const motX = M;
  const motW = W - 2 * M;
  doc.setFont("helvetica", "bold"); doc.setFontSize(8);
  doc.rect(motX, y2, motW, 6);
  doc.text("Motivo da Substituição:", motX + 2, y2 + 4);
  let mx = motX + 35;
  const segW = (motW - 35) / 6;
  motivos.forEach(([n, label]) => {
    doc.setFillColor(220, 230, 241);
    doc.rect(mx, y2, 5, 6, "FD");
    doc.text(n, mx + 2.5, y2 + 4, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.text(label, mx + 7, y2 + 4);
    mx += segW;
  });
  y2 += 6;

  // Table
  const head = [[
    "QTDE", "UND", "ESPECIFICAÇÕES", "CA", "ASSINATURA DO FUNCIONÁRIO",
    "DATA\nENTREGA", "MOTIVO\nSUBSTITUIÇÃO", "DATA\nDEVOLUÇÃO", "ASSINATURA\nRECEBEDOR",
  ]];
  const body: any[] = epis.map((e) => [
    String(e.qtd ?? ""),
    "UN",
    [e.item, e.tamanho ? `(${e.tamanho})` : ""].filter(Boolean).join(" "),
    e.ca ?? "",
    "",
    brDate(e.data_entrega),
    extractMotivo(e.observacoes),
    brDate(e.data_devolucao),
    "",
  ]);
  // Pad rows for visual ficha
  const targetRows = 22;
  while (body.length < targetRows) body.push(["", "", "", "", "", "", "", "", ""]);

  autoTable(doc, {
    startY: y2,
    head,
    body,
    theme: "grid",
    margin: { left: M, right: M },
    styles: { fontSize: 8, halign: "center", valign: "middle", lineColor: [0, 0, 0], lineWidth: 0.2, minCellHeight: 6 },
    headStyles: { fillColor: [220, 230, 241], textColor: 0, fontStyle: "bold", lineWidth: 0.2 },
    columnStyles: {
      0: { cellWidth: 14 }, 1: { cellWidth: 14 }, 2: { cellWidth: 65, halign: "left" },
      3: { cellWidth: 22 }, 4: { cellWidth: 55 }, 5: { cellWidth: 22 },
      6: { cellWidth: 30 }, 7: { cellWidth: 22 }, 8: { cellWidth: 35 },
    },
  });

  // Signatures footer
  const sigY = H - 18;
  const sigW = (W - 2 * M) / 3;
  for (let i = 0; i < 3; i++) {
    const x = M + i * sigW;
    doc.setDrawColor(0); doc.line(x + 6, sigY, x + sigW - 6, sigY);
  }
  doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  doc.text("TÉCNICO EM SEGURANÇA DO TRABALHO", M + sigW / 2, sigY + 4, { align: "center" });
  doc.text("GERENTE DE OPERAÇÕES", M + sigW + sigW / 2, sigY + 4, { align: "center" });
  doc.text("ENCARREGADO DA EQUIPE", M + 2 * sigW + sigW / 2, sigY + 4, { align: "center" });

  return doc;
}

export function openEpiFichaPdf(opts: Parameters<typeof buildEpiFichaPdf>[0]) {
  const doc = buildEpiFichaPdf(opts);
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const fname = `Ficha_EPI_${(opts.emp.nome ?? "colaborador").replace(/\s+/g, "_")}.pdf`;
  return { url, fname };
}