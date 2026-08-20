// Leitor determinístico (SEM IA) de PGR / LTCAT / PCMSO.
// Extrai o texto do PDF (camada de texto do pdf.js), reconstrói as linhas por
// coordenada Y e aplica regras/regex fixas para achar:
//  - GHE / setor
//  - agente de risco + intensidade + unidade + técnica de medição
// Nada é gravado aqui: a função devolve os achados para conferência humana.

export type LinhaPDF = { page: number; y: number; text: string };

export type AchadoMedicao = {
  id: string;
  page: number;
  linha: string;
  /** Nome do cargo/GHE/setor detectado como contexto da medição */
  contexto: string | null;
  agente: string;
  intensidade: number | null;
  unidade: string | null;
  tecnica: string | null;
  limite: number | null;
};

export type AchadoGHE = {
  id: string;
  numero: number | null;
  setor: string;
  descricao: string | null;
};

export type ResultadoLeitura = {
  paginas: number;
  totalLinhas: number;
  temCamadaTexto: boolean;
  medicoes: AchadoMedicao[];
  ghes: AchadoGHE[];
  contextos: string[];
};

/* ------------------------------------------------------------------ */
/* Extração das linhas do PDF                                          */
/* ------------------------------------------------------------------ */

export async function extrairLinhasPDF(
  bytes: Uint8Array,
  onProgress?: (msg: string) => void,
): Promise<{ linhas: LinhaPDF[]; paginas: number }> {
  // @ts-ignore - pdfjs-dist ESM build
  const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
  // @ts-ignore - worker asset import
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const pdf = await pdfjs.getDocument({ data: bytes }).promise;
  const linhas: LinhaPDF[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    onProgress?.(`Lendo página ${p} de ${pdf.numPages}...`);
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    // agrupa itens por Y (tolerância de 2.5pt) para reconstruir a linha da tabela
    const buckets = new Map<number, { y: number; itens: { x: number; s: string }[] }>();
    for (const it of content.items as any[]) {
      const s = String(it.str ?? "");
      if (!s.trim()) continue;
      const x = it.transform?.[4] ?? 0;
      const y = Math.round((it.transform?.[5] ?? 0) / 2.5);
      const b = buckets.get(y) ?? { y, itens: [] };
      b.itens.push({ x, s });
      buckets.set(y, b);
    }
    const ordenadas = [...buckets.values()].sort((a, b) => b.y - a.y);
    for (const b of ordenadas) {
      const text = b.itens
        .sort((a, c) => a.x - c.x)
        .map((i) => i.s)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (text) linhas.push({ page: p, y: b.y, text });
    }
  }

  return { linhas, paginas: pdf.numPages };
}

/* ------------------------------------------------------------------ */
/* Dicionários fixos (regras, não IA)                                  */
/* ------------------------------------------------------------------ */

const AGENTES: { nome: string; padroes: RegExp[]; unidadePadrao?: string }[] = [
  { nome: "Ruído", padroes: [/ru[íi]do(\s+cont[íi]nuo|\s+ocupacional)?/i, /\bNEN\b/], unidadePadrao: "dB(A)" },
  { nome: "Ruído de impacto", padroes: [/ru[íi]do\s+de\s+impacto/i], unidadePadrao: "dB(C)" },
  { nome: "Calor", padroes: [/\bIBUTG\b/i, /\bcalor\b/i, /sobrecarga\s+t[ée]rmica/i], unidadePadrao: "°C" },
  { nome: "Vibração de corpo inteiro", padroes: [/vibra[çc][ãa]o\s+de\s+corpo\s+inteiro/i, /\bVCI\b/], unidadePadrao: "m/s²" },
  { nome: "Vibração de mãos e braços", padroes: [/vibra[çc][ãa]o\s+(de\s+)?m[ãa]os?\s*(e|\/)\s*bra[çc]os?/i, /\bVMB\b/], unidadePadrao: "m/s²" },
  { nome: "Radiação não ionizante", padroes: [/radia[çc][ãa]o\s+n[ãa]o\s+ionizante/i] },
  { nome: "Radiação ionizante", padroes: [/radia[çc][ãa]o\s+ionizante/i] },
  { nome: "Umidade", padroes: [/\bumidade\b/i] },
  { nome: "Fumos metálicos", padroes: [/fumos?\s+met[áa]licos?/i, /fumos?\s+de\s+solda/i], unidadePadrao: "mg/m³" },
  { nome: "Poeira", padroes: [/poeira(s)?(\s+respir[áa]vel|\s+total)?/i, /material\s+particulado/i], unidadePadrao: "mg/m³" },
  { nome: "Sílica", padroes: [/s[íi]lica/i], unidadePadrao: "mg/m³" },
  { nome: "Manganês", padroes: [/mangan[êe]s/i], unidadePadrao: "mg/m³" },
  { nome: "Chumbo", padroes: [/\bchumbo\b/i], unidadePadrao: "mg/m³" },
  { nome: "Solventes/Hidrocarbonetos", padroes: [/solvente/i, /hidrocarboneto/i, /\bxileno\b/i, /\btolueno\b/i, /\bbenzeno\b/i], unidadePadrao: "ppm" },
  { nome: "Névoas de tinta", padroes: [/n[ée]voas?\s+de\s+tinta/i, /aeross[óo]l\s+de\s+tinta/i], unidadePadrao: "mg/m³" },
  { nome: "Gases e vapores", padroes: [/gases?\s+e\s+vapores?/i, /mon[óo]xido\s+de\s+carbono/i, /\bCO2?\b/], unidadePadrao: "ppm" },
  { nome: "Agentes biológicos", padroes: [/agentes?\s+biol[óo]gicos?/i, /\bbiol[óo]gico\b/i] },
];

