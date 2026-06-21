import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, TrendingUp, Users, BookOpen, Activity, Target } from "lucide-react";
import { DDSTabsNav } from "@/components/dds-tabs-nav";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, Legend, Cell, ComposedChart,
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
  if (p >= 90) return "text-emerald-400";
  if (p >= 70) return "text-amber-300";
  return "text-red-400";
}
function adBg(p: number) {
  if (p === 0) return "bg-slate-700/60 text-slate-300";
  if (p >= 90) return "bg-emerald-500 text-white";
  if (p >= 70) return "bg-amber-400 text-slate-900";
  return "bg-red-500 text-white";
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
    const buckets = new Map<string, { semana: string; qtd: number; aderencia: number; n: number; esperados: number; presentes: number }>();
    for (const d of dds) {
      const date = new Date(d.data + "T00:00");
      const monday = new Date(date);
      monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
      const k = fmt(monday);
      const cur = buckets.get(k) ?? { semana: k.slice(5), qtd: 0, aderencia: 0, n: 0, esperados: 0, presentes: 0 };
      cur.qtd += 1;
      cur.aderencia += Number(d.aderencia || 0);
      cur.n += 1;
      cur.esperados += Number(d.participantes_esperados || 0);
      cur.presentes += Number(d.participantes_presentes || 0);
      buckets.set(k, cur);
    }
    return Array.from(buckets.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, v]) => ({
        semana: v.semana,
        esperados: v.esperados,
        presentes: v.presentes,
        aderencia: v.n > 0 ? Math.round(v.aderencia / v.n) : 0,
        meta: 90,
      }));
  }, [dds]);

  // Top temas: agrupado por CATEGORIA + CRITICIDADE (alcance = soma de presentes)
  const categoriaData = useMemo(() => {
    const m = new Map<string, { categoria: string; qtd: number; alcance: number }>();
    for (const d of dds) {
      const t = d.tema_id ? temaMap[d.tema_id] : null;
      const cat = t?.categoria || (d.tema_livre ? "LIVRE" : "—");
      const cur = m.get(cat) ?? { categoria: cat, qtd: 0, alcance: 0 };
      cur.qtd += 1;
      cur.alcance += Number(d.participantes_presentes || 0);
      m.set(cat, cur);
    }
    return Array.from(m.values()).sort((a, b) => b.qtd - a.qtd);
  }, [dds, temaMap]);

  const criticidadeData = useMemo(() => {
    const order = ["ALTA", "MEDIA", "MÉDIA", "BAIXA", "—"];
    const m = new Map<string, number>();
    for (const d of dds) {
      const t = d.tema_id ? temaMap[d.tema_id] : null;
      const c = (t?.criticidade || "—").toUpperCase();
      m.set(c, (m.get(c) ?? 0) + 1);
    }
    return Array.from(m.entries())
      .map(([criticidade, qtd]) => ({ criticidade, qtd }))
      .sort((a, b) => order.indexOf(a.criticidade) - order.indexOf(b.criticidade));
  }, [dds, temaMap]);

  const critColor = (c: string) =>
    c === "ALTA" ? "#f87171" : c === "MEDIA" || c === "MÉDIA" ? "#fbbf24" : c === "BAIXA" ? "#34d399" : "#94a3b8";

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <DDSTabsNav />
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
        <KPI icon={Activity}      label="DDS realizados"     value={total}                              hint={`em ${dias} dias`}                  accent="#22d3ee" />
        <KPI icon={Target}        label="Aderência média"    value={`${aderenciaMedia.toFixed(0)}%`}    accent={aderenciaMedia >= 90 ? "#10b981" : aderenciaMedia >= 70 ? "#fbbf24" : "#f43f5e"} />
        <KPI icon={Users}         label="Cobertura ativos"   value={`${cobertura.toFixed(0)}%`}         hint={`${empComDDS.size}/${employees.length}`} accent={cobertura >= 90 ? "#10b981" : cobertura >= 70 ? "#fbbf24" : "#f43f5e"} />
        <KPI icon={BookOpen}      label="Temas únicos"       value={temasUnicos}                        hint={`de ${temas.length}`}                accent="#818cf8" />
        <KPI icon={TrendingUp}    label="DDS / colaborador"  value={ddsPorColab.toFixed(1)}             hint="média no período"                    accent="#a78bfa" />
        <KPI icon={AlertTriangle} label="EPI: DDS x perdas"  value={`${ddsEPI} / ${perdasEPI}`}         hint="ações EPI vs perdas"                 accent={ddsEPI < perdasEPI ? "#f43f5e" : "#10b981"} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <AlertCard label="Sem DDS há 30+ dias" count={sem30} tone="amber" />
        <AlertCard label="Sem DDS há 60+ dias" count={sem60} tone="orange" />
        <AlertCard label="Sem DDS há 90+ dias" count={sem90} tone="red" />
      </div>

      <div className="bg-card text-card-foreground border rounded-lg p-4 shadow-sm">
        <div className="flex items-baseline justify-between mb-2">
          <div className="text-sm font-bold text-foreground">Tendência semanal — Participação vs Aderência</div>
          <div className="text-[11px] text-muted-foreground">Meta de aderência: 90%</div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" strokeOpacity={0.18} />
              <XAxis dataKey="semana" stroke="#cbd5e1" tick={{ fill: "#f1f5f9", fontSize: 12, fontWeight: 600 }} tickLine={{ stroke: "#cbd5e1" }} axisLine={{ stroke: "#cbd5e1" }} />
              <YAxis yAxisId="left" stroke="#cbd5e1" tick={{ fill: "#f1f5f9", fontSize: 12, fontWeight: 600 }} tickLine={{ stroke: "#cbd5e1" }} axisLine={{ stroke: "#cbd5e1" }} allowDecimals={false} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} stroke="#cbd5e1" tick={{ fill: "#f1f5f9", fontSize: 12, fontWeight: 600 }} tickLine={{ stroke: "#cbd5e1" }} axisLine={{ stroke: "#cbd5e1" }} />
              <Tooltip contentStyle={{ background: "#1a0a10", border: "1px solid #f87171", color: "#f1f5f9", borderRadius: 8, fontWeight: 600 }} labelStyle={{ color: "#f1f5f9" }} />
              <Legend wrapperStyle={{ color: "#f1f5f9", fontWeight: 600 }} />
              <Line yAxisId="left" type="monotone" dataKey="esperados" stroke="#94a3b8" name="Esperados" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3, fill: "#94a3b8" }} />
              <Line yAxisId="left" type="monotone" dataKey="presentes" stroke="#f87171" name="Presentes" strokeWidth={3} dot={{ r: 4, fill: "#f87171" }} activeDot={{ r: 6 }} />
              <Line yAxisId="right" type="monotone" dataKey="aderencia" stroke="#38bdf8" name="% Aderência" strokeWidth={3} dot={{ r: 4, fill: "#38bdf8" }} activeDot={{ r: 6 }} />
              <Line yAxisId="right" type="monotone" dataKey="meta" stroke="#fbbf24" name="Meta 90%" strokeWidth={2} strokeDasharray="6 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-card text-card-foreground border rounded-lg p-4 shadow-sm">
          <div className="flex items-baseline justify-between mb-2">
            <div className="text-sm font-bold text-foreground">Temas por Categoria</div>
            <div className="text-[11px] text-muted-foreground">qtd de DDS · alcance = presentes</div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoriaData} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" strokeOpacity={0.18} />
                <XAxis type="number" stroke="#cbd5e1" tick={{ fill: "#f1f5f9", fontSize: 12, fontWeight: 600 }} tickLine={{ stroke: "#cbd5e1" }} axisLine={{ stroke: "#cbd5e1" }} allowDecimals={false} />
                <YAxis type="category" dataKey="categoria" width={120} tick={{ fontSize: 11, fill: "#f1f5f9", fontWeight: 600 }} stroke="#cbd5e1" tickLine={{ stroke: "#cbd5e1" }} axisLine={{ stroke: "#cbd5e1" }} />
                <Tooltip contentStyle={{ background: "#1a0a10", border: "1px solid #f87171", color: "#f1f5f9", borderRadius: 8, fontWeight: 600 }} cursor={{ fill: "#f87171", opacity: 0.15 }} />
                <Legend wrapperStyle={{ color: "#f1f5f9", fontWeight: 600 }} />
                <Bar dataKey="qtd" name="DDS" fill="#f87171" radius={[0, 4, 4, 0]} />
                <Bar dataKey="alcance" name="Alcance" fill="#38bdf8" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {criticidadeData.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border/50">
              <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Distribuição por criticidade</div>
              <div className="flex flex-wrap gap-2">
                {criticidadeData.map((c) => (
                  <div key={c.criticidade} className="flex items-center gap-2 px-2 py-1 rounded border" style={{ borderColor: critColor(c.criticidade), background: `${critColor(c.criticidade)}1a` }}>
                    <div className="h-2 w-2 rounded-full" style={{ background: critColor(c.criticidade) }} />
                    <span className="text-xs font-bold text-foreground">{c.criticidade}</span>
                    <span className="text-xs font-mono text-foreground">{c.qtd}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-card text-card-foreground border rounded-lg p-4 shadow-sm">
          <div className="flex items-baseline justify-between mb-2">
            <div className="text-sm font-bold text-foreground">Aderência semanal × Meta</div>
            <div className="text-[11px] text-muted-foreground">Meta: 90% · Alerta: &lt;70%</div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" strokeOpacity={0.18} />
                <XAxis dataKey="semana" stroke="#cbd5e1" tick={{ fill: "#f1f5f9", fontSize: 12, fontWeight: 600 }} tickLine={{ stroke: "#cbd5e1" }} axisLine={{ stroke: "#cbd5e1" }} />
                <YAxis domain={[0, 100]} stroke="#cbd5e1" tick={{ fill: "#f1f5f9", fontSize: 12, fontWeight: 600 }} tickLine={{ stroke: "#cbd5e1" }} axisLine={{ stroke: "#cbd5e1" }} />
                <Tooltip contentStyle={{ background: "#1a0a10", border: "1px solid #f87171", color: "#f1f5f9", borderRadius: 8, fontWeight: 600 }} cursor={{ fill: "#f87171", opacity: 0.15 }} formatter={(v: any) => `${v}%`} />
                <Legend wrapperStyle={{ color: "#f1f5f9", fontWeight: 600 }} />
                <Bar dataKey="aderencia" name="Aderência %" radius={[4, 4, 0, 0]}>
                  {trendData.map((d, i) => (
                    <Cell key={i} fill={d.aderencia >= 90 ? "#34d399" : d.aderencia >= 70 ? "#fbbf24" : "#f87171"} />
                  ))}
                </Bar>
                <Line type="monotone" dataKey="meta" stroke="#38bdf8" strokeWidth={2} strokeDasharray="6 4" dot={false} name="Meta 90%" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-card text-card-foreground border rounded-lg overflow-hidden shadow-sm">
        <div className="px-4 py-2 border-b bg-muted/40 text-sm font-bold flex items-center justify-between text-foreground">
          <span>Funcionários ativos × tempo sem DDS</span>
          <span className="text-xs text-muted-foreground">{semDDS.length} colaboradores</span>
        </div>
        <div className="max-h-80 overflow-auto divide-y divide-border">
          {semDDS.slice(0, 100).map((s) => (
            <div key={s.id} className="grid grid-cols-12 px-4 py-1.5 text-sm items-center hover:bg-muted/30">
              <div className="col-span-7 truncate text-foreground">{s.nome}</div>
              <div className="col-span-3 text-xs text-muted-foreground">
                {s.ultima ? `Último: ${new Date(s.ultima + "T00:00").toLocaleDateString("pt-BR")}` : "Nunca"}
              </div>
              <div className="col-span-2 text-right">
                <Badge variant="outline" className={
                  s.dias >= 90 ? "border-red-500/50 text-red-300 bg-red-500/10"
                  : s.dias >= 60 ? "border-orange-500/50 text-orange-300 bg-orange-500/10"
                  : s.dias >= 30 ? "border-amber-500/50 text-amber-300 bg-amber-500/10"
                  : "border-emerald-500/50 text-emerald-300 bg-emerald-500/10"
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

function KPI({ icon: Icon, label, value, hint, accent = "#22d3ee" }: { icon: any; label: string; value: string | number; hint?: string; accent?: string }) {
  return (
    <div
      className="relative rounded-2xl p-[1.5px] overflow-hidden flex group"
      style={{
        background: `linear-gradient(135deg, ${accent}CC 0%, ${accent}66 50%, ${accent}CC 100%)`,
        boxShadow:
          `0 0 0 1px ${accent}80, ` +
          `0 0 14px ${accent}66, ` +
          `0 0 28px ${accent}33, ` +
          `0 16px 40px -22px ${accent}55`,
      }}
    >
      <div className="relative rounded-2xl overflow-hidden flex items-center gap-2.5 p-3 w-full" style={{ background: "#0a0f1f" }}>
        {/* TOP edge flare */}
        <div aria-hidden className="pointer-events-none absolute -top-3 left-[22%] h-5 w-24 rounded-full"
          style={{ background: `radial-gradient(ellipse at center, ${accent}CC 0%, ${accent}66 45%, ${accent}00 80%)`, filter: "blur(6px)", mixBlendMode: "screen" }} />
        <div aria-hidden className="pointer-events-none absolute -top-[1px] left-[28%] h-[1.5px] w-16 rounded-full"
          style={{ background: `linear-gradient(90deg, ${accent}00 0%, ${accent} 50%, ${accent}00 100%)`, filter: "blur(1px)" }} />
        {/* BOTTOM edge flare */}
        <div aria-hidden className="pointer-events-none absolute -bottom-3 right-[22%] h-4 w-20 rounded-full"
          style={{ background: `radial-gradient(ellipse at center, ${accent}99 0%, ${accent}40 45%, ${accent}00 80%)`, filter: "blur(6px)", mixBlendMode: "screen" }} />
        {/* LEFT / RIGHT edge flares */}
        <div aria-hidden className="pointer-events-none absolute top-[40%] -left-2 h-8 w-3 rounded-full"
          style={{ background: `radial-gradient(ellipse at center, ${accent}99 0%, ${accent}33 45%, ${accent}00 80%)`, filter: "blur(5px)", mixBlendMode: "screen" }} />
        <div aria-hidden className="pointer-events-none absolute top-[40%] -right-2 h-8 w-3 rounded-full"
          style={{ background: `radial-gradient(ellipse at center, ${accent}99 0%, ${accent}33 45%, ${accent}00 80%)`, filter: "blur(5px)", mixBlendMode: "screen" }} />
        {/* inner ring sutil */}
        <div aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{ boxShadow: `inset 0 0 0 1px ${accent}26, inset 0 0 14px -6px ${accent}33` }} />

        <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 relative z-10"
          style={{ background: `${accent}1A`, color: accent, boxShadow: `inset 0 0 0 1px ${accent}33` }}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="relative z-10 min-w-0 flex-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400 truncate">{label}</div>
          <div className="text-2xl font-black leading-none mt-0.5 tabular-nums" style={{ color: accent }}>{value}</div>
          {hint && <div className="text-[10px] text-slate-500 mt-0.5 truncate">{hint}</div>}
        </div>
      </div>
    </div>
  );
}

function AlertCard({ label, count, tone }: { label: string; count: number; tone: "amber" | "orange" | "red" }) {
  const cls = tone === "red" ? "border-red-500/60 bg-red-500/10 text-red-300"
    : tone === "orange" ? "border-orange-500/60 bg-orange-500/10 text-orange-300"
    : "border-amber-500/60 bg-amber-500/10 text-amber-300";
  return (
    <div className={`border-2 rounded-lg p-3 flex items-center gap-3 ${cls} shadow-sm`}>
      <AlertTriangle className="h-6 w-6" />
      <div className="flex-1">
        <div className="text-xs font-bold uppercase tracking-wide">{label}</div>
        <div className="text-3xl font-black">{count}</div>
      </div>
    </div>
  );
}