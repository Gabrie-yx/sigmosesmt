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
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Painel TST</h1>
        <p className="text-muted-foreground text-sm">Visão de conformidade ISO 9001 — GSI</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Aptos" value={counts.APTO} icon={ShieldCheck} accent="bg-status-apto" />
        <Kpi label="Alerta" value={counts.ALERTA} icon={AlertTriangle} accent="bg-status-alerta" />
        <Kpi label="Bloqueados" value={counts.BLOQUEADO} icon={ShieldOff} accent="bg-status-bloqueado" />
        <Kpi label="Total" value={rows.length} icon={Users} accent="bg-brand" />
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, CPF, matrícula, empresa, função…"
          className="pl-10"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="divide-y">
          {filtered.length === 0 && (
            <div className="p-8 text-center text-muted-foreground text-sm">Nenhum colaborador encontrado.</div>
          )}
          {filtered.map((r) => (
            <Link
              key={r.emp.id}
              to="/app/employees/$id"
              params={{ id: r.emp.id }}
              className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors"
            >
              <div className={`h-2.5 w-2.5 rounded-full ${r.status.colorClass} shrink-0`} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{r.emp.nome}</div>
                <div className="text-xs text-muted-foreground truncate">
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
              <Badge className={`${r.status.colorClass} text-white border-0 shrink-0`}>{r.status.label}</Badge>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, accent }: { label: string; value: number; icon: any; accent: string }) {
  return (
    <Card className="p-4 flex items-center gap-3">
      <div className={`h-10 w-10 rounded-lg ${accent} text-white flex items-center justify-center`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-2xl font-bold leading-none">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </div>
    </Card>
  );
}