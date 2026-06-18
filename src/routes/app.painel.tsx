import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Search, ShieldCheck, Flame, Calendar, ArrowRight, ChevronRight, FolderOpen, Package,
  Users, AlertTriangle, ShieldAlert, TrendingUp, Repeat, GraduationCap, ClipboardCheck, Eye,
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
      const [emps, comps, roles, exams, overrides, deliveries, estoque, dds, aprs, ptes, controleDocs, extintores, extInspecoes, planoAcoes, trainCourses, trainEntries, incidentes] = await Promise.all([
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
        planoAcoes: planoAcoes.data ?? [],
        trainCourses: trainCourses.data ?? [],
        trainEntries: trainEntries.data ?? [],
        incidentes: incidentes.data ?? [],
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

  return (
    <div className="h-full overflow-y-auto custom-scrollbar relative"
      style={{
        background:
          "radial-gradient(1200px 600px at 10% -10%, rgba(34,211,238,0.10), transparent 60%), radial-gradient(900px 500px at 100% 0%, rgba(244,63,94,0.08), transparent 60%), linear-gradient(180deg, #060913 0%, #0a0f1f 50%, #060913 100%)",
      }}
    >
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
            <div className="text-[11px] text-slate-400 mt-0.5">Indicadores de Segurança · Medição &amp; Avaliação (FORCP-SGI-20)</div>
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

        {/* ===== QUADRO DOS 12 GRÁFICOS ===== */}
        <div className="grid grid-cols-12 gap-4">

          {/* 1 · Donut Conformidade Geral */}
          <Card title="01 · Status Geral" className="col-span-12 md:col-span-3">
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

          {/* 2 · Donut ASO Status (PCMSO/NR-07) */}
          <Card title="02 · ASO · PCMSO" className="col-span-12 md:col-span-3">
            <DonutCenter
              data={asoDonut.length > 0 ? asoDonut : [{ name: "—", value: 1, fill: "#1e293b" }]}
              centerValue={`${asoConformPct}%`}
              centerLabel="Em dia"
              centerColor={asoConformPct >= 90 ? "#10b981" : asoConformPct >= 70 ? "#fbbf24" : "#f43f5e"}
            />
            <div className="flex justify-around pt-3 mt-2 border-t border-slate-800/80">
              <LegendItem color="#10b981" label="OK" value={asoEmDia} />
              <LegendItem color="#fbbf24" label="30d" value={asoVencendo30} />
              <LegendItem color="#f43f5e" label="Venc." value={asoVencidos} />
            </div>
          </Card>

          {/* 3 · Pareto Empresas por colaborador (Bar + acumulado %) */}
          <Card title="03 · Pareto · Empresas" className="col-span-12 md:col-span-6"
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

          {/* 4 · Área Fluxo Entregas EPI */}
          <Card title="04 · Fluxo EPI · Tendência" className="col-span-12 md:col-span-6"
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

          {/* 5 · Score Top 5 Empresas (barras verticais) */}
          <Card title="05 · Score · TOP 5" className="col-span-12 md:col-span-4">
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

          {/* 6 · DDS Composto (qtd × aderência) */}
          <Card title="06 · DDS · Qtd × Aderência" className="col-span-12 md:col-span-5"
            action={<span className="text-[10px] font-black uppercase tracking-wider text-[#10b981]">{ddsAderencia}% médio</span>}>
            <div className="h-64">
              {ddsTrend.length === 0 ? <EmptyBlock label="Sem DDS" /> : (
                <ResponsiveContainer>
                  <ComposedChart data={ddsTrend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradDDS" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0891b2" /><stop offset="100%" stopColor="#22d3ee" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 4" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="l" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="r" orientation="right" domain={[0, 100]} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                    <Tooltip contentStyle={tooltipDark} />
                    <Bar yAxisId="l" dataKey="qtd" fill="url(#gradDDS)" radius={[8, 8, 0, 0]} barSize={28} name="DDS" />
                    <Line yAxisId="r" type="monotone" dataKey="aderencia" stroke="#f43f5e" strokeWidth={3.5} dot={{ r: 5, fill: "#0a0f1f", stroke: "#f43f5e", strokeWidth: 2.5 }} name="% Aderência" />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          {/* 7 · Radial Aderência DDS */}
          <Card title="07 · Aderência DDS" className="col-span-12 md:col-span-3">
            <div className="relative h-56">
              <ResponsiveContainer>
                <RadialBarChart innerRadius="70%" outerRadius="100%" data={radialDDS} startAngle={220} endAngle={-40}>
                  <defs>
                    <linearGradient id="gradRadial" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor={radialDDS[0].fill} stopOpacity={1} />
                      <stop offset="100%" stopColor={radialDDS[0].fill} stopOpacity={0.6} />
                    </linearGradient>
                  </defs>
                  <RadialBar dataKey="value" cornerRadius={14} background={{ fill: "#1e293b" }} fill="url(#gradRadial)" />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="text-4xl font-black tabular-nums drop-shadow-sm" style={{ color: radialDDS[0].fill }}>{ddsAderencia}%</div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mt-1.5">Período</div>
              </div>
            </div>
            <div className="flex justify-around pt-3 mt-2 border-t border-slate-800/80">
              <LegendItem color="#22d3ee" label="DDS" value={ddsCount} />
              <LegendItem color="#10b981" label="Meta" value={90} />
            </div>
          </Card>

          {/* 8 · Linha Documentos Abertos × Resolvidos */}
          <Card title="08 · Não Conformidades · 6 meses" className="col-span-12 md:col-span-6">
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

          {/* 9 · Barras Extintores por Status (NR-23) */}
          <Card title="09 · Extintores · NR-23" className="col-span-12 md:col-span-3">
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={extintoresBars} margin={{ top: 20, right: 8, left: -25, bottom: 0 }}>
                  <defs>
                    {extintoresBars.map((e, i) => (
                      <linearGradient id={`gradExt-${i}`} key={i} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={e.fill} stopOpacity={1} />
                        <stop offset="100%" stopColor={e.fill} stopOpacity={0.6} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#cbd5e1", fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: "rgba(12,35,64,0.05)" }} contentStyle={tooltipDark} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={36}>
                    {extintoresBars.map((_e, i) => <Cell key={i} fill={`url(#gradExt-${i})`} />)}
                    <LabelList dataKey="value" position="top" style={{ fontSize: 12, fontWeight: 900, fill: "#f1f5f9" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* 10 · HBar Pendência por Empresa */}
          <Card title="10 · Pendência · Empresa" className="col-span-12 md:col-span-4">
            <HBarList items={top5Pend} color="#f43f5e" suffix="%" empty="Sem pendências" />
          </Card>

          {/* 11 · HBar Distribuição Status */}
          <Card title="11 · Distribuição Status" className="col-span-12 md:col-span-4">
            <HBarList
              items={statusBarsData.map((s) => ({
                name: s.name,
                value: totalEmp > 0 ? Math.round((s.value / totalEmp) * 100) : 0,
                color: s.fill,
              }))}
              suffix="%" perItemColor
            />
          </Card>

          {/* 12 · HBar Motivos EPI */}
          <Card title="12 · Motivo Entrega · EPI" className="col-span-12 md:col-span-4">
            <HBarList items={motivoEntrega} color="#22d3ee" suffix="%" empty="Sem entregas" />
          </Card>

        </div>
        {/* dead-var ref kept silent */}
        <span className="hidden">{modTotal}{modulosDonut.length}</span>

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
  title, children, className, action,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={`relative rounded-xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-md shadow-[0_8px_30px_-12px_rgba(0,0,0,0.5)] p-4 overflow-hidden ${className ?? ""}`}>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />
      {title && (
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-300/90">{title}</h3>
          {action}
        </div>
      )}
      {children}
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
      <ResponsiveContainer>
        <PieChart>
          <defs>
            {chartData.map((d, i) => (
              <linearGradient id={gradId(i)} key={i} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={d.fill} stopOpacity={1} />
                <stop offset="100%" stopColor={d.fill} stopOpacity={0.55} />
              </linearGradient>
            ))}
          </defs>
          <Pie data={chartData} dataKey="value" innerRadius={62} outerRadius={92} paddingAngle={3} stroke="#0a0f1f" strokeWidth={3} startAngle={90} endAngle={-270}>
            {chartData.map((_d, i) => <Cell key={i} fill={`url(#${gradId(i)})`} />)}
          </Pie>
          <Tooltip contentStyle={tooltipDark} />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="text-4xl font-black tabular-nums leading-none drop-shadow-sm" style={{ color: centerColor }}>{centerValue}</div>
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
            <div className="h-3 bg-slate-800/60 rounded-full overflow-hidden shadow-inner">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${c}cc, ${c})` }}
              />
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