import * as XLSX from "xlsx";

export type CalNormaVinculada = {
  codigo_norma: string;
  descricao_norma?: string;
  data_inclusao?: string;
};

export type CalPlanoAcaoImportado = {
  codigo_pa?: string;
  texto: string;
  tipo?: string;
  status?: string;
  data_prevista?: string;
  data_conclusao?: string;
  recorrente: boolean;
  intervalo_recorrencia_dias?: number;
  custo?: number;
  natureza_custo?: string;
  usuario_execucao?: string;
  usuario_gestao?: string;
};

export type CalRequisitoImportado = {
  numero_cal: string; // RQTCL...  (chave única no Ius Natura)
  codigo_requisito_generico?: string; // RL...
  cliente?: string; // CAL + nome (ex.: "DMN Estaleiro da Amazonia")
  codigo_cal?: string; // CAL5076
  ementa: string;
  norma: string; // resumo das normas para busca rápida
  texto_legal?: string;
  temas: string[];
  tipo_evidencia?: string;
  evidencia_texto?: string;
  justificativa?: string;
  area?: string; // Área responsável
  area_incidencia?: string;
  status_vcl?: string;
  data_vcl?: string;
  data_ultima_alteracao_ius?: string;
  data_inclusao_cal?: string;
  criticidade: "baixa" | "media" | "alta" | "critica";
  status_ius: string; // "Atendido" / "Pendente" / etc (bruto do Ius Natura)
  normas: CalNormaVinculada[];
  planos_acao: CalPlanoAcaoImportado[];
  content_hash: string;
  raw: Record<string, unknown>;
};

export type CalParseResult = {
  requisitos: CalRequisitoImportado[];
  total_linhas: number;
};

const norm = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

function findHeaderRow(rows: unknown[][]): number {
  const targets = ["codigo do requisito de cal", "descricao do requisito", "codigo do cal"];
  const scan = Math.min(rows.length, 20);
  for (let i = 0; i < scan; i++) {
    const row = (rows[i] ?? []).map(norm);
    const hits = targets.filter((t) => row.some((c) => c.includes(t))).length;
    if (hits >= 2) return i;
  }
  return 0;
}

/** Erro amigável quando a planilha não é a exportação de "Requisito de CAL". */
export class CalPlanilhaInvalidaError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "CalPlanilhaInvalidaError";
  }
}

function assertRequisitosSheet(headers: string[], sheetName: string) {
  const set = new Set(headers.map(norm));
  const need = ["codigo do requisito de cal", "descricao do requisito"];
  const missing = need.filter((n) => ![...set].some((h) => h.includes(n)));
  if (missing.length) {
    // Detecta se é a planilha de Plano de Ação (que tem 'Código' + 'Requisito Legal')
    const parece_plano =
      [...set].some((h) => h === "codigo") &&
      [...set].some((h) => h.includes("requisito legal")) &&
      [...set].some((h) => h.includes("plano de acao"));
    if (parece_plano) {
      throw new CalPlanilhaInvalidaError(
        `Este arquivo é a exportação de "Plano de Ação" do Ius Natura (aba "${sheetName}"). ` +
          `Esta tela importa a exportação de "Requisito de CAL". ` +
          `Baixe do Ius Natura o relatório "Requisito de CAL" (colunas 'Código do Requisito de CAL', 'Descrição do Requisito' etc.) e envie novamente.`,
      );
    }
    throw new CalPlanilhaInvalidaError(
      `Planilha não reconhecida como "Requisito de CAL" do Ius Natura. ` +
        `Colunas obrigatórias ausentes: ${missing.join(", ")}. ` +
        `Envie a exportação correta (aba "Requisito de CAL").`,
    );
  }
}

function pick(row: Record<string, unknown>, ...candidates: string[]): string | undefined {
  for (const c of candidates) {
    const target = norm(c);
    for (const [k, v] of Object.entries(row)) {
      if (norm(k) === target) {
        const val = String(v ?? "").trim();
        if (val) return val;
      }
    }
  }
  return undefined;
}

function parseCriticidade(v?: string): CalRequisitoImportado["criticidade"] {
  const n = norm(v);
  if (n.includes("sim") || n.includes("critic")) return "critica";
  if (n.includes("alta") || n.includes("alto")) return "alta";
  if (n.includes("baix")) return "baixa";
  return "media";
}

