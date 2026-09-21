// Instrumento SIGMO Psicossocial v2 — base ISO 45003:2021 + NR-01 (Ap. GRO).
// Núcleo original: HSE-IT (Health & Safety Executive UK — Indicator Tool).
// Dimensões complementares (Cognitivas, Emocionais, Significado) e blocos
// de outcome (Burnout, Sono) inspirados no COPSOQ II — versão portuguesa
// validada (Silva C., Amaral V., Pereira A. et al., 2011), utilizado aqui
// sob uso livre não-comercial com adaptação de redação para o contexto
// naval/industrial brasileiro.
// Escala Likert 1-5 (1 = nunca, 5 = sempre). Itens NEGATIVOS já invertidos:
// score alto = risco alto (padrão SIGMO).

export const INSTRUMENTO_CITACAO =
  "Instrumento SIGMO Psicossocial v2 — baseado em HSE Management Standards " +
  "(HSE-UK) e COPSOQ II Portugal (Silva et al., 2011), aderente à ISO " +
  "45003:2021 e NR-01 (Apêndice GRO). Uso interno, não-comercial.";

export type PsicoItem = {
  codigo: string;
  dimensao:
    | "DEMANDAS"
    | "COGNITIVAS"
    | "EMOCIONAIS"
    | "CONTROLE"
    | "APOIO"
    | "RECOMPENSA"
    | "PAPEL_MUDANCA"
    | "RELACOES"
    | "SIGNIFICADO"
    | "VIOLENCIA"
    | "INTERFACE"
    | "BURNOUT"
    | "SONO";
  texto: string;
  invertido?: boolean; // se true, respondente 1 = risco 5 (calcular na análise)
};

export const LIKERT_LABELS = [
  { v: 1, label: "Nunca" },
  { v: 2, label: "Raramente" },
  { v: 3, label: "Às vezes" },
  { v: 4, label: "Frequentemente" },
  { v: 5, label: "Sempre" },
];

export const DIMENSAO_LABEL: Record<PsicoItem["dimensao"], string> = {
  DEMANDAS: "Demandas do trabalho",
  COGNITIVAS: "Exigências cognitivas",
  EMOCIONAIS: "Exigências emocionais",
  CONTROLE: "Controle e autonomia",
  APOIO: "Apoio social",
  RECOMPENSA: "Reconhecimento e recompensa",
  PAPEL_MUDANCA: "Papel e mudança",
  RELACOES: "Relações interpessoais",
  SIGNIFICADO: "Significado do trabalho",
  VIOLENCIA: "Violência e assédio",
  INTERFACE: "Interface trabalho-vida",
  BURNOUT: "Burnout (esgotamento)",
  SONO: "Qualidade do sono",
};

/** Tipo de dimensão para separação causa (fator de risco) x efeito (outcome). */
export const DIMENSAO_TIPO: Record<PsicoItem["dimensao"], "FATOR" | "OUTCOME"> = {
  DEMANDAS: "FATOR",
  COGNITIVAS: "FATOR",
  EMOCIONAIS: "FATOR",
  CONTROLE: "FATOR",
  APOIO: "FATOR",
  RECOMPENSA: "FATOR",
  PAPEL_MUDANCA: "FATOR",
  RELACOES: "FATOR",
  SIGNIFICADO: "FATOR",
  VIOLENCIA: "FATOR",
  INTERFACE: "FATOR",
  BURNOUT: "OUTCOME",
  SONO: "OUTCOME",
};

