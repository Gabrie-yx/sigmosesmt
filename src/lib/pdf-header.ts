import type jsPDF from "jspdf";
import dmnLogo from "@/assets/dmn-logo.png";
import { EMPRESA_INFO } from "./empresa-info";

export type PdfHeaderOpts = {
  titulo: string;
  subtitulo?: string;
  responsavel?: string | null;
  filtros?: string[];
  /** texto extra a aparecer abaixo (ex.: totais). Renderizado em negrito. */
  destaque?: string;
  /** KPIs renderizados como cartões na faixa institucional (lado direito). */
  kpis?: PdfHeaderKpi[];
};

export type PdfHeaderKpi = {
  label: string;
  value: string | number;
  tone?: "danger" | "warning" | "success" | "neutral";
};

const TONE_COLORS: Record<NonNullable<PdfHeaderKpi["tone"]>, [number, number, number]> = {
  danger: [220, 38, 38],
  warning: [202, 138, 4],
  success: [22, 163, 74],
  neutral: [15, 23, 42],
};

/**
 * Cabeçalho institucional padrão para relatórios SIGMO.
 * Renderiza: faixa superior com logo + razão social + CNPJ + endereço,
 * faixa de título do relatório, e linha de metadados (emissão / responsável / filtros).
 *
 * Retorna o Y (mm) onde o conteúdo do documento deve começar.
 */
export function drawPdfHeader(doc: jsPDF, opts: PdfHeaderOpts): number {
  const W = doc.internal.pageSize.getWidth();
  const M = 12;

  // ============== Faixa institucional ==============
  const instH = 24;
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, W, instH, "F");

  // Logo
  const logoH = 16;
  const logoW = 28;
  try {
    doc.addImage(dmnLogo as unknown as string, "PNG", M, 3, logoW, logoH, undefined, "FAST");
  } catch {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(178, 34, 34);
    doc.text("DMN", M + logoW / 2, 12, { align: "center" });
  }

  // Dados da empresa (à direita do logo)
  const infoX = M + logoW + 6;
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(EMPRESA_INFO.razao_social, infoX, 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(`CNPJ ${EMPRESA_INFO.cnpj}`, infoX, 11.5);
  doc.text(EMPRESA_INFO.endereco, infoX, 15);
  doc.text(`${EMPRESA_INFO.cidade_uf_cep}   ·   ${EMPRESA_INFO.contato}`, infoX, 18.5);

  // ============== KPI cards (lado direito da faixa institucional) ==============
  if (opts.kpis && opts.kpis.length) {
    const kpis = opts.kpis.slice(0, 4);
    const cardH = 16;
    const gap = 3;
    const cardW = 34;
    const totalW = kpis.length * cardW + (kpis.length - 1) * gap;
    let cx = W - M - totalW;
    const cy = (instH - cardH) / 2;
    for (const k of kpis) {
      const tone = TONE_COLORS[k.tone ?? "neutral"];
      // fundo claro
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.roundedRect(cx, cy, cardW, cardH, 1.5, 1.5, "FD");
      // barra lateral colorida
      doc.setFillColor(tone[0], tone[1], tone[2]);
      doc.rect(cx, cy, 1.6, cardH, "F");
      // valor
      doc.setTextColor(tone[0], tone[1], tone[2]);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(String(k.value), cx + 4, cy + 8);
      // label
      doc.setTextColor(71, 85, 105);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text(k.label.toUpperCase(), cx + 4, cy + 13);
      cx += cardW + gap;
    }
  }

  // Linha divisória fina
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.line(M, instH, W - M, instH);

  // ============== Faixa de título do relatório ==============
  const titleY = instH + 1;
  const titleH = 9;
  doc.setFillColor(15, 23, 42);
  doc.rect(0, titleY, W, titleH, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(opts.titulo.toUpperCase(), M, titleY + 6);
  if (opts.subtitulo) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(opts.subtitulo, W / 2, titleY + 6, { align: "center" });
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(
    `Emitido em ${new Date().toLocaleString("pt-BR")}`,
    W - M,
    titleY + 6,
    { align: "right" },
  );

  // ============== Metadados (linha única, fonte maior) ==============
  let y = titleY + titleH + 6;
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const meta: string[] = [];
  if (opts.responsavel) meta.push(`Responsável: ${opts.responsavel}`);
  if (opts.filtros && opts.filtros.length) meta.push(...opts.filtros);
  if (meta.length) {
    doc.text(meta.join("   ·   "), M, y);
    y += 5;
  }
  // destaque só renderiza quando não há KPIs (compat)
  if (opts.destaque && (!opts.kpis || !opts.kpis.length)) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(opts.destaque, M, y);
    y += 4.5;
  }

  doc.setTextColor(0, 0, 0);
  return y + 1;
}
