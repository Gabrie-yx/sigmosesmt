import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, ChevronDown, Building2, Users, Briefcase, Search, AlertCircle, CheckCircle2, Clock, FolderTree } from "lucide-react";
import { EmployeeQuickView } from "@/components/employees/employee-quick-view";
import { daysUntil } from "@/lib/utils-date";

export const Route = createFileRoute("/app/sesmt/organograma")({
  component: OrganogramaPage,
});

type Emp = {
  id: string;
  nome: string;
  matricula: string | null;
  status: string | null;
  company_id: string | null;
  role_id: string | null;
  data_aso: string | null;
  setor: string | null;
};
type Role = { id: string; name: string; setor: string | null; req_aso: boolean | null };
type Company = { id: string; name: string };

type Health = "ok" | "warn" | "danger" | "na";

function classifyEmp(emp: Emp, role: Role | undefined): Health {
  if (emp.status !== "ATIVO") return "na";
  if (!role) return "danger";
  if (!role.req_aso) return "ok";
  if (!emp.data_aso) return "danger";
  const d = daysUntil(emp.data_aso);
  if (d == null) return "danger";
  if (d < 0) return "danger";
  if (d <= 30) return "warn";
  return "ok";
}

function aggregate(states: Health[]) {
  const total = states.filter((s) => s !== "na").length;
  const danger = states.filter((s) => s === "danger").length;
  const warn = states.filter((s) => s === "warn").length;
  const ok = states.filter((s) => s === "ok").length;
  const pct = total === 0 ? 100 : Math.round((ok / total) * 100);
  return { total, danger, warn, ok, pct };
}

