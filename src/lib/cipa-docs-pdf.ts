/**
 * Documentos do processo da CIPA (NR-05) — modelo DMN.
 * Todos em A4 retrato (exceto cédulas), com timbre DMN e campos de assinatura.
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import dmnLogo from "@/assets/dmn-logo.png";
import { EMPRESA_INFO } from "./empresa-info";
import { FAIXAS, QUADRO } from "./cipa-dimensionamento";
import { type Etapa, etapa, diaSemana } from "./cipa-calendario-eleitoral";

export type DocsCfg = {
  posse?: string;
  overrides?: Record<string, string>;
  rep_empresa_nome?: string;
  rep_empresa_cargo?: string;
  presidente_cipa_nome?: string;
  sindicato_nome?: string;
  local_inscricao?: string;
  horario_inicio?: string;
  horario_fim?: string;
  local_votacao?: string;
  comissao?: { employee_id: string; funcao: "PRESIDENTE" | "SECRETARIO" | "MEMBRO" }[];
  apuracao_hora_inicio?: string;
  apuracao_hora_fim?: string;
  apuracao_local?: string;
  votos_brancos?: number | null;
  votos_nulos?: number | null;
  reunioes_horario?: string;
  treinamento_periodo?: string;
  mural_data?: string;
  mural_local?: string;
  mural_foto_path?: string;
  protocolo_data?: string;
  protocolo_path?: string;
};

export type Pessoa = { nome: string; matricula?: string | null; setor?: string | null; funcao?: string };
export type Membro = Pessoa & { representacao: string; papel: string };
export type Cand = Pessoa & { numero: number; votos: number | null };

export type DocsCtx = {
  gestao: { gestao: string; data_inicio: string; data_fim: string; grau_risco: number | null; num_empregados: number | null;
    efetivos_empregados: number | null; suplentes_empregados: number | null; efetivos_empregador: number | null; suplentes_empregador: number | null };
  cal: Etapa[];
  cfg: DocsCfg;
  comissao: Pessoa[];
  candidatos: Cand[];
  membros: Membro[];
  eleitores: Pessoa[];
  eleitoresAptos?: number | null;
  votantes?: number | null;
  cargaHoras: number;
  qr?: string | null;
};

const E = EMPRESA_INFO;
const W = 210, M = 18;
const RED: [number, number, number] = [150, 20, 30];

export const fmtBR = (iso?: string | null) => (iso ? new Date(iso.slice(0, 10) + "T00:00:00").toLocaleDateString("pt-BR") : "____/____/______");
const extenso = (iso?: string | null) => (iso ? new Date(iso.slice(0, 10) + "T00:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }) : "____ de __________ de ______");
const NORMA = "Norma Regulamentadora NR-05, aprovada pela Portaria MTP nº 4.219, de 20 de dezembro de 2022";

function novo(orient: "p" | "l" = "p") {
  return new jsPDF({ unit: "mm", format: "a4", orientation: orient });
}

function timbre(doc: jsPDF, titulo: string, sub?: string) {
  const w = doc.internal.pageSize.getWidth();
  try { doc.addImage(dmnLogo as unknown as string, "PNG", M, 10, 26, 15, undefined, "FAST"); } catch { /* sem logo */ }
  doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(20, 20, 20);
  doc.text(E.razao_social, M + 30, 15);
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(90, 90, 90);
  doc.text(`CNPJ ${E.cnpj} · ${E.endereco}`, M + 30, 19.5);
  doc.text(E.cidade_uf_cep, M + 30, 23.5);
  doc.setDrawColor(...RED).setLineWidth(0.8).line(M, 29, w - M, 29);
  doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(...RED);
  const lines = doc.splitTextToSize(titulo, w - 2 * M);
  doc.text(lines, w / 2, 39, { align: "center" });
  let y = 39 + lines.length * 6;
  if (sub) {
    doc.setFontSize(10).setTextColor(40, 40, 40);
    doc.text(sub, w / 2, y, { align: "center" });
    y += 6;
  }
  doc.setTextColor(20, 20, 20);
  return y + 4;
}

function par(doc: jsPDF, texto: string, y: number, size = 11) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "normal").setFontSize(size).setTextColor(20, 20, 20);
  const lines = doc.splitTextToSize(texto, w - 2 * M);
  doc.text(lines, M, y, { align: "justify", maxWidth: w - 2 * M, lineHeightFactor: 1.5 });
  return y + lines.length * size * 0.53 + 4;
}

