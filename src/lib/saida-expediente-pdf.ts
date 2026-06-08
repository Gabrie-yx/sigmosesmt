import jsPDF from "jspdf";

export type SaidaExpedientePdfParams = {
  funcionarioNome: string;
  rg?: string | null;
  cpf?: string | null;
  cargo?: string | null;
  data: string;            // dd/mm/yyyy
  dataExtenso: string;     // "04 de março de 2026"
  horarioSaida: string;
  tipo: "PESSOAL" | "SERVICO";
  comRetorno: boolean;
  horarioRetorno?: string | null;
  motivo?: string | null;
  observacao?: string | null;
  logoDataUrl?: string | null;
  assinaturaFuncionarioDataUrl?: string | null;
  assinaturaSesmtDataUrl?: string | null;
  assinaturaSupervisorDataUrl?: string | null;
  sesmtNome?: string | null;
  sesmtCargo?: string | null;
};

export function gerarSaidaExpedientePDF(p: SaidaExpedientePdfParams): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 18;

  // Logo
  if (p.logoDataUrl) {
    try {
      doc.addImage(p.logoDataUrl, "PNG", pageW / 2 - 18, y, 36, 16, undefined, "FAST");
    } catch {}
  }
  y += 28;

  // Título
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(20, 20, 20);
  doc.text("AUTORIZAÇÃO DE SAÍDA DURANTE O EXPEDIENTE", pageW / 2, y, { align: "center" });
  y += 18;

  // Corpo
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const ident: string[] = [];
  if (p.rg) ident.push(`RG nº ${p.rg}`);
  if (p.cpf) ident.push(`CPF ${p.cpf}`);
  const identStr = ident.length ? ` ${ident.join(" ")}` : "";
  const linha1 = `Autorizamos nosso(a) funcionário(a) ${p.funcionarioNome}${identStr} a se ausentar do local de trabalho a partir das ${p.horarioSaida} do dia ${p.data}.`;
  const linhas = doc.splitTextToSize(linha1, pageW - margin * 2);
  doc.text(linhas, margin, y);
  y += linhas.length * 6 + 8;

  doc.text(`Manaus, ${p.dataExtenso}.`, pageW / 2, y, { align: "center" });
  y += 12;

  // Checkboxes
  const box = (x: number, yy: number, marked: boolean) => {
    doc.setDrawColor(0); doc.setLineWidth(0.3);
    doc.rect(x, yy - 3.5, 4, 4);
    if (marked) { doc.setFont("helvetica","bold"); doc.text("X", x + 0.8, yy); doc.setFont("helvetica","normal"); }
  };
  doc.setFontSize(10);
  box(margin, y, p.tipo === "PESSOAL"); doc.text("ASSUNTOS PESSOAIS", margin + 6, y);
  box(margin + 70, y, p.tipo === "SERVICO"); doc.text("A SERVIÇO DA EMPRESA", margin + 76, y);
  y += 8;
  box(margin, y, p.comRetorno);
  doc.text(`COM RETORNO ÀS ${p.horarioRetorno ?? "_______"} (HORÁRIO)`, margin + 6, y);
  box(margin + 110, y, !p.comRetorno); doc.text("SEM RETORNO", margin + 116, y);
  y += 12;

  // Motivo
  if (p.motivo) {
    doc.setFont("helvetica", "bold"); doc.text("MOTIVO:", margin, y);
    doc.setFont("helvetica", "normal");
    const mw = pageW - margin * 2 - 18;
    const mls = doc.splitTextToSize(p.motivo, mw);
    doc.text(mls, margin + 18, y);
    y += Math.max(mls.length * 5, 6) + 6;
  }

  if (p.observacao) {
    doc.setFont("helvetica", "bold"); doc.text("OBS.:", margin, y);
    doc.setFont("helvetica", "normal");
    const ols = doc.splitTextToSize(p.observacao, pageW - margin * 2 - 14);
    doc.text(ols, margin + 14, y);
    y += ols.length * 5 + 4;
  }

  y += 24;

  // Assinaturas — TST à esquerda, Funcionário à direita; Supervisor abaixo
  const sigW = 75, sigH = 22, gap = 14;
  const drawSig = (cx: number, label: string, sub: string, dataUrl?: string | null) => {
    const x = cx - sigW / 2;
    if (dataUrl) {
      try { doc.addImage(dataUrl, "PNG", x, y - sigH + 2, sigW, sigH, undefined, "FAST"); } catch {}
    }
    doc.setDrawColor(0); doc.setLineWidth(0.3);
    doc.line(x, y + 4, x + sigW, y + 4);
    doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text(label, cx, y + 9, { align: "center" });
    if (sub) { doc.setFont("helvetica","normal"); doc.setFontSize(8.5); doc.setTextColor(80,80,80); doc.text(sub, cx, y + 13.5, { align: "center" }); doc.setTextColor(20,20,20); }
  };

  const leftCx = margin + sigW / 2;
  const rightCx = pageW - margin - sigW / 2;
  drawSig(leftCx, p.sesmtNome ?? "SESMT", p.sesmtCargo ?? "Técnico(a) de Segurança do Trabalho — TST", p.assinaturaSesmtDataUrl);
  drawSig(rightCx, p.funcionarioNome, p.cargo ?? "Funcionário(a)", p.assinaturaFuncionarioDataUrl);

  y += 22 + gap;
  drawSig(pageW / 2, "Anderson de Oliveira Soares", "Supervisor Geral", p.assinaturaSupervisorDataUrl);

  return doc;
}