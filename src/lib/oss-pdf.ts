import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import dmnLogo from "@/assets/dmn-logo.png";

export type OSSPdfData = {
  numero?: string | null;
  revisao: number;
  emitido_em?: string | null;
  expira_em?: string | null;
  /** (legado — não é mais renderizado no PDF, mantido pra retrocompatibilidade) */
  tipo_emissao?: "ADMISSIONAL" | "PERIODICO" | "TROCA_RISCO" | null;
  motivo_emissao?: string | null;
  funcionario: {
    nome: string;
    cpf?: string | null;
    matricula?: string | null;
    admissao?: string | null;
    rg?: string | null;
  };
  cargo: string;
  cbo?: string | null;
  setor?: string | null;
  empresa?: string | null;
  empresa_cnpj?: string | null;
  conteudo: {
    descricao_atividades: string;
    riscos_texto: string;
    medidas_preventivas: string;
    epis_obrigatorios: string;
    proibicoes: string;
    penalidades: string;
    procedimentos_emergencia: string;
    // Opcional: riscos já estruturados por categoria. Se vier preenchido,
    // é renderizado rotulado; senão usamos `riscos_texto` (auto-rotula
    // quando detectar "Físico:", "Químico:" etc).
    riscos_categorias?: {
      fisico?: string | null;
      quimico?: string | null;
      biologico?: string | null;
      ergonomico?: string | null;
      acidente?: string | null;
      psicossocial?: string | null;
    } | null;
  };
  /** Catálogo de EPIs do estoque (nome → CA) para enriquecer linhas que vierem sem CA. */
  episCatalog?: Array<{ nome: string; ca: string | null }>;
  /** Assinatura cadastrada do colaborador (PNG dataURL). Quando presente é
   * renderizada automaticamente sobre a linha "Assinatura do Empregado". */
  assinaturaColaboradorDataUrl?: string | null;
};