export const PSICO_ITEMS: PsicoItem[] = [
  // DEMANDAS
  { codigo: "DEM-Q1", dimensao: "DEMANDAS", texto: "Tenho prazos de trabalho impossíveis de cumprir." },
  { codigo: "DEM-Q2", dimensao: "DEMANDAS", texto: "Tenho que trabalhar em ritmo muito acelerado." },
  { codigo: "DEM-Q3", dimensao: "DEMANDAS", texto: "Meu trabalho me desgasta emocionalmente." },
  { codigo: "DEM-Q4", dimensao: "DEMANDAS", texto: "Faço horas extras com muita frequência." },

  // EXIGÊNCIAS COGNITIVAS (novo — inspirado COPSOQ II)
  { codigo: "COG-Q1", dimensao: "COGNITIVAS", texto: "Meu trabalho exige que eu tome decisões difíceis." },
  { codigo: "COG-Q2", dimensao: "COGNITIVAS", texto: "Meu trabalho exige que eu memorize muitas informações ao mesmo tempo." },
  { codigo: "COG-Q3", dimensao: "COGNITIVAS", texto: "Meu trabalho exige atenção constante para evitar erros graves." },

  // EXIGÊNCIAS EMOCIONAIS (separada de DEM-Q3 — inspirado COPSOQ II)
  { codigo: "EMO-Q1", dimensao: "EMOCIONAIS", texto: "Meu trabalho me coloca em situações emocionalmente perturbadoras." },
  { codigo: "EMO-Q2", dimensao: "EMOCIONAIS", texto: "Tenho que esconder o que sinto para conseguir realizar meu trabalho." },
  { codigo: "EMO-Q3", dimensao: "EMOCIONAIS", texto: "Lido com sofrimento humano (acidentes, doenças, perdas) no meu trabalho." },

  // CONTROLE
  { codigo: "CTR-Q1", dimensao: "CONTROLE", texto: "Tenho autonomia para decidir COMO executar meu trabalho.", invertido: true },
  { codigo: "CTR-Q2", dimensao: "CONTROLE", texto: "Posso decidir QUANDO fazer pausas.", invertido: true },
  { codigo: "CTR-Q3", dimensao: "CONTROLE", texto: "Sou consultado(a) sobre mudanças que afetam meu trabalho.", invertido: true },

  // APOIO
  { codigo: "APO-Q1", dimensao: "APOIO", texto: "Recebo apoio da minha liderança quando preciso.", invertido: true },
  { codigo: "APO-Q2", dimensao: "APOIO", texto: "Meus colegas me ajudam quando o trabalho aperta.", invertido: true },
  { codigo: "APO-Q3", dimensao: "APOIO", texto: "Recebo feedback claro sobre meu desempenho.", invertido: true },

  // RECOMPENSA
  { codigo: "REC-Q1", dimensao: "RECOMPENSA", texto: "Sinto que meu trabalho é reconhecido.", invertido: true },
  { codigo: "REC-Q2", dimensao: "RECOMPENSA", texto: "Vejo perspectivas de crescimento na empresa.", invertido: true },

  // PAPEL E MUDANÇA
  { codigo: "PAP-Q1", dimensao: "PAPEL_MUDANCA", texto: "Sei claramente o que se espera de mim no trabalho.", invertido: true },
  { codigo: "PAP-Q2", dimensao: "PAPEL_MUDANCA", texto: "Recebo ordens contraditórias de pessoas diferentes." },
  { codigo: "PAP-Q3", dimensao: "PAPEL_MUDANCA", texto: "Mudanças na empresa são comunicadas com antecedência.", invertido: true },

  // RELAÇÕES
  { codigo: "REL-Q1", dimensao: "RELACOES", texto: "Existem conflitos interpessoais não resolvidos na equipe." },
  { codigo: "REL-Q2", dimensao: "RELACOES", texto: "Sinto-me respeitado(a) pelos meus colegas.", invertido: true },

  // SIGNIFICADO DO TRABALHO (novo — inspirado COPSOQ II)
  { codigo: "SIG-Q1", dimensao: "SIGNIFICADO", texto: "Meu trabalho tem significado para mim.", invertido: true },
  { codigo: "SIG-Q2", dimensao: "SIGNIFICADO", texto: "Sinto orgulho de trabalhar nesta empresa.", invertido: true },
  { codigo: "SIG-Q3", dimensao: "SIGNIFICADO", texto: "O que faço no meu trabalho é importante para o resultado da empresa.", invertido: true },

  // VIOLÊNCIA / ASSÉDIO
  { codigo: "VIO-Q1", dimensao: "VIOLENCIA", texto: "Já presenciei ou sofri humilhação, chantagem ou ameaça no trabalho (assédio moral)." },
  { codigo: "VIO-Q2", dimensao: "VIOLENCIA", texto: "Já presenciei ou sofri insinuação, cantada ou toque não autorizado (assédio sexual)." },
  { codigo: "VIO-Q3", dimensao: "VIOLENCIA", texto: "Já sofri discriminação (raça, gênero, orientação sexual, idade, deficiência, religião)." },
  { codigo: "VIO-Q4", dimensao: "VIOLENCIA", texto: "Já sofri violência física ou ameaça no trabalho (por colega, cliente ou terceiro)." },

  // INTERFACE TRABALHO-VIDA
  { codigo: "INT-Q1", dimensao: "INTERFACE", texto: "Sou cobrado(a) fora do meu horário de trabalho (WhatsApp, e-mail, ligação)." },
  { codigo: "INT-Q2", dimensao: "INTERFACE", texto: "Meu trabalho prejudica minha vida familiar e social." },
  { codigo: "INT-Q3", dimensao: "INTERFACE", texto: "Tenho medo de perder meu emprego." },

  // OUTCOMES — BURNOUT (CBI curto adaptado; efeito, não causa)
  { codigo: "BUR-Q1", dimensao: "BURNOUT", texto: "Sinto-me esgotado(a) no fim do dia de trabalho." },
  { codigo: "BUR-Q2", dimensao: "BURNOUT", texto: "Sinto-me exausto(a) pela manhã só de pensar em mais um dia de trabalho." },
  { codigo: "BUR-Q3", dimensao: "BURNOUT", texto: "Cada hora de trabalho é cansativa para mim." },

  // OUTCOMES — SONO
  { codigo: "SON-Q1", dimensao: "SONO", texto: "Tenho dificuldade para dormir por causa de preocupações com o trabalho." },
  { codigo: "SON-Q2", dimensao: "SONO", texto: "Acordo cansado(a), como se não tivesse descansado." },
];

