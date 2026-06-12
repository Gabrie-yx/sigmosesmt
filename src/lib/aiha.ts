// Matriz AIHA 5x5 — usada no PGR (Sev × Prob = Risco)
// Conforme PGR DMN 2026: Trivial / Baixo / Moderado / Alto / Muito Alto

export type AihaClass = "TRIVIAL" | "BAIXO" | "MODERADO" | "ALTO" | "MUITO_ALTO" | "NAO_CLASSIFICADO";

export const AIHA_LABEL: Record<AihaClass, string> = {
  TRIVIAL: "Trivial",
  BAIXO: "Baixo",
  MODERADO: "Moderado",
  ALTO: "Alto",
  MUITO_ALTO: "Muito Alto",
  NAO_CLASSIFICADO: "Não classificado",
};

// Cores oficiais AIHA / PGR DMN
export const AIHA_COLOR: Record<AihaClass, string> = {
  TRIVIAL: "bg-emerald-100 text-emerald-800 border-emerald-300",
  BAIXO: "bg-lime-100 text-lime-800 border-lime-300",
  MODERADO: "bg-amber-100 text-amber-800 border-amber-300",
  ALTO: "bg-orange-100 text-orange-800 border-orange-300",
  MUITO_ALTO: "bg-rose-100 text-rose-800 border-rose-300",
  NAO_CLASSIFICADO: "bg-slate-100 text-slate-600 border-slate-200",
};

// Cor "cheia" pra cell da matriz
export const AIHA_CELL: Record<AihaClass, string> = {
  TRIVIAL: "bg-emerald-500 text-white",
  BAIXO: "bg-lime-500 text-white",
  MODERADO: "bg-amber-500 text-white",
  ALTO: "bg-orange-500 text-white",
  MUITO_ALTO: "bg-rose-600 text-white",
  NAO_CLASSIFICADO: "bg-slate-200 text-slate-500",
};

// Priorização textual conforme PGR DMN
export const AIHA_PRIORIZACAO: Record<AihaClass, string> = {
  TRIVIAL: "Irrelevante",
  BAIXO: "Satisfatório",
  MODERADO: "De Atenção",
  ALTO: "Crítica",
  MUITO_ALTO: "Não Tolerável",
  NAO_CLASSIFICADO: "—",
};

/**
 * Classifica o risco a partir de Severidade (1-5) × Probabilidade (1-5).
 * Faixas (R = S*P):
 *   1-3   Trivial
 *   4-6   Baixo
 *   8-10  Moderado
 *   12-15 Alto
 *   16-25 Muito Alto
 */
export function classifyAiha(prob?: number | null, sev?: number | null): AihaClass {
  if (!prob || !sev) return "NAO_CLASSIFICADO";
  const r = prob * sev;
  if (r <= 3) return "TRIVIAL";
  if (r <= 6) return "BAIXO";
  if (r <= 10) return "MODERADO";
  if (r <= 15) return "ALTO";
  return "MUITO_ALTO";
}

export const PROB_LABELS = [
  { v: 1, label: "Improvável" },
  { v: 2, label: "Remota" },
  { v: 3, label: "Ocasional" },
  { v: 4, label: "Provável" },
  { v: 5, label: "Frequente" },
];

export const SEV_LABELS = [
  { v: 1, label: "Insignificante" },
  { v: 2, label: "Marginal" },
  { v: 3, label: "Moderada" },
  { v: 4, label: "Crítica" },
  { v: 5, label: "Catastrófica" },
];

export const CATEGORIA_LABEL: Record<string, string> = {
  FISICO: "Físico",
  QUIMICO: "Químico",
  BIOLOGICO: "Biológico",
  ERGONOMICO: "Ergonômico",
  ACIDENTE: "Acidente",
  PSICOSSOCIAL: "Psicossocial",
};