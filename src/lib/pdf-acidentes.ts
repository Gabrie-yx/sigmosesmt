import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import dmnLogoAsset from "@/assets/dmn-logo-acidentes-v2.png.asset.json";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

type Acidente = {
  data_acidente: string;
  tipo: string;
  dias_perdidos?: number | null;
  dias_debitados?: number | null;
};

type Hht = { ano: number; mes: number; hht: number | string; empregados_medio?: number };

type DiasRow = {
  dias_sem_com_afast: number | null;
  dias_sem_registravel: number | null;
  ultimo_acidente_com_afast: string | null;
  ultimo_acidente_registravel: string | null;
  recorde_com_afast: number | null;
  recorde_registravel: number | null;
};

function footer(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      `Página ${i} de ${pages} · NBR 14280 · Documento gerado eletronicamente pelo SIGMO`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: "center" }
    );
    doc.setTextColor(0);
  }
}

/** FOR-SEG 09 — Quadro Estatístico Anual de Acidentes */
export function gerarForSeg09(opts: {
  ano: number;
  acidentes: Acidente[];
  hht: Hht[];
  empresa?: string;
  cnpj?: string;
  endereco?: string;
  bairro?: string;
  cep?: string;
  cnae?: string;
  grau_risco?: string;
}) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Cabeçalho Rígido FOR-SEG 09
  const header = () => {
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    
    // Moldura principal do cabeçalho
    doc.rect(10, 10, pageWidth - 20, 25);
    
    // Divisórias verticais
    doc.line(60, 10, 60, 35);
    doc.line(pageWidth - 65, 10, pageWidth - 65, 35);
    
    // Logo (DMN ESTALEIRO)
    try {
      doc.addImage(dmnLogoAsset.url, "PNG", 15, 12, 40, 20);
    } catch (e) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("DMN", 35, 20, { align: "center" });
      doc.setFontSize(8);
      doc.text("ESTALEIRO", 35, 25, { align: "center" });
    }
    
    // Título Central
    doc.setFont("times", "bold");
    doc.setFontSize(18); // Aumentado conforme solicitado
    doc.text("Quadro Estatístico de Acidentes de Trabalho", (pageWidth / 2) - 2, 25, { align: "center" });
    
    // Removida a barra cinza e o texto de dentro do cabeçalho
    
    // Bloco Direita (Código/Revisão)
    doc.setFont("helvetica", "bold"); // Volta para helvetica para o restante
    doc.setFontSize(8);
    const rightX = pageWidth - 63;
    doc.text("CÓG.:", rightX, 16);
    doc.text("REVISÃO:", rightX, 21);
    doc.text("DATA:", rightX, 26);
    doc.text("PÁG.:", rightX, 31);
    
    doc.setFont("helvetica", "normal");
    doc.text("FOR-SEG 09", rightX + 16, 16);
    doc.text("00", rightX + 16, 21);
    doc.text("30/08/2025", rightX + 16, 26);
    doc.text("01/01", rightX + 16, 31);
  };

  header();

  // Seção de Informações da Empresa (Grid Compacto com Moldura sutil)
  doc.setFontSize(9);
  
  // Moldura das informações da empresa
  doc.setLineWidth(0.2);
  doc.rect(10, 40, pageWidth - 20, 26);
  doc.line(10, 46.5, pageWidth - 10, 46.5);
  doc.line(10, 53, pageWidth - 10, 53);
  doc.line(10, 59.5, pageWidth - 10, 59.5);

  // Colunas internas
  doc.line(115, 46.5, 115, 53); // Entre Endereço e Bairro
  doc.line(pageWidth - 65, 46.5, pageWidth - 65, 59.5); // Coluna do CEP e DATA
  doc.line(65, 53, 65, 59.5); // Entre CNAE e Grau de Risco

  // Linha 1: Empresa
  doc.setFont("helvetica", "bold");
  doc.text("Empresa:", 12, 44);
  doc.setFont("helvetica", "normal");
  doc.text(opts.empresa || "DMN ESTALEIRO DA AMAZONIA LTDA", 30, 44);
  
  // Linha 2: CNPJ
  doc.setFont("helvetica", "bold");
  doc.text("CNPJ:", 12, 50.5);
  doc.setFont("helvetica", "normal");
  doc.text(opts.cnpj || "13.378.697/0001-80", 30, 50.5);

  // Linha 3: Endereço / Bairro / CEP
  doc.setFont("helvetica", "bold");
  doc.text("Endereço:", 12, 57);
  doc.setFont("helvetica", "normal");
  doc.text(opts.endereco || "ESTRADA DO ALEIXO, 2000", 30, 57);
  
  doc.setFont("helvetica", "bold");
  doc.text("Bairro:", 117, 57);
  doc.setFont("helvetica", "normal");
  doc.text(opts.bairro || "COLÔNIA OLIVEIRA MACHADO", 130, 57);
  
  doc.setFont("helvetica", "bold");
  doc.text("CEP:", pageWidth - 63, 57);
  doc.setFont("helvetica", "normal");
  doc.text(opts.cep || "69070-610", pageWidth - 48, 57);

  // Linha 4: CNAE / Grau de Risco / Data
  doc.setFont("helvetica", "bold");
  doc.text("CNAE:", 12, 63.5);
  doc.setFont("helvetica", "normal");
  doc.text(opts.cnae || "30.11-3-01", 30, 63.5);
  
  doc.setFont("helvetica", "bold");
  doc.text("Grau de risco:", 67, 63.5);
  doc.setFont("helvetica", "normal");
  doc.text(opts.grau_risco || "03", 92, 63.5);
  
  doc.setFont("helvetica", "bold");
  doc.text("DATA:", pageWidth - 63, 63.5);
  doc.setFont("helvetica", "normal");
  doc.text(new Date().toLocaleDateString("pt-BR"), pageWidth - 48, 63.5);

  // Tabela de Dados
  const tableRows = MESES.map((m, i) => {
    const acidsMes = opts.acidentes.filter(a => {
      const d = new Date(a.data_acidente);
      return d.getFullYear() === opts.ano && d.getMonth() === i;
    });
    
    const hhtData = opts.hht.find(h => h.ano === opts.ano && h.mes === i + 1);
    const hhtVal = Number(hhtData?.hht || 0);
    const empMedio = Number(hhtData?.empregados_medio || 0);
    
    const comAfast = acidsMes.filter(a => a.tipo === "COM_AFASTAMENTO" || a.tipo === "FATAL");
    const comAfastLeve = comAfast.filter(a => (Number(a.dias_perdidos || 0) + Number(a.dias_debitados || 0)) <= 15).length;
    const comAfastGrave = comAfast.filter(a => (Number(a.dias_perdidos || 0) + Number(a.dias_debitados || 0)) > 15).length;
    const semAfast = acidsMes.filter(a => a.tipo === "SEM_AFASTAMENTO").length;
    const obitos = acidsMes.filter(a => a.tipo === "FATAL").length;
    const totalAbs = acidsMes.length;
    
    const dp = acidsMes.reduce((s, a) => s + (Number(a.dias_perdidos || 0) + Number(a.dias_debitados || 0)), 0);
    
    const tf = hhtVal > 0 ? ((comAfast.length * 1_000_000) / hhtVal).toFixed(2) : "0,00";
    const indiceRel = empMedio > 0 ? (totalAbs / empMedio).toFixed(2) : "0,00";

    return [
      m,
      empMedio || "",
      hhtVal > 0 ? hhtVal.toLocaleString("pt-BR") : "",
      totalAbs,
      comAfastLeve,
      comAfastGrave,
      semAfast,
      indiceRel,
      dp,
      tf,
      obitos
    ];
  });

  // Totais
  const hhtAno = opts.hht.filter(h => h.ano === opts.ano);
  const totEmp = hhtAno.length > 0 ? Math.round(hhtAno.reduce((s, h) => s + Number(h.empregados_medio || 0), 0) / hhtAno.length) : 0;
  const totHHT = hhtAno.reduce((s, h) => s + Number(h.hht || 0), 0);
  const acidsAno = opts.acidentes.filter(a => new Date(a.data_acidente).getFullYear() === opts.ano);
  const totAbs = acidsAno.length;
  const totCLeve = acidsAno.filter(a => (a.tipo === "COM_AFASTAMENTO" || a.tipo === "FATAL") && (Number(a.dias_perdidos || 0) + Number(a.dias_debitados || 0)) <= 15).length;
  const totCGrave = acidsAno.filter(a => (a.tipo === "COM_AFASTAMENTO" || a.tipo === "FATAL") && (Number(a.dias_perdidos || 0) + Number(a.dias_debitados || 0)) > 15).length;
  const totS = acidsAno.filter(a => a.tipo === "SEM_AFASTAMENTO").length;
  const totDP = acidsAno.reduce((s, a) => s + (Number(a.dias_perdidos || 0) + Number(a.dias_debitados || 0)), 0);
  const totObitos = acidsAno.filter(a => a.tipo === "FATAL").length;
  
  const totTF = totHHT > 0 ? ((acidsAno.filter(a => a.tipo === "COM_AFASTAMENTO" || a.tipo === "FATAL").length * 1_000_000) / totHHT).toFixed(2) : "0,00";
  const totIndice = totEmp > 0 ? (totAbs / totEmp).toFixed(2) : "0,00";

  autoTable(doc, {
    startY: 70,
    margin: { left: 10, right: 10 },
    head: [[
      "Mês",
      "Número de empregados",
      "HHT",
      "Nº Absoluto",
      "Nº Absoluto com afastamento <= 15 dias",
      "Nº Absoluto com afastamento > 15 dias",
      "Nº Absoluto sem Afastamento",
      "Índice Relativo total de empregados",
      "Dias / homens Perdidos",
      "Taxa de frequência",
      "Óbitos"
    ]],
    body: [
      ...tableRows,
      [
        { content: "Total", styles: { fontStyle: "bold", fillColor: [200, 200, 200] } },
        { content: totEmp || "", styles: { fontStyle: "bold", fillColor: [200, 200, 200] } },
        { content: totHHT > 0 ? totHHT.toLocaleString("pt-BR") : "", styles: { fontStyle: "bold", fillColor: [200, 200, 200] } },
        { content: totAbs, styles: { fontStyle: "bold", fillColor: [200, 200, 200] } },
        { content: totCLeve, styles: { fontStyle: "bold", fillColor: [200, 200, 200] } },
        { content: totCGrave, styles: { fontStyle: "bold", fillColor: [200, 200, 200] } },
        { content: totS, styles: { fontStyle: "bold", fillColor: [200, 200, 200] } },
        { content: totIndice, styles: { fontStyle: "bold", fillColor: [200, 200, 200] } },
        { content: totDP, styles: { fontStyle: "bold", fillColor: [200, 200, 200] } },
        { content: totTF, styles: { fontStyle: "bold", fillColor: [200, 200, 200] } },
        { content: totObitos, styles: { fontStyle: "bold", fillColor: [200, 200, 200] } },
      ]
    ],
    headStyles: { 
      fillColor: [230, 230, 230], 
      textColor: 0, 
      fontSize: 7, 
      halign: "center", 
      valign: "middle",
      lineWidth: 0.2, 
      lineColor: 0,
      fontStyle: "bold",
      minCellHeight: 12
    },
    bodyStyles: { 
      fontSize: 8, 
      halign: "center", 
      valign: "middle",
      lineWidth: 0.2, 
      lineColor: 0,
      minCellHeight: 8
    },
    theme: "grid",
    styles: { overflow: 'linebreak', cellPadding: 1, minCellWidth: 10 }
  });

  // Assinatura

  // @ts-expect-error lastAutoTable injected by plugin
  const finalY = doc.lastAutoTable.finalY + 12;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("RESPONSÁVEL:", 10, finalY);
  doc.line(38, finalY, 130, finalY);

  doc.save(`FOR-SEG-09_Quadro-Estatistico_${opts.ano}.pdf`);
}

