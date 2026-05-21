import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Search, AlertTriangle, Building2, Users, ShieldCheck, Package,
  HardHat, FileWarning, Activity, TrendingUp, Boxes, ClipboardCheck,
  ArrowUpRight, Stethoscope, GripVertical, RotateCcw, Lock, Unlock,
  ShoppingBag, MessageSquare, FolderOpen,
  Flame,
} from "lucide-react";
import { calculateSafetyStatus } from "@/lib/safety-engine";
import { type SafetyOverride } from "@/lib/safety-overrides";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, ComposedChart, Line, Area,
} from "recharts";
// react-grid-layout touches `window` at import — load it client-only via lazy state
type Layout = { i: string; x: number; y: number; w: number; h: number; minH?: number; minW?: number };

export const Route = createFileRoute("/app/painel")({
  component: TstPanel,
});

const dayMs = 86400000;
const today = new Date();
const fmt = (d: Date) => d.toISOString().slice(0, 10);
const MONTHS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const LS_KEY = "sesmt-painel-layout-v4";
// Layout compacto: até 3 widgets lado a lado em 12 colunas (w:4 cada)
const DEFAULT_LAYOUT: Layout[] = [
  { i: "kpis",        x: 0, y: 0,  w: 12, h: 4, minH: 3, minW: 6 },
  { i: "health",      x: 0, y: 4,  w: 4,  h: 5, minH: 4, minW: 3 },
  { i: "status-pie",  x: 4, y: 4,  w: 4,  h: 5, minH: 4, minW: 3 },
  { i: "footer",      x: 8, y: 4,  w: 4,  h: 5, minH: 4, minW: 3 },
  { i: "epi-mensal",  x: 0, y: 9,  w: 4,  h: 8, minH: 6, minW: 3 },
  { i: "dds-trend",   x: 4, y: 9,  w: 4,  h: 8, minH: 6, minW: 3 },
  { i: "conformidade",x: 8, y: 9,  w: 4,  h: 8, minH: 6, minW: 3 },
  { i: "top-itens",   x: 0, y: 17, w: 4,  h: 8, minH: 6, minW: 3 },
  { i: "top-recip",   x: 4, y: 17, w: 4,  h: 8, minH: 6, minW: 3 },
  { i: "pendencias",  x: 8, y: 17, w: 4,  h: 8, minH: 6, minW: 3 },
  { i: "epi-recentes",x: 0, y: 25, w: 4,  h: 8, minH: 5, minW: 3 },
  { i: "dds-recentes",x: 4, y: 25, w: 4,  h: 8, minH: 5, minW: 3 },
  { i: "doc-controle",x: 8, y: 25, w: 4,  h: 8, minH: 5, minW: 3 },
  { i: "extintores",  x: 0, y: 33, w: 12, h: 5, minH: 4, minW: 6 },
];

