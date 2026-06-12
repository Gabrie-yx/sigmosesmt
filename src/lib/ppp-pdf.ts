import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import dmnLogo from "@/assets/dmn-logo.png";

// Vinho DMN — coerente com a Ficha
const WINE: [number, number, number] = [123, 30, 43];
const WINE_DARK: [number, number, number] = [90, 20, 32];

type Any = Record<string, any>;

export type PPPData = {
  emp: Any;
  company: Any | null;
  roleName?: string | null;
  photoDataUrl?: string | null;
  riscos: Array<{
    nome: string;
    categoria: string | null;
    codigo_esocial: string | null;
    intensidade: number | null;
    unidade: string | null;
    limite_tolerancia: number | null;
    tecnica_medicao: string | null;
    fonte_geradora: string | null;
    epi_atenuacao_db: number | null;
    aposentadoria_especial_anos: number | null;
    periculosidade: boolean;
    insalubridade_grau: string | null;
    data_avaliacao: string | null;
    observacao: string | null;
  }>;
  exams: Any[];
  epis: Array<{ item: string; ca: string | null; data_entrega: string }>;
  responsavelTecnico?: { nome?: string | null; cargo?: string | null; registro?: string | null } | null;
};

function fmtBR(d?: string | null) {
  if (!d) return "—";
  const iso = String(d).split("T")[0];
  const [y, m, day] = iso.split("-");
  return y && m && day ? `${day}/${m}/${y}` : String(d);
}

