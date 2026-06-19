import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Search, ShieldCheck, Flame, Calendar, ArrowRight, ChevronRight, FolderOpen, Package,
  Users, AlertTriangle, ShieldAlert, TrendingUp, Repeat, GraduationCap, ClipboardCheck, Eye,
  Trophy, Target, MessageSquare, Activity, AlertOctagon, FilePlus2,
} from "lucide-react";
import { calculateSafetyStatus } from "@/lib/safety-engine";
import { type SafetyOverride } from "@/lib/safety-overrides";
import {
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  ComposedChart, Line, Area, Bar, BarChart, PieChart, Pie, Cell, LabelList,
  RadialBarChart, RadialBar, LineChart, Legend,
} from "recharts";

export const Route = createFileRoute("/app/painel")({
  component: TstPanel,
});

const dayMs = 86400000;
const today = new Date();
const fmt = (d: Date) => d.toISOString().slice(0, 10);
const MONTHS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

// Tooltip dark theme padrão (usado em todos os charts)
const tooltipDark = {
  fontSize: 11,
  borderRadius: 10,
  border: "1px solid #334155",
  background: "rgba(2, 6, 23, 0.92)",
  color: "#f1f5f9",
  boxShadow: "0 10px 30px -10px rgba(0,0,0,0.6)",
} as const;