function HealthDot({ h }: { h: Health }) {
  const cls =
    h === "danger" ? "bg-red-500" : h === "warn" ? "bg-amber-400" : h === "ok" ? "bg-emerald-500" : "bg-zinc-500";
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${cls}`} />;
}

function PctBadge({ pct, total }: { pct: number; total: number }) {
  if (total === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const tone =
    pct >= 95 ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
    : pct >= 80 ? "bg-amber-400/15 text-amber-300 border-amber-400/30"
    : "bg-red-500/15 text-red-300 border-red-500/30";
  return (
    <span className={`rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${tone}`}>{pct}%</span>
  );
}

function OrganogramaPage() {
  const [q, setQ] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>("TODAS");
  const [setorFilter, setSetorFilter] = useState<string>("TODOS");
  const [showInactive, setShowInactive] = useState(false);
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());
  const [expandedSetores, setExpandedSetores] = useState<Set<string>>(new Set());
  const [expandedCargos, setExpandedCargos] = useState<Set<string>>(new Set());
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["organograma:companies"],
    queryFn: async () => (await supabase.from("companies").select("id,name").order("name")).data ?? [],
  });
  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ["organograma:roles"],
    queryFn: async () =>
      (await supabase.from("roles").select("id,name,setor,req_aso").order("name")).data ?? [],
  });
  const { data: emps = [], isLoading } = useQuery<Emp[]>({
    queryKey: ["organograma:employees"],
    queryFn: async () =>
      (await supabase
        .from("employees")
        .select("id,nome,matricula,status,company_id,role_id,data_aso,setor")
        .order("nome")).data ?? [],
  });

  const rolesById = useMemo(() => {
    const m = new Map<string, Role>();
    roles.forEach((r) => m.set(r.id, r));
    return m;
  }, [roles]);

  const setorOf = (e: Emp): string => {
    const r = e.role_id ? rolesById.get(e.role_id) : undefined;
    return (r?.setor || e.setor || "Sem setor").trim() || "Sem setor";
  };

  const tree = useMemo(() => {
    const norm = (v: string) =>
      (v ?? "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const term = norm(q.trim());

    const visibleEmps = emps.filter((e) => {
      if (!showInactive && e.status !== "ATIVO") return false;
      if (companyFilter !== "TODAS" && e.company_id !== companyFilter) return false;
      if (setorFilter !== "TODOS" && setorOf(e) !== setorFilter) return false;
      if (term) {
        const blob = norm(`${e.nome} ${e.matricula ?? ""}`);
        if (!blob.includes(term)) return false;
      }
      return true;
    });

    type CargoNode = { roleId: string; roleName: string; emps: Emp[] };
    type SetorNode = { name: string; cargos: Map<string, CargoNode> };
    type CompanyNode = { id: string; name: string; setores: Map<string, SetorNode> };
    const root = new Map<string, CompanyNode>();

    for (const e of visibleEmps) {
      const cId = e.company_id ?? "SEM_EMPRESA";
      const cName = companies.find((c) => c.id === cId)?.name ?? "Sem empresa";
      let cn = root.get(cId);
      if (!cn) { cn = { id: cId, name: cName, setores: new Map() }; root.set(cId, cn); }
      const sName = setorOf(e);
      let sn = cn.setores.get(sName);
      if (!sn) { sn = { name: sName, cargos: new Map() }; cn.setores.set(sName, sn); }
      const rId = e.role_id ?? "SEM_CARGO";
      const rName = (e.role_id && rolesById.get(e.role_id)?.name) || "Sem cargo";
      let cgn = sn.cargos.get(rId);
      if (!cgn) { cgn = { roleId: rId, roleName: rName, emps: [] }; sn.cargos.set(rId, cgn); }
      cgn.emps.push(e);
    }
    return root;
  }, [emps, companies, rolesById, q, companyFilter, setorFilter, showInactive]);

  const allSetores = useMemo(() => {
    const s = new Set<string>();
    emps.forEach((e) => s.add(setorOf(e)));
    return Array.from(s).sort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emps, rolesById]);

  const toggle = (set: Set<string>, key: string, setter: (s: Set<string>) => void) => {
    const n = new Set(set);
    if (n.has(key)) n.delete(key); else n.add(key);
    setter(n);
  };
  const expandAll = () => {
    const cs = new Set<string>(); const ss = new Set<string>(); const cgs = new Set<string>();
    tree.forEach((cn) => {
      cs.add(cn.id);
      cn.setores.forEach((sn) => {
        ss.add(`${cn.id}|${sn.name}`);
        sn.cargos.forEach((cg) => cgs.add(`${cn.id}|${sn.name}|${cg.roleId}`));
      });
    });
    setExpandedCompanies(cs); setExpandedSetores(ss); setExpandedCargos(cgs);
  };
  const collapseAll = () => {
    setExpandedCompanies(new Set()); setExpandedSetores(new Set()); setExpandedCargos(new Set());
  };

  // Global KPIs
  const globalStats = useMemo(() => {
    const states: Health[] = [];
    tree.forEach((cn) => cn.setores.forEach((sn) => sn.cargos.forEach((cg) => cg.emps.forEach((e) => states.push(classifyEmp(e, e.role_id ? rolesById.get(e.role_id) : undefined))))));
    return aggregate(states);
  }, [tree, rolesById]);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 ring-1 ring-primary/30">
            <FolderTree className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-foreground">Organograma Vivo</h1>
            <p className="text-xs text-muted-foreground">Empresa → Setor → Cargo → Funcionário · com semáforo de conformidade ASO</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={expandAll}>Expandir tudo</Button>
          <Button size="sm" variant="outline" onClick={collapseAll}>Recolher</Button>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard icon={<Users className="h-4 w-4" />} label="Funcionários" value={String(globalStats.total)} tone="neutral" />
        <KpiCard icon={<CheckCircle2 className="h-4 w-4" />} label="Conformes" value={String(globalStats.ok)} tone="ok" />
        <KpiCard icon={<Clock className="h-4 w-4" />} label="Vencendo 30d" value={String(globalStats.warn)} tone="warn" />
        <KpiCard icon={<AlertCircle className="h-4 w-4" />} label="Pendentes/Vencidos" value={String(globalStats.danger)} tone="danger" />
      </div>

      {/* Filtros */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 backdrop-blur">
        <div className="grid gap-2 md:grid-cols-[1fr_220px_220px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar funcionário ou matrícula..." className="pl-8" />
          </div>
          <Select value={companyFilter} onValueChange={setCompanyFilter}>
            <SelectTrigger><SelectValue placeholder="Empresa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TODAS">Todas as empresas</SelectItem>
              {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={setorFilter} onValueChange={setSetorFilter}>
            <SelectTrigger><SelectValue placeholder="Setor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos os setores</SelectItem>
              {allSetores.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 px-2 text-sm text-muted-foreground">
            <Checkbox checked={showInactive} onCheckedChange={(v) => setShowInactive(!!v)} />
            Mostrar inativos
          </label>
        </div>
      </div>

      {/* Árvore */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-2 backdrop-blur">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Carregando hierarquia...</div>
        ) : tree.size === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">Nenhum funcionário encontrado para os filtros.</div>
        ) : (
          <ul className="space-y-1">
            {Array.from(tree.values()).sort((a, b) => a.name.localeCompare(b.name)).map((cn) => {
              const cKey = cn.id;
              const isOpen = expandedCompanies.has(cKey);
              const states: Health[] = [];
              cn.setores.forEach((sn) => sn.cargos.forEach((cg) => cg.emps.forEach((e) => states.push(classifyEmp(e, e.role_id ? rolesById.get(e.role_id) : undefined)))));
              const ag = aggregate(states);
              return (
                <li key={cKey}>
                  <button onClick={() => toggle(expandedCompanies, cKey, setExpandedCompanies)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-white/5">
                    {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    <Building2 className="h-4 w-4 text-primary" />
                    <span className="truncate font-semibold text-foreground">{cn.name}</span>
                    <span className="text-xs text-muted-foreground">· {ag.total} func.</span>
                    <span className="ml-auto flex items-center gap-1.5">
                      {ag.danger > 0 && <Badge variant="outline" className="border-red-500/40 bg-red-500/10 text-red-300">{ag.danger} 🔴</Badge>}
                      {ag.warn > 0 && <Badge variant="outline" className="border-amber-400/40 bg-amber-400/10 text-amber-200">{ag.warn} 🟡</Badge>}
                      <PctBadge pct={ag.pct} total={ag.total} />
                    </span>
                  </button>
                  {isOpen && (
                    <ul className="ml-6 space-y-0.5 border-l border-white/10 pl-2">
                      {Array.from(cn.setores.values()).sort((a, b) => a.name.localeCompare(b.name)).map((sn) => {
                        const sKey = `${cn.id}|${sn.name}`;
                        const sOpen = expandedSetores.has(sKey);
                        const sStates: Health[] = [];
                        sn.cargos.forEach((cg) => cg.emps.forEach((e) => sStates.push(classifyEmp(e, e.role_id ? rolesById.get(e.role_id) : undefined))));
                        const sAg = aggregate(sStates);
                        return (
                          <li key={sKey}>
                            <button onClick={() => toggle(expandedSetores, sKey, setExpandedSetores)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-white/5">
                              {sOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                              <FolderTree className="h-4 w-4 text-amber-300/80" />
                              <span className="truncate text-sm font-medium text-foreground">{sn.name}</span>
                              <span className="text-xs text-muted-foreground">· {sAg.total}</span>
                              <span className="ml-auto flex items-center gap-1.5">
                                {sAg.danger > 0 && <span className="text-xs text-red-300">{sAg.danger} venc.</span>}
                                {sAg.warn > 0 && <span className="text-xs text-amber-200">{sAg.warn} 30d</span>}
                                <PctBadge pct={sAg.pct} total={sAg.total} />
                              </span>
                            </button>
                            {sOpen && (
                              <ul className="ml-6 space-y-0.5 border-l border-white/10 pl-2">
                                {Array.from(sn.cargos.values()).sort((a, b) => a.roleName.localeCompare(b.roleName)).map((cg) => {
                                  const cgKey = `${cn.id}|${sn.name}|${cg.roleId}`;
                                  const cgOpen = expandedCargos.has(cgKey);
                                  const cgStates = cg.emps.map((e) => classifyEmp(e, e.role_id ? rolesById.get(e.role_id) : undefined));
                                  const cgAg = aggregate(cgStates);
                                  return (
                                    <li key={cgKey}>
                                      <button onClick={() => toggle(expandedCargos, cgKey, setExpandedCargos)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-white/5">
                                        {cgOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                                        <Briefcase className="h-4 w-4 text-sky-300/80" />
                                        <span className="truncate text-sm text-foreground/90">{cg.roleName}</span>
                                        <span className="text-xs text-muted-foreground">· {cg.emps.length}</span>
                                        <span className="ml-auto"><PctBadge pct={cgAg.pct} total={cgAg.total} /></span>
                                      </button>
                                      {cgOpen && (
                                        <ul className="ml-6 space-y-0.5 border-l border-white/10 pl-2">
                                          {cg.emps.sort((a, b) => a.nome.localeCompare(b.nome)).map((e) => {
                                            const h = classifyEmp(e, e.role_id ? rolesById.get(e.role_id) : undefined);
                                            const d = e.data_aso ? daysUntil(e.data_aso) : null;
                                            const hint = h === "danger" ? (e.data_aso ? `ASO vencido há ${Math.abs(d!)}d` : "Sem ASO")
                                              : h === "warn" ? `ASO vence em ${d}d`
                                              : h === "ok" ? (e.data_aso ? `ASO ok (${d}d)` : "OK")
                                              : (e.status ?? "—");
                                            return (
                                              <li key={e.id}>
                                                <button onClick={() => setSelectedEmpId(e.id)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-white/5">
                                                  <HealthDot h={h} />
                                                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                                                  <span className="truncate text-sm text-foreground">{e.nome}</span>
                                                  {e.matricula && <span className="text-[11px] text-muted-foreground">#{e.matricula}</span>}
                                                  {e.status !== "ATIVO" && <Badge variant="outline" className="text-[10px]">{e.status}</Badge>}
                                                  <span className="ml-auto text-[11px] text-muted-foreground">{hint}</span>
                                                </button>
                                              </li>
                                            );
                                          })}
                                        </ul>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <EmployeeQuickView employeeId={selectedEmpId} open={!!selectedEmpId} onClose={() => setSelectedEmpId(null)} />
    </div>
  );
}

function KpiCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "neutral" | "ok" | "warn" | "danger" }) {
  const ring =
    tone === "ok" ? "ring-emerald-500/30 from-emerald-500/15"
    : tone === "warn" ? "ring-amber-400/30 from-amber-400/15"
    : tone === "danger" ? "ring-red-500/30 from-red-500/15"
    : "ring-white/10 from-white/[0.04]";
  return (
    <div className={`relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br ${ring} to-transparent p-3 backdrop-blur ring-1`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-2xl font-bold text-foreground">{value}</div>
    </div>
  );
}