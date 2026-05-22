import { jsPDF } from "jspdf";

const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
const pageW = doc.internal.pageSize.getWidth();
const pageH = doc.internal.pageSize.getHeight();
const margin = 10;
const contentW = pageW - margin * 2;

const brand = [51, 65, 85];
const accent = [59, 130, 246];
const muted = [148, 163, 184];
const soft = [248, 250, 252];
const line = [226, 232, 240];

const pagina = {
  empresaNome: "DMN MINERAÇÃO",
  funcionarios: [
    { nome: "JOÃO DA SILVA SANTOS", transporte: true, alimentacao: false, presenca: "P" },
    { nome: "MARIA FERNANDA OLIVEIRA", transporte: false, alimentacao: true, presenca: "P" },
    { nome: "CARLOS EDUARDO LIMA", transporte: true, alimentacao: true, presenca: "F" },
    { nome: "ANA PAULA RIBEIRO", transporte: false, alimentacao: false, presenca: "P" },
    { nome: "PEDRO HENRIQUE COSTA", transporte: true, alimentacao: false, presenca: null },
  ]
};
const p = {
  data: "22/05/2026",
  diaSemana: "Sábado",
  turno: "1º TURNO",
  horario: "07:00 – 12:00",
  setor: "MINA",
  centroCusto: "1200",
  tipoEfetivo: "DMN",
  observacao: "Trabalho de manutenção preventiva no sistema de britagem.",
  empresasEnvolvidas: ["DMN MINERAÇÃO", "TERCEIRA ENGENHARIA LTDA"],
  logoDataUrl: null,
  assinaturaDataUrl: null,
  solicitanteNome: "Roberto Silva"
};

// Header clean
const idx = 0, total = 1;
doc.setFillColor(255, 255, 255);
doc.roundedRect(margin, margin, contentW, 24, 2, 2, "F");
doc.setDrawColor(...line);
doc.setLineWidth(0.3);
doc.roundedRect(margin, margin, contentW, 24, 2, 2, "S");
doc.setFillColor(...accent);
doc.rect(margin + 2, margin, contentW - 4, 1.5, "F");

doc.setTextColor(...brand);
doc.setFont("helvetica", "bold").setFontSize(14);
doc.text("FORMULÁRIO DE HORA EXTRA", margin + 42, margin + 11);
doc.setFont("helvetica", "normal").setFontSize(7.5);
doc.setTextColor(...muted);
doc.text("Controle interno · não homologado", margin + 42, margin + 16.5);

const pillW = 70;
const pillX = margin + contentW - pillW - 4;
doc.setDrawColor(...accent);
doc.setLineWidth(0.5);
doc.roundedRect(pillX, margin + 5, pillW, 14, 2, 2, "S");
doc.setTextColor(...accent);
doc.setFont("helvetica", "bold").setFontSize(7);
doc.text("EMPRESA", pillX + 4, margin + 10);
doc.setTextColor(...brand);
doc.setFontSize(9);
doc.text(pagina.empresaNome, pillX + 4, margin + 16);
doc.setFont("helvetica", "normal").setFontSize(7);
doc.setTextColor(...muted);
doc.text(`${idx + 1}/${total}`, pillX + pillW - 4, margin + 16, { align: "right" });

let y = margin + 28;

