import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { drawPdfHeader } from "./pdf-header";
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

async function imgNaturalDims(src: string): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => resolve({ w: im.naturalWidth, h: im.naturalHeight });
    im.onerror = () => resolve(null);
    im.src = src;
  });
}

export interface InspecaoPdfInput {
  inspecao: any;
  fotos: any[];
  ncs: any[];
  planosPorNc: Record<string, any[]>;
  rubrica: any[];
  /** Nome completo do inspetor. NUNCA passe e-mail — é PII. */
  responsavelNome?: string | null;
  /** Registro profissional (MTE / CREA) exibido abaixo da assinatura do TST. */
  responsavelRegistro?: string | null;
  /** Assinaturas digitais (data URLs PNG) para estampar acima da linha. */
  assinaturas?: {
    eng?: string | null;
    sesmt?: string | null;
    enc?: string | null;
  };
}

export async function gerarInspecaoPdf(input: InspecaoPdfInput): Promise<{ doc: jsPDF; fileName: string }> {
  const { inspecao, fotos, ncs, planosPorNc, rubrica, responsavelNome, responsavelRegistro, assinaturas } = input;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 12;

  const empresa = inspecao.companies ?? {};
  const empresaNome = empresa.nome_fantasia ?? empresa.name ?? "—";
  const empresaCnpj = empresa.cnpj ?? "—";
  const empresaEndereco = [empresa.logradouro, empresa.numero, empresa.bairro, empresa.cidade, empresa.uf].filter(Boolean).join(", ") || "—";
  const grauRisco = empresa.grau_risco ?? "—";

  const totMulta = ncs.reduce((s, n) => s + Number(n.multa_estimada ?? 0), 0);
  const totCritico = ncs.filter((n) => n.classe_risco === "CRITICO").length;
  const totAlto = ncs.filter((n) => n.classe_risco === "ALTO").length;
  const totMedio = ncs.filter((n) => n.classe_risco === "MEDIO").length;
  const totBaixo = ncs.filter((n) => n.classe_risco === "BAIXO").length;

  const laudoNum = `INSP-${String(inspecao.id ?? "").slice(0, 8).toUpperCase()}-${new Date(inspecao.data_inspecao + "T00:00:00").getFullYear()}`;
  const isPrevia = String(inspecao.status ?? "").toLowerCase() !== "publicada";

  // ---- pré-carrega URLs assinadas de todas as fotos (usadas nos detalhes por NC) ----
  const fotosPaths = fotos.filter((f) => !String(f.storage_path).startsWith("cftv://")).map((f) => f.storage_path);
  const signedUrls: Record<string, string> = {};
  if (fotosPaths.length) {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(fotosPaths, 900);
    data?.forEach((r) => { if (r.path && r.signedUrl) signedUrls[r.path] = r.signedUrl; });
  }
  const dataUrlCache: Record<string, string | null> = {};
  async function getFotoDataUrl(f: any): Promise<string | null> {
    if (String(f.storage_path).startsWith("cftv://")) return null;
    if (dataUrlCache[f.storage_path] !== undefined) return dataUrlCache[f.storage_path];
    const url = signedUrls[f.storage_path];
    if (!url) return null;
    const d = await fetchImageAsDataUrl(url);
    dataUrlCache[f.storage_path] = d;
    return d;
  }

  // ============= CAPA =============
  const inspetorLabel = responsavelNome && responsavelNome.trim().length > 0 ? responsavelNome : "—";
  let y = drawPdfHeader(doc, {
    titulo: "LAUDO TÉCNICO DE INSPEÇÃO DE SEGURANÇA DO TRABALHO",
    subtitulo: `${laudoNum} · ${empresaNome}`,
    responsavel: inspetorLabel,
    filtros: [
      `Local: ${inspecao.local_descricao}`,
      `Data da inspeção: ${br(inspecao.data_inspecao)}`,
      inspecao.tipo_local ? `Tipo: ${inspecao.tipo_local}` : "",
      `Grau de risco (CNAE): ${grauRisco}`,
    ].filter(Boolean),
    kpis: [
      { label: "Total NCs", value: ncs.length, tone: "neutral" },
      { label: "Críticas", value: totCritico, tone: "danger" },
      { label: "Altas", value: totAlto, tone: "warning" },
      { label: "Multa NR-28 (R$)", value: totMulta.toLocaleString("pt-BR", { minimumFractionDigits: 2 }), tone: "danger" },
    ],
  });

  if (isPrevia) {
    // marca d'água PRÉVIA
    doc.saveGraphicsState?.();
    doc.setTextColor(220, 38, 38);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(80);
    (doc as any).setGState?.(new (doc as any).GState({ opacity: 0.12 }));
    doc.text("PRÉVIA", W / 2, H / 2, { align: "center", angle: 30 });
    (doc as any).setGState?.(new (doc as any).GState({ opacity: 1 }));
    doc.restoreGraphicsState?.();
    doc.setTextColor(15, 23, 42);
  }

  y += 6;
  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2.5, textColor: [15, 23, 42], lineColor: [200, 200, 200] },
    columnStyles: { 0: { cellWidth: 45, fontStyle: "bold", fillColor: [248, 250, 252] } },
    body: [
      ["Nº do Laudo", laudoNum],
      ["Empresa auditada", `${empresaNome}${empresa.razao_social ? ` (${empresa.razao_social})` : ""}`],
      ["CNPJ", empresaCnpj],
      ["Endereço", empresaEndereco],
      ["CNAE / Grau de risco", `${empresa.cnae_principal ?? "—"} · Grau ${grauRisco}`],
      ["Local inspecionado", inspecao.local_descricao || "—"],
      ["Data da inspeção", br(inspecao.data_inspecao)],
      ["Inspetor responsável", inspetorLabel],
      ["Status", String(inspecao.status ?? "—").toUpperCase()],
      ["Emitido em", brDateTime(new Date().toISOString())],
    ],
    margin: { left: M, right: M },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // ============= 1. SUMÁRIO EXECUTIVO =============
  sectionTitle(doc, "1. SUMÁRIO EXECUTIVO", y);
  y += 6;
  const intro = `Este laudo formaliza os achados da inspeção de segurança realizada em ${br(inspecao.data_inspecao)} no local "${inspecao.local_descricao}" da empresa ${empresaNome}. Foram identificadas ${ncs.length} não conformidade(s), sendo ${totCritico} crítica(s), ${totAlto} de alto risco, ${totMedio} médio(s) e ${totBaixo} baixo(s). A exposição financeira estimada por infração à NR-28 é de R$ ${totMulta.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}, calculada com base no grau de risco ${grauRisco} da empresa e na Portaria MTP nº 667/2021.`;
  y = paragraph(doc, intro, y, W, M);
  y += 3;

  autoTable(doc, {
    startY: y,
    theme: "grid",
    head: [["Indicador", "Valor"]],
    headStyles: { fillColor: [127, 29, 29], textColor: 255, fontStyle: "bold" },
    body: [
      ["Não conformidades totais", String(ncs.length)],
      ["Críticas (I4)", String(totCritico)],
      ["Alto risco (I3)", String(totAlto)],
      ["Médio (I2)", String(totMedio)],
      ["Baixo (I1)", String(totBaixo)],
      ["Multa NR-28 estimada (R$)", totMulta.toLocaleString("pt-BR", { minimumFractionDigits: 2 })],
      ["Evidências fotográficas anexadas", String(fotos.length)],
    ],
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { cellWidth: 90, fontStyle: "bold" }, 1: { halign: "right" } },
    margin: { left: M, right: M },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  if (inspecao.escopo) {
    ensureRoom(doc, y, 30, () => { y = M; });
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(15, 23, 42);
    doc.text("Escopo declarado", M, y);
    y += 4;
    y = paragraph(doc, inspecao.escopo, y, W, M);
  }
  if (inspecao.participantes) {
    ensureRoom(doc, y, 30, () => { y = M; });
    doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(15, 23, 42);
    doc.text("Participantes", M, y);
    y += 4;
    y = paragraph(doc, inspecao.participantes, y, W, M);
  }

  // ============= 2. METODOLOGIA E BASE LEGAL =============
  ensureRoom(doc, y, 60, () => { doc.addPage(); y = M; });
  sectionTitle(doc, "2. METODOLOGIA E BASE LEGAL", y);
  y += 6;
  const metodo = [
    "Este laudo foi elaborado conforme os requisitos do Programa de Gerenciamento de Riscos (PGR) previsto na NR-01, item 1.5, que estabelece o Gerenciamento de Riscos Ocupacionais (GRO) como processo obrigatório e permanente.",
    "A gradação das infrações e a estimativa de multas seguem o disposto na NR-28 (Fiscalização e Penalidades), com os valores atualizados pela Portaria MTP nº 667, de 08 de novembro de 2021, considerando o Grau de Risco da atividade principal da empresa (CNAE) e o número de empregados na faixa aplicável.",
    "A avaliação de risco de cada não conformidade utiliza a Matriz 5×5 (Probabilidade × Severidade), com rubrica quantitativa reproduzida ao final deste documento (Anexo I). O produto P × S determina a classe de risco (BAIXO, MÉDIO, ALTO ou CRÍTICO) e a urgência da ação corretiva.",
    "As evidências fotográficas anexadas possuem hash SHA-256, marca temporal (timestamp) e, quando disponíveis, coordenadas GPS de captura, garantindo rastreabilidade e integridade da prova para fins de auditoria fiscal e judicial.",
    "O plano de ação segue o ciclo PDCA (Plan-Do-Check-Act) e a metodologia 5W2H, atribuindo responsável, prazo e verificação de eficácia para cada ação corretiva.",
  ].join("\n\n");
  y = paragraph(doc, metodo, y, W, M);

  // ============= 3. QUADRO CONSOLIDADO =============
  y += 4;
  ensureRoom(doc, y, 40, () => { doc.addPage(); y = M; });
  sectionTitle(doc, "3. QUADRO CONSOLIDADO DE NÃO CONFORMIDADES", y);
  y += 4;

  if (ncs.length === 0) {
    doc.setFont("helvetica", "italic").setFontSize(9).setTextColor(100);
    doc.text("Nenhuma NC registrada nesta inspeção — condição CONFORME.", M, y + 6);
    y += 12;
  } else {
    autoTable(doc, {
      startY: y + 2,
      head: [["#", "NR / Item", "Descrição resumida", "Classe", "P×S", "Gradação", "Multa R$"]],
      body: ncs.map((nc, i) => [
        String(i + 1),
        `${nc.nr_codigo}${nc.nr_item ? ` ${nc.nr_item}` : ""}`,
        String(nc.descricao ?? "—"),
        nc.classe_risco ?? "—",
        `P${nc.probabilidade}×S${nc.severidade}=${nc.risco_calculado}`,
        nc.gradacao_nr28 ?? "—",
        nc.multa_estimada ? Number(nc.multa_estimada).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "—",
      ]),
      styles: { fontSize: 7.5, cellPadding: 1.8, valign: "top", lineColor: [200, 200, 200] },
      headStyles: { fillColor: [127, 29, 29], textColor: 255, fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 8, halign: "center" },
        1: { cellWidth: 22 },
        2: { cellWidth: "auto" },
        3: { cellWidth: 20, halign: "center" },
        4: { cellWidth: 22, halign: "center" },
        5: { cellWidth: 18, halign: "center" },
        6: { cellWidth: 24, halign: "right" },
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 3) {
          const v = String(data.cell.raw);
          const map: Record<string, [number, number, number]> = {
            CRITICO: [220, 38, 38], ALTO: [234, 88, 12], MEDIO: [202, 138, 4], BAIXO: [22, 163, 74],
          };
          const c = map[v];
          if (c) { data.cell.styles.textColor = c; data.cell.styles.fontStyle = "bold"; }
        }
      },
      margin: { left: M, right: M },
    });
    y = (doc as any).lastAutoTable.finalY + 4;
    doc.setFont("helvetica", "italic").setFontSize(7.5).setTextColor(100);
    doc.text(`Total geral de multa estimada NR-28: R$ ${totMulta.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} · Grau de risco ${grauRisco} · Base: Portaria MTP 667/2021`, M, y);
    y += 6;
  }

  // ============= 4. DETALHAMENTO POR NC =============
  if (ncs.length > 0) {
    ensureRoom(doc, y, 40, () => { doc.addPage(); y = M; });
    sectionTitle(doc, "4. DETALHAMENTO DAS NÃO CONFORMIDADES", y);
    y += 8;

    for (let i = 0; i < ncs.length; i++) {
      const nc = ncs[i];
      const planos = planosPorNc[nc.id] ?? [];
      // Cada NC começa em página nova (exceto a primeira, que segue após o título da seção)
      if (i > 0) { doc.addPage(); y = M; }
      else { ensureRoom(doc, y, 60, () => { doc.addPage(); y = M; }); }

      // Título da NC
      doc.setFillColor(127, 29, 29);
      doc.rect(M, y, W - 2 * M, 7, "F");
      doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(255, 255, 255);
      doc.text(`NC #${String(i + 1).padStart(2, "0")} — ${nc.nr_codigo}${nc.nr_item ? ` item ${nc.nr_item}` : ""}`, M + 2, y + 5);
      const badgeColor: Record<string, [number, number, number]> = {
        CRITICO: [153, 27, 27], ALTO: [154, 52, 18], MEDIO: [133, 77, 14], BAIXO: [22, 101, 52],
      };
      const bc = badgeColor[nc.classe_risco] ?? [51, 65, 85];
      doc.setFillColor(bc[0], bc[1], bc[2]);
      doc.rect(W - M - 34, y + 1, 32, 5, "F");
      doc.setFontSize(8).setTextColor(255);
      doc.text(nc.classe_risco ?? "—", W - M - 18, y + 4.5, { align: "center" });
      y += 10;

      // Texto oficial da NR
      const textoOficial = nc.catalogo_nrs_itens?.texto_oficial as string | undefined;
      if (textoOficial) {
        doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(15, 23, 42);
        doc.text("Texto normativo oficial:", M, y);
        y += 4;
        doc.setFont("helvetica", "italic").setFontSize(8.5).setTextColor(71, 85, 105);
        const lns = doc.splitTextToSize(`"${textoOficial}"`, W - 2 * M);
        doc.text(lns, M, y);
        y += lns.length * 3.8 + 2;
      }

      // Descrição da NC
      doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(15, 23, 42);
      doc.text("Descrição da não conformidade:", M, y);
      y += 4;
      y = paragraph(doc, nc.descricao ?? "—", y, W, M, 8.5);

      // Matriz de risco + multa lado a lado
      const matrixX = M;
      const matrixY = y + 2;
      drawMatriz5x5(doc, matrixX, matrixY, Number(nc.probabilidade), Number(nc.severidade));
      const infoX = matrixX + 55;
      doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(15, 23, 42);
      doc.text("Avaliação de risco:", infoX, matrixY + 4);
      doc.setFont("helvetica", "normal").setFontSize(8.5);
      doc.text(`Probabilidade: P${nc.probabilidade}`, infoX, matrixY + 9);
      doc.text(`Severidade: S${nc.severidade}`, infoX, matrixY + 13);
      doc.text(`Score: ${nc.risco_calculado} (${nc.classe_risco})`, infoX, matrixY + 17);
      doc.setFont("helvetica", "bold").setFontSize(8.5);
      doc.text("Exposição legal NR-28:", infoX, matrixY + 24);
      doc.setFont("helvetica", "normal");
      doc.text(`Gradação: ${nc.gradacao_nr28 ?? "—"}`, infoX, matrixY + 29);
      doc.text(`Multa: R$ ${nc.multa_estimada ? Number(nc.multa_estimada).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "—"}`, infoX, matrixY + 33);
      doc.setFont("helvetica", "italic").setFontSize(7).setTextColor(100);
      doc.text(`(Grau risco ${grauRisco} · Portaria MTP 667/2021)`, infoX, matrixY + 37);
      y = matrixY + 48;

      // Foto associada
      if (nc.foto_id) {
        const foto = fotos.find((f: any) => f.id === nc.foto_id);
        if (foto) {
          const maxW = 80, maxH = 55;
          const fx = M;
          if (String(foto.storage_path).startsWith("cftv://")) {
            const fw = maxW, fh = maxH;
            doc.setDrawColor(203, 213, 225).setLineWidth(0.2);
            doc.rect(fx, y, fw, fh);
            doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(80);
            doc.text("CFTV", fx + fw / 2, y + fh / 2, { align: "center" });
            renderFotoMeta(doc, foto, fx + fw + 4, y, W - (fx + fw + 4) - M);
            y += fh + 6;
          } else {
            const dUrl = await getFotoDataUrl(foto);
            let fw = maxW, fh = maxH;
            if (dUrl) {
              const dims = await imgNaturalDims(dUrl);
              if (dims && dims.w > 0 && dims.h > 0) {
                const r = dims.w / dims.h;
                if (maxW / r <= maxH) { fw = maxW; fh = maxW / r; }
                else { fh = maxH; fw = maxH * r; }
              }
              try {
                const fmt = dUrl.includes("image/png") ? "PNG" : "JPEG";
                doc.addImage(dUrl, fmt, fx, y, fw, fh, undefined, "FAST");
              } catch {}
            }
            renderFotoMeta(doc, foto, fx + fw + 4, y, W - (fx + fw + 4) - M);
            y += fh + 6;
          }
        }
      }

      // Recomendação técnica
      if (nc.recomendacao) {
        doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(15, 23, 42);
        doc.text("Recomendação técnica:", M, y);
        y += 4;
        y = paragraph(doc, nc.recomendacao, y, W, M, 8.5);
      }

      // Plano 5W2H / PDCA
      doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(15, 23, 42);
      doc.text("Plano de ação (PDCA / 5W2H):", M, y);
      y += 3;
      if (planos.length === 0) {
        doc.setFont("helvetica", "italic").setFontSize(8).setTextColor(120);
        doc.text("Sem plano de ação registrado.", M, y + 4);
        y += 8;
      } else {
        autoTable(doc, {
          startY: y + 1,
          head: [["Campo (5W2H)", "Conteúdo"]],
          body: planos.flatMap((p: any, pi: number) => {
            const custo = p.custo_estimado != null
              ? `R$ ${Number(p.custo_estimado).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
              : "—";
            const rows: string[][] = [
              ["O QUÊ (What)", p.acao ?? "—"],
              ["POR QUÊ (Why)", p.por_que ?? "—"],
              ["ONDE (Where)", p.onde ?? "—"],
              ["QUANDO (When)", p.prazo ? br(p.prazo) : "—"],
              ["QUEM (Who)", p.responsavel_nome ?? "—"],
              ["COMO (How)", p.como ?? "—"],
              ["QUANTO CUSTA (How Much)", custo],
              ["Fase PDCA", p.fase_pdca ?? "PLAN"],
            ];
            if (planos.length > 1) {
              rows.unshift([`Plano ${pi + 1}`, ""]);
            }
            return rows;
          }),
          styles: { fontSize: 8, cellPadding: 2, valign: "top" },
          headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 7.5 },
          columnStyles: {
            0: { cellWidth: 42, fontStyle: "bold", fillColor: [248, 250, 252] },
            1: { cellWidth: "auto" },
          },
          margin: { left: M, right: M },
        });
        y = (doc as any).lastAutoTable.finalY + 6;
      }

    }
  }

  // ============= 5. PLANO DE AÇÃO CONSOLIDADO =============
  const todasAcoes: Array<{ nc: any; p: any; idx: number }> = [];
  ncs.forEach((nc, idx) => (planosPorNc[nc.id] ?? []).forEach((p) => todasAcoes.push({ nc, p, idx: idx + 1 })));
  if (todasAcoes.length > 0) {
    ensureRoom(doc, y, 40, () => { doc.addPage(); y = M; });
    sectionTitle(doc, "5. PLANO DE AÇÃO CONSOLIDADO", y);
    y += 6;
    todasAcoes.sort((a, b) => String(a.p.prazo ?? "9999").localeCompare(String(b.p.prazo ?? "9999")));
    autoTable(doc, {
      startY: y,
      head: [["NC", "NR", "Ação (What)", "Como (How)", "Fase", "Responsável", "Prazo", "Status"]],
      body: todasAcoes.map(({ nc, p, idx }) => [
        `#${String(idx).padStart(2, "0")}`,
        `${nc.nr_codigo}${nc.nr_item ? ` ${nc.nr_item}` : ""}`,
        p.acao ?? "—",
        p.como ?? "—",
        p.fase_pdca ?? "—",
        p.responsavel_nome ?? "A definir",
        p.prazo ? br(p.prazo) : "—",
        p.encerrada_em ? "Concluída" : "Pendente",
      ]),
      styles: { fontSize: 7.5, cellPadding: 1.5, valign: "top" },
      headStyles: { fillColor: [127, 29, 29], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 12, halign: "center" },
        1: { cellWidth: 20 },
        4: { cellWidth: 12, halign: "center" },
        6: { cellWidth: 18, halign: "center" },
        7: { cellWidth: 18, halign: "center" },
      },
      margin: { left: M, right: M },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ============= 6. RUBRICA MATRIZ 5x5 =============
  ensureRoom(doc, y, 80, () => { doc.addPage(); y = M; });
  sectionTitle(doc, "ANEXO I — RUBRICA DA MATRIZ DE RISCO 5×5", y);
  y += 6;
  const rP = rubrica.filter((r: any) => r.eixo === "P").map((r: any) => [`P${r.nivel}`, r.rotulo, r.definicao]);
  const rS = rubrica.filter((r: any) => r.eixo === "S").map((r: any) => [`S${r.nivel}`, r.rotulo, r.definicao]);
  autoTable(doc, {
    startY: y,
    head: [["Probabilidade", "Rótulo", "Definição"]],
    body: rP,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    margin: { left: M, right: M },
  });
  y = (doc as any).lastAutoTable.finalY + 4;
  autoTable(doc, {
    startY: y,
    head: [["Severidade", "Rótulo", "Definição"]],
    body: rS,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    margin: { left: M, right: M },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // ============= 7. PARECER TÉCNICO =============
  ensureRoom(doc, y, 60, () => { doc.addPage(); y = M; });
  sectionTitle(doc, "PARECER TÉCNICO E CONCLUSÃO", y);
  y += 6;
  let parecer = inspecao.parecer_tecnico as string | undefined;
  if (!parecer) {
    if (ncs.length === 0) {
      parecer = `Após inspeção realizada no local "${inspecao.local_descricao}", NÃO foram identificadas não conformidades no escopo avaliado. As condições de segurança verificadas atendem aos requisitos das Normas Regulamentadoras aplicáveis. Recomenda-se a manutenção do padrão observado e a continuidade das inspeções de rotina previstas no PGR.`;
    } else {
      const urgencia = totCritico > 0 ? "IMEDIATA (72h)" : totAlto > 0 ? "URGENTE (15 dias)" : "PROGRAMADA (60 dias)";
      parecer = `A inspeção realizada identificou ${ncs.length} não conformidade(s) que caracterizam risco à saúde e integridade dos trabalhadores, com exposição legal de R$ ${totMulta.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} conforme NR-28. As ações corretivas propostas seguem o ciclo PDCA e devem ser executadas pelos responsáveis designados nos prazos estipulados. Nível de urgência recomendado: ${urgencia}. O não tratamento dessas NCs sujeita a empresa a autuação fiscal do Ministério do Trabalho e responsabilização civil e criminal em caso de acidente decorrente.`;
    }
  }
  y = paragraph(doc, parecer, y, W, M);

  // ============= 8. ASSINATURAS =============
  ensureRoom(doc, y, 55, () => { doc.addPage(); y = M; });
  y += 8;
  const sigW = (W - 2 * M - 10) / 3;
  const sigY = y + 18;
  doc.setDrawColor(80).setLineWidth(0.3);
  // Pré-carrega dimensões naturais das assinaturas p/ preservar aspect ratio.
  async function imgDims(src: string): Promise<{ w: number; h: number } | null> {
    return new Promise((resolve) => {
      const im = new Image();
      im.onload = () => resolve({ w: im.naturalWidth, h: im.naturalHeight });
      im.onerror = () => resolve(null);
      im.src = src;
    });
  }
  const sigs: Array<{ label: string; sub: string; nome?: string | null; img?: string | null }> = [
    { label: "Engenheiro de Segurança do Trabalho", sub: "CREA nº ________________________", img: assinaturas?.eng ?? null },
    {
      label: "Técnico de Segurança do Trabalho",
      sub: (responsavelRegistro && responsavelRegistro.trim()) || "",
      nome: inspetorLabel !== "—" ? inspetorLabel : null,
      img: assinaturas?.sesmt ?? null,
    },
    { label: "Encarregado da Área", sub: "Responsável pela execução das ações", img: assinaturas?.enc ?? null },
  ];
  const sigDims = await Promise.all(sigs.map((s) => (s.img ? imgDims(s.img) : Promise.resolve(null))));
  sigs.forEach((s, i) => {
    const x = M + i * (sigW + 5);
    doc.line(x, sigY, x + sigW, sigY);
    if (s.img) {
      try {
        const maxW = Math.min(sigW - 6, 50);
        const maxH = 16;
        const dims = sigDims[i];
        let imgW = maxW, imgH = maxH;
        if (dims && dims.w > 0 && dims.h > 0) {
          const r = dims.w / dims.h;
          if (maxW / r <= maxH) { imgW = maxW; imgH = maxW / r; }
          else { imgH = maxH; imgW = maxH * r; }
        }
        doc.addImage(s.img, "PNG", x + (sigW - imgW) / 2, sigY - imgH - 0.5, imgW, imgH, undefined, "FAST");
      } catch { /* ignore imagem inválida */ }
    }
    if (s.nome) {
      doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(15, 23, 42);
      doc.text(s.nome, x + sigW / 2, sigY + 4, { align: "center" });
      doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(30, 41, 59);
      doc.text(s.label, x + sigW / 2, sigY + 8, { align: "center" });
      doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(100);
      doc.text(s.sub, x + sigW / 2, sigY + 12, { align: "center" });
    } else {
      doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(15, 23, 42);
      doc.text(s.label, x + sigW / 2, sigY + 4, { align: "center" });
      doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(100);
      doc.text(s.sub, x + sigW / 2, sigY + 8, { align: "center" });
    }
  });
  y = sigY + 18;
  doc.setFont("helvetica", "italic").setFontSize(7).setTextColor(100);
  const legal = "Documento emitido em conformidade com a NR-01 (GRO/PGR), NR-28 (Fiscalização) e demais Normas Regulamentadoras aplicáveis. As evidências fotográficas anexadas possuem hash SHA-256, timestamp e coordenadas GPS quando disponíveis, garantindo integridade probatória. Multas estimadas conforme Portaria MTP nº 667/2021, considerando o grau de risco da atividade principal da empresa auditada.";
  const legalLines = doc.splitTextToSize(legal, W - 2 * M);
  doc.text(legalLines, M, y);

  // ============= Rodapé em todas as páginas =============
  const pages = (doc as any).internal.getNumberOfPages();
  const emitido = new Date().toLocaleString("pt-BR");
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240).setLineWidth(0.2);
    doc.line(M, H - 9, W - M, H - 9);
    doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(100);
    doc.text(`Laudo ${laudoNum} · ${empresaNome} · Emitido em ${emitido}`, M, H - 5);
    doc.text(`Página ${i} de ${pages}`, W - M, H - 5, { align: "right" });
  }

  const fileName = `laudo-${laudoNum.toLowerCase()}-${inspecao.data_inspecao}.pdf`;
  return { doc, fileName };
}

// ============= Helpers de layout =============
function sectionTitle(doc: jsPDF, text: string, y: number) {
  const W = doc.internal.pageSize.getWidth();
  const M = 12;
  doc.setFillColor(127, 29, 29);
  doc.rect(M, y - 4, W - 2 * M, 6, "F");
  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(255, 255, 255);
  doc.text(text, M + 2, y);
  doc.setTextColor(15, 23, 42);
}

function paragraph(doc: jsPDF, text: string, y: number, W: number, M: number, size = 9): number {
  doc.setFont("helvetica", "normal").setFontSize(size).setTextColor(30, 41, 59);
  const lns = doc.splitTextToSize(text, W - 2 * M);
  const lineH = size * 0.42;
  const H = doc.internal.pageSize.getHeight();
  let cursor = y;
  for (const ln of lns) {
    if (cursor > H - 20) { doc.addPage(); cursor = M; }
    doc.text(ln, M, cursor);
    cursor += lineH;
  }
  return cursor + 1;
}

function ensureRoom(doc: jsPDF, y: number, needed: number, onBreak: () => void) {
  const H = doc.internal.pageSize.getHeight();
  if (y + needed > H - 15) { doc.addPage(); onBreak(); }
}

function renderFotoMeta(doc: jsPDF, foto: any, x: number, y: number, maxW: number) {
  const meta = [
    `Hash: ${String(foto.hash_sha256 ?? "").slice(0, 16)}`,
    foto.timestamp_captura ? brDateTime(foto.timestamp_captura) : "sem timestamp",
    foto.gps_lat && foto.gps_lng ? `GPS ${Number(foto.gps_lat).toFixed(5)}, ${Number(foto.gps_lng).toFixed(5)}` : "",
  ].filter(Boolean).join(" · ");
  doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(15, 23, 42);
  doc.text("Evidência fotográfica", x, y + 4);
  doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(71, 85, 105);
  const mt = doc.splitTextToSize(meta, maxW);
  doc.text(mt, x, y + 9);
}

function drawMatriz5x5(doc: jsPDF, x: number, y: number, p: number, s: number) {
  const cell = 8;
  const originX = x + 6;
  const originY = y + 6;
  // rótulos eixos
  doc.setFont("helvetica", "bold").setFontSize(6).setTextColor(15, 23, 42);
  doc.text("Severidade", originX + cell * 2.5, originY - 3, { align: "center" });
  doc.text("P", x + 1, originY + cell * 2.5, { align: "left" });
  doc.text("r", x + 1, originY + cell * 2.5 + 2.2, { align: "left" });
  doc.text("o", x + 1, originY + cell * 2.5 + 4.4, { align: "left" });
  doc.text("b", x + 1, originY + cell * 2.5 + 6.6, { align: "left" });
  // células
  for (let sv = 1; sv <= 5; sv++) {
    for (let pv = 1; pv <= 5; pv++) {
      const score = pv * sv;
      let bg: [number, number, number] = [34, 197, 94]; // baixo
      if (score >= 15) bg = [220, 38, 38];
      else if (score >= 8) bg = [234, 88, 12];
      else if (score >= 4) bg = [202, 138, 4];
      doc.setFillColor(bg[0], bg[1], bg[2]);
      const cx = originX + (sv - 1) * cell;
      const cy = originY + (pv - 1) * cell;
      doc.rect(cx, cy, cell, cell, "F");
      doc.setDrawColor(255).setLineWidth(0.2);
      doc.rect(cx, cy, cell, cell);
      doc.setFont("helvetica", "normal").setFontSize(6).setTextColor(255);
      doc.text(String(score), cx + cell / 2, cy + cell / 2 + 1, { align: "center" });
    }
  }
  // rótulos numéricos
  doc.setFont("helvetica", "normal").setFontSize(5.5).setTextColor(15, 23, 42);
  for (let sv = 1; sv <= 5; sv++) doc.text(String(sv), originX + (sv - 1) * cell + cell / 2, originY - 2, { align: "center" });
  for (let pv = 1; pv <= 5; pv++) doc.text(String(pv), originX - 2, originY + (pv - 1) * cell + cell / 2 + 1, { align: "right" });
  // marca célula ativa
  if (p >= 1 && p <= 5 && s >= 1 && s <= 5) {
    const cx = originX + (s - 1) * cell;
    const cy = originY + (p - 1) * cell;
    doc.setDrawColor(15, 23, 42).setLineWidth(1.2);
    doc.rect(cx, cy, cell, cell);
  }
}