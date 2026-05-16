import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, ChevronRight, Users, UserCheck, UserX, UserMinus, Building2, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { maskCPF } from "@/lib/masks";

export const Route = createFileRoute("/app/employees/")({
  component: EmployeesPage,
});

function EmployeesPage() {
  const qc = useQueryClient();
  const { isEditor } = useAuth();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"TODOS" | "ATIVO" | "INATIVO" | "AFASTADO">("TODOS");
  const [companyFilter, setCompanyFilter] = useState<string>("TODAS");
  const [roleFilter, setRoleFilter] = useState<string>("TODOS");
  const [visibleCount, setVisibleCount] = useState(48);
  const [form, setForm] = useState<any>({ nome: "", cpf: "", matricula: "", status: "ATIVO", company_id: "", role_id: "" });

  const { data: emps, isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });
  const { data: companies } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => (await supabase.from("companies").select("id,name").order("name")).data ?? [],
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
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      setOpen(false);
      setForm({ nome: "", cpf: "", matricula: "", status: "ATIVO", company_id: "", role_id: "" });
      toast.success("Funcionário criado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (emps ?? []).filter((e: any) => {
      if (statusFilter !== "TODOS" && e.status !== statusFilter) return false;
      if (companyFilter !== "TODAS" && e.company_id !== companyFilter) return false;
      if (roleFilter !== "TODOS" && e.role_id !== roleFilter) return false;
      if (!s) return true;
      return (
        e.nome.toLowerCase().includes(s) ||
        (e.cpf ?? "").toLowerCase().includes(s) ||
        (e.matricula ?? "").toLowerCase().includes(s)
      );
    });
  }, [emps, q, statusFilter, companyFilter, roleFilter]);

  const cMap = new Map((companies ?? []).map((c: any) => [c.id, c.name]));
  const rMap = new Map((roles ?? []).map((r: any) => [r.id, r.name]));

  const stats = useMemo(() => {
    const list = emps ?? [];
    return {
      total: list.length,
      ativos: list.filter((e: any) => e.status === "ATIVO").length,
      inativos: list.filter((e: any) => e.status === "INATIVO").length,
      afastados: list.filter((e: any) => e.status === "AFASTADO").length,
    };
  }, [emps]);

  return (
    <div className="p-6 md:p-8 animate-fadeIn">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h2 className="heading-display text-3xl md:text-4xl text-brand">Funcionários</h2>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">
            Cadastro de funcionários
          </p>
        </div>
        {isEditor && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#0f172a] hover:bg-brand text-white text-[11px] font-black uppercase tracking-widest rounded-xl px-5 py-3 h-auto shadow-lg">
                <Plus className="h-4 w-4 mr-2" />Novo funcionário
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo funcionário</DialogTitle></DialogHeader>
              <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); create.mutate(form); }}>
                <div className="space-y-2"><Label>Nome *</Label><Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>CPF</Label><Input inputMode="numeric" placeholder="000.000.000-00" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: maskCPF(e.target.value) })} /></div>
                  <div className="space-y-2"><Label>Matrícula</Label><Input value={form.matricula} onChange={(e) => setForm({ ...form, matricula: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Empresa</Label>
                    <Select value={form.company_id} onValueChange={(v) => setForm({ ...form, company_id: v })}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{(companies ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
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
                <DialogFooter><Button type="submit" disabled={create.isPending}>Criar</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* KPIs (clicáveis = filtro de status) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <KpiCard icon={Users} label="Total" value={stats.total} tone="slate"
          active={statusFilter === "TODOS"} onClick={() => setStatusFilter("TODOS")} />
        <KpiCard icon={UserCheck} label="Ativos" value={stats.ativos} tone="emerald"
          active={statusFilter === "ATIVO"} onClick={() => setStatusFilter("ATIVO")} />
        <KpiCard icon={UserMinus} label="Afastados" value={stats.afastados} tone="amber"
          active={statusFilter === "AFASTADO"} onClick={() => setStatusFilter("AFASTADO")} />
        <KpiCard icon={UserX} label="Inativos" value={stats.inativos} tone="rose"
          active={statusFilter === "INATIVO"} onClick={() => setStatusFilter("INATIVO")} />
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
        <Select value={companyFilter} onValueChange={setCompanyFilter}>
          <SelectTrigger className="md:col-span-3 h-12 rounded-2xl bg-white"><SelectValue placeholder="Empresa" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TODAS">Todas as empresas</SelectItem>
            {(companies ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="md:col-span-3 h-12 rounded-2xl bg-white"><SelectValue placeholder="Cargo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos os cargos</SelectItem>
            {(roles ?? []).map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
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
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold uppercase tracking-widest text-slate-500">Nenhum funcionário encontrado</p>
          <p className="text-xs text-slate-400 mt-1">Ajuste a busca ou os filtros.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.slice(0, visibleCount).map((e: any) => (
              <EmployeeCard
                key={e.id}
                emp={e}
                company={cMap.get(e.company_id) ?? undefined}
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

function EmployeeCard({ emp, company, role }: { emp: any; company?: string; role?: string }) {
  const statusStyle =
    emp.status === "ATIVO"
      ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
      : emp.status === "AFASTADO"
      ? "bg-amber-100 text-amber-700 ring-amber-200"
      : "bg-rose-100 text-rose-700 ring-rose-200";

  return (
    <Link
      to="/app/employees/$id"
      params={{ id: emp.id }}
      className="group relative block rounded-2xl bg-white border border-slate-200 p-4 shadow-sm hover:shadow-xl hover:-translate-y-0.5 hover:border-[#7B1E2B]/40 transition-all duration-200 overflow-hidden"
    >
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${avatarGradient(emp.nome)}`} />
      <div className="flex items-start gap-3">
        <div className={`h-12 w-12 rounded-full bg-gradient-to-br ${avatarGradient(emp.nome)} text-white font-black text-sm flex items-center justify-center shadow ring-2 ring-white`}>
          {initials(emp.nome)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-black text-sm text-slate-900 uppercase leading-tight truncate group-hover:text-[#7B1E2B] transition-colors">
            {emp.nome}
          </h3>
          <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ring-1 ${statusStyle}`}>
            {emp.status}
          </span>
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