/**
 * Regras de detecção automática de exigência de PTE a partir dos riscos da APR.
 * Disparadores baseados nas NRs de risco fatal e nas atividades críticas
 * acordadas com o gestor (NR-35, NR-33, NR-34, NR-10, içamento e pintura confinada).
 */

export type RiscoMin = {
  risco_nome?: string | null;
  risco_categoria?: string | null;
  nrs?: string[] | null;
};

export type CategoriaPTE =
  | "NR-35 Altura"
  | "NR-33 Espaço Confinado"
  | "NR-34 Trabalho a Quente"
  | "NR-10 Eletricidade"
  | "Içamento de Carga"
  | "Pintura em Ambiente Fechado";

export interface DeteccaoPTE {
  exige: boolean;
  motivos: string[];
  categoriaPrincipal: CategoriaPTE | null;
}

export interface CategoriaDetectada {
  categoria: CategoriaPTE;
  motivo: string;
  /** Valor correspondente em `ptes.risco` (constants.ts → PTE_RISCOS). Null = sem PTE específica mapeada. */
  riscoLabel: string | null;
}

/**
 * Mapa CategoriaPTE → label usada no campo `ptes.risco` (PTE_RISCOS).
 * Categorias sem mapeamento ficam apenas como advisory (não exigem PTE específica).
 */
export const CATEGORIA_PTE_TO_RISCO_LABEL: Partial<Record<CategoriaPTE, string>> = {
  "NR-35 Altura": "Trabalho em Altura",
  "NR-33 Espaço Confinado": "Espaço Confinado",
  "NR-34 Trabalho a Quente": "Trabalho a Quente",
  "NR-10 Eletricidade": "Eletricidade Alta Tensão",
};

function norm(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function hasNr(nrs: string[] | null | undefined, code: string): boolean {
  if (!nrs) return false;
  const c = code.toLowerCase();
  return nrs.some((n) => n.toLowerCase().replace(/\s+/g, "").includes(c));
}

export function detectarExigenciaPTE(riscos: RiscoMin[] | null | undefined): DeteccaoPTE {
  const motivos = new Set<string>();
  let categoriaPrincipal: CategoriaPTE | null = null;

  const setCat = (c: CategoriaPTE) => {
    if (!categoriaPrincipal) categoriaPrincipal = c;
  };

  for (const r of riscos ?? []) {
    const nome = norm(r.risco_nome);
    const nrs = r.nrs ?? [];

    if (hasNr(nrs, "nr-35") || /\baltura\b|trabalho em altura/.test(nome)) {
      motivos.add("NR-35 — Trabalho em Altura (>2 m)");
      setCat("NR-35 Altura");
    }
    if (hasNr(nrs, "nr-33") || /confinad/.test(nome)) {
      motivos.add("NR-33 — Espaço Confinado");
      setCat("NR-33 Espaço Confinado");
    }
    if (
      hasNr(nrs, "nr-34") ||
      /trabalho a quente|trab\.? quente|solda|maca?ric|esmeril|corte (a|com) /.test(nome)
    ) {
      motivos.add("NR-34 — Trabalho a Quente (solda/corte/esmerilhamento)");
      setCat("NR-34 Trabalho a Quente");
    }
    if (
      hasNr(nrs, "nr-10") ||
      /eletric|energiz|alta tensao|baixa tensao|painel eletric/.test(nome)
    ) {
      motivos.add("NR-10 — Riscos Elétricos");
      setCat("NR-10 Eletricidade");
    }
    if (/icament|carga suspensa|guindaste|portico|talha|munck|guincho/.test(nome)) {
      motivos.add("Movimentação de Carga Suspensa / Içamento");
      setCat("Içamento de Carga");
    }
    if (/pintura/.test(nome) && /(fechad|confinad|interno|tanque|porao|cabine)/.test(nome)) {
      motivos.add("Pintura em Ambiente Fechado (vapores tóxicos/inflamáveis)");
      setCat("Pintura em Ambiente Fechado");
    }
  }

  return {
    exige: motivos.size > 0,
    motivos: Array.from(motivos),
    categoriaPrincipal,
  };
}

/**
 * Versão estendida: retorna TODAS as categorias detectadas (não apenas a principal),
 * com o motivo correspondente e o label de PTE mapeado.
 * Usada para validar cobertura 1 APR ↔ N PTEs (uma por categoria).
 */
export function detectarCategoriasPTE(
  riscos: RiscoMin[] | null | undefined,
): CategoriaDetectada[] {
  const acc = new Map<CategoriaPTE, CategoriaDetectada>();

  const add = (categoria: CategoriaPTE, motivo: string) => {
    if (!acc.has(categoria)) {
      acc.set(categoria, {
        categoria,
        motivo,
        riscoLabel: CATEGORIA_PTE_TO_RISCO_LABEL[categoria] ?? null,
      });
    }
  };

  for (const r of riscos ?? []) {
    const nome = norm(r.risco_nome);
    const nrs = r.nrs ?? [];

    if (hasNr(nrs, "nr-35") || /\baltura\b|trabalho em altura/.test(nome)) {
      add("NR-35 Altura", "NR-35 — Trabalho em Altura (>2 m)");
    }
    if (hasNr(nrs, "nr-33") || /confinad/.test(nome)) {
      add("NR-33 Espaço Confinado", "NR-33 — Espaço Confinado");
    }
    if (
      hasNr(nrs, "nr-34") ||
      /trabalho a quente|trab\.? quente|solda|maca?ric|esmeril|corte (a|com) /.test(nome)
    ) {
      add("NR-34 Trabalho a Quente", "NR-34 — Trabalho a Quente (solda/corte/esmerilhamento)");
    }
    if (
      hasNr(nrs, "nr-10") ||
      /eletric|energiz|alta tensao|baixa tensao|painel eletric/.test(nome)
    ) {
      add("NR-10 Eletricidade", "NR-10 — Riscos Elétricos");
    }
    if (/icament|carga suspensa|guindaste|portico|talha|munck|guincho/.test(nome)) {
      add("Içamento de Carga", "Movimentação de Carga Suspensa / Içamento");
    }
    if (/pintura/.test(nome) && /(fechad|confinad|interno|tanque|porao|cabine)/.test(nome)) {
      add(
        "Pintura em Ambiente Fechado",
        "Pintura em Ambiente Fechado (vapores tóxicos/inflamáveis)",
      );
    }
  }

  return Array.from(acc.values());
}