function parseDate(v: unknown): string | undefined {
  if (v == null || v === "") return undefined;
  if (typeof v === "number") {
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

function splitList(s?: string): string[] {
  if (!s) return [];
  return s
    .split(/[;\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function mapStatusIus(s?: string): string {
  return String(s ?? "").trim();
}

/** Hash simples e determinístico (djb2) do conteúdo relevante do requisito. */
function contentHash(payload: unknown): string {
  const s = JSON.stringify(payload);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export async function parseCalPlanilha(file: File): Promise<CalParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });
  if (!matrix.length) return { requisitos: [], total_linhas: 0 };
  const headerIdx = findHeaderRow(matrix);
  const headers = (matrix[headerIdx] as unknown[]).map((h, i) => String(h ?? `col_${i}`));
  assertRequisitosSheet(headers, sheetName);

  // Agrupamos por "Código do Requisito de CAL" (RQTCL...) — cada RQTCL pode
  // aparecer em várias linhas (1 por Norma Legal vinculada).
  const map = new Map<string, CalRequisitoImportado>();
  let totalLinhas = 0;

  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const rawRow = matrix[i] as unknown[];
    if (!rawRow || rawRow.every((v) => v == null || String(v).trim() === "")) continue;
    const rec: Record<string, unknown> = {};
    headers.forEach((h, idx) => (rec[h] = rawRow[idx]));
    totalLinhas++;

    const rqtcl = pick(rec, "Código do Requisito de CAL");
    if (!rqtcl) continue;

    const codigosNorma = splitList(pick(rec, "Código da Norma Legal"));
    const descsNorma = splitList(pick(rec, "Normas Legais associadas"));
    const dataInclusaoLine = pick(rec, "Data de inclusão da Norma Legal CAL");
    // "NL11763 - 12/06/2024; NL16539 - 12/06/2024"
    const inclusaoMap = new Map<string, string>();
    if (dataInclusaoLine) {
      for (const chunk of splitList(dataInclusaoLine)) {
        const m = chunk.match(/^(\S+)\s*-\s*(.+)$/);
        if (m) {
          const d = parseDate(m[2]);
          if (d) inclusaoMap.set(m[1], d);
        }
      }
    }
    const normasLinha: CalNormaVinculada[] = codigosNorma.map((cod, idx) => ({
      codigo_norma: cod,
      descricao_norma: descsNorma[idx],
      data_inclusao: inclusaoMap.get(cod),
    }));

    const paTexto = pick(rec, "Texto do Plano de Ação");
    const planosLinha: CalPlanoAcaoImportado[] = paTexto
      ? [
          {
            codigo_pa: pick(rec, "Código de Requisito de Plano de Açao"),
            texto: paTexto,
            tipo: pick(rec, "Tipo do Plano de Ação"),
            status: pick(rec, "Status do Plano de Ação"),
            data_prevista: parseDate(pick(rec, "Data prevista avaliação")),
            data_conclusao: parseDate(pick(rec, "Data de conclusão")),
            recorrente: norm(pick(rec, "Plano de Ação recorrente")).startsWith("s"),
            intervalo_recorrencia_dias: Number(
              pick(rec, "Intervalo de recorrência (dias)") ?? 0,
            ) || undefined,
            custo: Number(pick(rec, "Custo") ?? 0) || undefined,
            natureza_custo: pick(rec, "Natureza do custo"),
            usuario_execucao: pick(rec, "Usuário responsável pela execução"),
            usuario_gestao: pick(rec, "Usuário responsável pela gestão"),
          },
        ]
      : [];

    const existing = map.get(rqtcl);
    if (existing) {
      // append novas normas / planos únicos
      for (const n of normasLinha) {
        if (!existing.normas.some((x) => x.codigo_norma === n.codigo_norma)) {
          existing.normas.push(n);
        }
      }
      for (const p of planosLinha) {
        if (!existing.planos_acao.some((x) => x.codigo_pa === p.codigo_pa && x.texto === p.texto)) {
          existing.planos_acao.push(p);
        }
      }
      continue;
    }

    const ementa = pick(rec, "Descrição do Requisito") ?? "(sem descrição)";
    const normaResumo =
      descsNorma.slice(0, 3).join("; ") + (descsNorma.length > 3 ? "…" : "");
    const temas = splitList(pick(rec, "Temas do Requisito"));

    const req: CalRequisitoImportado = {
      numero_cal: rqtcl,
      codigo_requisito_generico: pick(rec, "Código do Requisito"),
      cliente: pick(rec, "CAL"),
      codigo_cal: pick(rec, "Código do CAL"),
      ementa,
      norma: normaResumo || "N/D",
      texto_legal: ementa.length > 500 ? ementa : undefined,
      temas,
      tipo_evidencia: pick(rec, "Tipo de evidência"),
      evidencia_texto: pick(rec, "Evidência"),
      justificativa: pick(rec, "Justificativa"),
      area: pick(rec, "Área responsável"),
      area_incidencia: pick(rec, "Área onde incide"),
      status_vcl: pick(rec, "Status da VCL"),
      data_vcl: parseDate(pick(rec, "Data da VCL")),
      data_ultima_alteracao_ius: parseDate(pick(rec, "Data última alteração do Requisito de CAL")),
      data_inclusao_cal: parseDate(pick(rec, "Data de inclusão do requisito no CAL")),
      criticidade: parseCriticidade(pick(rec, "Requisito é crítico")),
      status_ius: mapStatusIus(pick(rec, "Status consolidado do requisito")),
      normas: normasLinha,
      planos_acao: planosLinha,
      content_hash: "",
      raw: rec,
    };
    map.set(rqtcl, req);
  }

  const requisitos = Array.from(map.values()).map((r) => ({
    ...r,
    content_hash: contentHash({
      e: r.ementa,
      s: r.status_ius,
      v: r.status_vcl,
      d: r.data_ultima_alteracao_ius,
      n: r.normas.map((x) => x.codigo_norma).sort(),
      p: r.planos_acao.map((x) => `${x.codigo_pa}|${x.status}|${x.data_conclusao}`).sort(),
    }),
  }));

  return { requisitos, total_linhas: totalLinhas };
}

/** Mapeia o "Status consolidado do requisito" do Ius Natura para o enum do SIGMO. */
export function mapStatusIusToCal(status: string): string {
  const n = norm(status);
  if (n.includes("atendido")) return "atendido";
  if (n.includes("nao aplic") || n.includes("não aplic")) return "nao_aplicavel";
  if (n.includes("monitor")) return "monitoramento";
  if (n.includes("tratativa") || n.includes("acao")) return "em_tratativa";
  if (n.includes("analise") || n.includes("análise")) return "em_analise";
  if (n.includes("aplic")) return "aplicavel";
  return "recebido";
}

// ============================================================
// Parser da planilha de "Plano de Ação" (export separado do Ius Natura)
// ============================================================

export type CalPlanoAcaoLinhaImportada = CalPlanoAcaoImportado & {
  /** Código do Requisito de CAL (RQTCL...) — usado para vincular ao requisito */
  numero_cal?: string;
  /** Códigos RL (Requisito Legal) extraídos da célula — cada PA pode referenciar vários RLs */
  codigos_rl?: string[];
};

export type CalPlanoAcaoParseResult = {
  planos: CalPlanoAcaoLinhaImportada[];
  total_linhas: number;
};

function findPlanoHeaderRow(rows: unknown[][]): number {
  const scan = Math.min(rows.length, 20);
  const targets = ["plano de acao", "requisito legal", "codigo", "descricao"];
  for (let i = 0; i < scan; i++) {
    const row = (rows[i] ?? []).map(norm);
    const hits = targets.filter((t) => row.some((c) => c.includes(t))).length;
    if (hits >= 2) return i;
  }
  return 0;
}

function assertPlanoAcaoSheet(headers: string[], sheetName: string) {
  const set = new Set(headers.map(norm));
  const hasPA =
    [...set].some((h) => h.includes("plano de acao")) ||
    [...set].some((h) => h.includes("texto do plano")) ||
    [...set].some((h) => h.includes("descricao"));
  const hasReq =
    [...set].some((h) => h.includes("requisito legal")) ||
    [...set].some((h) => h.includes("codigo do requisito")) ||
    [...set].some((h) => h.includes("codigo") && !h.includes("cliente"));
  if (!hasPA || !hasReq) {
    // Se parece a planilha de Requisitos, avisa
    const pareceReq =
      [...set].some((h) => h.includes("codigo do requisito de cal")) &&
      [...set].some((h) => h.includes("descricao do requisito"));
    if (pareceReq) {
      throw new CalPlanilhaInvalidaError(
        `Este arquivo é a exportação de "Requisito de CAL" do Ius Natura (aba "${sheetName}"). ` +
          `Para importar apenas Planos de Ação, envie a exportação "Plano de Ação".`,
      );
    }
    throw new CalPlanilhaInvalidaError(
      `Planilha não reconhecida como "Plano de Ação" do Ius Natura (aba "${sheetName}"). ` +
        `Esperado colunas como 'Código', 'Requisito Legal' e 'Plano de Ação'.`,
    );
  }
}

export async function parseCalPlanoAcaoPlanilha(file: File): Promise<CalPlanoAcaoParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });
  if (!matrix.length) return { planos: [], total_linhas: 0 };
  const headerIdx = findPlanoHeaderRow(matrix);
  const headers = (matrix[headerIdx] as unknown[]).map((h, i) => String(h ?? `col_${i}`));
  assertPlanoAcaoSheet(headers, sheetName);

  const planos: CalPlanoAcaoLinhaImportada[] = [];
  let totalLinhas = 0;

  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const rawRow = matrix[i] as unknown[];
    if (!rawRow || rawRow.every((v) => v == null || String(v).trim() === "")) continue;
    const rec: Record<string, unknown> = {};
    headers.forEach((h, idx) => (rec[h] = rawRow[idx]));
    totalLinhas++;

    const texto =
      pick(
        rec,
        "Texto do Plano de Ação",
        "Plano de Ação",
        "Plano de Acao",
        "Descrição do Plano de Ação",
        "Descrição",
        "Descricao",
      ) ?? "";
    if (!texto) continue;

    const codigo_pa = pick(
      rec,
      "Código de Requisito de Plano de Açao",
      "Código do Plano de Ação",
      "Código do Plano de Acao",
      "Código",
      "Codigo",
    );

    const numero_cal = pick(
      rec,
      "Código do Requisito de CAL",
      "Requisito de CAL",
      "Código do Requisito Legal",
    );

    // Extrai TODOS os códigos RL da célula "Requisito Legal" (que costuma trazer
    // várias entradas "RL#### - texto..." separadas por quebras de linha).
    const rlCell =
      pick(rec, "Requisito Legal", "Requisitos Legais", "Requisitos") ?? "";
    const codigos_rl = Array.from(
      new Set(String(rlCell).match(/RL\d+/gi)?.map((s) => s.toUpperCase()) ?? []),
    );

    planos.push({
      codigo_pa,
      numero_cal,
      codigos_rl,
      texto,
      tipo: pick(rec, "Tipo do Plano de Ação", "Tipo"),
      status: pick(rec, "Status do Plano de Ação", "Status"),
      data_prevista: parseDate(pick(rec, "Data prevista avaliação", "Data prevista", "Prazo")),
      data_conclusao: parseDate(pick(rec, "Data de conclusão", "Data conclusão", "Concluído em")),
      recorrente: norm(pick(rec, "Plano de Ação recorrente", "Recorrente")).startsWith("s"),
      intervalo_recorrencia_dias:
        Number(pick(rec, "Intervalo de recorrência (dias)", "Intervalo de recorrência") ?? 0) || undefined,
      custo: Number(pick(rec, "Custo") ?? 0) || undefined,
      natureza_custo: pick(rec, "Natureza do custo"),
      usuario_execucao: pick(
        rec,
        "Usuário responsável pela execução",
        "Responsável pela execução",
        "Responsável",
      ),
      usuario_gestao: pick(
        rec,
        "Usuário responsável pela gestão",
        "Responsável pela gestão",
        "Resp. Gestão",
        "Resp Gestao",
        "Gestor",
      ),
    });
  }

  return { planos, total_linhas: totalLinhas };
}
