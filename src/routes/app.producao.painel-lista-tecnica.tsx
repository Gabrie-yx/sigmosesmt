import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LabelList, Cell, PieChart, Pie, RadialBarChart, RadialBar, Legend,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  AreaChart, Area,
} from "recharts";
import { LayoutDashboard, RefreshCw, Filter, Package, TrendingUp, Layers } from "lucide-react";
import { resolveTipo } from "@/lib/mb51-parser";
import type { TipoMP } from "@/lib/base-mp-parser";

const CATEGORIAS: TipoMP[] = ["FERRO", "SOLDA", "GÁS", "TINTA", "OUTROS"];
type CategoriaMaterial = TipoMP;

export const Route = createFileRoute("/app/producao/painel-lista-tecnica")({
  component: PainelListaTecnicaPage,
});

const fmt = (n: number, d = 2) =>
  Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

const MES_LABEL = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const mesKey = (d: Date) => `${MES_LABEL[d.getMonth()]} ${d.getFullYear()}`;

const CAT_COLOR: Record<CategoriaMaterial, string> = {
  FERRO: "hsl(0 72% 45%)",
  SOLDA: "hsl(28 90% 55%)",
  "GÁS": "hsl(200 85% 50%)",
  TINTA: "hsl(265 70% 55%)",
  OUTROS: "hsl(150 50% 45%)",
};

const CAT_ICON: Record<CategoriaMaterial, string> = {
  FERRO: "▮",
  SOLDA: "⚡",
  "GÁS": "◉",
  TINTA: "✦",
  OUTROS: "◆",
};

// Tipo de gráfico por categoria (diversificação visual)
type ChartKind = "stacked" | "donut2" | "radial" | "gauge" | "radar";
const CAT_CHART: Record<CategoriaMaterial, ChartKind> = {
  FERRO: "stacked",
  SOLDA: "donut2",
  "GÁS": "radial",
  TINTA: "gauge",
  OUTROS: "radar",
};

// Tooltip customizado — usa tokens semânticos, sem preto pesado
const FancyTooltip = ({ active, payload, label, accent, unit = "" }: any) => {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0];
  const titulo = p?.payload?.label ?? p?.payload?.mes ?? label ?? "";
  const desc = p?.payload?.desc;
  return (
    <div
      className="rounded-lg border shadow-lg backdrop-blur-md px-3 py-2 text-xs pointer-events-none"
      style={{
        background: "color-mix(in oklch, hsl(var(--popover)) 92%, transparent)",
        borderColor: accent ?? "hsl(var(--border))",
        borderLeftWidth: 3,
        color: "hsl(var(--popover-foreground))",
        maxWidth: 220,
      }}
    >
      <div className="font-medium tracking-wide" style={{ color: accent }}>{titulo}</div>
      {desc && <div className="text-[10px] text-muted-foreground truncate">{desc}</div>}
      <div className="font-mono tabular-nums mt-0.5 font-normal">
        {fmt(Number(p.value), 0)} {unit}
      </div>
    </div>
  );
};

