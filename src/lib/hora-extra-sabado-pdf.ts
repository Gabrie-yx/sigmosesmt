import jsPDF from "jspdf";
import { packBlocksIntoPages, drawFlowPages, type FlowBlock } from "@/lib/pdf-flow-engine";

export type HoraExtraFuncionario = {
  nome: string;
  transporte: boolean;
  alimentacao: boolean;
  presenca?: string | null;
  empresa?: string | null;
  /** Assinatura digital cadastrada na ficha do colaborador (PNG dataURL).
   * Quando presente é renderizada automaticamente sobre a linha de assinatura. */
  assinaturaDataUrl?: string | null;
};

export type HoraExtraPaginaEmpresa = {
  empresaNome: string;
  funcionarios: HoraExtraFuncionario[];
  totalFuncionarios?: number;
  linhaInicial?: number;
};

export type HoraExtraPdfParams = {
  data: string; // dd/mm/yyyy
  diaSemana: string;
  turno?: string | null;
  horario?: string | null;
  setor?: string | null;
  centroCusto?: string | null;
  tipoEfetivo: "DMN" | "MEI" | "TERCEIRIZADO";
  observacao?: string | null;
  empresasEnvolvidas: string[];
  paginas: HoraExtraPaginaEmpresa[];
  logoDataUrl?: string | null;
  assinaturaDataUrl?: string | null;
  assinaturaHeight?: number;
  /** Assinatura do Técnico em Segurança (rodapé esquerdo). Quando ausente, cai no `assinaturaDataUrl`. */
  assinaturaTstDataUrl?: string | null;
  /** Assinatura do Aprovador / Gestor (rodapé direito). */
  assinaturaGestorDataUrl?: string | null;
  solicitanteNome?: string | null;
};

