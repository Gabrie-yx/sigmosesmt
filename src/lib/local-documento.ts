/**
 * Resolve o "Local" impresso em documentos (ex.: campo "Local e Data" da ficha de EPI).
 *
 * Ordem de precedência:
 *  1. Override manual salvo pelo usuário (obra/unidade fora da sede);
 *  2. Cidade/UF cadastrada na empresa do funcionário (vinda do Cartão CNPJ / cadastro);
 *  3. Fallback histórico: Belém.
 */
const KEY = "sigmo:local-documento";
export const LOCAL_FALLBACK = "Belém";

export type EmpresaLocal = { cidade?: string | null; uf?: string | null } | null | undefined;

export function getLocalOverride(): string {
  try {
    return localStorage.getItem(KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function setLocalOverride(valor: string) {
  try {
    const v = valor.trim();
    if (v) localStorage.setItem(KEY, v);
    else localStorage.removeItem(KEY);
  } catch {
    /* storage indisponível — segue com o padrão da empresa */
  }
}

/** Local sugerido a partir da empresa (sem considerar o override manual). */
export function localDaEmpresa(empresa: EmpresaLocal): string {
  const cidade = empresa?.cidade?.trim();
  const uf = empresa?.uf?.trim();
  if (cidade && uf) return `${cidade} - ${uf.toUpperCase()}`;
  if (cidade) return cidade;
  return LOCAL_FALLBACK;
}

/** Local final: override manual > cidade da empresa > fallback. */
export function resolveLocal(empresa?: EmpresaLocal): string {
  return getLocalOverride() || localDaEmpresa(empresa);
}

/** Texto pronto do campo "Local e Data" (ex.: "Curitiba - PR, 20/08/2026"). */
export function formatLocalData(local: string, data: Date = new Date()): string {
  return `${local || LOCAL_FALLBACK}, ${data.toLocaleDateString("pt-BR")}`;
}
