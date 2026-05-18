import * as XLSX from "xlsx";
import type { TipoMP } from "./base-mp-parser";

export interface Mb51Movimento {
  material: string;
  descricao: string | null;
  quantidade: number; // negativo = consumo, positivo = devolução/entrada
  unidade: string | null;
  data_lancamento: string | null; // ISO yyyy-mm-dd
  tipo_movimento: string | null;
  classificacao_mb51: string | null;
  texto_documento: string | null;
  numero_sap: string;
}

export interface Mb51OrdemParsed {
  numero_sap: string;
  texto_documento: string | null;
  movimentos: Mb51Movimento[];
  qtd_consumo_liquido: number; // soma das quantidades (consumo negativo - devolução positiva → -valor)
  data_primeiro_movimento: string | null;
  data_ultimo_movimento: string | null;
}

export interface Mb51ParseResult {
  ordens: Mb51OrdemParsed[];
  total_linhas: number;
}

const norm = (s: any) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

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

const num = (v: any): number => {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  const s = String(v).replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return isFinite(n) ? n : 0;
};

const parseDate = (v: any): string | null => {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    // Excel serial date
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + v * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  // formats: dd/mm/yyyy, dd.mm.yyyy, yyyy-mm-dd
  let m = s.match(/^(\d{2})[\/.](\d{2})[\/.](\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
};

/** Normaliza nome do casco para casamento: maiúsculas, sem zeros à esquerda nos números. */
export function normalizeCascoName(s: string | null | undefined): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\b0+(\d)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export async function parseMb51Xlsx(file: File): Promise<Mb51ParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: true, defval: null });
  if (rows.length < 2) throw new Error("Planilha MB51 vazia.");

  const headers = (rows[0] as any[]).map((h) => (h == null ? "" : String(h)));

  const C = {
    ordem: findCol(headers, "Ordem", "Ordem SAP", "Nº ordem", "No ordem"),
    material: findCol(headers, "Material"),
    desc: findCol(headers, "Texto breve material", "Descrição material", "Descricao"),
    qtd: findCol(headers, "Qtd. UM registro", "Qtd UM registro", "Quantidade", "Qtd"),
    unidade: findCol(headers, "UM registro", "Unidade", "UME", "UM"),
    data: findCol(headers, "Data de lançamento", "Data lancamento", "Dt.lançamento", "Data"),
    tipoMov: findCol(headers, "Tipo de movimento", "Tp movimento", "Tipo mov"),
    classif: findCol(headers, "Classificação", "Classificacao"),
    textoCab: findCol(headers, "Texto cab.documento", "Texto cab documento", "Texto cabeçalho"),
  };

  if (C.ordem === -1 || C.material === -1 || C.qtd === -1) {
    throw new Error("Colunas obrigatórias não encontradas (Ordem, Material, Qtd. UM registro).");
  }

  const ordensMap = new Map<string, Mb51OrdemParsed>();
  let total = 0;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] as any[];
    const ordemRaw = r[C.ordem];
    const matRaw = r[C.material];
    if (ordemRaw == null || matRaw == null) continue;
    const numero_sap = String(ordemRaw).replace(/\.0$/, "").trim();
    if (!numero_sap) continue;
    const material = String(matRaw).replace(/\.0$/, "").trim();
    if (!material) continue;

    const qtd = num(r[C.qtd]);
    const data = C.data !== -1 ? parseDate(r[C.data]) : null;
    const textoCab = C.textoCab !== -1 && r[C.textoCab] != null ? String(r[C.textoCab]).trim() : null;

    const mov: Mb51Movimento = {
      material,
      descricao: C.desc !== -1 && r[C.desc] != null ? String(r[C.desc]).trim() : null,
      quantidade: qtd,
      unidade: C.unidade !== -1 && r[C.unidade] != null ? String(r[C.unidade]).trim() : null,
      data_lancamento: data,
      tipo_movimento: C.tipoMov !== -1 && r[C.tipoMov] != null ? String(r[C.tipoMov]).trim() : null,
      classificacao_mb51: C.classif !== -1 && r[C.classif] != null ? String(r[C.classif]).trim() : null,
      texto_documento: textoCab,
      numero_sap,
    };

    let ord = ordensMap.get(numero_sap);
    if (!ord) {
      ord = {
        numero_sap,
        texto_documento: textoCab,
        movimentos: [],
        qtd_consumo_liquido: 0,
        data_primeiro_movimento: data,
        data_ultimo_movimento: data,
      };
      ordensMap.set(numero_sap, ord);
    }
    if (!ord.texto_documento && textoCab) ord.texto_documento = textoCab;
    ord.movimentos.push(mov);
    ord.qtd_consumo_liquido += -qtd; // consumo (qtd<0) vira positivo
    if (data) {
      if (!ord.data_primeiro_movimento || data < ord.data_primeiro_movimento)
        ord.data_primeiro_movimento = data;
      if (!ord.data_ultimo_movimento || data > ord.data_ultimo_movimento)
        ord.data_ultimo_movimento = data;
    }
    total++;
  }

  if (ordensMap.size === 0) throw new Error("Nenhuma Ordem encontrada na MB51.");

  return { ordens: Array.from(ordensMap.values()), total_linhas: total };
}

/** Resolve o tipo do material usando a Base MP. Faz fallback para a classificação inline da MB51. */
export function resolveTipo(
  material: string,
  classificacaoMb51: string | null,
  baseMp: Map<string, TipoMP>,
): TipoMP {
  const t = baseMp.get(material);
  if (t) return t;
  const c = String(classificacaoMb51 ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
  if (c.startsWith("ferr")) return "FERRO";
  if (c.startsWith("gas")) return "GÁS";
  if (c.startsWith("sold")) return "SOLDA";
  if (c.startsWith("tint")) return "TINTA";
  return "OUTROS";
}