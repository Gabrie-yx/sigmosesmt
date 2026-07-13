import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { drawPdfHeader } from "./pdf-header";
import { DIMENSAO_LABEL } from "./psico-instrument";

/* Paleta Matriz 5x5 DMN (mesmas cores do dashboard) */
const COR_BAIXO: [number, number, number] = [0x2e, 0xcc, 0x71];   // verde
const COR_MOD: [number, number, number]   = [0xf7, 0xd8, 0x42];   // amarelo
const COR_ALTO: [number, number, number]  = [0xf3, 0x9c, 0x12];   // laranja
const COR_CRIT: [number, number, number]  = [0xe7, 0x4c, 0x3c];   // vermelho

function corMedia(media: number, dimensao: string): [number, number, number] {
  if (dimensao === "VIOLENCIA" && media >= 1.5) return COR_CRIT;
  if (media < 2.0) return COR_BAIXO;
  if (media < 3.0) return COR_MOD;
  if (media < 4.0) return COR_ALTO;
  return COR_CRIT;
}

function labelNivel(media: number, dimensao: string): string {
  if (dimensao === "VIOLENCIA" && media >= 1.5) return "Crítico";
  if (media < 2.0) return "Baixo";
  if (media < 3.0) return "Moderado";
  if (media < 4.0) return "Alto";
  return "Crítico";
}

export type AgregadoLinha = {
  ghe_id: string;
  dimensao: string;
  n_respostas: number;
  media: number | string | null;
  suprimido: boolean;
};

export type GheInfo = { id: string; numero: number; setor: string };

export type PlanoAcaoItem = {
  o_que: string | null;
  por_que: string | null;
  onde: string | null;
  quem: string | null;
  quando: string | null;
  como: string | null;
  status: string | null;
};

export type ParecerPsicoOpts = {
  campanha: {
    titulo: string;
    descricao?: string | null;
    data_inicio: string;
    data_fim: string;
    min_respondentes: number;
    total_tokens: number;
    total_respostas: number;
  };
  agregado: AgregadoLinha[];
  ghes: GheInfo[];
  planoAcao: PlanoAcaoItem[];
  signatarios?: { tst?: string; supervisor?: string };
  /** Data URLs (PNG) para estampar acima das linhas de assinatura. */
  assinaturas?: { tst?: string | null; supervisor?: string | null };
};