export const FAIXA_ETARIA = ["18-24", "25-34", "35-44", "45-54", "55+"];
export const FAIXA_TEMPO_CASA = ["<1 ano", "1-3 anos", "3-5 anos", "5-10 anos", "10+ anos"];

/**
 * Tercis de referência COPSOQ II — versão portuguesa (Silva et al., 2011).
 * Valores adaptados para escala Likert 1-5 (P33 e P66 correspondem aos
 * limites verde→amarelo e amarelo→vermelho). Usados como FALLBACK quando
 * a base interna do SIGMO ainda não atingiu N mínimo para calcular
 * tercis empíricos próprios. Convenção: score alto = risco alto.
 */
export const TERCIS_MANUAL_PT: Record<PsicoItem["dimensao"], { p33: number; p66: number }> = {
  DEMANDAS:       { p33: 2.33, p66: 3.66 },
  COGNITIVAS:     { p33: 2.75, p66: 3.75 }, // COPSOQ PT: 69% da população no vermelho
  EMOCIONAIS:     { p33: 2.33, p66: 3.33 },
  CONTROLE:       { p33: 2.33, p66: 3.66 },
  APOIO:          { p33: 2.33, p66: 3.66 },
  RECOMPENSA:     { p33: 2.33, p66: 3.66 },
  PAPEL_MUDANCA:  { p33: 2.33, p66: 3.66 },
  RELACOES:       { p33: 2.33, p66: 3.66 },
  SIGNIFICADO:    { p33: 2.33, p66: 3.66 },
  VIOLENCIA:      { p33: 1.25, p66: 1.50 }, // tolerância zero: qualquer sinal já pesa
  INTERFACE:      { p33: 2.33, p66: 3.66 },
  BURNOUT:        { p33: 2.50, p66: 3.50 },
  SONO:           { p33: 2.33, p66: 3.33 },
};

