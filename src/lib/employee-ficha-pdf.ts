import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import dmnLogo from "@/assets/dmn-logo.png";

// Vinho DMN (mesma paleta usada na UI: #7B1E2B)
const WINE: [number, number, number] = [123, 30, 43];
const WINE_DARK: [number, number, number] = [90, 20, 32];

type Emp = Record<string, any>;

export type EmployeeFichaData = {
  emp: Emp;
  companyName?: string | null;
  roleName?: string | null;
  photoDataUrl?: string | null;
  atestados?: any[];
  exams?: any[];
  acidentes?: any[];
};

function fmtBR(d?: string | null) {
  if (!d) return "—";
  const iso = String(d).split("T")[0];
  const [y, m, day] = iso.split("-");
  return y && m && day ? `${day}/${m}/${y}` : String(d);
}

async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const blob = await r.blob();
    return await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result ?? ""));
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function loadEmployeePhotoDataUrl(url?: string | null): Promise<string | null> {
  if (!url) return null;
  const raw = await fetchAsDataUrl(url);
  if (!raw) return null;
  // Recorta em "cover" no aspecto 3x4 (foto tipo 3x4) pra não distorcer no PDF.
  try {
    return await cropCoverDataUrl(raw, 3, 4);
  } catch {
    return raw;
  }
}

async function cropCoverDataUrl(dataUrl: string, arW: number, arH: number): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
  const targetAR = arW / arH;
  const srcAR = img.width / img.height;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (srcAR > targetAR) {
    // imagem mais larga → corta laterais
    sw = Math.round(img.height * targetAR);
    sx = Math.round((img.width - sw) / 2);
  } else {
    // imagem mais alta → corta topo/baixo (puxando levemente pro topo, melhor pra rosto)
    sh = Math.round(img.width / targetAR);
    sy = Math.round((img.height - sh) * 0.25);
  }
  const outW = Math.min(600, sw);
  const outH = Math.round(outW / targetAR);
  const c = document.createElement("canvas");
  c.width = outW; c.height = outH;
  const ctx = c.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
  return c.toDataURL("image/jpeg", 0.9);
}

