import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type PontoPdfFolha = {
  nome: string | null;
  matricula: string | null;
  cargo: string | null;
  local_trabalho: string | null;
  pagina_pdf: number | null;
  totais_json: any;
  dias: {
    data: string;
    dia_semana: string | null;
    marcacoes: string[] | null;
    motivo_flag: string | null;
    status_sistema: string | null;
  }[];
  tratativas: {
    tipo: string;
    descricao: string;
    data_inicio: string;
    data_fim: string;
    cid: string | null;
    autorizado_por: string | null;
    anexo_nome: string | null;
  }[];
};

export type PontoPdfInput = {
  competencia: string; // YYYY-MM-DD
  folhas: PontoPdfFolha[];
  aprovador: { nome: string; cargo: string; assinaturaDataUrl: string | null } | null;
};

function fmt(iso: string) {
  const [y, m, d] = iso.split("-");
  return d ? `${d}/${m}/${y}` : `${m}/${y}`;
}

export function gerarPdfConsolidado(input: PontoPdfInput): Blob {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 36;

  input.folhas.forEach((f, idx) => {
    if (idx > 0) doc.addPage();

    // Cabeçalho
    doc.setFillColor(30, 30, 30);
    doc.rect(0, 0, pageW, 60, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14).setFont("helvetica", "bold");
    doc.text("Folha de Ponto — Fechamento Mensal", margin, 26);
    doc.setFontSize(10).setFont("helvetica", "normal");
    doc.text(`Competência: ${fmt(input.competencia)}`, margin, 44);
    doc.text(`Página ${idx + 1} de ${input.folhas.length}`, pageW - margin, 44, { align: "right" });

    // Bloco funcionário
    doc.setTextColor(0, 0, 0);
    let y = 80;
    doc.setFontSize(11).setFont("helvetica", "bold");
    doc.text(f.nome ?? "—", margin, y);
    doc.setFont("helvetica", "normal").setFontSize(9);
    y += 14;
    const meta = [
      f.matricula ? `Matrícula: ${f.matricula}` : null,
      f.cargo ? `Cargo: ${f.cargo}` : null,
      f.local_trabalho ? `Local: ${f.local_trabalho}` : null,
      f.pagina_pdf ? `Pág. original: ${f.pagina_pdf}` : null,
    ].filter(Boolean).join("  ·  ");
    doc.text(meta, margin, y);
    y += 12;

    // Tabela de dias
    autoTable(doc, {
      startY: y + 6,
      head: [["Data", "Dia", "Marcações", "Status", "Motivo"]],
      body: f.dias.map(d => [
        fmt(d.data),
        d.dia_semana ?? "",
        (d.marcacoes ?? []).join("  ") || "—",
        d.status_sistema ?? "",
        d.motivo_flag ?? "",
      ]),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [50, 50, 50], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: margin, right: margin },
    });

    let afterY = (doc as any).lastAutoTable.finalY + 14;

    // Tratativas
    if (f.tratativas.length > 0) {
      doc.setFontSize(10).setFont("helvetica", "bold");
      doc.text("Tratativas registradas", margin, afterY);
      autoTable(doc, {
        startY: afterY + 4,
        head: [["Tipo", "Período", "Descrição", "Autorizado por", "Anexo"]],
        body: f.tratativas.map(t => [
          t.tipo.replace(/_/g, " "),
          `${fmt(t.data_inicio)} – ${fmt(t.data_fim)}${t.cid ? ` (CID ${t.cid})` : ""}`,
          t.descricao,
          t.autorizado_por ?? "—",
          t.anexo_nome ?? "—",
        ]),
        styles: { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: [80, 80, 80], textColor: 255 },
        margin: { left: margin, right: margin },
      });
      afterY = (doc as any).lastAutoTable.finalY + 14;
    }

    // Assinatura do aprovador
    const sigY = Math.min(afterY + 20, pageH - 120);
    doc.setDrawColor(180);
    doc.line(margin, sigY + 60, margin + 260, sigY + 60);
    if (input.aprovador?.assinaturaDataUrl) {
      try {
        doc.addImage(input.aprovador.assinaturaDataUrl, "PNG", margin + 10, sigY, 200, 60);
      } catch { /* ignore */ }
    }
    doc.setFontSize(9).setFont("helvetica", "normal");
    doc.text(input.aprovador?.nome ?? "—", margin, sigY + 74);
    doc.setFontSize(8).setTextColor(100);
    doc.text(input.aprovador?.cargo ?? "Aprovador", margin, sigY + 86);
    doc.setTextColor(0);
  });

  return doc.output("blob");
}