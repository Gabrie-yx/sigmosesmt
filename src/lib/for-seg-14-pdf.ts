import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type RIAData = {
  numero?: string | null;
  // Bloco A — dados do acidente
  obra_setor?: string;
  endereco?: string;
  data_acidente?: string;
  descricao?: string;
  vitima_fatal?: boolean;
  // Bloco B — dados do acidentado
  hora?: string;
  horas_trabalhadas?: string;
  local_acidente?: string;
  vitima_nome?: string;
  vitima_funcao?: string;
  vitima_re?: string;
  vitima_admissao?: string;
  tipo_funcionario?: string;       // PROPRIO / TERCEIRO
  categoria?: string;              // SEM_AFAST / COM_DTC / COM_AFAST + FATAL
  tipo_servico?: string;
  instruido?: boolean;
  superior?: string;
  testemunhas?: string;
  epis?: string;
  hora_extra?: boolean;
  acidente_anterior?: boolean;
  tinha_pt?: boolean;
  tinha_apr?: boolean;
  fez_integracao?: boolean;
  tinha_os?: boolean;
  // Bloco D
  enquadramento?: Record<string, string[]>;
  // Bloco E — 5 porquês
  porques?: Array<{ pergunta: string; resposta: string }>;
  causa_imediata?: string;
  causa_basica?: string;
  // Bloco F — ações imediatas
  acoes_imediatas?: Array<{ acao: string; quem: string; status: string }>;
  // Bloco G/H — fotos (data URLs)
  fotos_local?: string[];
  fotos_lesao?: string[];
  // Bloco I — participantes
  participantes?: Array<{ nome: string; funcao: string; assinatura?: string | null }>;
  // Bloco J — plano de ação
  plano_acao?: Array<{ acao: string; prazo: string; responsavel: string; status: string }>;
  // Assinaturas finais
  assinaturas?: {
    sesmt?: { nome: string; img: string | null };
    encarregado?: { nome: string; img: string | null };
    cipa?: { nome: string; img: string | null };
    gerente?: { nome: string; img: string | null };
  };
};

const M = 12;
const PAGE_W = 210;

function header(doc: jsPDF, numero?: string | null) {
  doc.setLineWidth(0.4);
  doc.rect(M, M, PAGE_W - 2 * M, 16);
  doc.setFontSize(11).setFont("helvetica", "bold");
  doc.text("RELATÓRIO DE INVESTIGAÇÃO DE ACIDENTE", PAGE_W / 2, M + 7, { align: "center" });
  doc.setFontSize(9).setFont("helvetica", "normal");
  doc.text("Código: FOR-SEG 14   |   Rev.: 03", M + 2, M + 13);
  doc.text(`Nº: ${numero ?? "—"}`, PAGE_W - M - 2, M + 13, { align: "right" });
}

function footer(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7).setTextColor(120);
    doc.text(
      `Página ${i}/${pages} · FOR-SEG 14 · Documento gerado eletronicamente pelo SIGMO`,
      PAGE_W / 2,
      doc.internal.pageSize.getHeight() - 6,
      { align: "center" }
    );
    doc.setTextColor(0);
  }
}

function sectionBar(doc: jsPDF, y: number, label: string): number {
  doc.setFillColor(30, 41, 59);
  doc.rect(M, y, PAGE_W - 2 * M, 6, "F");
  doc.setTextColor(255).setFont("helvetica", "bold").setFontSize(9);
  doc.text(label, M + 2, y + 4.2);
  doc.setTextColor(0);
  return y + 6;
}

function fieldRow(doc: jsPDF, y: number, cells: Array<{ label: string; value: string; w: number }>): number {
  let x = M;
  const h = 9;
  cells.forEach((c) => {
    doc.setLineWidth(0.2);
    doc.rect(x, y, c.w, h);
    doc.setFont("helvetica", "bold").setFontSize(6.5).setTextColor(80);
    doc.text(c.label, x + 1, y + 2.5);
    doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(0);
    const txt = doc.splitTextToSize(c.value || "—", c.w - 2);
    doc.text(txt[0] ?? "", x + 1, y + 7);
    x += c.w;
  });
  return y + h;
}

