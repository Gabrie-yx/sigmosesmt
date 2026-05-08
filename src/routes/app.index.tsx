import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, ShieldCheck, AlertTriangle, ShieldOff, Users } from "lucide-react";
import { calculateSafetyStatus, type SafetyLabel } from "@/lib/safety-engine";

export const Route = createFileRoute("/app/")({
  component: TstPanel,
});

function TstPanel() {
  const [q, setQ] = useState("");

  const { data } = useQuery({
    queryKey: ["tst-panel"],
    queryFn: async () => {
      const [emps, comps, roles, exams] = await Promise.all([
        supabase.from("employees").select("*").order("nome"),
        supabase.from("companies").select("id,name"),
        supabase.from("roles").select("*"),
        supabase.from("employee_exams").select("*"),
      ]);
      return {
        employees: emps.data ?? [],
        companies: comps.data ?? [],
        roles: roles.data ?? [],
        exams: exams.data ?? [],
      };
    },
  });

  const rows = useMemo(() => {
    if (!data) return [];
    const cMap = new Map(data.companies.map((c: any) => [c.id, c.name]));
    const rMap = new Map(data.roles.map((r: any) => [r.id, r]));
    const exMap = new Map<string, any[]>();
    data.exams.forEach((ex: any) => {
      const arr = exMap.get(ex.employee_id) ?? [];
      arr.push(ex);
      exMap.set(ex.employee_id, arr);
    });
    return data.employees.map((e: any) => {
      const role = e.role_id ? rMap.get(e.role_id) ?? null : null;
      const status = calculateSafetyStatus(e, role as any, exMap.get(e.id) ?? []);
      return {
        emp: e,
        company: e.company_id ? cMap.get(e.company_id) ?? "—" : "—",
        roleName: role ? (role as any).name : "—",
        status,
      };
    });
  }, [data]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.emp.nome.toLowerCase().includes(s) ||
        (r.emp.cpf ?? "").toLowerCase().includes(s) ||
        (r.emp.matricula ?? "").toLowerCase().includes(s) ||
        r.company.toLowerCase().includes(s) ||
        r.roleName.toLowerCase().includes(s),
    );
  }, [rows, q]);

  const counts = useMemo(() => {
    const acc: Record<SafetyLabel, number> = {
      APTO: 0, ALERTA: 0, BLOQUEADO: 0, INATIVO: 0, AFASTADO: 0, "SEM CARGO": 0,
    };
    rows.forEach((r) => {
      acc[r.status.label] = (acc[r.status.label] ?? 0) + 1;
    });
    return acc;
  }, [rows]);

  return (
    <div className="p-6 md:p-8 space-y-6 animate-fadeIn">
      <h2 className="heading-display text-3xl md:text-4xl text-brand">
        Painel do TST / GSI
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Aptos" value={counts.APTO} icon={ShieldCheck} accent="bg-status-apto" />
        <Kpi label="Alerta" value={counts.ALERTA} icon={AlertTriangle} accent="bg-status-alerta" />
        <Kpi label="Bloqueados" value={counts.BLOQUEADO} icon={ShieldOff} accent="bg-status-bloqueado" />
        <Kpi label="Total" value={rows.length} icon={Users} accent="bg-brand" />
      </div>

      <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200">
        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Search className="h-4 w-4" /> Busca Universal (Omnisearch)
        </h3>
        <div className="relative">
          <Input
            placeholder="Digite Nome, CPF, matrícula, empresa ou função…"
            className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-6 text-sm font-bold uppercase placeholder:normal-case placeholder:text-slate-400"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="divide-y divide-slate-100">
          {filtered.length === 0 && (
            <div className="p-10 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
              Nenhum colaborador encontrado.
            </div>
          )}
          {filtered.map((r) => (
            <Link
              key={r.emp.id}
              to="/app/employees/$id"
              params={{ id: r.emp.id }}
              className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors"
            >
              <div className={`h-2.5 w-2.5 rounded-full ${r.status.colorClass} shrink-0`} />
              <div className="flex-1 min-w-0">
                <div className="font-black uppercase text-sm tracking-tight truncate text-slate-900">{r.emp.nome}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 truncate mt-0.5">
                  {r.company} · {r.roleName} · {r.emp.matricula ?? "sem matrícula"}
                </div>
              </div>
              <div className="hidden md:flex items-center gap-1 max-w-[40%] flex-wrap justify-end">
                {r.status.msgs.slice(0, 3).map((m, i) => (
                  <Badge key={i} variant="outline" className="text-[10px] font-medium">
                    {m}
                  </Badge>
                ))}
              </div>
              <Badge className={`${r.status.colorClass} text-white border-0 shrink-0 text-[10px] font-black uppercase tracking-widest`}>{r.status.label}</Badge>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, accent }: { label: string; value: number; icon: any; accent: string }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex items-center gap-4 hover:-translate-y-0.5 transition-transform">
      <div className={`h-12 w-12 rounded-xl ${accent} text-white flex items-center justify-center shadow-md`}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <div className="text-3xl font-black font-outfit leading-none tracking-tighter">{value}</div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">{label}</div>
      </div>
    </div>
  );
}