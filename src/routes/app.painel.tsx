import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Search, ShieldCheck, Flame, Calendar, ArrowRight, ChevronRight, FolderOpen, Package,
} from "lucide-react";
import { calculateSafetyStatus } from "@/lib/safety-engine";
import { type SafetyOverride } from "@/lib/safety-overrides";
import {
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  ComposedChart, Line, Area, Bar, BarChart, PieChart, Pie, Cell, LabelList,
} from "recharts";

export const Route = createFileRoute("/app/painel")({
  component: TstPanel,
});

const dayMs = 86400000;
const today = new Date();
const fmt = (d: Date) => d.toISOString().slice(0, 10);
const MONTHS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function TstPanel() {
  const [q, setQ] = useState("");
  const [filterCompany, setFilterCompany] = useState("ALL");
  const [periodo, setPeriodo] = useState<"30" | "60" | "90" | "180">("90");

  const dias = Number(periodo);
  const since = fmt(new Date(today.getTime() - dias * dayMs));

  const { data, isLoading } = useQuery({
    queryKey: ["sesmt-painel", since],
    queryFn: async () => {
      const [emps, comps, roles, exams, overrides, deliveries, estoque, dds, aprs, ptes, controleDocs, extintores, extInspecoes] = await Promise.all([
        supabase.from("employees").select("*").order("nome"),
        supabase.from("companies").select("id,name").order("name"),
        supabase.from("roles").select("*"),
        supabase.from("employee_exams").select("*"),
        supabase.from("safety_overrides").select("*").eq("ativo", true),
        supabase.from("epi_deliveries").select("id,employee_id,item,qtd,data_entrega,motivo_entrega,valor_unitario").gte("data_entrega", since).order("data_entrega", { ascending: false }),
        supabase.from("estoque_epi").select("id,nome_material,quantidade_atual,estoque_minimo,ca_validade"),
        supabase.from("dds").select("id,data,hora,setor,tema_id,tema_livre,aderencia,participantes_presentes,participantes_esperados").gte("data", since).order("data", { ascending: false }),
        supabase.from("aprs").select("id,status,data_emissao,data_validade").gte("data_emissao", since),
        supabase.from("ptes").select("id,status,data,risco").gte("data", since),
        supabase.from("controle_documentos").select("*"),
        supabase.from("extintores").select("id,status,proxima_recarga,proximo_teste_hidrostatico,numero_identificacao"),
        supabase.from("extintor_inspecoes").select("extintor_id,data_inspecao,conforme"),
      ]);
      const ossRes = await supabase
        .from("oss_emissoes")
        .select("employee_id,status,expira_em")
        .eq("status", "ASSINADO");
      return {
        employees: emps.data ?? [],
        companies: comps.data ?? [],
        roles: roles.data ?? [],
        exams: exams.data ?? [],
        overrides: (overrides.data ?? []) as SafetyOverride[],
        deliveries: deliveries.data ?? [],
        estoque: estoque.data ?? [],
        dds: dds.data ?? [],
        aprs: aprs.data ?? [],
        ptes: ptes.data ?? [],
        controleDocs: controleDocs.data ?? [],
        extintores: extintores.data ?? [],
        extInspecoes: extInspecoes.data ?? [],
        oss: ossRes.data ?? [],
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
    const nowIso = new Date().toISOString();
    const ossSet = new Set<string>();
    ((data as any).oss ?? []).forEach((r: any) => {
      if (!r.expira_em || r.expira_em > nowIso) ossSet.add(r.employee_id);
    });
    return data.employees.map((e: any) => ({
      emp: e,
      company: e.company_id ? cMap.get(e.company_id) ?? "—" : "—",
      role: e.role_id ? rMap.get(e.role_id) : null,
      status: calculateSafetyStatus(e, e.role_id ? (rMap.get(e.role_id) as any) : null, exMap.get(e.id) ?? [], [], ovMap.get(e.id) ?? [], ossSet.has(e.id)),
    }));
  }, [data]);

  const totalEmp = rows.length;
  const aptos = rows.filter((r) => r.status.label === "APTO").length;
  const alertas = rows.filter((r) => r.status.label === "ALERTA").length;
  const bloqueados = rows.filter((r) => r.status.label === "BLOQUEADO" || r.status.label === "SEM CARGO").length;
  const conformidadeGeral = totalEmp > 0 ? Math.round((aptos / totalEmp) * 100) : 0;

  const totalEntregas = (data?.deliveries ?? []).reduce((s, d: any) => s + Number(d.qtd || 0), 0);
  const valorEntregas = (data?.deliveries ?? []).reduce((s, d: any) => s + Number(d.qtd || 0) * Number(d.valor_unitario || 0), 0);

  const estoqueBaixo = (data?.estoque ?? []).filter((e: any) => Number(e.quantidade_atual || 0) <= Number(e.estoque_minimo || 0)).length;
  const caVencendo = (data?.estoque ?? []).filter((e: any) => {
    if (!e.ca_validade) return false;
    const d = new Date(e.ca_validade + "T00:00").getTime();
    return d - today.getTime() < 60 * dayMs && d - today.getTime() >= 0;
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

  // === Conformidade por Empresa (stacked horizontal bars) ===
  const conformityStacked = useMemo(() => {
    if (!data) return [];
    return data.companies.map((c: any) => {
      const compEmps = rows.filter((r) => r.emp.company_id === c.id);
      const total = compEmps.length;
      if (total === 0) return null;
      const oks = compEmps.filter((r) => r.status.label === "APTO").length;
      const al = compEmps.filter((r) => r.status.label === "ALERTA").length;
      const bl = total - oks - al;
      return {
        id: c.id,
        name: c.name,
        total,
        oks,
        al,
        bl,
        okPct: (oks / total) * 100,
        alPct: (al / total) * 100,
        blPct: (bl / total) * 100,
        score: Math.round((oks / total) * 100),
      };
    }).filter(Boolean).sort((a: any, b: any) => b!.score - a!.score) as any[];
  }, [data, rows]);

  // === Documentos & Extintores ===
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

  // === Ações Recomendadas (priorizadas, baseadas em dados reais) ===
  type Acao = { id: string; titulo: string; sub: string; severity: "crit" | "warn"; link: string };
  const acoes: Acao[] = useMemo(() => {
    const list: Acao[] = [];
    if (asoVencidos > 0) list.push({ id: "aso-venc", titulo: `Regularizar ${asoVencidos} ASO${asoVencidos > 1 ? "s" : ""} vencido${asoVencidos > 1 ? "s" : ""}`, sub: "Bloqueia acesso à obra · ação imediata", severity: "crit", link: "/app/hoje" });
    if (extMetrics.vencidos > 0) list.push({ id: "ext-venc", titulo: `${extMetrics.vencidos} extintor${extMetrics.vencidos > 1 ? "es" : ""} com recarga vencida`, sub: "NR-23 · bloqueia uso", severity: "crit", link: "/app/extintores" });
    if (docMetrics.criticos > 0) list.push({ id: "doc-crit", titulo: `${docMetrics.criticos} documento${docMetrics.criticos > 1 ? "s" : ""} crítico${docMetrics.criticos > 1 ? "s" : ""} aberto${docMetrics.criticos > 1 ? "s" : ""}`, sub: "Controle de documentos", severity: "crit", link: "/app/controle-documentos" });
    if (extMetrics.semInspecao > 0) list.push({ id: "ext-insp", titulo: `Inspecionar ${extMetrics.semInspecao} extintor${extMetrics.semInspecao > 1 ? "es" : ""} no mês`, sub: "Checklist FOR-SFG 08", severity: "warn", link: "/app/extintores" });
    if (estoqueBaixo > 0) list.push({ id: "estq-bx", titulo: `Repor ${estoqueBaixo} ${estoqueBaixo > 1 ? "itens" : "item"} com estoque baixo`, sub: "EPIs abaixo do mínimo", severity: "warn", link: "/app/estoque/epi" });
    if (asoVencendo30 > 0) list.push({ id: "aso-30", titulo: `Agendar ${asoVencendo30} exame${asoVencendo30 > 1 ? "s" : ""} (próx. 30 dias)`, sub: "Programar com clínica conveniada", severity: "warn", link: "/app/employees" });
    if (caVencendo > 0) list.push({ id: "ca-60", titulo: `${caVencendo} CA${caVencendo > 1 ? "s" : ""} vencendo em 60 dias`, sub: "Revisar catálogo de EPI", severity: "warn", link: "/app/estoque/epi" });
    if (docMetrics.vencidos > 0) list.push({ id: "doc-venc", titulo: `${docMetrics.vencidos} documento${docMetrics.vencidos > 1 ? "s" : ""} fora do prazo`, sub: "Controle de documentos", severity: "crit", link: "/app/controle-documentos" });
    return list.slice(0, 6);
  }, [asoVencidos, asoVencendo30, extMetrics, docMetrics, estoqueBaixo, caVencendo]);

  // === Próximos 7 dias ===
  type Evento = { date: string; tipo: string; titulo: string; sub: string; severity: "crit" | "warn" | "ok" };
  const proximos7: Evento[] = useMemo(() => {
    if (!data) return [];
    const empMap = new Map(data.employees.map((e: any) => [e.id, e.nome]));
    const limit = today.getTime() + 7 * dayMs;
    const items: Evento[] = [];
    data.exams.forEach((ex: any) => {
      if (!ex.data_vencimento) return;
      const t = new Date(ex.data_vencimento + "T00:00").getTime();
      if (t >= today.getTime() && t <= limit) {
        items.push({ date: ex.data_vencimento, tipo: "ASO", titulo: `${ex.tipo_exame || "Exame"} vence`, sub: (empMap.get(ex.employee_id) as string) ?? "—", severity: "warn" });
      }
    });
    ((data as any).extintores ?? []).forEach((e: any) => {
      if (!e.proxima_recarga) return;
      const t = new Date(e.proxima_recarga + "T00:00").getTime();
      if (t >= today.getTime() && t <= limit) {
        items.push({ date: e.proxima_recarga, tipo: "EXT", titulo: "Recarga de extintor", sub: e.numero_identificacao ? `Nº ${e.numero_identificacao}` : "Extintor", severity: "crit" });
      }
    });
    (data.aprs ?? []).forEach((a: any) => {
      if (!a.data_validade) return;
      const t = new Date(a.data_validade + "T00:00").getTime();
      if (t >= today.getTime() && t <= limit && a.status !== "CANCELADA" && a.status !== "ENCERRADA") {
        items.push({ date: a.data_validade, tipo: "APR", titulo: "APR vence", sub: `Status ${a.status}`, severity: "warn" });
      }
    });
    return items.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);
  }, [data]);

  // === Top pendências por empresa ===
  const pendPorEmpresa = useMemo(() => {
    const m = new Map<string, { id: string; name: string; alerta: number; bloq: number }>();
    rows.forEach((r) => {
      const id = r.emp.company_id ?? "—";
      const name = (r.company || "—").toString();
      const cur = m.get(id) ?? { id, name, alerta: 0, bloq: 0 };
      if (r.status.label === "ALERTA") cur.alerta += 1;
      else if (r.status.label === "BLOQUEADO" || r.status.label === "SEM CARGO") cur.bloq += 1;
      m.set(id, cur);
    });
    return Array.from(m.values())
      .filter((v) => v.alerta + v.bloq > 0)
      .sort((a, b) => (b.bloq * 2 + b.alerta) - (a.bloq * 2 + a.alerta))
      .slice(0, 4);
  }, [rows]);

  // === Série temporal: EPI flow ===
  const entregaSerie = useMemo(() => {
    const useWeek = dias > 30;
    const m = new Map<string, { key: string; label: string; primeira: number; troca: number; perda: number; devolucao: number; outros: number; valor: number }>();
    (data?.deliveries ?? []).forEach((d: any) => {
      const dt = new Date(d.data_entrega + "T00:00");
      let bucket = dt;
      if (useWeek) {
        const day = (dt.getDay() + 6) % 7;
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

  // === DDS trend ===
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

  // === Busca ===
  const search = q.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!search) return [];
    return rows.filter((r) =>
      (r.emp.nome ?? "").toLowerCase().includes(search) ||
      (r.emp.cpf ?? "").toLowerCase().includes(search) ||
      (r.role?.name ?? "").toLowerCase().includes(search) ||
      (r.company ?? "").toLowerCase().includes(search),
    ).slice(0, 6);
  }, [rows, search]);

  const conformidadeFiltro = filterCompany === "ALL"
    ? conformidadeGeral
    : (conformityStacked.find((c: any) => c.id === filterCompany)?.score ?? 0);

  const conformityView = filterCompany === "ALL"
    ? conformityStacked
    : conformityStacked.filter((c: any) => c.id === filterCompany);

  // === Donut Conformidade Geral ===
  const donutData = [
    { name: "Aptos", value: aptos, fill: "#10b981" },
    { name: "Alerta", value: alertas, fill: "#f59e0b" },
    { name: "Crítico", value: bloqueados, fill: "#7f1212" },
  ].filter((d) => d.value > 0);

  // === Top 5 empresas (barras verticais) ===
  const top5Empresas = conformityStacked.slice(0, 5).map((c: any) => ({
    name: c.name.length > 10 ? c.name.slice(0, 10) + "…" : c.name,
    score: c.score,
    bl: c.bl,
    al: c.al,
    oks: c.oks,
  }));

  // === Distribuição global de status ===
  const statusBarsData = [
    { name: "APTO", value: aptos, fill: "#10b981" },
    { name: "ALERTA", value: alertas, fill: "#f59e0b" },
    { name: "BLOQ.", value: bloqueados, fill: "#7f1212" },
  ];

  return (
    <div className="h-full overflow-y-auto bg-[#eef2f7] custom-scrollbar">
      <div className="max-w-[1700px] mx-auto p-3 md:p-4 flex flex-col gap-3">

        {/* ===== HEADER BI ===== */}
        <div className="rounded-md overflow-hidden shadow-md border border-slate-300">
          <div
            className="flex items-center justify-between gap-3 px-4 py-2.5"
            style={{ background: "linear-gradient(90deg,#0c2340 0%,#1a4a6e 60%,#2d6a8e 100%)" }}
          >
            <h1 className="text-white text-lg md:text-xl font-black uppercase tracking-[0.18em] flex items-center gap-3">
              <span className="bg-[#7f1212] text-white px-2 py-0.5 rounded text-xs font-black uppercase tracking-tighter">DMN</span>
              Dashboard Painel Executivo · SESMT
            </h1>
            <div className="flex items-center gap-1 bg-white/95 px-1 py-0.5 rounded shadow-inner">
              <select
                value={filterCompany}
                onChange={(e) => setFilterCompany(e.target.value)}
                className="text-[11px] font-bold text-slate-700 px-2 py-1 bg-transparent border-none outline-none cursor-pointer uppercase tracking-wider"
              >
                <option value="ALL">Todas empresas</option>
                {(data?.companies ?? []).map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <div className="h-4 w-px bg-slate-300" />
              {(["30", "60", "90", "180"] as const).map((p) => (
                <button key={p} onClick={() => setPeriodo(p)}
                  className={`px-2 py-1 text-[10px] font-black uppercase tracking-wider rounded transition-colors ${
                    periodo === p ? "bg-[#0c2340] text-white" : "text-slate-500 hover:text-[#0c2340]"
                  }`}>{p}d</button>
              ))}
            </div>
          </div>
          {/* faixa fina informativa */}
          <div className="bg-white px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 border-t border-slate-200 flex items-center justify-between">
            <span>SGI · ISO 9001 · NR-1 · NR-6 · NR-7 · NR-9 · NR-23 — Gestão integrada de SST</span>
            <span className="text-slate-700">{totalEmp} colaboradores · {(data?.companies ?? []).length} empresas</span>
          </div>
        </div>

        {/* ===== GRID PRINCIPAL ===== */}
        <div className="grid grid-cols-12 gap-3">

          {/* ============ COLUNA FILTROS (esquerda) ============ */}
          <aside className="col-span-12 lg:col-span-2 flex flex-col gap-3">
            <BiCard title="Filtros" tight>
              <div className="space-y-2">
                <FilterChip label="Apto" value={aptos} active={false} color="#10b981" />
                <FilterChip label="Alerta" value={alertas} active={false} color="#f59e0b" />
                <FilterChip label="Bloqueado" value={bloqueados} active={false} color="#7f1212" />
              </div>
            </BiCard>

            <BiCard title="Módulos" tight>
              <div className="grid grid-cols-1 gap-1.5">
                <FilterChip label="APRs" value={aprsAtivas} color="#0c2340" />
                <FilterChip label="PTEs" value={ptesAtivas} color="#0c2340" />
                <FilterChip label="DDS" value={ddsCount} color="#6d28d9" />
                <FilterChip label="Extint." value={extMetrics.ativos} color="#7f1212" />
              </div>
            </BiCard>

            {/* Busca compacta */}
            <BiCard title="Buscar" tight>
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Nome, CPF, função…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded pl-7 pr-2 py-1.5 text-[11px] font-medium outline-none focus:ring-2 focus:ring-[#7f1212]/20 focus:border-[#7f1212] transition-all placeholder:text-slate-400"
                />
              </div>
              {search && (
                <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                  {searchResults.length === 0 ? (
                    <div className="text-center text-slate-400 py-2 text-[9px] font-bold uppercase">Nenhum</div>
                  ) : searchResults.map((r) => (
                    <Link key={r.emp.id} to="/app/employees/$id" params={{ id: r.emp.id }}
                      className="block p-1.5 border border-slate-100 rounded text-[10px] hover:border-[#7f1212] hover:bg-slate-50 transition-all">
                      <div className="font-bold text-slate-900 truncate">{r.emp.nome}</div>
                      <div className="text-slate-500 truncate text-[9px]">{r.company}</div>
                    </Link>
                  ))}
                </div>
              )}
            </BiCard>
          </aside>

          {/* ============ CENTRO (8 cols) ============ */}
          <div className="col-span-12 lg:col-span-7 flex flex-col gap-3">

            {/* Linha 1: KPI MEGA + STATUS BARS + AÇÕES/MÊS (área) */}
            <div className="grid grid-cols-12 gap-3">
              {/* KPI MEGA Bloqueados */}
              <BiCard tight noTitle className="col-span-12 sm:col-span-3 !p-0 overflow-hidden">
                <div
                  className="h-full w-full flex flex-col items-center justify-center text-white py-4 px-2 relative"
                  style={{
                    background: "linear-gradient(160deg,#9b1c1c 0%,#7f1212 50%,#5a0c0c 100%)",
                  }}
                >
                  {bloqueados > 0 && (
                    <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-amber-300 animate-pulse" />
                  )}
                  <div className="text-[9px] font-black uppercase tracking-[0.2em] text-rose-200">Quantidade</div>
                  <div className="text-6xl font-black tabular-nums leading-none drop-shadow-md mt-1">
                    {String(bloqueados).padStart(2, "0")}
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-white/90 mt-2">Bloqueados</div>
                  <div className="text-[9px] text-rose-100 mt-0.5">{alertas} em alerta</div>
                </div>
              </BiCard>

              {/* TOP 5 EMPRESAS - barras verticais coloridas */}
              <BiCard title="Top 5 · Score por Empresa" className="col-span-12 sm:col-span-5">
                <div className="h-40">
                  {top5Empresas.length === 0 ? <EmptyBlock label="Sem empresas" /> : (
                    <ResponsiveContainer>
                      <BarChart data={top5Empresas} margin={{ top: 16, right: 6, left: -22, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="2 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#475569", fontWeight: 700 }} axisLine={{ stroke: "#cbd5e1" }} tickLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{ fill: "rgba(12,35,64,0.06)" }} contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #cbd5e1" }} formatter={(v: any) => [`${v}%`, "Score"]} />
                        <Bar dataKey="score" radius={[3, 3, 0, 0]}>
                          {top5Empresas.map((e: any, i: number) => (
                            <Cell key={i} fill={e.score >= 90 ? "#10b981" : e.score >= 70 ? "#f59e0b" : "#7f1212"} />
                          ))}
                          <LabelList dataKey="score" position="top" formatter={(v: any) => `${v}%`} style={{ fontSize: 10, fontWeight: 800, fill: "#0f172a" }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </BiCard>

              {/* ENTREGAS/MÊS (área) */}
              <BiCard title="Fluxo de EPI · Mês" className="col-span-12 sm:col-span-4">
                <div className="h-40">
                  {entregaSerie.length === 0 ? <EmptyBlock label="Sem entregas" /> : (
                    <ResponsiveContainer>
                      <ComposedChart data={entregaSerie} margin={{ top: 6, right: 6, left: -24, bottom: 0 }}>
                        <defs>
                          <linearGradient id="gradFlow" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#1a4a6e" stopOpacity={0.9} />
                            <stop offset="100%" stopColor="#1a4a6e" stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="2 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #cbd5e1" }} />
                        <Area type="monotone" dataKey="primeira" stackId="a" stroke="#1a4a6e" strokeWidth={2} fill="url(#gradFlow)" name="1ª entrega" />
                        <Area type="monotone" dataKey="troca" stackId="a" stroke="#0c2340" strokeWidth={1.5} fill="#1a4a6e" fillOpacity={0.5} name="Troca" />
                        <Area type="monotone" dataKey="perda" stackId="a" stroke="#7f1212" strokeWidth={1.5} fill="#7f1212" fillOpacity={0.6} name="Perda" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </BiCard>
            </div>

            {/* Linha 2: DISTRIB. STATUS (barras) + DDS evolução (barras+linha) */}
            <div className="grid grid-cols-12 gap-3">
              <BiCard title="Distribuição de Status" className="col-span-12 sm:col-span-5">
                <div className="h-36">
                  <ResponsiveContainer>
                    <BarChart data={statusBarsData} layout="vertical" margin={{ top: 4, right: 30, left: 6, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="2 3" stroke="#e2e8f0" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#0f172a", fontWeight: 800 }} axisLine={false} tickLine={false} width={50} />
                      <Tooltip cursor={{ fill: "rgba(12,35,64,0.06)" }} contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #cbd5e1" }} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {statusBarsData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                        <LabelList dataKey="value" position="right" style={{ fontSize: 10, fontWeight: 800, fill: "#0f172a" }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </BiCard>

              <BiCard title="DDS · Evolução" className="col-span-12 sm:col-span-7">
                <div className="h-36">
                  {ddsTrend.length === 0 ? <EmptyBlock label="Sem DDS" /> : (
                    <ResponsiveContainer>
                      <ComposedChart data={ddsTrend} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="2 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="mes" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="l" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="r" orientation="right" domain={[0, 100]} tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                        <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #cbd5e1" }} />
                        <Bar yAxisId="l" dataKey="qtd" fill="#6d28d9" radius={[3, 3, 0, 0]} name="DDS" />
                        <Line yAxisId="r" type="monotone" dataKey="aderencia" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, fill: "#fff", stroke: "#10b981", strokeWidth: 2 }} name="% aderência" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </BiCard>
            </div>

            {/* Linha 3: AÇÕES RECOMENDADAS + PRÓXIMOS 7 DIAS */}
            <div className="grid grid-cols-12 gap-3">
              <BiCard
                title="Ações Recomendadas"
                className="col-span-12 sm:col-span-7"
                action={<Link to="/app/hoje" className="text-[9px] font-bold uppercase tracking-wider text-slate-500 hover:text-[#7f1212] flex items-center gap-1">Ver tudo <ArrowRight className="h-3 w-3" /></Link>}
              >
                {acoes.length === 0 ? (
                  <div className="flex items-center justify-center py-6 text-emerald-600 text-[11px] font-black uppercase tracking-wider gap-2">
                    <ShieldCheck className="h-4 w-4" /> Tudo em ordem
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {acoes.map((a) => (
                      <Link key={a.id} to={a.link}
                        className={`flex items-center gap-2 p-2 rounded border transition-colors ${
                          a.severity === "crit"
                            ? "border-rose-200 bg-rose-50/60 hover:bg-rose-50"
                            : "border-slate-200 hover:bg-slate-50"
                        }`}>
                        <div className={`w-1.5 self-stretch rounded-full ${a.severity === "crit" ? "bg-[#7f1212]" : "bg-amber-500"} ${a.severity === "crit" ? "animate-pulse" : ""}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-bold text-slate-900 truncate">{a.titulo}</div>
                          <div className="text-[9px] text-slate-500 truncate">{a.sub}</div>
                        </div>
                        <ChevronRight className="h-3 w-3 text-slate-400 shrink-0" />
                      </Link>
                    ))}
                  </div>
                )}
              </BiCard>

              <BiCard
                title="Próximos 7 Dias"
                className="col-span-12 sm:col-span-5"
                action={<Calendar className="h-3 w-3 text-slate-400" />}
              >
                {proximos7.length === 0 ? (
                  <div className="py-5 text-center text-emerald-600 text-[10px] font-bold uppercase tracking-wider">
                    Sem vencimentos
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {proximos7.map((e, i) => {
                      const d = new Date(e.date + "T00:00");
                      return (
                        <div key={i} className="flex gap-2 items-start p-1.5 rounded hover:bg-slate-50">
                          <div className="text-center shrink-0 w-8 bg-slate-100 rounded py-0.5">
                            <div className="text-[7px] font-black text-slate-400 uppercase leading-none">{MONTHS_PT[d.getMonth()]}</div>
                            <div className={`text-sm font-black leading-tight ${e.severity === "crit" ? "text-[#7f1212]" : "text-slate-700"}`}>
                              {String(d.getDate()).padStart(2, "0")}
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              <span className={`text-[8px] font-black uppercase tracking-wider px-1 py-px rounded ${
                                e.tipo === "ASO" ? "bg-amber-100 text-amber-700"
                                  : e.tipo === "EXT" ? "bg-rose-100 text-[#7f1212]"
                                  : "bg-slate-100 text-slate-600"
                              }`}>{e.tipo}</span>
                              <span className="text-[10px] font-bold text-slate-800 truncate">{e.titulo}</span>
                            </div>
                            <div className="text-[9px] text-slate-500 truncate">{e.sub}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </BiCard>
            </div>

            {/* Linha 4: Módulos (3 cards densos) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <ModuleStat to="/app/controle-documentos" icon={FolderOpen} title="Documentos" primary={docMetrics.abertos} primaryLabel="abertos"
                stats={[
                  { label: "Críticos", value: docMetrics.criticos, tone: docMetrics.criticos > 0 ? "crit" : "neutral" },
                  { label: "Vencidos", value: docMetrics.vencidos, tone: docMetrics.vencidos > 0 ? "crit" : "neutral" },
                  { label: "Resolvidos", value: docMetrics.resolvidos, tone: "ok" },
                ]} />
              <ModuleStat to="/app/extintores" icon={Flame} title="Extintores" primary={extMetrics.ativos} primaryLabel="ativos"
                stats={[
                  { label: "Vencidos", value: extMetrics.vencidos, tone: extMetrics.vencidos > 0 ? "crit" : "neutral" },
                  { label: "Vence 30d", value: extMetrics.vencendo, tone: extMetrics.vencendo > 0 ? "warn" : "neutral" },
                  { label: "S/ insp.", value: extMetrics.semInspecao, tone: extMetrics.semInspecao > 0 ? "warn" : "ok" },
                ]} />
              <ModuleStat to="/app/estoque/epi" icon={Package} title="Estoque EPI" primary={estoqueBaixo + caVencendo} primaryLabel="atenção"
                stats={[
                  { label: "Baixo", value: estoqueBaixo, tone: estoqueBaixo > 0 ? "crit" : "ok" },
                  { label: "CAs venc.", value: caVencendo, tone: caVencendo > 0 ? "warn" : "ok" },
                  { label: "Entreg.", value: totalEntregas, tone: "neutral" },
                ]} />
            </div>
          </div>

          {/* ============ COLUNA DIREITA (3 cols) ============ */}
          <aside className="col-span-12 lg:col-span-3 flex flex-col gap-3">

            {/* DONUT Conformidade Geral */}
            <BiCard title="Status Geral" tight>
              <div className="relative h-40">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={donutData.length > 0 ? donutData : [{ name: "—", value: 1, fill: "#e2e8f0" }]}
                      dataKey="value" innerRadius={42} outerRadius={62} paddingAngle={2} stroke="#fff" strokeWidth={2}>
                      {(donutData.length > 0 ? donutData : [{ fill: "#e2e8f0" }]).map((d: any, i: number) => (
                        <Cell key={i} fill={d.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #cbd5e1" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className={`text-2xl font-black tabular-nums leading-none ${
                    conformidadeFiltro >= 90 ? "text-emerald-600" : conformidadeFiltro >= 70 ? "text-amber-600" : "text-[#7f1212]"
                  }`}>{conformidadeFiltro}%</div>
                  <div className="text-[8px] font-black uppercase tracking-widest text-slate-400 mt-0.5">Conformidade</div>
                </div>
              </div>
              <div className="flex justify-around pt-2 mt-1 border-t border-slate-100 text-[9px]">
                <Legenda cor="bg-emerald-500" label={`${aptos}`} />
                <Legenda cor="bg-amber-500" label={`${alertas}`} />
                <Legenda cor="bg-[#7f1212]" label={`${bloqueados}`} />
              </div>
            </BiCard>

            {/* RANKING Empresas com mais pendências */}
            <BiCard title="Ranking · Pendências">
              {pendPorEmpresa.length === 0 ? (
                <div className="py-4 text-center text-emerald-600 text-[10px] font-black uppercase tracking-wider">
                  ✓ Sem pendências
                </div>
              ) : (
                <div className="space-y-1">
                  {pendPorEmpresa.map((p, i) => {
                    const total = p.alerta + p.bloq;
                    return (
                      <div key={p.id} className="flex items-center gap-2 py-1 border-b border-slate-100 last:border-0">
                        <span className="text-[9px] font-black text-slate-400 w-3 text-right">{i + 1}</span>
                        <div className="w-5 h-5 rounded bg-gradient-to-br from-[#0c2340] to-[#1a4a6e] flex items-center justify-center text-[8px] font-black text-white shrink-0">
                          {p.name.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="text-[10px] text-slate-800 truncate font-bold flex-1">{p.name}</span>
                        <div className="flex gap-1 shrink-0">
                          {p.bloq > 0 && <span className="bg-[#7f1212] text-white text-[8px] font-black px-1 py-0.5 rounded leading-none">{p.bloq}</span>}
                          {p.alerta > 0 && <span className="bg-amber-500 text-white text-[8px] font-black px-1 py-0.5 rounded leading-none">{p.alerta}</span>}
                          <span className="text-[9px] font-black text-slate-700 tabular-nums w-4 text-right">{total}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </BiCard>

            {/* MEDIDORES VERTICAIS estilo "Tempo na Função" */}
            <BiCard title="Medidores · SST">
              <div className="grid grid-cols-4 gap-2 pt-1">
                <VerticalGauge label="ASOs OK" value={Math.max(0, totalEmp - asoVencidos - asoVencendo30)} max={Math.max(1, totalEmp)} color="#10b981" />
                <VerticalGauge label="APRs" value={aprsAtivas} max={Math.max(1, aprsAtivas + 5)} color="#0c2340" />
                <VerticalGauge label="Ext. OK" value={Math.max(0, extMetrics.ativos - extMetrics.vencidos)} max={Math.max(1, extMetrics.ativos)} color="#1a4a6e" />
                <VerticalGauge label="DDS Ad." value={ddsAderencia} max={100} color="#6d28d9" suffix="%" />
              </div>
            </BiCard>
          </aside>
        </div>

        {isLoading && (
          <div className="text-center text-xs text-slate-400 py-2 animate-pulse">Carregando dados…</div>
        )}
      </div>
    </div>
  );
}

// === Subcomponentes ===

function BiCard({
  title, children, className, action, tight, noTitle,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
  tight?: boolean;
  noTitle?: boolean;
}) {
  return (
    <div className={`bg-white rounded-md border border-slate-300 shadow-sm ${tight ? "p-2" : "p-3"} ${className ?? ""}`}>
      {!noTitle && title && (
        <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-100">
          <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-[#0c2340]">{title}</h3>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

function FilterChip({ label, value, color, active }: { label: string; value: number; color: string; active?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between px-2 py-1.5 rounded border text-[10px] font-bold transition-colors ${
        active ? "bg-slate-900 text-white border-slate-900" : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
      }`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: color }} />
        <span className="truncate uppercase tracking-wider">{label}</span>
      </div>
      <span className="font-black tabular-nums">{value}</span>
    </div>
  );
}

function VerticalGauge({ label, value, max, color, suffix }: { label: string; value: number; max: number; color: string; suffix?: string }) {
  const pct = Math.max(2, Math.min(100, Math.round((value / max) * 100)));
  return (
    <div className="flex flex-col items-center">
      <div className="text-[10px] font-black tabular-nums text-slate-900 leading-none mb-1">
        {value}{suffix ?? ""}
      </div>
      <div className="relative h-20 w-3.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
        <div
          className="absolute bottom-0 left-0 right-0 rounded-full transition-all duration-700"
          style={{ height: `${pct}%`, background: `linear-gradient(180deg,${color},${color}cc)`, boxShadow: `0 0 6px ${color}80` }}
        />
      </div>
      <div className="text-[7px] font-black uppercase tracking-wider text-slate-500 mt-1 text-center leading-tight">{label}</div>
    </div>
  );
}

function Legenda({ cor, label }: { cor: string; label: string }) {
  return (
    <div className="flex items-center gap-1 text-[10px] text-slate-600 font-black tabular-nums">
      <div className={`h-2 w-2 rounded-full ${cor}`} /> {label}
    </div>
  );
}

function EmptyBlock({ label }: { label: string }) {
  return (
    <div className="h-full w-full flex items-center justify-center text-[10px] font-bold uppercase tracking-wider text-slate-400 py-4">
      {label}
    </div>
  );
}

function ModuleStat({
  to, icon: Icon, title, primary, primaryLabel, stats,
}: {
  to: string;
  icon: any;
  title: string;
  primary: number;
  primaryLabel: string;
  stats: { label: string; value: number; tone: "ok" | "warn" | "crit" | "neutral" }[];
}) {
  return (
    <Link to={to} className="bg-white rounded-md border border-slate-300 shadow-sm p-3 hover:border-[#7f1212] hover:shadow-md transition-all group">
      <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-100">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-[#0c2340]" />
          <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-[#0c2340]">{title}</h4>
        </div>
        <ChevronRight className="h-3 w-3 text-slate-300 group-hover:text-[#7f1212] transition-colors" />
      </div>
      <div className="flex items-baseline gap-1.5 mb-2">
        <span className="text-xl font-black text-slate-900 tabular-nums">{primary}</span>
        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{primaryLabel}</span>
      </div>
      <div className="grid grid-cols-3 gap-1 pt-2 border-t border-slate-100">
        {stats.map((s) => {
          const cls = s.tone === "crit" ? "text-[#7f1212]"
            : s.tone === "warn" ? "text-amber-600"
            : s.tone === "ok" ? "text-emerald-600"
            : "text-slate-700";
          return (
            <div key={s.label} className="text-center">
              <div className={`text-xs font-black tabular-nums ${cls}`}>{s.value}</div>
              <div className="text-[7px] font-bold uppercase tracking-wider text-slate-400 mt-0.5 truncate">{s.label}</div>
            </div>
          );
        })}
      </div>
    </Link>
  );
}