export function gerarParecerPsicossocialPdf(opts: ParecerPsicoOpts): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 12;
  const BOTTOM = 14; // reserva para rodapé
  const usableBottom = H - BOTTOM;

  // helper — reserva de espaço; força quebra se não couber `needed` mm.
  function ensureSpace(y: number, needed: number): number {
    if (y + needed > usableBottom) {
      doc.addPage();
      return M;
    }
    return y;
  }

  const pctAdesao =
    opts.campanha.total_tokens > 0
      ? Math.round((opts.campanha.total_respostas / opts.campanha.total_tokens) * 100)
      : 0;

  // Estatísticas
  const validas = opts.agregado.filter((l) => !l.suprimido && l.media != null);
  const criticas = validas.filter((l) => corMedia(Number(l.media), l.dimensao) === COR_CRIT).length;
  const altas = validas.filter((l) => corMedia(Number(l.media), l.dimensao) === COR_ALTO).length;

  let y = drawPdfHeader(doc, {
    titulo: "Parecer Técnico — Avaliação de Riscos Psicossociais",
    subtitulo: "NR-01 · Portaria MTP 1.419/2024 · ISO 45003:2021",
    filtros: [
      `Campanha: ${opts.campanha.titulo}`,
      `Período: ${fmtBR(opts.campanha.data_inicio)} a ${fmtBR(opts.campanha.data_fim)}`,
    ],
    kpis: [
      { label: "Respostas", value: `${opts.campanha.total_respostas}/${opts.campanha.total_tokens}`, tone: "neutral" },
      { label: "Adesão", value: `${pctAdesao}%`, tone: pctAdesao >= 70 ? "success" : pctAdesao >= 40 ? "warning" : "danger" },
      { label: "Críticos", value: criticas, tone: criticas ? "danger" : "success" },
      { label: "Altos", value: altas, tone: altas ? "warning" : "success" },
    ],
  });
  y += 2;

  // ============== 1. METODOLOGIA ==============
  y = sectionTitle(doc, "1. METODOLOGIA", y);
  y = paragraph(
    doc,
    "A avaliação foi realizada com o instrumento HSE-IT BR (Health & Safety Executive/UK, uso livre), " +
      "adaptado ao contexto brasileiro e complementado com itens ISO 45003:2021 para assédio, violência e " +
      "interface trabalho-vida. Escala Likert de 1 (nunca) a 5 (sempre). Itens positivos foram invertidos para " +
      "manter a convenção 'score alto = risco alto'. A coleta seguiu blindagem LGPD: token single-use, sem " +
      "identificação do respondente, IP/UA armazenados apenas em hash unidirecional.",
    y,
  );
  y = paragraph(
    doc,
    `Regra de k-anonimato: recortes com menos de ${opts.campanha.min_respondentes} respondentes são ` +
      "automaticamente suprimidos das análises agregadas (LGPD Art. 11 · ISO 45003 8.1.4 · NR-01 1.5.4.4.6). " +
      "Este parecer considera apenas dimensões com n suficiente para publicação.",
    y,
  );

  // ============== 2. UNIVERSO E ADESÃO ==============
  y = sectionTitle(doc, "2. UNIVERSO E ADESÃO", y);
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2, lineColor: [203, 213, 225], lineWidth: 0.2 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold", fontSize: 9 },
    head: [["Indicador", "Valor"]],
    body: [
      ["Tokens emitidos", String(opts.campanha.total_tokens)],
      ["Respostas válidas recebidas", String(opts.campanha.total_respostas)],
      ["Taxa de adesão", `${pctAdesao}%`],
      ["Piso de anonimato (k)", `n ≥ ${opts.campanha.min_respondentes} por recorte`],
      ["GHEs contemplados", String(opts.ghes.length)],
    ],
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // ============== 3. MATRIZ DIAGNÓSTICA (com cores) ==============
  {
    const gheIds = Array.from(new Set(opts.agregado.map((l) => l.ghe_id))).filter(Boolean);
    const heatmapH = 18 /*header*/ + gheIds.length * 10 + 4 /*gap*/ + 8 /*legenda*/;
    y = ensureSpace(y, 12 /*title*/ + heatmapH);
    y = sectionTitle(doc, "3. MATRIZ DIAGNÓSTICA (GHE × Dimensão)", y);
    y = drawMatrizHeatmap(doc, y, opts.agregado, opts.ghes);
    y = legendaCores(doc, y);
  }

  // ============== 4. RANKING DE CRITICIDADE ==============
  y = ensureSpace(y + 4, 40);
  y = sectionTitle(doc, "4. RANKING DE CRITICIDADE", y);
  const ranking = validas
    .map((l) => ({ ...l, mediaNum: Number(l.media) }))
    .sort((a, b) => b.mediaNum - a.mediaNum)
    .slice(0, 15);
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, bottom: BOTTOM },
    showHead: "everyPage",
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 1.8, lineColor: [203, 213, 225], lineWidth: 0.2 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold", fontSize: 8.5 },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 52 },
      2: { cellWidth: 60 },
      3: { cellWidth: 16, halign: "center" },
      4: { cellWidth: 12, halign: "center" },
      5: { cellWidth: 26, halign: "center" },
    },
    head: [["#", "GHE", "Dimensão", "Média", "n", "Nível"]],
    body: ranking.map((r, i) => {
      const g = opts.ghes.find((x) => x.id === r.ghe_id);
      return [
        String(i + 1),
        g ? `GHE ${g.numero} — ${g.setor}` : r.ghe_id.slice(0, 8),
        DIMENSAO_LABEL[r.dimensao as keyof typeof DIMENSAO_LABEL] ?? r.dimensao,
        r.mediaNum.toFixed(2),
        String(r.n_respostas),
        labelNivel(r.mediaNum, r.dimensao),
      ];
    }),
    didParseCell: (data) => {
      if (data.section !== "body" || data.column.index !== 5) return;
      const r = ranking[data.row.index];
      if (!r) return;
      const [rr, gg, bb] = corMedia(r.mediaNum, r.dimensao);
      data.cell.styles.fillColor = [rr, gg, bb];
      data.cell.styles.textColor = rr + gg + bb > 500 ? [15, 23, 42] : [255, 255, 255];
      data.cell.styles.fontStyle = "bold";
    },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // ============== 5. NÃO CONFORMIDADES ==============
  y = ensureSpace(y, 40);
  y = sectionTitle(doc, "5. NÃO CONFORMIDADES IDENTIFICADAS", y);
  const nc: string[] = [];
  if (criticas > 0) nc.push(`${criticas} recorte(s) em nível CRÍTICO — exigem ação imediata (NR-01 1.5.5).`);
  if (altas > 0) nc.push(`${altas} recorte(s) em nível ALTO — exigem plano de ação com prazo (NR-01 1.5.5.2).`);
  const violCrit = validas.filter((l) => l.dimensao === "VIOLENCIA" && Number(l.media) >= 1.5).length;
  if (violCrit > 0) nc.push(`${violCrit} recorte(s) com sinais de violência/assédio — tolerância zero (ISO 45003).`);
  if (pctAdesao < 40) nc.push(`Adesão baixa (${pctAdesao}%) — reforçar comunicação e reaplicar campanha.`);
  if (nc.length === 0) nc.push("Não foram identificadas não conformidades relevantes nesta campanha.");
  for (const item of nc) { y = bullet(doc, item, y); }
  y += 3;

  // ============== 6. PLANO DE AÇÃO 5W2H ==============
  y = ensureSpace(y, 40);
  y = sectionTitle(doc, "6. PLANO DE AÇÃO (5W2H) — VÍNCULO COM PGR", y);
  if (opts.planoAcao.length === 0) {
    y = paragraph(
      doc,
      "Não há ações cadastradas no Plano de Ação do PGR. Recomenda-se criar ações específicas " +
        "para cada recorte de nível ALTO ou CRÍTICO desta avaliação, integrando-as ao PGR (NR-01 1.5.5.2).",
      y,
    );
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M, bottom: BOTTOM },
      showHead: "everyPage",
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 1.6, lineColor: [203, 213, 225], lineWidth: 0.2, valign: "top", overflow: "linebreak" },
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold", fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 42 }, // o quê
        1: { cellWidth: 35 }, // por quê
        2: { cellWidth: 25 }, // onde
        3: { cellWidth: 25 }, // quem
        4: { cellWidth: 18, halign: "center" }, // quando
        5: { cellWidth: 22, halign: "center" }, // status
      },
      head: [["O quê", "Por quê", "Onde", "Quem", "Quando", "Status"]],
      body: opts.planoAcao.map((p) => [
        p.o_que ?? "—",
        p.por_que ?? "—",
        p.onde ?? "—",
        p.quem ?? "—",
        p.quando ? fmtBR(p.quando) : "—",
        p.status ?? "PENDENTE",
      ]),
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ============== 7. CONCLUSÃO E ASSINATURAS ==============
  // Conclusão + bloco de assinatura (~70mm) devem viver juntos na mesma página.
  y = ensureSpace(y, 90);
  y = sectionTitle(doc, "7. CONCLUSÃO", y);
  const conclusao =
    criticas > 0
      ? `Foram identificados ${criticas} recorte(s) em nível CRÍTICO e ${altas} em nível ALTO. ` +
        "Recomenda-se ação imediata e integração ao Plano de Ação do PGR na próxima revisão."
      : altas > 0
        ? `Foram identificados ${altas} recorte(s) em nível ALTO. Recomenda-se plano de ação estruturado ` +
          "com prazos e responsáveis, incorporado ao PGR."
        : "Não foram identificados recortes em nível ALTO ou CRÍTICO. Recomenda-se manter monitoramento periódico.";
  y = paragraph(doc, conclusao, y);

  // ---- Bloco de assinaturas ----
  y = ensureSpace(y + 4, 55);
  const tst = opts.signatarios?.tst ?? "Técnico de Segurança do Trabalho";
  const sup = opts.signatarios?.supervisor ?? "Anderson — Supervisor Geral";
  const gap = 12;
  const colW = (W - M * 2 - gap) / 2;
  const sigBoxH = 26;            // altura da área da assinatura (imagem)
  const sigTop = y + 6;
  const lineY = sigTop + sigBoxH;

  // Estampa as imagens de assinatura, se fornecidas
  const stampSig = (dataUrl: string | null | undefined, x: number) => {
    if (!dataUrl) return;
    try {
      const maxW = colW - 8;
      const maxH = sigBoxH - 2;
      doc.addImage(dataUrl, "PNG", x + (colW - maxW) / 2, sigTop, maxW, maxH, undefined, "FAST");
    } catch {
      /* ignore image errors */
    }
  };
  stampSig(opts.assinaturas?.tst, M);
  stampSig(opts.assinaturas?.supervisor, M + colW + gap);

  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.3);
  doc.line(M, lineY, M + colW, lineY);
  doc.line(M + colW + gap, lineY, M + colW * 2 + gap, lineY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(tst, M + colW / 2, lineY + 5, { align: "center" });
  doc.text(sup, M + colW + gap + colW / 2, lineY + 5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text("Técnico de Segurança do Trabalho", M + colW / 2, lineY + 9, { align: "center" });
  doc.text("Supervisor Geral", M + colW + gap + colW / 2, lineY + 9, { align: "center" });

  // Rodapé com paginação
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text("SIGMO · Módulo Psicossocial NR-01 · Documento sujeito a auditoria (LGPD/ISO 45003)", M, H - 6);
    doc.text(`Página ${p} de ${pageCount}`, W - M, H - 6, { align: "right" });
  }

  return doc;
}

