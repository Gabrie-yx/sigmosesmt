// Instrumento HSE-IT BR (Health & Safety Executive UK — Indicator Tool)
// Adaptado + itens de assédio/violência (uso livre). Base ISO 45003:2021.
// Escala Likert 1-5 (1 = nunca, 5 = sempre). Itens NEGATIVOS já invertidos:
// score alto = risco alto (padrão SIGMO).

export type PsicoItem = {
  codigo: string;
  dimensao:
    | "DEMANDAS"
    | "CONTROLE"
    | "APOIO"
    | "RECOMPENSA"
    | "PAPEL_MUDANCA"
    | "RELACOES"
    | "VIOLENCIA"
    | "INTERFACE";
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
  CONTROLE: "Controle e autonomia",
  APOIO: "Apoio social",
  RECOMPENSA: "Reconhecimento e recompensa",
  PAPEL_MUDANCA: "Papel e mudança",
  RELACOES: "Relações interpessoais",
  VIOLENCIA: "Violência e assédio",
  INTERFACE: "Interface trabalho-vida",
};

export const PSICO_ITEMS: PsicoItem[] = [
  // DEMANDAS
  { codigo: "DEM-Q1", dimensao: "DEMANDAS", texto: "Tenho prazos de trabalho impossíveis de cumprir." },
  { codigo: "DEM-Q2", dimensao: "DEMANDAS", texto: "Tenho que trabalhar em ritmo muito acelerado." },
  { codigo: "DEM-Q3", dimensao: "DEMANDAS", texto: "Meu trabalho me desgasta emocionalmente." },
  { codigo: "DEM-Q4", dimensao: "DEMANDAS", texto: "Faço horas extras com muita frequência." },

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

  // VIOLÊNCIA / ASSÉDIO
  { codigo: "VIO-Q1", dimensao: "VIOLENCIA", texto: "Já presenciei ou sofri humilhação, chantagem ou ameaça no trabalho (assédio moral)." },
  { codigo: "VIO-Q2", dimensao: "VIOLENCIA", texto: "Já presenciei ou sofri insinuação, cantada ou toque não autorizado (assédio sexual)." },
  { codigo: "VIO-Q3", dimensao: "VIOLENCIA", texto: "Já sofri discriminação (raça, gênero, orientação sexual, idade, deficiência, religião)." },
  { codigo: "VIO-Q4", dimensao: "VIOLENCIA", texto: "Já sofri violência física ou ameaça no trabalho (por colega, cliente ou terceiro)." },

  // INTERFACE TRABALHO-VIDA
  { codigo: "INT-Q1", dimensao: "INTERFACE", texto: "Sou cobrado(a) fora do meu horário de trabalho (WhatsApp, e-mail, ligação)." },
  { codigo: "INT-Q2", dimensao: "INTERFACE", texto: "Meu trabalho prejudica minha vida familiar e social." },
  { codigo: "INT-Q3", dimensao: "INTERFACE", texto: "Tenho medo de perder meu emprego." },
];

export const FAIXA_ETARIA = ["18-24", "25-34", "35-44", "45-54", "55+"];
export const FAIXA_TEMPO_CASA = ["<1 ano", "1-3 anos", "3-5 anos", "5-10 anos", "10+ anos"];

/** Normaliza o valor: se item é invertido (respondente concorda = coisa boa),
 * transforma para escala "risco alto = 5". */
export function scoreRisco(item: PsicoItem, valor: number): number {
  return item.invertido ? 6 - valor : valor;
}

/** Classificação AIHA-compatível baseada em score médio 1-5 da dimensão. */
export function classifyDimensao(mediaScore: number): {
  nivel: "TRIVIAL" | "BAIXO" | "MODERADO" | "ALTO" | "MUITO_ALTO";
  cor: string;
} {
  if (mediaScore < 2) return { nivel: "TRIVIAL", cor: "bg-emerald-500" };
  if (mediaScore < 2.75) return { nivel: "BAIXO", cor: "bg-lime-500" };
  if (mediaScore < 3.5) return { nivel: "MODERADO", cor: "bg-amber-500" };
  if (mediaScore < 4.25) return { nivel: "ALTO", cor: "bg-orange-500" };
  return { nivel: "MUITO_ALTO", cor: "bg-rose-600" };
}