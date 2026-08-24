// Relatório de Avaliação dos Simulados de Emergência (consolidado anual).
// Sustenta o cronograma FOR-SEG 12 em auditoria: previsto x realizado,
// tempos médios, falhas recorrentes e parecer técnico assinado.
import jsPDF from "jspdf";
import { drawPdfHeader } from "@/lib/pdf-header";
import { MESES_ABREV, type MesMarca } from "@/lib/simulado-cronograma-pdf";

export type RelSimuladoLinha = {
  descricao: string;
  meses: MesMarca[];
};

export type RelSimuladoExecucao = {
  cenario: string;
  data_simulado: string;
  local?: string | null;
  escopo?: string | null;
  com_aviso?: boolean | null;
  tempo_abandono_seg?: number | null;
  tempo_total_seg?: number | null;
  qtd_participantes?: number | null;
  conceito?: string | null;
  nota?: number | null;
  falhas?: string | null;
  pontos_positivos?: string | null;
};

export type RelSimuladoParams = {
  empresa: string;
  ano: number;
  linhas: RelSimuladoLinha[];
  execucoes: RelSimuladoExecucao[];
  parecer?: string | null;
  responsavelNome?: string | null;
  assinatura?: string | null;
};

function br(d?: string | null) {
  if (!d) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
}

function mmss(s?: number | null) {
  if (s == null) return "—";
  const mn = Math.floor(s / 60);
  const sc = s % 60;
  return `${mn}m${String(sc).padStart(2, "0")}s`;
}

