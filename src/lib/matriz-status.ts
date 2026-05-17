export type MatrizCourse = {
  id: string;
  codigo: string;
  nome: string;
  periodicidade: string;
  ordem: number;
  ativo: boolean;
  categoria?: string | null;
  descricao?: string | null;
  carga_horaria_h?: number | null;
};

export type MatrizEntry = {
  id: string;
  employee_id: string;
  course_id: string;
  data_realizacao: string | null;
  status_override: string | null;
  observacao: string | null;
};

export type SectorCourse = { setor: string; course_id: string };
export type RoleCourse = { role_id: string; course_id: string };

export const PERIODICIDADES = ["ADMISSAO", "ANUAL", "BIENAL", "NA"] as const;
export const STATUS_OVERRIDE = ["REALIZADO", "PENDENTE", "EM_ANDAMENTO", "NAO_SE_APLICA"] as const;
export const CATEGORIAS = [
  "NR",
  "CURSO",
  "PALESTRA",
  "WORKSHOP",
  "OFICINA",
  "INTEGRACAO",
  "RECICLAGEM",
  "OUTRO",
] as const;

export const CATEGORIA_LABEL: Record<string, string> = {
  NR: "Norma Regulamentadora",
  CURSO: "Curso",
  PALESTRA: "Palestra",
  WORKSHOP: "Workshop",
  OFICINA: "Oficina",
  INTEGRACAO: "Integração",
  RECICLAGEM: "Reciclagem",
  OUTRO: "Outro",
};

export const CATEGORIA_COLOR: Record<string, string> = {
  NR: "bg-red-100 text-red-700 border-red-200",
  CURSO: "bg-blue-100 text-blue-700 border-blue-200",
  PALESTRA: "bg-violet-100 text-violet-700 border-violet-200",
  WORKSHOP: "bg-amber-100 text-amber-700 border-amber-200",
  OFICINA: "bg-orange-100 text-orange-700 border-orange-200",
  INTEGRACAO: "bg-emerald-100 text-emerald-700 border-emerald-200",
  RECICLAGEM: "bg-cyan-100 text-cyan-700 border-cyan-200",
  OUTRO: "bg-slate-100 text-slate-700 border-slate-200",
};

export function periodMonths(p: string): number | null {
  if (p === "ANUAL") return 12;
  if (p === "BIENAL") return 24;
  return null;
}

export type StatusInfo = { label: string; color: string; expira?: string };

export function computeStatus(entry: MatrizEntry | undefined, course: MatrizCourse): StatusInfo {
  if (entry?.status_override) {
    const map: Record<string, StatusInfo> = {
      REALIZADO: { label: "REALIZADO", color: "bg-emerald-100 text-emerald-700 border-emerald-300" },
      PENDENTE: { label: "PENDENTE", color: "bg-red-100 text-red-700 border-red-300" },
      EM_ANDAMENTO: { label: "EM ANDAMENTO", color: "bg-blue-100 text-blue-700 border-blue-300" },
      NAO_SE_APLICA: { label: "N/A", color: "bg-slate-100 text-slate-500 border-slate-300" },
    };
    return map[entry.status_override] ?? map.PENDENTE;
  }
  if (course.periodicidade === "NA")
    return { label: "N/A", color: "bg-slate-100 text-slate-500 border-slate-300" };
  if (!entry?.data_realizacao)
    return { label: "PENDENTE", color: "bg-red-100 text-red-700 border-red-300" };
  if (course.periodicidade === "ADMISSAO")
    return { label: "REALIZADO", color: "bg-emerald-100 text-emerald-700 border-emerald-300" };
  const months = periodMonths(course.periodicidade);
  if (!months) return { label: "REALIZADO", color: "bg-emerald-100 text-emerald-700 border-emerald-300" };
  const dt = new Date(entry.data_realizacao);
  dt.setMonth(dt.getMonth() + months);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expira = dt.toISOString().slice(0, 10);
  const diff = Math.floor((dt.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return { label: "VENCIDO", color: "bg-red-100 text-red-700 border-red-300", expira };
  if (diff <= 30) return { label: "A VENCER", color: "bg-amber-100 text-amber-700 border-amber-300", expira };
  return { label: "REALIZADO", color: "bg-emerald-100 text-emerald-700 border-emerald-300", expira };
}

/** Cursos exigidos para um funcionário (por função — NR-01). */
export function requiredCourseIds(
  emp: { role_id: string | null },
  roleCourses: RoleCourse[],
): Set<string> {
  const ids = new Set<string>();
  roleCourses.forEach((rc) => {
    if (emp.role_id && rc.role_id === emp.role_id) ids.add(rc.course_id);
  });
  return ids;
}