function brDate(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

// ============================================================
// Textos FIXOS do modelo homologado FOR-SEG 01 (DMN Estaleiro)
// ============================================================
const TXT_CARO_EMPREGADO =
  'Estas ordens de serviço têm por finalidade cumprir o disposto no item 1.4.1, "letra c" da Norma Regulamentadora 01 do Ministério da Economia, ' +
  "Secretaria Especial de Previdência e Trabalho, conscientizá-lo para a prática de segurança e saúde no desempenho de suas atividades e ainda, " +
  "cientificá-lo de que o descumprimento do seu conteúdo poderá constituir ato faltoso.";

const TXT_SEC4_MAQUINAS =
  "Ligar a máquina, observar seu funcionamento, mediante funcionamento positivo para normalidade, deve-se iniciar as atividades, caso note " +
  "anormalidade, deverá comunicar ao setor responsável e ao término da atividade desligar a máquina.";

const TXT_SEC5_PREVENCAO =
  "O setor de trabalho é lugar que se destina a realização das atividades laborais. Brincadeiras devem ser reservadas para os horários de folgas. " +
  "Cumpra as normas e procedimentos de segurança do seu setor de trabalho. Pergunte ao seu líder ou encarregado, quando não souber ou tiver dúvidas " +
  "sobre alguma atividade. Comunique qualquer anormalidade que notar na máquina, equipamento ou ferramenta que for utilizar. Obedeça às sinalizações " +
  "de segurança. Quando necessário use efetivamente todos os equipamentos de proteção individual de acordo com os riscos que estiver exposto. " +
  "Uniformes inadequados ou impróprios, bem como cabelos soltos, cordões, anéis, pulseiras e relógios devem ficar guardados em seu armário. " +
  "Quaisquer atividades relacionadas com eletricidade, reparo e manutenção em máquinas e equipamentos somente poderão ser realizadas por empregado " +
  "autorizado pela Empresa. É terminantemente proibido fumar nas dependências da Empresa, exceto no local destinado para este fim. Visando a sua " +
  "segurança durante as suas atividades laborais, é imprescindível que planeje a sua atividade antes do início. É válido ressaltar que o excesso de " +
  "confiança é fator determinante para a ocorrência de acidentes do trabalho. Fica terminantemente proibido o uso de telefone celular no processo " +
  "produtivo, exceto quando autorizado pela administração.";

const TXT_SEC6_INCENDIO =
  "Caso observe alguma anormalidade com relação a princípio de incêndio, informe de imediato ao brigadista para que ele adote todas as medidas " +
  "necessárias a fim de evitar a propagação do incêndio. Se possível for, saia do local sinistrado levando consigo demais colegas de trabalho. " +
  "É válido ressaltar que você não deverá adotar nenhuma medida que coloque a sua vida em risco bem como a de seus colegas de trabalho.";

const TXT_SEC7_ACIDENTES =
  "Caso você se acidente durante a realização de suas atividades laborais, comunique a ocorrência de imediato a Segurança do Trabalho, Brigadista, " +
  "Líder, Encarregado e/ou Administração, para que possam tomar todas as ações necessárias de acordo com a situação apresentada. Todo e qualquer " +
  "acidente deverá ser investigado para que possa ser analisado criteriosamente as causas a serem adotadas e as medidas capazes de evitar a reincidência.";

const TXT_SEC8_OBS =
  "As orientações aqui contidas não esgotam o assunto sobre prevenção de acidentes, devendo ser observadas todas as instruções existentes, ainda " +
  "que verbais em especial as Normas e Regulamentos da Empresa.\nNão executar qualquer atividade sem treinamento e pleno conhecimento dos riscos e " +
  "cuidados a serem observados.";

const TXT_TERMO =
  'Declaro para os devidos fins que tomei conhecimento e irei cumprir o conteúdo destas ordens de serviço. Em conformidade com o Item 1.4.2 "a".';

// Tenta separar "Nome do EPI - CA 12345" / "Nome do EPI (CA 12345)" / "Nome — CA: 12345"
function parseEpis(
  raw: string,
  catalog?: Array<{ nome: string; ca: string | null }>,
): Array<{ desc: string; ca: string }> {
  if (!raw) return [];
  const norm = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  const lookupCa = (desc: string): string => {
    if (!catalog?.length) return "";
    const d = norm(desc);
    if (!d) return "";
    // 1) match exato
    let hit = catalog.find((c) => norm(c.nome) === d);
    // 2) catálogo contém descrição OU descrição contém catálogo (tokens >= 3 chars)
    if (!hit) {
      hit = catalog.find((c) => {
        const n = norm(c.nome);
        return n && (n.includes(d) || d.includes(n));
      });
    }
    // 3) primeiro token relevante em comum
    if (!hit) {
      const tokens = d.split(" ").filter((t) => t.length >= 4);
      hit = catalog.find((c) => {
        const n = norm(c.nome);
        return tokens.some((t) => n.includes(t));
      });
    }
    return hit?.ca ?? "";
  };
  const out: Array<{ desc: string; ca: string }> = [];
  const pushItem = (rawItem: string) => {
    let line = rawItem.trim().replace(/^[•\-*·\u2022]\s*/, "").replace(/\.$/, "").trim();
    if (!line) return;
    // CA inline: "Nome - CA 12345" / "Nome (CA: 12345)"
    const m = line.match(/(.*?)\s*[-–—(:]\s*C\.?A\.?\s*[:nº#]?\s*(\d+)/i);
    if (m) { out.push({ desc: m[1].replace(/[\s\-–—(:]+$/, "").trim(), ca: m[2] }); return; }
    // Número CA solto no fim
    const m2 = line.match(/(.*?)\s+(\d{3,6})\s*$/);
    if (m2) { out.push({ desc: m2[1].trim(), ca: m2[2] }); return; }
    out.push({ desc: line, ca: lookupCa(line) });
  };
  // 1) quebra por linhas / ;
  const lines = raw.split(/\r?\n|;/).map((l) => l.trim()).filter(Boolean);
  for (let line of lines) {
    line = line.replace(/^[•\-*·\u2022]\s*/, "");
    // se tem prefixo descritivo tipo "Ao circular em área operacional:" remove
    const colonIdx = line.indexOf(":");
    let body = line;
    if (colonIdx > 0 && colonIdx < 80) {
      const head = line.slice(0, colonIdx);
      // só remove se o prefixo não parece ser nome de EPI (não tem dígitos / "CA")
      if (!/\bC\.?A\.?\b|\d/.test(head)) body = line.slice(colonIdx + 1).trim();
    }
    // 2) quebra por vírgula / " e " — mas preserva quando a linha inteira casa exato no catálogo
    const matchesExact = catalog?.some((c) => norm(c.nome) === norm(body));
    if (!matchesExact && /[,]| e /i.test(body)) {
      const parts = body
        .split(/,| e (?=[a-zA-ZÀ-ÿ])/i)
        .map((p) => p.trim())
        .filter(Boolean);
      parts.forEach(pushItem);
    } else {
      pushItem(body);
    }
  }
  return out;
}

/** Tenta extrair categorias de risco a partir de um bloco de texto livre. */
function parseRiscosTexto(raw: string) {
  if (!raw) return null;
  const cats: Record<string, string> = {};
  const map: Array<[RegExp, string]> = [
    [/F[íi]sico[s]?\s*[:\-–]\s*(.+)/i, "fisico"],
    [/Qu[íi]mico[s]?\s*[:\-–]\s*(.+)/i, "quimico"],
    [/Biol[óo]gico[s]?\s*[:\-–]\s*(.+)/i, "biologico"],
    [/Ergon[ôo]mico[s]?\s*[:\-–]\s*(.+)/i, "ergonomico"],
    [/(?:Acidente|Mec[âa]nico|Acidente\/Mec[âa]nico)[s]?\s*[:\-–]\s*(.+)/i, "acidente"],
  ];
  for (const line of raw.split(/\r?\n/)) {
    for (const [rx, key] of map) {
      const m = line.match(rx);
      if (m) { cats[key] = (cats[key] ? cats[key] + " " : "") + m[1].trim(); break; }
    }
  }
  return Object.keys(cats).length ? cats : null;
}

export function buildOssPdf(data: OSSPdfData): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const margin = 8;
  const innerW = W - margin * 2;
  let y = margin;
  const ensureSpace = (needed: number) => {
    if (y + needed > H - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // ====================== CABEÇALHO (3 colunas) ======================
  // [Logo DMN] | [Título centralizado] | [Metadados FOR-SEG / Revisão / Data]
  const hdrH = 22;
  const logoW = 38;
  const metaW = 42;
  const titleW = innerW - logoW - metaW;
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, innerW, hdrH);
  doc.line(margin + logoW, y, margin + logoW, y + hdrH);
  doc.line(margin + logoW + titleW, y, margin + logoW + titleW, y + hdrH);

  // Coluna 1 — logo DMN
  try {
    doc.addImage(dmnLogo as any, "PNG", margin + 3, y + 3, logoW - 6, hdrH - 6);
  } catch {
    // fallback texto se logo não carregar
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(178, 34, 34);
    doc.text("DMN", margin + logoW / 2, y + 11, { align: "center" });
    doc.setTextColor(0);
  }

  // Coluna 2 — título centralizado
  const titleCx = margin + logoW + titleW / 2;
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Ordem de Serviço", titleCx, y + 8, { align: "center" });
  doc.setFontSize(11);
  doc.text("Segurança e Saúde no Trabalho", titleCx, y + 14, { align: "center" });
  doc.setFontSize(10);
  doc.text('NR 1, Item 1.4.1 "c"', titleCx, y + 19, { align: "center" });

  // Coluna 3 — metadados (FOR-SEG 01 / Revisão / Data / Pág)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const metaX = margin + logoW + titleW + 2;
  doc.text("CÓD.: FOR-SEG 01", metaX, y + 5);
  doc.text(`REVISÃO: ${String(data.revisao ?? 0).padStart(2, "0")}`, metaX, y + 10);
  doc.text(`DATA: ${brDate(data.emitido_em)}`, metaX, y + 15);
  doc.text("PÁG.: 01/01", metaX, y + 20);

  y += hdrH;

  // ====================== IDENTIFICAÇÃO ======================
  const rowH = 6;
  const labelBoldField = (
    x: number, yy: number, w: number, label: string, value: string,
  ) => {
    doc.rect(x, yy, w, rowH);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(label, x + 1.5, yy + 4);
    const labelW = doc.getTextWidth(label) + 2;
    doc.setFont("helvetica", "normal");
    doc.text(value ?? "", x + 1.5 + labelW, yy + 4);
  };

  // Linha 1: Razão Social | CNPJ | Data
  // Razão Social e CNPJ vêm da empresa do funcionário; fallback para DMN
  // para não quebrar OSS antigas que ainda eram emitidas só pra DMN.
  const razao = (data.empresa ?? "").trim() || "DMN ESTALEIRO DA AMAZÔNIA LTDA";
  const cnpj = (data.empresa_cnpj ?? "").trim() || "13.378.697/0001-80";
  labelBoldField(margin, y, innerW * 0.55, "Razão Social:", " " + razao);
  labelBoldField(margin + innerW * 0.55, y, innerW * 0.27, "CNPJ:", " " + cnpj);
  labelBoldField(margin + innerW * 0.82, y, innerW * 0.18, "Data:", " " + brDate(data.emitido_em));
  y += rowH;

  // Linha 2: Nome | RG
  labelBoldField(margin, y, innerW * 0.7, "Nome:", " " + (data.funcionario.nome || ""));
  labelBoldField(margin + innerW * 0.7, y, innerW * 0.3, "RG:", " " + (data.funcionario.rg ?? ""));
  y += rowH;

  // Linha 3: Cargo | CBO | Setor
  labelBoldField(margin, y, innerW * 0.45, "Cargo:", " " + (data.cargo || ""));
  labelBoldField(margin + innerW * 0.45, y, innerW * 0.2, "CBO:", " " + (data.cbo ?? ""));
  labelBoldField(margin + innerW * 0.65, y, innerW * 0.35, "Setor:", " " + (data.setor ?? ""));
  y += rowH;

  // Helper: barra de título de seção (fundo cinza)
  const sectionBar = (title: string) => {
    ensureSpace(5 + 6);
    doc.setFillColor(225, 225, 225);
    doc.rect(margin, y, innerW, 5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(0);
    doc.text(title, margin + 1.5, y + 3.6);
    y += 5;
  };

  // Helper: bloco de texto com moldura
  const textBlock = (text: string, opts?: { minH?: number; italic?: boolean; size?: number }) => {
    const size = opts?.size ?? 8;
    doc.setFont("helvetica", opts?.italic ? "italic" : "normal");
    doc.setFontSize(size);
    const lineH = size * 0.42;
    const lines = doc.splitTextToSize(text || "", innerW - 3);
    const h = Math.max(opts?.minH ?? 0, lines.length * lineH + 2);
    ensureSpace(h);
    doc.rect(margin, y, innerW, h);
    doc.setTextColor(0);
    doc.text(lines, margin + 1.5, y + lineH + 0.5);
    y += h;
  };

  // ====================== 1. Descrição da Atividade ======================
  sectionBar("1. Descrição da Atividade:");
  textBlock(data.conteudo.descricao_atividades || "", { minH: 22 });

  // Bloco "Caro empregado"
  textBlock("Caro empregado,\n" + TXT_CARO_EMPREGADO, { size: 7 });

  // ====================== 2. Risco Ocupacional ======================
  sectionBar("2. Risco Ocupacional:");
  // Prioridade: campos estruturados > parser do texto livre > texto cru.
  const cats =
    data.conteudo.riscos_categorias ??
    parseRiscosTexto(data.conteudo.riscos_texto || "");
  if (cats) {
    const rows: Array<[string, string]> = [
      ["Físico:", cats.fisico || "—"],
      ["Químico:", cats.quimico || "—"],
      ["Biológico:", cats.biologico || "—"],
      ["Ergonômico:", cats.ergonomico || "—"],
      ["Acidente/Mecânico:", cats.acidente || "—"],
      ["Psicossocial:", cats.psicossocial || "—"],
    ];
    // bloco com labels em bold e valor à frente
    doc.setFontSize(8);
    const lineH = 4.2;
    const padding = 1.4;
    const labelColW = 32;
    // calcula altura considerando wrap dos valores
    let totalH = padding * 2;
    const wrapped = rows.map(([, v]) =>
      doc.splitTextToSize(v, innerW - labelColW - 4),
    );
    wrapped.forEach((w) => { totalH += Math.max(lineH, w.length * lineH); });
    doc.rect(margin, y, innerW, totalH);
    let cy = y + padding + 3;
    rows.forEach(([lab, val], i) => {
      doc.setFont("helvetica", "bold");
      doc.text(lab, margin + 1.5, cy);
      doc.setFont("helvetica", "normal");
      doc.text(wrapped[i], margin + 1.5 + labelColW, cy);
      cy += Math.max(lineH, wrapped[i].length * lineH);
    });
    y += totalH;
    // medidas preventivas, se houver, vão num bloco abaixo (mantém compat)
    if (data.conteudo.medidas_preventivas?.trim()) {
      textBlock("Medidas preventivas: " + data.conteudo.medidas_preventivas.trim(), { size: 7.5 });
    }
  } else {
    const riscosTxt = [data.conteudo.riscos_texto, data.conteudo.medidas_preventivas]
      .filter((s) => s && s.trim()).join("\n");
    textBlock(riscosTxt, { minH: 22 });
  }

  // ====================== 3. EPIs de Uso Obrigatório ======================
  sectionBar("3. EPI's de Uso Obrigatório");
  const epis = parseEpis(data.conteudo.epis_obrigatorios, data.episCatalog);
  // pareia em 2 colunas
  const rows: Array<[string, string, string, string]> = [];
  const minRows = 5;
  for (let i = 0; i < epis.length; i += 2) {
    rows.push([
      epis[i]?.desc ?? "", epis[i]?.ca ?? "",
      epis[i + 1]?.desc ?? "", epis[i + 1]?.ca ?? "",
    ]);
  }
  while (rows.length < minRows) rows.push(["", "", "", ""]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.2, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: 0 },
    head: [["Descrição", "CA", "Descrição", "CA"]],
    headStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: "bold", halign: "left" },
    body: rows,
    columnStyles: {
      0: { cellWidth: innerW * 0.38 },
      1: { cellWidth: innerW * 0.12, halign: "center" },
      2: { cellWidth: innerW * 0.38 },
      3: { cellWidth: innerW * 0.12, halign: "center" },
    },
    tableWidth: innerW,
  });
  // @ts-expect-error lastAutoTable
  y = doc.lastAutoTable.finalY;

  // ====================== 4. Procedimento - Máquinas e Equipamentos ======================
  sectionBar("4. Procedimento - Máquinas e Equipamentos");
  textBlock(TXT_SEC4_MAQUINAS, { size: 7.5 });

  // ====================== 5. Meios de prevenção ======================
  sectionBar("5. Meios de prevenção e controle dos riscos");
  textBlock(TXT_SEC5_PREVENCAO, { size: 7 });

  // ====================== 6. Prevenção Contra Incêndios ======================
  sectionBar("6. Prevenção Contra Incêndios");
  textBlock(TXT_SEC6_INCENDIO, { size: 7.5 });

  // ====================== 7. Procedimentos em caso de acidentes ======================
  sectionBar("7. Procedimentos em caso de acidentes");
  textBlock(TXT_SEC7_ACIDENTES, { size: 7.5 });

  // ====================== 8. Observações ======================
  sectionBar("8. Observações");
  const obsExtras = [data.conteudo.proibicoes, data.conteudo.penalidades, data.conteudo.procedimentos_emergencia]
    .filter((s) => s && s.trim()).join("\n");
  const obsTxt = obsExtras ? `${TXT_SEC8_OBS}\n${obsExtras}` : TXT_SEC8_OBS;
  textBlock(obsTxt, { size: 7.5 });

  // ====================== TERMO DE RESPONSABILIDADE ======================
  // Mantém o TERMO + assinaturas sempre na mesma página (não cortar no meio).
  ensureSpace(5 + 14 + 22);
  // Barra de título centralizada
  doc.setFillColor(225, 225, 225);
  doc.rect(margin, y, innerW, 5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("TERMO DE RESPONSABILIDADE", W / 2, y + 3.6, { align: "center" });
  y += 5;

  textBlock(TXT_TERMO, { size: 8, minH: 8 });

  // ====================== ASSINATURAS ======================
  const sigH = 22;
  ensureSpace(sigH);
  doc.rect(margin, y, innerW, sigH);
  doc.line(margin + innerW / 2, y, margin + innerW / 2, y + sigH);

  const sigY = y + sigH - 8;
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.line(margin + 10, sigY, margin + innerW / 2 - 10, sigY);
  doc.line(margin + innerW / 2 + 10, sigY, margin + innerW - 10, sigY);

  // Assinatura digital do colaborador, se cadastrada na ficha
  if (data.assinaturaColaboradorDataUrl) {
    try {
      const url = data.assinaturaColaboradorDataUrl;
      const m = /^data:image\/(png|jpeg|jpg|webp);base64,/i.exec(url);
      const fmt = (m?.[1] ?? "png").toUpperCase().replace("JPG", "JPEG");
      const props = (doc as any).getImageProperties?.(url);
      const maxH = 12;
      const maxW = innerW / 2 - 24;
      let imgH = maxH;
      let imgW = imgH * 2.5;
      if (props?.width && props?.height) {
        const ratio = props.width / props.height;
        imgH = maxH;
        imgW = imgH * ratio;
        if (imgW > maxW) { imgW = maxW; imgH = imgW / ratio; }
      }
      const cx = margin + innerW / 4;
      doc.addImage(url, fmt === "WEBP" ? "PNG" : fmt, cx - imgW / 2, sigY - imgH - 0.5, imgW, imgH, undefined, "FAST");
    } catch (err) {
      console.error("[oss-pdf] falha ao inserir assinatura do colaborador:", err);
    }
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Assinatura do Empregado", margin + innerW / 4, sigY + 4, { align: "center" });
  doc.text("Responsável Técnico", margin + (innerW * 3) / 4, sigY + 4, { align: "center" });
  doc.setFontSize(7);
  doc.text("Assinatura e Carimbo", margin + (innerW * 3) / 4, sigY + 7.5, { align: "center" });

  return doc;
}
