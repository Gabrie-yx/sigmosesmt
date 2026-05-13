import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Search, AlertTriangle, Building2, Ban, Users, ShieldCheck, Package,
  HardHat, FileWarning, Activity, TrendingUp, Boxes, ClipboardCheck,
  ArrowUpRight, Stethoscope, GripVertical, RotateCcw, Lock, Unlock,
} from "lucide-react";
import { calculateSafetyStatus } from "@/lib/safety-engine";
import { type SafetyOverride } from "@/lib/safety-overrides";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  AreaChart, Area, PieChart, Pie, Cell, Legend,
} from "recharts";
import GridLayout, { WidthProvider, type Layout } from "react-grid-layout";

const ResponsiveGridLayout = WidthProvider(GridLayout);

export const Route = createFileRoute("/app/painel")({
  component: TstPanel,
});

const dayMs = 86400000;
const today = new Date();
const fmt = (d: Date) => d.toISOString().slice(0, 10);
const MONTHS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const LS_KEY = "sesmt-painel-layout-v1";
const DEFAULT_LAYOUT: Layout[] = [
  { i: "kpis",        x: 0, y: 0,  w: 12, h: 4,  minH: 3, minW: 6 },
  { i: "search",      x: 0, y: 4,  w: 8,  h: 5,  minH: 4, minW: 4 },
  { i: "health",      x: 8, y: 4,  w: 4,  h: 5,  minH: 4, minW: 3 },
  { i: "status-pie",  x: 0, y: 9,  w: 4,  h: 7,  minH: 5, minW: 3 },
  { i: "epi-mensal",  x: 4, y: 9,  w: 8,  h: 7,  minH: 5, minW: 4 },
  { i: "top-itens",   x: 0, y: 16, w: 8,  h: 8,  minH: 5, minW: 4 },
  { i: "top-recip",   x: 8, y: 16, w: 4,  h: 8,  minH: 5, minW: 3 },
  { i: "dds-trend",   x: 0, y: 24, w: 6,  h: 7,  minH: 5, minW: 4 },
  { i: "conformidade",x: 6, y: 24, w: 6,  h: 7,  minH: 5, minW: 4 },
  { i: "pendencias",  x: 0, y: 31, w: 12, h: 9,  minH: 5, minW: 6 },
  { i: "footer",      x: 0, y: 40, w: 12, h: 3,  minH: 2, minW: 6 },
];

function loadLayout(): Layout[] {
  if (typeof window === "undefined") return DEFAULT_LAYOUT;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw) as Layout[];
    // ensure all widgets exist (merge new ones from defaults)
    const ids = new Set(parsed.map((p) => p.i));
    const missing = DEFAULT_LAYOUT.filter((d) => !ids.has(d.i));
    return [...parsed, ...missing];
  } catch {
    return DEFAULT_LAYOUT;
  }
}