export function gerarHoraExtraSabadoPDF(p: HoraExtraPdfParams): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentW = pageW - margin * 2;

  // Paleta leve: cinzas limpos + vermelho suave para marcações pontuais
  const brand: [number, number, number] = [31, 41, 55];       // gray/slate-800
  const accent: [number, number, number] = [185, 84, 84];     // vermelho suave
  const muted: [number, number, number] = [100, 116, 139];
  const soft: [number, number, number] = [249, 250, 251];
  const line: [number, number, number] = [229, 231, 235];

  // Title Case PT-BR: mantém preposições minúsculas e siglas (2-3 letras) em maiúsculas.
  const toTitleCase = (s: string): string => {
    const minusc = new Set(["de", "da", "do", "das", "dos", "e", "di", "du", "del", "la", "le", "von", "van"]);
    const partes = s.toLowerCase().trim().split(/\s+/);
    return partes
      .map((w, i) => {
        if (i > 0 && minusc.has(w)) return w;
        // Trata hifenizados (ex.: Maria-Clara)
        return w
          .split("-")
          .map((p) => (p.length === 0 ? p : p[0].toUpperCase() + p.slice(1)))
          .join("-");
      })
      .join(" ");
  };

  // ===== Helpers de desenho (recebem coords e devolvem altura consumida em mm) =====

  const drawHeaderEmpresa = (x: number, y: number, w: number, empresaNome: string, idx: number, total: number, parte?: { atual: number; total: number }): number => {
    const h = 19;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, w, h, 2, 2, "F");
    doc.setDrawColor(...line); doc.setLineWidth(0.3);
    doc.roundedRect(x, y, w, h, 2, 2, "S");
    doc.setFillColor(...accent);
    doc.rect(x + 2, y, w - 4, 1.2, "F");

    if (p.logoDataUrl) {
      try { doc.addImage(p.logoDataUrl, "PNG", x + 5, y + 3.5, 28, 12, undefined, "FAST"); } catch {}
    }
    doc.setTextColor(...brand);
    doc.setFont("helvetica", "bold").setFontSize(12.5);
    doc.text("FORMULÁRIO DE HORA EXTRA", x + 38, y + 9);
    doc.setFont("helvetica", "normal").setFontSize(7);
    doc.setTextColor(...muted);
    doc.text("Controle interno · não homologado", x + 38, y + 13.5);

    // Pílula EMPRESA (direita)
    const pillW = 60, pillH = 11;
    const pillX = x + w - pillW - 4;
    const pillY = y + (h - pillH) / 2;
    doc.setFillColor(...soft);
    doc.roundedRect(pillX, pillY, pillW, pillH, 1.5, 1.5, "F");
    doc.setDrawColor(...line); doc.setLineWidth(0.3);
    doc.roundedRect(pillX, pillY, pillW, pillH, 1.5, 1.5, "S");
    doc.setTextColor(...muted);
    doc.setFont("helvetica", "bold").setFontSize(6.5);
    doc.text("EMPRESA", pillX + 3, pillY + 4);
    doc.setTextColor(...brand);
    doc.setFontSize(8);
    const empName = empresaNome.toUpperCase();
    const empTrim = empName.length > 24 ? empName.slice(0, 23) + "…" : empName;
    doc.text(empTrim, pillX + 3, pillY + 9);
    doc.setFont("helvetica", "normal").setFontSize(6.5);
    doc.setTextColor(...muted);
    const pageLabel = parte && parte.total > 1
      ? `${idx + 1}/${total} · pt ${parte.atual}/${parte.total}`
      : `${idx + 1}/${total}`;
    doc.text(pageLabel, pillX + pillW - 3, pillY + 9, { align: "right" });
    return h;
  };

  const drawCardsInfo = (x: number, y: number, w: number, totalColabs: number): number => {
    const cardH = 11;
    const cardGap = 2.5;
    const cardW = (w - cardGap * 3) / 4;
    const cards = [
      { label: "DATA", value: p.data, sub: p.diaSemana.toUpperCase() },
      { label: "TURNO", value: p.turno ?? "—", sub: p.horario ?? "" },
      { label: "SETOR", value: p.setor ?? "—", sub: p.centroCusto ? `C.C. ${p.centroCusto}` : "" },
      { label: "COLABORADORES", value: String(totalColabs).padStart(2, "0"), sub: totalColabs === 1 ? "PESSOA" : "PESSOAS" },
    ];
    cards.forEach((c, i) => {
      const cx = x + i * (cardW + cardGap);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(cx, y, cardW, cardH, 2, 2, "F");
      doc.setDrawColor(...line); doc.setLineWidth(0.25);
      doc.roundedRect(cx, y, cardW, cardH, 2, 2, "S");
      doc.setFillColor(...accent); doc.rect(cx, y, 1.5, cardH, "F");
      doc.setTextColor(...muted);
      doc.setFont("helvetica", "bold").setFontSize(6);
      doc.text(c.label, cx + 3.5, y + 3.5);
      doc.setTextColor(...brand);
      const maxValW = cardW - 5;
      let valSize = 9;
      doc.setFont("helvetica", "bold").setFontSize(valSize);
      let valLines = doc.splitTextToSize(c.value, maxValW) as string[];
      while (valLines.length > 2 && valSize > 6.5) {
        valSize -= 0.5;
        doc.setFontSize(valSize);
        valLines = doc.splitTextToSize(c.value, maxValW) as string[];
      }
      if (valLines.length > 2) valLines = [valLines[0], (valLines[1] ?? "").replace(/.{1,3}$/, "…")];
      if (valLines.length === 1) doc.text(valLines[0], cx + 3.5, y + 7.5);
      else {
        doc.text(valLines[0], cx + 3.5, y + 6.6);
        doc.text(valLines[1], cx + 3.5, y + 6.6 + valSize * 0.42);
      }
      if (c.sub) {
        doc.setTextColor(...muted);
        doc.setFont("helvetica", "normal").setFontSize(6);
        doc.text(c.sub, cx + 3.5, y + 10.3);
      }
    });
    return cardH;
  };

  const drawFaixaFolha = (x: number, y: number, w: number, empresaNome: string): number => {
    const h = 6.5;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, w, h, 2, 2, "F");
    doc.setDrawColor(...line); doc.setLineWidth(0.3);
    doc.roundedRect(x, y, w, h, 2, 2, "S");
    doc.setTextColor(...accent);
    doc.setFont("helvetica", "bold").setFontSize(6.5);
    doc.text("EMPRESA DA FOLHA", x + 4, y + 4.3);
    doc.setTextColor(...brand);
    doc.setFont("helvetica", "bold").setFontSize(7.5);
    const txt = empresaNome.toUpperCase();
    const clipped = (doc.splitTextToSize(txt, w - 52)[0] as string) ?? txt;
    doc.text(clipped, x + 46, y + 4.3);
    return h;
  };

  const drawTituloEquipe = (x: number, y: number, w: number, empresaNome: string, totalColabs: number): number => {
    doc.setTextColor(...brand);
    doc.setFont("helvetica", "bold").setFontSize(9.5);
    const titulo = `EQUIPE · ${empresaNome.toUpperCase()}`;
    doc.text(titulo, x, y + 2.5);
    doc.setDrawColor(...accent); doc.setLineWidth(0.4);
    const tw = doc.getTextWidth(titulo);
    doc.line(x, y + 4.3, x + tw, y + 4.3);
    doc.setTextColor(...muted);
    doc.setFont("helvetica", "normal").setFontSize(7.5);
    doc.text(`${totalColabs} colaborador(es)`, x + w, y + 2.5, { align: "right" });
    return 6;
  };

  const siglaEmpresa = (e: string): string => {
    const up = e.toUpperCase();
    if (up.includes("M2")) return "M2";
    if (up.includes("DMN")) return "DMN";
    if (up.includes("EXTERN")) return "EXT";
    const ignor = new Set(["DE", "DA", "DO", "E", "LTDA", "S.A.", "SA", "ME", "EPP", "EIRELI"]);
    const ini = up.split(/\s+/).filter((w) => w && !ignor.has(w)).slice(0, 3).map((w) => w[0]).join("");
    return ini || up.slice(0, 4);
  };

  const drawTabelaEquipe = (x: number, y: number, w: number, funcionarios: HoraExtraFuncionario[], linhaInicial: number): number => {
    const headRowH = 7;
    const colIt = 9, colNome = 78, colTrans = 20, colAlim = 20, colPres = 18;
    const colAss = w - colIt - colNome - colTrans - colAlim - colPres;

    doc.setFillColor(...soft);
    doc.roundedRect(x, y, w, headRowH, 1.5, 1.5, "F");
    doc.setDrawColor(...accent); doc.setLineWidth(0.4);
    doc.roundedRect(x, y, w, headRowH, 1.5, 1.5, "S");
    doc.setTextColor(...brand);
    doc.setFont("helvetica", "bold").setFontSize(7);
    const hy = y + 4.6;
    doc.text("#", x + colIt / 2, hy, { align: "center" });
    doc.text("NOME COMPLETO", x + colIt + 2, hy);
    doc.text("TRANSP.", x + colIt + colNome + colTrans / 2, hy, { align: "center" });
    doc.text("ALIM.", x + colIt + colNome + colTrans + colAlim / 2, hy, { align: "center" });
    doc.text("PRES.", x + colIt + colNome + colTrans + colAlim + colPres / 2, hy, { align: "center" });
    doc.text("ASSINATURA", x + colIt + colNome + colTrans + colAlim + colPres + colAss / 2, hy, { align: "center" });

    const rowH = 6.6;
    let yy = y + headRowH;
    funcionarios.forEach((f, i) => {
      if (i % 2 === 0) { doc.setFillColor(...soft); doc.rect(x, yy, w, rowH, "F"); }
      doc.setDrawColor(...line); doc.setLineWidth(0.12);
      doc.line(x, yy + rowH, x + w, yy + rowH);
      const ty = yy + rowH / 2 + 1.4;
      doc.setTextColor(...muted);
      doc.setFont("helvetica", "bold").setFontSize(7.5);
      doc.text(String(linhaInicial + i).padStart(2, "0"), x + colIt / 2, ty, { align: "center" });

      doc.setTextColor(...brand);
      doc.setFont("helvetica", "bold").setFontSize(8);
      const nomeFmt = toTitleCase(f.nome);
      const nomeColAvail = colNome - 15;
      const nomeComEmpresa = f.empresa ? `${siglaEmpresa(f.empresa)} · ${nomeFmt}` : nomeFmt;
      const fitText = (text: string, maxW: number): string => {
        if (doc.getTextWidth(text) <= maxW) return text;
        let lo = 1, hi = text.length;
        while (lo < hi) {
          const mid = Math.floor((lo + hi) / 2);
          if (doc.getTextWidth(text.slice(0, mid) + "…") <= maxW) lo = mid + 1;
          else hi = mid;
        }
        return text.slice(0, Math.max(1, lo - 1)).trimEnd() + "…";
      };
      doc.text(fitText(nomeComEmpresa, nomeColAvail), x + colIt + 3, ty, { maxWidth: nomeColAvail });

      const drawBadge = (on: boolean, xc: number) => {
        const bw = 6.5, bh = 4;
        const bx = xc - bw / 2, by = yy + rowH / 2 - bh / 2;
        if (on) {
          doc.setDrawColor(...accent); doc.setLineWidth(0.4);
          doc.roundedRect(bx, by, bw, bh, 1, 1, "S");
          doc.setTextColor(...accent);
          doc.setFont("helvetica", "bold").setFontSize(6.5);
          doc.text("SIM", xc, by + 3.2, { align: "center" });
        } else {
          doc.setDrawColor(...line); doc.setLineWidth(0.25);
          doc.roundedRect(bx, by, bw, bh, 1, 1, "S");
          doc.setTextColor(...muted);
          doc.setFont("helvetica", "normal").setFontSize(6.5);
          doc.text("—", xc, by + 3.2, { align: "center" });
        }
      };
      drawBadge(f.transporte, x + colIt + colNome + colTrans / 2);
      drawBadge(f.alimentacao, x + colIt + colNome + colTrans + colAlim / 2);

      if (f.presenca) {
        const isP = f.presenca.toUpperCase().startsWith("P");
        doc.setTextColor(...(isP ? brand : accent));
        doc.setFont("helvetica", "bold").setFontSize(8.5);
        doc.text(f.presenca.toUpperCase(), x + colIt + colNome + colTrans + colAlim + colPres / 2, ty, { align: "center" });
      } else {
        doc.setTextColor(...line);
        doc.setFont("helvetica", "normal").setFontSize(8.5);
        doc.text("·", x + colIt + colNome + colTrans + colAlim + colPres / 2, ty, { align: "center" });
      }

      doc.setDrawColor(...line); doc.setLineWidth(0.25);
      const sx1 = x + colIt + colNome + colTrans + colAlim + colPres + 3;
      const sx2 = x + w - 3;
      doc.line(sx1, yy + rowH - 1.6, sx2, yy + rowH - 1.6);

      if (f.assinaturaDataUrl) {
        try {
          const url = f.assinaturaDataUrl;
          const m = /^data:image\/(png|jpeg|jpg|webp);base64,/i.exec(url);
          const fmt = (m?.[1] ?? "png").toUpperCase().replace("JPG", "JPEG");
          const props = (doc as any).getImageProperties?.(url);
          const maxH = rowH - 1.8;
          const maxW = sx2 - sx1;
          let imgH = maxH;
          let imgW = imgH * 2.5;
          if (props?.width && props?.height) {
            const ratio = props.width / props.height;
            imgH = maxH;
            imgW = imgH * ratio;
            if (imgW > maxW) { imgW = maxW; imgH = imgW / ratio; }
          }
          const cx = (sx1 + sx2) / 2;
          doc.addImage(url, fmt === "WEBP" ? "PNG" : fmt, cx - imgW / 2, yy + rowH - 1.6 - imgH, imgW, imgH, undefined, "FAST");
        } catch {}
      }

      yy += rowH;
    });
    return headRowH + funcionarios.length * rowH;
  };

  const drawAssinaturaRodape = (x: number, y: number, w: number): number => {
    const h = 26;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, w, h, 2, 2, "F");
    doc.setDrawColor(...line); doc.setLineWidth(0.25);
    doc.roundedRect(x, y, w, h, 2, 2, "S");
    doc.setFillColor(...accent); doc.rect(x + 2, y, w - 4, 1, "F");

    const sigColW = w * 0.55;
    const sigCenterX = x + sigColW / 2;
    if (p.assinaturaDataUrl) {
      try {
        const m = /^data:image\/(png|jpeg|jpg|webp);base64,/i.exec(p.assinaturaDataUrl);
        const fmt = (m?.[1] ?? "png").toUpperCase().replace("JPG", "JPEG");
        const props = (doc as any).getImageProperties?.(p.assinaturaDataUrl);
        const previewH = p.assinaturaHeight ?? 80;
        const maxH = Math.max(6, Math.min(16, 4 + previewH * 0.09));
        const maxW = sigColW - 16;
        let imgH = maxH, imgW = imgH * 2.5;
        if (props?.width && props?.height) {
          const ratio = props.width / props.height;
          imgH = maxH; imgW = imgH * ratio;
          if (imgW > maxW) { imgW = maxW; imgH = imgW / ratio; }
        }
        doc.addImage(p.assinaturaDataUrl, fmt === "WEBP" ? "PNG" : fmt, sigCenterX - imgW / 2, y + 15 - imgH, imgW, imgH, undefined, "FAST");
      } catch (err) { console.error("[hora-extra-pdf] falha ao inserir assinatura:", err); }
    }
    doc.setDrawColor(...brand); doc.setLineWidth(0.4);
    doc.line(x + 12, y + 17, x + sigColW - 12, y + 17);
    doc.setTextColor(...brand);
    doc.setFont("helvetica", "bold").setFontSize(7.5);
    doc.text("TÉCNICO EM SEGURANÇA DO TRABALHO", sigCenterX, y + 21, { align: "center" });
    doc.setFont("helvetica", "normal").setFontSize(6.5);
    doc.setTextColor(...muted);
    doc.text(`Emitido em ${p.data}`, sigCenterX, y + 24.5, { align: "center" });

    doc.setDrawColor(...line); doc.setLineWidth(0.25);
    doc.line(x + sigColW, y + 4, x + sigColW, y + h - 4);

    const apvX = x + sigColW, apvW = w - sigColW, apvCenter = apvX + apvW / 2;
    doc.setDrawColor(...brand); doc.setLineWidth(0.4);
    doc.line(apvX + 12, y + 17, apvX + apvW - 12, y + 17);
    doc.setTextColor(...brand);
    doc.setFont("helvetica", "bold").setFontSize(7.5);
    doc.text("APROVAÇÃO / GESTOR", apvCenter, y + 21, { align: "center" });
    doc.setFont("helvetica", "normal").setFontSize(6.5);
    doc.setTextColor(...muted);
    doc.text("Assinatura e data", apvCenter, y + 24.5, { align: "center" });
    return h;
  };

  const drawRodapePagina = (idx: number, total: number, primeiraEmpresa: string) => {
    doc.setTextColor(...muted);
    doc.setFont("helvetica", "normal").setFontSize(6.5);
    doc.text(`Página ${idx + 1} de ${total} · ${primeiraEmpresa.toUpperCase()}`, margin, pageH - 4);
    doc.text("Documento interno · não homologado", margin + contentW, pageH - 4, { align: "right" });
  };

  // ===== Montagem dos blocos-empresa =====
  type GrupoEmpresa = {
    empresaNome: string;
    funcionarios: HoraExtraFuncionario[];
    totalFuncionarios: number;
    linhaInicial: number;
    parte: number;
    partes: number;
  };

  // Capacidade útil da página: 297 - margin*2 - assinatura(26) - rodapé(6) ≈ 245mm
  const SIG_H = 26;
  const FOOTER_RESERVE = 6;
  const PAGE_CAPACITY = pageH - margin * 2 - SIG_H - FOOTER_RESERVE;
  const BLOCK_GAP = 4; // gap visual entre blocos-empresa
  // Overhead fixo de um bloco-empresa: header(19)+gap(3)+cards(11)+gap(3)+faixa(6.5)+gap(3)+titulo(6)+tab-head(7) = 58.5
  const BLOCK_OVERHEAD = 58.5;
  const ROW_H = 6.6;
  const MAX_ROWS_BLOCO = Math.floor((PAGE_CAPACITY - BLOCK_OVERHEAD) / ROW_H);

  const paginas = p.paginas.length > 0 ? p.paginas : [{ empresaNome: "—", funcionarios: [] as HoraExtraFuncionario[] }];

  // Pré-dividir empresas que não cabem em uma página inteira (caso raro mas evita overflow)
  const grupos: GrupoEmpresa[] = [];
  paginas.forEach((pag) => {
    const total = pag.funcionarios.length;
    if (total <= MAX_ROWS_BLOCO) {
      grupos.push({
        empresaNome: pag.empresaNome,
        funcionarios: pag.funcionarios,
        totalFuncionarios: total,
        linhaInicial: 1,
        parte: 1,
        partes: 1,
      });
      return;
    }
    const partes = Math.ceil(total / MAX_ROWS_BLOCO);
    for (let i = 0; i < partes; i++) {
      const slice = pag.funcionarios.slice(i * MAX_ROWS_BLOCO, (i + 1) * MAX_ROWS_BLOCO);
      grupos.push({
        empresaNome: pag.empresaNome,
        funcionarios: slice,
        totalFuncionarios: total,
        linhaInicial: i * MAX_ROWS_BLOCO + 1,
        parte: i + 1,
        partes,
      });
    }
  });

  // Cria os FlowBlocks (cada grupo = 1 bloco atômico)
  const blocks: FlowBlock<{ grupoIndex: number }>[] = grupos.map((g, gIdx) => {
    const height = BLOCK_OVERHEAD + g.funcionarios.length * ROW_H;
    return {
      height,
      meta: { empresaNome: g.empresaNome, grupoIndex: gIdx },
      draw: ({ x, y, pageIndex, pageTotal }) => {
        let yy = y;
        yy += drawHeaderEmpresa(x, yy, contentW, g.empresaNome, pageIndex, pageTotal, g.partes > 1 ? { atual: g.parte, total: g.partes } : undefined);
        yy += 3;
        yy += drawCardsInfo(x, yy, contentW, g.totalFuncionarios);
        yy += 3;
        yy += drawFaixaFolha(x, yy, contentW, g.empresaNome);
        yy += 3;
        yy += drawTituloEquipe(x, yy, contentW, g.empresaNome, g.totalFuncionarios);
        drawTabelaEquipe(x, yy, contentW, g.funcionarios, g.linhaInicial);
      },
    };
  });

  // Empacota em páginas
  // lookahead=true: se o próximo bloco não couber, tenta encaixar os seguintes
  // antes de virar a página (maximiza aproveitamento).
  const pages = packBlocksIntoPages(blocks, PAGE_CAPACITY, BLOCK_GAP, { lookahead: true });

  // Desenha
  drawFlowPages({
    pages,
    startY: margin,
    x: margin,
    gap: BLOCK_GAP,
    userCtx: { grupoIndex: 0 },
    newPage: () => doc.addPage(),
    afterPage: (i, total, page) => {
      // Assinatura ancorada no rodapé (uma por página)
      drawAssinaturaRodape(margin, pageH - margin - SIG_H, contentW);
      // Rodapé: primeira empresa da página
      const primeira = (page.blocks[0]?.meta as any)?.empresaNome ?? "—";
      drawRodapePagina(i, total, String(primeira));
    },
  });

  return doc;
}
