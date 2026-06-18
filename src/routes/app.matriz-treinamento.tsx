import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GraduationCap, Plus, Pencil, Trash2, Settings2, Filter, Save, Users, ChevronDown, Search, X } from "lucide-react";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/utils-date";
import {
  computeStatus,
  requiredCourseIds,
  PERIODICIDADES,
  STATUS_OVERRIDE,
  CATEGORIAS,
  CATEGORIA_LABEL,
  CATEGORIA_COLOR,
  type MatrizCourse as Course,
  type MatrizEntry as Entry,
  type RoleCourse,
} from "@/lib/matriz-status";

export const Route = createFileRoute("/app/matriz-treinamento")({
  component: MatrizPage,
});

const SETORES_PADRAO = ["PRODUCAO", "ALMOXARIFADO", "ADMINISTRATIVO", "MANUTENCAO"] as const;
const STATUS_FILTROS = [
  { value: "ALL", label: "Todos" },
  { value: "REALIZADO", label: "Realizado" },
  { value: "A_VENCER", label: "A vencer" },
  { value: "VENCIDO_PENDENTE", label: "Pendente / Vencido" },
  { value: "EM_ANDAMENTO", label: "Em andamento" },
  { value: "A_INICIAR", label: "A iniciar (turma agendada)" },
  { value: "NA", label: "N/A" },
] as const;

const STATUS_CELL_MAP: Record<string, string[]> = {
  REALIZADO: ["REALIZADO"],
  A_VENCER: ["A VENCER"],
  VENCIDO_PENDENTE: ["VENCIDO", "PENDENTE"],
  EM_ANDAMENTO: ["EM ANDAMENTO"],
  NA: ["N/A"],
  A_INICIAR: ["A INICIAR"],
};

const CELL_BG: Record<string, string> = {
  // Paleta segura p/ daltônicos (Okabe-Ito adaptado):
  // verde = ok | amarelo = atenção | bordô = vencido | salmão = pendente
  // ciano = em andamento (azul distintivo) | roxo = a iniciar (violeta distintivo)
  "REALIZADO": "bg-emerald-400 hover:bg-emerald-500",
  "A VENCER": "bg-amber-400 hover:bg-amber-500",
  "VENCIDO": "bg-red-600 hover:bg-red-700",
  "PENDENTE": "bg-rose-300 hover:bg-rose-400",
  "EM ANDAMENTO": "bg-cyan-500 hover:bg-cyan-600",
  "A INICIAR": "bg-violet-500 hover:bg-violet-600",
  "N/A": "bg-white/10 hover:bg-white/20",
};

const STATUS_LEGENDA = [
  { label: "Realizado", className: CELL_BG["REALIZADO"], detalhe: "concluído e válido" },
  { label: "A vencer", className: CELL_BG["A VENCER"], detalhe: "vence em até 30 dias" },
  { label: "Vencido", className: CELL_BG["VENCIDO"], detalhe: "validade expirada" },
  { label: "Pendente", className: CELL_BG["PENDENTE"], detalhe: "sem realização" },
  { label: "Em andamento", className: CELL_BG["EM ANDAMENTO"], detalhe: "em execução" },
  { label: "A iniciar", className: CELL_BG["A INICIAR"], detalhe: "turma futura agendada" },
  { label: "N/A", className: CELL_BG["N/A"], detalhe: "não aplicável" },
] as const;

const todayISO = () => new Date().toISOString().slice(0, 10);

type Employee = {
  id: string; matricula: string | null; nome: string;
  setor: string | null; company_id: string | null; role_id: string | null;
};
type Company = { id: string; name: string; type: string };
type Role = { id: string; name: string };

