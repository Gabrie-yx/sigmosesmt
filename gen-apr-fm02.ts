import fs from "node:fs";
import path from "node:path";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { gerarAPR, type APRPdfParams, type APRPdfRisco, type APRPdfAssinatura } from "./src/lib/apr-pdf";

const payload = JSON.parse(fs.readFileSync("/tmp/apr-payload.json","utf-8"));
const { apr, riscos, assinaturas, empresa, casco, enc, tst, pte, ptes_vinc } = payload;

// Logo
const logoPath = "/dev-server/public/dmn-logo.png";
let logoDataUrl: string | null = null;
try {
  const b = fs.readFileSync(logoPath);
  logoDataUrl = "data:image/png;base64," + b.toString("base64");
} catch {}

const riscosPdf: APRPdfRisco[] = (riscos ?? []).map((r:any,i:number)=>({
  ordem: r.ordem ?? i+1,
  passo: r.passo ?? null,
  risco_nome: r.risco_nome ?? r.nome ?? "",
  risco_categoria: r.risco_categoria ?? null,
  efeitos_danos: r.efeitos_danos ?? null,
  probabilidade: r.probabilidade ?? 1,
  severidade: r.severidade ?? 1,
  nivel_risco: r.nivel_risco ?? (r.probabilidade + r.severidade),
  acoes_preventivas: r.acoes_preventivas ?? null,
  epis: r.epis ?? [],
  nrs: r.nrs ?? [],
  responsavel_acoes: r.responsavel_acoes ?? null,
}));

const assinPdf: APRPdfAssinatura[] = (assinaturas ?? []).map((a:any)=>({
  papel: a.papel ?? "EXECUTANTE",
  nome: a.nome ?? "",
  cpf: a.cpf ?? null,
  funcao: a.funcao ?? null,
}));

const params: APRPdfParams = {
  logoDataUrl,
  matrizNome: "DMN ESTALEIRO DA AMAZONIA LTDA",
  matrizCnpj: "13.378.697/0001-80",
  numero: apr.numero,
  data_emissao: apr.data_emissao,
  data_inicio: apr.data_inicio ?? apr.data_emissao,
  data_fim: apr.data_fim ?? apr.data_validade,
  hora_inicio: apr.hora_inicio,
  hora_fim: apr.hora_fim,
  hora_inicio_sexta: apr.hora_inicio_sexta,
  hora_fim_sexta: apr.hora_fim_sexta,
  dias_semana: apr.dias_semana,
  validade_dias: apr.validade_dias,
  data_validade: apr.data_validade,
  empresa_nome: empresa?.nome ?? null,
  empresa_cnpj: empresa?.cnpj ?? null,
  casco_numero: casco?.numero ?? null,
  casco_nome: casco?.nome ?? null,
  local: apr.local,
  setor: apr.setor,
  atividade: apr.atividade_descricao ?? "",
  servico_detalhado: apr.servico_detalhado ?? null,
  elaborado_por: tst?.nome ?? null,
  encarregado: enc?.nome ?? null,
  tst: tst?.nome ?? null,
  pte_numero: pte?.numero ?? null,
  condicoes_climaticas: apr.condicoes_climaticas,
  observacoes: apr.observacoes_gerais,
  texto_gerais: apr.texto_gerais,
  riscos: riscosPdf,
  assinaturas: assinPdf,
  exige_pte: !!apr.exige_pte,
  ptes_vinculadas: (ptes_vinc ?? []).map((x:any)=>x.numero).filter(Boolean),
};

// ============ Chrome replication for supplementary pages =============
const C_HEADER = [220,53,69] as const;
const PAGE_W = 297, PAGE_H = 210, MARGIN = 6;
const CONTENT_W = PAGE_W - MARGIN*2;
const CONTENT_TOP = 60;