function loadLayout(): Layout[] {
  if (typeof window === "undefined") return DEFAULT_LAYOUT;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw) as Layout[];
    // keep saved positions, but discard widgets removed from the dashboard
    const defaultIds = new Set(DEFAULT_LAYOUT.map((d) => d.i));
    const valid = parsed.filter((p) => defaultIds.has(p.i));
    const ids = new Set(valid.map((p) => p.i));
    const missing = DEFAULT_LAYOUT.filter((d) => !ids.has(d.i));
    return [...valid, ...missing];
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
  const [Grid, setGrid] = useState<any>(null);
  const gridWrapRef = useRef<HTMLDivElement>(null);
  const [gridWidth, setGridWidth] = useState(0);

  useEffect(() => {
    let mounted = true;
    import("react-grid-layout").then((mod) => {
      const RGL: any = (mod as any).default ?? (mod as any).ReactGridLayout ?? (mod as any).GridLayout;
      if (mounted) setGrid(() => RGL);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const el = gridWrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => setGridWidth(Math.max(320, Math.floor(el.clientWidth)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (initial.current) { initial.current = false; return; }
    try { localStorage.setItem(LS_KEY, JSON.stringify(layout)); } catch {}
  }, [layout]);

  const dias = Number(periodo);
  const since = fmt(new Date(today.getTime() - dias * dayMs));

  const { data } = useQuery({
    queryKey: ["sesmt-painel", since],
    queryFn: async () => {
      const [emps, comps, roles, exams, overrides, deliveries, estoque, dds, ddsAtt, aprs, ptes, docs, ddsTemas, controleDocs, extintores, extInspecoes] = await Promise.all([
        supabase.from("employees").select("*").order("nome"),
        supabase.from("companies").select("id,name").order("name"),
        supabase.from("roles").select("*"),
        supabase.from("employee_exams").select("*"),
        supabase.from("safety_overrides").select("*").eq("ativo", true),
        supabase.from("epi_deliveries").select("id,employee_id,item,qtd,data_entrega,motivo_entrega,valor_unitario").gte("data_entrega", since).order("data_entrega", { ascending: false }),
        supabase.from("estoque_epi").select("id,nome_material,quantidade_atual,estoque_minimo,ca_validade"),
        supabase.from("dds").select("id,data,hora,setor,tema_id,tema_livre,aderencia,participantes_presentes,participantes_esperados").gte("data", since).order("data", { ascending: false }),
        supabase.from("dds_attendees").select("dds_id,employee_id,status"),
        supabase.from("aprs").select("id,status,data_emissao,data_validade").gte("data_emissao", since),
        supabase.from("ptes").select("id,status,data,risco").gte("data", since),
        supabase.from("employee_docs").select("id,employee_id,tipo"),
        supabase.from("dds_temas").select("id,titulo"),
        supabase.from("controle_documentos").select("*"),
        supabase.from("extintores").select("id,status,proxima_recarga,proximo_teste_hidrostatico"),
        supabase.from("extintor_inspecoes").select("extintor_id,data_inspecao,conforme"),
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
        ddsTemas: ddsTemas.data ?? [],
        controleDocs: controleDocs.data ?? [],
        extintores: extintores.data ?? [],
        extInspecoes: extInspecoes.data ?? [],
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
    { name: "Bloqueados", value: bloqueados, color: "#C8102E" },
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

  const entregaSerie = useMemo(() => {
    // bucketize by week (start = Monday) when período > 30 dias, by day otherwise
    const useWeek = dias > 30;
    const m = new Map<string, { key: string; label: string; primeira: number; troca: number; perda: number; devolucao: number; outros: number; valor: number }>();
    (data?.deliveries ?? []).forEach((d: any) => {
      const dt = new Date(d.data_entrega + "T00:00");
      let bucket = dt;
      if (useWeek) {
        const day = (dt.getDay() + 6) % 7; // 0 = monday
        bucket = new Date(dt.getTime() - day * dayMs);
      }
      const key = fmt(bucket);
      const label = useWeek
        ? `${String(bucket.getDate()).padStart(2, "0")}/${MONTHS_PT[bucket.getMonth()]}`
        : `${String(bucket.getDate()).padStart(2, "0")}/${String(bucket.getMonth() + 1).padStart(2, "0")}`;
      const cur = m.get(key) ?? { key, label, primeira: 0, troca: 0, perda: 0, devolucao: 0, outros: 0, valor: 0 };
      const q = Number(d.qtd || 0);
      const motivo = String(d.motivo_entrega || "");
      if (motivo === "PRIMEIRA_ENTREGA") cur.primeira += q;
      else if (motivo === "TROCA" || motivo === "TROCA_DESGASTE") cur.troca += q;
      else if (motivo === "PERDA_EXTRAVIO") cur.perda += q;
      else if (motivo === "DEVOLUCAO") cur.devolucao += q;
      else cur.outros += q;
      cur.valor += q * Number(d.valor_unitario || 0);
      m.set(key, cur);
    });
    return Array.from(m.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [data, dias]);

  const epiRecentes = useMemo(() => {
    const empMap = new Map((data?.employees ?? []).map((e: any) => [e.id, e.nome]));
    return (data?.deliveries ?? []).slice(0, 10).map((d: any) => ({
      id: d.id,
      item: d.item,
      qtd: Number(d.qtd || 0),
      colaborador: (empMap.get(d.employee_id) as string) ?? "—",
      employee_id: d.employee_id,
      data: d.data_entrega,
      motivo: String(d.motivo_entrega || ""),
    }));
  }, [data]);

  const ddsRecentes = useMemo(() => {
    const tMap = new Map((data?.ddsTemas ?? []).map((t: any) => [t.id, t.titulo]));
    return (data?.dds ?? []).slice(0, 10).map((d: any) => ({
      id: d.id,
      data: d.data,
      tema: (d.tema_id ? (tMap.get(d.tema_id) as string) : null) ?? d.tema_livre ?? "Sem tema",
      setor: d.setor ?? "—",
      presentes: Number(d.participantes_presentes || 0),
      esperados: Number(d.participantes_esperados || 0),
      aderencia: Number(d.aderencia || 0),
    }));
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

  // === Agregações para gráficos 3D ===
  const epiPorMotivo = useMemo(() => {
    const m = new Map<string, number>();
    (data?.deliveries ?? []).forEach((d: any) => {
      const k = String(d.motivo_entrega || "OUTROS");
      m.set(k, (m.get(k) ?? 0) + Number(d.qtd || 0));
    });
    const labels: Record<string, string> = {
      PRIMEIRA_ENTREGA: "1ª entrega", TROCA: "Troca", TROCA_DESGASTE: "Desgaste",
      PERDA_EXTRAVIO: "Perda", DEVOLUCAO: "Devolução", OUTROS: "Outros",
    };
    const colors: Record<string, string> = {
      PRIMEIRA_ENTREGA: "#22d3ee", TROCA: "#a78bfa", TROCA_DESGASTE: "#8b5cf6",
      PERDA_EXTRAVIO: "#fb7185", DEVOLUCAO: "#facc15", OUTROS: "#94a3b8",
    };
    return Array.from(m.entries())
      .map(([k, v]) => ({ name: labels[k] ?? k, value: v, color: colors[k] ?? "#94a3b8" }))
      .sort((a, b) => b.value - a.value);
  }, [data]);

  const ddsPorSetor = useMemo(() => {
    const m = new Map<string, { setor: string; qtd: number; ad: number; n: number }>();
    (data?.dds ?? []).forEach((d: any) => {
      const s = (d.setor || "N/D").toString().slice(0, 14);
      const cur = m.get(s) ?? { setor: s, qtd: 0, ad: 0, n: 0 };
      cur.qtd += 1; cur.ad += Number(d.aderencia || 0); cur.n += 1;
      m.set(s, cur);
    });
    return Array.from(m.values())
      .map((v) => ({ setor: v.setor, qtd: v.qtd, aderencia: v.n > 0 ? Math.round(v.ad / v.n) : 0 }))
      .sort((a, b) => b.qtd - a.qtd).slice(0, 8);
  }, [data]);

  const pendPorEmpresa = useMemo(() => {
    const m = new Map<string, { name: string; alerta: number; bloq: number }>();
    rows.forEach((r) => {
      const name = (r.company || "—").toString().slice(0, 16);
      const cur = m.get(name) ?? { name, alerta: 0, bloq: 0 };
      if (r.status.label === "ALERTA") cur.alerta += 1;
      else if (r.status.label === "BLOQUEADO" || r.status.label === "SEM CARGO") cur.bloq += 1;
      m.set(name, cur);
    });
    return Array.from(m.values()).filter((v) => v.alerta + v.bloq > 0)
      .sort((a, b) => b.alerta + b.bloq - (a.alerta + a.bloq));
  }, [rows]);

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

  const docMetrics = useMemo(() => {
    const all = data?.controleDocs ?? [];
    const unresolved = (d: any) => d.status !== "RESOLVIDO" && d.status !== "FECHADO";
    const abertos = all.filter(unresolved).length;
    const vencidos = all.filter((d: any) => unresolved(d) && d.prazo && new Date(d.prazo + "T00:00").getTime() < today.getTime()).length;
    const criticos = all.filter((d: any) => unresolved(d) && d.criticidade === "ALTA").length;
    const resolvidos = all.filter((d: any) => d.status === "RESOLVIDO" || d.status === "FECHADO").length;
    return { abertos, vencidos, criticos, resolvidos, total: all.length };
  }, [data]);

  const extMetrics = useMemo(() => {
    const all = (data as any)?.extintores ?? [];
    const insp = (data as any)?.extInspecoes ?? [];
    const hojeISO = today.toISOString().slice(0, 10);
    const em30 = new Date(today.getTime() + 30 * dayMs).toISOString().slice(0, 10);
    const ativos = all.filter((e: any) => e.status === "ATIVO");
    const vencidos = ativos.filter((e: any) => e.proxima_recarga && e.proxima_recarga < hojeISO).length;
    const vencendo = ativos.filter((e: any) => e.proxima_recarga && e.proxima_recarga >= hojeISO && e.proxima_recarga <= em30).length;
    const inicioMes = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const inspMes = new Set(insp.filter((i: any) => i.data_inspecao >= inicioMes).map((i: any) => i.extintor_id));
    const semInspecao = ativos.filter((e: any) => !inspMes.has(e.id)).length;
    return { total: all.length, ativos: ativos.length, vencidos, vencendo, semInspecao };
  }, [data]);

  const docDonut = useMemo(() => {
    const d = docMetrics;
    return [
      { name: "Resolvidos", value: d.resolvidos, color: "#10b981" },
      { name: "Abertos", value: Math.max(0, d.abertos - d.criticos - d.vencidos), color: "#f59e0b" },
      { name: "Críticos", value: d.criticos, color: "#fb923c" },
      { name: "Vencidos", value: d.vencidos, color: "#ef4444" },
    ].filter((x) => x.value > 0);
  }, [docMetrics]);

  const extDonut = useMemo(() => {
    const e = extMetrics;
    const ok = Math.max(0, e.ativos - e.vencidos - e.vencendo);
    return [
      { name: "Conformes", value: ok, color: "#10b981" },
      { name: "Vencendo 30d", value: e.vencendo, color: "#f59e0b" },
      { name: "Recarga vencida", value: e.vencidos, color: "#ef4444" },
      { name: "Sem inspeção", value: e.semInspecao, color: "#a78bfa" },
    ].filter((x) => x.value > 0);
  }, [extMetrics]);

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
          <KpiTile icon={HardHat} label="EPIs entregues" value={totalEntregas} hint={`R$ ${valorEntregas.toFixed(0)}`} tone="brand" />
          <KpiTile icon={ClipboardCheck} label="DDS no período" value={ddsCount} hint={`${ddsAderencia}% aderência`} tone="brand" />
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
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#C8102E]/30 focus:border-[#C8102E] transition-all placeholder:text-slate-400 placeholder:font-normal"
          />
          {search && (
            <div className="mt-3 space-y-1.5 max-h-64 overflow-y-auto">
              {searchResults.length === 0 ? (
                <div className="text-center text-slate-400 py-3 text-xs font-bold uppercase">Nenhum resultado</div>
              ) : searchResults.map((r) => (
                <Link key={r.emp.id} to="/app/employees/$id" params={{ id: r.emp.id }}
                  className="flex items-center justify-between p-3 border border-slate-100 rounded-lg bg-slate-50 hover:border-[#C8102E] hover:bg-white transition-all">
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
        <div className="bg-gradient-to-br from-[#C8102E] to-[#8B0A1E] -m-2 p-4 rounded-xl text-white h-full flex flex-col justify-between">
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
        <div className="h-full min-h-0 grid grid-cols-5 gap-2">
          {statusPie.length === 0 ? <div className="col-span-5"><Empty /></div> : (
            <>
              <div className="col-span-3 relative">
                <ResponsiveContainer>
                  <PieChart>
                    <defs>
                      <linearGradient id="pie-apto" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#34d399" /><stop offset="100%" stopColor="#059669" />
                      </linearGradient>
                      <linearGradient id="pie-alerta" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#fcd34d" /><stop offset="100%" stopColor="#d97706" />
                      </linearGradient>
                      <linearGradient id="pie-bloq" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#fb7185" /><stop offset="100%" stopColor="#9f1239" />
                      </linearGradient>
                      <filter id="pie-glow"><feGaussianBlur stdDeviation="2.5" result="b" /><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                    </defs>
                    <Pie data={statusPie} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="92%" paddingAngle={4} cornerRadius={6} stroke="none" filter="url(#pie-glow)">
                      {statusPie.map((s) => (
                        <Cell key={s.name} fill={s.name === "Aptos" ? "url(#pie-apto)" : s.name === "Alerta" ? "url(#pie-alerta)" : "url(#pie-bloq)"} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "rgba(15,23,42,0.95)", border: "none", borderRadius: 10, color: "#fff", fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className="text-3xl font-black text-slate-900 leading-none">{conformidadeGeral}<span className="text-base text-slate-400">%</span></div>
                  <div className="text-[8px] font-black uppercase tracking-widest text-slate-400 mt-1">conformes</div>
                </div>
              </div>
              <div className="col-span-2 flex flex-col justify-center gap-2">
                {statusPie.map((s) => {
                  const pct = totalEmp > 0 ? Math.round((s.value / totalEmp) * 100) : 0;
                  const grad = s.name === "Aptos" ? "from-emerald-400 to-emerald-600"
                    : s.name === "Alerta" ? "from-amber-300 to-amber-600"
                    : "from-rose-400 to-rose-700";
                  return (
                    <div key={s.name} className="rounded-xl border border-slate-100 bg-slate-50/60 p-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-600">{s.name}</span>
                        <span className="text-[9px] font-black text-slate-500">{pct}%</span>
                      </div>
                      <div className="text-lg font-black text-slate-900 leading-none mt-0.5">{s.value}</div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                        <div className={`h-full rounded-full bg-gradient-to-r ${grad}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      ),
    },
    "epi-mensal": {
      title: "Fluxo de entregas de EPI — por motivo + valor R$", icon: TrendingUp,
      render: () => (
        <div className="h-full min-h-0">
          {entregaSerie.length === 0 ? <Empty /> : (
            <ResponsiveContainer>
              <ComposedChart data={entregaSerie} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad-primeira" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#0891b2" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="grad-troca" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#6d28d9" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="grad-perda" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fb7185" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#9f1239" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="grad-devolucao" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#facc15" stopOpacity={0.85} />
                    <stop offset="100%" stopColor="#a16207" stopOpacity={0.1} />
                  </linearGradient>
                  <linearGradient id="grad-valor-line" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#C8102E" /><stop offset="100%" stopColor="#fb7185" />
                  </linearGradient>
                  <filter id="line-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="b" />
                    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                  </filter>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={{ stroke: "#cbd5e1" }} tickLine={false} />
                <YAxis yAxisId="l" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} width={32} />
                <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} width={50} tickFormatter={(v) => v >= 1000 ? `R$${(v / 1000).toFixed(1)}k` : `R$${v}`} />
                <Tooltip
                  contentStyle={{ background: "rgba(15, 23, 42, 0.96)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, color: "#fff", fontSize: 11, boxShadow: "0 12px 32px -8px rgba(0,0,0,0.4)" }}
                  labelStyle={{ color: "#cbd5e1", fontWeight: 700, marginBottom: 4 }}
                  formatter={(v: any, n: any) => n === "Valor R$" ? [`R$ ${Number(v).toFixed(2)}`, n] : [v, n]}
                />
                <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} iconType="circle" />
                <Area yAxisId="l" type="monotone" dataKey="primeira" stackId="a" stroke="#22d3ee" strokeWidth={2} fill="url(#grad-primeira)" name="1ª entrega" />
                <Area yAxisId="l" type="monotone" dataKey="troca" stackId="a" stroke="#a78bfa" strokeWidth={2} fill="url(#grad-troca)" name="Troca" />
                <Area yAxisId="l" type="monotone" dataKey="devolucao" stackId="a" stroke="#facc15" strokeWidth={2} fill="url(#grad-devolucao)" name="Devolução" />
                <Area yAxisId="l" type="monotone" dataKey="perda" stackId="a" stroke="#fb7185" strokeWidth={2} fill="url(#grad-perda)" name="Perda/Extravio" />
                <Line yAxisId="r" type="monotone" dataKey="valor" stroke="url(#grad-valor-line)" strokeWidth={3.5} dot={{ r: 4, fill: "#C8102E", stroke: "#fff", strokeWidth: 2 }} activeDot={{ r: 7 }} name="Valor R$" filter="url(#line-glow)" />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      ),
    },
    "epi-recentes": {
      title: "Entregas de EPI · por motivo", icon: ShoppingBag,
      render: () => <Donut3D data={epiPorMotivo} total={totalEntregas} label="EPIs" />,
    },
    "dds-recentes": {
      title: "DDS por setor · volume × aderência", icon: MessageSquare,
      render: () => (
        <div className="h-full min-h-0">
          {ddsPorSetor.length === 0 ? <Empty /> : (
            <ResponsiveContainer>
              <ComposedChart data={ddsPorSetor} margin={{ top: 14, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="setor" tick={{ fontSize: 9, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="l" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} width={26} />
                <YAxis yAxisId="r" orientation="right" domain={[0, 100]} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} width={32} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={{ background: "rgba(15,23,42,0.96)", border: "none", borderRadius: 10, color: "#fff", fontSize: 11 }} cursor={{ fill: "rgba(167,139,250,0.08)" }} />
                <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" />
                <Bar yAxisId="l" dataKey="qtd" fill="#a78bfa" name="DDS" shape={<Bar3DShape />} />
                <Line yAxisId="r" type="monotone" dataKey="aderencia" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }} name="% aderência" />
              </ComposedChart>
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
              <BarChart data={topItens} margin={{ top: 18, right: 14, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad-top-itens" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#C8102E" /><stop offset="100%" stopColor="#fb7185" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="item" tick={{ fontSize: 9, fill: "#64748b" }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} width={28} />
                <Tooltip contentStyle={{ background: "rgba(15,23,42,0.96)", border: "none", borderRadius: 10, color: "#fff", fontSize: 11 }} cursor={{ fill: "rgba(200,16,46,0.08)" }} />
                <Bar dataKey="qtd" fill="#C8102E" shape={<Bar3DShape />} name="Quantidade" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      ),
    },
    "top-recip": {
      title: "Top recebedores de EPI", icon: HardHat,
      render: () => {
        if (topRecip.length === 0) return <Empty />;
        const max = topRecip[0].qtd || 1;
        const palette = ["#C8102E", "#fb7185", "#f59e0b", "#a78bfa", "#22d3ee"];
        return (
          <div className="h-full flex flex-col justify-center gap-3">
            {topRecip.map((r, i) => (
              <Bar3DHorizontal key={r.nome + i} label={r.nome} value={r.qtd} max={max} color={palette[i % palette.length]} />
            ))}
          </div>
        );
      },
    },
    "dds-trend": {
      title: "DDS · evolução & aderência", icon: ClipboardCheck,
      render: () => (
        <div className="h-full min-h-0">
          {ddsTrend.length === 0 ? <Empty /> : (
            <ResponsiveContainer>
              <ComposedChart data={ddsTrend} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad-dds-bar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#C8102E" /><stop offset="100%" stopColor="#8B0A1E" stopOpacity={0.85} />
                  </linearGradient>
                  <linearGradient id="grad-dds-line" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#10b981" /><stop offset="100%" stopColor="#34d399" />
                  </linearGradient>
                  <filter id="dds-glow"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="l" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} width={28} />
                <YAxis yAxisId="r" orientation="right" domain={[0, 100]} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} width={32} tickFormatter={(v) => `${v}%`} />
                <Tooltip contentStyle={{ background: "rgba(15,23,42,0.96)", border: "none", borderRadius: 10, color: "#fff", fontSize: 11 }} cursor={{ fill: "rgba(200,16,46,0.06)" }} />
                <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} iconType="circle" />
                <Bar yAxisId="l" dataKey="qtd" fill="url(#grad-dds-bar)" name="DDS realizados" radius={[8, 8, 0, 0]} barSize={28} />
                <Line yAxisId="r" type="monotone" dataKey="aderencia" stroke="url(#grad-dds-line)" strokeWidth={3.5} dot={{ r: 4, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }} activeDot={{ r: 7 }} name="% aderência" filter="url(#dds-glow)" />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      ),
    },
    conformidade: {
      title: "Conformidade por empresa", icon: Building2,
      render: () => (
        <div className="h-full min-h-0">
          {conformity.length === 0 ? <Empty /> : (
            <ResponsiveContainer>
              <BarChart data={conformity} margin={{ top: 14, right: 16, left: 0, bottom: 0 }} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#475569", fontWeight: 700 }} axisLine={false} tickLine={false} width={110} />
                <Tooltip contentStyle={{ background: "rgba(15,23,42,0.96)", border: "none", borderRadius: 10, color: "#fff", fontSize: 11 }} cursor={{ fill: "rgba(16,185,129,0.06)" }} formatter={(v: any, _n: any, p: any) => [`${v}% (${p.payload.oks}/${p.payload.total})`, "Conformidade"]} />
                <Bar dataKey="perc" name="Conformidade" radius={[0, 8, 8, 0]} shape={(props: any) => {
                  const c = props.payload.perc;
                  const fill = c === 100 ? "#10b981" : c > 80 ? "#f59e0b" : c > 0 ? "#ef4444" : "#94a3b8";
                  const { x, y, width, height } = props;
                  if (!isFinite(width) || width <= 0) return <g />;
                  const depth = Math.min(8, height * 0.35);
                  const id = `cf3d-${Math.round((x ?? 0) * 100 + (y ?? 0))}`;
                  return (
                    <g>
                      <defs>
                        <linearGradient id={`${id}-f`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={fill} stopOpacity={1} />
                          <stop offset="100%" stopColor={fill} stopOpacity={0.55} />
                        </linearGradient>
                      </defs>
                      <polygon points={`${x},${y} ${x + depth},${y - depth} ${x + width + depth},${y - depth} ${x + width},${y}`} fill={fill} opacity={0.9} />
                      <polygon points={`${x + width},${y} ${x + width + depth},${y - depth} ${x + width + depth},${y + height - depth} ${x + width},${y + height}`} fill={fill} opacity={0.55} />
                      <rect x={x} y={y} width={width} height={height} fill={`url(#${id}-f)`} rx={2} />
                    </g>
                  );
                }} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      ),
    },
    pendencias: {
      title: "Pendências por empresa · alerta vs bloqueado", icon: AlertTriangle, accent: "amber",
      render: () => (
        <div className="h-full min-h-0">
          {pendPorEmpresa.length === 0 ? (
            <div className="h-full flex items-center justify-center text-emerald-600 font-black uppercase text-xs">✓ Nenhuma pendência</div>
          ) : (
            <ResponsiveContainer>
              <BarChart data={pendPorEmpresa} margin={{ top: 16, right: 18, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} interval={0} angle={-12} textAnchor="end" height={56} />
                <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} width={28} />
                <Tooltip contentStyle={{ background: "rgba(15,23,42,0.96)", border: "none", borderRadius: 10, color: "#fff", fontSize: 11 }} cursor={{ fill: "rgba(239,68,68,0.06)" }} />
                <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" />
                <Bar dataKey="alerta" stackId="p" fill="#f59e0b" name="Alerta" shape={<Bar3DShape />} />
                <Bar dataKey="bloq" stackId="p" fill="#ef4444" name="Bloqueado" shape={<Bar3DShape />} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      ),
    },
    "doc-controle": {
      title: "Controle de Documentos", icon: FolderOpen,
      render: () => (
        <div className="h-full flex flex-col">
          <div className="flex-1 min-h-0">
            <Donut3D data={docDonut} total={docMetrics.total} label="docs" />
          </div>
          <Link to="/app/controle-documentos"
            className="mt-2 flex items-center justify-center gap-2 w-full bg-gradient-to-br from-[#C8102E] to-[#8B0A1E] text-white rounded-xl py-2 text-[10px] font-black uppercase tracking-wider hover:shadow-md transition-all">
            <FolderOpen className="h-3.5 w-3.5" /> Acessar módulo
          </Link>
        </div>
      ),
    },
    extintores: {
      title: "Controle de Extintores", icon: Flame,
      render: () => (
        <div className="h-full flex flex-col">
          <div className="flex-1 min-h-0">
            <Donut3D data={extDonut} total={extMetrics.ativos} label="ativos" />
          </div>
          <Link to="/app/extintores"
            className="mt-2 flex items-center justify-center gap-2 w-full bg-gradient-to-br from-[#C8102E] to-[#8B0A1E] text-white rounded-xl py-2 text-[10px] font-black uppercase tracking-wider hover:shadow-md transition-all">
            <Flame className="h-3.5 w-3.5" /> Acessar módulo
          </Link>
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
                  ? "bg-gradient-to-br from-[#C8102E] to-[#8B0A1E] text-white shadow-md"
                  : "bg-white text-slate-500 border border-slate-200 hover:border-[#C8102E]"
              }`}>{p} dias</button>
          ))}
          <button onClick={() => setLocked((v) => !v)}
            className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-white text-slate-600 border border-slate-200 hover:border-[#C8102E] flex items-center gap-1.5">
            {locked ? <><Lock className="h-3 w-3" /> Bloqueado</> : <><Unlock className="h-3 w-3" /> Editar</>}
          </button>
          <button onClick={resetLayout}
            className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-white text-slate-600 border border-slate-200 hover:border-red-400 hover:text-red-600 flex items-center gap-1.5">
            <RotateCcw className="h-3 w-3" /> Resetar
          </button>
        </div>
      </div>

      <div ref={gridWrapRef} className="min-w-0">
      {Grid && gridWidth > 0 ? (
      <Grid
        className="layout"
        layout={layout}
        width={gridWidth}
        gridConfig={{ cols: 12, rowHeight: 40, margin: [12, 12], containerPadding: [0, 0] }}
        onLayoutChange={(l: Layout[]) => setLayout(l)}
        dragConfig={{ enabled: !locked, handle: ".widget-drag-handle" }}
        resizeConfig={{ enabled: !locked }}
      >
        {layout.map((l) => {
          const w = widgets[l.i];
          if (!w) return null;
          const Icon = w.icon;
          const accentCls = w.accent === "amber" ? "text-amber-600" : w.accent === "red" ? "text-red-600" : "text-[#C8102E]";
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
      </Grid>
      ) : (
        <div className="text-center text-xs text-slate-400 py-8">Carregando layout…</div>
      )}
      </div>
    </div>
  );
}

function KpiTile({ icon: Icon, label, value, hint, tone }: {
  icon: any; label: string; value: string | number; hint?: string;
  tone: "dark" | "brand" | "green" | "amber" | "red";
}) {
  const styles: Record<string, string> = {
    dark: "from-slate-800 to-slate-900 text-white",
    brand: "from-[#C8102E] to-[#8B0A1E] text-white",
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

function DocStat({ label, value, tone }: { label: string; value: number; tone: "red" | "amber" | "green" }) {
  const cls = tone === "red" ? "border-red-200 bg-red-50 text-red-700"
    : tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-700"
    : "border-emerald-200 bg-emerald-50 text-emerald-700";
  return (
    <div className={`border-2 rounded-xl p-2.5 flex flex-col items-center justify-center text-center ${cls}`}>
      <div className="text-xl font-black leading-none">{value}</div>
      <div className="text-[8px] font-black uppercase tracking-wider mt-1 opacity-80">{label}</div>
    </div>
  );
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

// === Componentes 3D ===

// Barra 3D vertical: forma customizada para Recharts <Bar shape={...} />
function Bar3DShape(props: any) {
  const { x, y, width, height, fill } = props;
  if (!isFinite(height) || height <= 0 || !isFinite(width) || width <= 0) return null;
  const depth = Math.max(4, Math.min(10, width * 0.28));
  const id = `b3d-${Math.round((x ?? 0) * 100 + (y ?? 0))}`;
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-front`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fill} stopOpacity={1} />
          <stop offset="100%" stopColor={fill} stopOpacity={0.55} />
        </linearGradient>
        <linearGradient id={`${id}-side`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={fill} stopOpacity={0.7} />
          <stop offset="100%" stopColor="#0f172a" stopOpacity={0.45} />
        </linearGradient>
      </defs>
      {/* lateral direita */}
      <polygon
        points={`${x + width},${y} ${x + width + depth},${y - depth} ${x + width + depth},${y + height - depth} ${x + width},${y + height}`}
        fill={`url(#${id}-side)`}
      />
      {/* topo */}
      <polygon
        points={`${x},${y} ${x + depth},${y - depth} ${x + width + depth},${y - depth} ${x + width},${y}`}
        fill={fill}
        opacity={0.92}
      />
      {/* frente */}
      <rect x={x} y={y} width={width} height={height} fill={`url(#${id}-front)`} rx={1.5} />
    </g>
  );
}

// Barra 3D horizontal
function Bar3DHorizontal({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const perc = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 4;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-center">
      <div className="min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 truncate" title={label}>{label}</span>
          <span className="text-[10px] font-black text-slate-900">{value}</span>
        </div>
        <div className="relative h-5" style={{ perspective: "600px" }}>
          <div className="absolute inset-0 bg-slate-100 rounded-md" />
          <div
            className="absolute top-0 left-0 h-full rounded-md transition-all"
            style={{
              width: `${perc}%`,
              background: `linear-gradient(180deg, ${color} 0%, ${color}cc 50%, ${color}88 100%)`,
              transform: "rotateX(18deg)",
              transformOrigin: "bottom",
              boxShadow: `0 3px 0 -1px ${color}55, 0 8px 18px -6px ${color}66, inset 0 1px 0 rgba(255,255,255,0.4)`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

// Donut 3D isométrico
function Donut3D({ data, total, label }: { data: { name: string; value: number; color: string }[]; total: number; label?: string }) {
  if (data.length === 0) return <Empty />;
  return (
    <div className="h-full grid grid-cols-5 gap-3 min-h-0">
      <div className="col-span-3 relative">
        <div
          className="absolute inset-0"
          style={{ transform: "perspective(900px) rotateX(58deg)", transformStyle: "preserve-3d" }}
        >
          <ResponsiveContainer>
            <PieChart>
              <defs>
                <filter id="donut3d-shadow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="4" result="b" />
                  <feOffset dy="6" result="o" />
                  <feComponentTransfer in="o" result="o2"><feFuncA type="linear" slope="0.35" /></feComponentTransfer>
                  <feMerge><feMergeNode in="o2" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius="55%"
                outerRadius="92%"
                paddingAngle={2}
                cornerRadius={4}
                stroke="#fff"
                strokeWidth={2}
                filter="url(#donut3d-shadow)"
              >
                {data.map((s, i) => <Cell key={i} fill={s.color} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-3xl font-black text-slate-900 leading-none drop-shadow-sm">{total}</div>
          {label && <div className="text-[8px] font-black uppercase tracking-widest text-slate-400 mt-1">{label}</div>}
        </div>
      </div>
      <div className="col-span-2 flex flex-col justify-center gap-1.5">
        {data.map((s) => {
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
          return (
            <div key={s.name} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color, boxShadow: `0 2px 4px ${s.color}80` }} />
              <div className="min-w-0 flex-1">
                <div className="text-[9px] font-black uppercase tracking-wider text-slate-600 truncate">{s.name}</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-black text-slate-900">{s.value}</span>
                  <span className="text-[9px] font-bold text-slate-400">{pct}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