export function gerarPPPPdf(d: PPPData): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210;
  const pageH = 297;
  const margin = 12;
  const contentW = pageW - margin * 2;
  const hoje = new Date().toLocaleDateString("pt-BR");
  const emp = d.emp ?? {};
  const co = d.company ?? {};

  // ===== Header =====
  let y = margin;
  const headerH = 18;
  doc.setFillColor(...WINE);
  doc.rect(margin, y, contentW, headerH, "F");
  doc.setFillColor(...WINE_DARK);
  doc.rect(margin, y + headerH - 1, contentW, 1, "F");
  const logoBoxW = 32;
  doc.setFillColor(255, 255, 255);
  doc.rect(margin, y, logoBoxW, headerH, "F");
  try { doc.addImage(dmnLogo as any, "PNG", margin + 2, y + 2, logoBoxW - 4, headerH - 4); } catch { /* noop */ }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text("PERFIL PROFISSIOGRÁFICO PREVIDENCIÁRIO — PPP", margin + logoBoxW + (contentW - logoBoxW) / 2, y + 7, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("Anexo XV — IN PRES/INSS nº 128/2022", margin + logoBoxW + (contentW - logoBoxW) / 2, y + 12, { align: "center" });
  doc.setFontSize(7);
  doc.text(`Emitido em ${hoje}`, pageW - margin - 2, y + 5, { align: "right" });
  doc.setTextColor(0);
  y += headerH + 3;

  // ===== 1. Dados da Empresa =====
  sectionTitle(doc, "1. DADOS ADMINISTRATIVOS DA EMPRESA", margin, y, contentW);
  y += 5;
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "grid",
    tableWidth: contentW,
    body: [
      ["CNPJ", co.cnpj ?? "—", "CNAE", co.cnae ?? "—"],
      ["Razão Social", co.name ?? "—", "Grau de Risco", co.grau_risco ?? "—"],
      ["Endereço", co.endereco ?? "—", "Município / UF", `${co.cidade ?? "—"} ${co.uf ? "/ " + co.uf : ""}`],
    ],
    styles: stylesBase(),
    columnStyles: pairCols(contentW),
  });
  y = (doc as any).lastAutoTable.finalY + 3;

  // ===== 2. Dados do Trabalhador =====
  sectionTitle(doc, "2. DADOS DO TRABALHADOR", margin, y, contentW);
  y += 5;
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "grid",
    tableWidth: contentW,
    body: [
      ["Nome", emp.nome ?? "—", "CPF", emp.cpf ?? "—"],
      ["Data Nascimento", fmtBR(emp.data_nascimento), "PIS/NIS", emp.pis ?? emp.nis ?? "—"],
      ["Sexo", emp.sexo ?? "—", "Matrícula", emp.matricula ?? "—"],
      ["Data Admissão", fmtBR(emp.admissao), "CTPS", [emp.ctps_numero, emp.ctps_serie].filter(Boolean).join(" / ") || "—"],
      ["Cargo / Função", d.roleName ?? "—", "CBO", emp.cbo ?? "—"],
      ["Setor", emp.setor ?? "—", "Lotação / Função", emp.setor ?? "—"],
    ],
    styles: stylesBase(),
    columnStyles: pairCols(contentW),
  });
  y = (doc as any).lastAutoTable.finalY + 3;

  // ===== 3. Registros Ambientais =====
  sectionTitle(doc, "3. REGISTROS AMBIENTAIS — AGENTES NOCIVOS", margin, y, contentW);
  y += 5;
  if (d.riscos.length === 0) {
    empty(doc, "Nenhum agente nocivo cadastrado para o cargo.", margin, y, contentW);
    y += 7;
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: "grid",
      tableWidth: contentW,
      head: [["Cód. eSocial", "Agente Nocivo", "Tipo", "Intensidade", "L.T.", "Técnica", "Fonte", "EPI atenua"]],
      body: d.riscos.map((r) => [
        r.codigo_esocial ?? "—",
        r.nome,
        labelTipo(r),
        r.intensidade != null ? `${r.intensidade} ${r.unidade ?? ""}` : "—",
        r.limite_tolerancia != null ? `${r.limite_tolerancia} ${r.unidade ?? ""}` : "—",
        r.tecnica_medicao ?? "—",
        r.fonte_geradora ?? "—",
        r.epi_atenuacao_db != null ? `${r.epi_atenuacao_db} dB` : "—",
      ]),
      styles: { ...stylesBase(), fontSize: 7 },
      headStyles: headStyles(),
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 18, halign: "center" },
        2: { cellWidth: 22, halign: "center" },
        3: { cellWidth: 20, halign: "center" },
        4: { cellWidth: 16, halign: "center" },
        7: { cellWidth: 16, halign: "center" },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 2;

    const apos = d.riscos.filter((r) => r.aposentadoria_especial_anos != null);
    if (apos.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...WINE_DARK);
      doc.text(
        "Atividade enquadrada em APOSENTADORIA ESPECIAL: " +
          apos.map((r) => `${r.nome} (${r.aposentadoria_especial_anos} anos)`).join(" • "),
        margin,
        y + 3,
      );
      doc.setTextColor(0);
      y += 6;
    }
    y += 2;
  }

  // ===== 4. Exames Clínicos (ASO) =====
  sectionTitle(doc, "4. EXAMES MÉDICOS CLÍNICOS / OCUPACIONAIS", margin, y, contentW);
  y += 5;
  const exams = (d.exams ?? []).slice(0, 8);
  if (exams.length === 0) {
    empty(doc, "Nenhum ASO registrado.", margin, y, contentW);
    y += 7;
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: "grid",
      tableWidth: contentW,
      head: [["Tipo", "Natureza", "Realização", "Vencimento", "Aptidão", "Médico / CRM"]],
      body: exams.map((e: Any) => [
        e.tipo_exame ?? "—",
        e.natureza ?? "—",
        fmtBR(e.data_realizacao),
        fmtBR(e.data_vencimento),
        e.aptidao ?? "—",
        [e.medico_nome, e.medico_crm].filter(Boolean).join(" • ") || "—",
      ]),
      styles: stylesBase(),
      headStyles: headStyles(),
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        2: { halign: "center", cellWidth: 22 },
        3: { halign: "center", cellWidth: 22 },
        4: { halign: "center", cellWidth: 18 },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 3;
  }

  // ===== 5. EPIs entregues =====
  sectionTitle(doc, "5. EPIs FORNECIDOS (EFICÁCIA)", margin, y, contentW);
  y += 5;
  const epis = d.epis.slice(0, 10);
  if (epis.length === 0) {
    empty(doc, "Nenhum EPI registrado.", margin, y, contentW);
    y += 7;
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: "grid",
      tableWidth: contentW,
      head: [["EPI", "CA", "Última entrega", "Eficaz?"]],
      body: epis.map((e) => [e.item, e.ca ?? "—", fmtBR(e.data_entrega), "Sim"]),
      styles: stylesBase(),
      headStyles: headStyles(),
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        1: { halign: "center", cellWidth: 24 },
        2: { halign: "center", cellWidth: 26 },
        3: { halign: "center", cellWidth: 18 },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 3;
  }

  // ===== 6. Responsáveis pelos Registros Ambientais / Biológicos =====
  sectionTitle(doc, "6. RESPONSÁVEL TÉCNICO PELOS REGISTROS", margin, y, contentW);
  y += 5;
  const rt = d.responsavelTecnico ?? {};
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "grid",
    tableWidth: contentW,
    body: [
      ["Nome", rt.nome ?? "—", "Cargo", rt.cargo ?? "Engenheiro de Segurança do Trabalho"],
      ["Registro Profissional", rt.registro ?? "—", "Data", hoje],
    ],
    styles: stylesBase(),
    columnStyles: pairCols(contentW),
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // ===== Assinaturas =====
  if (y > pageH - 50) { doc.addPage(); y = margin; }
  const sigW = (contentW - 10) / 2;
  // Trabalhador
  doc.setDrawColor(0);
  doc.line(margin, y + 12, margin + sigW, y + 12);
  doc.setFont("helvetica", "bold"); doc.setFontSize(8);
  doc.text("Assinatura do Trabalhador", margin + sigW / 2, y + 17, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
  doc.text(emp.nome ?? "—", margin + sigW / 2, y + 21, { align: "center" });
  doc.text(`CPF: ${emp.cpf ?? "—"}`, margin + sigW / 2, y + 25, { align: "center" });

  // Representante legal
  const sigX2 = margin + sigW + 10;
  doc.line(sigX2, y + 12, sigX2 + sigW, y + 12);
  doc.setFont("helvetica", "bold"); doc.setFontSize(8);
  doc.text("Representante Legal da Empresa", sigX2 + sigW / 2, y + 17, { align: "center" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
  doc.text(co.name ?? "—", sigX2 + sigW / 2, y + 21, { align: "center" });
  doc.text(`CNPJ: ${co.cnpj ?? "—"}`, sigX2 + sigW / 2, y + 25, { align: "center" });

  // Rodapé
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text("SESMT • DMN Estaleiro — Documento gerado eletronicamente", margin, pageH - 6);
    doc.text(`Página ${p} de ${pageCount}`, pageW - margin, pageH - 6, { align: "right" });
    doc.setTextColor(0);
  }

  return doc;
}

function labelTipo(r: PPPData["riscos"][number]) {
  const parts: string[] = [];
  if (r.categoria) parts.push(r.categoria.toLowerCase());
  if (r.periculosidade) parts.push("perig.");
  if (r.insalubridade_grau && r.insalubridade_grau !== "NAO_INSALUBRE") parts.push("insal.");
  return parts.join(" / ") || "—";
}

function sectionTitle(doc: jsPDF, title: string, x: number, y: number, w: number) {
  doc.setFillColor(...WINE);
  doc.rect(x, y - 3.5, w, 5.5, "F");
  doc.setFillColor(...WINE_DARK);
  doc.rect(x, y + 1.5, w, 0.5, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text(title, x + 2.5, y);
  doc.setTextColor(0);
}

function empty(doc: jsPDF, text: string, x: number, y: number, w: number) {
  doc.setDrawColor(220);
  doc.setLineWidth(0.2);
  doc.rect(x, y - 3, w, 6);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(text, x + w / 2, y + 1, { align: "center" });
  doc.setTextColor(0);
}

function stylesBase() {
  return { fontSize: 7.5, cellPadding: 1.4, lineColor: [0, 0, 0] as [number, number, number], lineWidth: 0.1, textColor: [0, 0, 0] as [number, number, number], overflow: "linebreak" as const };
}
function headStyles() {
  return { fillColor: WINE, textColor: [255, 255, 255] as [number, number, number], fontStyle: "bold" as const, halign: "center" as const, fontSize: 7.5 };
}
function pairCols(contentW: number) {
  return {
    0: { cellWidth: 32, fontStyle: "bold" as const, fillColor: [248, 250, 252] as [number, number, number] },
    1: { cellWidth: contentW / 2 - 32 },
    2: { cellWidth: 32, fontStyle: "bold" as const, fillColor: [248, 250, 252] as [number, number, number] },
    3: { cellWidth: contentW / 2 - 32 },
  };
}