import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Proc = {
  codigo: string;
  titulo: string;
  objetivo?: string | null;
  escopo: string;
  area: string;
  criticidade: string;
  status: string;
  versao_atual: string;
  periodicidade_revisao_meses: number;
  proxima_revisao?: string | null;
  responsavel?: string | null;
  observacoes?: string | null;
  created_at?: string;
  updated_at?: string;
};
type Rev = {
  versao: string;
  status: string;
  data_emissao: string;
  data_homologacao?: string | null;
  motivo_revisao?: string | null;
  responsavel?: string | null;
  pdf_path?: string | null;
};
type Emp = {
  id: string;
  nome: string;
  cpf?: string | null;
  setor?: string | null;
  company_id?: string | null;
};
type Ciente = {
  employee_id: string;
  versao: string;
  data_ciencia: string;
  origem: string;
  observacao?: string | null;
};

function br(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("pt-BR");
}

export function gerarAuditoriaPopPdf(opts: {
  proc: Proc;
  revisoes: Rev[];
  applicable: Emp[];
  cientesAtuais: Ciente[];
  companyName: Map<string, string>;
  companyType: Map<string, string>;
}) {
  const { proc, revisoes, applicable, cientesAtuais, companyName, companyType } = opts;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 14;
  let y = M;

  // Cabeçalho
  doc.setFillColor(127, 29, 29);
  doc.rect(0, 0, W, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("RELATÓRIO DE AUDITORIA — PROCEDIMENTO OPERACIONAL PADRÃO", W / 2, 10, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Emitido em: ${new Date().toLocaleString("pt-BR")}`,
    W / 2,
    16,
    { align: "center" },
  );
  doc.setTextColor(0, 0, 0);
  y = 28;

  // Identificação
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`${proc.codigo} — ${proc.titulo}`, M, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.5 },
    head: [["Campo", "Valor"]],
    headStyles: { fillColor: [127, 29, 29], textColor: 255 },
    body: [
      ["Versão atual", `v${proc.versao_atual}`],
      ["Status", proc.status],
      ["Escopo", proc.escopo],
      ["Área", proc.area],
      ["Criticidade", proc.criticidade],
      ["Periodicidade revisão", `${proc.periodicidade_revisao_meses} meses`],
      ["Próxima revisão", br(proc.proxima_revisao)],
      ["Responsável", proc.responsavel || "—"],
      ["Objetivo", proc.objetivo || "—"],
      ["Observações", proc.observacoes || "—"],
    ],
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Indicadores
  const totalApp = applicable.length;
  const cientesSet = new Set(cientesAtuais.map((c) => c.employee_id));
  const totalCient = applicable.filter((e) => cientesSet.has(e.id)).length;
  const pct = totalApp ? Math.round((totalCient / totalApp) * 100) : 0;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Indicadores de Aderência (versão atual)", M, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2, halign: "center" },
    head: [["Aplicáveis", "Cientes", "Pendentes", "Aderência"]],
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    body: [[
      String(totalApp),
      String(totalCient),
      String(totalApp - totalCient),
      `${pct}%`,
    ]],
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Histórico de revisões
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Histórico de Revisões", M, y);
  y += 4;
  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.5 },
    head: [["Versão", "Status", "Emissão", "Homologação", "Motivo", "PDF"]],
    headStyles: { fillColor: [127, 29, 29], textColor: 255 },
    body: revisoes.length
      ? revisoes.map((r) => [
          `v${r.versao}`,
          r.status,
          br(r.data_emissao),
          br(r.data_homologacao),
          r.motivo_revisao || "—",
          r.pdf_path ? "Sim" : "—",
        ])
      : [["—", "—", "—", "—", "Sem revisões", "—"]],
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Lista de colaboradores aplicáveis
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(
    `Colaboradores aplicáveis (${totalApp}) — Escopo: ${proc.escopo}`,
    M,
    y,
  );
  y += 4;

  const cienciaMap = new Map<string, Ciente>();
  for (const c of cientesAtuais) cienciaMap.set(c.employee_id, c);

  autoTable(doc, {
    startY: y,
    theme: "striped",
    styles: { fontSize: 7.5, cellPadding: 1.2 },
    head: [["Nome", "CPF", "Empresa", "Tipo", "Setor", "Status", "Data Ciência", "Origem"]],
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    columnStyles: {
      5: { halign: "center" },
      6: { halign: "center" },
      7: { halign: "center" },
    },
    body: applicable.map((e) => {
      const c = cienciaMap.get(e.id);
      return [
        e.nome,
        e.cpf || "—",
        e.company_id ? companyName.get(e.company_id) || "—" : "—",
        e.company_id ? companyType.get(e.company_id) || "—" : "—",
        e.setor || "—",
        c ? "CIENTE" : "PENDENTE",
        c ? br(c.data_ciencia) : "—",
        c ? c.origem : "—",
      ];
    }),
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 5) {
        const v = String(data.cell.raw);
        if (v === "CIENTE") {
          data.cell.styles.fillColor = [220, 252, 231];
          data.cell.styles.textColor = [22, 101, 52];
        } else {
          data.cell.styles.fillColor = [254, 243, 199];
          data.cell.styles.textColor = [146, 64, 14];
        }
      }
    },
  });

  // Rodapé com paginação
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Documento gerado pelo sistema SESMT — ${proc.codigo} v${proc.versao_atual} — Página ${i}/${pages}`,
      W / 2,
      doc.internal.pageSize.getHeight() - 6,
      { align: "center" },
    );
  }

  const filename = `Auditoria_${proc.codigo}_v${proc.versao_atual}.pdf`;
  doc.save(filename);
}