function checkbox(doc: jsPDF, x: number, y: number, checked: boolean, label: string, w = 60) {
  doc.setLineWidth(0.2);
  doc.rect(x, y, 2.6, 2.6);
  if (checked) {
    doc.setLineWidth(0.5);
    doc.line(x + 0.4, y + 1.4, x + 1.1, y + 2.2);
    doc.line(x + 1.1, y + 2.2, x + 2.4, y + 0.4);
    doc.setLineWidth(0.2);
  }
  doc.setFontSize(7).setFont("helvetica", "normal");
  const lines = doc.splitTextToSize(label, w - 4);
  doc.text(lines[0] ?? "", x + 3.5, y + 2.2);
}

function quadroChecklist(
  doc: jsPDF,
  y: number,
  titulo: string,
  opcoes: string[],
  selecionadas: string[],
  colWidth: number,
  cols: number,
): number {
  const w = PAGE_W - 2 * M;
  doc.setFillColor(241, 245, 249);
  doc.rect(M, y, w, 5, "F");
  doc.setFont("helvetica", "bold").setFontSize(8);
  doc.text(titulo, M + 2, y + 3.5);
  let cy = y + 5;
  const rowH = 4.2;
  for (let i = 0; i < opcoes.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = M + 2 + col * colWidth;
    const yy = cy + row * rowH;
    checkbox(doc, x, yy, selecionadas.includes(opcoes[i]), opcoes[i], colWidth);
  }
  const rows = Math.ceil(opcoes.length / cols);
  cy += rows * rowH + 1;
  doc.setLineWidth(0.15);
  doc.rect(M, y, w, cy - y);
  return cy + 1;
}

const OPCOES = {
  fonte_lesao: [
    "Máquinas / equipamentos","Ferramentas manuais","Veículos","Materiais","Quedas de altura",
    "Quedas mesmo nível","Energia elétrica","Produtos químicos","Calor / fogo","Ruído",
    "Movimentação manual","Outro",
  ],
  tipo_acidente: [
    "Impacto contra","Impacto sofrido","Queda","Prensagem","Aprisionamento",
    "Choque elétrico","Queimadura","Exposição química","Esforço excessivo","Cortante / perfurante",
    "Projeção de partículas","Outro",
  ],
  atos_inseguros: [
    "Operar sem autorização","Não usar EPI","Velocidade imprópria","Posicionamento inadequado",
    "Falta de atenção","Brincadeiras","Desativar dispositivo de segurança","Manutenção em equipamento ligado",
    "Não seguir procedimento","Carregar de forma incorreta","Improvisação","Outro",
  ],
  fator_pessoal: [
    "Falta de conhecimento","Falta de habilidade","Motivação inadequada","Capacidade física inadequada",
    "Capacidade mental inadequada","Fadiga","Estresse","Outro",
  ],
  condicoes_inseguras: [
    "Proteção / barreira inadequada","EPI inadequado","Ferramenta defeituosa","Iluminação inadequada",
    "Ventilação inadequada","Ruído excessivo","Piso escorregadio / irregular","Sinalização inadequada",
    "Espaço inadequado","Exposição química","Outro",
  ],
  fator_trabalho: [
    "Supervisão inadequada","Engenharia inadequada","Compra inadequada","Manutenção inadequada",
    "Procedimento inadequado","Comunicação deficiente","Liderança deficiente","Pressão por produção",
    "Outro",
  ],
  natureza_lesao: [
    "Contusão","Corte / laceração","Fratura","Queimadura","Perfuração",
    "Amputação","Luxação / entorse","Distensão muscular","Trauma","Intoxicação",
    "Lesão por esforço repetitivo","Outro",
  ],
  localizacao_lesao: [
    "Cabeça","Olhos","Face","Pescoço","Tórax","Abdômen","Coluna","Membros superiores",
    "Mãos","Membros inferiores","Pés","Múltiplas","Outro",
  ],
  procedimentos_medicos: [
    "Primeiros socorros","Atendimento ambulatorial","Pronto-socorro","Internação",
    "Cirurgia","Reabilitação","Acompanhamento médico","Não houve","Outro",
  ],
};

