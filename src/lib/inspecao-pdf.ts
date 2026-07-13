import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { drawPdfHeader } from "./pdf-header";
import { printPdf } from "./pdf-print";
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "inspecoes-fotos";

function br(d?: string | null) {
  if (!d) return "—";
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const x = new Date(d);
  return isNaN(x.getTime()) ? d : x.toLocaleDateString("pt-BR");
}

function brDateTime(d?: string | null) {
  if (!d) return "—";
  const x = new Date(d);
  return isNaN(x.getTime()) ? d : x.toLocaleString("pt-BR");
}

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onloadend = () => resolve(fr.result as string);
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch { return null; }
}

export interface InspecaoPdfInput {
  inspecao: any;
  fotos: any[];
  ncs: any[];
  planosPorNc: Record<string, any[]>;
  rubrica: any[];
  responsavelNome?: string | null;
}

export async function gerarInspecaoPdf(input: InspecaoPdfInput) {
  const { inspecao, fotos, ncs, planosPorNc, rubrica, responsavelNome } = input;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 12;

  const empresaNome = inspecao.companies?.nome_fantasia ?? inspecao.companies?.name ?? "—";

  const totMulta = ncs.reduce((s, n) => s + Number(n.multa_estimada ?? 0), 0);
  const totCritico = ncs.filter((n) => n.classe_risco === "CRITICO").length;
  const totAlto = ncs.filter((n) => n.classe_risco === "ALTO").length;

  let y = drawPdfHeader(doc, {
    titulo: "Relatório de Inspeção de Segurança",
    subtitulo: `${inspecao.local_descricao} · ${empresaNome}`,
    responsavel: responsavelNome ?? undefined,
    filtros: [
      `Data: ${br(inspecao.data_inspecao)}`,
      `Status: ${String(inspecao.status ?? "—").toUpperCase()}`,
      inspecao.tipo_local ? `Tipo: ${inspecao.tipo_local}` : "",
    ].filter(Boolean),
    kpis: [
      { label: "NCs", value: ncs.length, tone: "neutral" },
      { label: "Críticas", value: totCritico, tone: "danger" },
      { label: "Altas", value: totAlto, tone: "warning" },
      { label: "Multa NR-28 (R$)", value: totMulta.toLocaleString("pt-BR", { minimumFractionDigits: 2 }), tone: "danger" },
    ],
  });

  y += 4;

  // Escopo / participantes
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text("ESCOPO", M, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const escopo = inspecao.escopo || "Não informado.";
  const lines = doc.splitTextToSize(escopo, W - 2 * M);
  doc.text(lines, M, y + 4);
  y += 4 + lines.length * 4;

  if (inspecao.participantes) {
    y += 2;
    doc.setFont("helvetica", "bold");
    doc.text("PARTICIPANTES", M, y);
    doc.setFont("helvetica", "normal");
    const lp = doc.splitTextToSize(inspecao.participantes, W - 2 * M);
    doc.text(lp, M, y + 4);
    y += 4 + lp.length * 4;
  }

  // ============= NCs =============
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("NÃO CONFORMIDADES E PLANO DE AÇÃO (PDCA)", M, y);
  y += 2;

  if (ncs.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text("Nenhuma NC registrada nesta inspeção.", M, y + 5);
    y += 10;
  } else {
    const rows = ncs.map((nc, i) => {
      const planos = planosPorNc[nc.id] ?? [];
      const planoTxt = planos.length
        ? planos.map((p) => `[${p.fase_pdca}] ${p.acao}${p.responsavel_nome ? ` — ${p.responsavel_nome}` : ""}${p.prazo ? ` (${br(p.prazo)})` : ""}`).join("\n")
        : "Sem plano de ação registrado.";
      const textoOficial = (nc as any).catalogo_nrs_itens?.texto_oficial as string | undefined;
      const descricaoCompleta = textoOficial
        ? `${nc.descricao}\n\nTexto oficial (${nc.nr_codigo}${nc.nr_item ? ` ${nc.nr_item}` : ""}):\n"${textoOficial}"${nc.recomendacao ? `\n\nRecomendação: ${nc.recomendacao}` : ""}`
        : `${nc.descricao}${nc.recomendacao ? `\n\nRecomendação: ${nc.recomendacao}` : ""}`;
      return [
        String(i + 1),
        `${nc.nr_codigo}${nc.nr_item ? `\n${nc.nr_item}` : ""}`,
        descricaoCompleta,
        `${nc.classe_risco}\nP${nc.probabilidade}×S${nc.severidade}=${nc.risco_calculado}`,
        nc.multa_estimada
          ? `${nc.gradacao_nr28}\nR$ ${Number(nc.multa_estimada).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
          : "—",
        planoTxt,
      ];
    });
    autoTable(doc, {
      startY: y + 2,
      head: [["#", "NR", "Descrição", "Risco", "NR-28", "Plano (PDCA)"]],
      body: rows,
      styles: { fontSize: 8, cellPadding: 2, valign: "top" },
      headStyles: { fillColor: [15, 23, 42], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 8, halign: "center" },
        1: { cellWidth: 22 },
        2: { cellWidth: 60 },
        3: { cellWidth: 22, halign: "center" },
        4: { cellWidth: 26, halign: "center" },
        5: { cellWidth: "auto" },
      },
      margin: { left: M, right: M },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ============= FOTOS =============
  if (fotos.length > 0) {
    if (y > H - 60) { doc.addPage(); y = M; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text("EVIDÊNCIAS FOTOGRÁFICAS", M, y);
    y += 4;

    const paths = fotos.filter((f) => !String(f.storage_path).startsWith("cftv://")).map((f) => f.storage_path);
    let signed: Record<string, string> = {};
    if (paths.length) {
      const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 600);
      data?.forEach((r) => { if (r.path && r.signedUrl) signed[r.path] = r.signedUrl; });
    }

    const cols = 2;
    const gap = 4;
    const cellW = (W - 2 * M - gap) / cols;
    const cellH = 55;
    let col = 0;

    for (const f of fotos) {
      if (y + cellH + 8 > H - M) { doc.addPage(); y = M; col = 0; }
      const x = M + col * (cellW + gap);

      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.2);
      doc.rect(x, y, cellW, cellH);

      if (String(f.storage_path).startsWith("cftv://")) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(80);
        doc.text("CFTV", x + cellW / 2, y + cellH / 2 - 2, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.text(f.camera_ref ?? "—", x + cellW / 2, y + cellH / 2 + 4, { align: "center" });
      } else {
        const url = signed[f.storage_path];
        if (url) {
          const dataUrl = await fetchImageAsDataUrl(url);
          if (dataUrl) {
            try {
              const fmt = dataUrl.includes("image/png") ? "PNG" : "JPEG";
              doc.addImage(dataUrl, fmt, x + 0.5, y + 0.5, cellW - 1, cellH - 1, undefined, "FAST");
            } catch {}
          }
        }
      }

      // Legenda
      const legY = y + cellH + 3;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(71, 85, 105);
      const meta = [
        `#${String(f.hash_sha256 ?? "").slice(0, 12)}`,
        f.timestamp_captura ? brDateTime(f.timestamp_captura) : "s/ timestamp",
        f.gps_lat && f.gps_lng ? `GPS ${Number(f.gps_lat).toFixed(4)},${Number(f.gps_lng).toFixed(4)}` : "",
        f.camera_ref ? `Cam ${f.camera_ref}` : "",
      ].filter(Boolean).join(" · ");
      const metaLines = doc.splitTextToSize(meta, cellW);
      doc.text(metaLines, x, legY);

      col += 1;
      if (col >= cols) { col = 0; y += cellH + 12; }
    }
    if (col !== 0) y += cellH + 12;
  }

  // ============= RUBRICA =============
  doc.addPage();
  y = M;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("RUBRICA DA MATRIZ DE RISCO 5×5 (referência)", M, y);
  y += 3;

  const rP = rubrica.filter((r: any) => r.eixo === "P").map((r: any) => [`P${r.nivel}`, r.rotulo, r.definicao]);
  const rS = rubrica.filter((r: any) => r.eixo === "S").map((r: any) => [`S${r.nivel}`, r.rotulo, r.definicao]);

  autoTable(doc, {
    startY: y + 2,
    head: [["Probabilidade", "Rótulo", "Definição"]],
    body: rP,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    margin: { left: M, right: M },
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  autoTable(doc, {
    startY: y,
    head: [["Severidade", "Rótulo", "Definição"]],
    body: rS,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    margin: { left: M, right: M },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // Nota legal + ART
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  const nota = "Este documento é um Relatório de Inspeção de Segurança (não constitui laudo técnico). As evidências fotográficas anexadas possuem hash SHA-256, timestamp de captura e coordenadas GPS quando disponíveis, garantindo rastreabilidade da prova. A estimativa de multa NR-28 é referencial, baseada no grau de risco da empresa e na portaria vigente cadastrada no sistema.";
  const notaLines = doc.splitTextToSize(nota, W - 2 * M);
  doc.text(notaLines, M, y);
  y += notaLines.length * 3.5 + 8;

  // Assinaturas
  const sigW = (W - 2 * M - 10) / 2;
  doc.setDrawColor(120);
  doc.setLineWidth(0.3);
  doc.line(M, y + 12, M + sigW, y + 12);
  doc.line(M + sigW + 10, y + 12, M + sigW * 2 + 10, y + 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text("Responsável pela inspeção (SESMT)", M, y + 16);
  doc.text(responsavelNome ?? "", M, y + 20);
  doc.text("Responsável Técnico / ART", M + sigW + 10, y + 16);
  doc.text("Nº ART: ________________________", M + sigW + 10, y + 20);

  // Rodapé com paginação
  const pages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text(`Relatório de Inspeção · ${inspecao.local_descricao} · ${br(inspecao.data_inspecao)}`, M, H - 6);
    doc.text(`${i} / ${pages}`, W - M, H - 6, { align: "right" });
  }

  const blob = doc.output("blob");
  await printPdf(blob, `inspecao-${inspecao.local_descricao.replace(/\s+/g, "-").toLowerCase()}-${inspecao.data_inspecao}.pdf`);
}