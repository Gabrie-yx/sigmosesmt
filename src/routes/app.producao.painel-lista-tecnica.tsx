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
  AreaChart, Area, ReferenceDot, ReferenceLine,
  LineChart, Line, ScatterChart, Scatter, ZAxis,
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
  SOLDA: "radar",
  "GÁS": "radial",
  TINTA: "gauge",
  OUTROS: "radar",
};

// Variação do gráfico de FOCO (quando um item do painel lateral é selecionado)
type FocusKind = "bullet" | "donut" | "slope" | "gauge-h" | "radial-single" | "radar";
const CAT_FOCUS: Record<CategoriaMaterial, FocusKind> = {
  FERRO: "bullet",
  SOLDA: "radar",
  "GÁS": "slope",
  TINTA: "gauge-h",
  OUTROS: "radial-single",
};

// Variação do gráfico "Top itens" por categoria
type TopKind = "vbar" | "hbar" | "line" | "area" | "scatter";
const CAT_TOP: Record<CategoriaMaterial, TopKind> = {
  FERRO: "vbar",
  SOLDA: "hbar",
  "GÁS": "line",
  TINTA: "area",
  OUTROS: "scatter",
};

// Paleta com variação de matiz a partir de uma cor base — para colorir itens distintos
const variantPalette = (base: string) => [
  base,
  `color-mix(in oklch, ${base} 60%, hsl(45 90% 55%))`,
  `color-mix(in oklch, ${base} 60%, hsl(195 80% 50%))`,
  `color-mix(in oklch, ${base} 55%, hsl(280 70% 55%))`,
  `color-mix(in oklch, ${base} 60%, hsl(150 65% 45%))`,
  `color-mix(in oklch, ${base} 55%, hsl(330 75% 55%))`,
  `color-mix(in oklch, ${base} 65%, hsl(20 85% 55%))`,
  `color-mix(in oklch, ${base} 55%, hsl(220 70% 55%))`,
  `color-mix(in oklch, ${base} 70%, hsl(95 60% 45%))`,
  `color-mix(in oklch, ${base} 50%, hsl(0 0% 35%))`,
];

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
      // IMPORTANTE: não filtrar por `unidadeSel` aqui — uma UME selecionada
      // pode não existir em outras categorias e zerar todos os outros cards.
      // A seleção de UME apenas destaca a fatia/barra e filtra a tabela lateral.
      const baseItens = itensFiltrados.filter((it) => it.categoria === cat);
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
  }, [itensFiltrados]);

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

  // Info do item selecionado na tabela lateral (para projetar dentro do card da sua categoria)
  const itemSelInfo = useMemo(() => {
    if (!codigoSel) return null;
    const it = itensFiltrados.find((x) => String(x.codigo_sap) === codigoSel);
    if (!it) return null;
    const peso = itensFiltrados
      .filter((x) => String(x.codigo_sap) === codigoSel)
      .reduce((s, x) => s + Math.abs(Number(x.consumo ?? 0)), 0);
    return {
      codigo: codigoSel,
      categoria: it.categoria as CategoriaMaterial,
      nome: String(it.descricao_sap ?? ""),
      ume: String(it.unidade ?? "—").toUpperCase(),
      peso,
    };
  }, [codigoSel, itensFiltrados]);

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
            const focoItem = itemSelInfo && itemSelInfo.categoria === cat ? itemSelInfo : null;
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
                    ) : focoItem ? (
                      (() => {
                        // Foco: item selecionado vs restante da categoria
                        // Cada categoria usa um gráfico diferente, com cor própria.
                        const sel = focoItem.peso;
                        const resto = Math.max(0, totalPeso - sel);
                        const pct = totalPeso > 0 ? (sel / totalPeso) * 100 : 0;
                        const media = totalItens > 0 ? totalPeso / totalItens : 0;
                        const varPct = media > 0 ? ((sel - media) / media) * 100 : 0;
                        const cor2 = `color-mix(in oklch, ${cor} 18%, hsl(var(--muted)))`;
                        const trendCor = varPct >= 0 ? "hsl(142 70% 40%)" : "hsl(0 72% 50%)";
                        const kind = CAT_FOCUS[cat];

                        const Overlay = (
                          <>
                            <div className="absolute top-1 left-2 right-2 flex items-center justify-between text-[10px] pointer-events-none">
                              <span className="font-mono truncate max-w-[55%]" style={{ color: cor }}>{focoItem.codigo}</span>
                              <span
                                className="font-semibold tabular-nums px-1.5 py-0.5 rounded"
                                style={{
                                  color: trendCor,
                                  background: `color-mix(in oklch, ${trendCor} 12%, transparent)`,
                                }}
                                title="Variação vs média da categoria"
                              >
                                {varPct >= 0 ? "▲" : "▼"} {fmt(Math.abs(varPct), 1)}%
                              </span>
                            </div>
                            <div className="absolute bottom-1 left-2 right-2 text-center text-[10px] text-muted-foreground tabular-nums pointer-events-none">
                              <span className="font-semibold" style={{ color: cor }}>{fmt(sel, 0)}</span> / {fmt(totalPeso, 0)} {focoItem.ume}
                            </div>
                          </>
                        );

                        if (kind === "radar") {
                          // Teia: cada eixo é um código do top-N da categoria.
                          // Garantimos que o item selecionado SEMPRE apareça como eixo,
                          // e normalizamos os valores em % do máximo para a teia ficar
                          // visível mesmo quando há discrepância enorme entre valores.
                          const base: Array<{ mes: string; valor: number }> =
                            serie.length ? [...serie] : [{ mes: focoItem.codigo, valor: sel }];
                          if (!base.some((s) => s.mes === focoItem.codigo)) {
                            base.push({ mes: focoItem.codigo, valor: sel });
                          }
                          const maxVal = Math.max(1, ...base.map((s) => s.valor));
                          const data = base.map((s) => ({
                            label: s.mes,
                            valor: s.valor,
                            pct: (s.valor / maxVal) * 100,
                            isFoco: s.mes === focoItem.codigo,
                          }));
                          const FocoDot = (props: any) => {
                            const { cx, cy, payload } = props;
                            if (!payload?.isFoco || cx == null || cy == null) return <g />;
                            return (
                              <g>
                                <circle cx={cx} cy={cy} r={9} fill={cor} fillOpacity={0.2} />
                                <circle cx={cx} cy={cy} r={5} fill={cor} stroke="hsl(var(--background))" strokeWidth={1.5} />
                              </g>
                            );
                          };
                          return (
                            <div className="relative h-full w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <RadarChart data={data} margin={{ top: 18, right: 28, bottom: 20, left: 28 }} outerRadius="72%">
                                  <PolarGrid stroke="hsl(var(--border))" />
                                  <PolarAngleAxis
                                    dataKey="label"
                                    tick={(props: any) => {
                                      const { x, y, payload, textAnchor } = props;
                                      const ativo = payload.value === focoItem.codigo;
                                      return (
                                        <text
                                          x={x}
                                          y={y}
                                          textAnchor={textAnchor}
                                          fontSize={9}
                                          fontWeight={ativo ? 700 : 400}
                                          fill={ativo ? cor : "hsl(var(--muted-foreground))"}
                                        >
                                          {payload.value}
                                        </text>
                                      );
                                    }}
                                  />
                                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                                  <Tooltip
                                    content={({ active, payload }: any) => {
                                      if (!active || !payload?.length) return null;
                                      const p = payload[0].payload;
                                      return (
                                        <div className="rounded-md border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
                                          <div className="font-mono" style={{ color: cor }}>{p.label}</div>
                                          <div className="tabular-nums text-foreground font-medium">{fmt(p.valor, 0)} kg</div>
                                        </div>
                                      );
                                    }}
                                  />
                                  <Radar
                                    dataKey="pct"
                                    stroke={cor}
                                    strokeWidth={2}
                                    fill={cor}
                                    fillOpacity={0.3}
                                    dot={FocoDot}
                                    isAnimationActive={false}
                                  />
                                </RadarChart>
                              </ResponsiveContainer>
                              {Overlay}
                            </div>
                          );
                        }

                        if (kind === "donut") {
                          const data = [
                            { label: focoItem.codigo, valor: sel, desc: focoItem.nome },
                            { label: "Demais", valor: resto },
                          ];
                          return (
                            <div className="relative h-full w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Tooltip content={<FancyTooltip accent={cor} unit="kg" />} />
                                  <Pie data={data} dataKey="valor" nameKey="label" innerRadius={42} outerRadius={64} paddingAngle={2} startAngle={90} endAngle={-270} stroke="hsl(var(--background))" strokeWidth={1}>
                                    <Cell fill={cor} />
                                    <Cell fill={cor2} />
                                  </Pie>
                                </PieChart>
                              </ResponsiveContainer>
                              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <div className="text-base font-bold leading-none" style={{ color: cor }}>{fmt(pct, 1)}%</div>
                                <div className="text-[9px] text-muted-foreground mt-0.5">do total</div>
                              </div>
                              {Overlay}
                            </div>
                          );
                        }

                        if (kind === "bullet") {
                          // Bullet: barra horizontal mostrando "sel" dentro do total, com marcador da média
                          const data = [{ name: focoItem.codigo, sel, resto }];
                          return (
                            <div className="relative h-full w-full pt-5 pb-4">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
                                  <XAxis type="number" domain={[0, totalPeso]} hide />
                                  <YAxis type="category" dataKey="name" hide />
                                  <Tooltip cursor={{ fill: "transparent" }} content={<FancyTooltip accent={cor} unit="kg" />} />
                                  <Bar dataKey="sel" stackId="b" fill={cor} radius={[6, 0, 0, 6]} barSize={22} />
                                  <Bar dataKey="resto" stackId="b" fill={cor2} radius={[0, 6, 6, 0]} barSize={22} />
                                  <ReferenceLine x={media} stroke={trendCor} strokeWidth={2} strokeDasharray="2 2" label={{ value: "média", position: "top", fontSize: 9, fill: trendCor }} />
                                </BarChart>
                              </ResponsiveContainer>
                              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
                                <div className="text-[11px] font-bold px-2 py-0.5 rounded-md backdrop-blur-sm" style={{ color: cor, background: "color-mix(in oklch, hsl(var(--background)) 70%, transparent)" }}>
                                  {fmt(pct, 1)}% do total
                                </div>
                              </div>
                              {Overlay}
                            </div>
                          );
                        }

                        if (kind === "slope") {
                          // Slope: linha de "média da categoria" → "item selecionado"
                          const data = [
                            { x: "média", v: media },
                            { x: focoItem.codigo, v: sel },
                          ];
                          const maxY = Math.max(media, sel) * 1.15 || 1;
                          return (
                            <div className="relative h-full w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={data} margin={{ left: 8, right: 16, top: 20, bottom: 18 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                                  <XAxis dataKey="x" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                                  <YAxis domain={[0, maxY]} hide />
                                  <Tooltip cursor={{ stroke: cor, strokeDasharray: "3 3" }} content={<FancyTooltip accent={cor} unit="kg" />} />
                                  <Line
                                    type="linear"
                                    dataKey="v"
                                    stroke={trendCor}
                                    strokeWidth={3}
                                    dot={{ r: 5, fill: cor, stroke: "hsl(var(--background))", strokeWidth: 2 }}
                                    activeDot={{ r: 7 }}
                                  >
                                    <LabelList dataKey="v" position="top" formatter={(v: any) => fmt(Number(v), 0)} style={{ fontSize: 10, fill: cor, fontWeight: 700 }} />
                                  </Line>
                                </LineChart>
                              </ResponsiveContainer>
                              {Overlay}
                            </div>
                          );
                        }

                        if (kind === "gauge-h") {
                          // Barra horizontal de progresso, segmentada por marcas
                          return (
                            <div className="relative h-full w-full flex flex-col items-center justify-center px-3">
                              <div className="w-full flex items-end justify-between mb-1.5 text-[10px] text-muted-foreground">
                                <span>0</span><span>{fmt(totalPeso, 0)} {focoItem.ume}</span>
                              </div>
                              <div className="relative w-full h-5 rounded-full overflow-hidden" style={{ background: cor2 }}>
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${pct}%`,
                                    background: `linear-gradient(90deg, ${cor}, color-mix(in oklch, ${cor} 60%, white))`,
                                  }}
                                />
                                {[25, 50, 75].map((t) => (
                                  <div key={t} className="absolute top-0 bottom-0 w-px" style={{ left: `${t}%`, background: "color-mix(in oklch, hsl(var(--background)) 60%, transparent)" }} />
                                ))}
                                <div className="absolute top-1/2 -translate-y-1/2 text-[10px] font-bold px-1.5 rounded" style={{ left: `min(${pct}%, calc(100% - 40px))`, color: cor }}>
                                  {fmt(pct, 1)}%
                                </div>
                              </div>
                              <div className="mt-2 text-[10px] text-muted-foreground">
                                <span className="font-semibold" style={{ color: cor }}>{fmt(sel, 0)}</span> de {fmt(totalPeso, 0)} {focoItem.ume}
                              </div>
                              {Overlay}
                            </div>
                          );
                        }

                        // radial-single
                        const data = [{ name: focoItem.codigo, value: pct, fill: cor }];
                        return (
                          <div className="relative h-full w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <RadialBarChart data={data} innerRadius="65%" outerRadius="100%" startAngle={90} endAngle={90 - (360 * pct) / 100}>
                                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                                <RadialBar background={{ fill: cor2 }} dataKey="value" cornerRadius={10} />
                              </RadialBarChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                              <div className="text-base font-bold leading-none" style={{ color: cor }}>{fmt(pct, 1)}%</div>
                              <div className="text-[9px] text-muted-foreground mt-0.5">do total</div>
                            </div>
                            {Overlay}
                          </div>
                        );
                      })()
                    ) : CAT_CHART[cat] === "donut2" ? (
                      (() => {
                        // donut 2-cores: topo (maior UME) vs restante
                        const top = barras[0];
                        const restoVal = barras.slice(1).reduce((s, b) => s + b.valor, 0);
                        const data2 = restoVal > 0
                          ? [top, { label: "Outros", valor: restoVal }]
                          : [top];
                        const cor2 = `color-mix(in oklch, ${cor} 35%, white)`;
                        return (
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Tooltip content={<FancyTooltip accent={cor} />} />
                              <Pie
                                data={data2}
                                dataKey="valor"
                                nameKey="label"
                                innerRadius={36}
                                outerRadius={64}
                                paddingAngle={2}
                                onClick={(d: any) => setUnidadeSel((p) => (p === d.label ? null : d.label))}
                                className="cursor-pointer focus:outline-none"
                                label={(e: any) => `${e.label} · ${fmt(Number(e.value), 0)}`}
                                labelLine={false}
                                style={{ fontSize: 10, fill: "hsl(var(--foreground))" }}
                              >
                                {data2.map((b, i) => (
                                  <Cell key={i} fill={i === 0 ? cor : cor2} stroke="hsl(var(--background))" strokeWidth={1} />
                                ))}
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                        );
                      })()
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
                    ) : CAT_CHART[cat] === "stacked" ? (
                      (() => {
                        // Barras empilhadas: uma única barra de composição com cada UME virando uma série
                        const row: any = { name: cat };
                        barras.forEach((b) => { row[b.label] = b.valor; });
                        return (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={[row]} layout="vertical" margin={{ left: 4, right: 12, top: 18, bottom: 4 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                              <XAxis type="number" hide />
                              <YAxis type="category" dataKey="name" hide />
                              <Tooltip cursor={{ fill: `color-mix(in oklch, ${cor} 8%, transparent)` }} content={<FancyTooltip accent={cor} />} />
                              <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                              {barras.map((b, i) => (
                                <Bar
                                  key={b.label}
                                  dataKey={b.label}
                                  stackId="a"
                                  fill={unidadeSel && unidadeSel !== b.label
                                    ? `color-mix(in oklch, ${cor} 25%, transparent)`
                                    : `color-mix(in oklch, ${cor} ${95 - i * 14}%, white)`}
                                  onClick={() => setUnidadeSel((p) => (p === b.label ? null : b.label))}
                                  className="cursor-pointer"
                                />
                              ))}
                            </BarChart>
                          </ResponsiveContainer>
                        );
                      })()
                    ) : CAT_CHART[cat] === "gauge" ? (
                      (() => {
                        // Gauge: semicírculo mostrando totalPeso vs meta (max entre categorias × 1.1)
                        const meta = Math.max(totalPeso * 1.25, 1);
                        const pct = Math.min(100, (totalPeso / meta) * 100);
                        const data = [{ name: cat, value: pct, fill: cor }];
                        return (
                          <div className="relative h-full w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <RadialBarChart
                                data={data}
                                innerRadius="70%"
                                outerRadius="100%"
                                startAngle={180}
                                endAngle={0}
                                cy="75%"
                              >
                                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                                <RadialBar background={{ fill: `color-mix(in oklch, ${cor} 12%, transparent)` }} dataKey="value" cornerRadius={8} />
                              </RadialBarChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-end pb-2 pointer-events-none">
                              <div className="text-base font-bold" style={{ color: cor }}>{fmt(totalPeso, 0)}</div>
                              <div className="text-[10px] text-muted-foreground">{fmt(pct, 0)}% da meta</div>
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      // radar
                      (() => {
                        // Para SOLDA usamos os códigos (serie) como eixos da teia,
                        // assim ao clicar um item na barra lateral a teia destaca
                        // o eixo correspondente. Para OUTROS mantemos UMEs (barras).
                        const useCodigos = cat === "SOLDA" && serie.length > 0;
                        const data = (useCodigos ? serie : barras).map((s: any) =>
                          useCodigos
                            ? { label: s.mes, valor: s.valor }
                            : { label: s.label, valor: s.valor }
                        );
                        return (
                          <ResponsiveContainer width="100%" height="100%">
                            <RadarChart data={data} margin={{ top: 16, right: 22, bottom: 16, left: 22 }}>
                              <PolarGrid stroke="hsl(var(--border))" />
                              <PolarAngleAxis
                                dataKey="label"
                                tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                              />
                              <PolarRadiusAxis tick={false} axisLine={false} />
                              <Tooltip content={<FancyTooltip accent={cor} />} />
                              <Radar
                                dataKey="valor"
                                stroke={cor}
                                strokeWidth={2}
                                fill={cor}
                                fillOpacity={0.3}
                                isAnimationActive={false}
                                onClick={(d: any) =>
                                  !useCodigos &&
                                  setUnidadeSel((p) => (p === d?.payload?.label ? null : d?.payload?.label))
                                }
                                className={useCodigos ? "" : "cursor-pointer"}
                              />
                            </RadarChart>
                          </ResponsiveContainer>
                        );
                      })()
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
                      (() => {
                        const topKind = CAT_TOP[cat];
                        const palette = variantPalette(cor);
                        const dadosBase = serie.map((s: any, i: number) => ({
                          mes: s.mes,
                          valor: s.valor,
                          desc: s.desc,
                          fill: palette[i % palette.length],
                        }));

                        if (topKind === "vbar") {
                          return (
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={dadosBase} margin={{ left: 4, right: 8, top: 8, bottom: 4 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                                <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={9} interval={0} angle={-25} textAnchor="end" height={36} />
                                <YAxis hide />
                                <Tooltip cursor={{ fill: `color-mix(in oklch, ${cor} 8%, transparent)` }} content={<FancyTooltip accent={cor} unit="kg" />} />
                                <Bar
                                  dataKey="valor"
                                  radius={[6, 6, 0, 0]}
                                  onClick={(d: any) => setCodigoSel((p) => (p === d?.mes ? null : d?.mes))}
                                  className="cursor-pointer"
                                >
                                  {dadosBase.map((d: any, i: number) => {
                                    const isFoco = focoItem?.codigo === d.mes;
                                    const dim = focoItem && !isFoco;
                                    return <Cell key={i} fill={d.fill} fillOpacity={dim ? 0.35 : 1} stroke={isFoco ? cor : "transparent"} strokeWidth={isFoco ? 2 : 0} />;
                                  })}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          );
                        }

                        if (topKind === "hbar") {
                          return (
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={dadosBase} layout="vertical" margin={{ left: 6, right: 28, top: 4, bottom: 4 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                                <XAxis type="number" hide />
                                <YAxis type="category" dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={9} width={70} />
                                <Tooltip cursor={{ fill: `color-mix(in oklch, ${cor} 8%, transparent)` }} content={<FancyTooltip accent={cor} unit="kg" />} />
                                <Bar
                                  dataKey="valor"
                                  radius={[0, 6, 6, 0]}
                                  barSize={12}
                                  onClick={(d: any) => setCodigoSel((p) => (p === d?.mes ? null : d?.mes))}
                                  className="cursor-pointer"
                                >
                                  {dadosBase.map((d: any, i: number) => {
                                    const isFoco = focoItem?.codigo === d.mes;
                                    const dim = focoItem && !isFoco;
                                    return <Cell key={i} fill={d.fill} fillOpacity={dim ? 0.35 : 1} />;
                                  })}
                                  <LabelList dataKey="valor" position="right" formatter={(v: any) => fmt(Number(v), 0)} style={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          );
                        }

                        if (topKind === "line") {
                          return (
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={dadosBase} margin={{ left: 4, right: 12, top: 8, bottom: 4 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                                <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={9} interval={0} angle={-25} textAnchor="end" height={36} />
                                <YAxis hide />
                                <Tooltip cursor={{ stroke: cor, strokeDasharray: "3 3" }} content={<FancyTooltip accent={cor} unit="kg" />} />
                                <Line
                                  type="monotone"
                                  dataKey="valor"
                                  stroke={cor}
                                  strokeWidth={2}
                                  dot={(props: any) => {
                                    const d = props.payload;
                                    const isFoco = focoItem?.codigo === d.mes;
                                    return <circle cx={props.cx} cy={props.cy} r={isFoco ? 6 : 4} fill={d.fill} stroke="hsl(var(--background))" strokeWidth={isFoco ? 2 : 1} />;
                                  }}
                                  activeDot={{ r: 6 }}
                                  onClick={(d: any) => setCodigoSel((p) => (p === d?.payload?.mes ? null : d?.payload?.mes))}
                                  className="cursor-pointer"
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          );
                        }

                        if (topKind === "area") {
                          let acc = 0;
                          const dados = dadosBase.map((s: any) => {
                            acc += s.valor;
                            return { ...s, acumulado: acc };
                          });
                          const gradId = `grad-${cat}`;
                          return (
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={dados} margin={{ left: 4, right: 12, top: 8, bottom: 4 }}>
                                <defs>
                                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={cor} stopOpacity={0.55} />
                                    <stop offset="100%" stopColor={cor} stopOpacity={0.05} />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                                <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={9} interval={0} angle={-25} textAnchor="end" height={36} />
                                <YAxis hide />
                                <Tooltip cursor={{ stroke: cor, strokeDasharray: "3 3" }} content={<FancyTooltip accent={cor} unit="kg" />} />
                                <Area
                                  type="monotone"
                                  dataKey="acumulado"
                                  stroke={cor}
                                  strokeWidth={2}
                                  fill={`url(#${gradId})`}
                                  dot={(props: any) => {
                                    const d = props.payload;
                                    return <circle cx={props.cx} cy={props.cy} r={3} fill={d.fill} stroke="hsl(var(--background))" strokeWidth={1} />;
                                  }}
                                  activeDot={{ r: 5, fill: cor, stroke: "hsl(var(--background))", strokeWidth: 2 }}
                                  onClick={(d: any) => setCodigoSel((p) => (p === d?.payload?.mes ? null : d?.payload?.mes))}
                                  className="cursor-pointer"
                                />
                                {focoItem && dados.some((d: any) => d.mes === focoItem.codigo) && (
                                  <ReferenceDot
                                    x={focoItem.codigo}
                                    y={(dados.find((d: any) => d.mes === focoItem.codigo) as any).acumulado}
                                    r={7}
                                    fill={cor}
                                    stroke="hsl(var(--background))"
                                    strokeWidth={2}
                                    label={{ value: `${fmt(focoItem.peso, 0)}`, position: "top", fontSize: 10, fill: cor, fontWeight: 700 }}
                                  />
                                )}
                              </AreaChart>
                            </ResponsiveContainer>
                          );
                        }

                        // scatter
                        return (
                          <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart margin={{ left: 4, right: 12, top: 8, bottom: 28 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis dataKey="mes" type="category" stroke="hsl(var(--muted-foreground))" fontSize={9} interval={0} angle={-25} textAnchor="end" height={36} />
                              <YAxis dataKey="valor" hide />
                              <ZAxis dataKey="valor" range={[60, 360]} />
                              <Tooltip cursor={{ strokeDasharray: "3 3", stroke: cor }} content={<FancyTooltip accent={cor} unit="kg" />} />
                              <Scatter
                                data={dadosBase}
                                onClick={(d: any) => setCodigoSel((p) => (p === d?.mes ? null : d?.mes))}
                                className="cursor-pointer"
                              >
                                {dadosBase.map((d: any, i: number) => {
                                  const isFoco = focoItem?.codigo === d.mes;
                                  const dim = focoItem && !isFoco;
                                  return <Cell key={i} fill={d.fill} fillOpacity={dim ? 0.35 : 0.85} stroke={isFoco ? cor : "hsl(var(--background))"} strokeWidth={isFoco ? 2 : 1} />;
                                })}
                              </Scatter>
                            </ScatterChart>
                          </ResponsiveContainer>
                        );
                      })()
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
