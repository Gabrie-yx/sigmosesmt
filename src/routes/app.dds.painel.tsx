import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, AlertTriangle, TrendingUp, Users, BookOpen, Activity, Target } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, Legend,
} from "recharts";

export const Route = createFileRoute("/app/dds/painel")({
  component: DDSPainelPage,
});

type DDS = {
  id: string; data: string; setor: string | null; gestor_id: string | null;
  tema_id: string | null; tema_livre: string | null;
  participantes_esperados: number; participantes_presentes: number; aderencia: number;
};
type Tema = { id: string; titulo: string; categoria: string; criticidade: string };
type Attendee = { dds_id: string; employee_id: string; status: string };

const dayMs = 86400000;
const fmt = (d: Date) => d.toISOString().slice(0, 10);
const today = new Date();

function adColor(p: number) {
  if (p >= 90) return "text-emerald-600";
  if (p >= 70) return "text-amber-600";
  return "text-red-600";
}
function adBg(p: number) {
  if (p === 0) return "bg-slate-100";
  if (p >= 90) return "bg-emerald-500";
  if (p >= 70) return "bg-amber-400";
  return "bg-red-500";
}

function DDSPainelPage() {
  const [periodo, setPeriodo] = useState<"30" | "60" | "90">("30");
  const dias = Number(periodo);
  const since = fmt(new Date(today.getTime() - dias * dayMs));

  const { data: dds = [] } = useQuery({
    queryKey: ["dds-painel", since],
    queryFn: async () => (await supabase.from("dds").select("*").gte("data", since).order("data")).data as DDS[] ?? [],
  });
  const { data: temas = [] } = useQuery({
    queryKey: ["dds-temas-all"],
    queryFn: async () => (await supabase.from("dds_temas").select("id,titulo,categoria,criticidade")).data as Tema[] ?? [],
  });
  const { data: attendees = [] } = useQuery({
    queryKey: ["dds-att-painel", since, dds.length],
    queryFn: async () => {
      const ids = dds.map((d) => d.id);
      if (ids.length === 0) return [] as Attendee[];
      const { data } = await supabase.from("dds_attendees").select("dds_id,employee_id,status").in("dds_id", ids);
      return (data ?? []) as Attendee[];
    },
    enabled: dds.length > 0,
  });
  const { data: employees = [] } = useQuery({
    queryKey: ["employees-active-dds"],
    queryFn: async () => (await supabase.from("employees").select("id,nome,company_id").eq("status", "ATIVO")).data ?? [],
  });
  const { data: epiPerdas = [] } = useQuery({
    queryKey: ["epi-perdas-painel", since],
    queryFn: async () => (await supabase.from("epi_deliveries").select("id,data_entrega,motivo_entrega").eq("motivo_entrega", "PERDA_EXTRAVIO").gte("data_entrega", since)).data ?? [],
  });

  const temaMap = useMemo(() => Object.fromEntries(temas.map((t) => [t.id, t])), [temas]);

  const total = dds.length;
  const aderenciaMedia = total > 0 ? dds.reduce((s, d) => s + Number(d.aderencia || 0), 0) / total : 0;
  const empComDDS = new Set(attendees.filter((a) => a.status === "PRESENTE").map((a) => a.employee_id));
  const cobertura = employees.length > 0 ? (empComDDS.size / employees.length) * 100 : 0;
  const temasUnicos = new Set(dds.map((d) => d.tema_id).filter(Boolean)).size;
  const ddsPorColab = empComDDS.size > 0 ? attendees.filter((a) => a.status === "PRESENTE").length / empComDDS.size : 0;

  const ultDDSporEmp = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of attendees) {
      if (a.status !== "PRESENTE") continue;
      const d = dds.find((x) => x.id === a.dds_id);
      if (!d) continue;
      const cur = map.get(a.employee_id);
      if (!cur || d.data > cur) map.set(a.employee_id, d.data);
    }
    return map;
  }, [attendees, dds]);

  const semDDS = useMemo(() => {
    const out: { id: string; nome: string; ultima: string | null; dias: number }[] = [];
    for (const e of employees) {
      const u = ultDDSporEmp.get(e.id) ?? null;
      const diasSem = u ? Math.floor((today.getTime() - new Date(u + "T00:00").getTime()) / dayMs) : 9999;
      out.push({ id: e.id, nome: e.nome, ultima: u, dias: diasSem });
    }
    return out.sort((a, b) => b.dias - a.dias);
  }, [employees, ultDDSporEmp]);

  const sem30 = semDDS.filter((s) => s.dias >= 30).length;
  const sem60 = semDDS.filter((s) => s.dias >= 60).length;
  const sem90 = semDDS.filter((s) => s.dias >= 90).length;

  const isTemaEPI = (id: string | null) => {
    if (!id) return false;
    const t = temaMap[id];
    return !!t && /EPI|PROTE|EQUIPAMENTO/i.test(t.titulo);
  };
  const ddsEPI = dds.filter((d) => isTemaEPI(d.tema_id)).length;
  const perdasEPI = epiPerdas.length;

  const temaCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of dds) {
      const k = d.tema_id ? (temaMap[d.tema_id]?.titulo ?? "—") : (d.tema_livre ?? "—");
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return Array.from(m.entries()).map(([titulo, qtd]) => ({ titulo, qtd })).sort((a, b) => b.qtd - a.qtd).slice(0, 8);
  }, [dds, temaMap]);

  const trendData = useMemo(() => {
    const buckets = new Map<string, { semana: string; qtd: number; aderencia: number; n: number }>();
    for (const d of dds) {
      const date = new Date(d.data + "T00:00");
      const monday = new Date(date);
      monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
      const k = fmt(monday);
      const cur = buckets.get(k) ?? { semana: k.slice(5), qtd: 0, aderencia: 0, n: 0 };
      cur.qtd += 1; cur.aderencia += Number(d.aderencia || 0); cur.n += 1;
      buckets.set(k, cur);
    }
    return Array.from(buckets.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, v]) => ({ semana: v.semana, qtd: v.qtd, aderencia: v.n > 0 ? Math.round(v.aderencia / v.n) : 0 }));
  }, [dds]);

  const setores = useMemo(() => Array.from(new Set(dds.map((d) => d.setor).filter(Boolean) as string[])).sort(), [dds]);
  const semanas = useMemo(() => Array.from(new Set(trendData.map((t) => t.semana))), [trendData]);
  const heatmap = useMemo(() => {
    const m = new Map<string, { qtd: number; ad: number; n: number }>();
    for (const d of dds) {
      if (!d.setor) continue;
      const date = new Date(d.data + "T00:00");
      const monday = new Date(date);
      monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
      const k = `${d.setor}|${fmt(monday).slice(5)}`;
      const cur = m.get(k) ?? { qtd: 0, ad: 0, n: 0 };
      cur.qtd += 1; cur.ad += Number(d.aderencia || 0); cur.n += 1;
      m.set(k, cur);
    }
    return m;
  }, [dds]);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm"><Link to="/app/dds"><ArrowLeft className="h-4 w-4 mr-1" />DDS</Link></Button>
        <h1 className="text-xl md:text-2xl font-bold flex-1">Painel de Qualidade — DDS</h1>
        <Select value={periodo} onValueChange={(v) => setPeriodo(v as any)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="60">Últimos 60 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPI icon={Activity} label="DDS realizados" value={total} hint={`em ${dias} dias`} />
        <KPI icon={Target} label="Aderência média" value={`${aderenciaMedia.toFixed(0)}%`} valueCls={adColor(aderenciaMedia)} />
        <KPI icon={Users} label="Cobertura ativos" value={`${cobertura.toFixed(0)}%`} hint={`${empComDDS.size}/${employees.length}`} valueCls={adColor(cobertura)} />
        <KPI icon={BookOpen} label="Temas únicos" value={temasUnicos} hint={`de ${temas.length}`} />
        <KPI icon={TrendingUp} label="DDS / colaborador" value={ddsPorColab.toFixed(1)} hint="média no período" />
        <KPI icon={AlertTriangle} label="EPI: DDS x perdas" value={`${ddsEPI} / ${perdasEPI}`} hint="ações EPI vs perdas" valueCls={ddsEPI < perdasEPI ? "text-red-600" : "text-emerald-600"} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <AlertCard label="Sem DDS há 30+ dias" count={sem30} tone="amber" />
        <AlertCard label="Sem DDS há 60+ dias" count={sem60} tone="orange" />
        <AlertCard label="Sem DDS há 90+ dias" count={sem90} tone="red" />
      </div>

      <div className="bg-white border rounded-lg p-4">
        <div className="text-sm font-bold mb-2">Tendência semanal</div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="semana" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="qtd" stroke="#C8102E" name="Qtd DDS" strokeWidth={2} />
              <Line yAxisId="right" type="monotone" dataKey="aderencia" stroke="#64748b" name="% Aderência" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-white border rounded-lg p-4">
          <div className="text-sm font-bold mb-2">Top temas no período</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={temaCount} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="titulo" width={140} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="qtd" fill="#a01818" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border rounded-lg p-4 overflow-auto">
          <div className="text-sm font-bold mb-2">Heatmap Setor × Semana</div>
          {setores.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Sem dados de setor</div>
          ) : (
            <table className="text-xs border-collapse">
              <thead>
                <tr>
                  <th className="px-2 py-1 text-left font-bold sticky left-0 bg-white">Setor</th>
                  {semanas.map((s) => <th key={s} className="px-1 py-1 font-mono">{s}</th>)}
                </tr>
              </thead>
              <tbody>
                {setores.map((sec) => (
                  <tr key={sec}>
                    <td className="px-2 py-1 font-semibold sticky left-0 bg-white">{sec}</td>
                    {semanas.map((s) => {
                      const cell = heatmap.get(`${sec}|${s}`);
                      const ad = cell && cell.n > 0 ? cell.ad / cell.n : 0;
                      return (
                        <td key={s} className="p-0.5">
                          <div
                            title={cell ? `${cell.qtd} DDS · ${ad.toFixed(0)}%` : "Sem DDS"}
                            className={`h-7 w-9 rounded text-white text-[10px] font-bold flex items-center justify-center ${adBg(ad)}`}
                          >
                            {cell?.qtd ?? ""}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="px-4 py-2 border-b bg-slate-50 text-sm font-bold flex items-center justify-between">
          <span>Funcionários ativos × tempo sem DDS</span>
          <span className="text-xs text-muted-foreground">{semDDS.length} colaboradores</span>
        </div>
        <div className="max-h-80 overflow-auto divide-y">
          {semDDS.slice(0, 100).map((s) => (
            <div key={s.id} className="grid grid-cols-12 px-4 py-1.5 text-sm items-center">
              <div className="col-span-7 truncate">{s.nome}</div>
              <div className="col-span-3 text-xs text-muted-foreground">
                {s.ultima ? `Último: ${new Date(s.ultima + "T00:00").toLocaleDateString("pt-BR")}` : "Nunca"}
              </div>
              <div className="col-span-2 text-right">
                <Badge variant="outline" className={
                  s.dias >= 90 ? "border-red-300 text-red-700 bg-red-50"
                  : s.dias >= 60 ? "border-orange-300 text-orange-700 bg-orange-50"
                  : s.dias >= 30 ? "border-amber-300 text-amber-700 bg-amber-50"
                  : "border-emerald-300 text-emerald-700 bg-emerald-50"
                }>
                  {s.ultima ? `${s.dias}d` : "nunca"}
                </Badge>
              </div>
            </div>
          ))}
          {semDDS.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">Nenhum funcionário ativo</div>}
        </div>
      </div>
    </div>
  );
}

function KPI({ icon: Icon, label, value, hint, valueCls }: { icon: any; label: string; value: string | number; hint?: string; valueCls?: string }) {
  return (
    <div className="bg-white border rounded-lg p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
        <Icon className="h-3 w-3" />{label}
      </div>
      <div className={`text-2xl font-bold mt-1 ${valueCls ?? ""}`}>{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function AlertCard({ label, count, tone }: { label: string; count: number; tone: "amber" | "orange" | "red" }) {
  const cls = tone === "red" ? "border-red-300 bg-red-50 text-red-800"
    : tone === "orange" ? "border-orange-300 bg-orange-50 text-orange-800"
    : "border-amber-300 bg-amber-50 text-amber-800";
  return (
    <div className={`border-2 rounded-lg p-3 flex items-center gap-3 ${cls}`}>
      <AlertTriangle className="h-6 w-6" />
      <div className="flex-1">
        <div className="text-xs font-bold uppercase tracking-wide">{label}</div>
        <div className="text-2xl font-black">{count}</div>
      </div>
    </div>
  );
}