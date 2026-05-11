import jsPDF from "jspdf";

type Args = {
  emp: { nome?: string | null; cpf?: string | null; matricula?: string | null };
  company?: { name?: string | null } | null;
  role?: { name?: string | null } | null;
  item: string;
  ca?: string | null;
  qtd: number;
  valor_unitario?: number | null;
  data_entrega: string;
  observacoes?: string | null;
};

function brDate(s?: string | null) {
  if (!s) return "_______________";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString("pt-BR");
}

export function openTermoPerdaPdf(a: Args) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  let y = 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("TERMO DE RESPONSABILIDADE — PERDA / EXTRAVIO DE EPI", W / 2, y, { align: "center" });
  y += 4;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Conforme NR-06 (item 6.7.1) — Ministério do Trabalho e Emprego", W / 2, y, { align: "center" });

  y += 8;
  doc.setDrawColor(180);
  doc.line(15, y, W - 15, y);
  y += 6;

  const valorTotal = (a.valor_unitario ?? 0) * (a.qtd || 1);
  const fmtMoney = (n: number) => n > 0 ? `R$ ${n.toFixed(2).replace(".", ",")}` : "—";

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("DADOS DO COLABORADOR", 15, y); y += 5;
  doc.setFont("helvetica", "normal");
  doc.text(`Nome: ${a.emp.nome ?? ""}`, 15, y); y += 5;
  doc.text(`CPF: ${a.emp.cpf ?? ""}     Matrícula: ${a.emp.matricula ?? "—"}`, 15, y); y += 5;
  doc.text(`Função: ${a.role?.name ?? "—"}     Empresa: ${a.company?.name ?? "—"}`, 15, y); y += 8;

  doc.setFont("helvetica", "bold");
  doc.text("DADOS DO EPI EXTRAVIADO", 15, y); y += 5;
  doc.setFont("helvetica", "normal");
  doc.text(`Item: ${a.item}`, 15, y); y += 5;
  doc.text(`C.A.: ${a.ca ?? "—"}     Quantidade: ${a.qtd}`, 15, y); y += 5;
  doc.text(`Data da entrega original: ${brDate(a.data_entrega)}`, 15, y); y += 5;
  doc.text(`Valor unitário: ${fmtMoney(a.valor_unitario ?? 0)}     Valor total: ${fmtMoney(valorTotal)}`, 15, y); y += 8;

  if (a.observacoes) {
    doc.setFont("helvetica", "bold");
    doc.text("OBSERVAÇÕES:", 15, y); y += 5;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(a.observacoes, W - 30);
    doc.text(lines, 15, y);
    y += lines.length * 5 + 3;
  }

  y += 3;
  doc.setFont("helvetica", "bold");
  doc.text("DECLARAÇÃO", 15, y); y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const decl =
    `Eu, ${a.emp.nome ?? "_______________"}, portador(a) do CPF ${a.emp.cpf ?? "___.___.___-__"}, ` +
    `DECLARO para os devidos fins que extraviei/perdi o(s) Equipamento(s) de Proteção Individual descrito(s) acima, ` +
    `que me foi(foram) entregue(s) gratuitamente pela empresa para uso obrigatório no exercício de minhas atividades laborais. ` +
    `Estou ciente de que, conforme a NR-06 (item 6.7.1) e o art. 462 §1º da CLT, a empresa poderá descontar de minha remuneração ` +
    `o valor correspondente ao(s) item(ns) extraviado(s), no montante total de ${fmtMoney(valorTotal)}, ` +
    `bem como reconheço minha responsabilidade pela conservação e guarda dos EPIs recebidos.`;
  const lines = doc.splitTextToSize(decl, W - 30);
  doc.text(lines, 15, y);
  y += lines.length * 5 + 14;

  // Assinaturas
  doc.line(20, y, 95, y);
  doc.line(115, y, 190, y);
  y += 4;
  doc.setFontSize(8);
  doc.text("Assinatura do Colaborador", 57.5, y, { align: "center" });
  doc.text("Assinatura do Responsável SESMT", 152.5, y, { align: "center" });
  y += 8;
  doc.setFontSize(9);
  doc.text(`Data: ${brDate(new Date().toISOString().slice(0, 10))}`, 15, y);

  const fname = `Termo_Perda_EPI_${(a.emp.nome ?? "colab").replace(/\s+/g, "_")}_${Date.now()}.pdf`;
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  return { url, fname };
}
