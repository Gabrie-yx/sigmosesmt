import type jsPDF from "jspdf";
import dmnLogo from "@/assets/dmn-logo.png";

// Lazy loader: jspdf + jspdf-autotable só baixam quando alguém gera o PDF.
async function loadPdfLibs() {
  const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  return { JsPDF, autoTable };
}

async function logoDataUrl(): Promise<string | null> {
  try {
    const r = await fetch(dmnLogo);
    const b = await r.blob();
    return await new Promise((res) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result as string);
      fr.onerror = () => res(null);
      fr.readAsDataURL(b);
    });
  } catch {
    return null;
  }
}

function fmtBR(d?: string | null) {
  if (!d) return "—";
  const [y, m, day] = d.split("T")[0].split("-");
  return `${day}/${m}/${y}`;
}

export type RcPdfClasse = "MATERIAL" | "SERVICO" | "MEDICAMENTOS";
export type RcPdfStatus =
  | "PENDENTE"
  | "EM_COTACAO"
  | "COTADA"
  | "APROVADA"
  | "INDEFERIDA"
  | "EM_RECEBIMENTO"
  | "CONCLUIDA"
  | "DEVOLVIDA";

const STATUS_LABEL: Record<RcPdfStatus, string> = {
  PENDENTE: "Em andamento",
  EM_COTACAO: "Em cotação",
  COTADA: "Cotada",
  APROVADA: "Deferida",
  INDEFERIDA: "Indeferida",
  EM_RECEBIMENTO: "PC emitido — aguardando NF",
  CONCLUIDA: "Concluída",
  DEVOLVIDA: "Devolvida — precisa ajuste",
};

export type RcPdfReq = {
  id: string;
  numero: string;
  titulo?: string | null;
  data_requisicao: string;
  classificacao: RcPdfClasse;
  solicitante: string;
  setor?: string | null;
  fornecedor?: string | null;
  obra_construcao?: string | null;
  obra_manutencao?: string | null;
  codigo_formulario?: string | null;
  revisao?: string | null;
  data_revisao?: string | null;
  pagina?: string | null;
  status: RcPdfStatus;
  motivo_indeferimento?: string | null;
  signature_solicitante?: string | null;
  /** Altura desejada da assinatura do solicitante em mm (clampada ao box). */
  signature_solicitante_height?: number | null;
  // Decisão do Supervisor Geral (Sprint 2)
  decidido_por_nome?: string | null;
  decidido_assinatura_url?: string | null;
  decidido_em?: string | null;
  // Compras
  cotador_nome?: string | null;
  cotacao_at?: string | null;
};

export type RcPdfItem = {
  item_numero: number;
  descricao?: string | null;
  quantidade?: string | number | null;
  unidade?: string | null;
  observacao?: string | null;
};

export type RcPdfCotacao = {
  fornecedor: string;
  valor?: number | null;
  prazo_entrega_dias?: number | null;
  condicao_pagamento?: string | null;
  frete?: string | null;
  is_vencedora?: boolean | null;
};

async function loadImageDims(src: string): Promise<{ w: number; h: number } | null> {
  try {
    return await new Promise<{ w: number; h: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = reject;
      img.src = src;
    });
  } catch {
    return null;
  }
}

/**
 * Gera a `jsPDF` da Requisição de Compra usando o mesmo layout FOR-COMP-03
 * que o setor solicitante emite. Devolve o `doc` sem baixar/imprimir —
 * o chamador decide (preview modal, download, print).
 */