export function buildSimuladoRelatorioPdf(p: RelSimuladoParams): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 12;

  const planejados = p.linhas.reduce((a, l) => a + l.meses.filter((m) => m === "P" || m === "R" || m === "T").length, 0);
  const realizados = p.linhas.reduce((a, l) => a + l.meses.filter((m) => m === "R").length, 0);
  const transferidos = p.linhas.reduce((a, l) => a + l.meses.filter((m) => m === "T").length, 0);
  const aderencia = planejados ? Math.round((realizados / planejados) * 100) : 0;

  let y = drawPdfHeader(doc, {
    titulo: `RELATÓRIO DE AVALIAÇÃO DOS SIMULADOS DE EMERGÊNCIA — ${p.ano}`,
    subtitulo: `${p.empresa} · base: cronograma FOR-SEG 12 · NBR 15219 4.6.1 / NR-01 / NR-33 / NR-35`,
    responsavel: p.responsavelNome ?? undefined,
    kpis: [
      { label: "Previstos", value: planejados, tone: "neutral" },
      { label: "Realizados", value: realizados, tone: "success" },
      { label: "Transferidos", value: transferidos, tone: "warning" },
      { label: "Aderência", value: `${aderencia}%`, tone: aderencia >= 90 ? "success" : aderencia >= 70 ? "warning" : "danger" },
    ],
  });

  const nl = (h = 6) => { y += h; if (y > H - 30) { doc.addPage(); y = 20; } };
  const titulo = (t: string) => {
    nl(8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(178, 34, 34);
    doc.text(t, M, y);
    doc.setDrawColor(178, 34, 34);
    doc.setLineWidth(0.4);
    doc.line(M, y + 1.5, W - M, y + 1.5);
    doc.setTextColor(15, 23, 42);
    nl(6);
  };

  // ============ 1. Previsto x realizado por cenário ============
  titulo("1. PREVISTO x REALIZADO POR CENÁRIO");
  const colDesc = 78;
  const mesW = (W - 2 * M - colDesc) / 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("CENÁRIO", M + 1, y);
  MESES_ABREV.forEach((mm, i) => doc.text(mm, M + colDesc + mesW * i + mesW / 2, y, { align: "center" }));
  nl(3);
  doc.setDrawColor(200, 200, 200);
  doc.line(M, y, W - M, y);
  doc.setFont("helvetica", "normal");

  p.linhas.forEach((l) => {
    nl(6);
    const lines = doc.splitTextToSize(l.descricao, colDesc - 3) as string[];
    lines.slice(0, 2).forEach((t, i) => doc.text(t, M + 1, y + i * 3));
    l.meses.forEach((mk, i) => {
      const cx = M + colDesc + mesW * i + mesW / 2;
      if (!mk) return;
      const label = mk === "R" ? "R" : mk === "T" ? "T" : "P";
      if (mk === "R") doc.setTextColor(22, 163, 74);
      else if (mk === "T") doc.setTextColor(202, 138, 4);
      else doc.setTextColor(100, 116, 139);
      doc.setFont("helvetica", "bold");
      doc.text(label, cx, y, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);
    });
    if (lines.length > 1) nl(3);
  });
  nl(4);
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("Legenda: P = planejado · R = realizado · T = transferido", M, y);
  doc.setTextColor(15, 23, 42);

  // ============ 2. Simulados executados ============
  titulo("2. SIMULADOS EXECUTADOS");
  if (!p.execucoes.length) {
    doc.setFontSize(9);
    doc.text("Nenhum simulado registrado no período.", M, y);
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    const cols = [
      { t: "DATA", x: M, w: 18 },
      { t: "CENÁRIO", x: M + 18, w: 60 },
      { t: "ESCOPO", x: M + 78, w: 20 },
      { t: "AVISO", x: M + 98, w: 16 },
      { t: "ABANDONO", x: M + 114, w: 22 },
      { t: "TOTAL", x: M + 136, w: 20 },
      { t: "PART.", x: M + 156, w: 14 },
      { t: "CONCEITO", x: M + 170, w: W - M - (M + 170) },
    ];
    cols.forEach((c) => doc.text(c.t, c.x + 1, y));
    nl(2.5);
    doc.setDrawColor(200, 200, 200);
    doc.line(M, y, W - M, y);
    doc.setFont("helvetica", "normal");
    p.execucoes.forEach((e) => {
      nl(5.5);
      const vals = [
        br(e.data_simulado),
        e.cenario,
        e.escopo ?? "—",
        e.com_aviso ? "COM" : "SEM",
        mmss(e.tempo_abandono_seg),
        mmss(e.tempo_total_seg),
        String(e.qtd_participantes ?? 0),
        e.conceito ?? (e.nota != null ? String(e.nota) : "—"),
      ];
      cols.forEach((c, i) => {
        const t = (doc.splitTextToSize(vals[i] ?? "", c.w - 2) as string[])[0] ?? "";
        doc.text(t, c.x + 1, y);
      });
    });
  }

  // ============ 3. Falhas e oportunidades ============
  titulo("3. FALHAS OBSERVADAS E OPORTUNIDADES DE MELHORIA");
  doc.setFontSize(8.5);
  const comFalhas = p.execucoes.filter((e) => (e.falhas ?? "").trim());
  if (!comFalhas.length) {
    doc.text("Nenhuma falha registrada nos simulados do período.", M, y);
  } else {
    comFalhas.forEach((e) => {
      doc.setFont("helvetica", "bold");
      doc.text(`${br(e.data_simulado)} — ${e.cenario}`, M, y);
      doc.setFont("helvetica", "normal");
      (doc.splitTextToSize(e.falhas ?? "", W - 2 * M - 4) as string[]).forEach((t) => { nl(4.2); doc.text(t, M + 3, y); });
      nl(5);
    });
  }

  // ============ 4. Parecer técnico ============
  titulo("4. PARECER TÉCNICO");
  doc.setFontSize(8.5);
  const parecer = (p.parecer ?? "").trim() ||
    `No exercício de ${p.ano} foram previstos ${planejados} simulados, dos quais ${realizados} foram realizados (${aderencia}% de aderência) e ${transferidos} transferidos. ` +
    `A programação atende à exigência de exercício simulado com periodicidade mínima anual (ABNT NBR 15219 4.6.1), aos requisitos de resgate em espaço confinado (NR-33) e trabalho em altura (NR-35), ` +
    `e integra o item de preparação e resposta a emergências do PGR (NR-01).`;
  (doc.splitTextToSize(parecer, W - 2 * M) as string[]).forEach((t) => { doc.text(t, M, y); nl(4.4); });

  // ============ Assinatura ============
  nl(14);
  if (y > H - 45) { doc.addPage(); y = 30; }
  const sx = W / 2;
  if (p.assinatura) {
    try { doc.addImage(p.assinatura, "PNG", sx - 30, y - 14, 60, 16, undefined, "FAST"); } catch { /* ignora assinatura inválida */ }
  }
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.3);
  doc.line(sx - 40, y + 3, sx + 40, y + 3);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.text(p.responsavelNome ?? "Responsável Técnico — SESMT", sx, y + 8, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Técnico de Segurança do Trabalho", sx, y + 12, { align: "center" });

  return doc;
}
