import { renderOverlay, preloadTemplate } from "@/lib/pdf-overlay-engine";
import { PDFDocument } from "pdf-lib";
import type { PtTipo } from "@/lib/constants";

export type PtePdfParams = {
  numero?: string;
  data_inicio?: string;   // dd/mm/yyyy
  hora_inicio?: string;
  data_fim?: string;
  hora_fim?: string;
  empresa?: string;
  encarregado?: string;
  local_descricao?: string;
  tipo_pt?: PtTipo;
  mao_obra?: "INTERNA" | "EXTERNA" | null;
  fim_de_semana?: boolean | null;
  area_restrita?: boolean | null;
  atividades?: {
    movimentacao_cargas?: boolean;
    manutencao_civil?: boolean;
    gases_inflamaveis?: boolean;
    altura_telhados?: boolean;
    demolicao_escavacao?: boolean;
    eletricidade?: boolean;
    trabalho_quente?: boolean;
    local_confinado?: boolean;
    outros?: boolean;
  };
  outros_atividade_texto?: string;
  riscos_potenciais?: Record<string, boolean>;
  outros_risco_texto?: string;
  preenchimento_snna?: Record<string, "S" | "N" | "NA" | "">;
  outros_snna_texto?: string;
  precaucao_quente?: Record<string, boolean>;
  teste_atmosfera_horario?: string;
  teste_atmosfera_percentual?: string;
  designado_liberacao?: string;
  precaucao_altura?: Record<string, boolean>;
  precaucao_eletrica?: Record<string, boolean>;
  responsavel_bloqueio?: string;
  precaucao_carga?: Record<string, boolean>;
  precaucao_pintura?: Record<string, boolean>;
  epis_col1?: Record<string, boolean>;
  epis_col2?: Record<string, boolean>;
  outros_epi?: Record<string, boolean>;
  recomendacoes_adicionais?: string;
  equipe_lista?: { nome?: string; funcao?: string }[];
  assinatura_encarregado_nome?: string;
  assinatura_gerente_nome?: string;
  /** Assinatura do TST (Segurança do Trabalho) em data URL PNG — carimba pg 2. */
  assinatura_tst_data_url?: string | null;
  /** Assinatura do Encarregado em data URL PNG — carimba pg 2 (col 1). */
  assinatura_encarregado_data_url?: string | null;
  /** Assinatura do Gerente em data URL PNG — carimba pg 2 (col 2). */
  assinatura_gerente_data_url?: string | null;
  /** Assinatura de cada membro da equipe (mesma ordem de equipe_lista) — col 3. */
  equipe_assinaturas_data_urls?: (string | null | undefined)[];
};

function prefixChecks(prefix: string, values?: Record<string, boolean>) {
  return Object.fromEntries(
    Object.entries(values ?? {}).map(([key, value]) => [`${prefix}_${key}`, !!value]),
  );
}

function prefixAnswers(prefix: string, values?: Record<string, "S" | "N" | "NA" | "">) {
  return Object.fromEntries(
    Object.entries(values ?? {})
      .filter(([, value]) => value === "S" || value === "N" || value === "NA")
      .map(([key, value]) => [`${prefix}_${key}`, value]),
  );
}

/**
 * Permissão de Trabalho Especial (FOR-SEG-04) — usa o PDF-mãe homologado
 * subido pelo painel de Templates e escreve só os campos variáveis por cima.
 */
