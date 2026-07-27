import type { AihaClass } from "@/lib/aiha";

export type Hierarquia = "ELIMINACAO" | "SUBSTITUICAO" | "ENGENHARIA" | "ADMINISTRATIVA" | "EPI";
export type Prioridade = "BAIXA" | "MEDIA" | "ALTA" | "IMEDIATA";

export type AcaoBiblioteca = {
  id: string;
  categoria: string;
  perigo_padrao: string;
  palavras_chave: string[];
  niveis: string[];
  acao: string;
  como: string | null;
  hierarquia: Hierarquia;
  prioridade: Prioridade;
  prazo_dias: number;
  norma_ref: string | null;
  ativo: boolean;
};

export const HIERARQUIA_LABEL: Record<Hierarquia, string> = {
  ELIMINACAO: "1 · Eliminação",
  SUBSTITUICAO: "2 · Substituição",
  ENGENHARIA: "3 · Engenharia",
  ADMINISTRATIVA: "4 · Administrativa",
  EPI: "5 · EPI",
};

export const HIERARQUIA_ORDEM: Record<Hierarquia, number> = {
  ELIMINACAO: 1, SUBSTITUICAO: 2, ENGENHARIA: 3, ADMINISTRATIVA: 4, EPI: 5,
};

export const HIERARQUIA_COLOR: Record<Hierarquia, string> = {
  ELIMINACAO: "bg-emerald-100 text-emerald-800 border-emerald-300",
  SUBSTITUICAO: "bg-teal-100 text-teal-800 border-teal-300",
  ENGENHARIA: "bg-sky-100 text-sky-800 border-sky-300",
  ADMINISTRATIVA: "bg-amber-100 text-amber-800 border-amber-300",
  EPI: "bg-slate-100 text-slate-700 border-slate-300",
};

export const PRIORIDADE_LABEL: Record<Prioridade, string> = {
  BAIXA: "Baixa", MEDIA: "Média", ALTA: "Alta", IMEDIATA: "Imediata",
};

export const PRIORIDADE_ORDEM: Record<Prioridade, number> = {
  IMEDIATA: 0, ALTA: 1, MEDIA: 2, BAIXA: 3,
};

export const PRIORIDADE_COLOR: Record<Prioridade, string> = {
  IMEDIATA: "bg-rose-100 text-rose-800 border-rose-300",
  ALTA: "bg-orange-100 text-orange-800 border-orange-300",
  MEDIA: "bg-amber-100 text-amber-800 border-amber-300",
  BAIXA: "bg-slate-100 text-slate-700 border-slate-300",
};

/** Prioridade derivada do nível de risco (NR-01 — priorização por grau) */
export function prioridadePorNivel(cls: AihaClass): Prioridade {
  switch (cls) {
    case "MUITO_ALTO": return "IMEDIATA";
    case "ALTO": return "ALTA";
    case "MODERADO": return "MEDIA";
    default: return "BAIXA";
  }
}

/** Prazo padrão (dias) por nível de risco */
export function prazoPorNivel(cls: AihaClass): number {
  switch (cls) {
    case "MUITO_ALTO": return 7;
    case "ALTO": return 30;
    case "MODERADO": return 90;
    default: return 180;
  }
}

export function prazoParaData(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export type AcaoSugerida = AcaoBiblioteca & { score: number };

/**
 * Casa um perigo do inventário com a biblioteca normativa.
 * Pontua por: nível aplicável, categoria igual, palavras-chave presentes no texto do perigo.
 */
export function sugerirAcoes(
  bib: AcaoBiblioteca[],
  args: { perigo: string; categoria: string; classificacao: AihaClass; agravo?: string | null; fonte?: string | null },
): AcaoSugerida[] {
  const alvo = norm([args.perigo, args.agravo ?? "", args.fonte ?? ""].join(" "));
  const cls = args.classificacao;
  const out: AcaoSugerida[] = [];

  for (const b of bib) {
    if (b.ativo === false) continue;
    if (cls !== "NAO_CLASSIFICADO" && b.niveis.length > 0 && !b.niveis.includes(cls)) continue;

    let score = 0;
    const geral = b.categoria === "GERAL";
    if (b.categoria === args.categoria) score += 3;
    if (norm(b.perigo_padrao) === norm(args.perigo)) score += 6;

    let hits = 0;
    for (const kw of b.palavras_chave) {
      const k = norm(kw).trim();
      if (k.length >= 3 && alvo.includes(k)) hits++;
    }
    score += hits * 2;

    if (geral) {
      // Ações transversais entram sempre, mas com peso baixo
      out.push({ ...b, score: 1 });
      continue;
    }
    if (score >= 4 || hits >= 1) out.push({ ...b, score });
  }

  return out.sort(
    (a, b) =>
      b.score - a.score ||
      HIERARQUIA_ORDEM[a.hierarquia] - HIERARQUIA_ORDEM[b.hierarquia] ||
      PRIORIDADE_ORDEM[a.prioridade] - PRIORIDADE_ORDEM[b.prioridade],
  );
}