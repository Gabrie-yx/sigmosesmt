import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, ChevronRight, Users, UserCheck, UserX, UserMinus, Building2, Briefcase, CalendarClock, FileText, UserRoundX } from "lucide-react";
import { toast } from "sonner";
import { maskCPF, maskCNPJ } from "@/lib/masks";
import { Wizard, type WizardStep } from "@/components/wizard";
import { EmployeeListagemDialog } from "@/components/employees/employee-listagem-dialog";

export const Route = createFileRoute("/app/employees/")({
  component: EmployeesPage,
  validateSearch: (search: Record<string, unknown>) => ({
    new: search.new === 1 || search.new === "1" ? 1 : undefined,
    company: typeof search.company === "string" ? search.company : undefined,
  }),
});

function EmployeesPage() {
  const qc = useQueryClient();
  const { isEditor } = useAuth();
  const navigate = useNavigate();
  const { new: openNew, company: openCompany } = Route.useSearch();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (openNew && isEditor) {
      setOpen(true);
      if (openCompany) {
        setForm((f: any) => ({ ...f, company_id: openCompany }));
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
  const [visibleCount, setVisibleCount] = useState<number>(initialFilters?.visibleCount ?? 48);
  useEffect(() => {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(FILTERS_KEY, JSON.stringify({ q, statusFilter, companyFilter, roleFilter, vinculoFilter, visibleCount }));
  }, [q, statusFilter, companyFilter, roleFilter, vinculoFilter, visibleCount]);
  const [form, setForm] = useState<any>({ nome: "", cpf: "", matricula: "", status: "ATIVO", company_id: "", role_id: "", tipo_cadastro: "NAO_MEI", cnpj: "" });
  const [listagemOpen, setListagemOpen] = useState(false);

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

  const create = useMutation({
    mutationFn: async (v: any) => {
      const { error } = await supabase.from("employees").insert({
        nome: v.nome,
        cpf: v.cpf || null,
        matricula: v.matricula || null,
        status: v.status,
        company_id: v.company_id || null,
        role_id: v.role_id || null,
        tipo_cadastro: v.tipo_cadastro || "NAO_MEI",
        cnpj: v.tipo_cadastro === "MEI" ? (v.cnpj || null) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      setOpen(false);
      setForm({ nome: "", cpf: "", matricula: "", status: "ATIVO", company_id: "", role_id: "", tipo_cadastro: "NAO_MEI", cnpj: "" });
      toast.success("Funcionário criado");
    },
    onError: (e: any) => toast.error(e.message),
  });

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
      if (!s) return true;
      const cpfDigits = (e.cpf ?? "").replace(/\D/g, "");
      return (
        norm(e.nome ?? "").includes(s) ||
        norm(e.matricula ?? "").includes(s) ||
        norm(e.cpf ?? "").includes(s) ||
        (sDigits.length >= 3 && cpfDigits.includes(sDigits))
      );
    });
  }, [emps, q, statusFilter, companyFilter, roleFilter, vinculoFilter]);

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
            <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setListagemOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <FileText className="h-3.5 w-3.5" /> Listagem
              </button>
              <span className="h-5 w-px bg-slate-200" />
              <Link
                to="/app/employees/saidas"
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <CalendarClock className="h-3.5 w-3.5" /> Saídas
              </Link>
              <span className="h-5 w-px bg-slate-200" />
              <Link
                to="/app/employees/hora-extra-sabado"
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <CalendarClock className="h-3.5 w-3.5" /> Hora extra
              </Link>
              <span className="h-5 w-px bg-slate-200" />
              <Link
                to="/app/employees/desligados"
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <UserRoundX className="h-3.5 w-3.5" /> Desligados
              </Link>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#0f172a] hover:bg-brand text-white text-[10px] font-black uppercase tracking-widest rounded-xl px-4 py-2.5 h-auto shadow-md">
                  <Plus className="h-3.5 w-3.5 mr-1.5" />Novo funcionário
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo funcionário</DialogTitle></DialogHeader>
              {(() => {
                const selectedCompany = (companies ?? []).find((c: any) => c.id === form.company_id);
                const cName = selectedCompany?.name ?? "—";
                const isTerceiro = selectedCompany?.type === "TERCEIRIZADO";
                const rName = (roles ?? []).find((r: any) => r.id === form.role_id)?.name ?? "—";
                const steps: WizardStep[] = [
                  {
                    id: "dados",
                    title: "Dados pessoais",
                    description: "Identificação básica do funcionário.",
                    isValid: () => form.nome.trim().length > 0,
                    invalidMessage: "Informe o nome.",
                    content: (
                      <div className="space-y-3">
                        <div className="space-y-2"><Label>Nome *</Label><Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2"><Label>CPF</Label><Input inputMode="numeric" placeholder="000.000.000-00" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: maskCPF(e.target.value) })} /></div>
                          <div className="space-y-2"><Label>Matrícula</Label><Input value={form.matricula} onChange={(e) => setForm({ ...form, matricula: e.target.value })} /></div>
                        </div>
                      </div>
                    ),
                  },
                  {
                    id: "vinculo",
                    title: "Vínculo",
                    description: "Empresa, cargo e situação.",
                    content: (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>Empresa</Label>
                            <Select value={form.company_id} onValueChange={(v) => setForm({ ...form, company_id: v })}>
                              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                              <SelectContent>{(companies ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}{c.type === "TERCEIRIZADO" ? " · TERCEIRO" : ""}</SelectItem>)}</SelectContent>
                            </Select>
                            {isTerceiro && <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700">Vínculo: TERCEIRO</p>}
                          </div>
                          <div className="space-y-2">
                            <Label>Cargo</Label>
                            <Select value={form.role_id} onValueChange={(v) => setForm({ ...form, role_id: v })}>
                              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                              <SelectContent>{(roles ?? []).map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Status</Label>
                          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ATIVO">ATIVO</SelectItem>
                              <SelectItem value="INATIVO">INATIVO</SelectItem>
                              <SelectItem value="AFASTADO">AFASTADO</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>Tipo de cadastro</Label>
                            <Select value={form.tipo_cadastro} onValueChange={(v) => setForm({ ...form, tipo_cadastro: v, cnpj: v === "MEI" ? form.cnpj : "" })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="NAO_MEI">CLT</SelectItem>
                                <SelectItem value="MEI">MEI</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {form.tipo_cadastro === "MEI" && (
                            <div className="space-y-2">
                              <Label>CNPJ (MEI)</Label>
                              <Input inputMode="numeric" maxLength={18} placeholder="00.000.000/0000-00" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: maskCNPJ(e.target.value) })} />
                            </div>
                          )}
                        </div>
                      </div>
                    ),
                  },
                  {
                    id: "revisao",
                    title: "Revisão",
                    description: "Confirme os dados antes de salvar.",
                    content: (
                      <dl className="rounded-xl border border-slate-200 bg-slate-50/60 divide-y divide-slate-200 text-sm">
                        {[
                          ["Nome", form.nome || "—"],
                          ["CPF", form.cpf || "—"],
                          ["Matrícula", form.matricula || "—"],
                          ["Empresa", cName],
                          ["Cargo", rName],
                          ["Status", form.status],
                          ["Vínculo", isTerceiro ? "TERCEIRO" : "PRÓPRIO (DMN)"],
                          ["Tipo", form.tipo_cadastro === "MEI" ? "MEI" : "CLT"],
                          ...(form.tipo_cadastro === "MEI" ? [["CNPJ MEI", form.cnpj || "—"]] : []),
                        ].map(([k, v]) => (
                          <div key={k} className="flex items-center justify-between px-3 py-2">
                            <dt className="text-[10px] font-black uppercase tracking-widest text-slate-500">{k}</dt>
                            <dd className="font-semibold text-slate-900 text-right truncate ml-3">{v}</dd>
                          </div>
                        ))}
                      </dl>
                    ),
                  },
                ];
                return (
                  <Wizard
                    steps={steps}
                    isSubmitting={create.isPending}
                    completeLabel="Criar funcionário"
                    onCancel={() => setOpen(false)}
                    onComplete={() => create.mutate(form)}
                  />
                );
              })()}
            </DialogContent>
          </Dialog>
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
    </div>
  );
}