function assinatura(doc: jsPDF, nome: string | undefined, cargo: string, x: number, y: number, larg = 75) {
  doc.setDrawColor(40, 40, 40).setLineWidth(0.3).line(x - larg / 2, y, x + larg / 2, y);
  doc.setFont("helvetica", "bold").setFontSize(10).text(nome || " ", x, y + 5, { align: "center" });
  doc.setFont("helvetica", "normal").setFontSize(9).text(cargo, x, y + 9.5, { align: "center" });
}

function localData(doc: jsPDF, y: number, iso?: string) {
  doc.setFont("helvetica", "normal").setFontSize(11);
  doc.text(`Manaus/AM, ${extenso(iso)}.`, W - M, y, { align: "right" });
  return y + 10;
}

function rodape(doc: jsPDF) {
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    const w = doc.internal.pageSize.getWidth(), h = doc.internal.pageSize.getHeight();
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(120, 120, 120);
    doc.text(`CIPA — Comissão Interna de Prevenção de Acidentes e de Assédio · NR-05 · Emitido pelo SIGMO`, M, h - 8);
    doc.text(`${i}/${n}`, w - M, h - 8, { align: "right" });
  }
  return doc;
}

const G = (c: DocsCtx) => c.gestao.gestao;
const presComissao = (c: DocsCtx) => c.comissao.find((p) => p.funcao === "PRESIDENTE");
const secComissao = (c: DocsCtx) => c.comissao.find((p) => p.funcao === "SECRETARIO");

/* 1 — Calendário */
export function pdfCalendario(c: DocsCtx) {
  const doc = novo("l");
  const y = timbre(doc, `CALENDÁRIO DO PROCESSO ELEITORAL — CIPA ${G(c)}`, `Data da posse da nova gestão: ${fmtBR(etapa(c.cal, "posse"))}`);
  autoTable(doc, {
    startY: y,
    head: [["#", "Etapa", "Prazo legal", "Data exata", "Dia", "Data corrigida", "Dia"]],
    body: c.cal.map((e, i) => [i + 1, e.etapa, e.prazo, fmtBR(e.exata), diaSemana(e.exata), fmtBR(e.corrigida), diaSemana(e.corrigida)]),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: RED },
    columnStyles: { 0: { cellWidth: 8 }, 5: { fontStyle: "bold" } },
    margin: { left: M, right: M },
  });
  const fy = (doc as any).lastAutoTable.finalY + 6;
  doc.setFontSize(8.5).setTextColor(80, 80, 80);
  doc.text("Data corrigida: quando o prazo cai em sábado, domingo ou feriado, a etapa é antecipada para o dia útil anterior, preservando o prazo legal.", M, fy);
  assinatura(doc, c.cfg.rep_empresa_nome, c.cfg.rep_empresa_cargo || "Representante da organização", 148, fy + 25);
  return rodape(doc);
}