function MatrizPage() {
  const qc = useQueryClient();
  const { isEditor, isAdmin } = useAuth();
  const hoje = todayISO();

  const [filtroSetor, setFiltroSetor] = useState<string>("ALL");
  const [filtroVinculo, setFiltroVinculo] = useState<string>("ALL");
  const [filtroStatus, setFiltroStatus] = useState<string>("ALL");
  const [busca, setBusca] = useState("");
  const [editing, setEditing] = useState<{ emp: Employee; course: Course; entry?: Entry } | null>(null);
  const [openCatalog, setOpenCatalog] = useState(false);
  const [openSetores, setOpenSetores] = useState(false);
  const [openEmp, setOpenEmp] = useState<Employee | null | "new">(null);
  const [openBulk, setOpenBulk] = useState(false);

  const { data: courses = [] } = useQuery<Course[]>({
    queryKey: ["matriz-courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("training_matrix_courses")
        .select("*").eq("ativo", true).order("ordem");
      if (error) throw error; return data as Course[];
    },
  });

  const { data: roleCourses = [] } = useQuery<RoleCourse[]>({
    queryKey: ["matriz-role-courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("training_matrix_role_courses").select("*");
      if (error) throw error; return data as RoleCourse[];
    },
  });

  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ["roles-list"],
    queryFn: async () => (await supabase.from("roles").select("id,name").eq("ativo", true).order("name")).data ?? [],
  });

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["companies"],
    queryFn: async () => (await supabase.from("companies").select("id,name,type")).data ?? [],
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["matriz-employees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees")
        .select("id,matricula,nome,setor,company_id,role_id").eq("status", "ATIVO").order("nome");
      if (error) throw error; return data as Employee[];
    },
  });

  const { data: entries = [] } = useQuery<Entry[]>({
    queryKey: ["matriz-entries"],
    queryFn: async () => {
      const { data, error } = await supabase.from("training_matrix_entries").select("*");
      if (error) throw error; return data as Entry[];
    },
  });

  // Inscritos em turmas vinculadas a curso da matriz (mostrar "A INICIAR")
  const { data: scheduled = [] } = useQuery<Array<{ employee_id: string; course_id: string; data_realizacao: string; titulo: string | null; tipo: string }>>({
    queryKey: ["matriz-scheduled", hoje],
    queryFn: async () => {
      const { data: attendees, error: attendeesError } = await supabase
        .from("training_attendees")
        .select("employee_id, training_id, situacao")
        .in("situacao", ["APROVADO", "PRESENTE"]);
      if (attendeesError) throw attendeesError;
      const trainingIds = Array.from(new Set((attendees ?? []).map((r: any) => r.training_id).filter(Boolean)));
      if (trainingIds.length === 0) return [];
      const { data: trainings, error: trainingsError } = await supabase
        .from("trainings")
        .select("id, course_id, data_realizacao, titulo, tipo")
        .in("id", trainingIds)
        .not("course_id", "is", null)
        .gte("data_realizacao", hoje);
      if (trainingsError) throw trainingsError;
      const trainingMap = new Map((trainings ?? []).map((t: any) => [t.id, t]));
      return (attendees ?? []).flatMap((r: any) => {
        const t = trainingMap.get(r.training_id) as any;
        if (!t?.course_id) return [];
        return [{
          employee_id: r.employee_id,
          course_id: t.course_id,
          data_realizacao: t.data_realizacao,
          titulo: t.titulo,
          tipo: t.tipo,
        }];
      });
    },
  });

  const scheduledMap = useMemo(() => {
    const m = new Map<string, { data: string; titulo: string }>();
    scheduled.forEach((s) => {
      const k = `${s.employee_id}|${s.course_id}`;
      const cur = m.get(k);
      // Mantém a próxima data agendada
      if (!cur || s.data_realizacao < cur.data) {
        m.set(k, { data: s.data_realizacao, titulo: s.titulo || s.tipo });
      }
    });
    return m;
  }, [scheduled]);

  const compMap = useMemo(() => Object.fromEntries(companies.map((c) => [c.id, c])), [companies]);
  const entryMap = useMemo(() => {
    const m = new Map<string, Entry>();
    entries.forEach((e) => m.set(`${e.employee_id}|${e.course_id}`, e));
    return m;
  }, [entries]);

  const empsFiltrados = useMemo(() => {
    const base = employees.filter((e) => {
      if (filtroSetor !== "ALL" && (e.setor ?? "") !== filtroSetor) return false;
      if (filtroVinculo !== "ALL") {
        const c = e.company_id ? compMap[e.company_id] : null;
        if ((c?.type ?? "") !== filtroVinculo) return false;
      }
      if (busca) {
        const q = busca.toLowerCase();
        const txt = `${e.nome} ${e.matricula ?? ""}`.toLowerCase();
        if (!txt.includes(q)) return false;
      }
      return true;
    });
    if (filtroStatus === "ALL") return base;
    if (filtroStatus === "A_INICIAR") {
      return base.filter((e) => {
        const requiredIds = requiredCourseIds(e, roleCourses);
        return courses.some((c) => {
          if (!requiredIds.has(c.id)) return false;
          const en = entryMap.get(`${e.id}|${c.id}`);
          const sched = scheduledMap.get(`${e.id}|${c.id}`);
          return Boolean(sched) || Boolean(en?.data_realizacao && en.data_realizacao >= hoje);
        });
      });
    }
    const wanted = new Set(STATUS_CELL_MAP[filtroStatus] ?? []);
    return base.filter((e) =>
      courses.some((c) => {
        const en = entryMap.get(`${e.id}|${c.id}`);
        const sched = scheduledMap.get(`${e.id}|${c.id}`);
        const required = requiredCourseIds(e, roleCourses).has(c.id);
        if (!required) return false;
        const showAIniciar = Boolean(sched) || Boolean(en?.data_realizacao && en.data_realizacao >= hoje);
        const statusLabel = showAIniciar ? "A INICIAR" : computeStatus(en, c).label;
        return wanted.has(statusLabel);
      }),
    );
  }, [employees, filtroSetor, filtroVinculo, busca, compMap, filtroStatus, courses, entryMap, roleCourses, scheduledMap, hoje]);

  // Cursos visíveis: somente os exigidos pela função dos funcionários filtrados.
  // Lançamentos manuais ou históricos fora da função não criam coluna na matriz.
  const cursosVisiveis = useMemo(() => {
    const ids = new Set<string>();
    empsFiltrados.forEach((e) => {
      requiredCourseIds(e, roleCourses).forEach((id) => ids.add(id));
    });
    return courses.filter((c) => ids.has(c.id));
  }, [courses, roleCourses, empsFiltrados]);

  return (
    <div className="p-4 md:p-6 animate-fadeIn h-full">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="heading-display text-2xl md:text-3xl text-rose-100 drop-shadow-[0_2px_12px_rgba(220,38,70,0.45)] flex items-center gap-3">
          <GraduationCap className="h-7 w-7 text-rose-300 drop-shadow-[0_0_8px_rgba(244,80,110,0.7)]" /> Matriz de Treinamento — 2026
        </h2>
        {isEditor && (
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setOpenEmp("new")}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Funcionário
            </Button>
            <Button variant="outline" size="sm" onClick={() => setOpenBulk(true)}>
              <Users className="h-3.5 w-3.5 mr-1" /> Inserir em massa
            </Button>
            <Button variant="outline" size="sm" onClick={() => setOpenCatalog(true)}>
              <Settings2 className="h-3.5 w-3.5 mr-1" /> Cursos / NRs
            </Button>
            <Button variant="outline" size="sm" onClick={() => setOpenSetores(true)}>
              <Settings2 className="h-3.5 w-3.5 mr-1" /> Vincular por Função
            </Button>
          </div>
        )}
      </div>

      <div className="glass-card glass-shine rounded-xl p-3 mb-3 flex flex-wrap items-end gap-3 border-rose-300/20 shadow-[0_0_34px_-12px_rgba(220,38,70,0.72)]">
        <div className="flex items-center gap-2 text-xs font-bold text-rose-200/70 uppercase">
          <Filter className="h-4 w-4" /> Filtros
        </div>
        <div>
          <Label className="text-[10px] font-black text-rose-200/70 uppercase">Setor</Label>
          <Select value={filtroSetor} onValueChange={setFiltroSetor}>
            <SelectTrigger className="mt-1 h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              {SETORES_PADRAO.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] font-black text-rose-200/70 uppercase">Vínculo</Label>
          <Select value={filtroVinculo} onValueChange={setFiltroVinculo}>
            <SelectTrigger className="mt-1 h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              <SelectItem value="CLT">CLT (DMN)</SelectItem>
              <SelectItem value="TERCEIRIZADO">Terceirizado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] font-black text-rose-200/70 uppercase">Status</Label>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="mt-1 h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_FILTROS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <Label className="text-[10px] font-black text-rose-200/70 uppercase">Buscar</Label>
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="nome ou matrícula" className="mt-1 h-8 text-xs" />
        </div>
        <div className="text-[11px] text-rose-200/70 font-bold">{empsFiltrados.length} funcionário(s) · {cursosVisiveis.length} curso(s)</div>
      </div>

      <div className="mb-3 glass-card glass-shine rounded-xl px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-2 border-rose-300/20 shadow-[0_0_34px_-12px_rgba(220,38,70,0.72)]">
        <div className="text-[10px] font-black uppercase text-rose-200/70">Legenda</div>
        {STATUS_LEGENDA.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5 text-[10px] font-bold text-rose-100/90">
            <span className={`h-3.5 w-3.5 rounded-sm border border-white/20 ${item.className}`} />
            <span className="uppercase">{item.label}</span>
            <span className="hidden md:inline text-rose-200/50 normal-case">({item.detalhe})</span>
          </div>
        ))}
      </div>

      <div className="glass-card glass-shine rounded-xl overflow-auto custom-scrollbar border-rose-300/20 shadow-[0_0_34px_-12px_rgba(220,38,70,0.72)]" style={{ maxHeight: "calc(100vh - 340px)" }}>
        <table className="text-[11px] border-collapse w-full table-fixed">
          <thead className="sticky top-0 bg-black/60 backdrop-blur-md z-10 text-rose-100">
            <tr>
              <th className="sticky left-0 bg-black/70 backdrop-blur-md z-20 text-left px-2 py-2 font-black uppercase border-b border-r border-white/10 text-[11px]" style={{ width: 60, minWidth: 60 }}>Mat.</th>
              <th className="sticky left-[60px] bg-black/70 backdrop-blur-md z-20 text-left px-2 py-2 font-black uppercase border-b border-r border-white/10 text-[11px]" style={{ width: 210, minWidth: 210 }}>Funcionário</th>
              <th className="sticky left-[270px] bg-black/70 backdrop-blur-md z-20 text-left px-2 py-2 font-black uppercase border-b border-r border-white/10 text-[11px]" style={{ width: 120, minWidth: 120 }}>Setor</th>
              {cursosVisiveis.map((c) => (
                <th key={c.id} className="text-center px-0.5 py-2 font-black uppercase border-b border-r border-white/10 align-bottom" style={{ width: "auto", minWidth: 44, height: 140 }} title={`${c.nome} (${c.periodicidade})`}>
                  <div className="flex flex-col items-center justify-end h-full">
                    <span style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }} className="text-[12px] whitespace-nowrap leading-tight tracking-wide">{c.codigo}</span>
                    <span className="text-[9px] text-rose-200/60 font-bold normal-case mt-1">{c.periodicidade.slice(0,3)}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {empsFiltrados.map((emp, i) => {
              const comp = emp.company_id ? compMap[emp.company_id] : null;
              return (
                <tr key={emp.id} className={i % 2 ? "bg-white/[0.03]" : "bg-transparent"}>
                  <td className="sticky left-0 z-10 bg-[#1a0810]/90 backdrop-blur-sm px-2 py-1.5 border-b border-r border-white/10 font-bold text-[11px] text-rose-100">{emp.matricula ?? "—"}</td>
                  <td className="sticky left-[60px] z-10 bg-[#1a0810]/90 backdrop-blur-sm px-2 py-1.5 border-b border-r border-white/10">
                    <div className="font-bold text-rose-50 text-[12px] leading-tight truncate max-w-[200px]">{emp.nome}</div>
                    <div className="text-[9px] text-rose-200/60 uppercase truncate max-w-[200px]">{comp?.name ?? "—"} · {comp?.type ?? "—"}</div>
                  </td>
                  <td className="sticky left-[270px] z-10 bg-[#1a0810]/90 backdrop-blur-sm px-2 py-1.5 border-b border-r border-white/10 text-[10px] uppercase font-bold text-rose-100/90">
                    {emp.setor ?? <span className="text-rose-400">—</span>}
                    {isEditor && (
                      <button onClick={() => setOpenEmp(emp)} className="ml-1 text-rose-300/60 hover:text-rose-200"><Pencil className="h-3 w-3 inline" /></button>
                    )}
                  </td>
                  {cursosVisiveis.map((c) => {
                    const required = requiredCourseIds(emp, roleCourses).has(c.id);
                    const entry = entryMap.get(`${emp.id}|${c.id}`);
                    const sched = scheduledMap.get(`${emp.id}|${c.id}`);
                    if (!required) {
                      return (
                        <td key={c.id} className="p-0 border-b border-r border-white/10 text-center bg-black/20" style={{ minWidth: 44 }}>
                          <button disabled={!isEditor} onClick={() => setEditing({ emp, course: c })}
                            className="w-full h-8 text-[10px] text-rose-200/30 hover:text-rose-200/70">—</button>
                        </td>
                      );
                    }
                    const baseSt = computeStatus(entry, c);
                    // Sobrescreve com "A INICIAR" quando há turma agendada ou data futura na matriz
                    const showAIniciar = Boolean(sched) || Boolean(entry?.data_realizacao && entry.data_realizacao >= hoje);
                    const st = showAIniciar
                      ? { label: "A INICIAR", color: "bg-violet-500/30 text-violet-100 border-violet-400/40" }
                      : baseSt;
                    // Aplica filtro de status à célula: se um filtro está ativo e esta célula não corresponde, oculta
                    if (filtroStatus !== "ALL") {
                      const wantedCell = STATUS_CELL_MAP[filtroStatus] ?? [];
                      if (!wantedCell.includes(st.label)) {
                        return (
                          <td key={c.id} className="p-0 border-b border-r border-white/10 text-center bg-black/20" style={{ minWidth: 44 }}>
                            <button disabled={!isEditor} onClick={() => setEditing({ emp, course: c, entry })}
                              className="w-full h-8 text-[10px] text-rose-200/30 hover:text-rose-200/70">—</button>
                          </td>
                        );
                      }
                    }
                    const dataLabel = entry?.data_realizacao
                      ? formatDateBR(entry.data_realizacao)
                      : (showAIniciar && sched ? formatDateBR(sched.data) : "");
                    return (
                      <td key={c.id} className="p-0 border-b border-r border-white/10 text-center align-middle" style={{ minWidth: 44 }}>
                        <button
                          disabled={!isEditor}
                          onClick={() => setEditing({ emp, course: c, entry })}
                          className={`w-full h-8 ${CELL_BG[st.label] ?? "bg-white/10"} text-white text-[9px] font-black leading-none`}
                          title={`${c.nome} — ${st.label}${dataLabel ? ` (${dataLabel})` : ""}${sched ? ` — Turma: ${sched.titulo}` : ""}${entry?.observacao ? ` — ${entry.observacao}` : ""}`}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {empsFiltrados.length === 0 && (
              <tr><td colSpan={cursosVisiveis.length + 3} className="text-center py-8 text-rose-200/50 text-xs uppercase font-bold">Nenhum funcionário.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <EntryDialog
          emp={editing.emp} course={editing.course} entry={editing.entry}
          onClose={() => setEditing(null)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["matriz-entries"] }); setEditing(null); }}
          isAdmin={isAdmin}
        />
      )}
      {openCatalog && <CatalogDialog onClose={() => setOpenCatalog(false)} courses={courses} isAdmin={isAdmin} />}
      {openSetores && <VinculosDialog onClose={() => setOpenSetores(false)} courses={courses} roleMapping={roleCourses} roles={roles} />}
      {openEmp !== null && <EmpDialog emp={openEmp === "new" ? null : openEmp} companies={companies} roles={roles} onClose={() => setOpenEmp(null)} isAdmin={isAdmin} />}
      {openBulk && <BulkEmpDialog companies={companies} employees={employees} onClose={() => setOpenBulk(false)} />}
    </div>
  );
}

function EntryDialog({ emp, course, entry, onClose, onSaved, isAdmin }:
  { emp: Employee; course: Course; entry?: Entry; onClose: () => void; onSaved: () => void; isAdmin: boolean }) {
  const [data, setData] = useState(entry?.data_realizacao ?? "");
  const [stOver, setStOver] = useState(entry?.status_override ?? "AUTO");
  const [obs, setObs] = useState(entry?.observacao ?? "");

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        employee_id: emp.id, course_id: course.id,
        data_realizacao: data || null,
        status_override: stOver === "AUTO" ? null : stOver,
        observacao: obs || null,
      };
      if (entry) {
        const { error } = await supabase.from("training_matrix_entries").update(payload).eq("id", entry.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("training_matrix_entries").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Salvo"); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async () => {
      if (!entry) return;
      const { error } = await supabase.from("training_matrix_entries").delete().eq("id", entry.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removido"); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{course.nome}</DialogTitle></DialogHeader>
        <div className="text-xs text-slate-500 -mt-2 mb-2">{emp.nome} · {emp.matricula ?? "—"} · {course.periodicidade}</div>
        <div className="space-y-3">
          <div>
            <Label className="text-[10px] font-black uppercase">Data de realização</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-[10px] font-black uppercase">Status (sobrescrever)</Label>
            <Select value={stOver} onValueChange={setStOver}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="AUTO">Automático (com base na data + periodicidade)</SelectItem>
                {STATUS_OVERRIDE.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] font-black uppercase">Observação</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} className="mt-1" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          {entry && isAdmin && (
            <Button variant="destructive" size="sm" onClick={() => { if (confirm("Remover lançamento?")) del.mutate(); }}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Remover
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
            <Save className="h-3.5 w-3.5 mr-1" /> Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CatalogDialog({ onClose, courses, isAdmin }:
  { onClose: () => void; courses: Course[]; isAdmin: boolean }) {
  const qc = useQueryClient();
  const [novo, setNovo] = useState({ codigo: "", nome: "", periodicidade: "ANUAL", ordem: 999, categoria: "CURSO", carga_horaria_h: 0 });

  const add = useMutation({
    mutationFn: async () => {
      if (!novo.codigo || !novo.nome) throw new Error("Código e nome obrigatórios");
      const { error } = await supabase.from("training_matrix_courses").insert({
        codigo: novo.codigo, nome: novo.nome, periodicidade: novo.periodicidade,
        ordem: novo.ordem, categoria: novo.categoria,
        carga_horaria_h: novo.carga_horaria_h || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Curso criado"); setNovo({ codigo: "", nome: "", periodicidade: "ANUAL", ordem: 999, categoria: "CURSO", carga_horaria_h: 0 }); qc.invalidateQueries({ queryKey: ["matriz-courses"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const upd = useMutation({
    mutationFn: async (c: Course) => {
      const { error } = await supabase.from("training_matrix_courses")
        .update({
          codigo: c.codigo, nome: c.nome, periodicidade: c.periodicidade,
          ordem: c.ordem, ativo: c.ativo,
          categoria: c.categoria ?? "NR",
          carga_horaria_h: c.carga_horaria_h ?? null,
        })
        .eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Atualizado"); qc.invalidateQueries({ queryKey: ["matriz-courses"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("training_matrix_courses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removido"); qc.invalidateQueries({ queryKey: ["matriz-courses"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Cursos / NRs do catálogo</DialogTitle></DialogHeader>
        <div className="border border-slate-200 rounded p-3 bg-slate-50 space-y-2">
          <div className="grid grid-cols-12 gap-2">
            <Input placeholder="Código" value={novo.codigo} onChange={(e) => setNovo({ ...novo, codigo: e.target.value })} className="col-span-3 h-8 text-xs" />
            <Input placeholder="Nome" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} className="col-span-9 h-8 text-xs" />
          </div>
          <div className="grid grid-cols-12 gap-2">
            <Select value={novo.categoria} onValueChange={(v) => setNovo({ ...novo, categoria: v })}>
              <SelectTrigger className="col-span-3 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{CATEGORIA_LABEL[c]}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={novo.periodicidade} onValueChange={(v) => setNovo({ ...novo, periodicidade: v })}>
              <SelectTrigger className="col-span-3 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{PERIODICIDADES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="number" placeholder="CH (h)" value={novo.carga_horaria_h || ""} onChange={(e) => setNovo({ ...novo, carga_horaria_h: Number(e.target.value) })} className="col-span-2 h-8 text-xs" />
            <Input type="number" placeholder="Ordem" value={novo.ordem} onChange={(e) => setNovo({ ...novo, ordem: Number(e.target.value) })} className="col-span-2 h-8 text-xs" />
            <Button size="sm" onClick={() => add.mutate()} className="col-span-2"><Plus className="h-3.5 w-3.5 mr-1" />Add</Button>
          </div>
        </div>
        <table className="text-xs w-full mt-3">
          <thead className="bg-slate-100">
            <tr>
              <th className="text-left p-2">Código</th>
              <th className="text-left p-2">Nome</th>
              <th className="p-2">Categoria</th>
              <th className="p-2">Periodic.</th>
              <th className="p-2">CH</th>
              <th className="p-2">Ordem</th>
              <th className="p-2">Ativo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {courses.map((c) => (
              <CourseRow key={c.id} c={c} onSave={(x) => upd.mutate(x)} onDel={(id) => { if (confirm("Excluir curso?")) del.mutate(id); }} canDelete={isAdmin} />
            ))}
          </tbody>
        </table>
        <DialogFooter><Button variant="outline" onClick={onClose}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CourseRow({ c, onSave, onDel, canDelete }: { c: Course; onSave: (c: Course) => void; onDel: (id: string) => void; canDelete: boolean }) {
  const [v, setV] = useState(c);
  const dirty = JSON.stringify(v) !== JSON.stringify(c);
  return (
    <tr className="border-b">
      <td className="p-1"><Input value={v.codigo} onChange={(e) => setV({ ...v, codigo: e.target.value })} className="h-7 text-xs" /></td>
      <td className="p-1"><Input value={v.nome} onChange={(e) => setV({ ...v, nome: e.target.value })} className="h-7 text-xs" /></td>
      <td className="p-1">
        <Select value={v.categoria ?? "NR"} onValueChange={(x) => setV({ ...v, categoria: x })}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{CATEGORIAS.map((cc) => <SelectItem key={cc} value={cc}>{CATEGORIA_LABEL[cc]}</SelectItem>)}</SelectContent>
        </Select>
      </td>
      <td className="p-1">
        <Select value={v.periodicidade} onValueChange={(x) => setV({ ...v, periodicidade: x })}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{PERIODICIDADES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
        </Select>
      </td>
      <td className="p-1 w-16"><Input type="number" value={v.carga_horaria_h ?? 0} onChange={(e) => setV({ ...v, carga_horaria_h: Number(e.target.value) })} className="h-7 text-xs" /></td>
      <td className="p-1 w-20"><Input type="number" value={v.ordem} onChange={(e) => setV({ ...v, ordem: Number(e.target.value) })} className="h-7 text-xs" /></td>
      <td className="p-1 text-center"><input type="checkbox" checked={v.ativo} onChange={(e) => setV({ ...v, ativo: e.target.checked })} /></td>
      <td className="p-1 flex gap-1">
        {dirty && <button onClick={() => onSave(v)} className="text-emerald-600 hover:text-emerald-800"><Save className="h-3.5 w-3.5" /></button>}
        {canDelete && <button onClick={() => onDel(c.id)} className="text-red-600 hover:text-red-800"><Trash2 className="h-3.5 w-3.5" /></button>}
      </td>
    </tr>
  );
}

function VinculosDialog({ onClose, courses, roleMapping, roles }:
  { onClose: () => void; courses: Course[]; roleMapping: RoleCourse[]; roles: Role[] }) {
  const qc = useQueryClient();
  const hasRole = (roleId: string, courseId: string) => roleMapping.some((m) => m.role_id === roleId && m.course_id === courseId);

  const toggleRole = useMutation({
    mutationFn: async ({ roleId, courseId, on }: { roleId: string; courseId: string; on: boolean }) => {
      if (on) {
        const { error } = await supabase.from("training_matrix_role_courses").insert({ role_id: roleId, course_id: courseId });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("training_matrix_role_courses").delete().eq("role_id", roleId).eq("course_id", courseId);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["matriz-role-courses"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const [openId, setOpenId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  const cursosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter((c) => c.codigo.toLowerCase().includes(q) || c.nome.toLowerCase().includes(q));
  }, [busca, courses]);

  const TopBar = (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="relative flex-1 min-w-[180px]">
        <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar curso..." className="h-8 text-xs pl-7" />
      </div>
      <Button size="sm" onClick={onClose} className="h-8"><Save className="h-3.5 w-3.5 mr-1" /> Salvar e fechar</Button>
    </div>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="p-4 pb-2 border-b">
          <DialogTitle className="text-base">Vincular Cursos por Função</DialogTitle>
          <p className="text-[11px] text-slate-500 mt-1">Conforme NR-01, os treinamentos são definidos por função. As alterações são salvas automaticamente.</p>
        </DialogHeader>

        <div className="px-4 py-2 border-b bg-slate-50/50 sticky top-0 z-10">{TopBar}</div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cursosFiltrados.length === 0 && (
            <div className="text-center text-slate-400 text-xs py-8 uppercase font-bold">Nenhum curso encontrado</div>
          )}
          {cursosFiltrados.map((c) => {
            const open = openId === c.id;
            const nRoles = roles.filter((r) => hasRole(r.id, c.id)).length;
            return (
              <div key={c.id} className="border rounded-md bg-white">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : c.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50"
                >
                  <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? "" : "-rotate-90"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold truncate">{c.codigo} — <span className="font-normal text-slate-700">{c.nome}</span></div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-violet-50 text-violet-700">{nRoles} função{nRoles === 1 ? "" : "ões"}</span>
                  </div>
                </button>
                {open && (
                  <div className="border-t p-3 bg-slate-50/40">
                    {roles.length === 0 ? (
                          <div className="text-center text-slate-400 text-xs py-6 uppercase font-bold">Cadastre funções em Cargos / Funções primeiro.</div>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-64 overflow-y-auto pr-1">
                            {roles.map((r) => {
                              const checked = hasRole(r.id, c.id);
                              return (
                                <label key={r.id} className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded border cursor-pointer transition ${checked ? "bg-violet-50 border-violet-300" : "bg-white border-slate-200 hover:bg-slate-50"}`}>
                                  <input type="checkbox" checked={checked} onChange={(e) => toggleRole.mutate({ roleId: r.id, courseId: c.id, on: e.target.checked })} />
                                  <span className="truncate" title={r.name}>{r.name}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter className="p-3 border-t bg-slate-50/50 gap-2">
          <Button variant="outline" size="sm" onClick={onClose}><X className="h-3.5 w-3.5 mr-1" /> Fechar</Button>
          <Button size="sm" onClick={onClose}><Save className="h-3.5 w-3.5 mr-1" /> Salvar e fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmpDialog({ emp, companies, roles, onClose, isAdmin }:
  { emp: Employee | null; companies: Company[]; roles: Role[]; onClose: () => void; isAdmin: boolean }) {
  const qc = useQueryClient();
  const [v, setV] = useState({
    matricula: emp?.matricula ?? "", nome: emp?.nome ?? "",
    setor: emp?.setor ?? "PRODUCAO", company_id: emp?.company_id ?? (companies[0]?.id ?? ""),
    role_id: emp?.role_id ?? "",
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!v.nome) throw new Error("Nome obrigatório");
      const payload = { matricula: v.matricula || null, nome: v.nome, setor: v.setor, company_id: v.company_id || null, role_id: v.role_id || null };
      if (emp) {
        const { error } = await supabase.from("employees").update(payload).eq("id", emp.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("employees").insert({ ...payload, status: "ATIVO", tipo_cadastro: "NAO_MEI" });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Salvo"); qc.invalidateQueries({ queryKey: ["matriz-employees"] }); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async () => {
      if (!emp) return;
      const { error } = await supabase.from("employees").delete().eq("id", emp.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Excluído"); qc.invalidateQueries({ queryKey: ["matriz-employees"] }); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{emp ? "Editar funcionário" : "Novo funcionário"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1">
              <Label className="text-[10px] uppercase font-black">Matrícula</Label>
              <Input value={v.matricula} onChange={(e) => setV({ ...v, matricula: e.target.value })} className="mt-1" />
            </div>
            <div className="col-span-2">
              <Label className="text-[10px] uppercase font-black">Nome</Label>
              <Input value={v.nome} onChange={(e) => setV({ ...v, nome: e.target.value })} className="mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-[10px] uppercase font-black">Setor</Label>
            <Select value={v.setor} onValueChange={(x) => setV({ ...v, setor: x })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{SETORES_PADRAO.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] uppercase font-black">Empresa</Label>
            <Select value={v.company_id} onValueChange={(x) => setV({ ...v, company_id: x })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} ({c.type})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] uppercase font-black">Função</Label>
            <Select value={v.role_id || "NONE"} onValueChange={(x) => setV({ ...v, role_id: x === "NONE" ? "" : x })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">— sem função —</SelectItem>
                {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="gap-2">
          {emp && isAdmin && (
            <Button variant="destructive" size="sm" onClick={() => { if (confirm("Excluir funcionário? Os lançamentos serão removidos.")) del.mutate(); }}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}><Save className="h-3.5 w-3.5 mr-1" /> Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkEmpDialog({ companies, employees, onClose }:
  { companies: Company[]; employees: Employee[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [setor, setSetor] = useState("PRODUCAO");
  const [texto, setTexto] = useState("");

  const existentes = useMemo(
    () => employees.filter((e) => e.company_id === companyId)
      .sort((a, b) => a.nome.localeCompare(b.nome)),
    [employees, companyId],
  );

  const submit = useMutation({
    mutationFn: async () => {
      const linhas = texto.split("\n").map((l) => l.trim()).filter(Boolean);
      if (!linhas.length) throw new Error("Cole pelo menos uma linha");
      if (!companyId) throw new Error("Selecione a empresa");

      // chaves já existentes (matrícula+empresa) e (nome+empresa) para evitar duplicar
      const matsExist = new Set(existentes.map((e) => (e.matricula ?? "").trim()).filter(Boolean));
      const nomesExist = new Set(existentes.map((e) => e.nome.trim().toUpperCase()));

      const novos: any[] = [];
      const ignorados: string[] = [];
      for (const l of linhas) {
        // aceita "matricula;nome" ou "matricula\tnome" ou só "nome"
        const partes = l.split(/[\t;|,]/).map((p) => p.trim()).filter(Boolean);
        let matricula = ""; let nome = "";
        if (partes.length >= 2) { matricula = partes[0]; nome = partes.slice(1).join(" "); }
        else { nome = partes[0] ?? ""; }
        if (!nome) continue;
        if (matricula && matsExist.has(matricula)) { ignorados.push(`${matricula} ${nome}`); continue; }
        if (nomesExist.has(nome.toUpperCase())) { ignorados.push(nome); continue; }
        novos.push({
          matricula: matricula || null, nome, setor, company_id: companyId,
          status: "ATIVO", tipo_cadastro: "NAO_MEI",
        });
      }
      if (!novos.length) throw new Error("Nenhum novo funcionário para inserir");
      const { error } = await supabase.from("employees").insert(novos);
      if (error) throw error;
      return { criados: novos.length, ignorados };
    },
    onSuccess: (r) => {
      toast.success(`${r.criados} criado(s)${r.ignorados.length ? ` · ${r.ignorados.length} ignorado(s)` : ""}`);
      qc.invalidateQueries({ queryKey: ["matriz-employees"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Inserir funcionários em massa</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] uppercase font-black">Empresa</Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} ({c.type})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] uppercase font-black">Setor padrão</Label>
              <Select value={setor} onValueChange={setSetor}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{SETORES_PADRAO.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-[10px] uppercase font-black">
              Já cadastrados nesta empresa ({existentes.length})
            </Label>
            <div className="mt-1 border border-slate-200 rounded p-2 max-h-40 overflow-y-auto bg-slate-50 text-[11px]">
              {existentes.length === 0 && <div className="text-slate-400 italic">Nenhum cadastro nesta empresa ainda.</div>}
              {existentes.map((e) => (
                <div key={e.id} className="flex justify-between border-b border-slate-100 py-0.5">
                  <span className="font-bold">{e.matricula ?? "—"}</span>
                  <span className="flex-1 px-2">{e.nome}</span>
                  <span className="text-slate-500 uppercase">{e.setor ?? "—"}</span>
                </div>
              ))}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">Use a lista acima para evitar duplicar matrículas/nomes — eles serão ignorados automaticamente.</div>
          </div>

          <div>
            <Label className="text-[10px] uppercase font-black">Cole as linhas (1 por funcionário)</Label>
            <Textarea
              rows={10}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={"matricula;NOME COMPLETO\n000999;FULANO DE TAL\n000998;CICLANO\n— ou só o nome:\nBELTRANO DA SILVA"}
              className="mt-1 font-mono text-xs"
            />
            <div className="text-[10px] text-slate-500 mt-1">Separadores aceitos: <code>;</code> <code>|</code> <code>,</code> ou tabulação. Matrícula é opcional.</div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
            <Save className="h-3.5 w-3.5 mr-1" /> Inserir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}