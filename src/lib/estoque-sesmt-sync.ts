// Sincroniza saída/entrada do estoque SESMT (localStorage) quando EPIs
// são entregues / devolvidos / removidos no cadastro do colaborador.

const STORAGE_KEY = "estoque-epi-sesmt-v5";
const EVENT = "estoque-sesmt-updated";

type Movement = {
  id: string;
  date: string;
  delta: number;
  tipo: "ENTRADA" | "SAIDA" | "AJUSTE";
  obs?: string;
};
type Variant = {
  id: string;
  label: string;
  estoqueInicial: number;
  movements: Movement[];
};
type Product = {
  id: string;
  base: string;
  umb: string;
  ca?: string;
  variants: Variant[];
};

function norm(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

function readProducts(): Product[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    const products = parsed.filter((p): p is Product => (
      p &&
      typeof p === "object" &&
      typeof p.id === "string" &&
      typeof p.base === "string" &&
      Array.isArray((p as Product).variants)
    ));

    return products.length === parsed.length ? products : null;
  } catch {
    return null;
  }
}

function writeProducts(products: Product[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {}
}

/** Localiza variante por (item, tamanho). Retorna índices se encontrar. */
function findVariant(
  products: Product[],
  item: string,
  tamanho?: string | null,
): { pi: number; vi: number } | null {
  const itemN = norm(item);
  const tamN = tamanho ? norm(tamanho) : "";
  const baseFirst = itemN.split(/\s+/)[0];

  // 1) match exato base do produto + label "TAM. X" se houver tamanho
  for (let pi = 0; pi < products.length; pi++) {
    const p = products[pi];
    if (!Array.isArray(p.variants)) continue;
    const baseN = norm(p.base);
    if (baseN !== itemN && baseN !== baseFirst) continue;
    for (let vi = 0; vi < p.variants.length; vi++) {
      const labelN = norm(p.variants[vi].label);
      if (tamN) {
        if (labelN === `TAM. ${tamN}` || labelN.endsWith(` ${tamN}`) || labelN === tamN) {
          return { pi, vi };
        }
      } else if (labelN === "PADRAO" || p.variants.length === 1) {
        return { pi, vi };
      }
    }
  }

  // 2) fallback: única variante com base equivalente
  const candidates: Array<{ pi: number; vi: number }> = [];
  for (let pi = 0; pi < products.length; pi++) {
    const p = products[pi];
    if (!Array.isArray(p.variants)) continue;
    const baseN = norm(p.base);
    if (baseN !== itemN && baseN !== baseFirst) continue;
    for (let vi = 0; vi < p.variants.length; vi++) {
      candidates.push({ pi, vi });
    }
  }
  if (candidates.length === 1) return candidates[0];
  return null;
}

function applyDelta(item: string, tamanho: string | null | undefined, delta: number, tipo: Movement["tipo"], obs?: string): boolean {
  const products = readProducts();
  if (!products) return false;
  const found = findVariant(products, item, tamanho);
  if (!found) return false;
  const { pi, vi } = found;
  const v = products[pi].variants[vi];
  if (!v || !Array.isArray(v.movements)) return false;
  v.movements = [
    ...v.movements,
    {
      id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: new Date().toISOString().slice(0, 10),
      delta,
      tipo,
      obs,
    },
  ];
  writeProducts(products);
  return true;
}

/** Saída de estoque ao entregar EPI ao colaborador. */
export function registrarSaidaEntregaEpi(item: string, tamanho?: string | null, qtd: number = 1, nomeColaborador?: string) {
  const q = Math.max(1, Number(qtd) || 1);
  const obs = nomeColaborador ? `Entrega: ${nomeColaborador}` : "Entrega de EPI";
  return applyDelta(item, tamanho ?? null, -q, "SAIDA", obs);
}

/** Reentrada quando uma entrega é desfeita (delete) ou devolvida. */
export function registrarReentradaEpi(item: string, tamanho?: string | null, qtd: number = 1, motivo?: string) {
  const q = Math.max(1, Number(qtd) || 1);
  return applyDelta(item, tamanho ?? null, q, "ENTRADA", motivo || "Devolução de EPI");
}

export const ESTOQUE_SESMT_EVENT = EVENT;
export const ESTOQUE_SESMT_STORAGE_KEY = STORAGE_KEY;

export type EstoqueProductOption = {
  base: string;
  ca?: string;
  variants: Array<{ label: string; sizeValue: string }>;
};

/** Extrai o "tamanho" puro do label da variante (ex.: "TAM. 39" -> "39"). */
function extractSize(label: string): string {
  const l = (label || "").trim();
  if (!l) return "";
  if (/^padrao$/i.test(norm(l))) return "";
  return l.replace(/^TAM\.?\s*/i, "").trim();
}

/** Lista produtos do estoque SESMT para uso em selects (ex.: ficha do colaborador). */
export function listEstoqueProducts(): EstoqueProductOption[] {
  const products = readProducts();
  if (!products) return [];
  return products.map((p) => ({
    base: p.base,
    ca: p.ca,
    variants: (p.variants ?? []).map((v) => ({
      label: v.label,
      sizeValue: extractSize(v.label),
    })),
  }));
}