/** N mínimo de respostas históricas por dimensão para adotar tercil empírico. */
export const TERCIS_N_MINIMO = 100;

export type TercisMap = Partial<Record<
  PsicoItem["dimensao"],
  { p33: number; p66: number; n: number; fonte: "INTERNO" | "MANUAL_PT" }
>>;

/**
 * Classifica uma média (1-5) de dimensão usando tercis dinâmicos quando
 * disponíveis, com fallback automático para tercis do manual COPSOQ II PT.
 * VIOLENCIA sempre mantém regra de tolerância zero.
 */
export function classifyByTercis(
  media: number,
  dimensao: PsicoItem["dimensao"] | string,
  tercis?: TercisMap,
): { nivel: "BAIXO" | "MODERADO" | "ALTO" | "CRITICO"; cor: string; label: string; fonte: "INTERNO" | "MANUAL_PT" } {
  const dim = dimensao as PsicoItem["dimensao"];
  if (dim === "VIOLENCIA" && media >= 1.5) {
    return { nivel: "CRITICO", cor: "bg-[#e74c3c]", label: "Risco crítico", fonte: "MANUAL_PT" };
  }
  const t = tercis?.[dim] ?? { ...TERCIS_MANUAL_PT[dim] ?? { p33: 2.33, p66: 3.66 }, n: 0, fonte: "MANUAL_PT" as const };
  const fonte = t.fonte;
  if (media < t.p33) return { nivel: "BAIXO",    cor: "bg-[#2ecc71]",                    label: "Baixo risco",    fonte };
  if (media < t.p66) return { nivel: "MODERADO", cor: "bg-[#f7d842] !text-slate-900",    label: "Risco moderado", fonte };
  if (media < 4.25)  return { nivel: "ALTO",     cor: "bg-[#f39c12]",                    label: "Alto risco",     fonte };
  return { nivel: "CRITICO", cor: "bg-[#e74c3c]", label: "Risco crítico", fonte };
}

/** Normaliza o valor: se item é invertido (respondente concorda = coisa boa),
 * transforma para escala "risco alto = 5". */
export function scoreRisco(item: PsicoItem, valor: number): number {
  return item.invertido ? 6 - valor : valor;
}

/* ============================================================================
 * MATRIZ 5×5 PROBABILIDADE × SEVERIDADE (NR-01 / diretriz 2026)
 * Fonte única de verdade do módulo psicossocial: diagnóstico, plano 5W2H e
 * parecer PDF usam SOMENTE estas funções (antes havia 4 implementações
 * divergentes de classificação).
 * ==========================================================================*/

export type NivelRisco = "BAIXO" | "MODERADO" | "ALTO" | "CRITICO";

export const PROBABILIDADE_LABEL = ["Rara", "Baixa", "Média", "Alta", "Muito alta"];
export const SEVERIDADE_LABEL = ["Leve", "Moderado", "Grave", "Muito grave", "Crítica"];

/** Severidade (1-5) do agravo associado a cada dimensão — ISO 45003 + Guia MTE. */
export const SEVERIDADE_DIMENSAO: Record<PsicoItem["dimensao"], number> = {
  VIOLENCIA: 5,
  BURNOUT: 4,
  SONO: 4,
  EMOCIONAIS: 4,
  DEMANDAS: 4,
  RELACOES: 4,
  INTERFACE: 3,
  APOIO: 3,
  CONTROLE: 3,
  PAPEL_MUDANCA: 3,
  COGNITIVAS: 3,
  RECOMPENSA: 2,
  SIGNIFICADO: 2,
};