// Cards
const cardH = 14, cardGap = 2.5;
const cardW = (contentW - cardGap * 3) / 4;
const cards = [
  { label: "DATA", value: p.data, sub: p.diaSemana.toUpperCase() },
  { label: "TURNO", value: p.turno, sub: p.horario },
  { label: "SETOR", value: p.setor, sub: p.centroCusto ? `C.C. ${p.centroCusto}` : "" },
  { label: "REGIME", value: p.tipoEfetivo, sub: "EFETIVO" },
];
cards.forEach((c, i) => {
  const cx = margin + i * (cardW + cardGap);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(cx, y, cardW, cardH, 2, 2, "F");
  doc.setDrawColor(...line);
  doc.setLineWidth(0.25);
  doc.roundedRect(cx, y, cardW, cardH, 2, 2, "S");
  doc.setFillColor(...accent);
  doc.rect(cx, y, 1.5, cardH, "F");
  doc.setTextColor(...muted);
  doc.setFont("helvetica", "bold").setFontSize(6.5);
  doc.text(c.label, cx + 4, y + 4.5);
  doc.setTextColor(...brand);
  doc.setFont("helvetica", "bold").setFontSize(10);
  doc.text(c.value, cx + 4, y + 9.5);
  if (c.sub) {
    doc.setTextColor(...muted);
    doc.setFont("helvetica", "normal").setFontSize(6.5);
    doc.text(c.sub, cx + 4, y + 13);
  }
});
y += cardH + 4;

// Faixa empresas
const envH = 8;
doc.setFillColor(255, 255, 255);
doc.roundedRect(margin, y, contentW, envH, 2, 2, "F");
doc.setDrawColor(...accent);
doc.setLineWidth(0.4);
doc.roundedRect(margin, y, contentW, envH, 2, 2, "S");
doc.setTextColor(...accent);
doc.setFont("helvetica", "bold").setFontSize(7);
doc.text("EMPRESAS ENVOLVIDAS", margin + 4, y + 5.2);
doc.setTextColor(...brand);
doc.setFont("helvetica", "normal").setFontSize(8);
doc.text(p.empresasEnvolvidas.join("  •  "), margin + 52, y + 5.2);
y += envH + 5;

// Título equipe
doc.setTextColor(...brand);
doc.setFont("helvetica", "bold").setFontSize(11);
doc.text(`EQUIPE · ${pagina.empresaNome.toUpperCase()}`, margin, y + 3);
doc.setDrawColor(...accent);
doc.setLineWidth(0.5);
const titleW = doc.getTextWidth(`EQUIPE · ${pagina.empresaNome.toUpperCase()}`);
doc.line(margin, y + 5.5, margin + titleW, y + 5.5);
doc.setTextColor(...muted);
doc.setFont("helvetica", "normal").setFontSize(8);
doc.text(`${pagina.funcionarios.length} colaborador(es)`, margin + contentW, y + 3, { align: "right" });
y += 8.5;

// Tabela
const headRowH = 9;
const colIt = 9, colNome = 72, colTrans = 22, colAlim = 22, colPres = 20;
const colAss = contentW - colIt - colNome - colTrans - colAlim - colPres;

doc.setFillColor(239, 246, 255);
doc.roundedRect(margin, y, contentW, headRowH, 1.5, 1.5, "F");
doc.setDrawColor(...accent);
doc.setLineWidth(0.4);
doc.roundedRect(margin, y, contentW, headRowH, 1.5, 1.5, "S");
doc.setTextColor(...brand);
doc.setFont("helvetica", "bold").setFontSize(7.5);
doc.text("#", margin + colIt / 2, y + 5.8, { align: "center" });
doc.text("NOME COMPLETO", margin + colIt + 2, y + 5.8);
doc.text("TRANSP.", margin + colIt + colNome + colTrans / 2, y + 5.8, { align: "center" });
doc.text("ALIM.", margin + colIt + colNome + colTrans + colAlim / 2, y + 5.8, { align: "center" });
doc.text("PRES.", margin + colIt + colNome + colTrans + colAlim + colPres / 2, y + 5.8, { align: "center" });
doc.text("ASSINATURA", margin + colIt + colNome + colTrans + colAlim + colPres + colAss / 2, y + 5.8, { align: "center" });
y += headRowH;