// ============ Sub-componentes ============

const TONES = {
  slate: { bg: "bg-slate-50", text: "text-slate-700", ring: "ring-slate-200", icon: "bg-slate-900 text-white" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200", icon: "bg-emerald-600 text-white" },
  amber: { bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-200", icon: "bg-amber-500 text-white" },
  rose: { bg: "bg-rose-50", text: "text-rose-700", ring: "ring-rose-200", icon: "bg-rose-600 text-white" },
} as const;

function KpiCard({ icon: Icon, label, value, tone, active, onClick }: { icon: any; label: string; value: number; tone: keyof typeof TONES; active?: boolean; onClick?: () => void }) {
  const t = TONES[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-2xl ${t.bg} ring-1 ${active ? "ring-2 ring-[#7B1E2B] shadow-md -translate-y-0.5" : t.ring} p-4 flex items-center gap-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all`}
    >
      <div className={`h-11 w-11 rounded-xl ${t.icon} flex items-center justify-center shadow`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className={`text-[10px] font-black uppercase tracking-widest ${t.text}`}>{label}</p>
        <p className="text-2xl font-black text-slate-900 leading-none mt-1">{value}</p>
      </div>
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

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

function EmployeeCard({ emp, company, companyType, role }: { emp: any; company?: string; companyType?: string; role?: string }) {
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

  return (
    <Link
      to="/app/employees/$id"
      params={{ id: emp.id }}
      className="glass-card glass-shine group relative block rounded-2xl p-4 hover:-translate-y-0.5 hover:shadow-2xl transition-all duration-200 overflow-hidden"
    >
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${avatarGradient(emp.nome)}`} />
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