const UNIDADES = [
  { re: /\bdB\s*\(?\s*A\s*\)?/i, u: "dB(A)" },
  { re: /\bdB\s*\(?\s*C\s*\)?/i, u: "dB(C)" },
  { re: /\bdB\b/i, u: "dB" },
  { re: /mg\s*\/\s*m[³3]/i, u: "mg/m³" },
  { re: /\bf\s*\/\s*cm[³3]/i, u: "f/cm³" },
  { re: /\bppm\b/i, u: "ppm" },
  { re: /m\s*\/\s*s[²2]/i, u: "m/s²" },
  { re: /°\s*C|graus\s+C/i, u: "°C" },
  { re: /\blux\b/i, u: "lux" },
  { re: /\b%/, u: "%" },
];

const TECNICAS: { re: RegExp; nome: string }[] = [
  { re: /NHO[\s-]*0?1/i, nome: "Dosimetria — FUNDACENTRO NHO-01" },
  { re: /NHO[\s-]*0?2/i, nome: "Cromatografia — FUNDACENTRO NHO-02" },
  { re: /NHO[\s-]*0?3/i, nome: "Gravimetria — FUNDACENTRO NHO-03" },
  { re: /NHO[\s-]*0?4/i, nome: "FUNDACENTRO NHO-04" },
  { re: /NHO[\s-]*0?5/i, nome: "FUNDACENTRO NHO-05" },
  { re: /NHO[\s-]*0?6/i, nome: "IBUTG — FUNDACENTRO NHO-06" },
  { re: /NHO[\s-]*0?7/i, nome: "FUNDACENTRO NHO-07" },
  { re: /NHO[\s-]*0?8/i, nome: "Aerodispersóides — FUNDACENTRO NHO-08" },
  { re: /NHO[\s-]*0?9/i, nome: "Vibração — FUNDACENTRO NHO-09" },
  { re: /NHO[\s-]*10/i, nome: "Vibração VMB — FUNDACENTRO NHO-10" },
  { re: /NIOSH\s*\d{3,4}/i, nome: "NIOSH" },
  { re: /dosimetria/i, nome: "Dosimetria de ruído" },
  { re: /decibel[íi]metro|audiodos[íi]metro/i, nome: "Decibelímetro" },
  { re: /termo\s*-?\s*medidor|IBUTG/i, nome: "IBUTG (termômetro de globo)" },
  { re: /bomba\s+de\s+amostragem|gravim[ée]tric[ao]/i, nome: "Amostragem gravimétrica" },
  { re: /qualitativ[ao]|inspe[çc][ãa]o\s+no\s+local/i, nome: "Avaliação qualitativa" },
  { re: /NR[\s-]*15\s*,?\s*anexo\s*([IVXLC0-9]+)/i, nome: "NR-15 Anexo" },
];

/** Palavras que indicam que a linha é cabeçalho de GHE/setor/função */
const RE_GHE = /\bGHE\s*[-–:nº°]*\s*(\d{1,3})\b(.{0,80})/i;
const RE_FUNCAO = /^(fun[çc][ãa]o|cargo|ocupa[çc][ãa]o)\s*[:\-–]\s*(.{2,60})$/i;
const RE_SETOR = /^(setor|[áa]rea|departamento)\s*[:\-–]\s*(.{2,60})$/i;

/* ------------------------------------------------------------------ */
/* Parser                                                              */
/* ------------------------------------------------------------------ */

function acharUnidade(txt: string): string | null {
  for (const u of UNIDADES) if (u.re.test(txt)) return u.u;
  return null;
}

function acharTecnica(txt: string): string | null {
  for (const t of TECNICAS) {
    const m = txt.match(t.re);
    if (m) {
      if (t.nome === "NR-15 Anexo" && m[1]) return `NR-15 Anexo ${m[1].toUpperCase()}`;
      return t.nome;
    }
  }
  return null;
}