const rowH = 9;
pagina.funcionarios.forEach((f, i) => {
  if (i % 2 === 0) {
    doc.setFillColor(...soft);
    doc.rect(margin, y, contentW, rowH, "F");
  }
  doc.setDrawColor(...line);
  doc.setLineWidth(0.12);
  doc.line(margin, y + rowH, margin + contentW, y + rowH);

  doc.setTextColor(...muted);
  doc.setFont("helvetica", "bold").setFontSize(8);
  doc.text(String(i + 1).padStart(2, "0"), margin + colIt / 2, y + 5.8, { align: "center" });

  doc.setTextColor(...brand);
  doc.setFont("helvetica", "bold").setFontSize(8.5);
  doc.text(f.nome, margin + colIt + 3, y + 5.8);

  const drawBadge = (on, xCenter) => {
    const bw = 7, bh = 4.5;
    const bx = xCenter - bw / 2, by = y + rowH / 2 - bh / 2;
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

  doc.setDrawColor(...line);
  doc.setLineWidth(0.25);
  const sx1 = margin + colIt + colNome + colTrans + colAlim + colPres + 3;
  const sx2 = margin + contentW - 3;
  doc.line(sx1, y + rowH - 2, sx2, y + rowH - 2);

  y += rowH;
});

// Observação
y += 4;
doc.setFillColor(255, 255, 255);
const obsLines = doc.splitTextToSize(p.observacao, contentW - 10);
const obsH = Math.min(18, 6 + obsLines.length * 3.6);
doc.roundedRect(margin, y, contentW, obsH, 2, 2, "F");
doc.setDrawColor(...line);
doc.setLineWidth(0.25);
doc.roundedRect(margin, y, contentW, obsH, 2, 2, "S");
doc.setFillColor(...accent);
doc.rect(margin, y, 1.5, obsH, "F");
doc.setTextColor(...accent);
doc.setFont("helvetica", "bold").setFontSize(7);
doc.text("OBSERVAÇÃO", margin + 4, y + 4.5);
doc.setTextColor(...brand);
doc.setFont("helvetica", "normal").setFontSize(8);
doc.text(obsLines.slice(0, 3), margin + 4, y + 8.5);
y += obsH;

// Assinatura
const sigBlockH = 36;
const sigY = pageH - margin - sigBlockH;
doc.setFillColor(255, 255, 255);
doc.roundedRect(margin, sigY, contentW, sigBlockH, 2, 2, "F");
doc.setDrawColor(...line);
doc.setLineWidth(0.25);
doc.roundedRect(margin, sigY, contentW, sigBlockH, 2, 2, "S");
doc.setFillColor(...accent);
doc.rect(margin + 2, sigY, contentW - 4, 1.2, "F");

const sigColW = contentW * 0.55;
const sigCenterX = margin + sigColW / 2;
doc.setDrawColor(...brand);
doc.setLineWidth(0.4);
doc.line(margin + 12, sigY + 25, margin + sigColW - 12, sigY + 25);
doc.setTextColor(...brand);
doc.setFont("helvetica", "bold").setFontSize(8);
doc.text(`SOLICITANTE · ${p.solicitanteNome.toUpperCase()}`, sigCenterX, sigY + 29, { align: "center" });
doc.setFont("helvetica", "normal").setFontSize(7);
doc.setTextColor(...muted);
doc.text(`Emitido em ${p.data}`, sigCenterX, sigY + 33, { align: "center" });

doc.setDrawColor(...line);
doc.setLineWidth(0.25);
doc.line(margin + sigColW, sigY + 4, margin + sigColW, sigY + sigBlockH - 4);

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

// Rodapé
const footerY = pageH - 6;
doc.setTextColor(...muted);
doc.setFont("helvetica", "normal").setFontSize(6.5);
doc.text(`Página ${idx + 1} de ${total} · ${pagina.empresaNome.toUpperCase()}`, margin, footerY);
doc.text("Documento interno · não homologado", margin + contentW, footerY, { align: "right" });

doc.save("/mnt/documents/teste-pdf-leve.pdf");
console.log("PDF salvo em /mnt/documents/teste-pdf-leve.pdf");