/* ============ Heatmap 5x5 ============ */
function drawMatrizHeatmap(doc: jsPDF, startY: number, agregado: AgregadoLinha[], ghes: GheInfo[]): number {
  const M = 12;
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const BOTTOM = 14;
  const dims = Object.keys(DIMENSAO_LABEL);
  const gheIds = Array.from(new Set(agregado.map((l) => l.ghe_id))).filter(Boolean);

  const gheColW = 40;
  const cellW = (W - M * 2 - gheColW) / dims.length;
  const rowH = 10;
  const headerH = 18;

  let y = startY;

  const drawHeader = () => {
    doc.setFillColor(15, 23, 42);
    doc.rect(M, y, W - M * 2, headerH, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("GHE", M + 2, y + headerH / 2 + 1);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    dims.forEach((d, i) => {
      const cx = M + gheColW + i * cellW + cellW / 2;
      const label = DIMENSAO_LABEL[d as keyof typeof DIMENSAO_LABEL] ?? d;
      const words = label.split(" ");
      const mid = Math.ceil(words.length / 2);
      const l1 = words.slice(0, mid).join(" ");
      const l2 = words.slice(mid).join(" ");
      doc.text(l1, cx, y + 7, { align: "center" });
      if (l2) doc.text(l2, cx, y + 12.5, { align: "center" });
    });
    y += headerH;
  };
  let matrixTop = y;
  drawHeader();

  // rows
  gheIds.forEach((gid) => {
    // quebra de página preservando cabeçalho da matriz
    if (y + rowH > H - BOTTOM) {
      // fecha borda da parte anterior
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.rect(M, matrixTop, W - M * 2, y - matrixTop);
      doc.addPage();
      y = M;
      matrixTop = y;
      drawHeader();
    }
    const g = ghes.find((x) => x.id === gid);
    const rotulo = g ? `GHE ${g.numero} — ${g.setor}` : String(gid).slice(0, 10);

    // linha zebra
    doc.setFillColor(248, 250, 252);
    doc.rect(M, y, gheColW, rowH, "F");
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(truncate(rotulo, 26), M + 2, y + rowH / 2 + 1);

    dims.forEach((d, i) => {
      const cell = agregado.find((l) => l.ghe_id === gid && l.dimensao === d);
      const x = M + gheColW + i * cellW;
      if (!cell || cell.suprimido || cell.media == null) {
        doc.setFillColor(241, 245, 249);
        doc.rect(x, y, cellW, rowH, "F");
        doc.setTextColor(148, 163, 184);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.text(cell?.suprimido ? "🔒" : "—", x + cellW / 2, y + rowH / 2 + 1, { align: "center" });
      } else {
        const media = Number(cell.media);
        const [rr, gg, bb] = corMedia(media, d);
        doc.setFillColor(rr, gg, bb);
        doc.rect(x, y, cellW, rowH, "F");
        doc.setTextColor(rr + gg + bb > 500 ? 15 : 255, rr + gg + bb > 500 ? 23 : 255, rr + gg + bb > 500 ? 42 : 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.text(media.toFixed(1), x + cellW / 2, y + rowH / 2 + 1, { align: "center" });
      }
    });
    // bordas
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.4);
    for (let i = 0; i <= dims.length; i++) {
      const gx = M + gheColW + i * cellW;
      doc.line(gx, y, gx, y + rowH);
    }
    y += rowH;
  });

  // borda externa
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.rect(M, matrixTop, W - M * 2, y - matrixTop);

  return y + 4;
}

function legendaCores(doc: jsPDF, startY: number): number {
  const M = 12;
  const boxes: Array<{ cor: [number, number, number]; label: string }> = [
    { cor: COR_BAIXO, label: "< 2,0 · Baixo" },
    { cor: COR_MOD, label: "2,0-2,9 · Moderado" },
    { cor: COR_ALTO, label: "3,0-3,9 · Alto" },
    { cor: COR_CRIT, label: "≥ 4,0 · Crítico" },
  ];
  let x = M;
  const y = startY;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text("Legenda:", x, y + 3);
  x += 15;
  for (const b of boxes) {
    doc.setFillColor(b.cor[0], b.cor[1], b.cor[2]);
    doc.rect(x, y, 4, 4, "F");
    doc.setTextColor(30, 41, 59);
    doc.text(b.label, x + 5.5, y + 3);
    x += 40;
  }
  return y + 8;
}

/* ============ util ============ */
function sectionTitle(doc: jsPDF, texto: string, y: number): number {
  const M = 12;
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  if (y > H - 20) { doc.addPage(); y = M; }
  doc.setFillColor(15, 23, 42);
  doc.rect(M, y, W - M * 2, 6.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text(texto, M + 2, y + 4.6);
  doc.setTextColor(0, 0, 0);
  return y + 10;
}

function paragraph(doc: jsPDF, texto: string, y: number): number {
  const M = 12;
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  const lines = doc.splitTextToSize(texto, W - M * 2);
  for (const l of lines) {
    if (y > H - 15) { doc.addPage(); y = M; }
    doc.text(l, M, y);
    y += 4.5;
  }
  return y + 2;
}

function bullet(doc: jsPDF, texto: string, y: number): number {
  const M = 12;
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  const lines = doc.splitTextToSize(texto, W - M * 2 - 5);
  for (let i = 0; i < lines.length; i++) {
    if (y > H - 15) { doc.addPage(); y = M; }
    doc.text(i === 0 ? "•" : " ", M, y);
    doc.text(lines[i], M + 4, y);
    y += 4.5;
  }
  return y + 1;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function fmtBR(d: string): string {
  if (!d) return "";
  const [y, m, day] = d.split("T")[0].split("-");
  return y && m && day ? `${day}/${m}/${y}` : d;
}