/**
 * Extrai número da NR para ordenação numérica.
 * "NR-06" → 6, "NR-10-SEP" → 10.5, "NR-35" → 35.
 * Não-NR → null (ordenado depois, alfabético).
 */
export function nrOrder(codigo: string | null | undefined): number | null {
  if (!codigo) return null;
  const m = codigo.toUpperCase().match(/^NR[-\s]?(\d+)(?:[-\s]?([A-Z]+))?/);
  if (!m) return null;
  const base = parseInt(m[1], 10);
  // sufixo (SEP, etc.) entra como decimal pra manter junto da NR-mãe
  return m[2] ? base + 0.5 : base;
}

export function sortMatrixCourses<T extends { codigo: string; nome: string; ordem?: number | null }>(
  list: T[],
): T[] {
  return [...list].sort((a, b) => {
    const na = nrOrder(a.codigo);
    const nb = nrOrder(b.codigo);
    if (na !== null && nb !== null) return na - nb || a.codigo.localeCompare(b.codigo);
    if (na !== null) return -1;
    if (nb !== null) return 1;
    // não-NR: por ordem (se houver) e depois código
    const oa = a.ordem ?? 9999;
    const ob = b.ordem ?? 9999;
    if (oa !== ob) return oa - ob;
    return a.codigo.localeCompare(b.codigo);
  });
}