function TstPanel() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [filterCompany, setFilterCompany] = useState("ALL");
  const [periodo, setPeriodo] = useState<"30" | "60" | "90" | "180">("90");
  const [layout, setLayout] = useState<Layout[]>(() => loadLayout());
  const [locked, setLocked] = useState(false);
  const initial = useRef(true);

  useEffect(() => {
    if (initial.current) { initial.current = false; return; }
    try { localStorage.setItem(LS_KEY, JSON.stringify(layout)); } catch {}
  }, [layout]);

  const dias = Number(periodo);
  const since = fmt(new Date(today.getTime() - dias * dayMs));

  const { data } = useQuery({
    queryKey: ["sesmt-painel", since],
    queryFn: async () => {
      const [emps, comps, roles, exams, overrides, deliveries, estoque, dds, ddsAtt, aprs, ptes, docs] = await Promise.all([
        supabase.from("employees").select("*").order("nome"),
        supabase.from("companies").select("id,name").order("name"),
        supabase.from("roles").select("*"),
        supabase.from("employee_exams").select("*"),
        supabase.from("safety_overrides").select("*").eq("ativo", true),
        supabase.from("epi_deliveries").select("id,employee_id,item,qtd,data_entrega,motivo_entrega,valor_unitario").gte("data_entrega", since),
        supabase.from("estoque_epi").select("id,nome_material,quantidade_atual,estoque_minimo,ca_validade"),
        supabase.from("dds").select("id,data,aderencia,participantes_presentes,participantes_esperados").gte("data", since),
        supabase.from("dds_attendees").select("dds_id,employee_id,status"),
        supabase.from("aprs").select("id,status,data_emissao,data_validade").gte("data_emissao", since),
        supabase.from("ptes").select("id,status,data,risco").gte("data", since),
        supabase.from("employee_docs").select("id,employee_id,tipo"),
      ]);
      return {
        employees: emps.data ?? [],
        companies: comps.data ?? [],
        roles: roles.data ?? [],
        exams: exams.data ?? [],
        overrides: (overrides.data ?? []) as SafetyOverride[],
        deliveries: deliveries.data ?? [],
        estoque: estoque.data ?? [],
        dds: dds.data ?? [],
        ddsAtt: ddsAtt.data ?? [],
        aprs: aprs.data ?? [],
        ptes: ptes.data ?? [],
        docs: docs.data ?? [],
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
    const ovMap = new Map<string, SafetyOverride[]>();
    data.overrides.forEach((o) => {
      const arr = ovMap.get(o.employee_id) ?? [];
      arr.push(o);
      ovMap.set(o.employee_id, arr);
    });
    return data.employees.map((e: any) => ({
      emp: e,
      company: e.company_id ? cMap.get(e.company_id) ?? "—" : "—",
      role: e.role_id ? rMap.get(e.role_id) : null,
      status: calculateSafetyStatus(e, e.role_id ? (rMap.get(e.role_id) as any) : null, exMap.get(e.id) ?? [], [], ovMap.get(e.id) ?? []),
    }));
  }, [data]);

  const totalEmp = rows.length;
  const aptos = rows.filter((r) => r.status.label === "APTO").length;
  const alertas = rows.filter((r) => r.status.label === "ALERTA").length;
  const bloqueados = rows.filter((r) => r.status.label === "BLOQUEADO" || r.status.label === "SEM CARGO").length;
  const conformidadeGeral = totalEmp > 0 ? Math.round((aptos / totalEmp) * 100) : 0;

  const totalEntregas = (data?.deliveries ?? []).reduce((s, d: any) => s + Number(d.qtd || 0), 0);
  const valorEntregas = (data?.deliveries ?? []).reduce((s, d: any) => s + Number(d.qtd || 0) * Number(d.valor_unitario || 0), 0);
  const perdas = (data?.deliveries ?? []).filter((d: any) => d.motivo_entrega === "PERDA_EXTRAVIO").length;

  const estoqueTotal = (data?.estoque ?? []).reduce((s: number, e: any) => s + Number(e.quantidade_atual || 0), 0);
  const estoqueBaixo = (data?.estoque ?? []).filter((e: any) => Number(e.quantidade_atual || 0) <= Number(e.estoque_minimo || 0)).length;
  const caVencendo = (data?.estoque ?? []).filter((e: any) => {
    if (!e.ca_validade) return false;
    const d = new Date(e.ca_validade + "T00:00").getTime();
    return d - today.getTime() < 60 * dayMs;
  }).length;

  const asoVencendo30 = (data?.exams ?? []).filter((ex: any) => {
    if (!ex.data_vencimento) return false;
    const diff = (new Date(ex.data_vencimento + "T00:00").getTime() - today.getTime()) / dayMs;
    return diff >= 0 && diff <= 30;
  }).length;
  const asoVencidos = (data?.exams ?? []).filter((ex: any) => {
    if (!ex.data_vencimento) return false;
    return new Date(ex.data_vencimento + "T00:00").getTime() < today.getTime();
  }).length;

  const aprsAtivas = (data?.aprs ?? []).filter((a: any) => a.status !== "CANCELADA" && a.status !== "ENCERRADA").length;
  const ptesAtivas = (data?.ptes ?? []).filter((p: any) => p.status !== "CANCELADA" && p.status !== "ENCERRADA").length;

  const ddsCount = (data?.dds ?? []).length;
  const ddsAderencia = ddsCount > 0
    ? Math.round((data!.dds.reduce((s: number, d: any) => s + Number(d.aderencia || 0), 0) / ddsCount))
    : 0;

  const statusPie = [
    { name: "Aptos", value: aptos, color: "#10b981" },
    { name: "Alerta", value: alertas, color: "#f59e0b" },
    { name: "Bloqueados", value: bloqueados, color: "#ef4444" },
  ].filter((x) => x.value > 0);

  const topItens = useMemo(() => {
    const m = new Map<string, number>();
    (data?.deliveries ?? []).forEach((d: any) => {
      m.set(d.item, (m.get(d.item) ?? 0) + Number(d.qtd || 0));
    });
    return Array.from(m.entries())
      .map(([item, qtd]) => ({ item: item.length > 28 ? item.slice(0, 26) + "…" : item, qtd }))
      .sort((a, b) => b.qtd - a.qtd).slice(0, 8);
  }, [data]);

  const entregaMensal = useMemo(() => {
    const m = new Map<string, { mes: string; qtd: number; valor: number }>();
    (data?.deliveries ?? []).forEach((d: any) => {
      const dt = new Date(d.data_entrega + "T00:00");
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      const label = `${MONTHS_PT[dt.getMonth()]}/${String(dt.getFullYear()).slice(2)}`;
      const cur = m.get(key) ?? { mes: label, qtd: 0, valor: 0 };
      cur.qtd += Number(d.qtd || 0);
      cur.valor += Number(d.qtd || 0) * Number(d.valor_unitario || 0);
      m.set(key, cur);
    });
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);
  }, [data]);

  const topRecip = useMemo(() => {
    const m = new Map<string, number>();
    (data?.deliveries ?? []).forEach((d: any) => {
      m.set(d.employee_id, (m.get(d.employee_id) ?? 0) + Number(d.qtd || 0));
    });
    const empMap = new Map((data?.employees ?? []).map((e: any) => [e.id, e.nome]));
    return Array.from(m.entries())
      .map(([id, qtd]) => ({ nome: (empMap.get(id) ?? "—") as string, qtd }))
      .sort((a, b) => b.qtd - a.qtd).slice(0, 5);
  }, [data]);

  const ddsTrend = useMemo(() => {
    const m = new Map<string, { mes: string; qtd: number; ad: number; n: number }>();
    (data?.dds ?? []).forEach((d: any) => {
      const dt = new Date(d.data + "T00:00");
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      const label = `${MONTHS_PT[dt.getMonth()]}/${String(dt.getFullYear()).slice(2)}`;
      const cur = m.get(key) ?? { mes: label, qtd: 0, ad: 0, n: 0 };
      cur.qtd += 1; cur.ad += Number(d.aderencia || 0); cur.n += 1;
      m.set(key, cur);
    });
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => ({
      mes: v.mes, qtd: v.qtd, aderencia: v.n > 0 ? Math.round(v.ad / v.n) : 0,
    }));
  }, [data]);

  const pendencias = useMemo(() => {
    let list = rows.filter((r) => r.status.label === "ALERTA" || r.status.label === "BLOQUEADO" || r.status.label === "SEM CARGO");
    if (filterCompany !== "ALL") list = list.filter((r) => r.emp.company_id === filterCompany);
    return list;
  }, [rows, filterCompany]);

  const conformity = useMemo(() => {
    if (!data) return [];
    return data.companies.map((c: any) => {
      const compEmps = rows.filter((r) => r.emp.company_id === c.id);
      const total = compEmps.length;
      if (total === 0) return null;
      const oks = compEmps.filter((r) => r.status.label === "APTO").length;
      const perc = Math.round((oks / total) * 100);
      const color = perc === 100 ? "from-emerald-500 to-emerald-600"
        : perc > 80 ? "from-amber-400 to-amber-500"
        : "from-red-500 to-red-600";
      return { name: c.name, perc, color, total, oks };
    }).filter(Boolean) as { name: string; perc: number; color: string; total: number; oks: number }[];
  }, [data, rows]);

  const search = q.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!search) return [];
    return rows.filter((r) =>
      (r.emp.nome ?? "").toLowerCase().includes(search) ||
      (r.emp.cpf ?? "").toLowerCase().includes(search) ||
      (r.role?.name ?? "").toLowerCase().includes(search) ||
      (r.company ?? "").toLowerCase().includes(search),
    ).slice(0, 8);
  }, [rows, search]);

  // --- WIDGETS ---
  const widgets: Record<string, { title: string; icon: any; render: () => React.ReactNode; accent?: "amber" | "red" }> = {
    kpis: {
      title: "Indicadores principais", icon: Activity,
      render: () => (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 h-full content-start">
          <KpiTile icon={Users} label="Colaboradores" value={totalEmp} hint="ativos no sistema" tone="dark" />
          <KpiTile icon={ShieldCheck} label="Conformidade" value={`${conformidadeGeral}%`} hint={`${aptos} aptos`} tone={conformidadeGeral >= 90 ? "green" : conformidadeGeral >= 70 ? "amber" : "red"} />
          <KpiTile icon={Stethoscope} label="ASOs vencendo" value={asoVencendo30} hint={`${asoVencidos} vencidos`} tone={asoVencidos > 0 ? "red" : "amber"} />
          <KpiTile icon={Package} label="EPIs em estoque" value={estoqueTotal} hint={`${estoqueBaixo} baixo`} tone="dark" />
          <KpiTile icon={HardHat} label="EPIs entregues" value={totalEntregas} hint={`R$ ${valorEntregas.toFixed(0)}`} tone="teal" />
          <KpiTile icon={ClipboardCheck} label="DDS no período" value={ddsCount} hint={`${ddsAderencia}% aderência`} tone="teal" />
          <KpiTile icon={FileWarning} label="APRs · PTEs" value={`${aprsAtivas} · ${ptesAtivas}`} hint="abertos" tone="dark" />
        </div>
      ),
    },
    search: {
      title: "Busca universal", icon: Search,
      render: () => (
        <>
          <input
            type="text"
            placeholder="Nome, CPF, função técnica ou empresa..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#0f766e]/30 focus:border-[#0f766e] transition-all placeholder:text-slate-400 placeholder:font-normal"
          />
          {search && (
            <div className="mt-3 space-y-1.5 max-h-64 overflow-y-auto">
              {searchResults.length === 0 ? (
                <div className="text-center text-slate-400 py-3 text-xs font-bold uppercase">Nenhum resultado</div>
              ) : searchResults.map((r) => (
                <Link key={r.emp.id} to="/app/employees/$id" params={{ id: r.emp.id }}
                  className="flex items-center justify-between p-3 border border-slate-100 rounded-lg bg-slate-50 hover:border-[#0f766e] hover:bg-white transition-all">
                  <div className="min-w-0">
                    <div className="text-xs font-black uppercase text-slate-900 truncate">{r.emp.nome}</div>
                    <div className="text-[9px] font-bold uppercase text-slate-500 mt-0.5 truncate">{r.company} · {r.role?.name ?? "Sem cargo"}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${r.status.colorClass} text-white shrink-0 ml-2`}>{r.status.label}</span>
                </Link>
              ))}
            </div>
          )}
        </>
      ),
    },
    health: {
      title: "Saúde do SESMT", icon: ShieldCheck,
      render: () => (
        <div className="bg-gradient-to-br from-[#0f766e] to-[#134e4a] -m-2 p-4 rounded-xl text-white h-full flex flex-col justify-between">
          <div>
            <div className="text-4xl font-black leading-none">{conformidadeGeral}<span className="text-xl opacity-70">%</span></div>
            <div className="text-[10px] uppercase tracking-wide opacity-80 mt-1">conformidade geral</div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4 text-center">
            <div className="bg-white/10 rounded-lg p-2"><div className="text-lg font-black">{aptos}</div><div className="text-[8px] font-bold uppercase opacity-80">Aptos</div></div>
            <div className="bg-white/10 rounded-lg p-2"><div className="text-lg font-black">{alertas}</div><div className="text-[8px] font-bold uppercase opacity-80">Alerta</div></div>
            <div className="bg-white/10 rounded-lg p-2"><div className="text-lg font-black">{bloqueados}</div><div className="text-[8px] font-bold uppercase opacity-80">Bloq.</div></div>
          </div>
        </div>
      ),
    },
    "status-pie": {
      title: "Status dos colaboradores", icon: Activity,
      render: () => (
        <div className="h-full min-h-0">
          {statusPie.length === 0 ? <Empty /> : (
            <ResponsiveContainer>
              <PieChart>
                <Pie data={statusPie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>
                  {statusPie.map((s) => <Cell key={s.name} fill={s.color} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      ),
    },
    "epi-mensal": {
      title: "EPIs entregues / mês", icon: TrendingUp,
      render: () => (
        <div className="h-full min-h-0">
          {entregaMensal.length === 0 ? <Empty /> : (
            <ResponsiveContainer>
              <AreaChart data={entregaMensal}>
                <defs>
                  <linearGradient id="entg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0f766e" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#0f766e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Area type="monotone" dataKey="qtd" stroke="#0f766e" strokeWidth={2.5} fill="url(#entg)" name="Qtd" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      ),
    },
    "top-itens": {
      title: "Top equipamentos entregues", icon: Boxes,
      render: () => (
        <div className="h-full min-h-0">
          {topItens.length === 0 ? <Empty /> : (
            <ResponsiveContainer>
              <BarChart data={topItens} layout="vertical" margin={{ left: 90 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="item" width={150} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="qtd" fill="#0f766e" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      ),
    },
    "top-recip": {
      title: "Top recebedores de EPI", icon: HardHat,
      render: () => (
        <div className="space-y-2.5 overflow-auto h-full">
          {topRecip.length === 0 ? <Empty /> : topRecip.map((r, i) => {
            const max = topRecip[0].qtd || 1;
            const perc = (r.qtd / max) * 100;
            return (
              <div key={r.nome + i}>
                <div className="flex items-center justify-between text-[10px] font-bold mb-1">
                  <span className="truncate text-slate-700">{r.nome}</span>
                  <span className="text-[#0f766e] font-black">{r.qtd}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#0f766e] to-[#14b8a6]" style={{ width: `${perc}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      ),
    },
    "dds-trend": {
      title: "DDS · evolução & aderência", icon: ClipboardCheck,
      render: () => (
        <div className="h-full min-h-0">
          {ddsTrend.length === 0 ? <Empty /> : (
            <ResponsiveContainer>
              <BarChart data={ddsTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="l" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="r" orientation="right" domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="l" dataKey="qtd" fill="#0f766e" name="DDS realizados" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="r" dataKey="aderencia" fill="#14b8a6" name="% aderência" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      ),
    },
    conformidade: {
      title: "Conformidade por empresa", icon: Building2,
      render: () => (
        <div className="space-y-3 overflow-y-auto pr-1 h-full">
          {conformity.length === 0 && <Empty />}
          {conformity.map((c) => (
            <div key={c.name}>
              <div className="flex justify-between text-[10px] font-black uppercase text-slate-600 mb-1">
                <span className="truncate">{c.name}</span>
                <span>{c.oks}/{c.total} · {c.perc}%</span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div className={`h-full bg-gradient-to-r ${c.color}`} style={{ width: `${c.perc}%` }} />
              </div>
            </div>
          ))}
        </div>
      ),
    },
    pendencias: {
      title: "Vencimentos & pendências", icon: AlertTriangle, accent: "amber",
      render: () => (
        <div className="h-full flex flex-col min-h-0">
          <div className="mb-2">
            <select
              value={filterCompany}
              onChange={(e) => setFilterCompany(e.target.value)}
              onMouseDown={(e) => e.stopPropagation()}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase outline-none focus:ring-2 focus:border-[#0f766e] max-w-[240px] truncate"
            >
              <option value="ALL">Todas as empresas</option>
              {(data?.companies ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 overflow-y-auto pr-1 flex-1">
            {pendencias.length === 0 ? (
              <div className="col-span-full text-center text-emerald-600 py-8 font-black uppercase text-xs">✓ Nenhuma pendência</div>
            ) : pendencias.map((p) => (
              <div key={p.emp.id}
                onClick={() => navigate({ to: "/app/employees/$id", params: { id: p.emp.id } })}
                className="p-3 border border-slate-100 rounded-xl bg-slate-50 hover:bg-white hover:border-[#0f766e] hover:shadow-sm cursor-pointer transition-all group">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs font-black uppercase text-slate-900 truncate">{p.emp.nome}</div>
                  <ArrowUpRight className="h-3 w-3 text-slate-300 group-hover:text-[#0f766e]" />
                </div>
                <div className="text-[9px] font-bold uppercase text-slate-500 mb-1.5 truncate">{p.company}</div>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[9px] font-bold text-slate-600 line-clamp-1">{p.status.msgs.join(" · ") || "—"}</div>
                  <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${p.status.colorClass} text-white shrink-0`}>{p.status.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    footer: {
      title: "Alertas operacionais", icon: AlertTriangle,
      render: () => (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[10px] font-bold uppercase tracking-wider h-full content-start">
          <FootStat label="Estoque baixo" value={estoqueBaixo} tone={estoqueBaixo > 0 ? "red" : "green"} />
          <FootStat label="CAs vencendo (60d)" value={caVencendo} tone={caVencendo > 0 ? "amber" : "green"} />
          <FootStat label="Perdas / extravios EPI" value={perdas} tone={perdas > 0 ? "amber" : "green"} />
        </div>
      ),
    },
  };

  const resetLayout = () => {
    setLayout(DEFAULT_LAYOUT);
    try { localStorage.removeItem(LS_KEY); } catch {}
  };

  return (
    <div className="p-4 md:p-6 animate-fadeIn h-full flex flex-col bg-gradient-to-br from-slate-100 via-slate-50 to-white overflow-y-auto custom-scrollbar">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 mb-1">SGI · ISO 9001 · NRs · Dashboard</div>
          <h2 className="heading-display text-2xl md:text-3xl text-slate-900">Painel SESMT — Estaleiro DMN</h2>
          <div className="text-[10px] text-slate-500 mt-1">
            {locked ? "Layout bloqueado" : "Arraste pelo cabeçalho · redimensione pelo canto inferior direito"}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(["30", "60", "90", "180"] as const).map((p) => (
            <button key={p} onClick={() => setPeriodo(p)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                periodo === p
                  ? "bg-gradient-to-br from-[#0f766e] to-[#134e4a] text-white shadow-md"
                  : "bg-white text-slate-500 border border-slate-200 hover:border-[#0f766e]"
              }`}>{p} dias</button>
          ))}
          <button onClick={() => setLocked((v) => !v)}
            className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-white text-slate-600 border border-slate-200 hover:border-[#0f766e] flex items-center gap-1.5">
            {locked ? <><Lock className="h-3 w-3" /> Bloqueado</> : <><Unlock className="h-3 w-3" /> Editar</>}
          </button>
          <button onClick={resetLayout}
            className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-white text-slate-600 border border-slate-200 hover:border-red-400 hover:text-red-600 flex items-center gap-1.5">
            <RotateCcw className="h-3 w-3" /> Resetar
          </button>
        </div>
      </div>

      <ResponsiveGridLayout
        className="layout"
        layout={layout}
        cols={12}
        rowHeight={40}
        margin={[12, 12]}
        containerPadding={[0, 0]}
        onLayoutChange={(l) => setLayout(l)}
        draggableHandle=".widget-drag-handle"
        isDraggable={!locked}
        isResizable={!locked}
        compactType="vertical"
      >
        {layout.map((l) => {
          const w = widgets[l.i];
          if (!w) return null;
          const Icon = w.icon;
          const accentCls = w.accent === "amber" ? "text-amber-600" : w.accent === "red" ? "text-red-600" : "text-[#0f766e]";
          const borderCls = w.accent === "red" ? "border-red-200" : "border-slate-200";
          return (
            <div key={l.i} className={`bg-white rounded-2xl shadow-sm border ${borderCls} flex flex-col overflow-hidden`}>
              <div className={`widget-drag-handle ${locked ? "cursor-default" : "cursor-grab active:cursor-grabbing"} flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-gradient-to-b from-white to-slate-50`}>
                <h3 className={`text-[11px] font-black uppercase tracking-widest flex items-center gap-2 ${accentCls}`}>
                  <Icon className="h-4 w-4" /> {w.title}
                </h3>
                {!locked && <GripVertical className="h-3.5 w-3.5 text-slate-300" />}
              </div>
              <div className="flex-1 p-4 min-h-0 overflow-hidden">
                {w.render()}
              </div>
            </div>
          );
        })}
      </ResponsiveGridLayout>
    </div>
  );
}

function KpiTile({ icon: Icon, label, value, hint, tone }: {
  icon: any; label: string; value: string | number; hint?: string;
  tone: "dark" | "teal" | "green" | "amber" | "red";
}) {
  const styles: Record<string, string> = {
    dark: "from-slate-800 to-slate-900 text-white",
    teal: "from-[#0f766e] to-[#134e4a] text-white",
    green: "from-emerald-500 to-emerald-700 text-white",
    amber: "from-amber-400 to-amber-600 text-white",
    red: "from-red-500 to-red-700 text-white",
  };
  return (
    <div className={`bg-gradient-to-br ${styles[tone]} rounded-xl p-3 shadow-md`}>
      <div className="flex items-center justify-between mb-1.5 opacity-80">
        <Icon className="h-4 w-4" />
        <div className="text-[8px] font-black uppercase tracking-widest text-right truncate max-w-[100px]">{label}</div>
      </div>
      <div className="text-2xl font-black leading-tight">{value}</div>
      {hint && <div className="text-[9px] font-semibold opacity-75 mt-0.5 truncate">{hint}</div>}
    </div>
  );
}

function Empty() {
  return <div className="h-full w-full flex items-center justify-center text-[10px] font-bold uppercase text-slate-400">Sem dados no período</div>;
}

function FootStat({ label, value, tone }: { label: string; value: number; tone: "red" | "amber" | "green" }) {
  const cls = tone === "red" ? "border-red-200 bg-red-50 text-red-700"
    : tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-700"
    : "border-emerald-200 bg-emerald-50 text-emerald-700";
  return (
    <div className={`border-2 rounded-xl p-3 flex items-center justify-between ${cls}`}>
      <span>{label}</span>
      <span className="text-lg font-black">{value}</span>
    </div>
  );
}
