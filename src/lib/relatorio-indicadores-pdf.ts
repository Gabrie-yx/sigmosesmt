import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import dmnLogo from "@/assets/dmn-logo.png";
import { EMPRESA_INFO } from "./empresa-info";

/* ============================================================================
 * RELATÓRIO DE INDICADORES DE SST — mensal / trimestral
 * Cabeçalho institucional idêntico ao Termo de Consentimento (logo + dados da
 * empresa + linha vinho). Abaixo da linha muda apenas o nome do documento.
 * Gráficos vetoriais nativos em jsPDF (sem html2canvas): gauges, barras,
 * séries mensais e donut.
 * ==========================================================================*/

export type IndicadorTipo = "PCT" | "QTD";

export type IndicadorReport = {
  codigo: string;              // "01"
  nome: string;                // "Zero Acidentes"
  descricao: string;           // fórmula / critério
  tipo: IndicadorTipo;
  valor: number;               // % (0-100) ou quantidade
  meta: number;                // % ou quantidade máxima
  /** true = quanto MENOR melhor (ex.: acidentes) */
  menorMelhor?: boolean;
  unidade?: string;            // "%", "acid.", "dias"
  detalhe?: string;            // "45 de 65 realizados"
  analise?: string;            // texto de análise crítica
};

export type SerieMensal = { mes: string; valor: number; meta?: number };

export type BarraSimples = { nome: string; valor: number; meta?: number };

export type FatiaDonut = { nome: string; valor: number; cor: [number, number, number] };

export type RelatorioIndicadoresParams = {
  periodicidade: "MENSAL" | "TRIMESTRAL";
  periodoLabel: string;              // "Junho / 2026" | "2º Trimestre / 2026"
  intervaloLabel: string;            // "01/04/2026 a 30/06/2026"
  empresaLabel?: string | null;      // "Todas as empresas" | nome
  totalColaboradores?: number;
  indicadores: IndicadorReport[];
  serieAcidentes: SerieMensal[];     // 12 meses
  serieDds: SerieMensal[];           // realizados x planejados por mês
  serieDdsPlanejado?: SerieMensal[];
  treinamentosNR: BarraSimples[];
  asoDonut: FatiaDonut[];
  conclusao?: string;
  responsavelNome?: string | null;
  responsavelCargo?: string | null;
  responsavelRegistro?: string | null;
  assinaturaDataUrl?: string | null;
  gestorNome?: string | null;
  gestorCargo?: string | null;
  assinaturaGestorDataUrl?: string | null;
  cidade?: string | null;
  dataExtenso?: string | null;
};

const VINHO: [number, number, number] = [178, 34, 34];
const SLATE: [number, number, number] = [15, 23, 42];
const CINZA: [number, number, number] = [100, 116, 139];
const VERDE: [number, number, number] = [16, 185, 129];
const AMBAR: [number, number, number] = [217, 119, 6];
const VERMELHO: [number, number, number] = [220, 38, 38];

function statusCor(i: IndicadorReport): [number, number, number] {
  const atingiu = i.menorMelhor ? i.valor <= i.meta : i.valor >= i.meta;
  if (atingiu) return VERDE;
  const razao = i.menorMelhor
    ? (i.meta + 1) / (i.valor + 1)
    : i.meta > 0 ? i.valor / i.meta : 1;
  return razao >= 0.8 ? AMBAR : VERMELHO;
}

function statusTexto(i: IndicadorReport): string {
  const atingiu = i.menorMelhor ? i.valor <= i.meta : i.valor >= i.meta;
  if (atingiu) return "ATENDIDO";
  const razao = i.menorMelhor
    ? (i.meta + 1) / (i.valor + 1)
    : i.meta > 0 ? i.valor / i.meta : 1;
  return razao >= 0.8 ? "ATENÇÃO" : "NÃO ATENDIDO";
}