function TstPanel() {
  const [q, setQ] = useState("");
  const [filterCompany, setFilterCompany] = useState("ALL");
  const [periodo, setPeriodo] = useState<"30" | "60" | "90" | "180">("90");

  const dias = Number(periodo);
  const since = fmt(new Date(today.getTime() - dias * dayMs));

  const { data, isLoading } = useQuery({
    queryKey: ["sesmt-painel", since],
    queryFn: async () => {
      const since6m = fmt(new Date(today.getTime() - 180 * dayMs));
      const since12m = fmt(new Date(today.getTime() - 365 * dayMs));
      const [emps, comps, roles, exams, overrides, deliveries, estoque, dds, aprs, ptes, controleDocs, extintores, extInspecoes, planoAcoes, trainCourses, trainEntries, incidentes, acidentes, hht] = await Promise.all([
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
        supabase.from("plano_acoes").select("id,status,quando,data_conclusao,created_at"),
        supabase.from("training_matrix_courses").select("id,codigo,nome,categoria,periodicidade,ativo").eq("ativo", true),
        supabase.from("training_matrix_entries").select("id,course_id,employee_id,data_realizacao,status_override"),
        supabase.from("incidentes").select("id,tipo,gravidade,data_ocorrencia,status").gte("data_ocorrencia", since6m),
        supabase.from("acidentes_trabalho").select("id,company_id,tipo,data_acidente,dias_perdidos").gte("data_acidente", since12m),
        supabase.from("hht_mensal").select("ano,mes,company_id,hht"),
      ]);
      const recordesRes = await supabase
        .from("dias_sem_acidente_recordes")
        .select("id,company_id,escopo,recorde_dias,data_inicio,data_recorde");
      const ossRes = await supabase
        .from("oss_emissoes")
        .select("employee_id,status,expira_em")
        .eq("status", "ASSINADO");
      const settingsRes = await supabase
        .from("company_settings")
        .select("meta_dds_semana,meta_dds_dias_semana,meta_inspecoes_pct,meta_treinamentos_pct,meta_aso_pct,meta_acidentes_taxa_max_pct,meta_dias_perdidos_max_mes")
        .limit(1)
        .maybeSingle();
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
        planoAcoes: planoAcoes.data ?? [],
        trainCourses: trainCourses.data ?? [],
        trainEntries: trainEntries.data ?? [],
        incidentes: incidentes.data ?? [],
        recordes: recordesRes.data ?? [],
        acidentes: acidentes.data ?? [],
        hht: hht.data ?? [],
        settings: settingsRes.data ?? null,
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
    { name: "Crítico", value: bloqueados, fill: "#be123c" },
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
    { name: "ALERTA", value: alertas, fill: "#fbbf24" },
    { name: "BLOQ.", value: bloqueados, fill: "#f43f5e" },
  ];

  // Top 5 empresas ordenadas por pendência (barras horizontais com %)
  const top5Pend = useMemo(() => {
    const items = conformityStacked.slice(0, 5).map((c: any) => {
      const pendPct = Math.round(((c.al + c.bl) / Math.max(1, c.total)) * 100);
      return { name: c.name, value: pendPct, total: c.total, score: c.score };
    });
    return items.sort((a, b) => b.value - a.value);
  }, [conformityStacked]);

  // Top 5 motivos de entrega EPI (barras horizontais com %)
  const motivoEntrega = useMemo(() => {
    const totals = { "1ª Entrega": 0, "Troca": 0, "Perda": 0, "Devolução": 0, "Outros": 0 };
    entregaSerie.forEach((e: any) => {
      totals["1ª Entrega"] += e.primeira;
      totals["Troca"] += e.troca;
      totals["Perda"] += e.perda;
      totals["Devolução"] += e.devolucao;
      totals["Outros"] += e.outros;
    });
    const sum = Object.values(totals).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(totals)
      .map(([name, v]) => ({ name, value: Math.round((v / sum) * 100), abs: v }))
      .filter((d) => d.abs > 0)
      .sort((a, b) => b.value - a.value);
  }, [entregaSerie]);

  // Donut módulos (distribuição de atividades SESMT)
  const modulosDonut = [
    { name: "APRs", value: aprsAtivas, fill: "#22d3ee" },
    { name: "PTEs", value: ptesAtivas, fill: "#0891b2" },
    { name: "DDS", value: ddsCount, fill: "#10b981" },
    { name: "Extint.", value: extMetrics.ativos, fill: "#f43f5e" },
  ].filter((d) => d.value > 0);
  const modTotal = modulosDonut.reduce((s, d) => s + d.value, 0);

  // === ASO Donut (Em dia / Vence 30d / Vencidos) ===
  const totalExames = (data?.exams ?? []).length;
  const asoEmDia = Math.max(0, totalExames - asoVencendo30 - asoVencidos);
  const asoDonut = [
    { name: "Em dia", value: asoEmDia, fill: "#10b981" },
    { name: "Vence 30d", value: asoVencendo30, fill: "#fbbf24" },
    { name: "Vencidos", value: asoVencidos, fill: "#f43f5e" },
  ].filter((d) => d.value > 0);
  const asoConformPct = totalExames > 0 ? Math.round((asoEmDia / totalExames) * 100) : 0;

  // === Pareto: Empresas por nº de colaboradores (barras + acumulado %) ===
  const paretoEmpresas = useMemo(() => {
    const arr = (data?.companies ?? []).map((c: any) => ({
      name: c.name.length > 12 ? c.name.slice(0, 12) + "…" : c.name,
      qtd: rows.filter((r) => r.emp.company_id === c.id).length,
    })).filter((c) => c.qtd > 0).sort((a, b) => b.qtd - a.qtd).slice(0, 6);
    const total = arr.reduce((s, a) => s + a.qtd, 0) || 1;
    let acc = 0;
    return arr.map((a) => {
      acc += a.qtd;
      return { ...a, acumulado: Math.round((acc / total) * 100) };
    });
  }, [data, rows]);

  // === Extintores: barras por status ===
  const extintoresBars = [
    { name: "Ativos", value: extMetrics.ativos, fill: "#10b981" },
    { name: "Vence 30d", value: extMetrics.vencendo, fill: "#fbbf24" },
    { name: "Vencidos", value: extMetrics.vencidos, fill: "#f43f5e" },
    { name: "S/ Insp.", value: extMetrics.semInspecao, fill: "#22d3ee" },
  ];

  // === Documentos: Abertos x Resolvidos por mês (últimos 6 meses) ===
  const docsMensal = useMemo(() => {
    const out: { mes: string; abertos: number; resolvidos: number }[] = [];
    const all = (data?.controleDocs ?? []) as any[];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const next = new Date(today.getFullYear(), today.getMonth() - i + 1, 1);
      const sIso = fmt(d), eIso = fmt(next);
      const abertos = all.filter((x) => x.created_at && x.created_at >= sIso && x.created_at < eIso).length;
      const resolvidos = all.filter((x) => (x.status === "RESOLVIDO" || x.status === "FECHADO") && x.updated_at && x.updated_at >= sIso && x.updated_at < eIso).length;
      out.push({ mes: `${MONTHS_PT[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`, abertos, resolvidos });
    }
    return out;
  }, [data]);

  // === Radial: aderência DDS / cobertura ===
  const radialDDS = [
    { name: "Aderência", value: ddsAderencia, fill: ddsAderencia >= 90 ? "#10b981" : ddsAderencia >= 70 ? "#fbbf24" : "#f43f5e" },
  ];

  // === NOVO 07 · Reincidência EPI por colaborador ===
  // Conta entregas com motivo PERDA/EXTRAVIO/TROCA por colaborador
  const reincidenciaEPI = useMemo(() => {
    const map = new Map<string, { id: string; nome: string; perda: number; troca: number; total: number }>();
    const empNome = new Map((data?.employees ?? []).map((e: any) => [e.id, e.nome]));
    (data?.deliveries ?? []).forEach((d: any) => {
      const motivo = String(d.motivo_entrega || "");
      if (motivo !== "PERDA_EXTRAVIO" && motivo !== "TROCA" && motivo !== "TROCA_DESGASTE") return;
      const id = d.employee_id;
      if (!id) return;
      const cur = map.get(id) ?? { id, nome: (empNome.get(id) as string) ?? "—", perda: 0, troca: 0, total: 0 };
      const q = Number(d.qtd || 0);
      if (motivo === "PERDA_EXTRAVIO") cur.perda += q;
      else cur.troca += q;
      cur.total += q;
      map.set(id, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 6);
  }, [data]);

  // === NOVO 10 · % Ações Plano no prazo ===
  const planoAcoesMetric = useMemo(() => {
    const all = (data as any)?.planoAcoes ?? [];
    const hoje = today.getTime();
    let noPrazo = 0, atrasadas = 0, abertasOk = 0;
    all.forEach((a: any) => {
      const concluido = a.status === "CONCLUIDA" || a.status === "CONCLUIDO" || !!a.data_conclusao;
      const prevista = a.quando ? new Date(a.quando + "T00:00").getTime() : null;
      if (concluido) {
        const dc = a.data_conclusao ? new Date(a.data_conclusao + "T00:00").getTime() : hoje;
        if (!prevista || dc <= prevista) noPrazo += 1;
        else atrasadas += 1;
      } else {
        if (prevista && prevista < hoje) atrasadas += 1;
        else abertasOk += 1;
      }
    });
    const total = noPrazo + atrasadas + abertasOk;
    const pct = total > 0 ? Math.round((noPrazo / total) * 100) : 0;
    return { noPrazo, atrasadas, abertasOk, total, pct };
  }, [data]);

  const planoAcoesDonut = [
    { name: "No prazo", value: planoAcoesMetric.noPrazo, fill: "#10b981" },
    { name: "Em aberto", value: planoAcoesMetric.abertasOk, fill: "#22d3ee" },
    { name: "Atrasadas", value: planoAcoesMetric.atrasadas, fill: "#f43f5e" },
  ].filter((d) => d.value > 0);

  // === NOVO 11 · % Treinamentos NR em dia (por curso) ===
  const periodicidadeMeses = (p: string): number => {
    const v = String(p || "").toUpperCase();
    if (v.includes("ANUAL")) return 12;
    if (v.includes("BIENAL") || v.includes("2 ANOS")) return 24;
    if (v.includes("TRIENAL") || v.includes("3 ANOS")) return 36;
    if (v.includes("SEMESTRAL") || v.includes("6 MESES")) return 6;
    if (v.includes("INICIAL") || v.includes("UNICA") || v.includes("ÚNICA")) return 9999;
    const n = parseInt(v, 10);
    return isNaN(n) ? 12 : n;
  };
  const treinamentosNR = useMemo(() => {
    const courses = ((data as any)?.trainCourses ?? []) as any[];
    const entries = ((data as any)?.trainEntries ?? []) as any[];
    const totalEmps = (data?.employees ?? []).filter((e: any) => e.ativo !== false).length || 1;
    // foca em NRs (categoria começando com "NR" ou código tipo NR-XX)
    const nrCourses = courses.filter((c) => {
      const tag = `${c.categoria ?? ""} ${c.codigo ?? ""}`.toUpperCase();
      return tag.includes("NR");
    });
    const out = nrCourses.map((c) => {
      const meses = periodicidadeMeses(c.periodicidade);
      const limiteVal = today.getTime();
      const validEmps = new Set<string>();
      entries.filter((en) => en.course_id === c.id).forEach((en) => {
        if (!en.data_realizacao) return;
        const dr = new Date(en.data_realizacao + "T00:00").getTime();
        const validade = meses >= 9999 ? Infinity : dr + meses * 30 * dayMs;
        if (validade >= limiteVal) validEmps.add(en.employee_id);
      });
      const pct = Math.round((validEmps.size / totalEmps) * 100);
      const code = c.codigo || c.nome;
      const name = code.length > 12 ? code.slice(0, 12) + "…" : code;
      return { name, value: Math.min(100, pct), abs: validEmps.size };
    }).filter((c) => c.abs > 0 || c.value > 0).sort((a, b) => b.value - a.value).slice(0, 6);
    return out;
  }, [data]);

  // === NOVO 12 · Near-miss / Quase-acidentes por mês (6 meses) ===
  const nearMissTrend = useMemo(() => {
    const out: { mes: string; qtd: number }[] = [];
    const all = ((data as any)?.incidentes ?? []) as any[];
    const nm = all.filter((i) => {
      const t = String(i.tipo || "").toUpperCase();
      return t.includes("QUASE") || t.includes("NEAR") || t.includes("NEAR_MISS");
    });
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const next = new Date(today.getFullYear(), today.getMonth() - i + 1, 1);
      const sIso = fmt(d), eIso = fmt(next);
      const qtd = nm.filter((x) => x.data_ocorrencia >= sIso && x.data_ocorrencia < eIso).length;
      out.push({ mes: `${MONTHS_PT[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`, qtd });
    }
    return out;
  }, [data]);
  const nearMissTotal = nearMissTrend.reduce((s, m) => s + m.qtd, 0);
  const nearMissMesAtual = nearMissTrend[nearMissTrend.length - 1]?.qtd ?? 0;

  // === Dias sem acidente — atual + recorde (filtra empresa quando selecionada) ===
  const recordeAcidente = useMemo(() => {
    const all = ((data as any)?.recordes ?? []) as any[];
    const filtered = filterCompany === "ALL"
      ? all
      : all.filter((r) => r.company_id === filterCompany);
    if (filtered.length === 0) return { atual: 0, recorde: 0, dataInicio: null as string | null };
    // Pega o mais recente data_inicio (contagem atual)
    const atualRec = filtered
      .filter((r) => r.data_inicio)
      .sort((a, b) => (b.data_inicio || "").localeCompare(a.data_inicio || ""))[0];
    const recorde = Math.max(...filtered.map((r) => Number(r.recorde_dias || 0)), 0);
    const atual = atualRec?.data_inicio
      ? Math.max(0, Math.floor((today.getTime() - new Date(atualRec.data_inicio + "T00:00").getTime()) / dayMs))
      : 0;
    return { atual, recorde, dataInicio: atualRec?.data_inicio ?? null };
  }, [data, filterCompany]);

  // === DDS Planejado vs Realizado (config: meta por dia da semana em company_settings) ===
  const ddsPlanRealizado = useMemo(() => {
    const settings: any = (data as any)?.settings;
    const diasSemanaCfg: number[] = settings?.meta_dds_dias_semana ?? [1, 3, 5]; // seg/qua/sex
    const inicio = new Date(today.getTime() - dias * dayMs);
    // conta dias do período que caem nos dias-da-semana configurados
    let planejados = 0;
    for (let d = new Date(inicio); d <= today; d.setDate(d.getDate() + 1)) {
      if (diasSemanaCfg.includes(d.getDay())) planejados++;
    }
    planejados = Math.max(1, planejados);
    const realizados = ddsCount;
    const pct = Math.min(100, Math.round((realizados / planejados) * 100));
    // Serie por semana
    const map = new Map<string, { sem: string; real: number; plan: number }>();
    const semanas = Math.max(1, Math.ceil(dias / 7));
    // popula buckets de semana com plan = nº de dias config naquela semana
    for (let i = 0; i < semanas; i++) {
      const ref = new Date(today.getTime() - i * 7 * dayMs);
      const day = (ref.getDay() + 6) % 7;
      const wk = new Date(ref.getTime() - day * dayMs);
      const key = fmt(wk);
      const label = `${String(wk.getDate()).padStart(2, "0")}/${MONTHS_PT[wk.getMonth()]}`;
      let planSem = 0;
      for (let k = 0; k < 7; k++) {
        const d2 = new Date(wk.getTime() + k * dayMs);
        if (d2 <= today && d2 >= inicio && diasSemanaCfg.includes(d2.getDay())) planSem++;
      }
      map.set(key, { sem: label, real: 0, plan: planSem });
    }
    (data?.dds ?? []).forEach((d: any) => {
      const dt = new Date(d.data + "T00:00");
      const day = (dt.getDay() + 6) % 7;
      const wk = new Date(dt.getTime() - day * dayMs);
      const key = fmt(wk);
      const cur = map.get(key);
      if (cur) cur.real += 1;
    });
    const series = Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, v]) => v);
    return { planejados, realizados, pct, series };
  }, [data, dias, ddsCount]);

  // === TF / TG (acumulado 12 meses) — NBR 14280 ===
  // TF = (nº acidentes com afastamento × 1.000.000) ÷ HHT
  // TG = (dias perdidos × 1.000.000) ÷ HHT
  const { tf, tg, tfSerie, totalAcid12m, totalDias12m, totalHHT12m } = useMemo(() => {
    const acid = (((data as any)?.acidentes) ?? []) as any[];
    const hhtArr = (((data as any)?.hht) ?? []) as any[];
    const compFilter = (cid: string | null) =>
      filterCompany === "ALL" || cid === filterCompany;
    const limite12m = today.getTime() - 365 * dayMs;
    const acidFiltered = acid.filter((a) =>
      compFilter(a.company_id) &&
      a.data_acidente &&
      new Date(a.data_acidente + "T00:00").getTime() >= limite12m
    );
    const acidCAF = acidFiltered.filter((a) => a.tipo === "COM_AFASTAMENTO" || a.tipo === "FATAL");
    const dias = acidFiltered.reduce((s, a) => s + Number(a.dias_perdidos || 0), 0);
    // HHT últimos 12m
    const cutoff = new Date(today.getFullYear(), today.getMonth() - 11, 1);
    const hhtFiltered = hhtArr.filter((h) => {
      if (!compFilter(h.company_id)) return false;
      const d = new Date(Number(h.ano), Number(h.mes) - 1, 1);
      return d.getTime() >= cutoff.getTime();
    });
    const totalHHT = hhtFiltered.reduce((s, h) => s + Number(h.hht || 0), 0);
    const tfVal = totalHHT > 0 ? (acidCAF.length * 1_000_000) / totalHHT : 0;
    const tgVal = totalHHT > 0 ? (dias * 1_000_000) / totalHHT : 0;
    // Série mensal 12m
    const series: { mes: string; tf: number; tg: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const next = new Date(today.getFullYear(), today.getMonth() - i + 1, 1);
      const sIso = fmt(d), eIso = fmt(next);
      const aCAF = acidFiltered.filter((a) => a.data_acidente >= sIso && a.data_acidente < eIso && (a.tipo === "COM_AFASTAMENTO" || a.tipo === "FATAL")).length;
      const dp = acidFiltered.filter((a) => a.data_acidente >= sIso && a.data_acidente < eIso).reduce((s, a) => s + Number(a.dias_perdidos || 0), 0);
      const hMes = hhtFiltered.filter((h) => Number(h.ano) === d.getFullYear() && Number(h.mes) === d.getMonth() + 1).reduce((s, h) => s + Number(h.hht || 0), 0);
      series.push({
        mes: `${MONTHS_PT[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
        tf: hMes > 0 ? Number(((aCAF * 1_000_000) / hMes).toFixed(2)) : 0,
        tg: hMes > 0 ? Number(((dp * 1_000_000) / hMes).toFixed(2)) : 0,
      });
    }
    return {
      tf: Number(tfVal.toFixed(2)),
      tg: Number(tgVal.toFixed(2)),
      tfSerie: series,
      totalAcid12m: acidCAF.length,
      totalDias12m: dias,
      totalHHT12m: totalHHT,
    };
  }, [data, filterCompany]);

  // === Reincidência EPI (% colaboradores que perderam/trocaram ≥ 1 EPI no MÊS atual) ===
  const reincidenciaEPIPct = useMemo(() => {
    const inicioMes = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const empsSetMes = new Set<string>();
    const empsRecPerda = new Set<string>();
    (data?.deliveries ?? []).forEach((d: any) => {
      if (!d.employee_id || !d.data_entrega) return;
      if (d.data_entrega < inicioMes) return;
      empsSetMes.add(d.employee_id);
      const m = String(d.motivo_entrega || "");
      if (m === "PERDA_EXTRAVIO" || m === "TROCA" || m === "TROCA_DESGASTE") {
        empsRecPerda.add(d.employee_id);
      }
    });
    const base = Math.max(1, empsSetMes.size);
    const pct = Math.round((empsRecPerda.size / base) * 100);
    return { pct, reincidentes: empsRecPerda.size, base: empsSetMes.size };
  }, [data]);

  const mesRefAtual = `${MONTHS_PT[today.getMonth()]}/${today.getFullYear()}`;

  // === Metas configuradas em /app/configuracoes-indicadores ===
  const metas = useMemo(() => {
    const s: any = (data as any)?.settings ?? {};
    return {
      treinPct: Number(s.meta_treinamentos_pct ?? 90),
      asoPct: Number(s.meta_aso_pct ?? 95),
      inspPct: Number(s.meta_inspecoes_pct ?? 90),
      ddsSemana: Number(s.meta_dds_semana ?? 3),
      acidTaxa: Number(s.meta_acidentes_taxa_max_pct ?? 2),
      diasPerdidosMax: Number(s.meta_dias_perdidos_max_mes ?? 5),
    };
  }, [data]);
  const tone = (pct: number, meta: number) =>
    pct >= meta ? "ok" : pct >= meta * 0.8 ? "warn" : "crit";

  return (
    <div className="h-full overflow-y-auto custom-scrollbar relative"
      style={{
        background:
          "radial-gradient(1400px 700px at 8% -10%, rgba(34,211,238,0.14), transparent 55%), radial-gradient(1100px 600px at 100% 5%, rgba(244,63,94,0.10), transparent 55%), radial-gradient(900px 500px at 50% 110%, rgba(16,185,129,0.08), transparent 60%), linear-gradient(180deg, #0b1322 0%, #0f1a2e 35%, #0a1226 70%, #0b1322 100%)",
      }}
    >
      {/* grain sutil pra remover o "chapado" */}
      <div aria-hidden className="pointer-events-none fixed inset-0 opacity-[0.035] mix-blend-overlay"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
      <div className="max-w-[1700px] mx-auto p-4 md:p-5 flex flex-col gap-4 relative">

        {/* ===== HEADER limpo ===== */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-gradient-to-r from-rose-500 to-rose-600 text-white px-2 py-0.5 rounded-sm text-[10px] font-black uppercase tracking-tighter shadow-[0_0_20px_rgba(244,63,94,0.5)]">DMN</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">SGI-SST · Auditoria ISO 9001 / 45001</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight mt-1 bg-gradient-to-r from-cyan-300 via-cyan-200 to-emerald-300 bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(34,211,238,0.35)]">
              Dashboard SESMT
            </h1>
            <div className="text-[11px] text-slate-400 mt-0.5">Indicadores de Segurança · Medição &amp; Avaliação (FORCP-SGI-20) · <span className="text-cyan-300/80 font-bold">6 Oficiais para Auditoria</span></div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input type="text" placeholder="Buscar colaborador, CPF, função…" value={q} onChange={(e) => setQ(e.target.value)}
                className="w-64 bg-slate-900/60 backdrop-blur-md border border-slate-700/60 rounded-md pl-8 pr-3 py-1.5 text-xs font-medium text-slate-100 outline-none focus:ring-2 focus:ring-cyan-400/30 focus:border-cyan-400/60 placeholder:text-slate-500" />
              {search && searchResults.length > 0 && (
                <div className="absolute z-30 mt-1 left-0 right-0 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-md shadow-xl max-h-56 overflow-y-auto">
                  {searchResults.map((r) => (
                    <Link key={r.emp.id} to="/app/employees/$id" params={{ id: r.emp.id }}
                      className="block px-3 py-2 text-xs hover:bg-slate-800/40 border-b border-slate-800/80 last:border-0">
                      <div className="font-bold text-slate-50 truncate">{r.emp.nome}</div>
                      <div className="text-slate-500 truncate text-[10px]">{r.company}</div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ===== Filtros em pílulas (estilo referência) ===== */}
        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-xl p-3 flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">Período</span>
            <div className="flex gap-1">
              {(["30", "60", "90", "180"] as const).map((p) => (
                <button key={p} onClick={() => setPeriodo(p)}
                  className={`px-3 py-1 text-[11px] font-black uppercase tracking-wider rounded-md transition-colors ${
                    periodo === p ? "bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-[0_0_15px_rgba(244,63,94,0.5)]" : "bg-slate-800/60 text-slate-300 hover:bg-slate-700/80 hover:text-slate-100"
                  }`}>{p} dias</button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">Empresa</span>
            <button onClick={() => setFilterCompany("ALL")}
              className={`px-3 py-1 text-[11px] font-black uppercase tracking-wider rounded-md transition-colors ${
                filterCompany === "ALL" ? "bg-gradient-to-br from-cyan-500 to-cyan-600 text-white shadow-[0_0_15px_rgba(34,211,238,0.5)]" : "bg-slate-800/60 text-slate-300 hover:bg-slate-700/80 hover:text-slate-100"
              }`}>Todas</button>
            {(data?.companies ?? []).slice(0, 6).map((c: any) => (
              <button key={c.id} onClick={() => setFilterCompany(c.id)}
                className={`px-3 py-1 text-[11px] font-black uppercase tracking-wider rounded-md transition-colors ${
                  filterCompany === c.id ? "bg-gradient-to-br from-cyan-500 to-cyan-600 text-white shadow-[0_0_15px_rgba(34,211,238,0.5)]" : "bg-slate-800/60 text-slate-300 hover:bg-slate-700/80 hover:text-slate-100"
                }`}>{c.name.length > 14 ? c.name.slice(0, 14) + "…" : c.name}</button>
            ))}
          </div>
        </div>

        {/* ===== KPIs (4 cards limpos com ícone) ===== */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiBig icon={Users} label="Colaboradores" value={totalEmp} sub={`${(data?.companies ?? []).length} empresas`} accent="#22d3ee" />
          <KpiBig icon={ShieldCheck} label="Conformidade" value={`${conformidadeFiltro}%`} sub={`${aptos} aptos`} accent="#10b981" />
          <KpiBig icon={AlertTriangle} label="Em Alerta" value={alertas} sub="ASOs / docs próximos" accent="#fbbf24" />
          <KpiBig icon={ShieldAlert} label="Bloqueados" value={bloqueados} sub="Ação imediata" accent="#f43f5e" highlight={bloqueados > 0} />
        </div>

        {/* ===== Faixa Recorde · Dias sem acidente ===== */}
        <div className="relative rounded-xl overflow-hidden border border-emerald-500/30"
          style={{
            background:
              "radial-gradient(600px 200px at 15% 50%, rgba(16,185,129,0.18), transparent 60%), radial-gradient(500px 200px at 85% 50%, rgba(34,211,238,0.12), transparent 60%), linear-gradient(135deg, rgba(15,23,42,0.85), rgba(8,15,30,0.75))",
            boxShadow: "0 10px 40px -15px rgba(16,185,129,0.35), inset 0 1px 0 rgba(255,255,255,0.05)",
          }}>
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 md:p-5">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 relative"
                style={{ background: "linear-gradient(135deg, #10b98140, #10b98110)", boxShadow: "0 0 30px #10b98180, inset 0 1px 0 #10b98180" }}>
                <Trophy className="h-7 w-7 text-emerald-300" />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300/80">Dias sem Acidente · Registrável</div>
                <div className="text-4xl md:text-5xl font-black tabular-nums leading-none mt-1 text-emerald-300"
                  style={{ textShadow: "0 0 25px rgba(16,185,129,0.6), 0 0 50px rgba(16,185,129,0.25)" }}>
                  {recordeAcidente.atual}
                  <span className="text-base text-emerald-400/70 ml-2 font-bold tracking-wide">dias</span>
                </div>
                {recordeAcidente.dataInicio && (
                  <div className="text-[10px] text-slate-400 mt-1">Contagem iniciada em {new Date(recordeAcidente.dataInicio + "T00:00").toLocaleDateString("pt-BR")}</div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-6 pr-2">
              <div className="text-right">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 flex items-center gap-1 justify-end">
                  <Trophy className="h-3 w-3 text-amber-400" /> Recorde Histórico
                </div>
                <div className="text-3xl font-black tabular-nums text-amber-300 tracking-tight"
                  style={{ textShadow: "0 0 18px rgba(251,191,36,0.5)" }}>
                  {recordeAcidente.recorde}
                  <span className="text-xs text-amber-400/70 ml-1.5 font-bold">dias</span>
                </div>
              </div>
              <div className="hidden md:block h-12 w-px bg-slate-700/60" />
              <div className="text-right">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Diferença</div>
                <div className={`text-2xl font-black tabular-nums tracking-tight ${
                  recordeAcidente.atual >= recordeAcidente.recorde ? "text-emerald-300" : "text-slate-300"
                }`}>
                  {recordeAcidente.atual >= recordeAcidente.recorde ? "+" : "−"}
                  {Math.abs(recordeAcidente.recorde - recordeAcidente.atual)}
                </div>
              </div>
            </div>
          </div>
          {/* barra de progresso até o recorde */}
          {recordeAcidente.recorde > 0 && (
            <div className="px-4 md:px-5 pb-4">
              <div className="flex justify-between text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">
                <span>Progresso até o recorde</span>
                <span className="text-emerald-300/80">{Math.min(100, Math.round((recordeAcidente.atual / recordeAcidente.recorde) * 100))}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-800/80 overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (recordeAcidente.atual / recordeAcidente.recorde) * 100)}%`,
                    background: "linear-gradient(90deg, #10b981, #34d399, #fbbf24)",
                    boxShadow: "0 0 12px rgba(16,185,129,0.7)",
                  }} />
              </div>
            </div>
          )}
        </div>

        {/* ===== QUADRO DOS 12 GRÁFICOS ===== */}
        <div className="grid grid-cols-12 gap-4">

          {/* === Banner: INDICADORES OFICIAIS (auditoria) === */}
          <div className="col-span-12 order-1 flex items-center gap-3 mt-1">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-500/60 to-cyan-500/30" />
            <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-cyan-500/10 ring-1 ring-cyan-400/40">
              <ShieldCheck className="h-3.5 w-3.5 text-cyan-300" />
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200">Indicadores Oficiais · Auditoria SGI-SST</span>
              <span className="text-[9px] font-bold text-cyan-400/70">(6 indicadores oficiais · ISO 45001 · NR-01 / NR-07)</span>
            </div>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent via-cyan-500/60 to-cyan-500/30" />
          </div>

          {/* TF — movido para APOIO (pendente substituto Acidentes/Efetivo) */}
          <Card title="TF · Taxa de Frequência (legado · pend. HHT)" className="col-span-12 md:col-span-4 order-[20]"
            period="12 MESES" meta="= 0"
            metaTone={tf === 0 ? "ok" : tf <= 5 ? "warn" : "crit"}
            action={<span className="text-[10px] font-black uppercase tracking-wider text-rose-300 flex items-center gap-1">
              <Activity className="h-3 w-3" /> {tf.toFixed(2)}
            </span>}
            ncPrefill={{ codigo: "IND-01", indicador: "Taxa de Frequência (TF)", mesRef: mesRefAtual }}>
            <div className="h-56">
              {totalHHT12m === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-1">
                  <AlertOctagon className="h-6 w-6 text-amber-400" />
                  <div className="text-[10px] font-black uppercase tracking-wider text-amber-300">Lançar HHT mensal</div>
                  <div className="text-[9px] text-slate-500">Sem HHT cadastrado · cálculo indisponível</div>
                </div>
              ) : (
                <ResponsiveContainer>
                  <ComposedChart data={tfSerie} margin={{ top: 14, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradTF" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.55} />
                        <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 4" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="mes" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipDark} formatter={(v: any) => [Number(v).toFixed(2), "TF"]} />
                    <Area type="monotone" dataKey="tf" stroke="#f43f5e" strokeWidth={3} fill="url(#gradTF)"
                      dot={{ r: 3, fill: "#0a0f1f", stroke: "#f43f5e", strokeWidth: 2 }}>
                      <LabelList dataKey="tf" position="top" style={{ fontSize: 9, fontWeight: 900, fill: "#fda4af" }} />
                    </Area>
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="flex justify-around pt-2 mt-1 border-t border-slate-800/80 text-[10px]">
              <span className="text-slate-500">Acidentes c/ afast. 12m: <span className="text-rose-300 font-black">{totalAcid12m}</span></span>
              <span className="text-slate-500">HHT 12m: <span className="text-slate-300 font-black tabular-nums">{totalHHT12m.toLocaleString("pt-BR")}</span></span>
            </div>
          </Card>

          {/* TG — movido para APOIO (pendente substituto Dias Perdidos) */}
          <Card title="TG · Taxa de Gravidade (legado · pend. HHT)" className="col-span-12 md:col-span-4 order-[21]"
            period="12 MESES" meta="≤ 100"
            metaTone={tg <= 100 ? "ok" : tg <= 500 ? "warn" : "crit"}
            action={<span className="text-[10px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1">
              <Activity className="h-3 w-3" /> {tg.toFixed(2)}
            </span>}
            ncPrefill={{ codigo: "IND-02", indicador: "Taxa de Gravidade (TG)", mesRef: mesRefAtual }}>
            <div className="h-56">
              {totalHHT12m === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-1">
                  <AlertOctagon className="h-6 w-6 text-amber-400" />
                  <div className="text-[10px] font-black uppercase tracking-wider text-amber-300">Lançar HHT mensal</div>
                  <div className="text-[9px] text-slate-500">Sem HHT cadastrado · cálculo indisponível</div>
                </div>
              ) : (
                <ResponsiveContainer>
                  <ComposedChart data={tfSerie} margin={{ top: 14, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradTG" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.55} />
                        <stop offset="100%" stopColor="#fbbf24" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 4" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="mes" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipDark} formatter={(v: any) => [Number(v).toFixed(2), "TG"]} />
                    <Area type="monotone" dataKey="tg" stroke="#fbbf24" strokeWidth={3} fill="url(#gradTG)"
                      dot={{ r: 3, fill: "#0a0f1f", stroke: "#fbbf24", strokeWidth: 2 }}>
                      <LabelList dataKey="tg" position="top" style={{ fontSize: 9, fontWeight: 900, fill: "#fde68a" }} />
                    </Area>
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="flex justify-around pt-2 mt-1 border-t border-slate-800/80 text-[10px]">
              <span className="text-slate-500">Dias perdidos 12m: <span className="text-amber-300 font-black">{totalDias12m}</span></span>
              <span className="text-slate-500">Meta NBR: <span className="text-emerald-400 font-black">≤ 100</span></span>
            </div>
          </Card>
          {/* OFICIAL 3 · % Treinamentos NR em dia */}
          <Card title="03 · Treinamentos NR · Em dia" className="col-span-12 md:col-span-4 order-2"
            period="MENSAL" meta={`≥ ${metas.treinPct}%`}
            metaTone={(() => {
              const avg = treinamentosNR.length > 0 ? Math.round(treinamentosNR.reduce((s, t) => s + t.value, 0) / treinamentosNR.length) : 100;
              return tone(avg, metas.treinPct);
            })()}
            action={<GraduationCap className="h-3 w-3 text-cyan-400" />}
            ncPrefill={{ codigo: "IND-03", indicador: "Treinamentos NR em dia", mesRef: mesRefAtual }}>
            {treinamentosNR.length === 0 ? (
              <EmptyBlock label="Sem matriz NR" />
            ) : (
              <HBarList
                items={treinamentosNR.map((t) => ({
                  name: t.name,
                  value: t.value,
                  color: t.value >= metas.treinPct ? "#10b981" : t.value >= metas.treinPct * 0.8 ? "#fbbf24" : "#f43f5e",
                }))}
                suffix="%" perItemColor
              />
            )}
          </Card>

          {/* OFICIAL 4 · Donut ASO Status (PCMSO/NR-07) */}
          <div className="col-span-12 md:col-span-4 order-3 relative rounded-2xl p-[1.5px] overflow-hidden self-start h-fit"
            style={{
              background: "linear-gradient(135deg, rgba(167,139,250,0.95) 0%, rgba(34,211,238,0.55) 35%, rgba(16,185,129,0.90) 100%)",
              boxShadow:
                "0 0 0 1px rgba(167,139,250,0.35), " +
                "0 0 18px rgba(167,139,250,0.22), " +
                "0 0 36px rgba(16,185,129,0.18), " +
                "0 24px 56px -22px rgba(124,58,237,0.30), " +
                "0 18px 48px -22px rgba(16,185,129,0.24)",
            }}
          >
            <div className="relative rounded-2xl overflow-hidden"
              style={{
                background:
                  "radial-gradient(120% 80% at 0% 0%, rgba(136,8,8,0.45) 0%, rgba(15,23,42,0) 55%), " +
                  "radial-gradient(120% 80% at 100% 100%, rgba(16,185,129,0.25) 0%, rgba(15,23,42,0) 55%), " +
                  "linear-gradient(160deg, #0b1228 0%, #0a0f22 45%, #070b1a 100%)",
              }}
            >
              {/* glossy top highlight */}
              <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
                style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 40%, transparent 100%)" }} />
              {/* inner ring */}
              <div aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl"
                style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), inset 0 0 0 1px rgba(148,163,184,0.08), inset 0 -40px 80px -40px rgba(16,185,129,0.20)" }} />
              {/* corner glows */}
              <div aria-hidden className="pointer-events-none absolute -top-20 -left-16 h-56 w-56 rounded-full"
                style={{ background: "radial-gradient(circle, rgba(153,27,27,0.55) 0%, rgba(136,8,8,0) 70%)", filter: "blur(10px)" }} />
              <div aria-hidden className="pointer-events-none absolute -bottom-20 -right-16 h-56 w-56 rounded-full"
                style={{ background: "radial-gradient(circle, rgba(52,211,153,0.40) 0%, rgba(52,211,153,0) 70%)", filter: "blur(10px)" }} />

              <Card title="04 · ASO · PCMSO" className="!bg-transparent !border-0 !shadow-none !backdrop-blur-0"
                period="MENSAL" meta={`≥ ${metas.asoPct}%`}
                metaTone={tone(asoConformPct, metas.asoPct)}
                ncPrefill={{ codigo: "IND-05", indicador: "ASOs em dia", mesRef: mesRefAtual }}>
                <DonutCenter
                  data={asoDonut.length > 0 ? asoDonut : [{ name: "—", value: 1, fill: "#1e293b" }]}
                  centerValue={`${asoConformPct}%`}
                  centerLabel="Em dia"
                  centerColor={asoConformPct >= metas.asoPct ? "#10b981" : asoConformPct >= metas.asoPct * 0.8 ? "#fbbf24" : "#f43f5e"}
                />
                <div className="flex justify-around pt-3 mt-2 border-t border-slate-800/60">
                  <LegendItem color="#10b981" label="OK" value={asoEmDia} />
                  <LegendItem color="#fbbf24" label="30d" value={asoVencendo30} />
                  <LegendItem color="#f43f5e" label="Venc." value={asoVencidos} />
                </div>
              </Card>
            </div>
          </div>

          {/* OFICIAL 5 · DDS Planejado vs Realizado (semanal) */}
          <Card title="05 · DDS · Planejado vs Realizado"
            className="col-span-12 md:col-span-4 order-4"
            period="SEMANAL"
            meta={`≥ 85% · ${ddsPlanRealizado.realizados}/${ddsPlanRealizado.planejados}`}
            metaTone={tone(ddsPlanRealizado.pct, 85)}
            action={<MessageSquare className="h-3 w-3 text-cyan-300" />}
            ncPrefill={{ codigo: "IND-04", indicador: "DDS Planejado vs Realizado", mesRef: mesRefAtual }}
          >
            <div className="h-60">
              {ddsPlanRealizado.series.length === 0 ? <EmptyBlock label="Sem DDS no período" /> : (
                <ResponsiveContainer>
                  <ComposedChart data={ddsPlanRealizado.series} margin={{ top: 14, right: 12, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradPlanReal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#67e8f9" stopOpacity={1} />
                        <stop offset="55%" stopColor="#22d3ee" stopOpacity={0.95} />
                        <stop offset="100%" stopColor="#0e7490" stopOpacity={0.85} />
                      </linearGradient>
                      <linearGradient id="gradPlanBg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#475569" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#1e293b" stopOpacity={0.15} />
                      </linearGradient>
                      <filter id="ddsGlow" x="-30%" y="-30%" width="160%" height="160%">
                        <feGaussianBlur stdDeviation="2.5" result="b" />
                        <feMerge>
                          <feMergeNode in="b" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                    </defs>
                    <CartesianGrid strokeDasharray="2 4" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="sem" tick={{ fontSize: 10, fill: "#cbd5e1" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipDark} />
                    <Bar dataKey="plan" fill="url(#gradPlanBg)" radius={[6, 6, 0, 0]} barSize={26} name="Planejado">
                      <LabelList dataKey="plan" position="top" style={{ fontSize: 9, fontWeight: 700, fill: "#94a3b8" }} />
                    </Bar>
                    <Bar dataKey="real" fill="url(#gradPlanReal)" radius={[6, 6, 0, 0]} barSize={26} name="Realizado" filter="url(#ddsGlow)">
                      <LabelList dataKey="real" position="top" style={{ fontSize: 11, fontWeight: 900, fill: "#22d3ee" }} />
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="flex items-center justify-around pt-2 mt-1 border-t border-slate-800/80 text-[10px]">
              <span className="text-slate-500">Aderência: <span className="font-black tabular-nums"
                style={{ color: ddsPlanRealizado.pct >= 85 ? "#10b981" : ddsPlanRealizado.pct >= 68 ? "#fbbf24" : "#f43f5e" }}>
                {ddsPlanRealizado.pct}%</span></span>
              <span className="text-slate-500">Aderência média (sessões): <span className="font-black text-cyan-300">{ddsAderencia}%</span></span>
            </div>
          </Card>

          {/* 6 · Reincidência EPI por colaborador */}
          {/* === Banner: INDICADORES DE APOIO === */}
          <div className="col-span-12 order-8 flex items-center gap-3 mt-2">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-600/60 to-slate-600/30" />
            <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-slate-700/30 ring-1 ring-slate-600/40">
              <Activity className="h-3.5 w-3.5 text-slate-300" />
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-200">Indicadores de Apoio · Operacional</span>
              <span className="text-[9px] font-bold text-slate-400">(uso interno · gestão diária)</span>
            </div>
            <div className="h-px flex-1 bg-gradient-to-l from-transparent via-slate-600/60 to-slate-600/30" />
          </div>

          <Card title="11 · Reincidência EPI" className="col-span-12 md:col-span-3 order-9"
            period="MENSAL"
            meta={`≤ 5% · ${reincidenciaEPIPct.pct}%`}
            metaTone={reincidenciaEPIPct.pct <= 5 ? "ok" : reincidenciaEPIPct.pct <= 15 ? "warn" : "crit"}
            action={<Repeat className="h-3 w-3 text-rose-400" />}
            ncPrefill={{ codigo: "IND-06", indicador: "Reincidência EPI", mesRef: mesRefAtual }}>
            <div className="text-[10px] text-slate-500 mb-2">
              <span className="text-rose-300 font-black tabular-nums">{reincidenciaEPIPct.reincidentes}</span> de{" "}
              <span className="text-slate-300 font-black tabular-nums">{reincidenciaEPIPct.base}</span> colab. com perda/troca no mês
            </div>
            {reincidenciaEPI.length === 0 ? (
              <div className="py-10 text-center text-[#10b981] text-xs font-black uppercase tracking-wider">Sem reincidências</div>
            ) : (
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {reincidenciaEPI.map((r, i) => {
                  const max = reincidenciaEPI[0].total || 1;
                  const pct = Math.round((r.total / max) * 100);
                  return (
                    <Link key={r.id} to="/app/employees/$id" params={{ id: r.id }}
                      className="block p-1.5 rounded hover:bg-slate-800/40 group">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-slate-200 truncate flex items-center gap-1.5">
                          <span className="text-slate-600 tabular-nums">{i + 1}.</span>
                          {r.nome}
                        </span>
                        <span className="text-[10px] font-black text-rose-400 tabular-nums shrink-0 ml-1">{r.total}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-800/80 overflow-hidden">
                        <div className="h-full rounded-full"
                          style={{ width: `${pct}%`, background: `linear-gradient(90deg, #f43f5e, #fb7185)`, boxShadow: "0 0 8px rgba(244,63,94,0.5)" }} />
                      </div>
                      <div className="flex gap-2 mt-0.5 text-[9px] text-slate-500">
                        <span>Perda: <span className="text-rose-300 font-bold">{r.perda}</span></span>
                        <span>Troca: <span className="text-amber-300 font-bold">{r.troca}</span></span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>

          {/* OFICIAL 6 · Inspeções (Extintores NR-23) */}
          <Card title="06 · Inspeções · Extintores NR-23" className="col-span-12 md:col-span-4 order-5"
            period="MENSAL"
            meta={(() => {
              const pct = extMetrics.ativos > 0
                ? Math.round(((extMetrics.ativos - extMetrics.semInspecao) / extMetrics.ativos) * 100)
                : 100;
              return `≥ ${metas.inspPct}% · ${pct}%`;
            })()}
            metaTone={(() => {
              if (extMetrics.vencidos > 0) return "crit";
              const pct = extMetrics.ativos > 0
                ? Math.round(((extMetrics.ativos - extMetrics.semInspecao) / extMetrics.ativos) * 100)
                : 100;
              return tone(pct, metas.inspPct);
            })()}
            ncPrefill={{ codigo: "IND-07", indicador: "Inspeção/Recarga de Extintores", mesRef: mesRefAtual }}>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={extintoresBars} margin={{ top: 20, right: 8, left: -25, bottom: 0 }}>
                  <defs>
                    {extintoresBars.map((e, i) => (
                      <linearGradient id={`gradExt-${i}`} key={i} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={e.fill} stopOpacity={1} />
                        <stop offset="55%" stopColor={e.fill} stopOpacity={0.92} />
                        <stop offset="100%" stopColor={e.fill} stopOpacity={0.55} />
                      </linearGradient>
                    ))}
                    <filter id="extGlow" x="-30%" y="-30%" width="160%" height="160%">
                      <feGaussianBlur stdDeviation="3" result="b" />
                      <feMerge>
                        <feMergeNode in="b" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#cbd5e1", fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: "rgba(12,35,64,0.05)" }} contentStyle={tooltipDark} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={36} filter="url(#extGlow)">
                    {extintoresBars.map((_e, i) => <Cell key={i} fill={`url(#gradExt-${i})`} />)}
                    <LabelList dataKey="value" position="top" style={{ fontSize: 12, fontWeight: 900, fill: "#f1f5f9" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* 8 · Donut Conformidade Geral */}
          <Card title="12 · Status Geral" className="col-span-12 md:col-span-3 order-10"
            period={`${periodo}d`} meta="≥ 90%"
            metaTone={conformidadeFiltro >= 90 ? "ok" : conformidadeFiltro >= 70 ? "warn" : "crit"}
            ncPrefill={{ codigo: "IND-00", indicador: "Status Geral de Conformidade", mesRef: mesRefAtual }}>
            <DonutCenter
              data={donutData}
              centerValue={`${conformidadeFiltro}%`}
              centerLabel="Conformidade"
              centerColor={conformidadeFiltro >= 90 ? "#10b981" : conformidadeFiltro >= 70 ? "#fbbf24" : "#f43f5e"}
            />
            <div className="flex justify-around pt-3 mt-2 border-t border-slate-800/80">
              <LegendItem color="#10b981" label="Aptos" value={aptos} />
              <LegendItem color="#fbbf24" label="Alerta" value={alertas} />
              <LegendItem color="#f43f5e" label="Bloq." value={bloqueados} />
            </div>
          </Card>

          {/* 9 · Linha Documentos Abertos × Resolvidos */}
          <Card title="13 · Não Conformidades" className="col-span-12 md:col-span-6 order-11"
            period="6 MESES" meta="Resolv. ≥ Abertos" metaTone="neutral">
            <div className="h-64">
              {docsMensal.every((d) => d.abertos === 0 && d.resolvidos === 0) ? <EmptyBlock label="Sem registros" /> : (
                <ResponsiveContainer>
                  <ComposedChart data={docsMensal} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradAbertos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="gradResolv" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 4" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipDark} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Area type="monotone" dataKey="abertos" stroke="#f43f5e" strokeWidth={3} fill="url(#gradAbertos)" name="Abertos" dot={{ r: 4, fill: "#0a0f1f", stroke: "#f43f5e", strokeWidth: 2 }} />
                    <Area type="monotone" dataKey="resolvidos" stroke="#10b981" strokeWidth={3} fill="url(#gradResolv)" name="Resolvidos" dot={{ r: 4, fill: "#0a0f1f", stroke: "#10b981", strokeWidth: 2 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          {/* 10 · Pareto Empresas por colaborador (Bar + acumulado %) */}
          <Card title="14 · Pareto · Empresas" className="col-span-12 md:col-span-6 order-[12]"
            action={<span className="text-[10px] font-bold text-slate-500">{totalEmp} colab.</span>}>
            <div className="h-64">
              {paretoEmpresas.length === 0 ? <EmptyBlock label="Sem dados" /> : (
                <ResponsiveContainer>
                  <ComposedChart data={paretoEmpresas} margin={{ top: 16, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradPareto" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0891b2" stopOpacity={1} />
                        <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.85} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 4" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#cbd5e1" }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="l" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="r" orientation="right" domain={[0, 100]} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                    <Tooltip contentStyle={tooltipDark} />
                    <Bar yAxisId="l" dataKey="qtd" fill="url(#gradPareto)" radius={[8, 8, 0, 0]} barSize={36} name="Colaboradores">
                      <LabelList dataKey="qtd" position="top" style={{ fontSize: 11, fontWeight: 900, fill: "#e2e8f0" }} />
                    </Bar>
                    <Line yAxisId="r" type="monotone" dataKey="acumulado" stroke="#fbbf24" strokeWidth={3} dot={{ r: 4, fill: "#0a0f1f", stroke: "#fbbf24", strokeWidth: 2.5 }} name="% Acumulado" />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          {/* 11 · Área Fluxo Entregas EPI */}
          <Card title="15 · Fluxo EPI · Tendência" className="col-span-12 md:col-span-6 order-[13]"
            action={<span className="text-[10px] font-bold text-slate-500 flex items-center gap-1"><TrendingUp className="h-3 w-3" />{totalEntregas} · R$ {valorEntregas.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</span>}>
            <div className="h-64">
              {entregaSerie.length === 0 ? <EmptyBlock label="Sem entregas" /> : (
                <ResponsiveContainer>
                  <ComposedChart data={entregaSerie} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.7} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="gradArea2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="#22d3ee" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="gradArea3" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 4" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipDark} />
                    <Area type="monotone" dataKey="primeira" stroke="#10b981" strokeWidth={3} fill="url(#gradArea)" name="1ª Entrega" />
                    <Area type="monotone" dataKey="troca" stroke="#22d3ee" strokeWidth={2.5} fill="url(#gradArea2)" name="Troca" />
                    <Area type="monotone" dataKey="perda" stroke="#f43f5e" strokeWidth={2.5} fill="url(#gradArea3)" name="Perda" />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          {/* 12 · Score Top 5 Empresas (barras verticais) */}
          <Card title="16 · Score · TOP 5" className="col-span-12 md:col-span-4 order-[14]">
            <div className="h-64">
              {top5Empresas.length === 0 ? <EmptyBlock label="Sem empresas" /> : (
                <ResponsiveContainer>
                  <BarChart data={top5Empresas} margin={{ top: 20, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradScoreOk" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#34d399" /><stop offset="100%" stopColor="#10b981" />
                      </linearGradient>
                      <linearGradient id="gradScoreWarn" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fde68a" /><stop offset="100%" stopColor="#fbbf24" />
                      </linearGradient>
                      <linearGradient id="gradScoreBad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fb7185" /><stop offset="100%" stopColor="#f43f5e" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 4" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#cbd5e1", fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: "rgba(12,35,64,0.05)" }} contentStyle={tooltipDark} formatter={(v: any) => [`${v}%`, "Score"]} />
                    <Bar dataKey="score" radius={[10, 10, 0, 0]} barSize={44}>
                      {top5Empresas.map((e: any, i: number) => (
                        <Cell key={i} fill={e.score >= 90 ? "url(#gradScoreOk)" : e.score >= 70 ? "url(#gradScoreWarn)" : "url(#gradScoreBad)"} />
                      ))}
                      <LabelList dataKey="score" position="top" formatter={(v: any) => `${v}%`} style={{ fontSize: 12, fontWeight: 900, fill: "#f1f5f9" }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          {/* 13 · % Ações Plano no prazo */}
          <Card title="17 · Plano de Ação · Prazo" className="col-span-12 md:col-span-4 order-[15]"
            period="MENSAL" meta="≥ 90%"
            metaTone={planoAcoesMetric.pct >= 90 ? "ok" : planoAcoesMetric.pct >= 70 ? "warn" : "crit"}
            ncPrefill={{ codigo: "IND-08", indicador: "Plano de Ação no prazo", mesRef: mesRefAtual }}>
            <DonutCenter
              data={planoAcoesDonut.length > 0 ? planoAcoesDonut : [{ name: "—", value: 1, fill: "#1e293b" }]}
              centerValue={`${planoAcoesMetric.pct}%`}
              centerLabel="No prazo"
              centerColor={planoAcoesMetric.pct >= 90 ? "#10b981" : planoAcoesMetric.pct >= 70 ? "#fbbf24" : "#f43f5e"}
            />
            <div className="flex justify-around pt-3 mt-2 border-t border-slate-800/80">
              <LegendItem color="#10b981" label="No prazo" value={planoAcoesMetric.noPrazo} />
              <LegendItem color="#22d3ee" label="Abertas" value={planoAcoesMetric.abertasOk} />
              <LegendItem color="#f43f5e" label="Atrasadas" value={planoAcoesMetric.atrasadas} />
            </div>
          </Card>

          {/* 14 · Near-miss / Quase-acidentes */}
          <Card title="18 · Quase-Acidentes" className="col-span-12 md:col-span-4 order-[16]"
            period="MENSAL" meta="≥ 5/mês"
            metaTone={nearMissMesAtual >= 5 ? "ok" : nearMissMesAtual >= 2 ? "warn" : "crit"}
            action={<span className="text-[10px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1">
              <Eye className="h-3 w-3" /> {nearMissTotal} total
            </span>}
            ncPrefill={{ codigo: "IND-09", indicador: "Quase-Acidentes (proativo)", mesRef: mesRefAtual }}>
            <div className="h-52">
              {nearMissTotal === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-1">
                  <ClipboardCheck className="h-6 w-6 text-slate-600" />
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Nenhum reporte</div>
                  <div className="text-[9px] text-slate-600">Meta: ≥ 5/mês (proativo)</div>
                </div>
              ) : (
                <ResponsiveContainer>
                  <ComposedChart data={nearMissTrend} margin={{ top: 14, right: 8, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradNM" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="#fbbf24" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 4" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="mes" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipDark} />
                    <Area type="monotone" dataKey="qtd" stroke="#fbbf24" strokeWidth={3} fill="url(#gradNM)"
                      dot={{ r: 4, fill: "#0a0f1f", stroke: "#fbbf24", strokeWidth: 2 }}>
                      <LabelList dataKey="qtd" position="top" style={{ fontSize: 10, fontWeight: 900, fill: "#fde68a" }} />
                    </Area>
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="flex justify-around pt-2 mt-1 border-t border-slate-800/80 text-[10px]">
              <span className="text-slate-500">Mês atual: <span className="text-amber-300 font-black">{nearMissMesAtual}</span></span>
              <span className="text-slate-500">Meta: <span className="text-emerald-400 font-black">≥ 5</span></span>
            </div>
          </Card>


        </div>
        {/* dead-var ref kept silent */}
        <span className="hidden">{modTotal}{modulosDonut.length}{top5Pend.length}{statusBarsData.length}{motivoEntrega.length}{radialDDS[0]?.value}</span>

        {/* ===== Linha 4: Ações + Próximos 7 dias + Ranking ===== */}
        <div className="grid grid-cols-12 gap-4">
          <Card title="Ações Recomendadas" className="col-span-12 md:col-span-5"
            action={<Link to="/app/hoje" className="text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-[#f43f5e] flex items-center gap-1">Ver tudo <ArrowRight className="h-3 w-3" /></Link>}
          >
            {acoes.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-[#10b981] text-xs font-black uppercase tracking-wider gap-2">
                <ShieldCheck className="h-4 w-4" /> Tudo em ordem
              </div>
            ) : (
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {acoes.map((a) => (
                  <Link key={a.id} to={a.link}
                    className="flex items-center gap-2 p-2 rounded-md hover:bg-slate-800/40 transition-colors group">
                    <div className={`w-1 self-stretch rounded-full ${a.severity === "crit" ? "bg-[#f43f5e]" : "bg-[#fbbf24]"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-50 truncate">{a.titulo}</div>
                      <div className="text-[10px] text-slate-500 truncate">{a.sub}</div>
                    </div>
                    <ChevronRight className="h-3 w-3 text-slate-600 group-hover:text-[#f43f5e] shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </Card>

          <Card title="Próximos 7 Dias" className="col-span-12 md:col-span-4"
            action={<Calendar className="h-3 w-3 text-slate-500" />}
          >
            {proximos7.length === 0 ? (
              <div className="py-8 text-center text-[#10b981] text-xs font-black uppercase tracking-wider">Sem vencimentos</div>
            ) : (
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {proximos7.map((e, i) => {
                  const d = new Date(e.date + "T00:00");
                  return (
                    <div key={i} className="flex gap-2 items-center p-1.5 rounded hover:bg-slate-800/40">
                      <div className="text-center shrink-0 w-10 bg-slate-800/60 rounded-md py-1">
                        <div className="text-[8px] font-black text-slate-500 uppercase leading-none">{MONTHS_PT[d.getMonth()]}</div>
                        <div className={`text-sm font-black leading-tight ${e.severity === "crit" ? "text-[#f43f5e]" : "text-[#22d3ee]"}`}>
                          {String(d.getDate()).padStart(2, "0")}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-bold text-slate-100 truncate">{e.titulo}</div>
                        <div className="text-[10px] text-slate-500 truncate">{e.sub}</div>
                      </div>
                      <span className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${
                        e.tipo === "ASO" ? "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30"
                          : e.tipo === "EXT" ? "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30"
                          : "bg-slate-800/60 text-slate-600"
                      }`}>{e.tipo}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card title="Ranking · Empresas" className="col-span-12 md:col-span-3">
            {pendPorEmpresa.length === 0 ? (
              <div className="py-8 text-center text-[#10b981] text-xs font-black uppercase tracking-wider">✓ Limpo</div>
            ) : (
              <div className="space-y-1.5">
                {pendPorEmpresa.map((p, i) => {
                  const total = p.alerta + p.bloq;
                  return (
                    <div key={p.id} className="flex items-center gap-2 py-1.5 border-b border-slate-800/80 last:border-0">
                      <span className="text-xs font-black text-slate-600 w-4 text-center">{i + 1}</span>
                      <span className="text-xs text-slate-100 truncate font-bold flex-1">{p.name}</span>
                      <span className="text-xs font-black text-[#f43f5e] tabular-nums">{total}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* ===== Linha 5: Módulos (3 cards) ===== */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

        {isLoading && (
          <div className="text-center text-xs text-slate-500 py-2 animate-pulse">Carregando dados…</div>
        )}
      </div>
    </div>
  );
  // unused — silence linter for legacy refs (kept for compatibility)
  void conformityView;
}

// === Subcomponentes ===

function Card({
  title, children, className, action, period, meta, metaTone, ncPrefill,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
  period?: string;
  meta?: string;
  metaTone?: "ok" | "warn" | "crit" | "neutral";
  ncPrefill?: { codigo: string; indicador: string; mesRef: string };
}) {
  const toneColor = metaTone === "ok" ? "#10b981"
    : metaTone === "warn" ? "#fbbf24"
    : metaTone === "crit" ? "#f43f5e"
    : "#94a3b8";
  const showNC = ncPrefill && (metaTone === "crit" || metaTone === "warn");
  const sev = metaTone === "crit" ? "ALTA" : "MEDIA";
  return (
    <div className={`relative rounded-xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-md shadow-[0_8px_30px_-12px_rgba(0,0,0,0.5)] p-4 overflow-hidden ${className ?? ""}`}>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />
      {title && (
        <div className="flex items-center justify-between mb-3 gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-300/90 truncate">{title}</h3>
            {period && (
              <span className="text-[8.5px] font-black uppercase tracking-[0.15em] px-1.5 py-0.5 rounded bg-slate-800/70 text-slate-400 ring-1 ring-slate-700/60 shrink-0">
                {period}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {meta && (
              <span className="text-[9px] font-black uppercase tracking-wider flex items-center gap-1 px-1.5 py-0.5 rounded ring-1 shrink-0"
                style={{ color: toneColor, background: `${toneColor}12`, borderColor: `${toneColor}40`, boxShadow: `0 0 8px ${toneColor}30` }}>
                <Target className="h-2.5 w-2.5" /> {meta}
              </span>
            )}
            {action}
          </div>
        </div>
      )}
      {children}
      {showNC && (
        <Link
          to="/app/ncs"
          search={{
            titulo: `Meta ${ncPrefill!.codigo} não atingida — ${ncPrefill!.mesRef}`,
            descricao: `Indicador ${ncPrefill!.codigo} (${ncPrefill!.indicador}) abaixo da meta no período ${ncPrefill!.mesRef}. Abrir tratativa: análise de causa, plano de ação e verificação de eficácia.`,
            origem: "INDICADOR",
            severidade: sev,
            pendencia: `indicador:${ncPrefill!.codigo}:${ncPrefill!.mesRef}`,
          }}
          className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-md ring-1 transition-colors"
          style={{
            color: toneColor,
            background: `${toneColor}15`,
            borderColor: `${toneColor}50`,
          }}
        >
          <FilePlus2 className="h-3 w-3" /> Abrir NC
        </Link>
      )}
    </div>
  );
}

function KpiBig({
  icon: Icon, label, value, sub, accent, highlight,
}: {
  icon: any;
  label: string;
  value: number | string;
  sub?: string;
  accent: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`relative rounded-xl border bg-slate-900/50 backdrop-blur-md p-4 flex items-center gap-3 transition-all overflow-hidden group ${
        highlight
          ? "border-rose-500/50 ring-1 ring-rose-500/20"
          : "border-slate-800/80 hover:border-slate-700"
      }`}
      style={{
        boxShadow: highlight
          ? `0 0 40px -10px ${accent}66, inset 0 1px 0 rgba(255,255,255,0.04)`
          : `0 8px 30px -15px ${accent}40, inset 0 1px 0 rgba(255,255,255,0.04)`,
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full blur-3xl opacity-30 group-hover:opacity-50 transition-opacity"
        style={{ background: accent }}
      />
      <div
        className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0 relative z-10"
        style={{
          background: `linear-gradient(135deg, ${accent}30, ${accent}08)`,
          color: accent,
          boxShadow: `0 0 20px ${accent}50, inset 0 1px 0 ${accent}40`,
        }}
      >
        <Icon className="h-6 w-6" />
      </div>
      <div className="min-w-0 flex-1 relative z-10">
        <div className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">{label}</div>
        <div
          className="text-3xl font-black tabular-nums leading-tight"
          style={{
            color: accent,
            textShadow: `0 0 18px ${accent}99, 0 0 36px ${accent}33`,
          }}
        >
          {value}
        </div>
        {sub && <div className="text-[10px] text-slate-500 truncate">{sub}</div>}
      </div>
    </div>
  );
}

function DonutCenter({
  data, centerValue, centerLabel, centerColor,
}: {
  data: { name: string; value: number; fill: string }[];
  centerValue: string;
  centerLabel: string;
  centerColor: string;
}) {
  const hasData = data.length > 0 && data.some((d) => d.value > 0);
  const chartData = hasData ? data : [{ name: "—", value: 1, fill: "#1e293b" }];
  const gradId = (i: number) => `donutGrad-${centerLabel.replace(/\s/g, "")}-${i}`;
  return (
    <div className="relative h-56">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(closest-side, ${centerColor}33 0%, ${centerColor}11 45%, transparent 70%)`,
          filter: "blur(6px)",
        }}
      />
      <ResponsiveContainer>
        <PieChart>
          <defs>
            {chartData.map((d, i) => (
              <linearGradient id={gradId(i)} key={i} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={d.fill} stopOpacity={1} />
                <stop offset="55%" stopColor={d.fill} stopOpacity={0.92} />
                <stop offset="100%" stopColor={d.fill} stopOpacity={0.55} />
              </linearGradient>
            ))}
            <filter id={`donutGlow-${centerLabel.replace(/\s/g, "")}`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3.5" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <Pie
            data={chartData}
            dataKey="value"
            innerRadius={62}
            outerRadius={94}
            paddingAngle={3}
            stroke="#0a0f1f"
            strokeWidth={2}
            startAngle={90}
            endAngle={-270}
            filter={`url(#donutGlow-${centerLabel.replace(/\s/g, "")})`}
          >
            {chartData.map((_d, i) => <Cell key={i} fill={`url(#${gradId(i)})`} />)}
          </Pie>
          <Tooltip contentStyle={tooltipDark} />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div
          className="text-4xl font-black tabular-nums leading-none"
          style={{ color: centerColor, textShadow: `0 0 18px ${centerColor}aa, 0 0 36px ${centerColor}55` }}
        >
          {centerValue}
        </div>
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mt-1.5">{centerLabel}</div>
      </div>
    </div>
  );
}

function LegendItem({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600">
      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: color }} />
      <span className="truncate">{label}</span>
      <span className="ml-auto tabular-nums text-slate-50 font-black">{value}</span>
    </div>
  );
}

function HBarList({
  items, color, suffix, empty, perItemColor,
}: {
  items: { name: string; value: number; color?: string }[];
  color?: string;
  suffix?: string;
  empty?: string;
  perItemColor?: boolean;
}) {
  if (items.length === 0) {
    return <div className="py-8 text-center text-[10px] font-black uppercase tracking-wider text-slate-500">{empty ?? "Sem dados"}</div>;
  }
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="space-y-3.5 py-2">
      {items.map((it) => {
        const c = perItemColor && it.color ? it.color : color ?? "#22d3ee";
        const pct = Math.max(2, Math.round((it.value / max) * 100));
        return (
          <div key={it.name}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[12px] font-bold text-slate-200 truncate pr-2">{it.name}</span>
              <span className="text-[13px] font-black tabular-nums" style={{ color: c }}>
                {it.value}{suffix ?? ""}
              </span>
            </div>
            <div
              className="relative h-3 rounded-full overflow-hidden"
              style={{
                background: "linear-gradient(180deg, rgba(2,6,23,0.85), rgba(15,23,42,0.55))",
                boxShadow: "inset 0 1px 2px rgba(0,0,0,0.6), inset 0 -1px 0 rgba(255,255,255,0.04)",
              }}
            >
              <div
                className="relative h-full rounded-full transition-all duration-700"
                style={{
                  width: `${pct}%`,
                  background: `linear-gradient(180deg, ${c}ff 0%, ${c}d9 45%, ${c}99 100%)`,
                  boxShadow: `0 0 12px ${c}aa, 0 0 22px ${c}55, inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -1px 0 rgba(0,0,0,0.25)`,
                }}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-full"
                  style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.35), transparent)" }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EmptyBlock({ label }: { label: string }) {
  return (
    <div className="h-full w-full flex items-center justify-center text-[10px] font-bold uppercase tracking-wider text-slate-500 py-4">
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
    <Link to={to} className="relative rounded-xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-md shadow-[0_8px_30px_-12px_rgba(0,0,0,0.5)] p-3 hover:border-cyan-500/50 hover:shadow-[0_0_25px_-5px_rgba(34,211,238,0.4)] transition-all group">
      <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-800/80">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-[#22d3ee]" />
          <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-[#22d3ee]">{title}</h4>
        </div>
        <ChevronRight className="h-3 w-3 text-slate-600 group-hover:text-[#be123c] transition-colors" />
      </div>
      <div className="flex items-baseline gap-1.5 mb-2">
        <span className="text-xl font-black text-slate-50 tabular-nums">{primary}</span>
        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{primaryLabel}</span>
      </div>
      <div className="grid grid-cols-3 gap-1 pt-2 border-t border-slate-800/80">
        {stats.map((s) => {
          const cls = s.tone === "crit" ? "text-[#be123c]"
            : s.tone === "warn" ? "text-amber-300"
            : s.tone === "ok" ? "text-emerald-300"
            : "text-slate-200";
          return (
            <div key={s.label} className="text-center">
              <div className={`text-xs font-black tabular-nums ${cls}`}>{s.value}</div>
              <div className="text-[7px] font-bold uppercase tracking-wider text-slate-500 mt-0.5 truncate">{s.label}</div>
            </div>
          );
        })}
      </div>
    </Link>
  );
}