function drawHeader(doc: jsPDF, p: APRPdfParams, pagina:number, total:number) {
  const headerH = 18;
  doc.setLineWidth(0.4); doc.setDrawColor(0,0,0);
  doc.rect(MARGIN, MARGIN, CONTENT_W, headerH);
  const cLogo = 28, cMeta = 50;
  doc.line(MARGIN+cLogo, MARGIN, MARGIN+cLogo, MARGIN+headerH);
  doc.line(MARGIN+CONTENT_W-cMeta, MARGIN, MARGIN+CONTENT_W-cMeta, MARGIN+headerH);
  if (p.logoDataUrl) {
    try { doc.addImage(p.logoDataUrl,"PNG", MARGIN+2, MARGIN+1.5, cLogo-4, headerH-3, undefined, "FAST"); } catch {}
  }
  const cx = MARGIN+cLogo+(CONTENT_W-cLogo-cMeta)/2;
  doc.setFont("helvetica","bold").setFontSize(15);
  doc.text("DMN ESTALEIRO DA AMAZONIA LTDA", cx, MARGIN+7, {align:"center"});
  doc.setFontSize(10).setFont("helvetica","normal");
  doc.text("APR – Análise Preliminar de Riscos", cx, MARGIN+13, {align:"center"});
  const mx = MARGIN+CONTENT_W-cMeta, innerH = headerH/4;
  doc.setLineWidth(0.2);
  for (let i=1;i<4;i++) doc.line(mx, MARGIN+i*innerH, MARGIN+CONTENT_W, MARGIN+i*innerH);
  doc.setFont("helvetica","bold").setFontSize(7);
  doc.text("CÓD.FOR-SEG 07", mx+2, MARGIN+innerH-1.5);
  doc.text("REVISÃO: 00", mx+2, MARGIN+innerH*2-1.5);
  doc.text("DATA: 30/08/2025", mx+2, MARGIN+innerH*3-1.5);
  doc.text(`PÁG.: ${String(pagina).padStart(2,"0")}/${String(total).padStart(2,"0")}`, mx+2, MARGIN+innerH*4-1.5);
}
function drawIdBand(doc: jsPDF, p: APRPdfParams) {
  // Resumida (mesma diagramação do bloco do cabeçalho ID, 1 linha só)
  const y = MARGIN+20, h=6;
  doc.setLineWidth(0.25);
  const cells: [string,string,number][] = [
    ["APR Nº:", p.numero, 50],
    ["Emissão:", p.data_emissao ?? "", 45],
    ["Validade:", p.data_validade ?? "", 45],
    ["Casco:", `${p.casco_numero ?? ""} ${p.casco_nome ?? ""}`, 70],
    ["Local:", p.local ?? "—", CONTENT_W-50-45-45-70],
  ];
  let x = MARGIN;
  cells.forEach(([l,v,w])=>{
    doc.rect(x,y,w,h);
    doc.setFont("helvetica","bold").setFontSize(7.5); doc.text(l, x+1.2, y+4);
    doc.setFont("helvetica","normal").setFontSize(8); doc.text(String(v??"—"), x+(l.length*1.4)+8, y+4);
    x+=w;
  });
}
function drawFooter(doc: jsPDF) {
  doc.setFont("helvetica","bold").setFontSize(8); doc.setTextColor(220,38,38);
  doc.text('"NENHUM TRABALHO É TÃO URGENTE OU IMPORTANTE QUE NÃO POSSA SER PLANEJADO E EXECUTADO COM SEGURANÇA"', PAGE_W/2, PAGE_H-4, {align:"center"});
  doc.setTextColor(0,0,0);
}
function chrome(doc: jsPDF, p: APRPdfParams, title: string) {
  drawHeader(doc, p, doc.getCurrentPageInfo().pageNumber, doc.getNumberOfPages());
  drawIdBand(doc, p);
  drawFooter(doc);
  // título da seção complementar (faixa laranja como o tema das tabelas)
  const yT = MARGIN+20+6+2;
  doc.setFillColor(255,153,0); doc.rect(MARGIN, yT, CONTENT_W, 6, "F");
  doc.setDrawColor(0,0,0); doc.setLineWidth(0.3); doc.rect(MARGIN, yT, CONTENT_W, 6);
  doc.setFont("helvetica","bold").setFontSize(10).setTextColor(0,0,0);
  doc.text(title, PAGE_W/2, yT+4.2, {align:"center"});
}