export function gerarRelatorioIndicadoresPDF(p: RelatorioIndicadoresParams): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 16;
  const maxW = W - M * 2;
  const FOOT = H - 20;

  const nomeDoc =
    p.periodicidade === "MENSAL"
      ? "RELATÓRIO MENSAL DE INDICADORES DE SST"
      : "RELATÓRIO TRIMESTRAL DE INDICADORES DE SST";

  let y = 0;

  /* ------------------------------- header ------------------------------- */
  const drawHeader = () => {
    const top = 12;
    const logoW = 30;
    const logoH = 17;
    try {
      doc.addImage(dmnLogo as unknown as string, "PNG", M, top, logoW, logoH, undefined, "FAST");
    } catch { /* logo opcional */ }
    const infoX = M + logoW + 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...SLATE);
    doc.text(EMPRESA_INFO.razao_social, infoX, top + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(`CNPJ ${EMPRESA_INFO.cnpj}`, infoX, top + 9.5);
    doc.text(EMPRESA_INFO.endereco, infoX, top + 13);
    doc.text(`${EMPRESA_INFO.cidade_uf_cep}   ·   ${EMPRESA_INFO.contato}`, infoX, top + 16.5);
    doc.setDrawColor(...VINHO);
    doc.setLineWidth(0.6);
    doc.line(M, top + logoH + 3, W - M, top + logoH + 3);
    doc.setLineWidth(0.2);
    doc.setTextColor(...SLATE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(nomeDoc, M, top + logoH + 8.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...CINZA);
    doc.text(
      `${p.periodoLabel}  ·  ${p.intervaloLabel}  ·  ${p.empresaLabel ?? "Todas as empresas"}`,
      M, top + logoH + 12.5,
    );
    doc.setTextColor(0, 0, 0);
    return top + logoH + 19;
  };

  const novaPagina = () => { doc.addPage(); y = drawHeader(); };
  const ensure = (need: number) => { if (y + need > FOOT) novaPagina(); };

  const titulo = (txt: string, need = 0) => {
    ensure(14 + need);
    y += 2;
    doc.setFillColor(241, 245, 249);
    doc.rect(M, y - 4.4, maxW, 6.8, "F");
    doc.setDrawColor(...VINHO);
    doc.setLineWidth(1);
    doc.line(M, y - 4.4, M, y + 2.4);
    doc.setLineWidth(0.2);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...SLATE);
    doc.text(txt.toUpperCase(), M + 3, y);
    doc.setTextColor(0, 0, 0);
    y += 9;
  };

  /** Quebra manual por largura real do texto (evita esticar/truncar). */
  const wrap = (txt: string, width: number, size: number, style: "normal" | "bold" = "normal") => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    const out: string[] = [];
    String(txt ?? "").split(/\r?\n/).forEach((par) => {
      let cur = "";
      par.split(/\s+/).filter(Boolean).forEach((wd) => {
        const test = cur ? `${cur} ${wd}` : wd;
        if (doc.getTextWidth(test) <= width || !cur) cur = test;
        else { out.push(cur); cur = wd; }
      });
      out.push(cur);
    });
    return out.length ? out : [""];
  };

  /** Desenha linha a linha, quebrando página quando necessário. */
  const drawLines = (lines: string[], x: number, size: number, lh: number, style: "normal" | "bold" = "normal") => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    lines.forEach((ln) => {
      ensure(lh + 2);
      doc.text(ln, x, y);
      y += lh;
    });
  };

  const paragrafo = (txt: string, size = 9) => {
    const lines = wrap(txt, maxW, size);
    drawLines(lines, M, size, 4.3);
    y += 2;
    doc.setTextColor(0, 0, 0);
  };

  /* ------------------------------ gauge donut ---------------------------- */
  const gauge = (cx: number, cy: number, r: number, pct: number, cor: [number, number, number], label: string, valorTxt: string) => {
    const clamped = Math.max(0, Math.min(100, pct));
    // trilha
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(3.2);
    circleArc(doc, cx, cy, r, 0, 360);
    // progresso
    doc.setDrawColor(...cor);
    doc.setLineWidth(3.2);
    if (clamped > 0) circleArc(doc, cx, cy, r, -90, -90 + (clamped / 100) * 360);
    doc.setLineWidth(0.2);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...cor);
    doc.text(valorTxt, cx, cy + 1.4, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.6);
    doc.setTextColor(...CINZA);
    const l = (doc.splitTextToSize(label, r * 3.4) as string[]).slice(0, 2);
    l.forEach((ln, i) => doc.text(ln, cx, cy + r + 4.6 + i * 3.2, { align: "center" }));
    doc.setTextColor(0, 0, 0);
    // retorna o Y logo abaixo do bloco de rótulo
    return cy + r + 4.6 + l.length * 3.2;
  };

  /* --------------------------- barras verticais -------------------------- */
  const barrasMensais = (
    x: number, top: number, w: number, h: number,
    serie: SerieMensal[], cor: [number, number, number],
    serieB?: SerieMensal[], corB?: [number, number, number],
  ) => {
    const maxV = Math.max(
      1,
      ...serie.map((s) => s.valor),
      ...(serieB ?? []).map((s) => s.valor),
    );
    const baseY = top + h;
    // grade
    doc.setDrawColor(232, 237, 243);
    doc.setLineWidth(0.15);
    for (let i = 0; i <= 4; i++) {
      const gy = top + (h / 4) * i;
      doc.line(x, gy, x + w, gy);
      doc.setFontSize(5.6);
      doc.setTextColor(148, 163, 184);
      doc.text(String(Math.round(maxV - (maxV / 4) * i)), x - 1.5, gy + 1, { align: "right" });
    }
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(x, baseY, x + w, baseY);

    const n = serie.length || 1;
    const slot = w / n;
    const dual = !!serieB;
    const bw = dual ? Math.min(4.2, slot * 0.32) : Math.min(6.5, slot * 0.55);
    serie.forEach((s, i) => {
      const cxs = x + slot * i + slot / 2;
      const bh = (s.valor / maxV) * h;
      const bx = dual ? cxs - bw - 0.6 : cxs - bw / 2;
      doc.setFillColor(...cor);
      if (bh > 0.4) doc.roundedRect(bx, baseY - bh, bw, bh, 0.5, 0.5, "F");
      if (dual && corB) {
        const b2 = serieB![i]?.valor ?? 0;
        const bh2 = (b2 / maxV) * h;
        doc.setFillColor(...corB);
        if (bh2 > 0.4) doc.roundedRect(cxs + 0.6, baseY - bh2, bw, bh2, 0.5, 0.5, "F");
      }
      doc.setFontSize(5.6);
      doc.setTextColor(100, 116, 139);
      doc.text(s.mes, cxs, baseY + 3.4, { align: "center" });
      if (!dual && s.valor > 0) {
        doc.setFontSize(5.8);
        doc.setTextColor(...cor);
        doc.text(String(s.valor), cxs, baseY - bh - 1.2, { align: "center" });
      }
    });
    doc.setTextColor(0, 0, 0);
  };

  /* -------------------------- barras horizontais ------------------------- */
  const barrasHorizontais = (x: number, top: number, w: number, itens: BarraSimples[], meta?: number) => {
    const rowH = 6.6;
    const labelW = 26;
    itens.forEach((it, i) => {
      const ry = top + i * rowH;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...SLATE);
      doc.text(it.nome.slice(0, 16), x, ry + 3.2);
      const trackX = x + labelW;
      const trackW = w - labelW - 12;
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(trackX, ry, trackW, 4.2, 1, 1, "F");
      const pct = Math.max(0, Math.min(100, it.valor));
      const cor: [number, number, number] =
        meta === undefined || pct >= meta ? VERDE : pct >= meta * 0.8 ? AMBAR : VERMELHO;
      doc.setFillColor(...cor);
      if (pct > 0) doc.roundedRect(trackX, ry, (trackW * pct) / 100, 4.2, 1, 1, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...cor);
      doc.text(`${pct}%`, trackX + trackW + 2, ry + 3.2);
    });
    doc.setTextColor(0, 0, 0);
    return top + itens.length * rowH;
  };

  /* -------------------------------- donut -------------------------------- */
  const donut = (cx: number, cy: number, r: number, fatias: FatiaDonut[]) => {
    const total = fatias.reduce((s, f) => s + f.valor, 0);
    if (total <= 0) return;
    let ang = -90;
    doc.setLineWidth(6);
    fatias.forEach((f) => {
      const sweep = (f.valor / total) * 360;
      doc.setDrawColor(...f.cor);
      circleArc(doc, cx, cy, r, ang, ang + sweep);
      ang += sweep;
    });
    doc.setLineWidth(0.2);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...SLATE);
    doc.text(String(total), cx, cy + 1.5, { align: "center" });
    doc.setTextColor(0, 0, 0);
  };

  const legenda = (x: number, top: number, fatias: FatiaDonut[]) => {
    fatias.forEach((f, i) => {
      const ly = top + i * 5;
      doc.setFillColor(...f.cor);
      doc.roundedRect(x, ly - 2.2, 3, 3, 0.6, 0.6, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...SLATE);
      doc.text(`${f.nome}: ${f.valor}`, x + 4.5, ly + 0.4);
    });
    doc.setTextColor(0, 0, 0);
  };

  /* ================================ PÁGINA 1 ============================= */
  y = drawHeader();

  titulo("1. Objetivo e escopo");
  paragrafo(
    `Este relatório apresenta a medição e a análise crítica dos indicadores de Segurança e Saúde no Trabalho ` +
    `da ${EMPRESA_INFO.razao_social}, referentes ao período de ${p.intervaloLabel} (${p.periodoLabel}), ` +
    `em atendimento aos requisitos de monitoramento, medição, análise e avaliação de desempenho da ISO 45001:2018 (item 9.1) ` +
    `e ao acompanhamento do PGR previsto na NR-01 (itens 1.5.4 e 1.5.7). ` +
    (p.totalColaboradores ? `População considerada: ${p.totalColaboradores} colaboradores ativos. ` : "") +
    `Fonte dos dados: SIGMO — Sistema de Gestão Integrada SST.`,
  );

  /* --------------------------- painel de gauges --------------------------- */
  titulo("2. Painel resumo dos indicadores");
  {
    const cols = 3;
    const cellW = maxW / cols;
    const r = 10.5;
    const rowH = 46;
    const rows = Math.ceil(p.indicadores.length / cols);
    ensure(rows * rowH + 4);
    p.indicadores.forEach((ind, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = M + cellW * col + cellW / 2;
      const cy = y + row * rowH + r + 2;
      const cor = statusCor(ind);
      const pctGauge = ind.tipo === "PCT"
        ? ind.valor
        : ind.menorMelhor
          ? (ind.valor <= ind.meta ? 100 : Math.max(5, Math.round((ind.meta / Math.max(1, ind.valor)) * 100)))
          : Math.min(100, Math.round((ind.valor / Math.max(1, ind.meta)) * 100));
      const valorTxt = ind.tipo === "PCT" ? `${ind.valor}%` : String(ind.valor);
      const afterLabel = gauge(cx, cy, r, pctGauge, cor, `${ind.codigo} · ${ind.nome}`, valorTxt);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6);
      doc.setTextColor(...cor);
      doc.text(statusTexto(ind), cx, afterLabel + 1.6, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...CINZA);
      doc.setFontSize(6);
      doc.text(
        `Meta: ${ind.menorMelhor ? "≤" : "≥"} ${ind.meta}${ind.tipo === "PCT" ? "%" : ""}`,
        cx, afterLabel + 5.2, { align: "center" },
      );
      doc.setTextColor(0, 0, 0);
    });
    y += rows * rowH + 4;
  }

  /* ------------------------------- tabela -------------------------------- */
  titulo("3. Quadro de medição");
  autoTable(doc, {
    startY: y,
    head: [["#", "Indicador", "Medido", "Meta", "Situação", "Apuração"]],
    body: p.indicadores.map((i) => [
      i.codigo,
      i.nome,
      i.tipo === "PCT" ? `${i.valor}%` : `${i.valor}${i.unidade ? " " + i.unidade : ""}`,
      `${i.menorMelhor ? "≤" : "≥"} ${i.meta}${i.tipo === "PCT" ? "%" : ""}`,
      statusTexto(i),
      i.detalhe ?? "—",
    ]),
    theme: "grid",
    margin: { left: M, right: M },
    styles: { fontSize: 7.6, cellPadding: 1.8, lineColor: [226, 232, 240], textColor: [15, 23, 42] },
    headStyles: { fillColor: SLATE, textColor: 255, fontSize: 7.4, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      2: { cellWidth: 18, halign: "center", fontStyle: "bold" },
      3: { cellWidth: 18, halign: "center" },
      4: { cellWidth: 24, halign: "center", fontStyle: "bold" },
    },
    didParseCell: (d) => {
      if (d.section === "body" && d.column.index === 4) {
        const ind = p.indicadores[d.row.index];
        if (ind) d.cell.styles.textColor = statusCor(ind);
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  /* ------------------------------- gráficos ------------------------------- */
  titulo("4. Evolução e distribuição");
  {
    const halfW = (maxW - 8) / 2;
    ensure(52);
    // acidentes
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.6);
    doc.setTextColor(...SLATE);
    doc.text("Acidentes registráveis por mês (12 meses)", M, y);
    barrasMensais(M + 6, y + 4, halfW - 8, 30, p.serieAcidentes, VERMELHO);
    // dds
    doc.text("DDS planejado x realizado", M + halfW + 8, y);
    barrasMensais(
      M + halfW + 14, y + 4, halfW - 12, 30,
      p.serieDdsPlanejado ?? p.serieDds, [148, 163, 184],
      p.serieDds, VERDE,
    );
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(...CINZA);
    doc.text("cinza = planejado   ·   verde = realizado", M + halfW + 14, y + 42);
    doc.setTextColor(0, 0, 0);
    y += 48;
  }
  {
    const halfW = (maxW - 8) / 2;
    ensure(48);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.6);
    doc.setTextColor(...SLATE);
    doc.text("Treinamentos NR válidos (% por curso)", M, y);
    const fim = barrasHorizontais(M, y + 4, halfW, p.treinamentosNR.slice(0, 6), 90);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.6);
    doc.setTextColor(...SLATE);
    doc.text("ASO / PCMSO — situação", M + halfW + 8, y);
    donut(M + halfW + 8 + 16, y + 20, 12, p.asoDonut);
    legenda(M + halfW + 8 + 34, y + 12, p.asoDonut);
    doc.setTextColor(0, 0, 0);
    y = Math.max(fim, y + 40) + 6;
  }

  /* --------------------------- análise crítica ---------------------------- */
  titulo("5. Análise crítica por indicador");
  p.indicadores.forEach((ind) => {
    ensure(14);
    const cor = statusCor(ind);
    doc.setFillColor(...cor);
    doc.roundedRect(M, y - 3, 1.6, 5.5, 0.4, 0.4, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.2);
    doc.setTextColor(...SLATE);
    doc.text(`${ind.codigo} · ${ind.nome} — ${statusTexto(ind)}`, M + 4, y);
    y += 4.2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    const txt = ind.analise
      ?? `${ind.descricao} Resultado de ${ind.tipo === "PCT" ? `${ind.valor}%` : ind.valor} frente à meta de ${ind.menorMelhor ? "≤" : "≥"} ${ind.meta}${ind.tipo === "PCT" ? "%" : ""}.`;
    const lines = doc.splitTextToSize(txt, maxW - 4) as string[];
    ensure(lines.length * 4);
    doc.text(lines, M + 4, y);
    y += lines.length * 4 + 3;
    doc.setTextColor(0, 0, 0);
  });

  /* ------------------------------ conclusão ------------------------------- */
  if (p.conclusao?.trim()) {
    titulo("6. Conclusão e encaminhamentos");
    paragrafo(p.conclusao.trim());
  }

  /* ------------------------------ assinaturas ----------------------------- */
  ensure(50);
  y = Math.max(y + 6, FOOT - 44);
  const cidade = p.cidade?.trim() || "Manaus/AM";
  const dataExt = p.dataExtenso?.trim() || hojeExtenso();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...SLATE);
  doc.text(`${cidade}, ${dataExt}.`, M, y);
  y += 12;

  const assinaturaBloco = (x: number, w: number, sig: string | null | undefined, nome?: string | null, cargo?: string | null, registro?: string | null) => {
    if (sig) {
      try { doc.addImage(sig, "PNG", x + w / 2 - 22, y - 14, 44, 14, undefined, "FAST"); } catch { /* ignore */ }
    }
    doc.setDrawColor(...SLATE);
    doc.setLineWidth(0.3);
    doc.line(x, y + 1, x + w, y + 1);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.4);
    doc.setTextColor(...SLATE);
    doc.text(nome?.trim() || "____________________", x + w / 2, y + 5.5, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.4);
    doc.setTextColor(...CINZA);
    if (cargo) doc.text(cargo, x + w / 2, y + 9.5, { align: "center" });
    if (registro) doc.text(registro, x + w / 2, y + 13, { align: "center" });
    doc.setTextColor(0, 0, 0);
  };

  const colW = (maxW - 14) / 2;
  assinaturaBloco(M, colW, p.assinaturaDataUrl, p.responsavelNome, p.responsavelCargo || "Responsável Técnico SESMT", p.responsavelRegistro);
  assinaturaBloco(M + colW + 14, colW, p.assinaturaGestorDataUrl, p.gestorNome, p.gestorCargo || "Gestão / Direção");

  /* -------------------------------- rodapé -------------------------------- */
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(M, H - 13, W - M, H - 13);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(...CINZA);
    doc.text(
      `SIGMO · ${nomeDoc} · ${p.periodoLabel} · emitido em ${new Date().toLocaleString("pt-BR")}`,
      M, H - 9,
    );
    doc.text(`Página ${i} de ${total}`, W - M, H - 9, { align: "right" });
  }
  doc.setTextColor(0, 0, 0);

  return doc;
}

/** Arco de círculo desenhado por segmentos de linha (jsPDF não tem arc nativo). */
function circleArc(doc: jsPDF, cx: number, cy: number, r: number, a0: number, a1: number) {
  const steps = Math.max(6, Math.ceil(Math.abs(a1 - a0) / 6));
  const rad = (d: number) => (d * Math.PI) / 180;
  let px = cx + r * Math.cos(rad(a0));
  let py = cy + r * Math.sin(rad(a0));
  for (let i = 1; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    const nx = cx + r * Math.cos(rad(a));
    const ny = cy + r * Math.sin(rad(a));
    doc.line(px, py, nx, ny);
    px = nx; py = ny;
  }
}

const MESES_EXT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function hojeExtenso(d = new Date()): string {
  return `${d.getDate()} de ${MESES_EXT[d.getMonth()]} de ${d.getFullYear()}`;
}