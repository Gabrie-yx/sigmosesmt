// Consulta CNPJ na BrasilAPI (grátis, CORS liberado) e traduz para o formato do SIGMO.
// Fallback: se BrasilAPI cair, tenta ReceitaWS (via corsproxy? não — deixamos só BrasilAPI por confiabilidade).

export type ReceitaCNPJData = {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnae_principal: string | null;      // formato "00.00-0-00"
  cnae_descricao: string | null;
  grau_risco: number | null;          // 1..4 (NR-04 Quadro I)
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
  telefone: string | null;
  situacao_cadastral: string | null;
  data_situacao: string | null;       // YYYY-MM-DD
  capital_social: number | null;
  natureza_juridica: string | null;
  cnaes_secundarias: Array<{ codigo: string; descricao: string }>;
};

function onlyDigits(s: string) { return (s || "").replace(/\D/g, ""); }

function fmtCnaeCode(code: number | string | null): string | null {
  if (code == null) return null;
  const d = onlyDigits(String(code)).padStart(7, "0");
  if (d.length !== 7) return null;
  return `${d.slice(0, 2)}.${d.slice(2, 4)}-${d.slice(4, 5)}-${d.slice(5, 7)}`;
}

// NR-04 Quadro I — Grau de Risco por divisão CNAE (2 primeiros dígitos).
// Tabela reduzida cobrindo os casos comuns do setor + fallback 3 quando desconhecido.
// Fonte: NR-04 Anexo I (Portaria SEPRT 6.730/2020).
const GR_POR_DIVISAO: Record<string, number> = {
  "01": 3, "02": 3, "03": 3,
  "05": 4, "06": 4, "07": 4, "08": 4, "09": 4,
  "10": 3, "11": 3, "12": 2, "13": 3, "14": 2, "15": 3,
  "16": 3, "17": 3, "18": 2, "19": 4, "20": 4, "21": 3, "22": 3,
  "23": 3, "24": 4, "25": 4, "26": 3, "27": 3, "28": 3, "29": 3,
  "30": 4, // construção de embarcações etc.
  "31": 3, "32": 2, "33": 3,
  "35": 3, "36": 2, "37": 3, "38": 3, "39": 3,
  "41": 3, "42": 4, "43": 3,
  "45": 2, "46": 2, "47": 2,
  "49": 3, "50": 3, "51": 3, "52": 3, "53": 2,
  "55": 2, "56": 2,
  "58": 1, "59": 2, "60": 1, "61": 2, "62": 1, "63": 1,
  "64": 1, "65": 1, "66": 1,
  "68": 1, "69": 1, "70": 1, "71": 2, "72": 1, "73": 1, "74": 2, "75": 2,
  "77": 2, "78": 1, "79": 1, "80": 3, "81": 3, "82": 1,
  "84": 2, "85": 1, "86": 2, "87": 2, "88": 1,
  "90": 2, "91": 1, "92": 3, "93": 3,
  "94": 1, "95": 3, "96": 2, "97": 2, "99": 1,
};

export function grauRiscoDoCnae(cnaeCodigo: string | null | undefined): number | null {
  if (!cnaeCodigo) return null;
  const d = onlyDigits(cnaeCodigo);
  if (d.length < 2) return null;
  return GR_POR_DIVISAO[d.slice(0, 2)] ?? 3;
}

export async function consultarCNPJ(cnpj: string): Promise<ReceitaCNPJData> {
  const digits = onlyDigits(cnpj);
  if (digits.length !== 14) throw new Error("CNPJ deve ter 14 dígitos");

  const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
  if (!res.ok) {
    if (res.status === 404) throw new Error("CNPJ não encontrado na Receita Federal");
    throw new Error(`Erro na consulta (HTTP ${res.status})`);
  }
  const j: any = await res.json();

  const cnaeCode = fmtCnaeCode(j.cnae_fiscal ?? null);
  const secundarias: Array<{ codigo: string; descricao: string }> = Array.isArray(j.cnaes_secundarios)
    ? j.cnaes_secundarios
        .map((c: any) => ({ codigo: fmtCnaeCode(c.codigo) ?? "", descricao: c.descricao ?? "" }))
        .filter((c: any) => c.codigo)
    : [];
  return {
    cnpj: `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5,8)}/${digits.slice(8,12)}-${digits.slice(12,14)}`,
    razao_social: j.razao_social ?? "",
    nome_fantasia: j.nome_fantasia || null,
    cnae_principal: cnaeCode,
    cnae_descricao: j.cnae_fiscal_descricao || null,
    grau_risco: grauRiscoDoCnae(cnaeCode),
    logradouro: j.logradouro || null,
    numero: j.numero || null,
    complemento: j.complemento || null,
    bairro: j.bairro || null,
    cidade: j.municipio || null,
    uf: j.uf || null,
    cep: j.cep ? String(j.cep).replace(/(\d{5})(\d{3})/, "$1-$2") : null,
    telefone: j.ddd_telefone_1 || null,
    situacao_cadastral: j.descricao_situacao_cadastral || null,
    data_situacao: j.data_situacao_cadastral || null,
    capital_social: typeof j.capital_social === "number" ? j.capital_social : (j.capital_social ? Number(j.capital_social) : null),
    natureza_juridica: j.natureza_juridica || null,
    cnaes_secundarias: secundarias,
  };
}

/** Extrai o primeiro CNPJ (14 dígitos, com ou sem máscara) de um texto livre. */
export function extrairCNPJdeTexto(txt: string): string | null {
  if (!txt) return null;
  // 1) Regex tolerante a espaços entre grupos (pdfjs pode quebrar em spans).
  const flex = txt.match(/\d{2}[.\s]{0,3}\d{3}[.\s]{0,3}\d{3}[\s/]{0,3}\d{4}[\s-]{0,3}\d{2}/);
  if (flex) {
    const d = onlyDigits(flex[0]);
    if (d.length === 14) return d;
  }
  // 2) Fallback: colapsa TODOS os espaços e tenta de novo.
  const collapsed = txt.replace(/\s+/g, "");
  const m2 = collapsed.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/);
  if (m2) {
    const d = onlyDigits(m2[0]);
    if (d.length === 14) return d;
  }
  // 3) Último recurso: procura ancorado em "INSCRIÇÃO" (cartão CNPJ tem esse rótulo).
  const idx = txt.toUpperCase().indexOf("INSCRI");
  if (idx >= 0) {
    const janela = onlyDigits(txt.slice(idx, idx + 200));
    if (janela.length >= 14) return janela.slice(0, 14);
  }
  return null;
}