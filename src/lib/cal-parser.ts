import * as XLSX from "xlsx";

export type CalRequisitoImportado = {
  numero_cal: string;
  norma: string;
  titulo?: string;
  ementa: string;
  texto_legal?: string;
  orgao?: string;
  esfera?: string;
  data_publicacao?: string; // yyyy-mm-dd
  area?: string;
  criticidade: "baixa" | "media" | "alta" | "critica";
  prazo_atendimento?: string;
  cliente?: string;
  raw: Record<string, unknown>;
};

const norm = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

/** Procura o header row varrendo as primeiras 20 linhas. */
function findHeaderRow(rows: unknown[][]): number {
  const targets = ["cal", "requisito", "norma", "lei", "portaria", "ementa", "descricao"];
  const scan = Math.min(rows.length, 20);
  for (let i = 0; i < scan; i++) {
    const row = (rows[i] ?? []).map(norm);
    const hits = targets.filter((t) => row.some((c) => c.includes(t))).length;
    if (hits >= 2) return i;
  }
  return 0;
}

function pick(row: Record<string, unknown>, ...candidates: string[]): string | undefined {
  for (const [k, v] of Object.entries(row)) {
    const kn = norm(k);
    if (candidates.some((c) => kn.includes(norm(c)))) {
      const val = String(v ?? "").trim();
      if (val) return val;
    }
  }
  return undefined;
}

function parseCriticidade(v?: string): CalRequisitoImportado["criticidade"] {
  const n = norm(v);
  if (n.includes("critic")) return "critica";
  if (n.includes("alta") || n.includes("alto")) return "alta";
  if (n.includes("baix")) return "baixa";
  return "media";
}

/** Converte data (Excel serial ou string dd/mm/yyyy) para yyyy-mm-dd. */
function parseDate(v: unknown): string | undefined {
  if (v == null || v === "") return undefined;
  if (typeof v === "number") {
    // Excel serial
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return undefined;
    const mm = String(d.m).padStart(2, "0");
    const dd = String(d.d).padStart(2, "0");
    return `${d.y}-${mm}-${dd}`;
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    const [, d, mo, y] = m;
    const yy = y.length === 2 ? `20${y}` : y;
    return `${yy}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return undefined;
}

export async function parseCalPlanilha(file: File): Promise<CalRequisitoImportado[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });
  if (!matrix.length) return [];
  const headerIdx = findHeaderRow(matrix);
  const headers = (matrix[headerIdx] as unknown[]).map((h, i) => String(h ?? `col_${i}`));
  const out: CalRequisitoImportado[] = [];
  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const rawRow = matrix[i] as unknown[];
    if (!rawRow || rawRow.every((v) => v == null || String(v).trim() === "")) continue;
    const rec: Record<string, unknown> = {};
    headers.forEach((h, idx) => (rec[h] = rawRow[idx]));
    const numero =
      pick(rec, "n cal", "no cal", "num cal", "cal n", "codigo cal", "codigo", "cal") ||
      pick(rec, "id");
    const norma =
      pick(rec, "norma", "requisito", "lei", "portaria", "nr ", "instrucao") || "N/D";
    const ementa =
      pick(rec, "ementa", "descricao", "assunto", "objeto", "texto") || "(sem ementa)";
    if (!numero) continue;
    // O texto completo do requisito pode ter dezenas de KB (estoura índice B-tree).
    // Guardamos o resumo em `norma` (≤ 500 chars) e o texto integral em `texto_legal`.
    const normaFull = norma;
    const normaCurta = normaFull.length > 500 ? normaFull.slice(0, 497) + "…" : normaFull;
    const textoLegal =
      pick(rec, "texto legal", "texto do requisito") ||
      (normaFull.length > 500 ? normaFull : undefined);
    out.push({
      numero_cal: numero,
      norma: normaCurta,
      titulo: pick(rec, "titulo"),
      ementa,
      texto_legal: textoLegal,
      orgao: pick(rec, "orgao", "órgao", "orgao emissor", "emissor"),
      esfera: pick(rec, "esfera", "abrangencia"),
      data_publicacao: parseDate(
        pick(rec, "data publicacao", "publicacao", "data de publicacao", "dt public"),
      ),
      area: pick(rec, "area", "área", "setor"),
      criticidade: parseCriticidade(pick(rec, "criticidade", "risco", "prioridade")),
      prazo_atendimento: parseDate(pick(rec, "prazo", "vencimento", "data limite")),
      cliente: pick(rec, "cliente", "empresa"),
      raw: rec,
    });
  }
  return out;
}