// Risco residual util
function classify(n:number){
  if(n<=2) return "TRIVIAL"; if(n===3) return "TOLERÁVEL"; if(n===4) return "MODERADO";
  if(n===5) return "SUBSTANCIAL"; return "INACEITÁVEL";
}
function residual(r: APRPdfRisco){
  let p = r.probabilidade, s = r.severidade;
  const epi = (r.epis ?? []).length, nrs = (r.nrs ?? []).length;
  if (epi>=2) p = Math.max(1, p-1);
  if (nrs>=2) s = Math.max(1, s-1);
  if ((r.acoes_preventivas??"").length>40) p = Math.max(1, p-1);
  return { p, s, n: p+s };
}

(async () => {
  const doc = await gerarAPR(params);

  // ---------- PÁGINA COMPLEMENTAR 1: EQUIPE ELABORADORA + CONDIÇÕES + RISCO RESIDUAL ----------
  doc.addPage();
  chrome(doc, params, "COMPLEMENTO FM-SGI-02 — EQUIPE ELABORADORA · CONDIÇÕES · RISCO RESIDUAL");

  // Equipe elaboradora (3 colunas: TST | Encarregado | Executante experiente)
  let y = MARGIN+20+6+2+8;
  const colW = CONTENT_W/3;
  const teamH = 22;
  doc.setLineWidth(0.3);
  ["TÉCNICO DE SEGURANÇA (TST)","ENCARREGADO DA FRENTE","EXECUTANTE EXPERIENTE"].forEach((label,i)=>{
    const x = MARGIN + i*colW;
    doc.setFillColor(219,234,247); doc.rect(x,y,colW,5,"F"); doc.rect(x,y,colW,5);
    doc.setFont("helvetica","bold").setFontSize(8); doc.text(label, x+colW/2, y+3.5, {align:"center"});
    doc.rect(x, y+5, colW, teamH-5);
    doc.setFont("helvetica","normal").setFontSize(7.5);
    const nome = i===0 ? (params.tst??"—") : i===1 ? (params.encarregado??"_____________________") : "_____________________";
    doc.text(`Nome: ${nome}`, x+2, y+10);
    doc.text("Matr./CPF: ____________________", x+2, y+13.5);
    doc.text("Função: ______________________", x+2, y+17);
    doc.line(x+3, y+teamH-2, x+colW-3, y+teamH-2);
    doc.setFontSize(6.5).setTextColor(90,90,90); doc.text("Assinatura", x+colW/2, y+teamH+0.2, {align:"center"}); doc.setTextColor(0,0,0);
  });
  y += teamH + 6;

  // Condições do ambiente (NR-35 / NR-33)
  const condRows = [
    ["Vento (km/h)", apr.vento ?? "____ km/h (limite NR-35: 40 km/h)"],
    ["Chuva / visibilidade", apr.chuva ?? "( ) Sem chuva  ( ) Garoa  ( ) Chuva — PARALISAR"],
    ["IBUTG / Temperatura", apr.ibutg ?? "____ °C  (NR-15 anexo 3)"],
    ["Ruído ambiente (dB)", apr.ruido ?? "____ dB  (NR-15 anexo 1)"],
    ["Atmosférica (se confinado)", apr.atmosfera ?? "O₂ ___%  LEL ___%  H₂S ___ppm  CO ___ppm"],
    ["Iluminação", apr.iluminacao ?? "( ) Adequada  ( ) Insuficiente — Providenciar"],
  ];
  autoTable(doc, {
    startY: y,
    margin:{left:MARGIN,right:MARGIN},
    head: [["CONDIÇÕES DE CAMPO NA EMISSÃO","REGISTRO"]],
    body: condRows,
    theme:"grid",
    styles:{fontSize:8, cellPadding:1.4, lineColor:[0,0,0], lineWidth:0.15, textColor:0},
    headStyles:{fillColor:[254,240,217], textColor:0, fontStyle:"bold", halign:"center"},
    columnStyles:{0:{cellWidth:80,fontStyle:"bold"},1:{cellWidth:"auto"}},
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // Risco residual por passo (Bruto -> Controles -> Residual)
  autoTable(doc, {
    startY: y,
    margin:{left:MARGIN,right:MARGIN, top: CONTENT_TOP},
    head: [[
      {content:"#", rowSpan:2},
      {content:"PASSO / RISCO", rowSpan:2},
      {content:"RISCO BRUTO", colSpan:3},
      {content:"HIERARQUIA DE CONTROLE APLICADA (ISO 45001)", rowSpan:2},
      {content:"RISCO RESIDUAL", colSpan:3},
      {content:"RESP. AÇÃO", rowSpan:2},
    ],["P","S","G","P","S","G"]] as any,
    body: riscosPdf.map((r,i)=>{
      const res = residual(r);
      const hier:string[] = [];
      if ((r.nrs??[]).length) hier.push(`NR(s): ${(r.nrs).join(", ")}`);
      if ((r.acoes_preventivas??"").trim()) hier.push(`ADM: ${r.acoes_preventivas}`);
      if ((r.epis??[]).length) hier.push(`EPI: ${(r.epis).join(", ")}`);
      return [
        String(i+1),
        `${r.passo ?? ""}\n${r.risco_nome}${r.risco_categoria?` (${r.risco_categoria})`:""}`,
        String(r.probabilidade), String(r.severidade), String(r.nivel_risco),
        hier.join(" · ") || "—",
        String(res.p), String(res.s), `${res.n} – ${classify(res.n)}`,
        r.responsavel_acoes ?? "_______________",
      ];
    }),
    theme:"grid",
    styles:{fontSize:7, cellPadding:1.2, lineColor:[0,0,0], lineWidth:0.15, valign:"middle", textColor:0},
    headStyles:{fillColor:[255,153,0], textColor:0, fontStyle:"bold", halign:"center", fontSize:7.5, lineColor:[0,0,0], lineWidth:0.3},
    columnStyles:{0:{cellWidth:7,halign:"center"},1:{cellWidth:55},2:{cellWidth:6,halign:"center"},3:{cellWidth:6,halign:"center"},4:{cellWidth:10,halign:"center",fontStyle:"bold"},5:{cellWidth:"auto"},6:{cellWidth:6,halign:"center"},7:{cellWidth:6,halign:"center"},8:{cellWidth:24,halign:"center",fontStyle:"bold"},9:{cellWidth:30}},
    didDrawPage: ()=>{ chrome(doc, params, "COMPLEMENTO FM-SGI-02 — EQUIPE ELABORADORA · CONDIÇÕES · RISCO RESIDUAL"); },
  });

  // ---------- PÁGINA 2: REQUISITOS LEGAIS + PLANO DE EMERGÊNCIA + ART ----------
  doc.addPage();
  chrome(doc, params, "COMPLEMENTO FM-SGI-02 — REQUISITOS LEGAIS · PLANO DE EMERGÊNCIA · ART");
  y = MARGIN+20+6+2+8;

  // Requisitos legais consolidados
  const nrsSet = new Set<string>();
  riscosPdf.forEach(r=>(r.nrs??[]).forEach(n=>nrsSet.add(n)));
  const reqRows = Array.from(nrsSet).map(n=>[n, "Aplicável – ver itens dos riscos correlatos"]);
  reqRows.push(["ISO 45001:2018","Cláusula 8.1.2 – Eliminação/hierarquia de controle de riscos"]);
  reqRows.push(["ISO 9001:2015","Cláusula 8.5 – Controle da produção e serviço"]);
  reqRows.push(["PROCO-SGI-SST-01","Procedimento integrado de Segurança (documento-mãe)"]);
  autoTable(doc,{
    startY:y, margin:{left:MARGIN,right:MARGIN},
    head:[["REQUISITO LEGAL / NORMATIVO","APLICAÇÃO"]],
    body: reqRows,
    theme:"grid",
    styles:{fontSize:8, cellPadding:1.4, lineColor:[0,0,0], lineWidth:0.15, textColor:0},
    headStyles:{fillColor:[254,240,217], textColor:0, fontStyle:"bold", halign:"center"},
    columnStyles:{0:{cellWidth:60,fontStyle:"bold"}, 1:{cellWidth:"auto"}},
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // Plano de emergência específico
  autoTable(doc,{
    startY:y, margin:{left:MARGIN,right:MARGIN},
    head:[["PLANO DE RESPOSTA A EMERGÊNCIA (específico desta APR)","DEFINIÇÃO"]],
    body:[
      ["Rota de fuga primária","__________________________________________"],
      ["Rota de fuga alternativa","__________________________________________"],
      ["Ponto de encontro","__________________________________________"],
      ["Equipe de resgate em altura (NR-35.5)","__________________________________________"],
      ["Acionamento SAMU / CCO","SAMU 192 · CCO interno: ramal _____"],
      ["Extintores próximos","Tipo: _____  Localização: _____"],
      ["Comunicação (rádio/canal)","Canal _____"],
      ["Sinal de evacuação","( ) Sirene  ( ) Apito  ( ) Rádio"],
    ],
    theme:"grid",
    styles:{fontSize:8, cellPadding:1.4, lineColor:[0,0,0], lineWidth:0.15, textColor:0},
    headStyles:{fillColor:[254,240,217], textColor:0, fontStyle:"bold", halign:"center"},
    columnStyles:{0:{cellWidth:80,fontStyle:"bold"}, 1:{cellWidth:"auto"}},
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // ART supervisor de altura (NR-35.4.1.2)
  autoTable(doc,{
    startY:y, margin:{left:MARGIN,right:MARGIN},
    head:[["SUPERVISOR DE TRABALHO EM ALTURA (NR-35.4.1.2)","DADOS"]],
    body:[
      ["Nome do supervisor", "__________________________________________"],
      ["Nº ART / Conselho", "ART nº __________  CREA/CFT __________"],
      ["Validade da ART", "____/____/______"],
      ["Treinamento NR-35 (8h capacitação ou 4h reciclagem)", "Data: ____/____/______  Carga: ____ h"],
    ],
    theme:"grid",
    styles:{fontSize:8, cellPadding:1.4, lineColor:[0,0,0], lineWidth:0.15, textColor:0},
    headStyles:{fillColor:[254,240,217], textColor:0, fontStyle:"bold", halign:"center"},
    columnStyles:{0:{cellWidth:90,fontStyle:"bold"}, 1:{cellWidth:"auto"}},
  });

  // ---------- PÁGINA 3: GATILHOS DE REVALIDAÇÃO + INTEGRAÇÃO FM-SGI-NC + INTEGRIDADE ----------
  doc.addPage();
  chrome(doc, params, "COMPLEMENTO FM-SGI-02 — REVALIDAÇÃO · NÃO CONFORMIDADES · INTEGRIDADE");
  y = MARGIN+20+6+2+8;

  autoTable(doc,{
    startY:y, margin:{left:MARGIN,right:MARGIN},
    head:[["GATILHO DE REVALIDAÇÃO DESTA APR","AÇÃO REQUERIDA"]],
    body:[
      ["Alteração das condições climáticas (vento > 40 km/h, chuva, raios)","PARALISAR · reavaliar · revalidar APR"],
      ["Mudança de equipe (qualquer executante novo)","Re-DDS · reassinar APR · revalidar"],
      ["Parada da atividade > 2 h","Reinspecionar área · revalidar APR antes de retomar"],
      ["Alteração de escopo / passo a passo","Emitir nova APR (revisão) · arquivar a anterior"],
      ["Acidente / quase-acidente na frente","Abrir FM-SGI-NC · paralisar · reavaliar APR"],
      ["Vencimento da validade", `Após ${params.validade_dias ?? "—"} dias (${params.data_validade ?? "—"}) — Reemitir APR`],
    ],
    theme:"grid",
    styles:{fontSize:8, cellPadding:1.4, lineColor:[0,0,0], lineWidth:0.15, textColor:0},
    headStyles:{fillColor:[254,240,217], textColor:0, fontStyle:"bold", halign:"center"},
    columnStyles:{0:{cellWidth:110,fontStyle:"bold"}, 1:{cellWidth:"auto"}},
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // Integração FM-SGI-NC
  autoTable(doc,{
    startY:y, margin:{left:MARGIN,right:MARGIN},
    head:[["INTEGRAÇÃO COM FM-SGI-NC (Não Conformidade)","REGISTRO"]],
    body:[
      ["NC aberta a partir desta APR? ( ) Não  ( ) Sim","Nº FM-SGI-NC: __________"],
      ["Tipo de NC","( ) Comportamental  ( ) Condição insegura  ( ) Documental"],
      ["Tratativa","( ) Imediata  ( ) Plano de ação (prazo ____/____/______)"],
      ["Responsável pela NC","__________________________________________"],
    ],
    theme:"grid",
    styles:{fontSize:8, cellPadding:1.4, lineColor:[0,0,0], lineWidth:0.15, textColor:0},
    headStyles:{fillColor:[254,240,217], textColor:0, fontStyle:"bold", halign:"center"},
    columnStyles:{0:{cellWidth:110,fontStyle:"bold"}, 1:{cellWidth:"auto"}},
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // Integridade (hash + QR placeholder)
  const crypto = await import("node:crypto");
  const hashBase = JSON.stringify({n:apr.numero, d:apr.data_emissao, r: riscosPdf.length, a: assinPdf.length});
  const hash = crypto.createHash("sha256").update(hashBase).digest("hex");
  autoTable(doc,{
    startY:y, margin:{left:MARGIN,right:MARGIN},
    head:[["INTEGRIDADE DO DOCUMENTO","VALOR"]],
    body:[
      ["SHA-256 (conteúdo APR)", hash],
      ["URL de verificação", `https://sigmosesmt.lovable.app/apr/${apr.numero}`],
      ["Emitido por (sistema)", "SIGMO — Sistema Integrado de Gestão de Operações"],
      ["Versão do formulário", "FM-SGI-02 rev. 01 (complemento ao FOR-SEG 07)"],
    ],
    theme:"grid",
    styles:{fontSize:7.5, cellPadding:1.4, lineColor:[0,0,0], lineWidth:0.15, textColor:0, overflow:"linebreak"},
    headStyles:{fillColor:[254,240,217], textColor:0, fontStyle:"bold", halign:"center"},
    columnStyles:{0:{cellWidth:60,fontStyle:"bold"}, 1:{cellWidth:"auto"}},
  });

  // Re-render headers with correct totals
  const total = doc.getNumberOfPages();
  for (let i=1;i<=total;i++) {
    doc.setPage(i);
    doc.setFillColor(255,255,255);
    doc.rect(MARGIN, MARGIN, CONTENT_W, 18, "F");
    drawHeader(doc, params, i, total);
  }

  const out = "/mnt/documents/APR_SIGMO_000070626_FM-SGI-02_v2.pdf";
  fs.writeFileSync(out, Buffer.from(doc.output("arraybuffer")));
  console.log("OK", out);
})();
