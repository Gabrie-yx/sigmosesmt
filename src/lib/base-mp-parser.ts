import * as XLSX from "xlsx";
import { assertSheetKind } from "./sheet-detect";

export type TipoMP = "FERRO" | "GÁS" | "SOLDA" | "TINTA" | "OUTROS";

export interface BaseMpItem {
  codigo: string;
  descricao: string | null;
  tipo: TipoMP;
}

const norm = (s: any) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

function mapTipo(raw: any): TipoMP {
  const t = norm(raw);
  if (!t) return "OUTROS";
  if (t.startsWith("ferr")) return "FERRO";
  if (t.startsWith("gas") || t.includes("gás") || t === "gas") return "GÁS";
  if (t.startsWith("sold")) return "SOLDA";
  if (t.startsWith("tint")) return "TINTA";
  return "OUTROS";
}

const findCol = (headers: string[], ...cands: string[]) => {
  const H = headers.map(norm);
  for (const c of cands) {
    const i = H.indexOf(norm(c));
    if (i !== -1) return i;
  }
  for (const c of cands) {
    const n = norm(c);
    const i = H.findIndex((h) => h.includes(n));
    if (i !== -1) return i;
  }
  return -1;
};

export async function parseBaseMpXlsx(file: File): Promise<BaseMpItem[]> {
  await assertSheetKind(file, "BASE_MP");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: true, defval: null });
  if (rows.length < 2) throw new Error("Planilha vazia.");

  const headers = (rows[0] as any[]).map((h) => (h == null ? "" : String(h)));
  const cCod = findCol(headers, "Material", "Código", "Codigo", "Código SAP");
  const cDesc = findCol(headers, "Descrição", "Descricao", "Texto breve material", "Nome");
  const cTipo = findCol(headers, "Tipo", "Classificação", "Classificacao", "Categoria");

  if (cCod === -1 || cTipo === -1) {
    throw new Error("Colunas obrigatórias não encontradas (Material e Tipo).");
  }

  const dedup = new Map<string, BaseMpItem>();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] as any[];
    const cod = r[cCod];
    if (cod == null || String(cod).trim() === "") continue;
    const codigo = String(cod).replace(/\.0$/, "").trim();
    dedup.set(codigo, {
      codigo,
      descricao: cDesc !== -1 && r[cDesc] != null ? String(r[cDesc]).trim() : null,
      tipo: mapTipo(r[cTipo]),
    });
  }
  return Array.from(dedup.values());
}