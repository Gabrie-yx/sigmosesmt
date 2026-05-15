import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Building2,
  Users,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  FileCheck2,
  Search,
} from "lucide-react";

export const Route = createFileRoute("/app/sesmt/terceiros")({
  component: TerceirosDashboard,
});

function TerceirosDashboard() {
  const [search, setSearch] = useState("");

  const { data: companies = [] } = useQuery({
    queryKey: ["terceiros-companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, type, cnpj")
        .eq("type", "TERCEIRO");
      if (error) throw error;
      return data ?? [];
    },
  });

  const companyIds = companies.map((c: any) => c.id);

  const { data: employees = [] } = useQuery({
    queryKey: ["terceiros-employees", companyIds],
    enabled: companyIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, nome, cpf, status, setor, company_id, data_aso, data_integracao")
        .in("company_id", companyIds)
        .eq("status", "ATIVO");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: exams = [] } = useQuery({
    queryKey: ["terceiros-exams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_exams")
        .select("employee_id, data_vencimento, aptidao");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: procs = [] } = useQuery({
    queryKey: ["terceiros-procs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("procedimentos")
        .select("id, codigo, titulo, escopo, status, versao_atual")
        .eq("status", "HOMOLOGADO")
        .in("escopo", ["TERCEIRO", "AMBOS"]);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: cientes = [] } = useQuery({
    queryKey: ["terceiros-cientes"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("procedimento_cientes")
        .select("procedimento_id, versao, employee_id");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Métricas por colaborador
  const today = new Date();
  const in30 = new Date();
  in30.setDate(today.getDate() + 30);

  const empStatus = useMemo(() => {
    return employees.map((e: any) => {
      const ex = exams.filter((x: any) => x.employee_id === e.id);
      const ultimoVenc = ex
        .map((x: any) => x.data_vencimento)
        .filter(Boolean)
        .sort()
        .reverse()[0];
      const venc = ultimoVenc ? new Date(ultimoVenc) : null;
      let aso: "OK" | "ALERTA" | "VENCIDO" | "FALTA" = "FALTA";
      if (venc) {
        if (venc < today) aso = "VENCIDO";
        else if (venc < in30) aso = "ALERTA";
        else aso = "OK";
      } else if (e.data_aso) {
        aso = "OK"; // fallback
      }
      const integracao = !!e.data_integracao;
      return { ...e, aso, integracao };
    });
  }, [employees, exams]);

  const kpis = useMemo(() => {
    const total = empStatus.length;
    const aptos = empStatus.filter((e: any) => e.aso === "OK" && e.integracao).length;
    const alertas = empStatus.filter((e: any) => e.aso === "ALERTA").length;
    const bloqueados = empStatus.filter(
      (e: any) => e.aso === "VENCIDO" || e.aso === "FALTA" || !e.integracao,
    ).length;

    // ciência média POPs
    let pctSum = 0;
    let pctCount = 0;
    for (const p of procs) {
      const aplicaveis = empStatus.length;
      if (!aplicaveis) continue;
      const c = cientes.filter(
        (x: any) =>
          x.procedimento_id === p.id &&
          x.versao === p.versao_atual &&
          empStatus.some((e: any) => e.id === x.employee_id),
      ).length;
      pctSum += (c / aplicaveis) * 100;
      pctCount++;
    }
    const aderencia = pctCount ? Math.round(pctSum / pctCount) : 0;

    return { total, aptos, alertas, bloqueados, aderencia };
  }, [empStatus, procs, cientes]);

  const filteredEmps = empStatus.filter((e: any) =>
    !search ? true : e.nome.toLowerCase().includes(search.toLowerCase()),
  );

  const procsWithStats = procs.map((p: any) => {
    const c = cientes.filter(
      (x: any) =>
        x.procedimento_id === p.id &&
        x.versao === p.versao_atual &&
        empStatus.some((e: any) => e.id === x.employee_id),
    ).length;
    const pct = empStatus.length ? Math.round((c / empStatus.length) * 100) : 0;
    return { ...p, c, total: empStatus.length, pct };
  });

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
          <Building2 className="h-6 w-6 text-purple-700" /> Painel de Terceiros
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Indicadores de saúde, segurança e ciência de POPs aplicados aos colaboradores
          terceirizados (companies.type = TERCEIRO).
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Kpi label="Empresas" value={companies.length} icon={<Building2 className="h-4 w-4" />} />
        <Kpi label="Colaboradores" value={kpis.total} icon={<Users className="h-4 w-4" />} />
        <Kpi
          label="APTOS"
          value={kpis.aptos}
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
          accent="emerald"
        />
        <Kpi
          label="ALERTA"
          value={kpis.alertas}
          icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}
          accent="amber"
        />
        <Kpi
          label="BLOQUEADOS"
          value={kpis.bloqueados}
          icon={<ShieldAlert className="h-4 w-4 text-red-600" />}
          accent="red"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-red-700" /> Aderência aos POPs (Terceiros)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-900 mb-1">{kpis.aderencia}%</div>
            <Progress value={kpis.aderencia} className="h-2 mb-3" />
            <div className="space-y-2 max-h-[280px] overflow-y-auto">
              {procsWithStats.length === 0 && (
                <div className="text-xs text-slate-500">Nenhum POP homologado para terceiros.</div>
              )}
              {procsWithStats.map((p: any) => (
                <div key={p.id} className="border rounded p-2">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <div className="font-mono text-slate-500">{p.codigo}</div>
                    <div className="font-bold">
                      {p.c}/{p.total} ({p.pct}%)
                    </div>
                  </div>
                  <div className="text-sm text-slate-800 mb-1">{p.titulo}</div>
                  <Progress value={p.pct} className="h-1.5" />
                </div>
              ))}
            </div>
            <div className="mt-3">
              <Link
                to="/app/sesmt/procedimentos"
                className="text-xs text-red-700 hover:underline font-medium"
              >
                → Gerenciar POPs
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="h-4 w-4 text-purple-700" /> Empresas Terceiras
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[340px] overflow-y-auto">
              {companies.map((c: any) => {
                const emps = empStatus.filter((e: any) => e.company_id === c.id);
                const aptos = emps.filter((e: any) => e.aso === "OK" && e.integracao).length;
                return (
                  <div key={c.id} className="border rounded p-2 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">{c.name}</div>
                      <div className="text-xs text-slate-500">{c.cnpj || "—"}</div>
                    </div>
                    <div className="text-right text-xs">
                      <div>
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                          {aptos}/{emps.length} APTOS
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
              {companies.length === 0 && (
                <div className="text-xs text-slate-500">Nenhuma empresa terceira cadastrada.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" /> Colaboradores Terceirizados Ativos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative mb-3">
            <Search className="h-4 w-4 absolute left-2 top-2.5 text-slate-400" />
            <Input
              className="pl-8"
              placeholder="Buscar colaborador…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="border rounded-md divide-y max-h-[420px] overflow-y-auto">
            {filteredEmps.map((e: any) => {
              const company = companies.find((c: any) => c.id === e.company_id);
              const blk = e.aso === "VENCIDO" || e.aso === "FALTA" || !e.integracao;
              const alert = e.aso === "ALERTA";
              return (
                <Link
                  to="/app/employees/$id"
                  params={{ id: e.id }}
                  key={e.id}
                  className="flex items-center justify-between p-2 hover:bg-slate-50"
                >
                  <div>
                    <div className="text-sm font-medium">{e.nome}</div>
                    <div className="text-xs text-slate-500">
                      {company?.name} · {e.setor || "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!e.integracao && (
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px]">
                        SEM INTEGRAÇÃO
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={
                        blk
                          ? "bg-red-100 text-red-800 border-red-200"
                          : alert
                            ? "bg-amber-100 text-amber-800 border-amber-200"
                            : "bg-emerald-100 text-emerald-800 border-emerald-200"
                      }
                    >
                      ASO: {e.aso}
                    </Badge>
                  </div>
                </Link>
              );
            })}
            {filteredEmps.length === 0 && (
              <div className="p-6 text-center text-sm text-slate-500">
                Nenhum colaborador encontrado.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent?: "emerald" | "amber" | "red";
}) {
  const cls =
    accent === "emerald"
      ? "text-emerald-700"
      : accent === "amber"
        ? "text-amber-700"
        : accent === "red"
          ? "text-red-700"
          : "text-slate-900";
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 uppercase tracking-wide">{label}</div>
            <div className={`text-2xl font-black ${cls}`}>{value}</div>
          </div>
          <div className="p-2 rounded-lg bg-slate-100">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}