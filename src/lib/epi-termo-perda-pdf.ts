import jsPDF from "jspdf";
import dmnLogo from "@/assets/dmn-logo.png";

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
  const H = 297;
  const margin = 15;
  const innerW = W - (margin * 2);
  let y = margin;

  // Cabeçalho Elegante (Similar ao padrão DMN)
  const hdrH = 22;
  const logoW = 38;
  const titleW = innerW - logoW;

  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, innerW, hdrH);
  doc.line(margin + logoW, y, margin + logoW, y + hdrH);

  // Logo DMN
  try {
    doc.addImage(dmnLogo as any, "PNG", margin + 3, y + 3, logoW - 6, hdrH - 6);
  } catch {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(178, 34, 34);
    doc.text("DMN", margin + logoW / 2, y + 11, { align: "center" });
    doc.setTextColor(0);
  }

  // Título do Cabeçalho
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("TERMO DE RESPONSABILIDADE", margin + logoW + (titleW / 2), y + 9, { align: "center" });
  doc.setFontSize(10);
  doc.text("PERDA / EXTRAVIO DE EQUIPAMENTO (EPI)", margin + logoW + (titleW / 2), y + 15, { align: "center" });

  y += hdrH + 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("TERMO DE RESPONSABILIDADE POR EXTRAVIO", W / 2, y, { align: "center" });
  y += 5;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Conforme NR-06 (item 6.7.1) e Art. 462 §1º da CLT", W / 2, y, { align: "center" });

  y += 10;
  doc.setDrawColor(200);
  doc.line(margin, y, W - margin, y);
  y += 6;

  const valorTotal = (a.valor_unitario ?? 0) * (a.qtd || 1);
  const fmtMoney = (n: number) => n > 0 ? `R$ ${n.toFixed(2).replace(".", ",")}` : "R$ 0,00";

  // Dados do Colaborador
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y - 4, innerW, 25, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("1. DADOS DO COLABORADOR", margin + 2, y); y += 6;
  doc.setFont("helvetica", "normal");
  doc.text(`Nome: ${a.emp.nome ?? ""}`, margin + 2, y); y += 5;
  doc.text(`CPF: ${a.emp.cpf ?? ""}     Matrícula: ${a.emp.matricula ?? "—"}`, margin + 2, y); y += 5;
  doc.text(`Função: ${a.role?.name ?? "—"}     Empresa: ${a.company?.name ?? "—"}`, margin + 2, y); y += 10;

  // Dados do EPI
  doc.setFont("helvetica", "bold");
  doc.text("2. DADOS DO EQUIPAMENTO EXTRAVIADO", margin, y); y += 6;
  doc.setFont("helvetica", "normal");
  doc.text(`Item: ${a.item}`, margin, y); y += 5;
  doc.text(`C.A.: ${a.ca ?? "—"}     Quantidade: ${a.qtd}`, margin, y); y += 5;
  doc.text(`Data da entrega original: ${brDate(a.data_entrega)}`, margin, y); y += 5;
  doc.text(`Valor unitário: ${fmtMoney(a.valor_unitario ?? 0)}     Valor total: ${fmtMoney(valorTotal)}`, margin, y); y += 12;

  if (a.observacoes) {
    doc.setFont("helvetica", "bold");
    doc.text("OBSERVAÇÕES:", margin, y); y += 5;
    doc.setFont("helvetica", "normal");
    const linesObs = doc.splitTextToSize(a.observacoes, innerW);
    doc.text(linesObs, margin, y);
    y += linesObs.length * 5 + 8;
  }

  // Declaração
  doc.setFont("helvetica", "bold");
  doc.text("3. DECLARAÇÃO E COMPROMISSO", margin, y); y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const decl =
    `Eu, ${a.emp.nome ?? "_______________"}, portador(a) do CPF ${a.emp.cpf ?? "___.___.___-__"}, ` +
    `DECLARO para os devidos fins que extraviei/perdi o(s) Equipamento(s) de Proteção Individual descrito(s) acima, ` +
    `que me foi(foram) entregue(s) gratuitamente pela empresa para uso obrigatório no exercício de minhas atividades laborais. ` +
    `Estou ciente de que, conforme a NR-06 (item 6.7.1) e o art. 462 §1º da CLT, a empresa poderá descontar de minha remuneração ` +
    `o valor correspondente ao(s) item(ns) extraviado(s), no montante total de ${fmtMoney(valorTotal)}, ` +
    `bem como reconheço minha responsabilidade pela conservação e guarda dos EPIs recebidos daqui em diante.`;
  const linesDecl = doc.splitTextToSize(decl, innerW);
  doc.text(linesDecl, margin, y);
  y += linesDecl.length * 5 + 25;

  // Assinaturas
  const sigW = 75;
  doc.setDrawColor(0);
  doc.line(margin + 5, y, margin + 5 + sigW, y);
  doc.line(W - margin - 5 - sigW, y, W - margin - 5, y);
  y += 4;
  doc.setFontSize(8);
  doc.text("Assinatura do Colaborador", margin + 5 + (sigW / 2), y, { align: "center" });
  doc.text("Assinatura do Responsável SESMT", W - margin - 5 - (sigW / 2), y, { align: "center" });
  y += 12;
  doc.setFontSize(10);
  doc.text(`Manaus/AM, ${brDate(new Date().toISOString().slice(0, 10))}`, W / 2, y, { align: "center" });

  // Rodapé
  doc.setFontSize(7);
  doc.setTextColor(100);
  doc.text("DMN Estaleiro • SESMT • Controle Interno de EPI", W / 2, H - 10, { align: "center" });

  const fname = `Termo_Perda_EPI_${(a.emp.nome ?? "colab").replace(/\s+/g, "_")}_${Date.now()}.pdf`;
  const bytes = new Uint8Array(doc.output("arraybuffer"));
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  return { url, fname, bytes };
}
