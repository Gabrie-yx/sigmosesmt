import { supabase } from "@/integrations/supabase/client";
import type { QueryClient } from "@tanstack/react-query";
import { computeStatus, type MatrizCourse, type MatrizEntry, type RoleCourse } from "@/lib/matriz-status";
import { sortMatrixCourses } from "@/lib/nr-order";

export const todayISO = () => new Date().toISOString().slice(0, 10);

/** Busca todas as linhas paginando — evita o teto de 1000 linhas do PostgREST. */
export async function fetchAllRows<T>(
  build: (from: number, to: number) => any,
  pageSize = 1000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}

/** Catálogo de cursos ativos, sempre na mesma ordem (NR numérica) nas duas telas. */
export function matrizCoursesQuery() {
  return {
    queryKey: ["matriz-courses"] as const,
    queryFn: async () => {
      const rows = await fetchAllRows<MatrizCourse>((from, to) =>
        supabase.from("training_matrix_courses").select("*").eq("ativo", true).order("ordem").range(from, to),
      );
      return sortMatrixCourses(rows);
    },
  };
}

export function matrizRoleCoursesQuery() {
  return {
    queryKey: ["matriz-role-courses"] as const,
    queryFn: async () =>
      fetchAllRows<RoleCourse>((from, to) =>
        supabase.from("training_matrix_role_courses").select("*").range(from, to),
      ),
  };
}

/** Lançamentos da matriz. Sem employeeId traz tudo (paginado). */
export function matrizEntriesQuery(employeeId?: string) {
  return {
    queryKey: employeeId ? (["matriz-entries", employeeId] as const) : (["matriz-entries"] as const),
    queryFn: async () =>
      fetchAllRows<MatrizEntry>((from, to) => {
        let q = supabase.from("training_matrix_entries").select("*").range(from, to);
        if (employeeId) q = q.eq("employee_id", employeeId);
        return q;
      }),
  };
}

export type ScheduledItem = {
  employee_id: string;
  course_id: string;
  data_realizacao: string;
  titulo: string | null;
  tipo: string;
};

/** Turmas futuras vinculadas a cursos da matriz → status "A INICIAR". */
export function matrizScheduledQuery(hoje: string, employeeId?: string) {
  return {
    queryKey: employeeId ? (["matriz-scheduled", hoje, employeeId] as const) : (["matriz-scheduled", hoje] as const),
    queryFn: async (): Promise<ScheduledItem[]> => {
      const attendees = await fetchAllRows<{ employee_id: string; training_id: string; situacao: string }>(
        (from, to) => {
          let q = supabase
            .from("training_attendees")
            .select("employee_id, training_id, situacao")
            .in("situacao", ["APROVADO", "PRESENTE"])
            .range(from, to);
          if (employeeId) q = q.eq("employee_id", employeeId);
          return q;
        },
      );
      const trainingIds = Array.from(new Set(attendees.map((r) => r.training_id).filter(Boolean)));
      if (trainingIds.length === 0) return [];
      const trainings: any[] = [];
      for (let i = 0; i < trainingIds.length; i += 200) {
        const { data, error } = await supabase
          .from("trainings")
          .select("id, course_id, data_realizacao, titulo, tipo")
          .in("id", trainingIds.slice(i, i + 200))
          .not("course_id", "is", null)
          .gte("data_realizacao", hoje);
        if (error) throw error;
        trainings.push(...(data ?? []));
      }
      const map = new Map(trainings.map((t) => [t.id, t]));
      return attendees.flatMap((r) => {
        const t = map.get(r.training_id);
        if (!t?.course_id) return [];
        return [
          {
            employee_id: r.employee_id,
            course_id: t.course_id,
            data_realizacao: t.data_realizacao,
            titulo: t.titulo,
            tipo: t.tipo,
          },
        ];
      });
    },
  };
}

export function buildScheduledMap(scheduled: ScheduledItem[]) {
  const m = new Map<string, { data: string; titulo: string }>();
  scheduled.forEach((s) => {
    const k = `${s.employee_id}|${s.course_id}`;
    const cur = m.get(k);
    if (!cur || s.data_realizacao < cur.data) m.set(k, { data: s.data_realizacao, titulo: s.titulo || s.tipo });
  });
  return m;
}

export const A_INICIAR = {
  label: "A INICIAR",
  color: "bg-violet-500/20 text-violet-200 border-violet-400/40",
};

/**
 * Status da célula — fonte única para a tela geral E para a aba do funcionário.
 * Turma futura agendada (ou data de realização no futuro) vira "A INICIAR".
 */
export function computeCellStatus(
  entry: MatrizEntry | undefined,
  course: MatrizCourse,
  agendada?: { data: string; titulo: string },
  hoje: string = todayISO(),
) {
  if (!entry?.status_override) {
    const futura = Boolean(agendada) || Boolean(entry?.data_realizacao && entry.data_realizacao >= hoje);
    if (futura) return { ...A_INICIAR, expira: undefined as string | undefined };
  }
  return computeStatus(entry, course);
}

/** Invalida tudo que depende da matriz, nas duas telas (geral e ficha). */
export function invalidateMatriz(qc: QueryClient) {
  qc.invalidateQueries({
    predicate: (q) => {
      const k = q.queryKey[0];
      return k === "matriz-entries" || k === "matriz-scheduled" || k === "matriz-courses" || k === "matriz-role-courses";
    },
  });
}

/** Grava (upsert) um lançamento da matriz sem duplicar linhas. */
export async function saveMatrizEntry(input: {
  employee_id: string;
  course_id: string;
  data_realizacao: string | null;
  status_override: string | null;
  observacao: string | null;
  entryId?: string;
}) {
  const payload = {
    employee_id: input.employee_id,
    course_id: input.course_id,
    data_realizacao: input.data_realizacao,
    status_override: input.status_override,
    observacao: input.observacao,
  };
  if (input.entryId) {
    const { error } = await supabase.from("training_matrix_entries").update(payload).eq("id", input.entryId);
    if (error) throw error;
    return;
  }
  const { data: existing } = await supabase
    .from("training_matrix_entries")
    .select("id")
    .eq("employee_id", input.employee_id)
    .eq("course_id", input.course_id)
    .maybeSingle();
  if (existing?.id) {
    const { error } = await supabase.from("training_matrix_entries").update(payload).eq("id", existing.id);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("training_matrix_entries").insert(payload);
  if (error) throw error;
}
