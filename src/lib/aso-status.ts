/**
 * Fonte única de verdade do status de ASO de um funcionário.
 *
 * Ordem de precedência:
 *  1. Último registro em `employee_exams` cujo tipo/natureza caracteriza um ASO
 *     (tem data_realizacao e data_vencimento reais, informados pela clínica).
 *  2. Campo legado `employees.data_aso` + periodicidade padrão (12 meses, NR-7).
 *
 * Antes disso o módulo de convocação lia SOMENTE `employees.data_aso`, que
 * ninguém alimentava — por isso o ofício saía com "Último ASO realizado em —".
 */

export const PERIODICIDADE_PADRAO_MESES = 12;

export type ExamRow = {
  employee_id: string;
  tipo_exame: string | null;
  natureza: string | null;
  data_realizacao: string | null;
  data_vencimento: string | null;
  periodicidade_meses: number | null;
  aptidao?: string | null;
};

export type AsoInfo = {
  ultimo: Date | null;
  vencimento: Date | null;
  natureza: string | null;
  periodicidade: number;
  aptidao: string | null;
  origem: "EXAME" | "LEGADO" | "NENHUM";
};

export function toDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  const d = new Date(`${s}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

export function addMonths(date: Date, m: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + m);
  return d;
}

export function daysBetween(a: Date, b: Date) {
  return Math.floor((a.getTime() - b.getTime()) / 86_400_000);
}

export function fmtDate(d: Date | null) {
  return d ? d.toLocaleDateString("pt-BR") : "—";
}

/** Um exame conta como ASO quando é o exame clínico/admissional etc. */
export function isAsoExam(ex: ExamRow) {
  const t = (ex.tipo_exame ?? "").toLowerCase();
  return t.includes("aso") || t.includes("clínic") || t.includes("clinic") || t.includes("médico") || t.includes("medico");
}

/** Reduz a lista de exames do funcionário ao ASO mais recente. */
export function latestAsoExam(exams: ExamRow[]): ExamRow | null {
  const asos = exams.filter(isAsoExam).filter((e) => !!e.data_realizacao);
  if (!asos.length) return null;
  return asos.sort((a, b) => (b.data_realizacao ?? "").localeCompare(a.data_realizacao ?? ""))[0];
}

export function computeAso(exams: ExamRow[], dataAsoLegado: string | null | undefined): AsoInfo {
  const ex = latestAsoExam(exams);
  if (ex) {
    const ultimo = toDate(ex.data_realizacao);
    const periodicidade = ex.periodicidade_meses || PERIODICIDADE_PADRAO_MESES;
    const vencimento = toDate(ex.data_vencimento) ?? (ultimo ? addMonths(ultimo, periodicidade) : null);
    return {
      ultimo,
      vencimento,
      natureza: ex.natureza ?? null,
      periodicidade,
      aptidao: ex.aptidao ?? null,
      origem: "EXAME",
    };
  }
  const ultimo = toDate(dataAsoLegado);
  if (ultimo) {
    return {
      ultimo,
      vencimento: addMonths(ultimo, PERIODICIDADE_PADRAO_MESES),
      natureza: null,
      periodicidade: PERIODICIDADE_PADRAO_MESES,
      aptidao: null,
      origem: "LEGADO",
    };
  }
  return { ultimo: null, vencimento: null, natureza: null, periodicidade: PERIODICIDADE_PADRAO_MESES, aptidao: null, origem: "NENHUM" };
}

/** Dias até o vencimento (negativo = vencido; null = sem ASO). */
export function diasParaVencer(info: AsoInfo, hoje = new Date()): number | null {
  if (!info.vencimento) return null;
  const h = new Date(hoje);
  h.setHours(0, 0, 0, 0);
  return daysBetween(info.vencimento, h);
}

/** Bucket exclusivo — evita a contagem dos cards divergir da lista. */
export type Bucket = "VENCIDOS" | "30" | "60" | "90" | "EM_DIA";
export function bucketOf(dias: number | null): Bucket {
  if (dias === null || dias < 0) return "VENCIDOS";
  if (dias <= 30) return "30";
  if (dias <= 60) return "60";
  if (dias <= 90) return "90";
  return "EM_DIA";
}

export function normalizeNome(v: string | null | undefined) {
  return (v ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}
