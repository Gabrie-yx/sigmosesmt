import { EMPRESA_INFO } from "./empresa-info";

export type GuiaCtx = {
  numero: string;
  data: Date;
  solicitante: string;
  setor: string;
  emp: {
    nome: string;
    cpf?: string | null;
    rg?: string | null;
    matricula?: string | null;
    data_nascimento?: string | null;
    sexo?: string | null;
    cargo?: string | null;
    setor?: string | null;
    admissao?: string | null;
    foto_url?: string | null;
    assinatura_url?: string | null;
  };
  prestador: {
    razao_social: string;
    nome_fantasia?: string | null;
    cnpj?: string | null;
    cep?: string | null;
    logradouro?: string | null;
    numero?: string | null;
    complemento?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    uf?: string | null;
    telefone?: string | null;
    horario_atendimento?: string | null;
  };
  exames: string[];
  natureza: "ADMISSIONAL" | "PERIODICO" | "RETORNO" | "MUDANCA" | "DEMISSIONAL";
  riscos?: string[];
  observacoes?: string;
};

function fmtBR(d?: string | Date | null) {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d.slice(0, 10) + "T00:00:00") : d;
  return dt.toLocaleDateString("pt-BR");
}

function fullAddress(p: GuiaCtx["prestador"]) {
  const linha1 = [p.logradouro, p.numero, p.complemento].filter(Boolean).join(", ");
  const linha2 = [p.bairro, [p.cidade, p.uf].filter(Boolean).join("/"), p.cep].filter(Boolean).join(" — ");
  return [linha1, linha2].filter(Boolean).join(" · ");
}

