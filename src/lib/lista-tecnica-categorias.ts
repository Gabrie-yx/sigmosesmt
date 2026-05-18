// Categorização de materiais da Lista Técnica SAP B51
// Inferimos a categoria pela descrição do material (e código SAP como fallback).

export type CategoriaMaterial = "FERRO" | "SOLDA" | "GÁS" | "TINTA" | "OUTROS";

export const CATEGORIAS: CategoriaMaterial[] = ["FERRO", "SOLDA", "GÁS", "TINTA", "OUTROS"];

// Token semântico do design system para cada categoria
export const CATEGORIA_COR: Record<CategoriaMaterial, string> = {
  FERRO: "hsl(var(--chart-1, var(--primary)))",
  SOLDA: "hsl(var(--chart-2, var(--accent)))",
  "GÁS": "hsl(var(--chart-3, var(--secondary)))",
  TINTA: "hsl(var(--chart-4, var(--muted-foreground)))",
  OUTROS: "hsl(var(--chart-5, var(--border)))",
};

// Fallback usando variáveis OKLCH do projeto
export const CATEGORIA_CLASSE: Record<CategoriaMaterial, string> = {
  FERRO: "bg-primary",
  SOLDA: "bg-accent",
  "GÁS": "bg-secondary",
  TINTA: "bg-muted-foreground",
  OUTROS: "bg-border",
};

const norm = (s?: string | null) =>
  (s ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export function classificarMaterial(descricao?: string | null, codigo?: string | null): CategoriaMaterial {
  const d = norm(descricao);
  const c = norm(codigo);

  if (/(tinta|primer|interlac|interprime|international|esmalte|epoxi|diluente|thinner|solvente|verniz)/.test(d)) {
    return "TINTA";
  }
  if (/(oxigenio|oxig|argonio|argon|acetileno|gas\b|gas carbon|co2|nitrogenio|mistura)/.test(d)) {
    return "GÁS";
  }
  if (/(solda|eletrodo|arame|fluxo|vareta|tig|mig)/.test(d)) {
    return "SOLDA";
  }
  if (/(tubo|chapa|barra|perfil|cantoneira|aco|aço|ferro|parafuso|porca|arruela|flange|cotovelo|reducao|valvula|niple|luva|bocal|terminal|respaldo|galvaniz)/.test(d)) {
    return "FERRO";
  }
  if (/^3000(0[0-9]|1[0-9]|2[0-9]|3[0-9])/.test(c)) return "FERRO";
  return "OUTROS";
}