function acharNumeros(txt: string): number[] {
  const out: number[] = [];
  const re = /(?<![\w.,])(\d{1,4}(?:[.,]\d{1,3})?)(?![\w])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(txt))) {
    const n = Number(m[1].replace(".", "").replace(",", "."));
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

/** Escolhe o número mais provável de ser a intensidade, pela faixa da unidade. */
function escolherIntensidade(nums: number[], unidade: string | null): number | null {
  if (!nums.length) return null;
  const faixa: Record<string, [number, number]> = {
    "dB(A)": [60, 130],
    "dB(C)": [80, 145],
    dB: [60, 145],
    "°C": [18, 45],
    "m/s²": [0.1, 25],
    ppm: [0.01, 2000],
    "mg/m³": [0.001, 200],
    "f/cm³": [0.001, 10],
    lux: [10, 5000],
    "%": [0, 100],
  };
  const f = unidade ? faixa[unidade] : undefined;
  if (f) {
    const cands = nums.filter((n) => n >= f[0] && n <= f[1]);
    if (cands.length) return cands[0];
  }
  return nums.find((n) => !Number.isInteger(n)) ?? nums[0];
}

export function interpretarLinhas(
  linhas: LinhaPDF[],
  paginas: number,
): ResultadoLeitura {
  const medicoes: AchadoMedicao[] = [];
  const ghes: AchadoGHE[] = [];
  const contextosSet = new Set<string>();
  let contextoAtual: string | null = null;

  linhas.forEach((l, idx) => {
    const txt = l.text;

    // contexto: GHE / função / setor
    const mGhe = txt.match(RE_GHE);
    if (mGhe) {
      const setor = (mGhe[2] || "").replace(/^[\s:–-]+/, "").trim();
      contextoAtual = setor ? `GHE ${mGhe[1]} — ${setor}` : `GHE ${mGhe[1]}`;
      contextosSet.add(contextoAtual);
      if (!ghes.some((g) => g.numero === Number(mGhe[1]))) {
        ghes.push({
          id: `ghe-${idx}`,
          numero: Number(mGhe[1]),
          setor: setor || `GHE ${mGhe[1]}`,
          descricao: null,
        });
      }
    }
    const mFun = txt.match(RE_FUNCAO) || txt.match(RE_SETOR);
    if (mFun) {
      contextoAtual = mFun[2].trim();
      contextosSet.add(contextoAtual);
    }

    // agente
    const agente = AGENTES.find((a) => a.padroes.some((p) => p.test(txt)));
    if (!agente) return;

    // ignora linhas de sumário/índice
    if (/^\s*\d+(\.\d+)*\s+[A-ZÁÉÍÓÚÃÇ ]{6,}\.{3,}/.test(txt)) return;

    const unidade = acharUnidade(txt) ?? agente.unidadePadrao ?? null;
    // números da linha, tirando o "15" de "NR-15" e o número do NHO
    const limpo = txt
      .replace(/NR\s*-?\s*\d+/gi, " ")
      .replace(/NHO\s*-?\s*\d+/gi, " ")
      .replace(/anexo\s+[IVXLC0-9]+/gi, " ");
    const nums = acharNumeros(limpo);
    const intensidade = escolherIntensidade(nums, unidade);
    const tecnica = acharTecnica(txt);

    // só interessa linha que traga medição OU técnica explícita
    if (intensidade === null && !tecnica) return;

    const restantes = nums.filter((n) => n !== intensidade);
    const limite = escolherIntensidade(restantes, unidade);

    medicoes.push({
      id: `med-${l.page}-${idx}`,
      page: l.page,
      linha: txt.length > 220 ? `${txt.slice(0, 220)}…` : txt,
      contexto: contextoAtual,
      agente: agente.nome,
      intensidade,
      unidade,
      tecnica,
      limite: limite === intensidade ? null : limite,
    });
  });

  return {
    paginas,
    totalLinhas: linhas.length,
    temCamadaTexto: linhas.length > 5,
    medicoes,
    ghes,
    contextos: [...contextosSet],
  };
}

export async function lerDocumentoSST(
  bytes: Uint8Array,
  onProgress?: (msg: string) => void,
): Promise<ResultadoLeitura> {
  const { linhas, paginas } = await extrairLinhasPDF(bytes, onProgress);
  onProgress?.("Interpretando conteúdo...");
  return interpretarLinhas(linhas, paginas);
}

/* ------------------------------------------------------------------ */
/* Utilidades de casamento com o cadastro                              */
/* ------------------------------------------------------------------ */

export function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Casamento simples por tokens — sem IA, só comparação de texto. */
export function melhorCorrespondencia<T>(
  alvo: string,
  itens: T[],
  chave: (i: T) => string,
): { item: T; score: number } | null {
  const a = normalizar(alvo);
  if (!a) return null;
  const tokensA = new Set(a.split(" ").filter((t) => t.length > 2));
  let melhor: { item: T; score: number } | null = null;
  for (const it of itens) {
    const b = normalizar(chave(it));
    if (!b) continue;
    let score = 0;
    if (a === b) score = 1;
    else if (a.includes(b) || b.includes(a)) score = 0.85;
    else {
      const tokensB = b.split(" ").filter((t) => t.length > 2);
      const hits = tokensB.filter((t) => tokensA.has(t)).length;
      score = tokensB.length ? (hits / Math.max(tokensB.length, tokensA.size)) * 0.8 : 0;
    }
    if (!melhor || score > melhor.score) melhor = { item: it, score };
  }
  return melhor && melhor.score >= 0.5 ? melhor : null;
}