/* 2 — Quadro I */
export function pdfQuadroI(c: DocsCtx) {
  const doc = novo("l");
  const gr = c.gestao.grau_risco ?? 0, n = c.gestao.num_empregados ?? 0;
  let y = timbre(doc, "NR-05 · QUADRO I — DIMENSIONAMENTO DA CIPA", `Grau de risco ${gr || "—"} · ${n || "—"} empregados no estabelecimento`);
  doc.setFontSize(9);
  y = par(doc, "5.4.1 A CIPA será constituída por estabelecimento e composta de representantes da organização e dos empregados, de acordo com o dimensionamento previsto no Quadro I desta NR, ressalvadas as disposições para setores econômicos específicos.", y, 9);
  const faixasLbl = ["0-19", "20-29", "30-50", "51-80", "81-100", "101-120", "121-140", "141-300", "301-500", "501-1000", "1001-2500", "2501-5000", "5001-10000"];
  const col = n > 0 && n <= 10000 ? FAIXAS.findIndex((l) => n <= l) : -1;
  const body: any[] = [];
  [1, 2, 3, 4].forEach((g) => {
    body.push([{ content: String(g), rowSpan: 2 }, "Efetivos", ...QUADRO[g].map((q) => (q ? q[0] : "-"))]);
    body.push(["Suplentes", ...QUADRO[g].map((q) => (q ? q[1] : "-"))]);
  });
  autoTable(doc, {
    startY: y,
    head: [["GR", "Integrantes", ...faixasLbl]],
    body,
    styles: { fontSize: 8, halign: "center", cellPadding: 1.6 },
    headStyles: { fillColor: RED, fontSize: 7 },
    margin: { left: M, right: M },
    didParseCell: (d) => {
      if (d.section !== "body") return;
      const rowGr = Math.floor(d.row.index / 2) + 1;
      const isFirst = d.row.index % 2 === 0;
      const colIdx = isFirst ? d.column.index - 2 : d.column.index - 1;
      if (rowGr === gr && colIdx === col && colIdx >= 0) {
        d.cell.styles.fillColor = [253, 224, 71];
        d.cell.styles.fontStyle = "bold";
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 8;
  const g = c.gestao;
  autoTable(doc, {
    startY: y,
    head: [["Representação", "Efetivos", "Suplentes", "Forma de escolha"]],
    body: [
      ["Empregador", g.efetivos_empregador ?? 0, g.suplentes_empregador ?? 0, "Indicação pela organização"],
      ["Empregados", g.efetivos_empregados ?? 0, g.suplentes_empregados ?? 0, "Eleição por voto secreto"],
    ],
    styles: { fontSize: 9 }, headStyles: { fillColor: [60, 60, 60] },
    margin: { left: M, right: 150 },
  });
  doc.setFontSize(8.5).setTextColor(80, 80, 80);
  doc.text(`Carga horária do treinamento (item 5.7.4.1): ${c.cargaHoras} horas. Faixa aplicável destacada em amarelo.`, M, (doc as any).lastAutoTable.finalY + 6);
  return rodape(doc);
}

/* 3 — Edital de Convocação */
export function pdfEditalConvocacao(c: DocsCtx) {
  const doc = novo();
  let y = timbre(doc, "EDITAL DE CONVOCAÇÃO DE ELEIÇÃO", `Candidatos a membros da CIPA — Gestão ${G(c)}`);
  y = par(doc, `Ficam convocados os empregados da empresa ${E.razao_social} para inscrição dos candidatos a membros da Comissão Interna de Prevenção de Acidentes e de Assédio – CIPA, gestão ${G(c)}, de acordo com a ${NORMA}.`, y);
  y = par(doc, `As inscrições serão realizadas no ${c.cfg.local_inscricao || "SESMT"}, das ${c.cfg.horario_inicio || "07h30"} do dia ${fmtBR(etapa(c.cal, "inicio_inscricoes"))} às ${c.cfg.horario_fim || "17h30"} do dia ${fmtBR(etapa(c.cal, "fim_inscricoes"))}.`, y);
  y = par(doc, `A eleição será realizada no dia ${fmtBR(etapa(c.cal, "eleicao"))}, em horário normal de expediente, por voto secreto, em local a ser divulgado. Podem se candidatar todos os empregados do estabelecimento, independentemente de setor ou local de trabalho. Fica garantida ao candidato a estabilidade provisória desde o registro da candidatura (art. 10, II, "a" do ADCT).`, y);
  y = localData(doc, y + 4, etapa(c.cal, "edital_convocacao"));
  assinatura(doc, c.cfg.rep_empresa_nome, c.cfg.rep_empresa_cargo || "Representante da organização", W / 2, y + 22);
  if (c.qr) {
    doc.addImage(c.qr, "PNG", W - M - 32, 250, 30, 30);
    doc.setFontSize(7).text("Leia com o celular", W - M - 17, 283, { align: "center" });
  }
  doc.setFontSize(8.5).setTextColor(90, 90, 90).text(`Afixado em: ____/____/______   Local: ${c.cfg.mural_local || "______________________"}`, M, 262);
  return rodape(doc);
}

/* 4 — Ofício ao sindicato (cópia do edital) */
export function pdfOficioSindicato(c: DocsCtx) {
  const doc = novo();
  let y = timbre(doc, "COMUNICAÇÃO DE INÍCIO DO PROCESSO ELEITORAL DA CIPA", `Gestão ${G(c)}`);
  y = localData(doc, y, etapa(c.cal, "copia_sindicato"));
  doc.setFont("helvetica", "bold").setFontSize(11).text(`Ao ${c.cfg.sindicato_nome || "Sindicato da categoria profissional"}`, M, y);
  y = par(doc, "Prezados Senhores,", y + 8);
  y = par(doc, `A ${E.razao_social}, CNPJ ${E.cnpj}, situada em ${E.endereco}, ${E.cidade_uf_cep}, em cumprimento ao item 5.5.1.1 da ${NORMA}, comunica a este Sindicato o início do processo eleitoral para escolha dos representantes dos empregados na CIPA, gestão ${G(c)}, encaminhando em anexo a cópia do Edital de Convocação publicado em ${fmtBR(etapa(c.cal, "edital_convocacao"))}.`, y);
  autoTable(doc, {
    startY: y,
    head: [["Etapa", "Data"]],
    body: c.cal.filter((e) => ["inicio_inscricoes", "fim_inscricoes", "eleicao", "apuracao", "posse"].includes(e.key)).map((e) => [e.etapa, fmtBR(e.corrigida)]),
    styles: { fontSize: 10 }, headStyles: { fillColor: RED }, margin: { left: M, right: M },
  });
  y = (doc as any).lastAutoTable.finalY + 10;
  y = par(doc, "Sem mais para o momento, colocamo-nos à disposição.", y);
  assinatura(doc, c.cfg.rep_empresa_nome, c.cfg.rep_empresa_cargo || "Representante da organização", W / 2, y + 20);
  doc.setDrawColor(150).rect(M, 245, 80, 30);
  doc.setFontSize(8).text("Protocolo / recebido pelo Sindicato", M + 40, 250, { align: "center" });
  return rodape(doc);
}

/* 5 — Constituição da Comissão Eleitoral */
export function pdfComissaoEleitoral(c: DocsCtx) {
  const doc = novo();
  let y = timbre(doc, "EDITAL DE CONSTITUIÇÃO DA COMISSÃO ELEITORAL", `CIPA — Gestão ${G(c)}`);
  y = par(doc, `Ficam nomeados os empregados abaixo relacionados para a constituição da Comissão Eleitoral que dirigirá os trabalhos de eleição dos membros da Comissão Interna de Prevenção de Acidentes e de Assédio – CIPA, gestão ${G(c)}, de acordo com o item 5.5.2 da ${NORMA}.`, y);
  const fl: Record<string, string> = { PRESIDENTE: "Presidente", SECRETARIO: "Secretário(a)", MEMBRO: "Membro" };
  autoTable(doc, {
    startY: y,
    head: [["Nome", "Matrícula", "Setor", "Função na comissão"]],
    body: c.comissao.length ? c.comissao.map((p) => [p.nome, p.matricula || "", p.setor || "", fl[p.funcao || "MEMBRO"]]) : [["(defina a comissão na aba Documentos)", "", "", ""]],
    styles: { fontSize: 10 }, headStyles: { fillColor: RED }, margin: { left: M, right: M },
  });
  y = localData(doc, (doc as any).lastAutoTable.finalY + 12, etapa(c.cal, "comissao_eleitoral"));
  assinatura(doc, c.cfg.presidente_cipa_nome, "Presidente da CIPA em exercício", W / 2, y + 22);
  return rodape(doc);
}

/* 6 — Edital de Inscrição */
export function pdfEditalInscricao(c: DocsCtx) {
  const doc = novo();
  let y = timbre(doc, "EDITAL DE INSCRIÇÃO PARA ELEIÇÃO", `Candidatos a membros da CIPA — Gestão ${G(c)}`);
  y = par(doc, `Atendendo à ${NORMA}, e à Convenção Coletiva de Trabalho, a ${E.razao_social} comunica que no período de ${extenso(etapa(c.cal, "inicio_inscricoes"))} a ${extenso(etapa(c.cal, "fim_inscricoes"))} estarão abertas as inscrições para todos os empregados que desejarem candidatar-se a representante dos empregados na Comissão Interna de Prevenção de Acidentes e de Assédio – CIPA.`, y);
  y = par(doc, `Local: ${c.cfg.local_inscricao || "SESMT"}. Horário: das ${c.cfg.horario_inicio || "07h30"} às ${c.cfg.horario_fim || "17h30"}.`, y);
  y = par(doc, "Requisitos: ser empregado do estabelecimento. No ato da inscrição o candidato receberá o Comprovante de Inscrição, que marca o início da sua estabilidade provisória.", y);
  y = par(doc, `Número de vagas (Quadro I): ${c.gestao.efetivos_empregados ?? 0} titular(es) e ${c.gestao.suplentes_empregados ?? 0} suplente(s).`, y);
  y = localData(doc, y + 4, etapa(c.cal, "edital_inscricao"));
  assinatura(doc, presComissao(c)?.nome, "Presidente da Comissão Eleitoral", W / 2, y + 22);
  return rodape(doc);
}

/* 7 — Comprovantes de inscrição (1 página por candidato, 2 vias) */
export function pdfComprovantes(c: DocsCtx) {
  const doc = novo();
  const lista = c.candidatos.length ? c.candidatos : [{ nome: "", numero: 0, votos: null } as Cand];
  lista.forEach((cand, idx) => {
    if (idx > 0) doc.addPage();
    [0, 148.5].forEach((off, via) => {
      doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(20, 20, 20).text(E.razao_social, W / 2, off + 16, { align: "center" });
      doc.setFontSize(14).setTextColor(...RED).text("COMPROVANTE DE INSCRIÇÃO", W / 2, off + 26, { align: "center" });
      doc.setTextColor(20, 20, 20);
      par(doc, `Certificamos que o(a) Sr.(a) ${cand.nome || "_______________________________________"}${cand.matricula ? `, matrícula ${cand.matricula}` : ""}, registrou sua inscrição de candidato(a) a representante dos empregados na CIPA — Comissão Interna de Prevenção de Acidentes e de Assédio, gestão ${G(c)}${cand.numero ? `, sob o nº ${String(cand.numero).padStart(2, "0")}` : ""}.`, off + 38);
      assinatura(doc, presComissao(c)?.nome, "Presidente da Comissão Eleitoral", 60, off + 95, 70);
      assinatura(doc, secComissao(c)?.nome, "Secretário(a) da Comissão Eleitoral", 150, off + 95, 70);
      doc.setFontSize(9).text(`${via === 0 ? "1ª via — Comissão Eleitoral" : "2ª via — Candidato"}`, M, off + 118);
      doc.text(`Data: ${fmtBR((cand as any).inscricao_em)}`, W - M, off + 118, { align: "right" });
      if (via === 0) { doc.setLineDashPattern([2, 2], 0).setDrawColor(150).line(8, 148.5, W - 8, 148.5); doc.setLineDashPattern([], 0); }
    });
  });
  return doc;
}

/* 8 — Relação de candidatos */
export function pdfCandidatos(c: DocsCtx) {
  const doc = novo();
  const y = timbre(doc, "RELAÇÃO DE CANDIDATOS A MEMBROS DA CIPA", `Gestão ${G(c)} · Eleição em ${fmtBR(etapa(c.cal, "eleicao"))}`);
  autoTable(doc, {
    startY: y,
    head: [["Nº", "Candidato", "Setor"]],
    body: c.candidatos.map((k) => [String(k.numero).padStart(2, "0"), k.nome, k.setor || ""]),
    styles: { fontSize: 13, cellPadding: 4 }, headStyles: { fillColor: RED }, columnStyles: { 0: { cellWidth: 18, halign: "center", fontStyle: "bold" } },
    margin: { left: M, right: M },
  });
  const fy = localData(doc, (doc as any).lastAutoTable.finalY + 12, etapa(c.cal, "lista_candidatos"));
  assinatura(doc, presComissao(c)?.nome, "Presidente da Comissão Eleitoral", W / 2, fy + 20);
  return rodape(doc);
}

/* 9 — Cédulas */
export function pdfCedulas(c: DocsCtx) {
  const doc = novo();
  const cw = (W - 20) / 2, ch = 92;
  for (let i = 0; i < 6; i++) {
    const x = 10 + (i % 2) * cw, y = 10 + Math.floor(i / 2) * ch;
    doc.setDrawColor(120).setLineDashPattern([2, 2], 0).rect(x, y, cw, ch); doc.setLineDashPattern([], 0);
    doc.setFont("helvetica", "bold").setFontSize(10).text(`CÉDULA DE VOTAÇÃO — CIPA ${G(c)}`, x + cw / 2, y + 8, { align: "center" });
    doc.setFont("helvetica", "normal").setFontSize(8).text("Marque um X em apenas UM candidato", x + cw / 2, y + 13, { align: "center" });
    c.candidatos.slice(0, 10).forEach((k, j) => {
      const yy = y + 20 + j * 6.5;
      doc.rect(x + 6, yy - 3.5, 4.5, 4.5);
      doc.setFontSize(9).text(`${String(k.numero).padStart(2, "0")} — ${k.nome}`, x + 14, yy, { maxWidth: cw - 18 });
    });
    doc.setFontSize(7).text("Rubrica da mesa: ____________", x + cw - 6, y + ch - 4, { align: "right" });
  }
  return doc;
}

/* 10 — Lista de votantes */
export function pdfListaVotantes(c: DocsCtx) {
  const doc = novo();
  const y = timbre(doc, "LISTA DE VOTANTES (CADERNO DE VOTAÇÃO)", `CIPA ${G(c)} · Eleição em ${fmtBR(etapa(c.cal, "eleicao"))}`);
  autoTable(doc, {
    startY: y,
    head: [["#", "Nome", "Matrícula", "Setor", "Assinatura"]],
    body: c.eleitores.map((p, i) => [i + 1, p.nome, p.matricula || "", p.setor || "", ""]),
    styles: { fontSize: 8.5, minCellHeight: 8 }, headStyles: { fillColor: RED },
    columnStyles: { 0: { cellWidth: 10 }, 4: { cellWidth: 55 } }, margin: { left: M, right: M, bottom: 16 },
  });
  return rodape(doc);
}

/* 11 — Ata de Apuração */
export function pdfAtaApuracao(c: DocsCtx) {
  const doc = novo();
  let y = timbre(doc, "ATA DE APURAÇÃO DOS VOTOS", `CIPA — Gestão ${G(c)}`);
  const validos = c.candidatos.reduce((s, k) => s + (k.votos ?? 0), 0);
  y = par(doc, `Às ${c.cfg.apuracao_hora_inicio || "____h____"} do dia ${extenso(etapa(c.cal, "apuracao"))}, em ${c.cfg.apuracao_local || "__________________"}, nas dependências da ${E.razao_social}, foi iniciada a apuração dos votos da eleição dos representantes dos empregados na Comissão Interna de Prevenção de Acidentes e de Assédio – CIPA, gestão ${G(c)}, na presença dos membros da Comissão Eleitoral e dos representantes da organização e dos empregados, conforme item 5.5.3 i) da NR-05.`, y);
  autoTable(doc, {
    startY: y,
    head: [["Nº", "Candidato", "Votos"]],
    body: [...[...c.candidatos].sort((a, b) => (b.votos ?? 0) - (a.votos ?? 0)).map((k) => [String(k.numero).padStart(2, "0"), k.nome, k.votos ?? ""]),
      ["", "Votos válidos", validos], ["", "Votos brancos", c.cfg.votos_brancos ?? ""], ["", "Votos nulos", c.cfg.votos_nulos ?? ""],
      ["", "Total de votantes", c.votantes ?? ""], ["", "Eleitores aptos", c.eleitoresAptos ?? ""]],
    styles: { fontSize: 10 }, headStyles: { fillColor: RED }, margin: { left: M, right: M },
  });
  y = (doc as any).lastAutoTable.finalY + 8;
  y = par(doc, `A apuração foi concluída às ${c.cfg.apuracao_hora_fim || "____h____"} do mesmo dia. Para constar, eu, ${secComissao(c)?.nome || "________________"}, secretário(a) da Comissão Eleitoral, lavrei a presente Ata, que vai assinada pelos membros da Comissão Eleitoral e pelos presentes que assim desejaram. A presente ata será encaminhada ao Sindicato da categoria profissional.`, y);
  const pes = c.comissao.length ? c.comissao : [{ nome: "" }, { nome: "" }];
  pes.forEach((p, i) => assinatura(doc, p.nome, p.funcao === "PRESIDENTE" ? "Presidente da Comissão Eleitoral" : p.funcao === "SECRETARIO" ? "Secretário(a)" : "Membro da Comissão", i % 2 ? 150 : 60, y + 22 + Math.floor(i / 2) * 24, 70));
  return rodape(doc);
}

/* 12 — Comunicação do resultado ao sindicato */
export function pdfResultadoSindicato(c: DocsCtx) {
  const doc = novo();
  let y = timbre(doc, "COMUNICAÇÃO DO RESULTADO DO PROCESSO ELEITORAL E DATA DE POSSE", "Ao Sindicato da categoria profissional");
  y = localData(doc, y, etapa(c.cal, "resultado_sindicato"));
  doc.setFont("helvetica", "bold").setFontSize(11).text(`Ao ${c.cfg.sindicato_nome || "Sindicato da categoria profissional"}`, M, y);
  y = par(doc, `A empresa ${E.razao_social}, situada em ${E.endereco}, CNPJ ${E.cnpj}, representada neste ato por ${c.cfg.rep_empresa_nome || "__________________"}, vem informar a este Sindicato que no dia ${fmtBR(etapa(c.cal, "eleicao"))} foi realizada a eleição dos representantes dos empregados na CIPA – Comissão Interna de Prevenção de Acidentes e de Assédio, gestão ${G(c)}, e que a posse ocorrerá em ${fmtBR(etapa(c.cal, "posse"))}. Seguem os eleitos:`, y + 8);
  autoTable(doc, {
    startY: y,
    head: [["Representação", "Condição", "Nome"]],
    body: c.membros.filter((m) => m.representacao === "EMPREGADOS").map((m) => ["Empregados", m.papel === "EFETIVO" ? "Titular" : "Suplente", m.nome]),
    styles: { fontSize: 10 }, headStyles: { fillColor: RED }, margin: { left: M, right: M },
  });
  y = (doc as any).lastAutoTable.finalY + 12;
  assinatura(doc, c.cfg.rep_empresa_nome, c.cfg.rep_empresa_cargo || "Representante da organização", W / 2, y + 18);
  doc.setDrawColor(150).rect(M, 245, 80, 30);
  doc.setFontSize(8).text("Protocolo / recebido pelo Sindicato", M + 40, 250, { align: "center" });
  return rodape(doc);
}

/* 13 — Ata de Instalação e Posse */
export function pdfAtaPosse(c: DocsCtx) {
  const doc = novo();
  let y = timbre(doc, "ATA DE INSTALAÇÃO E POSSE DOS MEMBROS DA CIPA", `Gestão ${G(c)}`);
  y = par(doc, `Aos ${extenso(etapa(c.cal, "posse"))}, nas dependências da ${E.razao_social}, reuniram-se os membros da Comissão Interna de Prevenção de Acidentes e de Assédio – CIPA, representantes da organização e dos empregados, para a instalação e posse da CIPA gestão ${G(c)}, cujo mandato se estende até ${fmtBR(c.gestao.data_fim)}, conforme a ${NORMA}. Foram empossados os membros abaixo, que receberam cópia desta ata e da ata de eleição (item 5.5.6).`, y);
  const grupo = (rep: string, papel: string) => c.membros.filter((m) => m.representacao === rep && m.papel === papel);
  const blocos: [string, Membro[]][] = [
    ["REPRESENTANTES DO EMPREGADOR — TITULARES", grupo("EMPREGADOR", "EFETIVO")],
    ["REPRESENTANTES DO EMPREGADOR — SUPLENTES", grupo("EMPREGADOR", "SUPLENTE")],
    ["REPRESENTANTES DOS EMPREGADOS — TITULARES", grupo("EMPREGADOS", "EFETIVO")],
    ["REPRESENTANTES DOS EMPREGADOS — SUPLENTES", grupo("EMPREGADOS", "SUPLENTE")],
  ];
  blocos.forEach(([t, lst]) => {
    autoTable(doc, {
      startY: y, head: [[t, "Assinatura"]],
      body: (lst.length ? lst : [{ nome: "—" } as Membro]).map((m) => [m.nome, ""]),
      styles: { fontSize: 10, minCellHeight: 9 }, headStyles: { fillColor: RED }, columnStyles: { 1: { cellWidth: 70 } },
      margin: { left: M, right: M },
    });
    y = (doc as any).lastAutoTable.finalY + 4;
  });
  return rodape(doc);
}

/* 14 — Calendário anual de reuniões */
export function pdfCalendarioReunioes(c: DocsCtx, datas: string[]) {
  const doc = novo();
  const y = timbre(doc, "CALENDÁRIO ANUAL DE REUNIÕES ORDINÁRIAS DA CIPA", `Gestão ${G(c)}`);
  autoTable(doc, {
    startY: y,
    head: [["Nº", "Data", "Dia", "Horário", "Status"]],
    body: datas.map((d, i) => [i + 1, fmtBR(d), diaSemana(d), c.cfg.reunioes_horario || "13h30 às 14h00", "P — Programado"]),
    styles: { fontSize: 10 }, headStyles: { fillColor: RED }, margin: { left: M, right: M },
  });
  const fy = (doc as any).lastAutoTable.finalY + 8;
  doc.setFontSize(9).text("Reuniões ordinárias mensais, em horário de expediente (item 5.6.1 da NR-05).", M, fy);
  assinatura(doc, c.cfg.presidente_cipa_nome, "Presidente da CIPA", W / 2, fy + 25);
  return rodape(doc);
}

/* 15 — Certificados */
export function pdfCertificados(c: DocsCtx) {
  const doc = novo("l");
  const lista = c.membros.length ? c.membros : [{ nome: "" } as Membro];
  const conteudo = [
    "a) estudo do ambiente, das condições de trabalho, bem como dos riscos originados do processo produtivo;",
    "b) noções sobre acidentes e doenças relacionadas ao trabalho e suas medidas de prevenção;",
    "c) metodologia de investigação e análise de acidentes e doenças relacionadas ao trabalho;",
    "d) princípios gerais de higiene do trabalho e de medidas de prevenção dos riscos;",
    "e) noções sobre as legislações trabalhista e previdenciária relativas à segurança e saúde no trabalho;",
    "f) noções sobre a inclusão de pessoas com deficiência e reabilitados nos processos de trabalho;",
    "g) organização da CIPA e outros assuntos necessários ao exercício das atribuições da Comissão;",
    "h) prevenção e combate ao assédio sexual e a outras formas de violência no trabalho.",
  ];
  lista.forEach((m, i) => {
    if (i > 0) doc.addPage();
    doc.setDrawColor(...RED).setLineWidth(2).rect(10, 10, 277, 190).setLineWidth(0.5).rect(14, 14, 269, 182);
    try { doc.addImage(dmnLogo as unknown as string, "PNG", 22, 20, 32, 18, undefined, "FAST"); } catch { /* */ }
    doc.setFont("helvetica", "bold").setFontSize(30).setTextColor(...RED).text("CERTIFICADO", 148.5, 58, { align: "center" });
    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "normal").setFontSize(14);
    const t = `O Serviço Especializado em Segurança e Medicina do Trabalho – SESMT da ${E.razao_social} certifica que ${m.nome || "______________________"} participou do Treinamento sobre Prevenção de Acidentes do Trabalho para componentes da Comissão Interna de Prevenção de Acidentes e de Assédio – CIPA, realizado ${c.cfg.treinamento_periodo || `em ${fmtBR(etapa(c.cal, "treinamento"))}`}, com carga horária de ${c.cargaHoras} horas, em conformidade com a ${NORMA}.`;
    doc.text(doc.splitTextToSize(t, 230), 148.5, 80, { align: "center", lineHeightFactor: 1.6 });
    assinatura(doc, "", "Instrutor(a)", 90, 170);
    assinatura(doc, m.nome, "Participante", 207, 170);
    doc.addPage();
    doc.setDrawColor(...RED).setLineWidth(0.5).rect(14, 14, 269, 182);
    doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(...RED).text("CONTEÚDO PROGRAMÁTICO (item 5.7.2 NR-05)", 148.5, 32, { align: "center" });
    doc.setFont("helvetica", "normal").setFontSize(11).setTextColor(20, 20, 20);
    conteudo.forEach((l, j) => doc.text(l, 28, 50 + j * 12, { maxWidth: 240 }));
  });
  return doc;
}

export const DOCS_LISTA = [
  { id: "calendario", titulo: "Calendário do Processo Eleitoral", fn: pdfCalendario },
  { id: "quadro", titulo: "Quadro I – Dimensionamento da CIPA", fn: pdfQuadroI },
  { id: "convocacao", titulo: "Edital de Convocação", fn: pdfEditalConvocacao },
  { id: "oficio", titulo: "Ofício ao Sindicato (cópia do edital)", fn: pdfOficioSindicato },
  { id: "comissao", titulo: "Edital de Constituição da Comissão Eleitoral", fn: pdfComissaoEleitoral },
  { id: "inscricao", titulo: "Edital de Inscrição", fn: pdfEditalInscricao },
  { id: "comprovantes", titulo: "Comprovantes de Inscrição (2 vias)", fn: pdfComprovantes },
  { id: "candidatos", titulo: "Relação de Candidatos (mural)", fn: pdfCandidatos },
  { id: "cedulas", titulo: "Cédulas de Votação", fn: pdfCedulas },
  { id: "votantes", titulo: "Lista de Votantes", fn: pdfListaVotantes },
  { id: "apuracao", titulo: "Ata de Apuração", fn: pdfAtaApuracao },
  { id: "resultado", titulo: "Comunicação do Resultado ao Sindicato", fn: pdfResultadoSindicato },
  { id: "posse", titulo: "Ata de Instalação e Posse", fn: pdfAtaPosse },
  { id: "reunioes", titulo: "Calendário Anual de Reuniões", fn: null as any },
  { id: "certificados", titulo: "Certificados de Capacitação", fn: pdfCertificados },
] as const;