export async function gerarGuiaEncaminhamentoPDF(ctx: GuiaCtx): Promise<Blob> {
  const [{ default: JsPDF }, { drawPdfHeader }, QR] = await Promise.all([
    import("jspdf"),
    import("@/lib/pdf-header"),
    import("qrcode"),
  ]);

  const doc = new JsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 14;
  const maxW = W - M * 2;

  let y = drawPdfHeader(doc, {
    titulo: "Guia de Encaminhamento — Exame Médico Ocupacional",
    subtitulo: "SESMT · NR-7 / PCMSO · ISO 45001",
    responsavel: ctx.solicitante || "SESMT — DMN",
  });
  y += 2;

  // Linha topo: nº guia + data
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(0, 0, 0);
  doc.text(`GUIA Nº ${ctx.numero}`, M, y);
  doc.setFont("helvetica", "normal");
  doc.text(`Manaus/AM, ${fmtBR(ctx.data)}`, W - M, y, { align: "right" });
  y += 6;

  // ====================== Bloco PRESTADOR (destacado) ======================
  const pH = 36;
  doc.setDrawColor(15, 23, 42);
  doc.setFillColor(15, 23, 42);
  doc.setLineWidth(0.3);
  doc.roundedRect(M, y, maxW, 7, 1.5, 1.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("PRESTADOR DE SAÚDE — DESTINO DO EXAME", M + 3, y + 4.8);
  y += 7;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(15, 23, 42);
  doc.roundedRect(M, y, maxW, pH, 1.5, 1.5, "FD");

  // QR code com Google Maps do endereço
  try {
    const enderecoCompleto = `${ctx.prestador.razao_social} ${fullAddress(ctx.prestador)}`;
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoCompleto)}`;
    const dataUrl = await QR.toDataURL(mapsUrl, { margin: 0, width: 256 });
    doc.addImage(dataUrl, "PNG", M + maxW - 30, y + 3, 26, 26, undefined, "FAST");
    doc.setFontSize(6.5);
    doc.setTextColor(60, 60, 60);
    doc.text("escaneie p/ rota", M + maxW - 17, y + 32, { align: "center" });
  } catch {}

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(ctx.prestador.razao_social, M + 4, y + 6);
  if (ctx.prestador.nome_fantasia && ctx.prestador.nome_fantasia !== ctx.prestador.razao_social) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(60, 60, 60);
    doc.text(`(${ctx.prestador.nome_fantasia})`, M + 4, y + 10.5);
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  let py = y + 15;
  if (ctx.prestador.cnpj) { doc.text(`CNPJ: ${ctx.prestador.cnpj}`, M + 4, py); py += 4.5; }
  const end = fullAddress(ctx.prestador);
  if (end) {
    const lines = doc.splitTextToSize(`Endereço: ${end}`, maxW - 38);
    doc.text(lines, M + 4, py);
    py += lines.length * 4.2;
  }
  if (ctx.prestador.telefone) { doc.text(`Telefone: ${ctx.prestador.telefone}`, M + 4, py); py += 4.5; }
  if (ctx.prestador.horario_atendimento) { doc.text(`Horário: ${ctx.prestador.horario_atendimento}`, M + 4, py); py += 4.5; }
  y += pH + 5;

  // ====================== Bloco PACIENTE ======================
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(M, y, maxW, 7, 1.5, 1.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("DADOS DO COLABORADOR", M + 3, y + 4.8);
  y += 7;

  const eH = 30;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(15, 23, 42);
  doc.roundedRect(M, y, maxW, eH, 1.5, 1.5, "FD");
  doc.setTextColor(0, 0, 0);
  const col1 = M + 4;
  const col2 = M + maxW / 2 + 2;
  const kv = (k: string, v: string | null | undefined, x: number, yy: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(k, x, yy);
    doc.setFont("helvetica", "normal");
    doc.text(v ?? "—", x + doc.getTextWidth(k) + 1.5, yy);
  };
  kv("Nome:", ctx.emp.nome, col1, y + 6);
  kv("CPF:", ctx.emp.cpf ?? null, col1, y + 12);
  kv("Matrícula:", ctx.emp.matricula ?? null, col1, y + 18);
  kv("Cargo:", ctx.emp.cargo ?? null, col1, y + 24);
  kv("Nasc.:", ctx.emp.data_nascimento ? fmtBR(ctx.emp.data_nascimento) : null, col2, y + 6);
  kv("Sexo:", ctx.emp.sexo ?? null, col2, y + 12);
  kv("Setor:", ctx.emp.setor ?? null, col2, y + 18);
  kv("Admissão:", ctx.emp.admissao ? fmtBR(ctx.emp.admissao) : null, col2, y + 24);
  y += eH + 5;

  // ====================== Natureza + exames solicitados ======================
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(M, y, maxW, 7, 1.5, 1.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`EXAMES SOLICITADOS — NATUREZA: ${ctx.natureza}`, M + 3, y + 4.8);
  y += 9;

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  if (ctx.exames.length === 0) {
    doc.text("— ASO conforme PCMSO vigente —", M + 2, y);
    y += 6;
  } else {
    ctx.exames.forEach((ex, i) => {
      doc.setDrawColor(0, 0, 0);
      doc.rect(M + 2, y - 3.5, 3.5, 3.5);
      doc.text(`${i + 1}. ${ex}`, M + 8, y);
      y += 5.5;
    });
  }
  y += 2;

  if (ctx.riscos && ctx.riscos.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Riscos ocupacionais (PGR):", M, y);
    y += 4.5;
    doc.setFont("helvetica", "normal");
    const txt = ctx.riscos.join(" · ");
    const lines = doc.splitTextToSize(txt, maxW);
    doc.text(lines, M, y);
    y += lines.length * 4.2 + 2;
  }

  if (ctx.observacoes) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Observações:", M, y);
    y += 4.5;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(ctx.observacoes, maxW);
    doc.text(lines, M, y);
    y += lines.length * 4.2 + 2;
  }

  // ====================== Assinaturas ======================
  y = Math.max(y + 12, 235);
  const colW = (maxW - 10) / 2;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.line(M, y, M + colW, y);
  doc.line(M + colW + 10, y, M + colW * 2 + 10, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(ctx.solicitante || "SESMT — DMN", M + colW / 2, y + 5, { align: "center" });
  doc.text("Médico Examinador (CRM)", M + colW + 10 + colW / 2, y + 5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  doc.text(ctx.setor || "Segurança e Saúde no Trabalho", M + colW / 2, y + 9, { align: "center" });
  doc.text("Carimbo e assinatura do prestador", M + colW + 10 + colW / 2, y + 9, { align: "center" });

  // Rodapé
  doc.setFontSize(7.5);
  doc.setTextColor(60, 60, 60);
  doc.text(
    `${EMPRESA_INFO.razao_social} · CNPJ ${EMPRESA_INFO.cnpj} · ${EMPRESA_INFO.endereco} · ${EMPRESA_INFO.cidade_uf_cep}`,
    W / 2, 287, { align: "center" },
  );
  doc.text(
    `SIGMO — Guia ${ctx.numero} emitida em ${fmtBR(ctx.data)} · PROCO-SGI-SST-01 (NR-7)`,
    W / 2, 290.5, { align: "center" },
  );

  return doc.output("blob");
}