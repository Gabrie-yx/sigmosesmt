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