export async function gerarPtePdf(p: PtePdfParams): Promise<Blob> {
  const tipo = p.tipo_pt;
  const numero = String(p.numero ?? "").replace(/^OC\s*/i, "").trim();
  // Explode a lista de equipe em campos equipe_nome_N / equipe_funcao_N (até 12 linhas do PDF)
  const equipeFields: Record<string, string> = {};
  const equipe = (p.equipe_lista ?? []).slice(0, 12);
  equipe.forEach((row, i) => {
    if (row?.nome) equipeFields[`equipe_nome_${i}`] = row.nome;
    if (row?.funcao) equipeFields[`equipe_funcao_${i}`] = row.funcao;
  });
  const base = await renderOverlay({
    codigo: "FOR-SEG-04",
    fields: {
      pt_numero: numero,
      data_inicio: p.data_inicio,
      hora_inicio: p.hora_inicio,
      data_fim: p.data_fim,
      hora_fim: p.hora_fim,
      empresa: p.empresa,
      encarregado: p.encarregado,
      local_descricao: p.local_descricao,
      outros_atividade_texto: p.outros_atividade_texto,
      outros_risco_texto: p.outros_risco_texto,
      outros_snna_texto: p.outros_snna_texto,
      teste_atmosfera_horario: p.teste_atmosfera_horario,
      teste_atmosfera_percentual: p.teste_atmosfera_percentual,
      designado_liberacao: p.designado_liberacao,
      responsavel_bloqueio: p.responsavel_bloqueio,
      recomendacoes_adicionais: p.recomendacoes_adicionais,
      assinatura_encarregado_nome: p.assinatura_encarregado_nome,
      assinatura_gerente_nome: p.assinatura_gerente_nome,
      ...equipeFields,
    },
    checkboxes: {
      movimentacao_cargas: p.atividades?.movimentacao_cargas || tipo === "PTI",
      manutencao_civil:    p.atividades?.manutencao_civil,
      gases_inflamaveis:   p.atividades?.gases_inflamaveis,
      altura_telhados:     p.atividades?.altura_telhados || tipo === "PTA",
      demolicao_escavacao: p.atividades?.demolicao_escavacao,
      eletricidade:        p.atividades?.eletricidade || tipo === "PTEL",
      trabalho_quente:     p.atividades?.trabalho_quente || tipo === "PTQ",
      local_confinado:     p.atividades?.local_confinado || tipo === "PET",
      outros_atividade:    p.atividades?.outros,
      mao_interna: p.mao_obra === "INTERNA",
      mao_externa: p.mao_obra === "EXTERNA",
      fds_sim: p.fim_de_semana === true,
      fds_nao: p.fim_de_semana === false,
      area_restrita_sim: p.area_restrita === true,
      area_restrita_nao: p.area_restrita === false,
      ...prefixChecks("ris", p.riscos_potenciais),
      ...prefixAnswers("snna", p.preenchimento_snna),
      ...prefixChecks("hot", p.precaucao_quente),
      ...prefixChecks("alt", p.precaucao_altura),
      ...prefixChecks("ele", p.precaucao_eletrica),
      ...prefixChecks("carga", p.precaucao_carga),
      ...prefixChecks("pint", p.precaucao_pintura),
      ...prefixChecks("epi1", p.epis_col1),
      ...prefixChecks("epi2", p.epis_col2),
      ...prefixChecks("outrosepi", p.outros_epi),
    },
  });
  if (!p.assinatura_tst_data_url) return base;
  // Estampa a assinatura do TST na célula "Assinatura da Segurança do Trabalho" (pg 2)
  const bytes = new Uint8Array(await base.arrayBuffer());
  const pdf = await PDFDocument.load(bytes);
  const png = await pdf.embedPng(p.assinatura_tst_data_url);
  const page = pdf.getPage(1);
  const H = page.getHeight();
  const maxW = 160, maxH = 32;
  const r = Math.min(maxW / png.width, maxH / png.height);
  const w = png.width * r, h = png.height * r;
  const cx = 459, top = 605; // centro visual da célula na coluna TST, acima do rótulo
  page.drawImage(png, {
    x: cx - w / 2,
    y: H - top - h / 2,
    width: w,
    height: h,
  });
  const out = await pdf.save();
  return new Blob([out as BlobPart], { type: "application/pdf" });
}

export async function preloadTemplatePte(): Promise<Uint8Array> {
  return preloadTemplate("FOR-SEG-04");
}