export async function gerarPdfRequisicaoDoc(
  req: RcPdfReq,
  itens: RcPdfItem[],
  cotacoes: RcPdfCotacao[] = [],
): Promise<jsPDF> {
  const { JsPDF, autoTable } = await loadPdfLibs();
  const doc = new JsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 10;
  const logo = await logoDataUrl();

  // Cabeçalho
  doc.setLineWidth(0.4);
  doc.rect(M, M, W - 2 * M, 24);
  if (logo) {
    try {
      doc.addImage(logo, "PNG", M + 2, M + 3, 28, 18);
    } catch {
      /* noop */
    }
  }

  // Bloco código
  const codX = W - M - 55;
  doc.line(codX, M, codX, M + 24);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`CÓD. FOR-COMP: ${req.codigo_formulario ?? "03"}`, codX + 2, M + 5);
  doc.text(`REVISÃO: ${req.revisao ?? "01"}`, codX + 2, M + 10);
  doc.text(
    `DATA: ${fmtBR(req.data_revisao) || fmtBR(req.data_requisicao)}`,
    codX + 2,
    M + 15,
  );
  doc.text(`PAG.: ${req.pagina ?? "01/01"}`, codX + 2, M + 20);

  // Títulos centrais
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("REQUISIÇÃO DE COMPRA DE MATERIAIS E SERVIÇOS", M + 35, M + 8, {
    maxWidth: W - 2 * M - 95,
  });

  if (req.titulo) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(180, 0, 0);
    doc.text(req.titulo.toUpperCase(), M + 35, M + 19, {
      maxWidth: W - 2 * M - 95,
    });
    doc.setTextColor(0, 0, 0);
  }

  // Linhas de cabeçalho do formulário
  let y = M + 24;
  const rowH = 7;
  const halfW = (W - 2 * M) / 2;

  const drawSplitRow = (l1: string, v1: string, l2: string, v2: string) => {
    doc.rect(M, y, halfW, rowH);
    doc.rect(M + halfW, y, halfW, rowH);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(l1, M + 1.5, y + 4.5);
    doc.text(l2, M + halfW + 1.5, y + 4.5);
    doc.setFont("helvetica", "normal");
    doc.text(v1, M + 1.5 + doc.getTextWidth(l1) + 2, y + 4.5);
    doc.text(v2, M + halfW + 1.5 + doc.getTextWidth(l2) + 2, y + 4.5);
    y += rowH;
  };

  const cls =
    req.classificacao === "MATERIAL"
      ? "MATERIAL (X) SERVIÇO ( )"
      : "MATERIAL ( ) SERVIÇO (X)";
  drawSplitRow(
    "CLASSIFICAÇÃO DO PEDIDO:",
    cls,
    "DATA:",
    fmtBR(req.data_requisicao),
  );
  drawSplitRow(
    "SOLICITANTE:",
    req.solicitante || "",
    "Nº DA REQUISIÇÃO:",
    req.numero || "",
  );
  drawSplitRow(
    "SETOR:",
    req.setor || "",
    "FORNECEDOR:",
    req.fornecedor || "",
  );
  drawSplitRow(
    "OBRA EM CONSTRUÇÃO:",
    req.obra_construcao || "",
    "OBRA EM MANUTENÇÃO:",
    req.obra_manutencao || "",
  );

  // Tabela de itens
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: 1.8,
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
      minCellHeight: 7,
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      halign: "center",
    },
    columnStyles: {
      0: { cellWidth: 14, halign: "center" },
      1: { cellWidth: 95 },
      2: { cellWidth: 18, halign: "center" },
      3: { cellWidth: 18, halign: "center" },
      4: { cellWidth: "auto" },
    },
    head: [
      [
        "ITEM",
        "DESCRIÇÃO COMPLETA DO MATERIAL OU SERVIÇO",
        "QTDE",
        "UNID.",
        "OBSERVAÇÃO",
      ],
    ],
    body: (() => {
      const MIN_ROWS = 10;
      const rows = itens.map((i) => [
        String(i.item_numero).padStart(2, "0"),
        i.descricao || "",
        i.quantidade != null ? String(i.quantidade) : "",
        i.unidade || "",
        i.observacao || "",
      ]);
      // Modelo homologado FOR-COMP-03 exige 10 linhas fixas, mesmo em branco.
      for (let n = rows.length; n < MIN_ROWS; n++) {
        rows.push([String(n + 1).padStart(2, "0"), "", "", "", ""]);
      }
      return rows;
    })(),
  });

  // Assinaturas
  let finalY = (doc as any).lastAutoTable.finalY + 8;
  if (finalY > 245) {
    doc.addPage();
    finalY = M;
  }
  const colW = (W - 2 * M) / 3;
  const sigH = 30;

  let sigDims: { w: number; h: number } | null = null;
  if (req.signature_solicitante) {
    sigDims = await loadImageDims(req.signature_solicitante);
  }
  let supSigDims: { w: number; h: number } | null = null;
  if (req.decidido_assinatura_url) {
    supSigDims = await loadImageDims(req.decidido_assinatura_url);
  }

  [
    "ASSINATURA SOLICITANTE",
    "ASSINATURA SUPERVISOR GERAL",
    "ASSINATURA ANALISTA DE COMPRAS",
  ].forEach((label, idx) => {
    const x = M + idx * colW;
    doc.rect(x, finalY, colW, sigH);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(label, x + colW / 2, finalY + 4, { align: "center" });
    doc.line(x, finalY + sigH - 6, x + colW, finalY + sigH - 6);
    doc.text("DATA:", x + 1.5, finalY + sigH - 1);
    const drawSig = (
      sigUrl: string,
      dims: { w: number; h: number } | null,
      dataStr: string,
      nome?: string | null,
      targetHeightMm?: number | null,
    ) => {
      doc.setFont("helvetica", "normal");
      doc.text(dataStr, x + 13, finalY + sigH - 1);
      try {
        const areaX = x + 2;
        const areaY = finalY + 6;
        const areaW = colW - 4;
        const areaH = sigH - 10;
        let drawW = areaW;
        let drawH = areaH;
        if (dims && dims.w > 0 && dims.h > 0) {
          const ratio = dims.w / dims.h;
          // Se o usuário definiu altura alvo (em mm), respeita — clampada ao box.
          drawH = targetHeightMm && targetHeightMm > 0
            ? Math.max(4, Math.min(areaH, targetHeightMm))
            : areaH;
          drawW = drawH * ratio;
          if (drawW > areaW) {
            drawW = areaW;
            drawH = drawW / ratio;
          }
        }
        const drawX = areaX + (areaW - drawW) / 2;
        const drawY = areaY + (areaH - drawH) / 2;
        doc.addImage(sigUrl, "PNG", drawX, drawY, drawW, drawH, undefined, "FAST");
      } catch (e) {
        console.warn("Falha ao desenhar assinatura no PDF:", e);
      }
      if (nome) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.text(nome, x + colW / 2, finalY + sigH - 7.5, { align: "center", maxWidth: colW - 4 });
        doc.setFontSize(8);
      }
    };

    if (idx === 0 && req.signature_solicitante) {
      drawSig(
        req.signature_solicitante,
        sigDims,
        fmtBR(req.data_requisicao),
        req.solicitante,
        req.signature_solicitante_height ?? null,
      );
    } else if (idx === 1 && req.decidido_assinatura_url) {
      drawSig(
        req.decidido_assinatura_url,
        supSigDims,
        fmtBR(req.decidido_em ?? null),
        req.decidido_por_nome ?? null,
      );
    } else if (idx === 2 && req.cotador_nome) {
      doc.setFont("helvetica", "normal");
      doc.text(fmtBR(req.cotacao_at ?? null), x + 13, finalY + sigH - 1);
      doc.setFontSize(7);
      doc.text(req.cotador_nome, x + colW / 2, finalY + sigH - 7.5, { align: "center", maxWidth: colW - 4 });
      doc.setFontSize(8);
    }
  });

  // Rodapé status
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(
    `STATUS: ${STATUS_LABEL[req.status].toUpperCase()}`,
    M,
    finalY + sigH + 7,
  );
  if (req.status === "INDEFERIDA" && req.motivo_indeferimento) {
    doc.setFont("helvetica", "normal");
    doc.text(`Motivo: ${req.motivo_indeferimento}`, M, finalY + sigH + 12, {
      maxWidth: W - 2 * M,
    });
  }

  // Cotações recebidas (Sprint 2) — só imprime se houver
  if (cotacoes.length > 0) {
    let cotY = finalY + sigH + (req.status === "INDEFERIDA" && req.motivo_indeferimento ? 18 : 12);
    if (cotY > 250) {
      doc.addPage();
      cotY = M;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("COTAÇÕES RECEBIDAS", M, cotY);
    autoTable(doc, {
      startY: cotY + 2,
      margin: { left: M, right: M },
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.3 },
      headStyles: { fillColor: [235, 235, 235], textColor: [0, 0, 0], fontStyle: "bold" },
      head: [["#", "Fornecedor", "Valor (R$)", "Prazo", "Cond. Pgto", "Frete", "Vencedora"]],
      body: cotacoes.map((c, i) => [
        String(i + 1),
        c.fornecedor,
        c.valor != null ? c.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "—",
        c.prazo_entrega_dias != null ? `${c.prazo_entrega_dias} dias` : "—",
        c.condicao_pagamento || "—",
        c.frete || "—",
        c.is_vencedora ? "SIM" : "",
      ]),
      didParseCell: (data) => {
        if (data.section === "body" && cotacoes[data.row.index]?.is_vencedora) {
          data.cell.styles.fillColor = [220, 252, 231];
          data.cell.styles.fontStyle = "bold";
        }
      },
    });
  }

  return doc;
}

export function rcPdfFileName(req: { numero: string; id: string }): string {
  return `requisicao-${req.numero || req.id.slice(0, 8)}.pdf`;
}