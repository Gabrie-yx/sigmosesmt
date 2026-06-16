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
  encerramento?: {
    incluir?: boolean; // se true, adiciona página 3 (Termo de Encerramento e Quitação)
    local?: string;
    motivo?:
      | "DESLIGAMENTO"
      | "TRANSFERENCIA"
      | "FIM_CONTRATO"
      | "AFASTAMENTO"
      | "OUTRO";
    motivo_outro?: string;
    vinculo?: "PROPRIO" | "TERCEIRO";
    empresa_terceira?: string;
  };
  responsaveis?: {
    tecnico_nome?: string;
    encarregado_nome?: string;
    supervisor_nome?: string;
  };
}) {
  const { emp, company, role, epis, encerramento, responsaveis } = opts;
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 8;
  const incluirEncerramento = encerramento?.incluir === true;
  const totalPags = incluirEncerramento ? 3 : 2;
  const hoje = new Date().toLocaleDateString("pt-BR");

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
  doc.text(`DATA: ${hoje}`, codeX + 2, M + 10.5);
  doc.text(`PÁG.: 01/${String(totalPags).padStart(2, "0")}`, codeX + 2, M + 13.5);

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

  // Slot da assinatura digitalizada do trabalhador (logo após o bloco de ciência).
  // O sistema (PdfSignerDialog) sobrepõe a imagem da galeria exatamente sobre esta linha.
  {
    const slotY = Math.min(y + 8, H - 18);
    const lineW = 80;
    const lineX = (W - lineW) / 2;
    doc.setDrawColor(0); doc.setLineWidth(0.3);
    doc.line(lineX, slotY, lineX + lineW, slotY);
    doc.setFont("helvetica", "bold"); doc.setFontSize(8);
    doc.text("ASSINATURA DO TRABALHADOR", W / 2, slotY + 3.5, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(7);
    const linhaIdent = [emp.nome ?? "", emp.cpf ? `— CPF ${emp.cpf}` : ""].filter(Boolean).join(" ");
    if (linhaIdent) doc.text(linhaIdent, W / 2, slotY + 6.8, { align: "center" });
  }

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

  // Pg2: rodapé limpo (sem assinaturas decorativas).
  // A quitação fica no Termo de Encerramento (pg 3), quando aplicável.
  doc.setFont("helvetica", "italic"); doc.setFontSize(7); doc.setTextColor(100);
  doc.text(
    "Registro de entregas e devoluções. A quitação consta no Termo de Encerramento (pág. 03), quando aplicável.",
    W / 2, H - 6, { align: "center" }
  );
  doc.setTextColor(0);

  /* ============ PAGE 3 — Termo de Encerramento e Quitação (opcional) ============ */
  if (incluirEncerramento) {
    doc.addPage();
    // Header igual
    doc.setDrawColor(0); doc.setLineWidth(0.3);
    doc.rect(M, M, W - 2 * M, 14);
    doc.rect(M, M, 32, 14);
    doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text("DMN", M + 16, M + 6, { align: "center" });
    doc.setFontSize(7); doc.setFont("helvetica", "normal");
    doc.text("ESTALEIRO", M + 16, M + 11, { align: "center" });
    doc.setFont("helvetica", "bold"); doc.setFontSize(13);
    doc.text("TERMO DE ENCERRAMENTO E QUITAÇÃO DE EPI's", W / 2, M + 9, { align: "center" });
    const codeX3 = W - M - 50;
    doc.rect(codeX3, M, 50, 14);
    doc.setFontSize(7); doc.setFont("helvetica", "normal");
    doc.text("CÓD: FOR-SEG 02", codeX3 + 2, M + 3.5);
    doc.text("REVISÃO: 30/08/2025", codeX3 + 2, M + 7);
    doc.text(`DATA: ${hoje}`, codeX3 + 2, M + 10.5);
    doc.text("PÁG.: 03/03", codeX3 + 2, M + 13.5);

    let y3 = M + 18;

    // Motivo do encerramento
    doc.setFillColor(220, 220, 220);
    doc.rect(M, y3, W - 2 * M, 6, "FD");
    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text("MOTIVO DO ENCERRAMENTO", W / 2, y3 + 4.2, { align: "center" });
    y3 += 6;

    const mark = (k: string) => (encerramento?.motivo === k ? "X" : " ");
    const motivosEnc: [string, string][] = [
      [mark("DESLIGAMENTO"), "Desligamento / Rescisão"],
      [mark("TRANSFERENCIA"), "Transferência de setor/função"],
      [mark("FIM_CONTRATO"), "Fim de contrato (avulso/temporário)"],
      [mark("AFASTAMENTO"), "Afastamento prolongado"],
      [mark("OUTRO"), `Outro: ${encerramento?.motivo_outro ?? "___________________________"}`],
    ];
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    const mw = (W - 2 * M) / 5;
    motivosEnc.forEach(([mk, label], i) => {
      const x = M + i * mw;
      doc.rect(x + 2, y3 + 1, 5, 5);
      doc.setFont("helvetica", "bold");
      doc.text(mk, x + 4.5, y3 + 4.7, { align: "center" });
      doc.setFont("helvetica", "normal"); doc.setFontSize(8);
      doc.text(label, x + 8, y3 + 4.5);
      doc.setFontSize(9);
    });
    y3 += 8;

    // Vínculo
    const isTerceiro = encerramento?.vinculo === "TERCEIRO";
    doc.setFillColor(220, 230, 241);
    doc.rect(M, y3, 30, 7, "FD");
    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text("Vínculo:", M + 2, y3 + 4.7);
    doc.rect(M + 30, y3, 60, 7);
    doc.setFont("helvetica", "normal");
    doc.text(isTerceiro ? "Avulso terceirizado" : "Próprio (CLT direto)", M + 32, y3 + 4.7);
    doc.setFillColor(220, 230, 241);
    doc.rect(M + 90, y3, 40, 7, "FD");
    doc.setFont("helvetica", "bold");
    doc.text("Empresa Terceira:", M + 92, y3 + 4.7);
    doc.rect(M + 130, y3, W - M - 130 - M, 7);
    doc.setFont("helvetica", "normal");
    doc.text(isTerceiro ? (encerramento?.empresa_terceira ?? "") : "—", M + 132, y3 + 4.7);
    y3 += 9;

    // Termo
    doc.setFillColor(220, 220, 220);
    doc.rect(M, y3, W - 2 * M, 6, "FD");
    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text("TERMO DE QUITAÇÃO", W / 2, y3 + 4.2, { align: "center" });
    y3 += 6;

    const empresaNome = company?.name ?? "_______________________";
    const termo = `Eu, ${emp.nome ?? "________________________"}, portador(a) do CPF ${emp.cpf ?? "_______________"}, matrícula ${emp.matricula ?? "_____"}, função ${role?.name ?? "________________"}, declaro para os devidos fins legais que, na presente data, DEVOLVI à empresa ${empresaNome} todos os Equipamentos de Proteção Individual (EPIs) e uniformes que estavam sob minha guarda e responsabilidade, conforme histórico de entregas e devoluções registrado nas páginas 01 e 02 desta ficha (FOR-SEG 02).

Declaro ainda que:

1 - Os itens devolvidos foram conferidos pelo responsável SST da empresa, ficando esta ISENTA de qualquer cobrança futura referente aos EPIs e uniformes devolvidos e quitados neste ato;

2 - Eventuais itens não devolvidos, danificados por dolo, mau uso ou negligência, ou extraviados, foram-me apresentados e estou ciente de que os valores correspondentes poderão ser descontados em rescisão, nos termos do art. 462 e §1º da CLT e da autorização firmada no Termo de Responsabilidade (página 01);

3 - Recebi orientação sobre a devolução obrigatória de todos os EPIs sob minha guarda como condição para o encerramento do vínculo / transferência, conforme NR-06, item 6.7.1, alínea "h";

4 - Não tenho mais nenhuma pendência relativa a EPIs ou uniformes junto à empresa ${empresaNome} a partir desta data, dando plena e geral QUITAÇÃO no que se refere a este tema.

E, por estar de acordo com tudo o que foi exposto, firmo o presente termo.`;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    const linesT = doc.splitTextToSize(termo, W - 2 * M - 4);
    doc.text(linesT, M + 2, y3 + 4);
    y3 += linesT.length * 3.8 + 4;

    // Local (digitado pelo usuário) e Data (do sistema)
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    const localTxt = encerramento?.local && encerramento.local.trim().length > 0 ? encerramento.local : "____________________";
    doc.text(`Local: ${localTxt}    Data: ${hoje}`, M + 2, y3 + 4);
    y3 += 10;

    // 4 assinaturas — Funcionário / Téc. Segurança / Encarregado / Supervisor Geral
    const sigY3 = Math.min(y3 + 14, H - 18);
    const sigCount = 4;
    const sigW3 = (W - 2 * M) / sigCount;
    const titles = [
      "ASSINATURA DO FUNCIONÁRIO",
      "ASSINATURA DO TÉCNICO EM SEGURANÇA",
      "ASSINATURA DO ENCARREGADO",
      "ASSINATURA DO SUPERVISOR GERAL",
    ];
    const names = [
      emp.nome ?? "",
      responsaveis?.tecnico_nome ?? "",
      responsaveis?.encarregado_nome ?? "",
      responsaveis?.supervisor_nome ?? "",
    ];
    doc.setDrawColor(0); doc.setLineWidth(0.3);
    for (let i = 0; i < sigCount; i++) {
      const x = M + i * sigW3;
      doc.line(x + 6, sigY3, x + sigW3 - 6, sigY3);
      doc.setFont("helvetica", "bold"); doc.setFontSize(8);
      doc.text(titles[i], x + sigW3 / 2, sigY3 + 4, { align: "center" });
      doc.setFont("helvetica", "normal"); doc.setFontSize(7);
      if (names[i]) doc.text(names[i], x + sigW3 / 2, sigY3 + 8, { align: "center" });
    }
  }

  return doc;
}

export function openEpiFichaPdf(opts: Parameters<typeof buildEpiFichaPdf>[0]) {
  const doc = buildEpiFichaPdf(opts);
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const fname = `Ficha_EPI_${(opts.emp.nome ?? "colaborador").replace(/\s+/g, "_")}.pdf`;
  return { url, fname };
}