import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, ChevronRight, Users, UserCheck, UserX, UserMinus, Building2, Briefcase, CalendarClock, FileText, UserRoundX, Stethoscope, AlertTriangle, X } from "lucide-react";
import { EmployeeListagemDialog } from "@/components/employees/employee-listagem-dialog";
import { NewEmployeeDialog } from "@/components/employees/new-employee-dialog";
import { ConvocacaoExamesDialog } from "@/components/employees/convocacao-exames-dialog";
import { daysUntil, addYearsToDate } from "@/lib/utils-date";

export const Route = createFileRoute("/app/employees/")({
  component: EmployeesPage,
  validateSearch: (search: Record<string, unknown>) => ({
    new: search.new === 1 || search.new === "1" ? 1 : undefined,
    company: typeof search.company === "string" ? search.company : undefined,
    filter: typeof search.filter === "string" ? search.filter : undefined,
  }),
});

type ComplianceFilter = "TODOS" | "aso_vencido" | "aso_vencendo" | "sem_docs";

function EmployeesPage() {
  const { isEditor } = useAuth();
  const navigate = useNavigate();
  const { new: openNew, company: openCompany, filter: filterSearch } = Route.useSearch();
  const [open, setOpen] = useState(false);
  const [newEmployeeCompanyId, setNewEmployeeCompanyId] = useState<string | undefined>();
  useEffect(() => {
    if (openNew && isEditor) {
      setNewEmployeeCompanyId(openCompany);
      setOpen(true);
      if (openCompany) {
        setCompanyFilter(openCompany);
      }
      navigate({ to: "/app/employees", search: {}, replace: true });
    }
  }, [openNew, openCompany, isEditor, navigate]);
  const FILTERS_KEY = "employees:filters";
  const initialFilters = (() => {
    if (typeof window === "undefined") return null;
    try { return JSON.parse(sessionStorage.getItem(FILTERS_KEY) || "null"); } catch { return null; }
  })();
  const [q, setQ] = useState<string>(initialFilters?.q ?? "");
  const [statusFilter, setStatusFilter] = useState<"TODOS" | "ATIVO" | "INATIVO" | "AFASTADO" | "DESLIGADO">(initialFilters?.statusFilter ?? "ATIVO");
  const [companyFilter, setCompanyFilter] = useState<string>(initialFilters?.companyFilter ?? "TODAS");
  const [roleFilter, setRoleFilter] = useState<string>(initialFilters?.roleFilter ?? "TODOS");
  const [vinculoFilter, setVinculoFilter] = useState<"TODOS" | "PROPRIO" | "TERCEIRO" | "MEI">(initialFilters?.vinculoFilter ?? "TODOS");
  const [complianceFilter, setComplianceFilter] = useState<ComplianceFilter>("TODOS");
  // Deep-link vindo do painel Hoje
  useEffect(() => {
    if (filterSearch === "aso_vencido" || filterSearch === "aso_vencendo" || filterSearch === "sem_docs") {
      setComplianceFilter(filterSearch as ComplianceFilter);
      setStatusFilter("ATIVO");
      navigate({ to: "/app/employees", search: {}, replace: true });
    }
  }, [filterSearch, navigate]);
  const [visibleCount, setVisibleCount] = useState<number>(initialFilters?.visibleCount ?? 48);
  useEffect(() => {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(FILTERS_KEY, JSON.stringify({ q, statusFilter, companyFilter, roleFilter, vinculoFilter, visibleCount }));
  }, [q, statusFilter, companyFilter, roleFilter, vinculoFilter, visibleCount]);
  const [listagemOpen, setListagemOpen] = useState(false);
  const [convocacaoOpen, setConvocacaoOpen] = useState(false);

  const { data: emps, isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });
  const { data: companies } = useQuery({
    queryKey: ["companies-with-type"],
    queryFn: async () => (await supabase.from("companies").select("id,name,type").order("name")).data ?? [],
  });
  const { data: roles } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => (await supabase.from("roles").select("id,name").order("name")).data ?? [],
  });

  // Status de conformidade ASO por funcionário (latest exam ASO Clínico OU legado data_aso + 1 ano)
  const { data: asoMap } = useQuery({
    queryKey: ["employees-aso-vencimentos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("employee_exams")
        .select("employee_id, tipo_exame, data_vencimento")
        .eq("tipo_exame", "ASO Clínico")
        .order("data_vencimento", { ascending: false });
      const m = new Map<string, string>();
      (data ?? []).forEach((r: any) => {
        if (r.data_vencimento && !m.has(r.employee_id)) m.set(r.employee_id, r.data_vencimento);
      });
      return m;
    },
  });

  // Map: employee_id → status ASO ("vencido" | "vencendo" | "ok" | "sem")
  type AsoStatus = "vencido" | "vencendo" | "ok" | "sem";
  const asoStatusOf = (emp: any): { status: AsoStatus; dias: number | null; venc: string | null } => {
    const venc = asoMap?.get(emp.id) ?? (emp.data_aso ? addYearsToDate(emp.data_aso, 1) : null);
    if (!venc) return { status: "sem", dias: null, venc: null };
    const d = daysUntil(venc);
    if (d === null) return { status: "sem", dias: null, venc };
    if (d < 0) return { status: "vencido", dias: d, venc };
    if (d <= 30) return { status: "vencendo", dias: d, venc };
    return { status: "ok", dias: d, venc };
  };

  // Contadores para os chips
  const complianceCounts = useMemo(() => {
    const list = (emps ?? []).filter((e: any) => e.status === "ATIVO");
    let vencido = 0, vencendo = 0, sem = 0;
    list.forEach((e: any) => {
      const s = asoStatusOf(e).status;
      if (s === "vencido") vencido++;
      else if (s === "vencendo") vencendo++;
      else if (s === "sem") sem++;
    });
    return { vencido, vencendo, sem };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emps, asoMap]);

  const filtered = useMemo(() => {
    const norm = (v: string) =>
      (v ?? "")
        .toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    const s = norm(q.trim());
    const sDigits = q.replace(/\D/g, "");
    return (emps ?? []).filter((e: any) => {
      if (statusFilter !== "TODOS" && e.status !== statusFilter) return false;
      if (companyFilter !== "TODAS" && e.company_id !== companyFilter) return false;
      if (roleFilter !== "TODOS" && e.role_id !== roleFilter) return false;
      if (vinculoFilter === "PROPRIO" && e.tipo_vinculo !== "PROPRIO") return false;
      if (vinculoFilter === "TERCEIRO" && e.tipo_vinculo !== "TERCEIRO") return false;
      if (vinculoFilter === "MEI" && e.tipo_cadastro !== "MEI") return false;
      if (complianceFilter !== "TODOS") {
        const s2 = asoStatusOf(e).status;
        if (complianceFilter === "aso_vencido" && s2 !== "vencido") return false;
        if (complianceFilter === "aso_vencendo" && s2 !== "vencendo") return false;
        if (complianceFilter === "sem_docs" && s2 !== "sem") return false;
      }
      if (!s) return true;
      const cpfDigits = (e.cpf ?? "").replace(/\D/g, "");
      return (
        norm(e.nome ?? "").includes(s) ||
        norm(e.matricula ?? "").includes(s) ||
        norm(e.cpf ?? "").includes(s) ||
        (sDigits.length >= 3 && cpfDigits.includes(sDigits))
      );
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emps, q, statusFilter, companyFilter, roleFilter, vinculoFilter, complianceFilter, asoMap]);

  const cMap = new Map((companies ?? []).map((c: any) => [c.id, c.name]));
  const cTypeMap = new Map((companies ?? []).map((c: any) => [c.id, c.type]));
  const rMap = new Map((roles ?? []).map((r: any) => [r.id, r.name]));

  const stats = useMemo(() => {
    const list = emps ?? [];
    return {
      total: list.length,
      ativos: list.filter((e: any) => e.status === "ATIVO").length,
      inativos: list.filter((e: any) => e.status === "INATIVO").length,
      afastados: list.filter((e: any) => e.status === "AFASTADO").length,
      desligados: list.filter((e: any) => e.status === "DESLIGADO").length,
    };
  }, [emps]);

  return (
    <div className="p-6 md:p-8 animate-fadeIn">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="heading-display text-3xl md:text-4xl leading-none text-white drop-shadow-[0_2px_12px_rgba(200,16,46,0.45)]">Funcionários</h2>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-200/80 mt-2">
            Cadastro de funcionários
          </p>
        </div>
        {isEditor && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center rounded-2xl border border-white/15 bg-gradient-to-r from-[#3a0712]/80 via-[#5c0a1c]/70 to-[#3a0712]/80 p-1.5 shadow-[0_10px_30px_-10px_rgba(200,16,46,0.55)] backdrop-blur-md">
              <button
                type="button"
                onClick={() => setListagemOpen(true)}
                className="nav-pill group inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[11px] font-black uppercase tracking-widest text-white/95 hover:text-white"
              >
                <FileText className="h-4 w-4 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3" />
                <span>Listagem</span>
              </button>
              <span className="h-6 w-px bg-white/15" />
              <button
                type="button"
                onClick={() => setConvocacaoOpen(true)}
                className="nav-pill group inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[11px] font-black uppercase tracking-widest text-white/95 hover:text-white"
              >
                <Stethoscope className="h-4 w-4 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3" />
                <span>Convocar exames</span>
              </button>
              <span className="h-6 w-px bg-white/15" />
              <Link
                to="/app/employees/saidas"
                className="nav-pill group inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[11px] font-black uppercase tracking-widest text-white/95 hover:text-white"
              >
                <CalendarClock className="h-4 w-4 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3" />
                <span>Saídas</span>
              </Link>
              <span className="h-6 w-px bg-white/15" />
              <Link
                to="/app/employees/hora-extra-sabado"
                className="nav-pill group inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[11px] font-black uppercase tracking-widest text-white/95 hover:text-white"
              >
                <CalendarClock className="h-4 w-4 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3" />
                <span>Hora extra</span>
              </Link>
              <span className="h-6 w-px bg-white/15" />
              <Link
                to="/app/employees/desligados"
                className="nav-pill group inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[11px] font-black uppercase tracking-widest text-white/95 hover:text-white"
              >
                <UserRoundX className="h-4 w-4 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3" />
                <span>Desligados</span>
              </Link>
            </div>
            <Button
              type="button"
              onClick={() => {
                setNewEmployeeCompanyId(undefined);
                setOpen(true);
              }}
              className="nav-pill bg-[#0f172a] hover:bg-brand text-white text-[11px] font-black uppercase tracking-widest rounded-2xl px-5 py-3 h-auto shadow-lg border border-white/10"
            >
              <Plus className="h-4 w-4 mr-1.5" />Novo funcionário
            </Button>
            <NewEmployeeDialog
              open={open}
              onOpenChange={(value) => {
                setOpen(value);
                if (!value) setNewEmployeeCompanyId(undefined);
              }}
              defaultCompanyId={newEmployeeCompanyId}
            />
          </div>
        )}
      </div>

      {/* KPIs (clicáveis = filtro de status) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <KpiCard icon={UserCheck} label="Ativos" value={stats.ativos} tone="emerald"
          active={statusFilter === "ATIVO"} onClick={() => setStatusFilter("ATIVO")} />
        <KpiCard icon={UserMinus} label="Afastados" value={stats.afastados} tone="amber"
          active={statusFilter === "AFASTADO"} onClick={() => setStatusFilter("AFASTADO")} />
        <KpiCard icon={UserX} label="Inativos" value={stats.inativos} tone="rose"
          active={statusFilter === "INATIVO"} onClick={() => setStatusFilter("INATIVO")} />
        <KpiCard icon={UserRoundX} label="Desligados" value={stats.desligados} tone="rose"
          active={statusFilter === "DESLIGADO"} onClick={() => setStatusFilter("DESLIGADO")} />
      </div>

      {/* Chips de conformidade — semáforo NR-07/NR-01 */}
      {(complianceCounts.vencido + complianceCounts.vencendo + complianceCounts.sem > 0 || complianceFilter !== "TODOS") && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-rose-200/80 mr-1">
            <AlertTriangle className="h-3 w-3 inline mr-1" />
            Conformidade ASO:
          </span>
          <ComplianceChip
            label="ASO vencido"
            count={complianceCounts.vencido}
            tone="rose"
            pulse
            active={complianceFilter === "aso_vencido"}
            onClick={() => setComplianceFilter(complianceFilter === "aso_vencido" ? "TODOS" : "aso_vencido")}
          />
          <ComplianceChip
            label="ASO ≤ 30d"
            count={complianceCounts.vencendo}
            tone="amber"
            active={complianceFilter === "aso_vencendo"}
            onClick={() => setComplianceFilter(complianceFilter === "aso_vencendo" ? "TODOS" : "aso_vencendo")}
          />
          <ComplianceChip
            label="Sem ASO"
            count={complianceCounts.sem}
            tone="slate"
            active={complianceFilter === "sem_docs"}
            onClick={() => setComplianceFilter(complianceFilter === "sem_docs" ? "TODOS" : "sem_docs")}
          />
          {complianceFilter !== "TODOS" && (
            <button
              type="button"
              onClick={() => setComplianceFilter("TODOS")}
              className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-rose-200/70 hover:text-white px-2 py-1"
            >
              <X className="h-3 w-3" /> Limpar
            </button>
          )}
        </div>
      )}

      {/* Busca + filtros */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-4">
        <div className="relative md:col-span-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            className="pl-11 h-12 rounded-2xl border-slate-200 bg-white shadow-sm text-sm"
            placeholder="Buscar por nome, CPF, matrícula…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="md:col-span-3 relative">
          <Select value={companyFilter} onValueChange={setCompanyFilter}>
            <SelectTrigger className="h-12 rounded-2xl bg-white pr-20"><SelectValue placeholder="Empresa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TODAS">Todas as empresas</SelectItem>
              {(companies ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="pointer-events-none absolute right-10 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 rounded-full bg-[#991b1b] text-white text-[11px] font-black px-2.5 py-1 shadow-sm">
            {filtered.length}
            <span className="font-bold opacity-80 normal-case">func.</span>
          </span>
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="md:col-span-2 h-12 rounded-2xl bg-white"><SelectValue placeholder="Cargo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos os cargos</SelectItem>
            {(roles ?? []).map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={vinculoFilter} onValueChange={(v: any) => setVinculoFilter(v)}>
          <SelectTrigger className="md:col-span-1 h-12 rounded-2xl bg-white"><SelectValue placeholder="Vínculo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos os vínculos</SelectItem>
            <SelectItem value="PROPRIO">Próprios (DMN)</SelectItem>
            <SelectItem value="TERCEIRO">Terceiros</SelectItem>
            <SelectItem value="MEI">Apenas MEI</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid de cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-36 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        (() => {
          // Quando a busca não retorna nada, conta quantos seriam encontrados
          // se IGNORÁSSEMOS os filtros de empresa/cargo/vínculo/status.
          // Evita o sintoma "o funcionário sumiu" — na verdade está só fora do filtro.
          const norm = (v: string) =>
            (v ?? "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
          const s = norm(q.trim());
          const sDigits = q.replace(/\D/g, "");
          const semFiltros = (emps ?? []).filter((e: any) => {
            if (!s) return false;
            const cpfDigits = (e.cpf ?? "").replace(/\D/g, "");
            return (
              norm(e.nome ?? "").includes(s) ||
              norm(e.matricula ?? "").includes(s) ||
              norm(e.cpf ?? "").includes(s) ||
              (sDigits.length >= 3 && cpfDigits.includes(sDigits))
            );
          });
          const filtrosAtivos =
            statusFilter !== "TODOS" ||
            companyFilter !== "TODAS" ||
            roleFilter !== "TODOS" ||
            vinculoFilter !== "TODOS";
          return (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold uppercase tracking-widest text-slate-500">Nenhum funcionário encontrado</p>
              <p className="text-xs text-slate-400 mt-1">Ajuste a busca ou os filtros.</p>
              {semFiltros.length > 0 && filtrosAtivos && (
                <div className="mt-5 inline-flex flex-col items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 max-w-md">
                  <p className="text-xs font-bold text-amber-800">
                    Encontrei <span className="font-black">{semFiltros.length}</span> resultado(s) ignorando os filtros ativos.
                  </p>
                  <p className="text-[11px] text-amber-700">
                    Filtros podem estar escondendo: {[
                      statusFilter !== "TODOS" && `status=${statusFilter}`,
                      companyFilter !== "TODAS" && `empresa selecionada`,
                      roleFilter !== "TODOS" && `cargo selecionado`,
                      vinculoFilter !== "TODOS" && `vínculo=${vinculoFilter}`,
                    ].filter(Boolean).join(" · ")}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-[11px] font-black uppercase tracking-widest"
                    onClick={() => {
                      setStatusFilter("TODOS");
                      setCompanyFilter("TODAS");
                      setRoleFilter("TODOS");
                      setVinculoFilter("TODOS");
                    }}
                  >
                    Limpar filtros e mostrar tudo
                  </Button>
                </div>
              )}
            </div>
          );
        })()
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.slice(0, visibleCount).map((e: any) => (
              <EmployeeCard
                key={e.id}
                emp={e}
                company={cMap.get(e.company_id) ?? undefined}
                companyType={cTypeMap.get(e.company_id) ?? undefined}
                role={rMap.get(e.role_id) ?? undefined}
                asoStatus={asoStatusOf(e)}
              />
            ))}
          </div>
          {filtered.length > visibleCount && (
            <div className="mt-6 flex justify-center">
              <Button variant="outline" onClick={() => setVisibleCount((c) => c + 48)} className="rounded-full px-6">
                Carregar mais ({filtered.length - visibleCount} restantes)
              </Button>
            </div>
          )}
          <p className="mt-4 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Mostrando {Math.min(visibleCount, filtered.length)} de {filtered.length}
          </p>
        </>
      )}
      <EmployeeListagemDialog
        open={listagemOpen}
        onClose={() => setListagemOpen(false)}
        emps={emps ?? []}
        companies={companies ?? []}
        roles={roles ?? []}
      />
      <ConvocacaoExamesDialog open={convocacaoOpen} onOpenChange={setConvocacaoOpen} />
    </div>
  );
}

// ============ Sub-componentes ============

const TONES = {
  slate:   { accent: "accent-wine",    text: "text-[rgba(245,225,225,0.78)]", icon: "bg-[rgba(60,18,28,0.85)] text-[#fff5f6] ring-1 ring-white/10" },
  emerald: { accent: "accent-emerald", text: "text-emerald-300",              icon: "bg-[rgba(20,60,40,0.7)] text-emerald-300 ring-1 ring-emerald-400/20" },
  amber:   { accent: "accent-amber",   text: "text-amber-300",                icon: "bg-[rgba(70,40,12,0.7)] text-amber-300 ring-1 ring-amber-400/20" },
  rose:    { accent: "accent-rose",    text: "text-rose-300",                 icon: "bg-[rgba(80,18,32,0.75)] text-rose-300 ring-1 ring-rose-400/25" },
} as const;

function KpiCard({ icon: Icon, label, value, tone, active, onClick }: { icon: any; label: string; value: number; tone: keyof typeof TONES; active?: boolean; onClick?: () => void }) {
  const t = TONES[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`prism-kpi ${t.accent} text-left p-4 flex items-center gap-3 hover:-translate-y-0.5 transition-all ${active ? "ring-1 ring-rose-400/40" : ""}`}
    >
      <div className={`relative z-10 h-11 w-11 rounded-xl ${t.icon} flex items-center justify-center`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="relative z-10">
        <p className={`text-[10px] font-black uppercase tracking-widest ${t.text}`}>{label}</p>
        <p className="text-2xl font-black text-[#fff5f6] leading-none mt-1">{value}</p>
      </div>
    </button>
  );
}

function ComplianceChip({
  label, count, tone, active, pulse, onClick,
}: {
  label: string; count: number; tone: "rose" | "amber" | "slate"; active?: boolean; pulse?: boolean; onClick: () => void;
}) {
  const palette = tone === "rose"
    ? { base: "bg-rose-500/15 text-rose-100 ring-rose-400/30", on: "bg-rose-500/35 ring-rose-300/60", dot: "bg-rose-400" }
    : tone === "amber"
    ? { base: "bg-amber-500/15 text-amber-100 ring-amber-400/30", on: "bg-amber-500/35 ring-amber-300/60", dot: "bg-amber-400" }
    : { base: "bg-slate-500/15 text-slate-100 ring-slate-400/30", on: "bg-slate-500/35 ring-slate-300/60", dot: "bg-slate-300" };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ring-1 text-[10px] font-black uppercase tracking-widest transition ${active ? palette.on : palette.base} hover:scale-[1.02]`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${palette.dot} ${pulse && count > 0 ? "animate-pulse" : ""}`} />
      {label}
      <span className="ml-1 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-black/30 text-white tabular-nums">
        {count}
      </span>
    </button>
  );
}

