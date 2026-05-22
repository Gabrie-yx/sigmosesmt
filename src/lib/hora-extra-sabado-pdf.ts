import jsPDF from "jspdf";

export type HoraExtraFuncionario = {
  nome: string;
  transporte: boolean;
  alimentacao: boolean;
  presenca?: string | null;
  empresa?: string | null;
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

  const drawPagina = (
    pagina: HoraExtraPaginaEmpresa,
    idx: number,
    total: number,
    parte?: { atual: number; total: number },
  ) => {
    // ===== HEADER clean =====
    const headerH = 19;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin, margin, contentW, headerH, 2, 2, "F");
    doc.setDrawColor(...line);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, margin, contentW, headerH, 2, 2, "S");
    // Linha de acento sutil no topo
    doc.setFillColor(...accent);
    doc.rect(margin + 2, margin, contentW - 4, 1.2, "F");

    // Logo
    if (p.logoDataUrl) {
      try {
        doc.addImage(p.logoDataUrl, "PNG", margin + 5, margin + 3.5, 28, 12, undefined, "FAST");
      } catch {}
    }

    // Título
    doc.setTextColor(...brand);
    doc.setFont("helvetica", "bold").setFontSize(12.5);
    doc.text("FORMULÁRIO DE HORA EXTRA", margin + 38, margin + 9);
    doc.setFont("helvetica", "normal").setFontSize(7);
    doc.setTextColor(...muted);
    doc.text("Controle interno · não homologado", margin + 38, margin + 13.5);

    // Identificação da empresa (direita, limpa e sem sobrepor o título)
    const pillW = 60;
    const pillH = 11;
    const pillX = margin + contentW - pillW - 4;
    const pillY = margin + (headerH - pillH) / 2;
    doc.setFillColor(...soft);
    doc.roundedRect(pillX, pillY, pillW, pillH, 1.5, 1.5, "F");
    doc.setDrawColor(...line);
    doc.setLineWidth(0.3);
    doc.roundedRect(pillX, pillY, pillW, pillH, 1.5, 1.5, "S");
    doc.setTextColor(...muted);
    doc.setFont("helvetica", "bold").setFontSize(6.5);
    doc.text("EMPRESA", pillX + 3, pillY + 4);
    doc.setTextColor(...brand);
    doc.setFontSize(8);
    const empName = pagina.empresaNome.toUpperCase();
    const empTrim = empName.length > 24 ? empName.slice(0, 23) + "…" : empName;
    doc.text(empTrim, pillX + 3, pillY + 9);
    doc.setFont("helvetica", "normal").setFontSize(6.5);
    doc.setTextColor(...muted);
    const pageLabel = parte && parte.total > 1
      ? `${idx + 1}/${total} · pt ${parte.atual}/${parte.total}`
      : `${idx + 1}/${total}`;
    doc.text(pageLabel, pillX + pillW - 3, pillY + 9, { align: "right" });

    let y = margin + headerH + 3;

    // ===== INFO CARDS (4 mini-cards) =====
    const cardH = 11;
    const cardGap = 2.5;
    const cardW = (contentW - cardGap * 3) / 4;
    const cards = [
      { label: "DATA", value: p.data, sub: p.diaSemana.toUpperCase() },
      { label: "TURNO", value: p.turno ?? "—", sub: p.horario ?? "" },
      { label: "SETOR", value: p.setor ?? "—", sub: p.centroCusto ? `C.C. ${p.centroCusto}` : "" },
      { label: "REGIME", value: p.tipoEfetivo, sub: p.tipoEfetivo === "DMN" ? "EFETIVO" : p.tipoEfetivo === "MEI" ? "MEI" : "TERCEIRIZADO" },
    ];
    cards.forEach((c, i) => {
      const cx = margin + i * (cardW + cardGap);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(cx, y, cardW, cardH, 2, 2, "F");
      doc.setDrawColor(...line);
      doc.setLineWidth(0.25);
      doc.roundedRect(cx, y, cardW, cardH, 2, 2, "S");
      // Barra lateral discreta
      doc.setFillColor(...accent);
      doc.rect(cx, y, 1.5, cardH, "F");
      doc.setTextColor(...muted);
      doc.setFont("helvetica", "bold").setFontSize(6);
      doc.text(c.label, cx + 3.5, y + 3.5);
      doc.setTextColor(...brand);
      // Quebra em até 2 linhas, reduzindo a fonte se necessário p/ caber.
      const maxValW = cardW - 5;
      let valSize = 9;
      doc.setFont("helvetica", "bold").setFontSize(valSize);
      let valLines = doc.splitTextToSize(c.value, maxValW) as string[];
      while (valLines.length > 2 && valSize > 6.5) {
        valSize -= 0.5;
        doc.setFontSize(valSize);
        valLines = doc.splitTextToSize(c.value, maxValW) as string[];
      }
      if (valLines.length > 2) {
        valLines = [valLines[0], (valLines[1] ?? "").replace(/.{1,3}$/, "…")];
      }
      if (valLines.length === 1) {
        doc.text(valLines[0], cx + 3.5, y + 7.5);
      } else {
        doc.text(valLines[0], cx + 3.5, y + 6.6);
        doc.text(valLines[1], cx + 3.5, y + 6.6 + valSize * 0.42);
      }
      if (c.sub) {
        doc.setTextColor(...muted);
        doc.setFont("helvetica", "normal").setFontSize(6);
        doc.text(c.sub, cx + 3.5, y + 10.3);
      }
    });
    y += cardH + 3;

    // ===== Faixa de identificação da folha =====
    const envH = 6.5;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin, y, contentW, envH, 2, 2, "F");
    doc.setDrawColor(...line);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentW, envH, 2, 2, "S");
    doc.setTextColor(...accent);
    doc.setFont("helvetica", "bold").setFontSize(6.5);
    doc.text("EMPRESA DA FOLHA", margin + 4, y + 4.3);
    doc.setTextColor(...brand);
    doc.setFont("helvetica", "bold").setFontSize(7.5);
    const envText = pagina.empresaNome.toUpperCase();
    const envClipped = doc.splitTextToSize(envText, contentW - 52)[0] ?? envText;
    doc.text(envClipped, margin + 46, y + 4.3);
    y += envH + 3;

    // ===== Título da equipe =====
    doc.setTextColor(...brand);
    doc.setFont("helvetica", "bold").setFontSize(9.5);
    doc.text(`EQUIPE · ${pagina.empresaNome.toUpperCase()}`, margin, y + 2.5);
    doc.setDrawColor(...accent);
    doc.setLineWidth(0.4);
    const titleW = doc.getTextWidth(`EQUIPE · ${pagina.empresaNome.toUpperCase()}`);
    doc.line(margin, y + 4.3, margin + titleW, y + 4.3);
    doc.setTextColor(...muted);
    doc.setFont("helvetica", "normal").setFontSize(7.5);
    doc.text(`${pagina.totalFuncionarios ?? pagina.funcionarios.length} colaborador(es)`, margin + contentW, y + 2.5, { align: "right" });
    y += 6;

    // ===== TABELA =====
    const headRowH = 7;
    const colIt = 9;
    const colNome = 72;
    const colTrans = 22;
    const colAlim = 22;
    const colPres = 20;
    const colAss = contentW - colIt - colNome - colTrans - colAlim - colPres;

    // Cabeçalho — cinza suave
    doc.setFillColor(...soft);
    doc.roundedRect(margin, y, contentW, headRowH, 1.5, 1.5, "F");
    doc.setDrawColor(...accent);
    doc.setLineWidth(0.4);
    doc.roundedRect(margin, y, contentW, headRowH, 1.5, 1.5, "S");
    doc.setTextColor(...brand);
    doc.setFont("helvetica", "bold").setFontSize(7);
    const hy = y + 4.6;
    doc.text("#", margin + colIt / 2, hy, { align: "center" });
    doc.text("NOME COMPLETO", margin + colIt + 2, hy);
    doc.text("TRANSP.", margin + colIt + colNome + colTrans / 2, hy, { align: "center" });
    doc.text("ALIM.", margin + colIt + colNome + colTrans + colAlim / 2, hy, { align: "center" });
    doc.text("PRES.", margin + colIt + colNome + colTrans + colAlim + colPres / 2, hy, { align: "center" });
    doc.text("ASSINATURA", margin + colIt + colNome + colTrans + colAlim + colPres + colAss / 2, hy, { align: "center" });
    y += headRowH;

    // Linhas
    const rowH = 6.6;
    const rowsToDraw = pagina.funcionarios.length;

    for (let i = 0; i < rowsToDraw; i++) {
      const f = pagina.funcionarios[i];

      // Zebra: slate-50 / branco
      if (i % 2 === 0) {
        doc.setFillColor(...soft);
        doc.rect(margin, y, contentW, rowH, "F");
      }
      doc.setDrawColor(...line);
      doc.setLineWidth(0.12);
      doc.line(margin, y + rowH, margin + contentW, y + rowH);

      if (f) {
        const ty = y + rowH / 2 + 1.4;
        // #
        doc.setTextColor(...muted);
        doc.setFont("helvetica", "bold").setFontSize(7.5);
        const linhaNumero = (pagina.linhaInicial ?? 1) + i;
        doc.text(String(linhaNumero).padStart(2, "0"), margin + colIt / 2, ty, { align: "center" });

        // Nome
        doc.setTextColor(...brand);
        doc.setFont("helvetica", "bold").setFontSize(8);
        const nomeFmt = toTitleCase(f.nome);
        const nome = nomeFmt.length > 42 ? nomeFmt.substring(0, 40) + "…" : nomeFmt;
        doc.text(nome, margin + colIt + 3, ty);

        // Badge helper — outline clean
        const drawBadge = (
          on: boolean,
          xCenter: number,
        ) => {
          const bw = 6.5;
          const bh = 4;
          const bx = xCenter - bw / 2;
          const by = y + rowH / 2 - bh / 2;
          if (on) {
            doc.setDrawColor(...accent);
            doc.setLineWidth(0.4);
            doc.roundedRect(bx, by, bw, bh, 1, 1, "S");
            doc.setTextColor(...accent);
            doc.setFont("helvetica", "bold").setFontSize(6.5);
            doc.text("SIM", xCenter, by + 3.2, { align: "center" });
          } else {
            doc.setDrawColor(...line);
            doc.setLineWidth(0.25);
            doc.roundedRect(bx, by, bw, bh, 1, 1, "S");
            doc.setTextColor(...muted);
            doc.setFont("helvetica", "normal").setFontSize(6.5);
            doc.text("—", xCenter, by + 3.2, { align: "center" });
          }
        };

        drawBadge(f.transporte, margin + colIt + colNome + colTrans / 2);
        drawBadge(f.alimentacao, margin + colIt + colNome + colTrans + colAlim / 2);

        // Presença
        if (f.presenca) {
          const isP = f.presenca.toUpperCase().startsWith("P");
          doc.setTextColor(...(isP ? brand : accent));
          doc.setFont("helvetica", "bold").setFontSize(8.5);
          doc.text(f.presenca.toUpperCase(), margin + colIt + colNome + colTrans + colAlim + colPres / 2, ty, { align: "center" });
        } else {
          doc.setTextColor(...line);
          doc.setFont("helvetica", "normal").setFontSize(8.5);
          doc.text("·", margin + colIt + colNome + colTrans + colAlim + colPres / 2, ty, { align: "center" });
        }

        // Linha de assinatura
        doc.setDrawColor(...line);
        doc.setLineWidth(0.25);
        const sx1 = margin + colIt + colNome + colTrans + colAlim + colPres + 3;
        const sx2 = margin + contentW - 3;
        doc.line(sx1, y + rowH - 1.6, sx2, y + rowH - 1.6);
      }
      y += rowH;
    }

    // ===== OBSERVAÇÃO =====
    if (p.observacao && y + 16 < pageH - margin - 30) {
      y += 3;
      doc.setFillColor(255, 255, 255);
      const obsLines = doc.splitTextToSize(p.observacao, contentW - 10);
      const obsH = Math.min(15, 5.5 + obsLines.length * 3.4);
      doc.roundedRect(margin, y, contentW, obsH, 2, 2, "F");
      doc.setDrawColor(...line);
      doc.setLineWidth(0.25);
      doc.roundedRect(margin, y, contentW, obsH, 2, 2, "S");
      doc.setFillColor(...accent);
      doc.rect(margin, y, 1.5, obsH, "F");
      doc.setTextColor(...accent);
      doc.setFont("helvetica", "bold").setFontSize(6.5);
      doc.text("OBSERVAÇÃO", margin + 4, y + 3.8);
      doc.setTextColor(...brand);
      doc.setFont("helvetica", "normal").setFontSize(7.5);
      doc.text(obsLines.slice(0, 3), margin + 4, y + 7.5);
      y += obsH;
    }

    // ===== RODAPÉ COM ASSINATURA =====
    const sigBlockH = 26;
    const sigY = pageH - margin - sigBlockH;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin, sigY, contentW, sigBlockH, 2, 2, "F");
    doc.setDrawColor(...line);
    doc.setLineWidth(0.25);
    doc.roundedRect(margin, sigY, contentW, sigBlockH, 2, 2, "S");
    doc.setFillColor(...accent);
    doc.rect(margin + 2, sigY, contentW - 4, 1, "F");

    // Coluna esquerda: assinatura
    const sigColW = contentW * 0.55;
    const sigCenterX = margin + sigColW / 2;
    if (p.assinaturaDataUrl) {
      try {
        const h = Math.min(p.assinaturaHeight ?? 12, 13);
        const w = h * 2.5;
        doc.addImage(p.assinaturaDataUrl, "PNG", sigCenterX - w / 2, sigY + 3, w, h, undefined, "FAST");
      } catch {}
    }
    doc.setDrawColor(...brand);
    doc.setLineWidth(0.4);
    doc.line(margin + 12, sigY + 17, margin + sigColW - 12, sigY + 17);
    doc.setTextColor(...brand);
    doc.setFont("helvetica", "bold").setFontSize(7.5);
    doc.text(
      `SOLICITANTE${p.solicitanteNome ? " · " + toTitleCase(p.solicitanteNome) : ""}`,
      sigCenterX,
      sigY + 21,
      { align: "center" },
    );
    doc.setFont("helvetica", "normal").setFontSize(6.5);
    doc.setTextColor(...muted);
    doc.text(`Emitido em ${p.data}`, sigCenterX, sigY + 24.5, { align: "center" });

    // Divisor vertical
    doc.setDrawColor(...line);
    doc.setLineWidth(0.25);
    doc.line(margin + sigColW, sigY + 4, margin + sigColW, sigY + sigBlockH - 4);

    // Coluna direita: gestor/aprovação
    const apvX = margin + sigColW;
    const apvW = contentW - sigColW;
    const apvCenter = apvX + apvW / 2;
    doc.line(apvX + 12, sigY + 17, apvX + apvW - 12, sigY + 17);
    doc.setTextColor(...brand);
    doc.setFont("helvetica", "bold").setFontSize(7.5);
    doc.text("APROVAÇÃO / GESTOR", apvCenter, sigY + 21, { align: "center" });
    doc.setFont("helvetica", "normal").setFontSize(6.5);
    doc.setTextColor(...muted);
    doc.text("Assinatura e data", apvCenter, sigY + 24.5, { align: "center" });

    // Rodapé inferior — paginação
    doc.setTextColor(...muted);
    doc.setFont("helvetica", "normal").setFontSize(6.5);
    doc.text(
      `Página ${idx + 1} de ${total} · ${pagina.empresaNome.toUpperCase()}`,
      margin,
      pageH - 4,
    );
    doc.text("Documento interno · não homologado", margin + contentW, pageH - 4, { align: "right" });
    return rowsToDraw;
  };

  const paginas = p.paginas.length > 0 ? p.paginas : [{ empresaNome: "—", funcionarios: [] }];
    // Capacidade real da folha com este layout: 16 linhas. A divisão precisa
  // ser menor ou igual ao que o desenho comporta para nenhuma linha sumir.
  // Layout compacto: cabe até ~26 linhas com folga para observação e rodapé.
  const ROWS_PER_PAGE = 24;
  // Pré-divide cada empresa em sub-páginas
  type SubPagina = { pag: HoraExtraPaginaEmpresa; parte: number; partes: number };
  const subs: SubPagina[] = [];
  paginas.forEach((pag) => {
    const total = pag.funcionarios.length;
    if (total === 0) {
      subs.push({ pag, parte: 1, partes: 1 });
      return;
    }
    const partes = Math.max(1, Math.ceil(total / ROWS_PER_PAGE));
    for (let i = 0; i < partes; i++) {
      const slice = pag.funcionarios.slice(i * ROWS_PER_PAGE, (i + 1) * ROWS_PER_PAGE);
      subs.push({
        pag: {
          empresaNome: pag.empresaNome,
          funcionarios: slice,
          totalFuncionarios: total,
          linhaInicial: i * ROWS_PER_PAGE + 1,
        },
        parte: i + 1,
        partes,
      });
    }
  });
  subs.forEach((s, i) => {
    if (i > 0) doc.addPage();
    drawPagina(s.pag, i, subs.length, { atual: s.parte, total: s.partes });
  });

  return doc;
}
