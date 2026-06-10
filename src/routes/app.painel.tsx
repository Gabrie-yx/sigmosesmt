import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Search, AlertTriangle, ShieldCheck, Stethoscope, ClipboardCheck,
  Flame, Calendar, ArrowRight, ChevronRight, FolderOpen, Package,
  FileWarning, TrendingUp, Activity, MessageSquare,
} from "lucide-react";
import { calculateSafetyStatus } from "@/lib/safety-engine";
import { type SafetyOverride } from "@/lib/safety-overrides";
import {
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  ComposedChart, Line, Area, Bar,
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

  return (
    <div className="h-full overflow-y-auto bg-slate-50 custom-scrollbar">
      <div className="max-w-[1600px] mx-auto p-4 md:p-6 flex flex-col gap-5">

        {/* === Header & Filters === */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-3 tracking-tight">
              <span className="bg-[#7f1212] text-white px-3 py-1 rounded text-sm font-black uppercase tracking-tighter">DMN</span>
              Painel SESMT Executivo
            </h1>
            <p className="text-slate-500 text-xs mt-1">SGI · ISO 9001 · NRs — Gestão integrada de SST</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
              <select
                value={filterCompany}
                onChange={(e) => setFilterCompany(e.target.value)}
                className="text-xs font-medium text-slate-600 px-3 py-1.5 bg-transparent border-none outline-none focus:ring-0 cursor-pointer"
              >
                <option value="ALL">Todas as empresas</option>
                {(data?.companies ?? []).map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <div className="h-4 w-px bg-slate-200" />
              <div className="flex items-center">
                {(["30", "60", "90", "180"] as const).map((p) => (
                  <button key={p} onClick={() => setPeriodo(p)}
                    className={`px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wider rounded transition-colors ${
                      periodo === p ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
                    }`}>{p}d</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* === Top Executive KPIs === */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label="Conformidade Geral"
            value={`${conformidadeFiltro}%`}
            barPct={conformidadeFiltro}
            barTone={conformidadeFiltro >= 90 ? "ok" : conformidadeFiltro >= 70 ? "warn" : "crit"}
            badge={conformidadeFiltro >= 90 ? { text: "OK", tone: "ok" } : conformidadeFiltro >= 70 ? { text: "Atenção", tone: "warn" } : { text: "Crítico", tone: "crit" }}
          />
          <KpiCard
            label="Bloqueados"
            value={String(bloqueados).padStart(2, "0")}
            sub={`${alertas} em alerta · ${aptos} aptos`}
            critical
            pulse={bloqueados > 0}
          />
          <KpiCard
            label="Exames Pendentes"
            value={asoVencendo30 + asoVencidos}
            sub={`${asoVencidos} vencido${asoVencidos !== 1 ? "s" : ""} · ${asoVencendo30} em 30 dias`}
            badge={asoVencidos > 0 ? { text: "Crítico", tone: "crit" } : asoVencendo30 > 0 ? { text: "Atenção", tone: "warn" } : { text: "OK", tone: "ok" }}
          />
          <KpiCard
            label="Pendências Ativas"
            value={alertas + bloqueados}
            sub={`${aprsAtivas} APRs · ${ptesAtivas} PTEs abertas`}
          />
        </div>

        {/* === Main Grid === */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* LEFT COL (2/3) */}
          <div className="lg:col-span-2 space-y-5">

            {/* Conformidade por Empresa */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex justify-between items-center mb-5">
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Conformidade por Empresa</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Distribuição de colaboradores por status</p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {totalEmp} colab.
                </span>
              </div>

              {conformityView.length === 0 ? (
                <EmptyBlock label="Sem empresas com colaboradores no período" />
              ) : (
                <div className="space-y-5">
                  {conformityView.map((c: any) => (
                    <div key={c.id} className="group">
                      <div className="flex justify-between text-xs mb-2 font-medium items-end">
                        <div className="min-w-0 pr-2">
                          <div className="text-slate-800 font-bold truncate">{c.name}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            <span className="text-emerald-600 font-bold">{c.oks}</span> aptos ·{" "}
                            <span className="text-amber-600 font-bold">{c.al}</span> alerta ·{" "}
                            <span className="text-[#7f1212] font-bold">{c.bl}</span> crítico
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-slate-400">{c.total}</span>
                          <span
                            className={`text-base font-black tabular-nums tracking-tight ${
                              c.score >= 90 ? "text-emerald-600" : c.score >= 70 ? "text-amber-600" : "text-[#7f1212]"
                            }`}
                            style={{
                              textShadow:
                                c.score >= 90
                                  ? "0 0 12px rgba(16,185,129,0.35)"
                                  : c.score >= 70
                                    ? "0 0 12px rgba(245,158,11,0.35)"
                                    : "0 0 12px rgba(127,18,18,0.4)",
                            }}
                          >
                            {c.score}%
                          </span>
                        </div>
                      </div>
                      <div className="relative w-full h-3 rounded-full overflow-hidden bg-slate-100 shadow-inner">
                        <div className="absolute inset-0 flex">
                          <div
                            className="h-full transition-all duration-700 ease-out"
                            style={{
                              width: `${c.okPct}%`,
                              background: "linear-gradient(90deg,#34d399 0%,#10b981 100%)",
                              boxShadow: c.okPct > 0 ? "0 0 8px rgba(16,185,129,0.55)" : undefined,
                            }}
                            title={`${c.oks} aptos`}
                          />
                          <div
                            className="h-full transition-all duration-700 ease-out"
                            style={{
                              width: `${c.alPct}%`,
                              background: "linear-gradient(90deg,#fbbf24 0%,#f59e0b 100%)",
                              boxShadow: c.alPct > 0 ? "0 0 8px rgba(245,158,11,0.5)" : undefined,
                            }}
                            title={`${c.al} em alerta`}
                          />
                          <div
                            className="h-full transition-all duration-700 ease-out"
                            style={{
                              width: `${c.blPct}%`,
                              background: "linear-gradient(90deg,#b91c1c 0%,#7f1212 100%)",
                              boxShadow: c.blPct > 0 ? "0 0 10px rgba(127,18,18,0.65)" : undefined,
                            }}
                            title={`${c.bl} bloqueados`}
                          />
                        </div>
                        {/* shine overlay */}
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/40 via-transparent to-black/10" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-5 flex gap-4 border-t border-slate-100 pt-3">
                <Legenda cor="bg-emerald-500" label="Aptos" />
                <Legenda cor="bg-amber-400" label="Alerta" />
                <Legenda cor="bg-[#7f1212]" label="Crítico" />
              </div>
            </div>

            {/* Ações Recomendadas */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 text-sm">Ações Recomendadas</h3>
                <Link to="/app/hoje" className="text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-[#7f1212] flex items-center gap-1">
                  Ver tudo <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              {acoes.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-emerald-600 text-xs font-black uppercase tracking-wider gap-2">
                  <ShieldCheck className="h-4 w-4" /> Nenhuma ação prioritária no momento
                </div>
              ) : (
                <div className="space-y-2">
                  {acoes.map((a) => (
                    <Link key={a.id} to={a.link}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        a.severity === "crit"
                          ? "border-rose-100 bg-rose-50/40 hover:bg-rose-50"
                          : "border-slate-100 hover:bg-slate-50"
                      }`}>
                      <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                        a.severity === "crit" ? "bg-rose-100" : "bg-amber-100"
                      }`}>
                        <div className={`w-2 h-2 rounded-full ${a.severity === "crit" ? "bg-[#7f1212]" : "bg-amber-600"} ${a.severity === "crit" ? "animate-pulse" : ""}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-slate-900 truncate">{a.titulo}</div>
                        <div className="text-[10px] text-slate-500 truncate">{a.sub}</div>
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded shrink-0 ${
                        a.severity === "crit" ? "text-[#7f1212] hover:bg-rose-100" : "text-slate-600 hover:bg-slate-100"
                      }`}>
                        Tratar
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Gráficos Operacionais (drill-down) */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-slate-400" /> Fluxo de EPI
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Volume por motivo + valor R$</p>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">{totalEntregas} itens · R$ {valorEntregas.toFixed(0)}</span>
                </div>
                <div className="h-52">
                  {entregaSerie.length === 0 ? <EmptyBlock label="Sem entregas no período" /> : (
                    <ResponsiveContainer>
                      <ComposedChart data={entregaSerie} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="l" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={28} />
                        <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={42} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`} />
                        <Tooltip contentStyle={{ background: "#0f172a", border: "none", borderRadius: 8, color: "#fff", fontSize: 11 }} labelStyle={{ color: "#cbd5e1", fontWeight: 700 }} formatter={(v: any, n: any) => n === "Valor R$" ? [`R$ ${Number(v).toFixed(0)}`, n] : [v, n]} />
                        <Area yAxisId="l" type="monotone" dataKey="primeira" stackId="a" stroke="#0ea5e9" strokeWidth={1.5} fill="#0ea5e9" fillOpacity={0.15} name="1ª entrega" />
                        <Area yAxisId="l" type="monotone" dataKey="troca" stackId="a" stroke="#8b5cf6" strokeWidth={1.5} fill="#8b5cf6" fillOpacity={0.15} name="Troca" />
                        <Area yAxisId="l" type="monotone" dataKey="perda" stackId="a" stroke="#7f1212" strokeWidth={1.5} fill="#7f1212" fillOpacity={0.15} name="Perda" />
                        <Line yAxisId="r" type="monotone" dataKey="valor" stroke="#7f1212" strokeWidth={2} dot={false} name="Valor R$" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-slate-400" /> DDS · Evolução
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">Quantidade × aderência mensal</p>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">{ddsCount} · {ddsAderencia}%</span>
                </div>
                <div className="h-52">
                  {ddsTrend.length === 0 ? <EmptyBlock label="Sem DDS no período" /> : (
                    <ResponsiveContainer>
                      <ComposedChart data={ddsTrend} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="l" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={26} />
                        <YAxis yAxisId="r" orientation="right" domain={[0, 100]} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={32} tickFormatter={(v) => `${v}%`} />
                        <Tooltip contentStyle={{ background: "#0f172a", border: "none", borderRadius: 8, color: "#fff", fontSize: 11 }} labelStyle={{ color: "#cbd5e1", fontWeight: 700 }} />
                        <Bar yAxisId="l" dataKey="qtd" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="DDS realizados" />
                        <Line yAxisId="r" type="monotone" dataKey="aderencia" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: "#10b981", stroke: "#fff", strokeWidth: 1.5 }} name="% aderência" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            {/* Módulos Compactos */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <ModuleStat
                to="/app/controle-documentos"
                icon={FolderOpen}
                title="Documentos"
                primary={docMetrics.abertos}
                primaryLabel="abertos"
                stats={[
                  { label: "Críticos", value: docMetrics.criticos, tone: docMetrics.criticos > 0 ? "crit" : "neutral" },
                  { label: "Vencidos", value: docMetrics.vencidos, tone: docMetrics.vencidos > 0 ? "crit" : "neutral" },
                  { label: "Resolvidos", value: docMetrics.resolvidos, tone: "ok" },
                ]}
              />
              <ModuleStat
                to="/app/extintores"
                icon={Flame}
                title="Extintores"
                primary={extMetrics.ativos}
                primaryLabel="ativos"
                stats={[
                  { label: "Vencidos", value: extMetrics.vencidos, tone: extMetrics.vencidos > 0 ? "crit" : "neutral" },
                  { label: "Vencendo 30d", value: extMetrics.vencendo, tone: extMetrics.vencendo > 0 ? "warn" : "neutral" },
                  { label: "Sem inspeção", value: extMetrics.semInspecao, tone: extMetrics.semInspecao > 0 ? "warn" : "ok" },
                ]}
              />
              <ModuleStat
                to="/app/estoque/epi"
                icon={Package}
                title="Estoque EPI"
                primary={estoqueBaixo + caVencendo}
                primaryLabel="atenção"
                stats={[
                  { label: "Estoque baixo", value: estoqueBaixo, tone: estoqueBaixo > 0 ? "crit" : "ok" },
                  { label: "CAs vencendo", value: caVencendo, tone: caVencendo > 0 ? "warn" : "ok" },
                  { label: "EPIs entregues", value: totalEntregas, tone: "neutral" },
                ]}
              />
            </div>
          </div>

          {/* RIGHT COL (1/3) */}
          <div className="space-y-5">

            {/* Busca universal */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="relative">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar colaborador, CPF, função..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-[#7f1212]/20 focus:border-[#7f1212] transition-all placeholder:text-slate-400 placeholder:font-normal"
                />
              </div>
              {search && (
                <div className="mt-3 space-y-1 max-h-56 overflow-y-auto">
                  {searchResults.length === 0 ? (
                    <div className="text-center text-slate-400 py-3 text-[10px] font-bold uppercase">Nenhum resultado</div>
                  ) : searchResults.map((r) => (
                    <Link key={r.emp.id} to="/app/employees/$id" params={{ id: r.emp.id }}
                      className="flex items-center justify-between p-2 border border-slate-100 rounded-md hover:border-[#7f1212] hover:bg-slate-50 transition-all">
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-slate-900 truncate">{r.emp.nome}</div>
                        <div className="text-[9px] text-slate-500 mt-0.5 truncate">{r.company} · {r.role?.name ?? "Sem cargo"}</div>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${r.status.colorClass} text-white shrink-0 ml-2`}>{r.status.label}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Próximos 7 dias */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h3 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-400" /> Próximos 7 dias
              </h3>
              {proximos7.length === 0 ? (
                <div className="py-6 text-center text-emerald-600 text-xs font-bold uppercase tracking-wider">
                  Sem vencimentos próximos
                </div>
              ) : (
                <div className="space-y-3">
                  {proximos7.map((e, i) => {
                    const d = new Date(e.date + "T00:00");
                    return (
                      <div key={i} className="flex gap-3 items-start">
                        <div className="text-center shrink-0 w-10">
                          <div className="text-[9px] font-bold text-slate-400 uppercase">{MONTHS_PT[d.getMonth()]}</div>
                          <div className={`text-lg font-black leading-none ${e.severity === "crit" ? "text-[#7f1212]" : "text-slate-700"}`}>
                            {String(d.getDate()).padStart(2, "0")}
                          </div>
                        </div>
                        <div className="border-l border-slate-100 pl-3 py-0.5 min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                              e.tipo === "ASO" ? "bg-amber-100 text-amber-700"
                                : e.tipo === "EXT" ? "bg-rose-100 text-[#7f1212]"
                                : "bg-slate-100 text-slate-600"
                            }`}>{e.tipo}</span>
                            <span className="text-xs font-bold text-slate-800 truncate">{e.titulo}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 truncate mt-0.5">{e.sub}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <Link to="/app/hoje" className="w-full mt-5 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center justify-center gap-1.5">
                Ver agenda completa <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            {/* Pendências por Empresa (card bordô assinatura) */}
            <div className="bg-gradient-to-br from-[#7f1212] to-[#5a0c0c] p-5 rounded-xl border border-rose-950 shadow-lg text-white">
              <h3 className="font-bold text-white text-sm mb-1 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Pendências por Empresa
              </h3>
              <p className="text-[10px] text-rose-200 mb-4">Quem tem mais bloqueios e alertas</p>
              {pendPorEmpresa.length === 0 ? (
                <div className="py-6 text-center text-rose-100 text-xs font-bold uppercase">
                  ✓ Sem pendências
                </div>
              ) : (
                <div className="space-y-3">
                  {pendPorEmpresa.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-rose-800/60 border border-rose-700/60 flex items-center justify-center text-[10px] font-black text-white shrink-0">
                          {p.name.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="text-xs text-rose-50 truncate font-medium">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {p.alerta > 0 && (
                          <span className="bg-amber-400/20 border border-amber-300/40 text-amber-100 text-[10px] font-black px-1.5 py-0.5 rounded">{p.alerta} ⚠</span>
                        )}
                        {p.bloq > 0 && (
                          <span className="bg-white text-[#7f1212] text-[10px] font-black px-1.5 py-0.5 rounded">{p.bloq} ✕</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-4 text-[9px] text-rose-300 italic">Use o filtro de empresa acima para detalhar</p>
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="text-center text-xs text-slate-400 py-4 animate-pulse">Carregando dados…</div>
        )}
      </div>
    </div>
  );
}

// === Subcomponentes ===

function KpiCard({
  label, value, sub, badge, critical, pulse, barPct, barTone,
}: {
  label: string;
  value: string | number;
  sub?: string;
  badge?: { text: string; tone: "ok" | "warn" | "crit" };
  critical?: boolean;
  pulse?: boolean;
  barPct?: number;
  barTone?: "ok" | "warn" | "crit";
}) {
  const badgeCls = badge?.tone === "ok" ? "text-emerald-600 bg-emerald-50"
    : badge?.tone === "warn" ? "text-amber-600 bg-amber-50"
    : "text-[#7f1212] bg-rose-50";
  const barCls = barTone === "ok" ? "bg-emerald-500"
    : barTone === "warn" ? "bg-amber-500"
    : "bg-[#7f1212]";
  return (
    <div className={`bg-white p-4 rounded-xl border shadow-sm ${critical ? "border-l-4 border-l-[#7f1212] border-y-slate-200 border-r-slate-200" : "border-slate-200"}`}>
      <div className="flex justify-between items-start mb-2 gap-2">
        <span className={`text-[10px] font-bold uppercase tracking-wider ${critical ? "text-[#7f1212]" : "text-slate-500"}`}>{label}</span>
        {badge && <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${badgeCls}`}>{badge.text}</span>}
        {pulse && <div className="h-2 w-2 rounded-full bg-[#7f1212] animate-pulse mt-1" />}
      </div>
      <div className={`text-3xl font-bold ${critical ? "text-rose-950" : "text-slate-900"} tabular-nums`}>{value}</div>
      {sub && <p className={`text-[10px] mt-2 font-medium ${critical ? "text-rose-700" : "text-slate-500"}`}>{sub}</p>}
      {barPct !== undefined && (
        <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
          <div className={`${barCls} h-full transition-all`} style={{ width: `${Math.max(0, Math.min(100, barPct))}%` }} />
        </div>
      )}
    </div>
  );
}

function Legenda({ cor, label }: { cor: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
      <div className={`h-2 w-2 rounded-full ${cor}`} /> {label}
    </div>
  );
}

function EmptyBlock({ label }: { label: string }) {
  return (
    <div className="h-full w-full flex items-center justify-center text-[11px] font-bold uppercase tracking-wider text-slate-400 py-8">
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
    <Link to={to} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-[#7f1212] hover:shadow-md transition-all group">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-slate-100 group-hover:bg-rose-50 flex items-center justify-center transition-colors">
            <Icon className="h-3.5 w-3.5 text-slate-600 group-hover:text-[#7f1212]" />
          </div>
          <h4 className="text-xs font-bold text-slate-800">{title}</h4>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-[#7f1212] transition-colors" />
      </div>
      <div className="flex items-baseline gap-1.5 mb-3">
        <span className="text-2xl font-bold text-slate-900 tabular-nums">{primary}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{primaryLabel}</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5 pt-3 border-t border-slate-100">
        {stats.map((s) => {
          const cls = s.tone === "crit" ? "text-[#7f1212]"
            : s.tone === "warn" ? "text-amber-600"
            : s.tone === "ok" ? "text-emerald-600"
            : "text-slate-700";
          return (
            <div key={s.label} className="text-center">
              <div className={`text-sm font-bold tabular-nums ${cls}`}>{s.value}</div>
              <div className="text-[8px] font-bold uppercase tracking-wider text-slate-400 mt-0.5 truncate">{s.label}</div>
            </div>
          );
        })}
      </div>
    </Link>
  );
}