export function gerarFichaFuncionarioPdf(d: EmployeeFichaData): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210;
  const pageH = 297;
  const margin = 12;
  const contentW = pageW - margin * 2;
  const hojeBR = new Date().toLocaleDateString("pt-BR");
  const emp = d.emp ?? {};

  // ===== Header compacto (faixa vinho) =====
  const headerH = 16;
  let y = margin;
  // faixa vinho com filete escuro embaixo
  doc.setFillColor(...WINE);
  doc.rect(margin, y, contentW, headerH, "F");
  doc.setFillColor(...WINE_DARK);
  doc.rect(margin, y + headerH - 1, contentW, 1, "F");
  // logo em área branca à esquerda (pra não sumir no fundo vinho)
  const logoBoxW = 32;
  doc.setFillColor(255, 255, 255);
  doc.rect(margin, y, logoBoxW, headerH, "F");
  try { doc.addImage(dmnLogo as any, "PNG", margin + 2, y + 2, logoBoxW - 4, headerH - 4); } catch { /* noop */ }
  // título
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text("FICHA DO COLABORADOR", margin + logoBoxW + (contentW - logoBoxW) / 2, y + 7, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("SESMT • DMN Estaleiro", margin + logoBoxW + (contentW - logoBoxW) / 2, y + 12, { align: "center" });
  doc.setFontSize(7);
  doc.text(`Emitido em ${hojeBR}`, pageW - margin - 2, y + 5, { align: "right" });
  doc.setTextColor(0);

  y += headerH + 3;

  // ===== Identificação: foto + nome/cargo =====
  // foto 3x4 — proporção real, sem distorção
  const photoBoxW = 30;
  const photoBoxH = 40; // 30x40 = 3:4
  doc.setDrawColor(...WINE);
  doc.setLineWidth(0.2);
  doc.rect(margin, y, photoBoxW, photoBoxH);
  if (d.photoDataUrl) {
    try {
      doc.addImage(d.photoDataUrl, "JPEG", margin + 0.5, y + 0.5, photoBoxW - 1, photoBoxH - 1, undefined, "FAST");
    } catch {
      try { doc.addImage(d.photoDataUrl, "PNG", margin + 0.5, y + 0.5, photoBoxW - 1, photoBoxH - 1, undefined, "FAST"); } catch { /* noop */ }
    }
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(140);
    doc.text("sem foto", margin + photoBoxW / 2, y + photoBoxH / 2, { align: "center" });
    doc.setTextColor(0);
  }

  const infoX = margin + photoBoxW + 5;
  const infoW = contentW - photoBoxW - 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...WINE_DARK);
  doc.text(String(emp.nome ?? "—").toUpperCase(), infoX, y + 4.5, { maxWidth: infoW });
  doc.setTextColor(0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const linhaCargo = `${d.roleName ?? "—"}   •   ${d.companyName ?? "—"}`;
  doc.text(linhaCargo, infoX, y + 9, { maxWidth: infoW });

  // Mapeia o tipo de vínculo de forma legível
  const tipoRaw = String(emp.tipo_cadastro ?? "").toUpperCase();
  const tipoLabel =
    tipoRaw === "MEI" ? "MEI"
    : tipoRaw === "TERCEIRIZADO" ? "TERCEIRIZADO"
    : tipoRaw === "NAO_MEI" || tipoRaw === "CLT" ? "CLT"
    : "—";
  const isMei = tipoLabel === "MEI";

  // bloco-resumo (chave: valor)
  const pairs: [string, string][] = [
    ["Matrícula", emp.matricula ?? "—"],
    ["CPF", emp.cpf ?? "—"],
    ["RG", [emp.rg, emp.rg_orgao].filter(Boolean).join(" / ") || "—"],
    ["CNH", emp.cnh ?? "—"],
    ["Admissão", fmtBR(emp.admissao)],
    ["Status", emp.status ?? "—"],
    ["Empresa", d.companyName ?? "—"],
    ["Vínculo", tipoLabel],
    ["Setor", emp.setor ?? "—"],
    [isMei ? "CNPJ (MEI)" : "CNPJ", isMei ? (emp.cnpj ?? "—") : (emp.cnpj ?? "—")],
  ];
  const colW = infoW / 2;
  doc.setFontSize(8);
  pairs.forEach((p, i) => {
    const cx = infoX + (i % 2) * colW;
    const cy = y + 14 + Math.floor(i / 2) * 5.2;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(90);
    doc.text(`${p[0]}:`, cx, cy);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0);
    doc.text(String(p[1] ?? "—"), cx + 22, cy, { maxWidth: colW - 23 });
  });

  y += photoBoxH + 3;

  // ===== Seção: Contato & Endereço =====
  drawSectionTitle(doc, "CONTATO & ENDEREÇO", margin, y, contentW);
  y += 5;
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "grid",
    tableWidth: contentW,
    body: [
      ["E-mail", emp.email ?? "—", "WhatsApp", emp.whatsapp ?? "—"],
      ["Contato emergência", emp.nome_contato ?? "—", "WhatsApp emergência", emp.whatsapp_emergencia ?? "—"],
      ["Endereço", emp.endereco ?? "—", "Bairro", emp.bairro ?? "—"],
      ["Cidade / UF", `${emp.cidade ?? "—"} ${emp.uf ? "/ " + emp.uf : ""}`, "CEP", emp.cep ?? "—"],
    ],
    styles: { fontSize: 8, cellPadding: 1.4, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0] },
    columnStyles: {
      0: { cellWidth: 32, fontStyle: "bold", fillColor: [248, 250, 252] },
      1: { cellWidth: contentW / 2 - 32 },
      2: { cellWidth: 32, fontStyle: "bold", fillColor: [248, 250, 252] },
      3: { cellWidth: contentW / 2 - 32 },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // ===== Seção: ASOs / Exames =====
  drawSectionTitle(doc, "EXAMES OCUPACIONAIS (ASO)", margin, y, contentW);
  y += 5;
  const exams = (d.exams ?? []).slice(0, 10);
  if (exams.length === 0) {
    drawEmpty(doc, "Nenhum ASO registrado.", margin, y, contentW);
    y += 7;
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: "grid",
      tableWidth: contentW,
      head: [["Tipo", "Natureza", "Realização", "Vencimento", "Aptidão", "Médico"]],
      body: exams.map((e: any) => [
        e.tipo_exame ?? "—",
        e.natureza ?? "—",
        fmtBR(e.data_realizacao),
        fmtBR(e.data_vencimento),
        e.aptidao ?? "—",
        [e.medico_nome, e.medico_crm].filter(Boolean).join(" • ") || "—",
      ]),
      styles: { fontSize: 7.5, cellPadding: 1.4, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0] },
      headStyles: { fillColor: WINE, textColor: [255, 255, 255], fontStyle: "bold", halign: "center", fontSize: 7.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        2: { halign: "center", cellWidth: 22 },
        3: { halign: "center", cellWidth: 22 },
        4: { halign: "center", cellWidth: 18 },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 4;
  }

  // ===== Seção: Atestados =====
  drawSectionTitle(doc, "ATESTADOS MÉDICOS", margin, y, contentW);
  y += 5;
  const atestados = (d.atestados ?? []).slice(0, 12);
  if (atestados.length === 0) {
    drawEmpty(doc, "Nenhum atestado registrado.", margin, y, contentW);
    y += 7;
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: "grid",
      tableWidth: contentW,
      head: [["Tipo", "Início", "Dias", "CID", "Médico / CRM", "Obs."]],
      body: atestados.map((a: any) => [
        a.tipo ?? "—",
        fmtBR(a.data_inicio),
        String(a.dias_afastamento ?? "—"),
        a.cid ?? "—",
        [a.medico_nome, a.medico_crm].filter(Boolean).join(" / ") || "—",
        a.observacao ?? "—",
      ]),
      styles: { fontSize: 7.5, cellPadding: 1.4, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0], overflow: "linebreak" },
      headStyles: { fillColor: WINE, textColor: [255, 255, 255], fontStyle: "bold", halign: "center", fontSize: 7.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        1: { halign: "center", cellWidth: 20 },
        2: { halign: "center", cellWidth: 12 },
        3: { halign: "center", cellWidth: 18 },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 4;
  }

  // ===== Seção: Acidentes / Incidentes =====
  drawSectionTitle(doc, "ACIDENTES / INCIDENTES DE TRABALHO", margin, y, contentW);
  y += 5;
  const acidentes = (d.acidentes ?? []).slice(0, 10);
  if (acidentes.length === 0) {
    drawEmpty(doc, "Nenhuma ocorrência registrada.", margin, y, contentW);
    y += 7;
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      theme: "grid",
      tableWidth: contentW,
      head: [["Data", "Local", "CID", "Afast.", "Dias Perd.", "Descrição"]],
      body: acidentes.map((a: any) => [
        fmtBR(a.data_acidente),
        a.local_acidente ?? "—",
        a.cid ?? "—",
        a.houve_afastamento ? "Sim" : "Não",
        String(a.dias_perdidos ?? 0),
        (a.descricao ?? "—").toString().slice(0, 220),
      ]),
      styles: { fontSize: 7.5, cellPadding: 1.4, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0], overflow: "linebreak" },
      headStyles: { fillColor: WINE, textColor: [255, 255, 255], fontStyle: "bold", halign: "center", fontSize: 7.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { halign: "center", cellWidth: 20 },
        2: { halign: "center", cellWidth: 16 },
        3: { halign: "center", cellWidth: 14 },
        4: { halign: "center", cellWidth: 16 },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 4;
  }

  // ===== Rodapé com paginação =====
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text("SESMT • DMN Estaleiro", margin, pageH - 6);
    doc.text(`Página ${p} de ${pageCount}`, pageW - margin, pageH - 6, { align: "right" });
    doc.setTextColor(0);
  }

  return doc;
}

function drawSectionTitle(doc: jsPDF, title: string, x: number, y: number, w: number) {
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

function drawEmpty(doc: jsPDF, text: string, x: number, y: number, w: number) {
  doc.setDrawColor(220);
  doc.setLineWidth(0.2);
  doc.rect(x, y - 3, w, 6);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(text, x + w / 2, y + 1, { align: "center" });
  doc.setTextColor(0);
}