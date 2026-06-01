import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isSnoozed } from "@/lib/pendencias-snooze";

const DIAS_DDS = [1, 3, 5];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function daqui(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type PendenciaSeverity = "critico" | "alto" | "medio" | "ok";

export interface PendenciaItem {
  key: string;
  count: number;
  severity: PendenciaSeverity;
  ok: boolean;
  loading: boolean;
  /** Bloqueia operação? (some no header count quando true para itens críticos) */
  blocking?: boolean;
  /** Sem dados-base para avaliar (ex.: sistema novo, tabela vazia). Não renderiza verde. */
  noData?: boolean;
}

const ORDER: PendenciaSeverity[] = ["critico", "alto", "medio", "ok"];

export function severityRank(s: PendenciaSeverity): number {
  return ORDER.indexOf(s);
}

export function usePendencias() {
  const hoje = todayISO();
  const limite30 = daqui(30);
  const limite60 = daqui(60);
  const limite7 = daqui(7);
  const diaSem = new Date().getDay();
  const ehDiaDeDDS = DIAS_DDS.includes(diaSem);
  const hojeDateObj = new Date();
  const ehDiaUtil = diaSem >= 1 && diaSem <= 5;

  // re-render quando snooze muda
  const [v, setV] = useState(0);
  useEffect(() => {
    const h = () => setV((x) => x + 1);
    window.addEventListener("sigmo:snooze-changed", h);
    return () => window.removeEventListener("sigmo:snooze-changed", h);
  }, []);

  const dds = useQuery({
    queryKey: ["pend-dds", hoje],
    enabled: ehDiaDeDDS,
    queryFn: async () => {
      const { count } = await supabase
        .from("dds").select("id", { count: "exact", head: true }).eq("data", hoje);
      return count ?? 0;
    },
  });

  const req = useQuery({
    queryKey: ["pend-req"],
    queryFn: async () => {
      const { count } = await supabase
        .from("purchase_requisitions").select("id", { count: "exact", head: true }).eq("status", "PENDENTE");
      return count ?? 0;
    },
  });

  const epi = useQuery({
    queryKey: ["pend-epi"],
    queryFn: async () => {
      const { data } = await supabase.from("estoque_epi").select("id, quantidade_atual, estoque_minimo");
      const rows = data ?? [];
      const baixo = rows.filter((e) => (e.quantidade_atual ?? 0) <= (e.estoque_minimo ?? 0)).length;
      const critico = rows.filter((e) => (e.quantidade_atual ?? 0) <= 5).length;
      return { baixo, critico, total: rows.length };
    },
  });

  // APR vencidas (críticas) e vencendo em 7 dias (alto)
  const aprsVencidas = useQuery({
    queryKey: ["pend-aprs-vencidas", hoje],
    queryFn: async () => {
      const { count } = await supabase
        .from("aprs").select("id", { count: "exact", head: true })
        .lt("data_validade", hoje).neq("status", "CANCELADA");
      return count ?? 0;
    },
  });

  const aprsVencendo = useQuery({
    queryKey: ["pend-aprs-vencendo", hoje, limite7],
    queryFn: async () => {
      const { count } = await supabase
        .from("aprs").select("id", { count: "exact", head: true })
        .gte("data_validade", hoje).lte("data_validade", limite7);
      return count ?? 0;
    },
  });

  // PTE — usa data_emissao + 7 dias como validade aproximada
  const ptesVencidas = useQuery({
    queryKey: ["pend-ptes", hoje],
    queryFn: async () => {
      const seteAtras = daqui(-7);
      const { count } = await supabase
        .from("ptes").select("id", { count: "exact", head: true })
        .lt("data_emissao", seteAtras);
      return count ?? 0;
    },
  });

  // Exames vencidos (crítico) e vencendo 30d (alto)
  const examesVencidos = useQuery({
    queryKey: ["pend-exames-vencidos", hoje],
    queryFn: async () => {
      const { count } = await supabase
        .from("employee_exams").select("id", { count: "exact", head: true })
        .lt("data_vencimento", hoje);
      return count ?? 0;
    },
  });

  const exames30 = useQuery({
    queryKey: ["pend-exames-30", hoje, limite30],
    queryFn: async () => {
      const { count } = await supabase
        .from("employee_exams").select("id", { count: "exact", head: true })
        .gte("data_vencimento", hoje).lte("data_vencimento", limite30);
      return count ?? 0;
    },
  });

  // Vacinas vencidas
  const vacinasVencidas = useQuery({
    queryKey: ["pend-vacinas", hoje],
    queryFn: async () => {
      const { count } = await supabase
        .from("employee_vaccinations").select("id", { count: "exact", head: true })
        .lt("data_proxima_dose", hoje);
      return count ?? 0;
    },
  });

  // POPs com revisão atrasada
  const popsAtrasados = useQuery({
    queryKey: ["pend-pops", hoje],
    queryFn: async () => {
      const { count } = await supabase
        .from("procedimentos").select("id", { count: "exact", head: true })
        .lte("proxima_revisao", hoje);
      return count ?? 0;
    },
  });

  // Treinamentos vencendo em 60d (via matriz)
  const treinamentos60 = useQuery({
    queryKey: ["pend-trein-60"],
    queryFn: async () => {
      const { data: entries } = await supabase
        .from("training_matrix_entries").select("data_realizacao, course_id");
      if (!entries || entries.length === 0) return 0;
      const courseIds = [...new Set(entries.map((e: any) => e.course_id).filter(Boolean))];
      const { data: courses } = await supabase
        .from("trainings").select("id, validade_meses").in("id", courseIds as string[]);
      const map = new Map((courses ?? []).map((c: any) => [c.id, c.validade_meses]));
      const hojeT = new Date();
      const limite = new Date();
      limite.setDate(limite.getDate() + 60);
      let n = 0;
      for (const e of entries as any[]) {
        if (!e.data_realizacao || !e.course_id) continue;
        const meses = map.get(e.course_id) ?? 12;
        const venc = new Date(e.data_realizacao);
        venc.setMonth(venc.getMonth() + meses);
        if (venc >= hojeT && venc <= limite) n++;
      }
      return n;
    },
  });

  // Colaboradores ativos sem ASO ou sem integração
  const colabSemDocs = useQuery({
    queryKey: ["pend-colab-docs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("employees").select("id, data_aso, data_integracao, status").eq("status", "ATIVO");
      return (data ?? []).filter((e: any) => !e.data_aso || !e.data_integracao).length;
    },
  });

  // Extintores: recarga vencida (crítico) e inspeção mensal pendente (médio)
  const extintoresVencidos = useQuery({
    queryKey: ["pend-extintores-vencidos", hoje],
    queryFn: async () => {
      const { count } = await supabase
        .from("extintores").select("id", { count: "exact", head: true })
        .eq("status", "ATIVO").lt("proxima_recarga", hoje);
      return count ?? 0;
    },
  });

  const extintoresSemInspecao = useQuery({
    queryKey: ["pend-extintores-insp"],
    queryFn: async () => {
      const inicio = new Date(); inicio.setDate(1);
      const inicioISO = `${inicio.getFullYear()}-${String(inicio.getMonth() + 1).padStart(2, "0")}-01`;
      const [{ data: exts }, { data: insps }] = await Promise.all([
        supabase.from("extintores").select("id").eq("status", "ATIVO"),
        supabase.from("extintor_inspecoes").select("extintor_id, data_inspecao").gte("data_inspecao", inicioISO),
      ]);
      const feitos = new Set((insps ?? []).map((i: any) => i.extintor_id));
      return (exts ?? []).filter((e: any) => !feitos.has(e.id)).length;
    },
  });

  // Plano de Ações 5W2H — atrasadas (prazo vencido, não concluídas/canceladas)
  const acoesAtrasadas = useQuery({
    queryKey: ["pend-acoes-atrasadas", hoje],
    queryFn: async () => {
      const { count } = await supabase
        .from("plano_acoes").select("id", { count: "exact", head: true })
        .lt("quando", hoje)
        .not("status", "in", "(CONCLUIDA,CANCELADA)");
      return count ?? 0;
    },
  });

  // Plano de Ações — pendentes de verificação de eficácia (prazo da eficácia já chegou)
  const acoesEficacia = useQuery({
    queryKey: ["pend-acoes-eficacia", hoje],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { count } = await supabase
        .from("plano_acoes").select("id", { count: "exact", head: true })
        .eq("status", "CONCLUIDA")
        .eq("status_eficacia", "PENDENTE")
        .lte("data_verificacao_eficacia", nowIso);
      return count ?? 0;
    },
  });

  // OSS pendentes (assinatura, substituídas ou vencidas)
  const ossPendentes = useQuery({
    queryKey: ["pend-oss"],
    queryFn: async () => {
      const { count } = await supabase
        .from("oss_emissoes").select("id", { count: "exact", head: true })
        .in("status", ["PENDENTE_ASSINATURA", "SUBSTITUIDO", "VENCIDO"]);
      return count ?? 0;
    },
  });

  // Inspeção mensal de EPI — dia útil ≥ 25 do mês, sem registro no mês
  // Sem tabela própria: marca como pendente nos últimos 5 dias úteis do mês
  const dia = hojeDateObj.getDate();
  const ultimoDiaMes = new Date(hojeDateObj.getFullYear(), hojeDateObj.getMonth() + 1, 0).getDate();
  const inspecaoEpiPend = ehDiaUtil && (ultimoDiaMes - dia) <= 6 ? 1 : 0;

  // Datasets base — para distinguir "tudo certo" real de "sistema sem dados"
  const datasets = useQuery({
    queryKey: ["pend-datasets"],
    queryFn: async () => {
      const head = (t: string) => supabase.from(t as any).select("id", { count: "exact", head: true });
      const [emp, aprs, ptes, exames, vacinas, pops, matriz, epis, reqs, dds] = await Promise.all([
        supabase.from("employees").select("id", { count: "exact", head: true }).eq("status", "ATIVO"),
        head("aprs"), head("ptes"), head("employee_exams"), head("employee_vaccinations"),
        head("procedimentos"), head("training_matrix_entries"), head("estoque_epi"),
        supabase.from("purchase_requisitions").select("id", { count: "exact", head: true }),
        supabase.from("dds").select("id", { count: "exact", head: true }),
      ]);
      return {
        employees: emp.count ?? 0,
        aprs: aprs.count ?? 0,
        ptes: ptes.count ?? 0,
        exames: exames.count ?? 0,
        vacinas: vacinas.count ?? 0,
        pops: pops.count ?? 0,
        matriz: matriz.count ?? 0,
        epis: epis.count ?? 0,
        reqs: reqs.count ?? 0,
        dds: dds.count ?? 0,
      };
    },
  });
  const ds = datasets.data;
  const has = (n: number | undefined) => (n ?? 0) > 0;

  const items: PendenciaItem[] = [
    {
      key: "asos-vencidos",
      count: examesVencidos.data ?? 0,
      severity: (examesVencidos.data ?? 0) > 0 ? "critico" : "ok",
      ok: (examesVencidos.data ?? 0) === 0,
      loading: examesVencidos.isLoading,
      blocking: true,
      noData: !has(ds?.exames),
    },
    {
      key: "aprs-vencidas",
      count: aprsVencidas.data ?? 0,
      severity: (aprsVencidas.data ?? 0) > 0 ? "critico" : "ok",
      ok: (aprsVencidas.data ?? 0) === 0,
      loading: aprsVencidas.isLoading,
      blocking: true,
      noData: !has(ds?.aprs),
    },
    {
      key: "pops-atrasados",
      count: popsAtrasados.data ?? 0,
      severity: (popsAtrasados.data ?? 0) > 0 ? "critico" : "ok",
      ok: (popsAtrasados.data ?? 0) === 0,
      loading: popsAtrasados.isLoading,
      noData: !has(ds?.pops),
    },
    {
      key: "vacinas-vencidas",
      count: vacinasVencidas.data ?? 0,
      severity: (vacinasVencidas.data ?? 0) > 0 ? "critico" : "ok",
      ok: (vacinasVencidas.data ?? 0) === 0,
      loading: vacinasVencidas.isLoading,
      noData: !has(ds?.vacinas),
    },
    {
      key: "colab-sem-docs",
      count: colabSemDocs.data ?? 0,
      severity: (colabSemDocs.data ?? 0) > 0 ? "critico" : "ok",
      ok: (colabSemDocs.data ?? 0) === 0,
      loading: colabSemDocs.isLoading,
      noData: !has(ds?.employees),
    },
    {
      key: "dds-hoje",
      count: ehDiaDeDDS ? ((dds.data ?? 0) > 0 ? 0 : 1) : 0,
      severity: ehDiaDeDDS && (dds.data ?? 0) === 0 ? "alto" : "ok",
      ok: !ehDiaDeDDS || (dds.data ?? 0) > 0,
      loading: dds.isLoading,
      // Só pode ser "verde" se DE FATO houve DDS hoje (count>0). Fora do dia de DDS = neutro.
      noData: !ehDiaDeDDS || (dds.data ?? 0) === 0 ? !ehDiaDeDDS : false,
    },
    {
      key: "aprs-vencendo",
      count: aprsVencendo.data ?? 0,
      severity: (aprsVencendo.data ?? 0) > 0 ? "alto" : "ok",
      ok: (aprsVencendo.data ?? 0) === 0,
      loading: aprsVencendo.isLoading,
      noData: !has(ds?.aprs),
    },
    {
      key: "ptes-vencidas",
      count: ptesVencidas.data ?? 0,
      severity: (ptesVencidas.data ?? 0) > 0 ? "alto" : "ok",
      ok: (ptesVencidas.data ?? 0) === 0,
      loading: ptesVencidas.isLoading,
      noData: !has(ds?.ptes),
    },
    {
      key: "exames-30",
      count: exames30.data ?? 0,
      severity: (exames30.data ?? 0) > 0 ? "alto" : "ok",
      ok: (exames30.data ?? 0) === 0,
      loading: exames30.isLoading,
      noData: !has(ds?.exames),
    },
    {
      key: "trein-60",
      count: treinamentos60.data ?? 0,
      severity: (treinamentos60.data ?? 0) > 0 ? "medio" : "ok",
      ok: (treinamentos60.data ?? 0) === 0,
      loading: treinamentos60.isLoading,
      noData: !has(ds?.matriz),
    },
    {
      key: "req-pendentes",
      count: req.data ?? 0,
      severity: (req.data ?? 0) > 0 ? "medio" : "ok",
      ok: (req.data ?? 0) === 0,
      loading: req.isLoading,
      noData: !has(ds?.reqs),
    },
    {
      key: "epi-critico",
      count: epi.data?.critico ?? 0,
      severity: (epi.data?.critico ?? 0) > 0 ? "critico" : "ok",
      ok: (epi.data?.critico ?? 0) === 0,
      loading: epi.isLoading,
      blocking: true,
      noData: !has(ds?.epis),
    },
    {
      key: "epi-baixo",
      count: epi.data?.baixo ?? 0,
      severity: (epi.data?.baixo ?? 0) > 0 ? "medio" : "ok",
      ok: (epi.data?.baixo ?? 0) === 0,
      loading: epi.isLoading,
      noData: !has(ds?.epis),
    },
    {
      key: "inspecao-epi",
      count: inspecaoEpiPend,
      severity: inspecaoEpiPend > 0 ? "medio" : "ok",
      ok: inspecaoEpiPend === 0,
      loading: false,
      // Sem registro de inspeção: fora da janela de fim de mês fica neutro, não verde.
      noData: inspecaoEpiPend === 0,
    },
    {
      key: "extintores-vencidos",
      count: extintoresVencidos.data ?? 0,
      severity: (extintoresVencidos.data ?? 0) > 0 ? "critico" : "ok",
      ok: (extintoresVencidos.data ?? 0) === 0,
      loading: extintoresVencidos.isLoading,
      blocking: true,
    },
    {
      key: "extintores-sem-inspecao",
      count: extintoresSemInspecao.data ?? 0,
      severity: (extintoresSemInspecao.data ?? 0) > 0 ? "medio" : "ok",
      ok: (extintoresSemInspecao.data ?? 0) === 0,
      loading: extintoresSemInspecao.isLoading,
    },
    {
      key: "acoes-atrasadas",
      count: acoesAtrasadas.data ?? 0,
      severity: (acoesAtrasadas.data ?? 0) > 0 ? "critico" : "ok",
      ok: (acoesAtrasadas.data ?? 0) === 0,
      loading: acoesAtrasadas.isLoading,
    },
    {
      key: "acoes-eficacia",
      count: acoesEficacia.data ?? 0,
      severity: (acoesEficacia.data ?? 0) > 0 ? "alto" : "ok",
      ok: (acoesEficacia.data ?? 0) === 0,
      loading: acoesEficacia.isLoading,
    },
    {
      key: "oss-pendentes",
      count: ossPendentes.data ?? 0,
      severity: (ossPendentes.data ?? 0) > 0 ? "alto" : "ok",
      ok: (ossPendentes.data ?? 0) === 0,
      loading: ossPendentes.isLoading,
    },
  ];

  const activeItems = items.filter((i) => !i.ok && !isSnoozed(i.key));
  const totalPendencias = activeItems.length;
  // contador para badge ignora itens "ok"; snooze remove do badge também
  void v;

  return { items, activeItems, totalPendencias };
}
