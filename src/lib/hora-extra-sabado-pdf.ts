import jsPDF from "jspdf";
import { packBlocksIntoPages, type FlowBlock } from "@/lib/pdf-flow-engine";

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

  // Total geral de colaboradores convocados (soma todas as empresas)
  const totalGeralColabs = p.paginas.reduce((s, pag) => s + pag.funcionarios.length, 0);

  // Cabeçalho mestre: aparece APENAS na primeira página
  const drawMasterHeader = (x: number, y: number, w: number): number => {
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
    doc.text("Controle interno", x + 38, y + 13.5);
    return h;
  };

  const drawMasterCards = (x: number, y: number, w: number): number => {
    const cardH = 15;
    const cardGap = 2.5;
    const cardW = (w - cardGap * 3) / 4;
    const cards = [
      { label: "DATA", value: p.data, sub: p.diaSemana.toUpperCase() },
      { label: "TURNO", value: p.turno ?? "—", sub: p.horario ?? "" },
      { label: "SETOR", value: p.setor ?? "—", sub: p.centroCusto ? `C.C. ${p.centroCusto}` : "" },
      { label: "TOTAL DE COLABORADORES EM EXTRA", value: String(totalGeralColabs).padStart(2, "0"), sub: totalGeralColabs === 1 ? "PESSOA" : "PESSOAS" },
    ];
    cards.forEach((c, i) => {
      const cx = x + i * (cardW + cardGap);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(cx, y, cardW, cardH, 2, 2, "F");
      doc.setDrawColor(...line); doc.setLineWidth(0.25);
      doc.roundedRect(cx, y, cardW, cardH, 2, 2, "S");
      doc.setFillColor(...accent); doc.rect(cx, y, 1.5, cardH, "F");
      doc.setTextColor(...muted);
      doc.setFont("helvetica", "bold").setFontSize(5.4);
      const labelLines = doc.splitTextToSize(c.label, cardW - 5) as string[];
      const labelToShow = labelLines.slice(0, 2);
      labelToShow.forEach((ln, li) => doc.text(ln, cx + 3.5, y + 3.2 + li * 2.2));
      const labelBaseline = 3.2 + (labelToShow.length - 1) * 2.2;
      // Auto-shrink do valor: começa em 9pt e reduz até caber em cardW-7
      doc.setTextColor(...brand);
      let valFs = 9;
      doc.setFont("helvetica", "bold").setFontSize(valFs);
      const maxValW = cardW - 7;
      while (doc.getTextWidth(c.value) > maxValW && valFs > 5.5) {
        valFs -= 0.5;
        doc.setFontSize(valFs);
      }
      // Valor pode usar até 2 linhas (ex.: "Administrativo, Almoxarifado")
      const valLines = doc.splitTextToSize(c.value, maxValW) as string[];
      const valShow = valLines.slice(0, 2);
      valShow.forEach((ln, li) => doc.text(ln, cx + 3.5, y + labelBaseline + 4 + li * (valFs * 0.38)));
      if (c.sub) {
        doc.setTextColor(...muted);
        doc.setFont("helvetica", "normal").setFontSize(5.6);
        doc.text(c.sub, cx + 3.5, y + cardH - 1.8);
      }
    });
    return cardH;
  };

  const drawHeaderEmpresa = (x: number, y: number, w: number, empresaNome: string, totalColabs: number, parte?: { atual: number; total: number }): number => {
    const h = 14;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, w, h, 2, 2, "F");
    doc.setDrawColor(...line); doc.setLineWidth(0.3);
    doc.roundedRect(x, y, w, h, 2, 2, "S");
    doc.setFillColor(...accent);
    doc.rect(x, y, 1.8, h, "F");

    doc.setTextColor(...muted);
    doc.setFont("helvetica", "bold").setFontSize(6.5);
    doc.text("EMPRESA", x + 5, y + 5);
    doc.setTextColor(...brand);
    doc.setFont("helvetica", "bold").setFontSize(11);
    const empName = empresaNome.toUpperCase();
    // Pílula CONVOCADOS (direita)
    const pillW = 52, pillH = 9;
    const pillX = x + w - pillW - 4;
    const pillY = y + (h - pillH) / 2;
    const empMaxW = pillX - (x + 5) - 4;
    const empFit = (doc.splitTextToSize(empName, empMaxW)[0] as string) ?? empName;
    doc.text(empFit, x + 5, y + 11);

    doc.setFillColor(...soft);
    doc.roundedRect(pillX, pillY, pillW, pillH, 1.5, 1.5, "F");
    doc.setDrawColor(...line); doc.setLineWidth(0.3);
    doc.roundedRect(pillX, pillY, pillW, pillH, 1.5, 1.5, "S");
    doc.setTextColor(...muted);
    doc.setFont("helvetica", "bold").setFontSize(6);
    doc.text("CONVOCADOS", pillX + 3, pillY + 3.5);
    doc.setTextColor(...accent);
    doc.setFont("helvetica", "bold").setFontSize(10);
    const partTxt = parte && parte.total > 1 ? ` (pt ${parte.atual}/${parte.total})` : "";
    doc.text(`${String(totalColabs).padStart(2, "0")}${partTxt}`, pillX + 3, pillY + 8);
    return h;
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
    const tstSig = p.assinaturaTstDataUrl ?? p.assinaturaDataUrl ?? null;
    if (tstSig) {
      try {
        const m = /^data:image\/(png|jpeg|jpg|webp);base64,/i.exec(tstSig);
        const fmt = (m?.[1] ?? "png").toUpperCase().replace("JPG", "JPEG");
        const props = (doc as any).getImageProperties?.(tstSig);
        const previewH = p.assinaturaHeight ?? 80;
        const maxH = Math.max(6, Math.min(16, 4 + previewH * 0.09));
        const maxW = sigColW - 16;
        let imgH = maxH, imgW = imgH * 2.5;
        if (props?.width && props?.height) {
          const ratio = props.width / props.height;
          imgH = maxH; imgW = imgH * ratio;
          if (imgW > maxW) { imgW = maxW; imgH = imgW / ratio; }
        }
        doc.addImage(tstSig, fmt === "WEBP" ? "PNG" : fmt, sigCenterX - imgW / 2, y + 15 - imgH, imgW, imgH, undefined, "FAST");
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
    if (p.assinaturaGestorDataUrl) {
      try {
        const u = p.assinaturaGestorDataUrl;
        const m = /^data:image\/(png|jpeg|jpg|webp);base64,/i.exec(u);
        const fmt = (m?.[1] ?? "png").toUpperCase().replace("JPG", "JPEG");
        const props = (doc as any).getImageProperties?.(u);
        const maxH = 14;
        const maxW = apvW - 16;
        let imgH = maxH, imgW = imgH * 2.5;
        if (props?.width && props?.height) {
          const ratio = props.width / props.height;
          imgH = maxH; imgW = imgH * ratio;
          if (imgW > maxW) { imgW = maxW; imgH = imgW / ratio; }
        }
        doc.addImage(u, fmt === "WEBP" ? "PNG" : fmt, apvCenter - imgW / 2, y + 15 - imgH, imgW, imgH, undefined, "FAST");
      } catch (err) { console.error("[hora-extra-pdf] falha ao inserir assinatura gestor:", err); }
    }
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
    doc.text(`Página ${idx + 1} de ${total}`, margin + contentW / 2, pageH - 4, { align: "center" });
  };

  // ===== Montagem das páginas (size-desc + smart slicing) =====
  // Capacidade útil da página: 297 - margin*2 - assinatura(26) - rodapé(6) ≈ 245mm
  const SIG_H = 26;
  const FOOTER_RESERVE = 6;
  const PAGE_CAPACITY = pageH - margin * 2 - SIG_H - FOOTER_RESERVE;
  const BLOCK_GAP = 4; // gap visual entre blocos-empresa
  // Overhead fixo de um bloco-empresa: header(14)+gap(3)+tab-head(7) = 24
  const BLOCK_OVERHEAD = 24;
  const ROW_H = 6.6;
  // Cabeçalho mestre (só na pág 1): header(19)+gap(3)+cards(15)
  const MASTER_HEADER_H = 19 + 3 + 15;
  const PAGE1_CAPACITY = PAGE_CAPACITY - MASTER_HEADER_H - BLOCK_GAP;
  const MIN_SLICE_ROWS = 5; // só fatia se couber pelo menos N linhas — "fatia com bom senso"

  const paginasIn = p.paginas.length > 0 ? p.paginas : [{ empresaNome: "—", funcionarios: [] as HoraExtraFuncionario[] }];

  // Ordena empresas por nº de funcionários DESC — as maiores entram primeiro;
  // as pequenas naturalmente "preenchem o rabo" das páginas finais.
  type EmpresaRest = {
    empresaNome: string;
    funcionarios: HoraExtraFuncionario[];
    total: number;
    cursor: number; // próxima linha a desenhar (0-based)
  };
  const restantes: EmpresaRest[] = paginasIn
    .filter((p) => p.funcionarios.length > 0)
    .sort((a, b) => b.funcionarios.length - a.funcionarios.length)
    .map((p) => ({
      empresaNome: p.empresaNome,
      funcionarios: p.funcionarios,
      total: p.funcionarios.length,
      cursor: 0,
    }));

  type Slice = {
    empresaNome: string;
    funcionarios: HoraExtraFuncionario[];
    total: number;
    linhaInicial: number;
    parteAtual: number; // 1-based; resolvido depois
    partesTotais: number;
  };
  const pagesSlices: Slice[][] = [];
  // contador de partes por empresa (preenchido em duas passadas)
  const parteCounter = new Map<string, number>();

  while (restantes.some((r) => r.cursor < r.total)) {
    const pageIdx = pagesSlices.length;
    const cap = pageIdx === 0 ? PAGE1_CAPACITY : PAGE_CAPACITY;
    let used = 0;
    const pageBlocks: Slice[] = [];

    // Passada 1: encaixa empresas inteiras (mais quantidade primeiro, na ordem que sobrou)
    let placedAny = true;
    while (placedAny) {
      placedAny = false;
      for (let i = 0; i < restantes.length; i++) {
        const emp = restantes[i];
        const rowsLeft = emp.total - emp.cursor;
        if (rowsLeft <= 0) continue;
        const gap = pageBlocks.length > 0 ? BLOCK_GAP : 0;
        const fullH = BLOCK_OVERHEAD + rowsLeft * ROW_H;
        if (used + gap + fullH <= cap) {
          const linhaInicial = emp.cursor + 1;
          const parte = (parteCounter.get(emp.empresaNome) ?? 0) + 1;
          parteCounter.set(emp.empresaNome, parte);
          pageBlocks.push({
            empresaNome: emp.empresaNome,
            funcionarios: emp.funcionarios.slice(emp.cursor, emp.cursor + rowsLeft),
            total: emp.total,
            linhaInicial,
            parteAtual: parte,
            partesTotais: 0,
          });
          used += gap + fullH;
          emp.cursor = emp.total;
          placedAny = true;
        }
      }
    }

    // Passada 2: ninguém inteiro coube — fatia a próxima empresa restante (a maior ainda em fila)
    if (pageBlocks.length === 0 || !restantes.some((r) => r.cursor < r.total) === false) {
      const next = restantes.find((r) => r.cursor < r.total);
      if (next) {
        const gap = pageBlocks.length > 0 ? BLOCK_GAP : 0;
        const avail = cap - used - gap - BLOCK_OVERHEAD;
        const rowsFit = Math.floor(avail / ROW_H);
        const rowsLeft = next.total - next.cursor;
        const shouldSlice =
          rowsFit > 0 &&
          (pageBlocks.length === 0 // página vazia: fatia o que der pra não travar
            ? true
            : rowsFit >= MIN_SLICE_ROWS); // página com conteúdo: só fatia se valer a pena
        if (shouldSlice) {
          const take = Math.min(rowsFit, rowsLeft);
          const linhaInicial = next.cursor + 1;
          const parte = (parteCounter.get(next.empresaNome) ?? 0) + 1;
          parteCounter.set(next.empresaNome, parte);
          pageBlocks.push({
            empresaNome: next.empresaNome,
            funcionarios: next.funcionarios.slice(next.cursor, next.cursor + take),
            total: next.total,
            linhaInicial,
            parteAtual: parte,
            partesTotais: 0,
          });
          next.cursor += take;
          used += gap + BLOCK_OVERHEAD + take * ROW_H;
        }
      }
    }

    if (pageBlocks.length === 0) break; // segurança
    pagesSlices.push(pageBlocks);
  }

  // Resolve partesTotais (quantas partes cada empresa acabou virando)
  pagesSlices.forEach((page) =>
    page.forEach((b) => {
      b.partesTotais = parteCounter.get(b.empresaNome) ?? 1;
    }),
  );

  // Desenho
  pagesSlices.forEach((page, i) => {
    if (i > 0) doc.addPage();
    let y = margin;
    if (i === 0) {
      y += drawMasterHeader(margin, y, contentW);
      y += 3;
      y += drawMasterCards(margin, y, contentW);
      y += BLOCK_GAP;
    }
    page.forEach((b, idx) => {
      if (idx > 0) y += BLOCK_GAP;
      const partes = b.partesTotais > 1 ? { atual: b.parteAtual, total: b.partesTotais } : undefined;
      y += drawHeaderEmpresa(margin, y, contentW, b.empresaNome, b.total, partes);
      y += 3;
      drawTabelaEquipe(margin, y, contentW, b.funcionarios, b.linhaInicial);
      y += 7 + b.funcionarios.length * ROW_H; // tab-head + linhas
    });
    drawAssinaturaRodape(margin, pageH - margin - SIG_H, contentW);
    drawRodapePagina(i, pagesSlices.length, "");
  });

  return doc;
}