function avatarGradient(name: string) {
  const palettes = [
    "from-rose-500 to-pink-600",
    "from-amber-500 to-orange-600",
    "from-emerald-500 to-teal-600",
    "from-sky-500 to-indigo-600",
    "from-violet-500 to-fuchsia-600",
    "from-cyan-500 to-blue-600",
    "from-lime-500 to-emerald-600",
    "from-red-500 to-rose-700",
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return palettes[h % palettes.length];
}

function avatarAccent(name: string) {
  const accents = [
    "#f43f5e", // rose
    "#f59e0b", // amber
    "#10b981", // emerald
    "#0ea5e9", // sky
    "#a855f7", // violet
    "#06b6d4", // cyan
    "#84cc16", // lime
    "#ef4444", // red
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return accents[h % accents.length];
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function EmployeeCard({ emp, company, companyType, role, asoStatus }: {
  emp: any; company?: string; companyType?: string; role?: string;
  asoStatus?: { status: "vencido" | "vencendo" | "ok" | "sem"; dias: number | null; venc: string | null };
}) {
  const statusStyle =
    emp.status === "ATIVO"
      ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
      : emp.status === "AFASTADO"
      ? "bg-amber-100 text-amber-700 ring-amber-200"
      : emp.status === "DESLIGADO"
      ? "bg-slate-200 text-slate-700 ring-slate-300"
      : "bg-rose-100 text-rose-700 ring-rose-200";
  const isTerceiro = companyType === "TERCEIRIZADO" || emp.tipo_vinculo === "TERCEIRO";
  const isMei = emp.tipo_cadastro === "MEI";
  const isActive = emp.status === "ATIVO";
  const asoBadge = isActive && asoStatus
    ? asoStatus.status === "vencido"
      ? { text: `ASO ${asoStatus.dias}d`, cls: "bg-rose-600 text-white ring-rose-300 animate-pulse" }
      : asoStatus.status === "vencendo"
      ? { text: `ASO ${asoStatus.dias}d`, cls: "bg-amber-500 text-white ring-amber-300" }
      : asoStatus.status === "sem"
      ? { text: "SEM ASO", cls: "bg-slate-700 text-white ring-slate-400" }
      : null
    : null;

  return (
    <Link
      to="/app/employees/$id"
      params={{ id: emp.id }}
      className="glass-card glass-shine group relative block rounded-2xl p-4 hover:-translate-y-0.5 hover:shadow-2xl transition-all duration-200 overflow-hidden"
    >
      {asoBadge && (
        <span
          className={`absolute top-2 right-2 z-10 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ring-1 shadow ${asoBadge.cls}`}
          title={asoStatus?.venc ? `Validade ASO: ${asoStatus.venc}` : "Sem ASO registrado"}
        >
          {asoBadge.text}
        </span>
      )}
      {(() => {
        const accent = avatarAccent(emp.nome);
        return (
          <>
            <div
              aria-hidden
              className="pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2 h-5 w-1/2 rounded-full"
              style={{
                background: `radial-gradient(ellipse at center, #ffffffCC 0%, ${accent} 25%, ${accent}AA 55%, ${accent}00 85%)`,
                filter: "blur(8px)",
                mixBlendMode: "screen",
              }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute top-0 left-[25%] h-[1.5px] w-[50%] rounded-full"
              style={{
                background: `linear-gradient(90deg, ${accent}00 0%, #ffffff 50%, ${accent}00 100%)`,
                filter: "blur(0.6px)",
                boxShadow: `0 0 10px ${accent}, 0 0 20px ${accent}99`,
              }}
            />
          </>
        );
      })()}
      <div className="flex items-start gap-3">
        {emp.foto_url ? (
          <img
            src={emp.foto_url}
            alt={emp.nome}
            className="h-12 w-12 rounded-full object-cover shadow ring-2 ring-white"
          />
        ) : (
          <div className={`h-12 w-12 rounded-full bg-gradient-to-br ${avatarGradient(emp.nome)} text-white font-black text-sm flex items-center justify-center shadow ring-2 ring-white`}>
            {initials(emp.nome)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-black text-sm text-slate-900 uppercase leading-tight truncate group-hover:text-[#7B1E2B] transition-colors">
            {emp.nome}
          </h3>
          <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ring-1 ${statusStyle}`}>
            {emp.status}
          </span>
          <div className="mt-1 flex flex-wrap gap-1">
            {isTerceiro && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 ring-1 ring-amber-200 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest">
                TERCEIRO
              </span>
            )}
            {isMei && (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 text-violet-800 ring-1 ring-violet-200 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest">
                MEI
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-[#7B1E2B] group-hover:translate-x-0.5 transition-all flex-shrink-0" />
      </div>

      <div className="mt-3 space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <Building2 className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
          <span className="truncate">{company ?? "—"}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <Briefcase className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
          <span className="truncate">{role ?? "—"}</span>
        </div>
        {emp.cpf && (
          <div className="text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-100 mt-2">
            CPF {emp.cpf}{emp.matricula ? ` · MAT ${emp.matricula}` : ""}
          </div>
        )}
      </div>
    </Link>
  );
}