/** FOR-SEG 10 — Dias sem Acidente */
export function gerarForSeg10(opts: {
  empresas: { id: string; name: string }[];
  dias: (DiasRow & { company_id: string })[];
}) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  const header = () => {
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.rect(10, 10, pageWidth - 20, 25);
    doc.line(60, 10, 60, 35);
    doc.line(pageWidth - 65, 10, pageWidth - 65, 35);
    
    try {
      doc.addImage(dmnLogoAsset.url, "PNG", 15, 12, 40, 20);
    } catch (e) {}
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Controle de Dias sem Acidente de Trabalho", (pageWidth / 2) - 2, 23, { align: "center" });
    
    doc.setFontSize(8);
    const rightX = pageWidth - 63;
    doc.text("CÓG.:", rightX, 16);
    doc.text("REVISÃO:", rightX, 21);
    doc.text("DATA:", rightX, 26);
    doc.text("PÁG.:", rightX, 31);
    
    doc.setFont("helvetica", "normal");
    doc.text("FOR-SEG 10", rightX + 15, 16);
    doc.text("00", rightX + 15, 21);
    doc.text(new Date().toLocaleDateString("pt-BR"), rightX + 15, 26);
    doc.text("01/01", rightX + 15, 31);
  };

  header();

  const rows = opts.empresas.map(emp => {
    const d = opts.dias.find(x => x.company_id === emp.id);
    return [
      emp.name,
      d?.dias_sem_com_afast ?? "—",
      d?.ultimo_acidente_com_afast ? new Date(d.ultimo_acidente_com_afast).toLocaleDateString("pt-BR") : "Nenhum",
      d?.recorde_com_afast ?? 0,
      d?.dias_sem_registravel ?? "—",
      d?.ultimo_acidente_registravel ? new Date(d.ultimo_acidente_registravel).toLocaleDateString("pt-BR") : "Nenhum",
    ];
  });

  autoTable(doc, {
    startY: 40,
    head: [["Empresa / Unidade","Dias s/ Afast.","Último c/ Afast.","Recorde","Dias s/ Registr.","Último Registr."]],
    body: rows.length ? rows : [["Sem empresas cadastradas","—","—","—","—","—"]],
    headStyles: { fillColor: [240, 240, 240], textColor: 0, fontSize: 9, fontStyle: "bold", halign: "center" },
    bodyStyles: { fontSize: 8, halign: "center" },
    theme: "grid",
  });

  // @ts-expect-error lastAutoTable injected by plugin
  const y = (doc.lastAutoTable?.finalY ?? 100) + 12;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Metodologia (NBR 14280):", 14, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const linhas = [
    "• Contador zera somente em acidente COM AFASTAMENTO ou FATAL.",
    "• Recorde = maior intervalo histórico sem acidente registrável da unidade.",
    "• Atualização automática a cada novo registro lançado no sistema.",
  ];
  linhas.forEach((l, i) => doc.text(l, 14, y + 6 + i * 5));

  // Assinaturas
  doc.line(20, y + 60, 90, y + 60);
  doc.text("Técnico de Segurança", 55, y + 66, { align: "center" });
  doc.line(115, y + 60, 185, y + 60);
  doc.text("SESMT - Estaleiro DMN", 150, y + 66, { align: "center" });

  footer(doc);
  doc.save(`FOR-SEG-10_Dias-sem-Acidente_${new Date().toISOString().slice(0,10)}.pdf`);
}
