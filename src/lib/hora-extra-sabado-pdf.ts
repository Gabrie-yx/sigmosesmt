import jsPDF from "jspdf";

export type HoraExtraFuncionario = {
  nome: string;
  transporte: boolean;
  alimentacao: boolean;
  presenca?: string | null;
};

export type HoraExtraPaginaEmpresa = {
  empresaNome: string;
  funcionarios: HoraExtraFuncionario[];
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

  // Paleta
  const brand: [number, number, number] = [15, 23, 42];      // slate-900
  const accent: [number, number, number] = [190, 18, 60];    // rose-700
  const muted: [number, number, number] = [100, 116, 139];   // slate-500
  const soft: [number, number, number] = [241, 245, 249];    // slate-100
  const line: [number, number, number] = [203, 213, 225];    // slate-300
  const zebra: [number, number, number] = [248, 250, 252];   // slate-50

  const drawPagina = (pagina: HoraExtraPaginaEmpresa, idx: number, total: number) => {
    // ===== HEADER =====
    // Faixa de marca no topo
    doc.setFillColor(...brand);
    doc.rect(margin, margin, contentW, 22, "F");
    // Faixa de acento (rosé) abaixo
    doc.setFillColor(...accent);
    doc.rect(margin, margin + 22, contentW, 2, "F");

    // Logo (fundo branco arredondado visual)
    if (p.logoDataUrl) {
      try {
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(margin + 3, margin + 3, 34, 16, 1.5, 1.5, "F");
        doc.addImage(p.logoDataUrl, "PNG", margin + 5, margin + 4.5, 30, 13, undefined, "FAST");
      } catch {}
    }

    // Título
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold").setFontSize(15);
    doc.text("FORMULÁRIO DE HORA EXTRA", margin + 42, margin + 10);
    doc.setFont("helvetica", "normal").setFontSize(8);
    doc.setTextColor(203, 213, 225);
    doc.text("Controle interno · não homologado", margin + 42, margin + 15);

    // Pílula da empresa (direita)
    const pillW = 70;
    const pillX = margin + contentW - pillW - 4;
    doc.setFillColor(...accent);
    doc.roundedRect(pillX, margin + 5, pillW, 12, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold").setFontSize(8);
    doc.text("EMPRESA", pillX + 4, margin + 9);
    doc.setFontSize(9);
    const empName = pagina.empresaNome.toUpperCase();
    const empTrim = empName.length > 28 ? empName.slice(0, 27) + "…" : empName;
    doc.text(empTrim, pillX + 4, margin + 14);
    doc.setFont("helvetica", "normal").setFontSize(7);
    doc.text(`${idx + 1}/${total}`, pillX + pillW - 4, margin + 14, { align: "right" });

    let y = margin + 28;

    // ===== INFO CARDS (4 mini-cards horizontais) =====
    const cardH = 14;
    const cardGap = 2;
    const cardW = (contentW - cardGap * 3) / 4;
    const cards = [
      { label: "DATA", value: p.data, sub: p.diaSemana.toUpperCase() },
      { label: "TURNO", value: p.turno ?? "—", sub: p.horario ?? "" },
      { label: "SETOR", value: p.setor ?? "—", sub: p.centroCusto ? `C.C. ${p.centroCusto}` : "" },
      { label: "REGIME", value: p.tipoEfetivo, sub: p.tipoEfetivo === "DMN" ? "EFETIVO" : p.tipoEfetivo === "MEI" ? "MEI" : "TERCEIRIZADO" },
    ];
    cards.forEach((c, i) => {
      const cx = margin + i * (cardW + cardGap);
      doc.setFillColor(...soft);
      doc.roundedRect(cx, y, cardW, cardH, 1.5, 1.5, "F");
      doc.setDrawColor(...line);
      doc.setLineWidth(0.2);
      doc.roundedRect(cx, y, cardW, cardH, 1.5, 1.5, "S");
      // Barra lateral de acento
      doc.setFillColor(...accent);
      doc.rect(cx, y, 1.2, cardH, "F");
      doc.setTextColor(...muted);
      doc.setFont("helvetica", "bold").setFontSize(6.5);
      doc.text(c.label, cx + 3, y + 4);
      doc.setTextColor(...brand);
      doc.setFont("helvetica", "bold").setFontSize(10);
      const val = c.value.length > 18 ? c.value.slice(0, 17) + "…" : c.value;
      doc.text(val, cx + 3, y + 9);
      if (c.sub) {
        doc.setTextColor(...muted);
        doc.setFont("helvetica", "normal").setFontSize(6.5);
        doc.text(c.sub, cx + 3, y + 12.5);
      }
    });
    y += cardH + 3;

    // ===== Faixa "EMPRESAS ENVOLVIDAS" =====
    const envH = 8;
    doc.setFillColor(...brand);
    doc.roundedRect(margin, y, contentW, envH, 1, 1, "F");
    doc.setTextColor(...accent);
    doc.setFont("helvetica", "bold").setFontSize(7);
    doc.text("EMPRESAS ENVOLVIDAS", margin + 3, y + 5);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "normal").setFontSize(8);
    const envText = p.empresasEnvolvidas.join("  •  ");
    const envClipped = doc.splitTextToSize(envText, contentW - 50)[0] ?? envText;
    doc.text(envClipped, margin + 48, y + 5);
    y += envH + 4;

    // ===== Title da equipe =====
    doc.setTextColor(...brand);
    doc.setFont("helvetica", "bold").setFontSize(11);
    doc.text(`EQUIPE · ${pagina.empresaNome.toUpperCase()}`, margin, y + 3);
    doc.setDrawColor(...accent);
    doc.setLineWidth(0.6);
    const titleW = doc.getTextWidth(`EQUIPE · ${pagina.empresaNome.toUpperCase()}`);
    doc.line(margin, y + 5, margin + titleW, y + 5);
    doc.setTextColor(...muted);
    doc.setFont("helvetica", "normal").setFontSize(8);
    doc.text(`${pagina.funcionarios.length} colaborador(es)`, margin + contentW, y + 3, { align: "right" });
    y += 8;

    // ===== TABELA =====
    const headRowH = 9;
    const colIt = 9;
    const colNome = 72;
    const colTrans = 22;
    const colAlim = 22;
    const colPres = 20;
    const colAss = contentW - colIt - colNome - colTrans - colAlim - colPres;

    // Cabeçalho
    doc.setFillColor(...brand);
    doc.roundedRect(margin, y, contentW, headRowH, 1, 1, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold").setFontSize(7.5);
    doc.text("#", margin + colIt / 2, y + 5.8, { align: "center" });
    doc.text("NOME COMPLETO", margin + colIt + 2, y + 5.8);
    doc.text("TRANSP.", margin + colIt + colNome + colTrans / 2, y + 5.8, { align: "center" });
    doc.text("ALIM.", margin + colIt + colNome + colTrans + colAlim / 2, y + 5.8, { align: "center" });
    doc.text("PRES.", margin + colIt + colNome + colTrans + colAlim + colPres / 2, y + 5.8, { align: "center" });
    doc.text("ASSINATURA", margin + colIt + colNome + colTrans + colAlim + colPres + colAss / 2, y + 5.8, { align: "center" });
    y += headRowH;

    // Linhas
    const rowH = 9;
    const sigReserve = 42;
    const maxRows = Math.floor((pageH - margin - sigReserve - y) / rowH);
    const rowsToDraw = Math.max(pagina.funcionarios.length, Math.min(15, maxRows));

    for (let i = 0; i < rowsToDraw; i++) {
      if (y + rowH > pageH - margin - sigReserve) break;
      const f = pagina.funcionarios[i];

      // Zebra
      if (i % 2 === 1) {
        doc.setFillColor(...zebra);
        doc.rect(margin, y, contentW, rowH, "F");
      }
      // Linha inferior fina
      doc.setDrawColor(...line);
      doc.setLineWidth(0.15);
      doc.line(margin, y + rowH, margin + contentW, y + rowH);

      if (f) {
        // #
        doc.setTextColor(...muted);
        doc.setFont("helvetica", "bold").setFontSize(8);
        doc.text(String(i + 1).padStart(2, "0"), margin + colIt / 2, y + 5.8, { align: "center" });

        // Nome
        doc.setTextColor(...brand);
        doc.setFont("helvetica", "bold").setFontSize(8.5);
        const nome = f.nome.length > 42 ? f.nome.substring(0, 40) + "…" : f.nome;
        doc.text(nome.toUpperCase(), margin + colIt + 3, y + 5.8);

        // Badge helper
        const drawBadge = (
          on: boolean,
          xCenter: number,
        ) => {
          const bw = 7;
          const bh = 4.5;
          const bx = xCenter - bw / 2;
          const by = y + rowH / 2 - bh / 2;
          if (on) {
            doc.setFillColor(...accent);
            doc.roundedRect(bx, by, bw, bh, 1, 1, "F");
            doc.setTextColor(255, 255, 255);
            doc.setFont("helvetica", "bold").setFontSize(6.5);
            doc.text("SIM", xCenter, by + 3.2, { align: "center" });
          } else {
            doc.setDrawColor(...line);
            doc.setLineWidth(0.3);
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
          doc.setFont("helvetica", "bold").setFontSize(9);
          doc.text(f.presenca.toUpperCase(), margin + colIt + colNome + colTrans + colAlim + colPres / 2, y + 5.8, { align: "center" });
        } else {
          doc.setTextColor(...line);
          doc.setFont("helvetica", "normal").setFontSize(9);
          doc.text("·", margin + colIt + colNome + colTrans + colAlim + colPres / 2, y + 5.8, { align: "center" });
        }

        // Linha de assinatura
        doc.setDrawColor(...line);
        doc.setLineWidth(0.3);
        const sx1 = margin + colIt + colNome + colTrans + colAlim + colPres + 3;
        const sx2 = margin + contentW - 3;
        doc.line(sx1, y + rowH - 2, sx2, y + rowH - 2);
      }
      y += rowH;
    }

    // ===== OBSERVAÇÃO =====
    if (p.observacao && y + 18 < pageH - margin - sigReserve) {
      y += 4;
      doc.setFillColor(...soft);
      const obsLines = doc.splitTextToSize(p.observacao, contentW - 10);
      const obsH = Math.min(18, 6 + obsLines.length * 3.6);
      doc.roundedRect(margin, y, contentW, obsH, 1.5, 1.5, "F");
      doc.setFillColor(...accent);
      doc.rect(margin, y, 1.2, obsH, "F");
      doc.setTextColor(...accent);
      doc.setFont("helvetica", "bold").setFontSize(7);
      doc.text("OBSERVAÇÃO", margin + 3, y + 4);
      doc.setTextColor(...brand);
      doc.setFont("helvetica", "normal").setFontSize(8);
      doc.text(obsLines.slice(0, 3), margin + 3, y + 8);
      y += obsH;
    }

    // ===== RODAPÉ COM ASSINATURA =====
    const sigBlockH = 36;
    const sigY = pageH - margin - sigBlockH;
    doc.setFillColor(...soft);
    doc.roundedRect(margin, sigY, contentW, sigBlockH, 2, 2, "F");
    doc.setFillColor(...brand);
    doc.rect(margin, sigY, contentW, 1.5, "F");

    // Coluna esquerda: assinatura
    const sigColW = contentW * 0.55;
    const sigCenterX = margin + sigColW / 2;
    if (p.assinaturaDataUrl) {
      try {
        const h = Math.min(p.assinaturaHeight ?? 16, 18);
        const w = h * 2.5;
        doc.addImage(p.assinaturaDataUrl, "PNG", sigCenterX - w / 2, sigY + 5, w, h, undefined, "FAST");
      } catch {}
    }
    doc.setDrawColor(...brand);
    doc.setLineWidth(0.5);
    doc.line(margin + 12, sigY + 25, margin + sigColW - 12, sigY + 25);
    doc.setTextColor(...brand);
    doc.setFont("helvetica", "bold").setFontSize(8);
    doc.text(
      `SOLICITANTE${p.solicitanteNome ? " · " + p.solicitanteNome.toUpperCase() : ""}`,
      sigCenterX,
      sigY + 29,
      { align: "center" },
    );
    doc.setFont("helvetica", "normal").setFontSize(7);
    doc.setTextColor(...muted);
    doc.text(`Emitido em ${p.data}`, sigCenterX, sigY + 33, { align: "center" });

    // Divisor vertical
    doc.setDrawColor(...line);
    doc.setLineWidth(0.3);
    doc.line(margin + sigColW, sigY + 4, margin + sigColW, sigY + sigBlockH - 4);

    // Coluna direita: gestor/aprovação
    const apvX = margin + sigColW;
    const apvW = contentW - sigColW;
    const apvCenter = apvX + apvW / 2;
    doc.line(apvX + 12, sigY + 25, apvX + apvW - 12, sigY + 25);
    doc.setTextColor(...brand);
    doc.setFont("helvetica", "bold").setFontSize(8);
    doc.text("APROVAÇÃO / GESTOR", apvCenter, sigY + 29, { align: "center" });
    doc.setFont("helvetica", "normal").setFontSize(7);
    doc.setTextColor(...muted);
    doc.text("Assinatura e data", apvCenter, sigY + 33, { align: "center" });

    // Rodapé inferior — paginação
    doc.setTextColor(...muted);
    doc.setFont("helvetica", "normal").setFontSize(6.5);
    doc.text(
      `Página ${idx + 1} de ${total} · ${pagina.empresaNome.toUpperCase()}`,
      margin,
      pageH - 4,
    );
    doc.text("Documento interno · não homologado", margin + contentW, pageH - 4, { align: "right" });
  };

  const paginas = p.paginas.length > 0 ? p.paginas : [{ empresaNome: "—", funcionarios: [] }];
  paginas.forEach((pag, i) => {
    if (i > 0) doc.addPage();
    drawPagina(pag, i, paginas.length);
  });

  return doc;
}
