import * as XLSX from "xlsx";

export type SheetKind = "BASE_MP" | "MB51" | "B51" | "UNKNOWN";

const norm = (s: any) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const KIND_LABEL: Record<SheetKind, string> = {
  BASE_MP: "Base de Matéria-Prima (catálogo SAP)",
  MB51: "MB51 (consumo real de ordens)",
  B51: "Lista Técnica B51 (por casco)",
  UNKNOWN: "Desconhecido",
};

/** Procura nas primeiras 25 linhas e retorna o conjunto de cabeçalhos normalizados encontrados. */
function collectHeaderTokens(file: ArrayBuffer): Set<string> {
  const wb = XLSX.read(file, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: true, defval: null });
  const tokens = new Set<string>();
  const scan = Math.min(rows.length, 25);
  for (let i = 0; i < scan; i++) {
    const r = (rows[i] as any[]) ?? [];
    for (const c of r) {
      const n = norm(c);
      if (n) tokens.add(n);
    }
  }
  return tokens;
}

function has(tokens: Set<string>, ...needles: string[]): boolean {
  return needles.some((n) => {
    const k = norm(n);
    if (tokens.has(k)) return true;
    for (const t of tokens) if (t.includes(k)) return true;
    return false;
  });
}

/** Heurística baseada em colunas-assinatura de cada tipo de planilha. */
export function detectSheetKindFromTokens(tokens: Set<string>): SheetKind {
  const isMb51 =
    has(tokens, "ordem") &&
    (has(tokens, "qtd. um registro", "qtd um registro") ||
      has(tokens, "data de lancamento", "data de lançamento") ||
      has(tokens, "tipo de movimento"));

  const isB51 =
    has(tokens, "codigo", "código") &&
    (has(tokens, "elementos", "elemento") ||
      has(tokens, "peso total (kgf) estimado", "peso total estimado") ||
      has(tokens, "peso unt real", "peso real"));

  const isBaseMp =
    has(tokens, "material") &&
    has(tokens, "tipo", "classificacao", "classificação", "categoria") &&
    !isMb51 &&
    !isB51;

  if (isMb51) return "MB51";
  if (isB51) return "B51";
  if (isBaseMp) return "BASE_MP";
  return "UNKNOWN";
}

export async function detectSheetKind(file: File): Promise<SheetKind> {
  const buf = await file.arrayBuffer();
  const tokens = collectHeaderTokens(buf);
  return detectSheetKindFromTokens(tokens);
}

/** Lança um erro amigável se a planilha enviada não for do tipo esperado. */
export async function assertSheetKind(file: File, expected: SheetKind): Promise<void> {
  const detected = await detectSheetKind(file);
  if (detected === expected) return;
  if (detected === "UNKNOWN") {
    throw new Error(
      `Tipo de dados incompatível. Esta planilha não parece ser do tipo esperado (${KIND_LABEL[expected]}). Verifique se você selecionou o arquivo correto.`,
    );
  }
  throw new Error(
    `Tipo de dados incompatível. Esta planilha parece ser ${KIND_LABEL[detected]}, mas este campo aceita apenas ${KIND_LABEL[expected]}. Envie o arquivo no campo correto.`,
  );
}