const QUADRO_TITULOS: Record<string, string> = {
  fonte_lesao: "D1 — FONTE DA LESÃO",
  tipo_acidente: "D2 — TIPO DE ACIDENTE",
  atos_inseguros: "D3 — ATOS INSEGUROS",
  fator_pessoal: "D4 — FATOR PESSOAL DE INSEGURANÇA",
  condicoes_inseguras: "D5 — CONDIÇÕES INSEGURAS",
  fator_trabalho: "D6 — FATOR DE TRABALHO",
  natureza_lesao: "D7 — NATUREZA DA LESÃO",
  localizacao_lesao: "D8 — LOCALIZAÇÃO DA LESÃO",
  procedimentos_medicos: "D9 — PROCEDIMENTOS MÉDICOS",
};

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  const h = doc.internal.pageSize.getHeight();
  if (y + needed > h - 12) {
    doc.addPage();
    return M;
  }
  return y;
}

export function gerarForSeg14(r: RIAData): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  header(doc, r.numero);
  let y = M + 18;

  // ===== A — DADOS DO ACIDENTE =====
  y = sectionBar(doc, y, "A — DADOS DO ACIDENTE");
  y = fieldRow(doc, y, [
    { label: "1. OBRA / SETOR", value: r.obra_setor ?? "", w: 100 },
    { label: "2. DATA DO ACIDENTE", value: r.data_acidente ?? "", w: 86 },
  ]);
  y = fieldRow(doc, y, [{ label: "3. ENDEREÇO", value: r.endereco ?? "", w: 186 }]);
  // Descrição (multilinha)
  const descLines = doc.splitTextToSize(r.descricao || "—", 182);
  const descH = Math.max(18, descLines.length * 3.6 + 6);
  doc.rect(M, y, 186, descH);
  doc.setFont("helvetica", "bold").setFontSize(6.5).setTextColor(80);
  doc.text("4. DESCRIÇÃO DO ACIDENTE", M + 1, y + 2.5);
  doc.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(0);
  doc.text(descLines, M + 2, y + 6);
  y += descH;
  // 5. Vítima fatal
  doc.rect(M, y, 186, 6);
  doc.setFont("helvetica", "bold").setFontSize(7);
  doc.text("5. HOUVE VÍTIMA FATAL?", M + 2, y + 4);
  checkbox(doc, M + 60, y + 1.7, !!r.vitima_fatal, "Sim", 18);
  checkbox(doc, M + 78, y + 1.7, r.vitima_fatal === false, "Não", 18);
  y += 6 + 2;

  // ===== B — DADOS DO ACIDENTADO =====
  y = sectionBar(doc, y, "B — DADOS DO ACIDENTADO");
  y = fieldRow(doc, y, [
    { label: "6. HORA DO ACIDENTE", value: r.hora ?? "", w: 50 },
    { label: "7. Hs TRABALHADAS", value: r.horas_trabalhadas ?? "", w: 50 },
    { label: "8. LOCAL DO ACIDENTE", value: r.local_acidente ?? "", w: 86 },
  ]);
  y = fieldRow(doc, y, [
    { label: "9. NOME DO ACIDENTADO", value: r.vitima_nome ?? "", w: 116 },
    { label: "10. RE / MATRÍCULA", value: r.vitima_re ?? "", w: 70 },
  ]);
  y = fieldRow(doc, y, [
    { label: "11. FUNÇÃO", value: r.vitima_funcao ?? "", w: 110 },
    { label: "12. DATA ADMISSÃO", value: r.vitima_admissao ?? "", w: 76 },
  ]);
  // Tipo funcionário / Categoria
  doc.rect(M, y, 186, 7);
  doc.setFont("helvetica", "bold").setFontSize(6.5).setTextColor(80);
  doc.text("13. TIPO DE FUNCIONÁRIO", M + 1, y + 2.5);
  doc.setTextColor(0);
  checkbox(doc, M + 50, y + 2.2, r.tipo_funcionario === "PROPRIO", "Próprio", 30);
  checkbox(doc, M + 90, y + 2.2, r.tipo_funcionario === "TERCEIRO", "Terceiro", 30);
  y += 7;
  doc.rect(M, y, 186, 7);
  doc.setFont("helvetica", "bold").setFontSize(6.5).setTextColor(80);
  doc.text("14. CATEGORIA DO ACIDENTE", M + 1, y + 2.5);
  doc.setTextColor(0);
  checkbox(doc, M + 55, y + 2.2, r.categoria === "SEM_AFAST", "S/ afastamento", 35);
  checkbox(doc, M + 95, y + 2.2, r.categoria === "COM_DTC", "C/ DTC", 25);
  checkbox(doc, M + 125, y + 2.2, r.categoria === "COM_AFAST", "C/ afastamento", 35);
  checkbox(doc, M + 165, y + 2.2, r.categoria === "FATAL", "Fatal", 20);
  y += 7;
  y = fieldRow(doc, y, [
    { label: "15. TIPO DE SERVIÇO", value: r.tipo_servico ?? "", w: 186 },
  ]);
  // Checkboxes em linha: instruido / hora extra / acidente anterior / PT / APR / integração / OS
  const sn = (b?: boolean) => (b === true ? "Sim" : b === false ? "Não" : "—");
  y = fieldRow(doc, y, [
    { label: "16. RECEBEU INSTRUÇÕES", value: sn(r.instruido), w: 62 },
    { label: "17. HORA EXTRA", value: sn(r.hora_extra), w: 62 },
    { label: "18. ACIDENTE ANTERIOR", value: sn(r.acidente_anterior), w: 62 },
  ]);
  y = fieldRow(doc, y, [
    { label: "19. PT EMITIDA", value: sn(r.tinha_pt), w: 46 },
    { label: "20. APR DA TAREFA", value: sn(r.tinha_apr), w: 46 },
    { label: "21. FEZ INTEGRAÇÃO", value: sn(r.fez_integracao), w: 47 },
    { label: "22. OS DO CARGO", value: sn(r.tinha_os), w: 47 },
  ]);
  y = fieldRow(doc, y, [
    { label: "23. SUPERIOR IMEDIATO", value: r.superior ?? "", w: 93 },
    { label: "24. TESTEMUNHAS", value: r.testemunhas ?? "", w: 93 },
  ]);
  y = fieldRow(doc, y, [
    { label: "25. EPIs UTILIZADOS NO MOMENTO", value: r.epis ?? "", w: 186 },
  ]);

  // ===== D — ENQUADRAMENTO =====
  doc.addPage();
  header(doc, r.numero);
  y = M + 18;
  y = sectionBar(doc, y, "D — ENQUADRAMENTO TÉCNICO DO ACIDENTE");
  const enq = r.enquadramento ?? {};
  for (const key of Object.keys(OPCOES) as Array<keyof typeof OPCOES>) {
    const titulo = QUADRO_TITULOS[key];
    const opcoes = OPCOES[key];
    const selecionadas = enq[key] ?? [];
    const cols = 3;
    const rows = Math.ceil(opcoes.length / cols);
    const need = 5 + rows * 4.2 + 3;
    y = ensureSpace(doc, y, need);
    if (y === M) { header(doc, r.numero); y = M + 18; }
    y = quadroChecklist(doc, y, titulo, opcoes, selecionadas, (PAGE_W - 2 * M - 4) / cols, cols);
  }

  // ===== E — 5 PORQUÊS =====
  doc.addPage();
  header(doc, r.numero);
  y = M + 18;
  y = sectionBar(doc, y, "E — ANÁLISE DE CAUSA RAIZ (5 PORQUÊS)");
  autoTable(doc, {
    startY: y,
    head: [["#", "Pergunta", "Resposta"]],
    body: (r.porques ?? []).map((p, i) => [String(i + 1), p.pergunta, p.resposta]),
    styles: { fontSize: 8, cellPadding: 1.6 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 70 } },
    margin: { left: M, right: M },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 3;
  y = fieldRow(doc, y, [{ label: "CAUSA IMEDIATA", value: r.causa_imediata ?? "", w: 93 }, { label: "CAUSA BÁSICA", value: r.causa_basica ?? "", w: 93 }]);

  // ===== F — AÇÕES IMEDIATAS =====
  y += 2;
  y = ensureSpace(doc, y, 30);
  y = sectionBar(doc, y, "F — AÇÕES IMEDIATAS TOMADAS");
  autoTable(doc, {
    startY: y,
    head: [["Ação", "Quem", "Status"]],
    body: (r.acoes_imediatas ?? []).length
      ? r.acoes_imediatas!.map((a) => [a.acao, a.quem, a.status])
      : [["—", "—", "—"]],
    styles: { fontSize: 8, cellPadding: 1.6 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    columnStyles: { 0: { cellWidth: 110 }, 2: { cellWidth: 26 } },
    margin: { left: M, right: M },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 3;

  // ===== G / H — FOTOS =====
  const fotos = [...(r.fotos_local ?? []).map((u) => ({ u, t: "LOCAL" })), ...(r.fotos_lesao ?? []).map((u) => ({ u, t: "LESÃO" }))];
  if (fotos.length) {
    y = ensureSpace(doc, y, 50);
    y = sectionBar(doc, y, "G / H — REGISTRO FOTOGRÁFICO");
    const fw = 86, fh = 60;
    for (let i = 0; i < fotos.length; i++) {
      const col = i % 2;
      if (col === 0) y = ensureSpace(doc, y, fh + 6);
      const x = M + col * (fw + 6);
      try {
        doc.addImage(fotos[i].u, "JPEG", x, y, fw, fh, undefined, "FAST");
      } catch {
        try { doc.addImage(fotos[i].u, "PNG", x, y, fw, fh, undefined, "FAST"); } catch { /* skip */ }
      }
      doc.setFontSize(7).text(`Foto ${i + 1} — ${fotos[i].t}`, x, y + fh + 3);
      if (col === 1) y += fh + 6;
    }
    if (fotos.length % 2 === 1) y += fh + 6;
  }

  // ===== I — PARTICIPANTES =====
  doc.addPage();
  header(doc, r.numero);
  y = M + 18;
  y = sectionBar(doc, y, "I — PARTICIPANTES DA INVESTIGAÇÃO");
  autoTable(doc, {
    startY: y,
    head: [["Nome", "Função", "Assinatura"]],
    body: (r.participantes ?? []).length
      ? r.participantes!.map((p) => [p.nome, p.funcao, p.assinatura ? "[ass]" : ""])
      : [["—", "—", ""]],
    styles: { fontSize: 8, cellPadding: 2, minCellHeight: 12 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    columnStyles: { 0: { cellWidth: 80 }, 2: { cellWidth: 50 } },
    margin: { left: M, right: M },
    didDrawCell: (data) => {
      if (data.section === "body" && data.column.index === 2) {
        const p = r.participantes?.[data.row.index];
        if (p?.assinatura) {
          try {
            doc.addImage(p.assinatura, "PNG",
              data.cell.x + 2, data.cell.y + 1,
              data.cell.width - 4, data.cell.height - 2,
              undefined, "FAST");
          } catch { /* skip */ }
        }
      }
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 3;

  // ===== J — PLANO DE AÇÃO =====
  y = ensureSpace(doc, y, 30);
  y = sectionBar(doc, y, "J — PLANO DE AÇÃO (CORRETIVAS / PREVENTIVAS)");
  autoTable(doc, {
    startY: y,
    head: [["Ação", "Prazo", "Responsável", "Status"]],
    body: (r.plano_acao ?? []).length
      ? r.plano_acao!.map((p) => [p.acao, p.prazo, p.responsavel, p.status])
      : [["—", "—", "—", "—"]],
    styles: { fontSize: 8, cellPadding: 1.6 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 22 }, 3: { cellWidth: 24 } },
    margin: { left: M, right: M },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 5;

  // ===== ASSINATURAS FINAIS =====
  y = ensureSpace(doc, y, 60);
  y = sectionBar(doc, y, "ASSINATURAS");
  const labels: Array<["sesmt" | "encarregado" | "cipa" | "gerente", string]> = [
    ["sesmt", "SESMT"],
    ["encarregado", "Encarregado"],
    ["cipa", "CIPA"],
    ["gerente", "Gerente ADM"],
  ];
  const bw = (PAGE_W - 2 * M) / 2;
  const bh = 26;
  labels.forEach((lbl, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = M + col * bw;
    const yy = y + row * bh;
    doc.rect(x, yy, bw, bh);
    doc.setFontSize(7).setFont("helvetica", "bold").setTextColor(80);
    doc.text(lbl[1], x + 2, yy + 3);
    doc.setTextColor(0);
    const sig = r.assinaturas?.[lbl[0]];
    if (sig?.img) {
      try { doc.addImage(sig.img, "PNG", x + 4, yy + 5, bw - 8, bh - 12, undefined, "FAST"); } catch { /* skip */ }
    } else {
      doc.setLineWidth(0.2);
      doc.line(x + 4, yy + bh - 8, x + bw - 4, yy + bh - 8);
    }
    doc.setFontSize(7).text(sig?.nome ?? "—", x + bw / 2, yy + bh - 4, { align: "center" });
  });

  footer(doc);
  return doc;
}