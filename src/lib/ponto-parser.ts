// Parser heurístico de folha de ponto CLT (pdfjs no browser).
// Recebe um File PDF e retorna páginas com texto bruto + tentativa de extrair
// matrícula/nome/cargo e dias com marcações.
// Nota: heurísticas genéricas — calibrar quando tivermos amostras reais.

export type ParsedDia = {
  data: string; // yyyy-mm-dd
  diaSemana?: string;
  marcacoes: string[]; // ["07:00","12:00","13:00","17:00"]
  observacaoLinha?: string;
};

export type ParsedFolha = {
  pagina: number;
  matricula?: string;
  nome?: string;
  cargo?: string;
  local?: string;
  programacao?: string;
  dias: ParsedDia[];
  rawText: string;
};

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;
async function loadPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const lib = await import("pdfjs-dist");
      const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
      lib.GlobalWorkerOptions.workerSrc = workerUrl;
      return lib;
    })();
  }
  return pdfjsPromise;
}

const DATA_RE = /\b(\d{2})\/(\d{2})\/(\d{4})\b/;
const HORA_RE = /\b([01]?\d|2[0-3]):([0-5]\d)\b/g;
const MAT_RE = /matr[íi]cula\s*[:.-]?\s*(\d{3,})/i;
const NOME_RE = /nome\s*[:.-]?\s*([A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ][A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ\s']{4,})/i;
const CARGO_RE = /cargo|fun[çc][ãa]o\s*[:.-]?\s*([A-Za-zÀ-ÿ\s]{3,})/i;
const LOCAL_RE = /(local(?:\s+de\s+trabalho)?|setor|centro\s+de\s+custo)\s*[:.-]?\s*([A-Za-z0-9À-ÿ\s\-\/]{3,})/i;

function toIsoDate(dd: string, mm: string, yyyy: string) {
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

export async function parsePontoPdf(file: File): Promise<ParsedFolha[]> {
  const pdfjs = await loadPdfJs();
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf.slice(0) }).promise;
  const folhas: ParsedFolha[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const txt = await page.getTextContent();
    // Reconstroi linhas usando a coordenada Y aproximada.
    const lines = new Map<number, string[]>();
    for (const item of txt.items as any[]) {
      const str = item.str as string;
      if (!str) continue;
      const y = Math.round((item.transform?.[5] ?? 0) as number);
      if (!lines.has(y)) lines.set(y, []);
      lines.get(y)!.push(str);
    }
    const ordered = Array.from(lines.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([, arr]) => arr.join(" ").replace(/\s+/g, " ").trim())
      .filter(Boolean);

    const rawText = ordered.join("\n");
    const matricula = rawText.match(MAT_RE)?.[1];
    const nome = rawText.match(NOME_RE)?.[1]?.trim();
    const cargo = rawText.match(CARGO_RE)?.[2]?.trim();
    const local = rawText.match(LOCAL_RE)?.[2]?.trim();

    const dias: ParsedDia[] = [];
    for (const line of ordered) {
      const dm = line.match(DATA_RE);
      if (!dm) continue;
      const marcacoes: string[] = [];
      let m: RegExpExecArray | null;
      const re = new RegExp(HORA_RE.source, "g");
      while ((m = re.exec(line)) !== null) {
        marcacoes.push(`${m[1].padStart(2, "0")}:${m[2]}`);
      }
      dias.push({
        data: toIsoDate(dm[1], dm[2], dm[3]),
        marcacoes,
        observacaoLinha: line,
      });
    }

    folhas.push({
      pagina: p,
      matricula,
      nome,
      cargo,
      local,
      dias,
      rawText,
    });
  }

  return folhas;
}

// Regras de conformidade: dia é descartado (não abre tratativa) se:
//  - 4 marcações e nenhuma flag negativa;
//  - folga programada (DSR/FOLGA/FDS);
//  - feriado sem trabalho;
//  - HE já autorizada (cruzamento feito fora daqui, no chamador).
export function diaEmConformidade(d: ParsedDia): boolean {
  const linha = (d.observacaoLinha ?? "").toUpperCase();
  if (/FOLGA|DSR|COMPENSA[ÇC][ÃA]O/.test(linha) && d.marcacoes.length === 0) return true;
  if (/FERIADO/.test(linha) && d.marcacoes.length === 0) return true;
  if (d.marcacoes.length >= 4 && !/FALTA|ATRASO|HORA\s*EXTRA|HE|INCONSIST|DIVERG/.test(linha)) return true;
  return false;
}

export function motivoFlag(d: ParsedDia): string {
  const linha = (d.observacaoLinha ?? "").toUpperCase();
  if (/FALTA/.test(linha)) return "FALTA";
  if (/ATRASO/.test(linha)) return "ATRASO";
  if (/HORA\s*EXTRA|\bHE\b/.test(linha)) return "HE_NAO_AUTORIZADA";
  if (d.marcacoes.length > 0 && d.marcacoes.length < 4) return "MARCACOES_INCOMPLETAS";
  if (d.marcacoes.length === 0) return "SEM_MARCACAO";
  return "REVISAR";
}