/** Matriz 5×5 — índice [probabilidade-1][severidade-1]. */
export const MATRIZ_5X5: NivelRisco[][] = [
  /* Rara       */ ["BAIXO", "BAIXO", "BAIXO", "MODERADO", "ALTO"],
  /* Baixa      */ ["BAIXO", "BAIXO", "MODERADO", "ALTO", "ALTO"],
  /* Média      */ ["BAIXO", "MODERADO", "MODERADO", "ALTO", "CRITICO"],
  /* Alta       */ ["MODERADO", "MODERADO", "ALTO", "CRITICO", "CRITICO"],
  /* Muito alta */ ["MODERADO", "ALTO", "ALTO", "CRITICO", "CRITICO"],
];

/** Prazo máximo de tratamento por nível (NR-01 1.5.5.2 — plano de ação). */
export const PRAZO_POR_NIVEL: Record<NivelRisco, number> = {
  BAIXO: 90,
  MODERADO: 60,
  ALTO: 30,
  CRITICO: 7,
};

export const ACAO_POR_NIVEL: Record<NivelRisco, string> = {
  BAIXO: "Manter canais internos de escuta e monitorar na próxima reavaliação.",
  MODERADO: "Ajustar metas, reforçar treinamento e acompanhamento da liderança.",
  ALTO: "Ajustar carga horária e pausas (NR-17), com acompanhamento formal.",
  CRITICO: "Intervenção imediata, encaminhamento ao PCMSO e apuração formal.",
};

export const COR_NIVEL: Record<NivelRisco, string> = {
  BAIXO: "bg-[#2ecc71]",
  MODERADO: "bg-[#f7d842] !text-slate-900",
  ALTO: "bg-[#f39c12]",
  CRITICO: "bg-[#e74c3c]",
};

export const RGB_NIVEL: Record<NivelRisco, [number, number, number]> = {
  BAIXO: [0x2e, 0xcc, 0x71],
  MODERADO: [0xf7, 0xd8, 0x42],
  ALTO: [0xf3, 0x9c, 0x12],
  CRITICO: [0xe7, 0x4c, 0x3c],
};

export const LABEL_NIVEL: Record<NivelRisco, string> = {
  BAIXO: "Baixo",
  MODERADO: "Moderado",
  ALTO: "Alto",
  CRITICO: "Crítico",
};

/** Probabilidade (1-5) derivada da média Likert da dimensão. */
export function probabilidadeDeMedia(media: number): number {
  if (media < 1.8) return 1;
  if (media < 2.6) return 2;
  if (media < 3.4) return 3;
  if (media < 4.2) return 4;
  return 5;
}

export type AvaliacaoRisco = {
  probabilidade: number;
  severidade: number;
  nivel: NivelRisco;
  label: string;
  cor: string;
  rgb: [number, number, number];
  prazoDias: number;
  acao: string;
};

/**
 * Avaliação oficial do risco psicossocial: cruza probabilidade (derivada da
 * média das respostas) com a severidade do agravo da dimensão na matriz 5×5.
 * Violência/assédio mantém tolerância zero (≥ 1,5 = crítico imediato).
 */
export function avaliarRiscoPsico(media: number, dimensao: string): AvaliacaoRisco {
  const dim = dimensao as PsicoItem["dimensao"];
  const severidade = SEVERIDADE_DIMENSAO[dim] ?? 3;
  const probabilidade = probabilidadeDeMedia(media);
  let nivel = MATRIZ_5X5[probabilidade - 1][severidade - 1];
  if (dim === "VIOLENCIA" && media >= 1.5) nivel = "CRITICO";
  return {
    probabilidade,
    severidade,
    nivel,
    label: LABEL_NIVEL[nivel],
    cor: COR_NIVEL[nivel],
    rgb: RGB_NIVEL[nivel],
    prazoDias: PRAZO_POR_NIVEL[nivel],
    acao: ACAO_POR_NIVEL[nivel],
  };
}
