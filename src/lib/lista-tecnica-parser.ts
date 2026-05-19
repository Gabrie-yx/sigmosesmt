import * as XLSX from "xlsx";

export interface ListaTecnicaItem {
  linha: number;
  codigo_sap: string;
  descricao_sap: string | null;
  elemento: string | null;
  medida: string | null;
  unidade: string | null;
  peso_unit_ref: number | null;
  quantidade: number | null;
  peso_total_estimado: number | null;
  largura_txt: string | null;
  largura_m: number | null;
  comprimento_txt: string | null;
  comprimento_m: number | null;
  peso_chapa: number | null;
  espessura_mm: number | null;
  qtd_pecas: number | null;
  obs_dobra: string | null;
  peso_unit_real: number | null;
  peso_real: number | null;
}

export interface ListaTecnicaParseResult {
  itens: ListaTecnicaItem[];
  peso_total_estimado: number;
  peso_total_real: number;
  qtd_pecas_total: number;
  qtd_codigos_distintos: number;
}

const num = (v: any): number | null => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  const s = String(v).replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return isFinite(n) ? n : null;
};

const txt = (v: any): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
};

const parseEspessura = (v: any): number | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(",", ".").match(/[\d.]+/);
  return s ? Number(s[0]) : null;
};

/** Acha o índice da coluna por nome aproximado (case-insensitive, sem acento). */
const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

const findCol = (headers: string[], ...candidates: string[]): number => {
  const normHeaders = headers.map(norm);
  for (const c of candidates) {
    const idx = normHeaders.indexOf(norm(c));
    if (idx !== -1) return idx;
  }
  // fallback: contains
  for (const c of candidates) {
    const n = norm(c);
    const idx = normHeaders.findIndex((h) => h.includes(n));
    if (idx !== -1) return idx;
  }
  return -1;
};

export async function parseListaTecnicaXlsx(file: File): Promise<ListaTecnicaParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: true, defval: null });
  if (rows.length < 2) throw new Error("Planilha vazia ou sem cabeçalho.");

  // Detecta a linha do cabeçalho: procura nas primeiras 20 linhas uma
  // que contenha uma célula igual a "CÓDIGO" / "CODIGO".
  let headerRowIdx = -1;
  const maxScan = Math.min(rows.length, 20);
  for (let i = 0; i < maxScan; i++) {
    const r = (rows[i] as any[]) ?? [];
    const hasCodigo = r.some((c) => c != null && norm(String(c)) === "codigo");
    if (hasCodigo) { headerRowIdx = i; break; }
  }
  if (headerRowIdx === -1) {
    throw new Error("Coluna 'CÓDIGO' não encontrada nas primeiras 20 linhas. Verifique o layout do arquivo SAP B51.");
  }
  const headers = (rows[headerRowIdx] as any[]).map((h) => (h == null ? "" : String(h)));

  const C = {
    codigo: findCol(headers, "CÓDIGO", "CODIGO"),
    descricao: findCol(headers, "Descrição SAP", "Descriçãp SAP", "Descricao SAP"),
    elemento: findCol(headers, "ELEMENTOS", "ELEMENTO"),
    medida: findCol(headers, "Medida"),
    unidade: findCol(headers, "Unid", "Unidade"),
    peso_ref: findCol(headers, "Peso (kgf)"),
    quantidade: findCol(headers, "Quantidade (m 2 / m / un.)", "Quantidade"),
    peso_est: findCol(headers, "Peso Total (Kgf) estimado", "Peso Total estimado"),
    largura_txt: findCol(headers, "Largura"),
    largura_m: findCol(headers, "Larg"),
    comp_txt: findCol(headers, "Comprimento"),
    comp_m: findCol(headers, "Comp,", "Comp"),
    peso_chapa: findCol(headers, "Peso Atual"),
    espessura: findCol(headers, "Espessura"),
    qtd: findCol(headers, "Qtd.", "Qtd"),
    obs: findCol(headers, "Ver Desenho Dobrar\nConforme", "Ver Desenho Dobrar Conforme"),
    peso_unt_real: findCol(headers, "PESO UNT REAL"),
    peso_real: findCol(headers, "PESO REAL"),
  };

  if (C.codigo === -1) {
    throw new Error("Coluna 'CÓDIGO' não encontrada. Verifique o layout do arquivo SAP B51.");
  }

  const itens: ListaTecnicaItem[] = [];
  const codigosDistintos = new Set<string>();
  let pesoEst = 0;
  let pesoReal = 0;
  let qtdPecas = 0;

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i] as any[];
    const codigo = txt(row[C.codigo]);
    if (!codigo) continue;
    const codigoStr = String(codigo).replace(/\.0$/, "");

    const item: ListaTecnicaItem = {
      linha: i,
      codigo_sap: codigoStr,
      descricao_sap: C.descricao !== -1 ? txt(row[C.descricao]) : null,
      elemento: C.elemento !== -1 ? txt(row[C.elemento]) : null,
      medida: C.medida !== -1 ? txt(row[C.medida]) : null,
      unidade: C.unidade !== -1 ? txt(row[C.unidade]) : null,
      peso_unit_ref: C.peso_ref !== -1 ? num(row[C.peso_ref]) : null,
      quantidade: C.quantidade !== -1 ? num(row[C.quantidade]) : null,
      peso_total_estimado: C.peso_est !== -1 ? num(row[C.peso_est]) : null,
      largura_txt: C.largura_txt !== -1 ? txt(row[C.largura_txt]) : null,
      largura_m: C.largura_m !== -1 ? num(row[C.largura_m]) : null,
      comprimento_txt: C.comp_txt !== -1 ? txt(row[C.comp_txt]) : null,
      comprimento_m: C.comp_m !== -1 ? num(row[C.comp_m]) : null,
      peso_chapa: C.peso_chapa !== -1 ? num(row[C.peso_chapa]) : null,
      espessura_mm: C.espessura !== -1 ? parseEspessura(row[C.espessura]) : null,
      qtd_pecas: C.qtd !== -1 ? (num(row[C.qtd]) ?? null) : null,
      obs_dobra: C.obs !== -1 ? txt(row[C.obs]) : null,
      peso_unit_real: C.peso_unt_real !== -1 ? num(row[C.peso_unt_real]) : null,
      peso_real: C.peso_real !== -1 ? num(row[C.peso_real]) : null,
    };
    if (item.qtd_pecas != null) item.qtd_pecas = Math.round(item.qtd_pecas);

    itens.push(item);
    codigosDistintos.add(codigoStr);
    pesoEst += item.peso_total_estimado ?? 0;
    pesoReal += item.peso_real ?? 0;
    qtdPecas += item.qtd_pecas ?? 0;
  }

  if (itens.length === 0) throw new Error("Nenhum item encontrado na planilha.");

  return {
    itens,
    peso_total_estimado: Math.round(pesoEst * 100) / 100,
    peso_total_real: Math.round(pesoReal * 100) / 100,
    qtd_pecas_total: qtdPecas,
    qtd_codigos_distintos: codigosDistintos.size,
  };
}