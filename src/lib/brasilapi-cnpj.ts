// Utilitários para extração e consulta de dados de CNPJ.
// Prioriza consulta via BrasilAPI para dados atualizados e usa OCR/Regex como fallback ou complemento offline.

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

/** Valida CNPJ via algoritmo de verificação (Módulo 11). */
export function validarCNPJ(cnpj: string): boolean {
  const d = onlyDigits(cnpj);
  if (d.length !== 14) return false;
  
  // Rejeita strings de dígitos repetidos
  if (/^(\d)\1+$/.test(d)) return false;

  const t = d.length - 2;
  const numbers = d.substring(0, t);
  const digits = d.substring(t);
  
  const calc = (n: string) => {
    let size = n.length - 7;
    let numbersArr = n.split("");
    let sum = 0;
    let pos = size + 7;
    for (let i = size + 7; i >= 1; i--) {
      sum += Number(numbersArr[size + 7 - i]) * pos--;
      if (pos < 2) pos = 9;
    }
    const result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    return result;
  };

  const digit1 = calc(numbers);
  const digit2 = calc(numbers + digit1);

  return digit1 === Number(digits[0]) && digit2 === Number(digits[1]);
}

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
  if (!validarCNPJ(digits)) throw new Error("CNPJ inválido (dígito verificador incorreto)");

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
    razao_social: (j.razao_social ?? "").toUpperCase(),
    nome_fantasia: j.nome_fantasia ? j.nome_fantasia.toUpperCase() : null,
    cnae_principal: cnaeCode,
    cnae_descricao: j.cnae_fiscal_descricao || null,
    grau_risco: grauRiscoDoCnae(cnaeCode),
    logradouro: j.logradouro || null,
    numero: j.numero || null,
    complemento: j.complemento || null,
    bairro: j.bairro || null,
    cidade: j.municipio || null,
    uf: (j.uf || null)?.toUpperCase(),
    cep: j.cep ? String(j.cep).replace(/(\d{5})(\d{3})/, "$1-$2") : null,
    telefone: j.ddd_telefone_1 || null,
    situacao_cadastral: j.descricao_situacao_cadastral || null,
    data_situacao: j.data_situacao_cadastral || null,
    capital_social: typeof j.capital_social === "number" ? j.capital_social : (j.capital_social ? Number(j.capital_social) : null),
    natureza_juridica: j.natureza_juridica || null,
    cnaes_secundarias: secundarias,
  };
}

/** Extrai o primeiro CNPJ (14 dígitos) de um texto livre. */
export function extrairCNPJdeTexto(txt: string): string | null {
  if (!txt) return null;
  const regexes = [/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/, /\d{14}/, /\d{2}\s\d{3}\s\d{3}\s\d{4}\s\d{2}/];
  for (const re of regexes) {
    const matches = txt.match(re);
    if (matches) {
      for (const m of matches) {
        const d = onlyDigits(m);
        if (d.length === 14 && validarCNPJ(d)) return d;
      }
    }
  }
  const allDigits = onlyDigits(txt);
  for (let i = 0; i <= allDigits.length - 14; i++) {
    const window = allDigits.slice(i, i + 14);
    if (validarCNPJ(window)) return window;
  }
  return null;
}

/** Tenta extrair todos os campos possíveis diretamente do texto (sem API). */
export function extrairDadosCompletosDeTexto(txt: string): Partial<ReceitaCNPJData> {
  const clean = (s: string) => s.replace(/\s+/g, " ").trim().toUpperCase();
  const res: Partial<ReceitaCNPJData> = {};
  
  const cnpj = extrairCNPJdeTexto(txt);
  if (cnpj) res.cnpj = `${cnpj.slice(0,2)}.${cnpj.slice(2,5)}.${cnpj.slice(5,8)}/${cnpj.slice(8,12)}-${cnpj.slice(12,14)}`;

  // Normalizar texto para facilitar regex (remover quebras de linha e excesso de espaços)
  const norm = txt.replace(/[\r\n]+/g, " ").replace(/\s\s+/g, " ");

  // Razão Social
  const razaoMatch = txt.match(/NOME EMPRESARIAL\s+([^\n\r]+)/i) || 
                     norm.match(/NOME EMPRESARIAL\s+([^0-9]+)/i) ||
                     txt.match(/REPÚBLICA FEDERATIVA DO BRASIL\s+([^\n\r]+)/i);
  if (razaoMatch) res.razao_social = clean(razaoMatch[1]);

  // Nome Fantasia
  const fantasiaMatch = txt.match(/TÍTULO DO ESTABELECIMENTO \(NOME DE FANTASIA\)\s+([^\n\r]+)/i) ||
                        norm.match(/NOME DE FANTASIA\s+([^\n\r]+?)(?=\s+CÓDIGO|$)/i);
  if (fantasiaMatch) res.nome_fantasia = clean(fantasiaMatch[1]);

  // CNAE
  const cnaeMatch = txt.match(/CÓDIGO E DESCRIÇÃO DA ATIVIDADE ECONÔMICA PRINCIPAL\s+(\d{2}\.\d{2}-\d-\d{2})\s+-\s+([^\n\r]+)/i) ||
                    norm.match(/(\d{2}\.\d{2}-\d-\d{2})\s+-\s+([^\d]+?)(?=\s+CÓDIGO|$)/i);
  if (cnaeMatch) {
    res.cnae_principal = cnaeMatch[1];
    res.cnae_descricao = clean(cnaeMatch[2]);
    res.grau_risco = grauRiscoDoCnae(cnaeMatch[1]);
  }

  // Endereço (Logradouro + Número)
  const logradouroMatch = txt.match(/LOGRADOURO\s+([^\n\r]+)/i) || norm.match(/LOGRADOURO\s+([^\d]+?)(?=\s+NÚMERO|$)/i);
  if (logradouroMatch) res.logradouro = clean(logradouroMatch[1]);

  const numeroMatch = txt.match(/NÚMERO\s+([^\n\r]+)/i) || norm.match(/NÚMERO\s+([^\s]+)/i);
  if (numeroMatch) res.numero = clean(numeroMatch[1]);

  const bairroMatch = txt.match(/BAIRRO\/DISTRITO\s+([^\n\r]+)/i) || norm.match(/BAIRRO\/DISTRITO\s+([^\s]+)/i);
  if (bairroMatch) res.bairro = clean(bairroMatch[1]);

  const cidadeMatch = txt.match(/MUNICÍPIO\s+([^\n\r]+)/i) || norm.match(/MUNICÍPIO\s+([^\s]+)/i);
  if (cidadeMatch) res.cidade = clean(cidadeMatch[1]);

  const ufMatch = txt.match(/UF\s+([A-Z]{2})/i) || norm.match(/\s([A-Z]{2})\s+(?=CEP|$)/i);
  if (ufMatch) res.uf = ufMatch[1].toUpperCase();

  const cepMatch = txt.match(/CEP\s+(\d{2}\.\d{3}-\d{3})/i) || txt.match(/CEP\s+(\d{8})/i) || norm.match(/CEP\s+([\d.-]+)/i);
  if (cepMatch) {
    const d = onlyDigits(cepMatch[1]);
    res.cep = d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5, 8)}` : cepMatch[1];
  }

  return res;
}