function PainelListaTecnicaPage() {
  const qc = useQueryClient();
  const [ordemSel, setOrdemSel] = useState<string | null>(null);
  const [codigoSel, setCodigoSel] = useState<string | null>(null);
  const [unidadeSel, setUnidadeSel] = useState<string | null>(null);
  const [catSel, setCatSel] = useState<CategoriaMaterial | null>(null);

  const { data: cascos = [] } = useQuery({
    queryKey: ["cascos-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cascos").select("id, numero, nome").order("numero");
      if (error) throw error;
      return data ?? [];
    },
  });

  // ===== MB51: Ordens importadas (cada Ordem SAP = uma OP do painel) =====
  const { data: mb51Ordens = [] } = useQuery({
    queryKey: ["mb51-ordens"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("producao_mb51_ordens")
        .select("*")
        .order("numero_sap");
      if (error) throw error;
      return data ?? [];
    },
  });

  // ===== Base MP (fonte da verdade para tipo) =====
  const { data: baseMp = [] } = useQuery({
    queryKey: ["mb51-base-mp-map"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("producao_base_materia_prima")
        .select("codigo, tipo");
      if (error) throw error;
      return data ?? [];
    },
  });
  const baseMpMap = useMemo(() => {
    const m = new Map<string, TipoMP>();
    (baseMp as any[]).forEach((b) => m.set(String(b.codigo), b.tipo));
    return m;
  }, [baseMp]);

  // ===== Listas técnicas (planejado) — para KPI plan × real =====
  const { data: listasAtuais = [] } = useQuery({
    queryKey: ["listas-tecnicas-latest"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("producao_lista_tecnica")
        .select("*")
        .order("versao", { ascending: false });
      if (error) throw error;
      const map = new Map<string, any>();
      (data ?? []).forEach((l: any) => {
        if (!map.has(l.casco_id)) map.set(l.casco_id, l);
      });
      return Array.from(map.values());
    },
  });

  // ===== Movimentos MB51 da Ordem selecionada =====
  const ordemAtivaId = ordemSel ?? (mb51Ordens as any[])[0]?.id ?? null;
  const ordemAtiva = (mb51Ordens as any[]).find((o) => o.id === ordemAtivaId) ?? null;

  const { data: movimentos = [], isFetching } = useQuery({
    queryKey: ["mb51-movimentos", ordemAtivaId],
    enabled: !!ordemAtivaId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("producao_mb51_movimentos")
        .select("*")
        .eq("ordem_id", ordemAtivaId);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("painel-mb51")
      .on("postgres_changes", { event: "*", schema: "public", table: "producao_mb51_ordens" }, () => {
        qc.invalidateQueries({ queryKey: ["mb51-ordens"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "producao_mb51_movimentos" }, () => {
        qc.invalidateQueries({ queryKey: ["mb51-movimentos"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "producao_base_materia_prima" }, () => {
        qc.invalidateQueries({ queryKey: ["mb51-base-mp-map"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const cascoById = useMemo(() => {
    const m = new Map<string, any>();
    (cascos as any[]).forEach((c) => m.set(c.id, c));
    return m;
  }, [cascos]);

  // Lista técnica (planejado) para o casco da ordem ativa
  const listaPorCasco = useMemo(() => {
    const m = new Map<string, any>();
    (listasAtuais as any[]).forEach((l) => m.set(l.casco_id, l));
    return m;
  }, [listasAtuais]);

  // Enriquece movimentos: tipo resolvido pela Base MP, consumo positivo (líquido = -quantidade)
  const itensEnriq = useMemo(() => {
    return (movimentos as any[]).map((m) => {
      const tipo = resolveTipo(String(m.material), m.classificacao_mb51, baseMpMap);
      return {
        ...m,
        codigo_sap: String(m.material),
        descricao_sap: m.descricao,
        consumo: -Number(m.quantidade ?? 0), // consumo positivo
        categoria: tipo,
      };
    });
  }, [movimentos, baseMpMap]);

  const cascoAtivo = ordemAtiva?.casco_id ? cascoById.get(ordemAtiva.casco_id) : null;
  const listaPlan = ordemAtiva?.casco_id ? listaPorCasco.get(ordemAtiva.casco_id) : null;

  const itensFiltrados = itensEnriq;

  const itensVisiveis = useMemo(() => {
    return itensFiltrados.filter((it) => {
      if (codigoSel && String(it.codigo_sap) !== codigoSel) return false;
      if (unidadeSel && String(it.unidade ?? "—").toUpperCase() !== unidadeSel) return false;
      if (catSel && it.categoria !== catSel) return false;
      return true;
    });
  }, [itensFiltrados, codigoSel, unidadeSel, catSel]);

  // KPIs: realizado (MB51 consumo líquido) × planejado (Lista Técnica)
  const kpi = useMemo(() => {
    const consumo = itensVisiveis.reduce((s, it) => s + (it.consumo ?? 0), 0);
    const pesoEst = Number(listaPlan?.peso_total_estimado ?? 0);
    const linhas = itensVisiveis.length;
    const distintos = new Set(itensVisiveis.map((it) => String(it.codigo_sap))).size;
    const desvio = pesoEst > 0 ? ((consumo - pesoEst) / pesoEst) * 100 : 0;
    return { pesoReal: consumo, pesoEst, pecas: linhas, distintos, desvio };
  }, [itensVisiveis, listaPlan]);

  const dadosPorCategoria = useMemo(() => {
    const result: Record<CategoriaMaterial, { barras: any[]; serie: any[]; totalPeso: number; totalItens: number }> = {
      FERRO: { barras: [], serie: [], totalPeso: 0, totalItens: 0 },
      SOLDA: { barras: [], serie: [], totalPeso: 0, totalItens: 0 },
      "GÁS": { barras: [], serie: [], totalPeso: 0, totalItens: 0 },
      TINTA: { barras: [], serie: [], totalPeso: 0, totalItens: 0 },
      OUTROS: { barras: [], serie: [], totalPeso: 0, totalItens: 0 },
    };
    CATEGORIAS.forEach((cat) => {
      const baseItens = itensFiltrados.filter((it) => {
        if (unidadeSel && String(it.unidade ?? "—").toUpperCase() !== unidadeSel) return false;
        return it.categoria === cat;
      });
      const barMap = new Map<string, number>();
      baseItens.forEach((it) => {
        const u = String(it.unidade ?? "—").toUpperCase();
        const valor = Math.abs(Number(it.consumo ?? 0));
        barMap.set(u, (barMap.get(u) ?? 0) + valor);
      });
      const barras = Array.from(barMap.entries())
        .map(([label, valor]) => ({ label, valor }))
        .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor))
        .slice(0, 8);

      const itemMap = new Map<string, { codigo: string; desc: string; peso: number }>();
      baseItens.forEach((it) => {
        const cod = String(it.codigo_sap ?? "");
        if (!cod) return;
        const cur = itemMap.get(cod) ?? { codigo: cod, desc: String(it.descricao_sap ?? ""), peso: 0 };
        cur.peso += Math.abs(Number(it.consumo ?? 0));
        itemMap.set(cod, cur);
      });
      const serie = Array.from(itemMap.values())
        .sort((a, b) => b.peso - a.peso)
        .slice(0, 10)
        .map((i) => ({ mes: i.codigo, valor: i.peso, desc: i.desc }));
      const totalPeso = baseItens.reduce((s, it) => s + Math.abs(Number(it.consumo ?? 0)), 0);
      result[cat] = { barras, serie, totalPeso, totalItens: baseItens.length };
    });
    return result;
  }, [itensFiltrados, unidadeSel]);

  const tabelaMateriais = useMemo(() => {
    const acc = new Map<string, { codigo: string; nome: string; qtd: number; ume: string; peso: number }>();
    // Não filtra por codigoSel — mantemos a lista completa e apenas destacamos o item selecionado.
    const baseTab = itensFiltrados.filter((it) => {
      if (unidadeSel && String(it.unidade ?? "—").toUpperCase() !== unidadeSel) return false;
      if (catSel && it.categoria !== catSel) return false;
      return true;
    });
    baseTab.forEach((it) => {
      const key = String(it.codigo_sap);
      const cur = acc.get(key) ?? {
        codigo: key,
        nome: String(it.descricao_sap ?? ""),
        qtd: 0,
        ume: String(it.unidade ?? "—"),
        peso: 0,
      };
      cur.qtd += Math.abs(Number(it.consumo ?? 0));
      cur.peso += Math.abs(Number(it.consumo ?? 0));
      acc.set(key, cur);
    });
    return Array.from(acc.values()).sort((a, b) => Math.abs(b.peso) - Math.abs(a.peso));
  }, [itensFiltrados, unidadeSel, catSel]);

  const limparFiltros = () => { setCodigoSel(null); setUnidadeSel(null); setCatSel(null); };
  const algumFiltro = Boolean(codigoSel || unidadeSel || catSel);

  return (
    <div className="space-y-3 p-4 bg-gradient-to-br from-muted/40 via-background to-muted/20 min-h-screen">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 tracking-tight">
            <LayoutDashboard className="h-7 w-7 text-primary" />
            Dashboard Dinâmico — Consumo de Insumos
          </h1>
          <p className="text-xs text-muted-foreground">
            Acompanhamento em tempo real de matéria-prima e insumos aplicados no casco. Clique em qualquer elemento para filtrar.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => {
          qc.invalidateQueries({ queryKey: ["mb51-ordens"] });
          qc.invalidateQueries({ queryKey: ["mb51-movimentos"] });
          qc.invalidateQueries({ queryKey: ["mb51-base-mp-map"] });
          qc.invalidateQueries({ queryKey: ["listas-tecnicas-latest"] });
        }}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      {/* Seletor de Ordem SAP (cada Ordem SAP = um casco com consumo MB51) */}
      <Card className="shadow-sm border-primary/10">
        <CardContent className="p-3 flex items-center gap-3 flex-wrap justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold pr-1">
              Ordem SAP / Casco:
            </span>
            <select
              value={ordemAtivaId ?? ""}
              onChange={(e) => { setOrdemSel(e.target.value || null); limparFiltros(); }}
              className="px-4 py-2 rounded-md text-sm font-bold border border-primary/30 bg-primary/5 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 min-w-[340px]"
            >
              {(mb51Ordens as any[]).length === 0 && <option value="">Nenhuma MB51 importada — faça upload em Ordens de Produção</option>}
              {(mb51Ordens as any[]).map((o) => {
                const c = o.casco_id ? cascoById.get(o.casco_id) : null;
                const label = c ? `${c.nome ? String(c.nome).toUpperCase() + " - " : ""}CASCO ${c.numero}` : (o.texto_documento ?? "—");
                return (
                  <option key={o.id} value={o.id}>
                    SAP {o.numero_sap} · {label}
                  </option>
                );
              })}
            </select>
            {algumFiltro && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={limparFiltros}>
                <Filter className="h-3 w-3 mr-1" /> Limpar filtros
              </Button>
            )}
          </div>
          {algumFiltro && (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
              {codigoSel && <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono">cód {codigoSel}</span>}
              {unidadeSel && <span className="px-2 py-0.5 rounded bg-primary/10 text-primary">UME {unidadeSel}</span>}
              {catSel && <span className="px-2 py-0.5 rounded bg-primary/10 text-primary">{catSel}</span>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Realizado (MB51)", value: `${fmt(kpi.pesoReal, 0)}`, icon: Package, accent: "from-primary/20 to-primary/5", textCls: "text-primary" },
          { label: "Planejado (B51)", value: `${fmt(kpi.pesoEst, 0)} kg`, icon: Layers, accent: "from-accent/20 to-accent/5", textCls: "text-accent-foreground" },
          { label: "Desvio Real vs Plan.", value: kpi.pesoEst > 0 ? `${kpi.desvio >= 0 ? "+" : ""}${fmt(kpi.desvio, 2)}%` : "—", icon: TrendingUp, accent: kpi.desvio > 0 ? "from-red-500/20 to-red-500/5" : "from-green-500/20 to-green-500/5", textCls: kpi.desvio > 0 ? "text-red-600" : "text-green-600" },
          { label: "Códigos Distintos", value: fmt(kpi.distintos, 0), icon: Filter, accent: "from-blue-500/15 to-blue-500/5", textCls: "text-blue-600" },
          { label: "Movimentos MB51", value: fmt(kpi.pecas, 0), icon: Package, accent: "from-amber-500/15 to-amber-500/5", textCls: "text-amber-700" },
        ].map((k) => (
          <Card key={k.label} className={`shadow-sm bg-gradient-to-br ${k.accent} border-0`}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{k.label}</span>
                <k.icon className={`h-4 w-4 ${k.textCls}`} />
              </div>
              <div className={`text-xl font-bold mt-1 ${k.textCls}`}>{k.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Layout principal: esquerda (categorias) + direita (tabela de materiais) */}
      <div className="grid gap-3 grid-cols-1 xl:grid-cols-[1fr_380px]">
        <div className="space-y-3">
          {(["FERRO", "SOLDA", "GÁS", "TINTA", "OUTROS"] as CategoriaMaterial[]).map((cat) => {
            const { barras, serie, totalPeso, totalItens } = dadosPorCategoria[cat];
            const vazio = barras.length === 0;
            const cor = CAT_COLOR[cat];
            const ativoCat = catSel === cat;
            return (
              <div key={cat} className="grid gap-3 grid-cols-1 lg:grid-cols-[1fr_1.4fr]">
                {/* Card de barras por UME */}
                <Card
                  className={`shadow-sm cursor-pointer transition ${ativoCat ? "ring-2 ring-offset-1" : "hover:shadow-md"}`}
                  style={ativoCat ? { boxShadow: `0 0 0 2px ${cor}` } : undefined}
                  onClick={() => setCatSel((p) => (p === cat ? null : cat))}
                >
                  <CardHeader className="pb-1 pt-3 px-4 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-sm font-bold tracking-wide flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-sm" style={{ background: cor }} />
                      <span style={{ color: cor }}>{CAT_ICON[cat]}</span> {cat}
                    </CardTitle>
                    <div className="text-right">
                      <div className="text-sm font-bold" style={{ color: cor }}>{fmt(totalPeso, 0)} kg</div>
                      <div className="text-[10px] text-muted-foreground">{totalItens} itens</div>
                    </div>
                  </CardHeader>
                  <CardContent className="h-44 p-2">
                    {vazio ? (
                      <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Sem dados</div>
                    ) : CAT_CHART[cat] === "donut" || CAT_CHART[cat] === "pie" ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Tooltip content={<FancyTooltip accent={cor} />} />
                          <Pie
                            data={barras}
                            dataKey="valor"
                            nameKey="label"
                            innerRadius={CAT_CHART[cat] === "donut" ? 32 : 0}
                            outerRadius={62}
                            paddingAngle={2}
                            onClick={(d: any) => setUnidadeSel((p) => (p === d.label ? null : d.label))}
                            className="cursor-pointer focus:outline-none"
                            label={(e: any) => `${e.label} · ${fmt(Number(e.value), 0)}`}
                            labelLine={false}
                            style={{ fontSize: 10, fill: "hsl(var(--foreground))" }}
                          >
                            {barras.map((b, i) => (
                              <Cell
                                key={i}
                                fill={unidadeSel && unidadeSel !== b.label
                                  ? `color-mix(in oklch, ${cor} 30%, transparent)`
                                  : `color-mix(in oklch, ${cor} ${95 - i * 10}%, white)`}
                                stroke={unidadeSel === b.label ? cor : "hsl(var(--background))"}
                                strokeWidth={unidadeSel === b.label ? 2 : 1}
                              />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    ) : CAT_CHART[cat] === "radial" ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <RadialBarChart
                          data={barras.map((b, i) => ({ ...b, fill: `color-mix(in oklch, ${cor} ${90 - i * 12}%, white)` }))}
                          innerRadius="25%"
                          outerRadius="100%"
                          startAngle={90}
                          endAngle={-270}
                        >
                          <Tooltip content={<FancyTooltip accent={cor} />} />
                          <RadialBar
                            background={{ fill: `color-mix(in oklch, ${cor} 8%, transparent)` }}
                            dataKey="valor"
                            cornerRadius={6}
                            onClick={(d: any) => setUnidadeSel((p) => (p === d.label ? null : d.label))}
                            className="cursor-pointer"
                          />
                          <Legend iconSize={8} layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: 10 }} formatter={(_v, e: any) => e?.payload?.label} />
                        </RadialBarChart>
                      </ResponsiveContainer>
                    ) : CAT_CHART[cat] === "bar-h" ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={barras} layout="vertical" margin={{ left: 4, right: 28, top: 4, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                          <XAxis type="number" hide />
                          <YAxis type="category" dataKey="label" width={36} stroke="hsl(var(--muted-foreground))" fontSize={10} />
                          <Tooltip cursor={{ fill: `color-mix(in oklch, ${cor} 10%, transparent)` }} content={<FancyTooltip accent={cor} />} />
                          <Bar
                            dataKey="valor"
                            radius={[0, 4, 4, 0]}
                            onClick={(d: any) => setUnidadeSel((p) => (p === d.label ? null : d.label))}
                            className="cursor-pointer"
                          >
                            {barras.map((b, i) => (
                              <Cell key={i} fill={unidadeSel && unidadeSel !== b.label ? `color-mix(in oklch, ${cor} 30%, transparent)` : cor} />
                            ))}
                            <LabelList dataKey="valor" position="right" fontSize={10} fill={cor} formatter={(v: any) => fmt(Number(v), 0)} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={barras} margin={{ left: 4, right: 8, top: 18, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                          <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={10} interval={0} />
                          <YAxis hide />
                          <Tooltip cursor={{ fill: `color-mix(in oklch, ${cor} 10%, transparent)` }} content={<FancyTooltip accent={cor} />} />
                          <Bar
                            dataKey="valor"
                            radius={[4, 4, 0, 0]}
                            onClick={(d: any) => setUnidadeSel((p) => (p === d.label ? null : d.label))}
                            className="cursor-pointer"
                          >
                            {barras.map((b, i) => (
                              <Cell
                                key={i}
                                fill={unidadeSel && unidadeSel !== b.label ? `color-mix(in oklch, ${cor} 30%, transparent)` : cor}
                                stroke={unidadeSel === b.label ? cor : "transparent"}
                                strokeWidth={unidadeSel === b.label ? 2 : 0}
                              />
                            ))}
                            <LabelList dataKey="valor" position="top" fontSize={10} fill={cor} formatter={(v: any) => fmt(Number(v), 0)} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                {/* Card de série temporal */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-1 pt-3 px-4 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-xs text-muted-foreground font-medium">
                      Top itens — <span className="font-bold" style={{ color: cor }}>{cat}</span>
                    </CardTitle>
                    {serie.length > 0 && (
                      <span className="text-[10px] text-muted-foreground">{serie.length} código(s)</span>
                    )}
                  </CardHeader>
                  <CardContent className="h-44 p-2">
                    {serie.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Sem itens nessa categoria</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={serie} layout="vertical" margin={{ left: 4, right: 32, top: 4, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                          <XAxis type="number" hide />
                          <YAxis type="category" dataKey="mes" width={78} stroke="hsl(var(--muted-foreground))" fontSize={10} tick={{ fontFamily: "monospace" }} />
                          <Tooltip
                            cursor={{ fill: `color-mix(in oklch, ${cor} 10%, transparent)` }}
                            content={<FancyTooltip accent={cor} unit="kg" />}
                          />
                          <Bar
                            dataKey="valor"
                            radius={[0, 4, 4, 0]}
                            onClick={(d: any) => setCodigoSel((p) => (p === d.mes ? null : d.mes))}
                            className="cursor-pointer"
                          >
                            {serie.map((s: any, i: number) => (
                              <Cell
                                key={i}
                                fill={codigoSel && codigoSel !== s.mes ? `color-mix(in oklch, ${cor} 30%, transparent)` : cor}
                                stroke={codigoSel === s.mes ? cor : "transparent"}
                                strokeWidth={codigoSel === s.mes ? 2 : 0}
                              />
                            ))}
                            <LabelList
                              dataKey="valor"
                              position="right"
                              fontSize={10}
                              fill={cor}
                              formatter={(v: any) => fmt(Number(v), 0)}
                            />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>

        {/* Painel lateral: tabela de materiais */}
        <Card className="shadow-sm xl:sticky xl:top-3 self-start h-fit max-h-[calc(100vh-100px)] overflow-hidden flex flex-col">
          <CardHeader className="pb-2 pt-3 px-4 border-b">
            <CardTitle className="text-sm font-bold flex items-center justify-between">
              <span className="flex items-center gap-2"><Package className="h-4 w-4 text-primary" /> Materiais aplicados</span>
              <span className="text-[10px] text-muted-foreground font-normal">{tabelaMateriais.length} itens</span>
            </CardTitle>
          </CardHeader>
          <div className="overflow-y-auto overflow-x-hidden flex-1">
            <table className="w-full text-xs table-fixed">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur z-10">
                <tr className="text-left">
                  <th className="px-2 py-2 font-semibold w-[170px]">Nome do Material</th>
                  <th className="px-1 py-2 font-semibold text-right w-[70px]">Qtd</th>
                  <th className="px-1 py-2 font-semibold text-right w-[70px]">Peso<br/>(kg)</th>
                  <th className="px-1 py-2 font-semibold w-[40px]">UM</th>
                </tr>
              </thead>
              <tbody>
                {tabelaMateriais.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">Nenhum item</td></tr>
                )}
                {tabelaMateriais.map((m) => {
                  const ativo = codigoSel === m.codigo;
                  return (
                    <tr
                      key={m.codigo}
                      onClick={() => setCodigoSel((p) => (p === m.codigo ? null : m.codigo))}
                      className={`cursor-pointer border-b border-border/50 transition ${ativo ? "bg-primary/15 ring-2 ring-primary ring-inset font-semibold" : "hover:bg-muted/50"}`}
                    >
                      <td className="px-2 py-1.5 truncate" title={`${m.codigo} · ${m.nome}`}>
                        <div className="truncate font-medium">{m.nome}</div>
                        <div className="truncate font-mono text-[10px] text-muted-foreground">{m.codigo}</div>
                      </td>
                      <td className="px-1 py-1.5 text-right tabular-nums">{fmt(m.qtd, 0)}</td>
                      <td className="px-1 py-1.5 text-right tabular-nums font-semibold">{fmt(m.peso, 0)}</td>
                      <td className="px-1 py-1.5 text-muted-foreground uppercase text-[10px]">{m.ume}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="sticky bottom-0 bg-primary text-primary-foreground font-bold">
                <tr>
                  <td className="px-2 py-2" colSpan={2}>TOTAL KG</td>
                  <td className="px-1 py-2 text-right tabular-nums">{fmt(kpi.pesoReal, 0)}</td>
                  <td className="px-1 py-2 text-[10px]">kg</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      </div>

      {cascoAtivo && (
        <p className="text-xs text-muted-foreground text-center pt-2">
          Exibindo MB51 da Ordem SAP <span className="font-semibold">{ordemAtiva?.numero_sap}</span> · {cascoAtivo.nome ?? ""} — Casco {cascoAtivo.numero}
          {codigoSel ? ` • código ${codigoSel}` : ""}
          {unidadeSel ? ` • UME ${unidadeSel}` : ""}
          {catSel ? ` • categoria ${catSel}` : ""}
        </p>
      )}
      {!cascoAtivo && ordemAtiva && (
        <p className="text-xs text-muted-foreground text-center pt-2">
          Exibindo Ordem SAP <span className="font-semibold">{ordemAtiva.numero_sap}</span> · sem casco vinculado (texto: "{ordemAtiva.texto_documento ?? "—"}")
        </p>
      )}
    </div>
  );
}
