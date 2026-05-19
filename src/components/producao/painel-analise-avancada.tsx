import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { resolveTipo } from "@/lib/mb51-parser";
import type { TipoMP } from "@/lib/base-mp-parser";
import {
  AlertTriangle, Download, Search, ArrowUpDown, Calendar, Filter,
  TrendingDown, Layers, Eye, RotateCcw,
} from "lucide-react";

const CATEGORIAS: TipoMP[] = ["FERRO", "SOLDA", "GÁS", "TINTA", "OUTROS"];
const CAT_COLOR: Record<TipoMP, string> = {
  FERRO: "hsl(0 72% 45%)",
  SOLDA: "hsl(28 90% 55%)",
  "GÁS": "hsl(200 85% 50%)",
  TINTA: "hsl(265 70% 55%)",
  OUTROS: "hsl(150 50% 45%)",
};

const fmt = (n: number, d = 0) =>
  Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

// Tipos de movimento SAP que são estornos/devoluções (qtd positiva)
// 262 = estorno de 261; 102 = estorno de 101; 532 = devolução etc.
const isEstornoOuDevolucao = (tm: string | null | undefined, qtd: number) =>
  qtd > 0 || /^(102|262|292|532|632|712)/.test(String(tm ?? ""));

type Mov = {
  id: string;
  ordem_id: string;
  material: string;
  descricao: string | null;
  quantidade: number;
  unidade: string | null;
  tipo_movimento: string | null;
  classificacao_mb51: string | null;
  data_lancamento: string | null;
  categoria: TipoMP;
  consumo: number; // -quantidade
};

interface Props {
  ordemAtivaId: string | null;
  cascoAtivoId: string | null;
  itensEnriq: any[]; // já filtrado para a ordem ativa
  listaItens: any[]; // B51 itens do casco ativo
  previstoPorCategoria: Record<TipoMP, number>;
  baseMpMap: Map<string, TipoMP>;
  mb51Ordens: any[];
  listasAtuais: any[];
  cascoById: Map<string, any>;
}

export function PainelAnaliseAvancada({
  ordemAtivaId, cascoAtivoId, itensEnriq, listaItens, previstoPorCategoria,
  baseMpMap, mb51Ordens, listasAtuais, cascoById,
}: Props) {
  // ===== Filtro de período (aplicado às 4 sub-abas que dependem de tempo) =====
  const [dtIni, setDtIni] = useState<string>("");
  const [dtFim, setDtFim] = useState<string>("");

  const movsPeriodo = useMemo<Mov[]>(() => {
    return (itensEnriq as Mov[]).filter((m) => {
      if (!m.data_lancamento) return !dtIni && !dtFim;
      const d = String(m.data_lancamento).slice(0, 10);
      if (dtIni && d < dtIni) return false;
      if (dtFim && d > dtFim) return false;
      return true;
    });
  }, [itensEnriq, dtIni, dtFim]);

  const limparPeriodo = () => { setDtIni(""); setDtFim(""); };

  return (
    <div className="space-y-3">
      {/* Barra de período + ações globais */}
      <Card className="shadow-sm border-primary/10">
        <CardContent className="p-3 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Período
            </span>
          </div>
          <Input
            type="date" value={dtIni} onChange={(e) => setDtIni(e.target.value)}
            className="h-8 w-[150px]" aria-label="Data inicial"
          />
          <span className="text-xs text-muted-foreground">até</span>
          <Input
            type="date" value={dtFim} onChange={(e) => setDtFim(e.target.value)}
            className="h-8 w-[150px]" aria-label="Data final"
          />
          {(dtIni || dtFim) && (
            <Button variant="ghost" size="sm" className="h-8" onClick={limparPeriodo}>
              <RotateCcw className="h-3 w-3 mr-1" /> Limpar período
            </Button>
          )}
          <span className="text-xs text-muted-foreground ml-auto">
            {movsPeriodo.length} movimentos no período
          </span>
        </CardContent>
      </Card>

      <Tabs defaultValue="perda" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="perda"><TrendingDown className="h-4 w-4 mr-1" /> Perda/desperdício</TabsTrigger>
          <TabsTrigger value="comparativo"><Layers className="h-4 w-4 mr-1" /> Comparativo cascos</TabsTrigger>
          <TabsTrigger value="historico"><Search className="h-4 w-4 mr-1" /> Histórico MB51</TabsTrigger>
          <TabsTrigger value="drilldown"><Eye className="h-4 w-4 mr-1" /> Drill-down</TabsTrigger>
        </TabsList>

        <TabsContent value="perda">
          <AbaPerda movs={movsPeriodo} listaItens={listaItens} baseMpMap={baseMpMap} />
        </TabsContent>
        <TabsContent value="comparativo">
          <AbaComparativo
            mb51Ordens={mb51Ordens} listasAtuais={listasAtuais}
            baseMpMap={baseMpMap} cascoById={cascoById} dtIni={dtIni} dtFim={dtFim}
          />
        </TabsContent>
        <TabsContent value="historico">
          <AbaHistorico movs={movsPeriodo} cascoAtivoId={cascoAtivoId} />
        </TabsContent>
        <TabsContent value="drilldown">
          <AbaDrillDown movs={movsPeriodo} listaItens={listaItens} baseMpMap={baseMpMap} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* =========================================================================
 * Aba 1 — Perda / desperdício
 * Para cada código previsto na B51, comparar:
 *   real (consumo líquido MB51) vs prev (B51)
 * Lista top por desvio absoluto (sobreconsumo) e por % desvio.
 * Também identifica códigos consumidos sem aparecer na B51 (não previstos).
 * ========================================================================= */
function AbaPerda({
  movs, listaItens, baseMpMap,
}: { movs: Mov[]; listaItens: any[]; baseMpMap: Map<string, TipoMP> }) {
  const [ordenarPor, setOrdenarPor] = useState<"desvio_abs" | "desvio_pct">("desvio_abs");
  const [catFiltro, setCatFiltro] = useState<TipoMP | "TODOS">("TODOS");

  // Previsto agregado por código SAP
  const previstoPorCod = useMemo(() => {
    const m = new Map<string, { codigo: string; descricao: string; previsto: number; unidade: string }>();
    (listaItens as any[]).forEach((it) => {
      const cod = String(it.codigo_sap ?? "");
      if (!cod) return;
      const cur = m.get(cod) ?? {
        codigo: cod,
        descricao: String(it.descricao_sap ?? ""),
        previsto: 0,
        unidade: String(it.unidade ?? "—"),
      };
      cur.previsto += Math.abs(Number(it.quantidade ?? 0));
      m.set(cod, cur);
    });
    return m;
  }, [listaItens]);

  // Real agregado por código SAP (consumo líquido = soma -quantidade)
  // E estornos (qtd positiva ou tipo_mov de estorno) acumulados separadamente.
  const realPorCod = useMemo(() => {
    const m = new Map<string, {
      codigo: string; descricao: string; real: number; unidade: string;
      estornos: number; movimentos: number;
    }>();
    movs.forEach((mv) => {
      const cod = String(mv.material);
      const cur = m.get(cod) ?? {
        codigo: cod, descricao: String(mv.descricao ?? ""), real: 0,
        unidade: String(mv.unidade ?? "—"), estornos: 0, movimentos: 0,
      };
      cur.real += mv.consumo;
      cur.movimentos += 1;
      if (isEstornoOuDevolucao(mv.tipo_movimento, mv.quantidade)) cur.estornos += 1;
      m.set(cod, cur);
    });
    return m;
  }, [movs]);

  // Linhas de comparação
  const linhas = useMemo(() => {
    const codigos = new Set<string>([...previstoPorCod.keys(), ...realPorCod.keys()]);
    const arr = Array.from(codigos).map((cod) => {
      const p = previstoPorCod.get(cod);
      const r = realPorCod.get(cod);
      const previsto = p?.previsto ?? 0;
      const real = r?.real ?? 0;
      const desvio_abs = real - previsto;
      const desvio_pct = previsto > 0 ? (desvio_abs / previsto) * 100 : (real > 0 ? 100 : 0);
      const cat = resolveTipo(cod, null, baseMpMap);
      return {
        codigo: cod,
        descricao: r?.descricao || p?.descricao || "",
        unidade: r?.unidade || p?.unidade || "—",
        categoria: cat,
        previsto, real, desvio_abs, desvio_pct,
        nao_previsto: previsto === 0 && real > 0,
        nao_consumido: previsto > 0 && real <= 0,
        estornos: r?.estornos ?? 0,
        movimentos: r?.movimentos ?? 0,
      };
    });
    return arr;
  }, [previstoPorCod, realPorCod, baseMpMap]);

  const filtradas = useMemo(() => {
    const base = catFiltro === "TODOS" ? linhas : linhas.filter((l) => l.categoria === catFiltro);
    // Apenas itens com sobreconsumo ou não previstos
    const desperdicio = base.filter((l) => l.desvio_abs > 0);
    return desperdicio.sort((a, b) =>
      ordenarPor === "desvio_abs"
        ? b.desvio_abs - a.desvio_abs
        : b.desvio_pct - a.desvio_pct,
    );
  }, [linhas, ordenarPor, catFiltro]);

  const naoConsumidos = useMemo(
    () => linhas.filter((l) => l.nao_consumido).sort((a, b) => b.previsto - a.previsto),
    [linhas],
  );

  const totais = useMemo(() => {
    const sobre = filtradas.reduce((s, l) => s + l.desvio_abs, 0);
    const naoPrev = filtradas.filter((l) => l.nao_previsto).length;
    return { sobre, naoPrev, codigos: filtradas.length };
  }, [filtradas]);

  if (listaItens.length === 0) {
    return (
      <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
        Este casco não possui <b>Lista Técnica (B51)</b> importada — sem plano não é possível calcular desperdício.
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card><CardContent className="p-3">
          <div className="text-[10px] uppercase text-muted-foreground font-semibold">Códigos com sobreconsumo</div>
          <div className="text-xl font-bold text-red-600">{totais.codigos}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-[10px] uppercase text-muted-foreground font-semibold">Não previstos (consumidos sem B51)</div>
          <div className="text-xl font-bold text-amber-600">{totais.naoPrev}</div>
        </CardContent></Card>
        <Card><CardContent className="p-3">
          <div className="text-[10px] uppercase text-muted-foreground font-semibold">Sobreconsumo total (qtd)</div>
          <div className="text-xl font-bold text-red-600">{fmt(totais.sobre, 0)}</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-2 pt-3 px-4 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            Ranking de desperdício (real &gt; previsto)
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={catFiltro} onValueChange={(v) => setCatFiltro(v as any)}>
              <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todas categorias</SelectItem>
                {CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={ordenarPor} onValueChange={(v) => setOrdenarPor(v as any)}>
              <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="desvio_abs">Ordenar: qtd excedente</SelectItem>
                <SelectItem value="desvio_pct">Ordenar: % desvio</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0 max-h-[420px] overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur z-10">
              <tr className="text-left">
                <th className="px-2 py-2 font-semibold">Código</th>
                <th className="px-2 py-2 font-semibold">Descrição</th>
                <th className="px-2 py-2 font-semibold">Cat</th>
                <th className="px-2 py-2 font-semibold text-right">Previsto</th>
                <th className="px-2 py-2 font-semibold text-right">Real</th>
                <th className="px-2 py-2 font-semibold text-right">Excedente</th>
                <th className="px-2 py-2 font-semibold text-right">% desvio</th>
                <th className="px-2 py-2 font-semibold text-right">UM</th>
                <th className="px-2 py-2 font-semibold text-right">Mov.</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">
                  Nenhum desperdício no período — tudo dentro do previsto.
                </td></tr>
              )}
              {filtradas.map((l) => (
                <tr key={l.codigo} className="border-b border-border/50 hover:bg-muted/50">
                  <td className="px-2 py-1.5 font-mono">{l.codigo}</td>
                  <td className="px-2 py-1.5 max-w-[260px] truncate" title={l.descricao}>{l.descricao}</td>
                  <td className="px-2 py-1.5">
                    <span className="inline-block h-2 w-2 rounded-sm mr-1 align-middle" style={{ background: CAT_COLOR[l.categoria] }} />
                    <span className="text-[10px]">{l.categoria}</span>
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{fmt(l.previsto, 0)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{fmt(l.real, 0)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-bold text-red-600">+{fmt(l.desvio_abs, 0)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-red-600">
                    {l.previsto > 0 ? `+${fmt(l.desvio_pct, 1)}%` : "novo"}
                  </td>
                  <td className="px-2 py-1.5 text-right text-[10px] text-muted-foreground uppercase">{l.unidade}</td>
                  <td className="px-2 py-1.5 text-right text-[10px] text-muted-foreground">
                    {l.movimentos}{l.estornos > 0 && <span className="text-amber-600"> ({l.estornos} est.)</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {naoConsumidos.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-4 w-4" />
              Códigos previstos mas ainda não consumidos ({naoConsumidos.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 max-h-[260px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur z-10">
                <tr className="text-left">
                  <th className="px-2 py-2 font-semibold">Código</th>
                  <th className="px-2 py-2 font-semibold">Descrição</th>
                  <th className="px-2 py-2 font-semibold">Cat</th>
                  <th className="px-2 py-2 font-semibold text-right">Previsto</th>
                  <th className="px-2 py-2 font-semibold text-right">UM</th>
                </tr>
              </thead>
              <tbody>
                {naoConsumidos.map((l) => (
                  <tr key={l.codigo} className="border-b border-border/50 hover:bg-muted/50">
                    <td className="px-2 py-1.5 font-mono">{l.codigo}</td>
                    <td className="px-2 py-1.5 max-w-[280px] truncate" title={l.descricao}>{l.descricao}</td>
                    <td className="px-2 py-1.5 text-[10px]">{l.categoria}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{fmt(l.previsto, 0)}</td>
                    <td className="px-2 py-1.5 text-right text-[10px] uppercase text-muted-foreground">{l.unidade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* =========================================================================
 * Aba 2 — Comparativo entre cascos
 * Para todos os cascos que têm B51 + MB51:
 *   monta heatmap (casco × categoria) com % realizado vs orçado.
 * Filtro de período é aplicado nos movimentos.
 * ========================================================================= */
function AbaComparativo({
  mb51Ordens, listasAtuais, baseMpMap, cascoById, dtIni, dtFim,
}: {
  mb51Ordens: any[]; listasAtuais: any[]; baseMpMap: Map<string, TipoMP>;
  cascoById: Map<string, any>; dtIni: string; dtFim: string;
}) {
  // Fetch de TODOS os itens das listas técnicas mais recentes
  const listaIds = useMemo(
    () => (listasAtuais as any[]).map((l) => l.id),
    [listasAtuais],
  );

  const { data: todosItensB51 = [] } = useQuery({
    queryKey: ["comp-b51-itens", listaIds.join(",")],
    enabled: listaIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("producao_lista_tecnica_itens")
        .select("lista_id, codigo_sap, quantidade")
        .in("lista_id", listaIds)
        .range(0, 19999);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch de TODOS os movimentos MB51 (até 10k)
  const { data: todosMovs = [] } = useQuery({
    queryKey: ["comp-mb51-movs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("producao_mb51_movimentos")
        .select("ordem_id, material, quantidade, classificacao_mb51, data_lancamento")
        .range(0, 19999);
      if (error) throw error;
      return data ?? [];
    },
  });

  const linhas = useMemo(() => {
    // map casco_id → lista_id (lista mais recente)
    const listaByCasco = new Map<string, string>();
    (listasAtuais as any[]).forEach((l) => listaByCasco.set(l.casco_id, l.id));
    // map lista_id → casco_id
    const cascoByLista = new Map<string, string>();
    (listasAtuais as any[]).forEach((l) => cascoByLista.set(l.id, l.casco_id));
    // map ordem_id → casco_id
    const cascoByOrdem = new Map<string, string>();
    (mb51Ordens as any[]).forEach((o) => { if (o.casco_id) cascoByOrdem.set(o.id, o.casco_id); });

    // Previsto por casco × categoria
    const prev: Map<string, Record<TipoMP, number>> = new Map();
    (todosItensB51 as any[]).forEach((it) => {
      const casco = cascoByLista.get(it.lista_id);
      if (!casco) return;
      const cat = resolveTipo(String(it.codigo_sap ?? ""), null, baseMpMap);
      const cur = prev.get(casco) ?? { FERRO: 0, SOLDA: 0, "GÁS": 0, TINTA: 0, OUTROS: 0 };
      cur[cat] += Math.abs(Number(it.quantidade ?? 0));
      prev.set(casco, cur);
    });

    // Real por casco × categoria (consumo líquido = -quantidade), com filtro período
    const real: Map<string, Record<TipoMP, number>> = new Map();
    (todosMovs as any[]).forEach((m) => {
      const casco = cascoByOrdem.get(m.ordem_id);
      if (!casco) return;
      if (m.data_lancamento) {
        const d = String(m.data_lancamento).slice(0, 10);
        if (dtIni && d < dtIni) return;
        if (dtFim && d > dtFim) return;
      }
      const cat = resolveTipo(String(m.material), m.classificacao_mb51, baseMpMap);
      const cur = real.get(casco) ?? { FERRO: 0, SOLDA: 0, "GÁS": 0, TINTA: 0, OUTROS: 0 };
      cur[cat] += -Number(m.quantidade ?? 0);
      real.set(casco, cur);
    });

    // União de cascos (só os que têm B51)
    const cascosComB51 = Array.from(prev.keys());
    return cascosComB51.map((cascoId) => {
      const c = cascoById.get(cascoId);
      const p = prev.get(cascoId)!;
      const r = real.get(cascoId) ?? { FERRO: 0, SOLDA: 0, "GÁS": 0, TINTA: 0, OUTROS: 0 };
      const cats = CATEGORIAS.map((cat) => {
        const pv = p[cat], rv = r[cat];
        const pct = pv > 0 ? (rv / pv) * 100 : (rv > 0 ? -1 : 0); // -1 = consumiu sem plano
        return { cat, prev: pv, real: rv, pct };
      });
      const totalPrev = CATEGORIAS.reduce((s, c2) => s + p[c2], 0);
      const totalReal = CATEGORIAS.reduce((s, c2) => s + r[c2], 0);
      const totalPct = totalPrev > 0 ? (totalReal / totalPrev) * 100 : 0;
      return {
        casco: c ?? { numero: "?", nome: "" }, cascoId,
        cats, totalPrev, totalReal, totalPct,
      };
    }).sort((a, b) => b.totalPct - a.totalPct);
  }, [todosItensB51, todosMovs, listasAtuais, mb51Ordens, baseMpMap, cascoById, dtIni, dtFim]);

  const heatColor = (pct: number) => {
    if (pct < 0) return "hsl(var(--muted))";
    if (pct === 0) return "hsl(var(--muted))";
    if (pct <= 90) return "color-mix(in oklch, hsl(142 70% 40%) 30%, hsl(var(--background)))";
    if (pct <= 100) return "color-mix(in oklch, hsl(142 70% 40%) 60%, hsl(var(--background)))";
    if (pct <= 110) return "color-mix(in oklch, hsl(38 92% 50%) 55%, hsl(var(--background)))";
    return "color-mix(in oklch, hsl(0 72% 50%) 65%, hsl(var(--background)))";
  };
  const heatText = (pct: number) => (pct > 100 ? "text-foreground font-bold" : "text-foreground");

  if (linhas.length === 0) {
    return (
      <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
        Nenhum casco com B51 importada ainda. Importe listas técnicas para comparar.
      </CardContent></Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" /> Comparativo entre cascos — % realizado vs orçado
        </CardTitle>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Verde ≤ 100% (dentro do plano) · Amarelo 100–110% · Vermelho &gt; 110%. Cinza = sem plano ou sem consumo.
        </p>
      </CardHeader>
      <CardContent className="p-0 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur z-10">
            <tr className="text-left">
              <th className="px-3 py-2 font-semibold">Casco</th>
              {CATEGORIAS.map((c) => (
                <th key={c} className="px-2 py-2 font-semibold text-center" style={{ color: CAT_COLOR[c] }}>{c}</th>
              ))}
              <th className="px-3 py-2 font-semibold text-center">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.cascoId} className="border-b border-border/50">
                <td className="px-3 py-2">
                  <div className="font-semibold">{l.casco.nome ?? "—"}</div>
                  <div className="text-[10px] text-muted-foreground">CASCO {l.casco.numero}</div>
                </td>
                {l.cats.map((c) => (
                  <td key={c.cat} className="px-1 py-1 text-center">
                    <div
                      className={`rounded-md px-2 py-1.5 ${heatText(c.pct)}`}
                      style={{ background: heatColor(c.pct) }}
                      title={`Previsto: ${fmt(c.prev)} · Real: ${fmt(c.real)}`}
                    >
                      <div className="text-[11px] tabular-nums font-semibold">
                        {c.pct < 0 ? "s/ plano" : c.prev === 0 ? "—" : `${fmt(c.pct, 0)}%`}
                      </div>
                      <div className="text-[9px] text-muted-foreground tabular-nums">
                        {fmt(c.real)} / {fmt(c.prev)}
                      </div>
                    </div>
                  </td>
                ))}
                <td className="px-2 py-1 text-center">
                  <div
                    className={`rounded-md px-2 py-1.5 ${heatText(l.totalPct)}`}
                    style={{ background: heatColor(l.totalPct) }}
                  >
                    <div className="text-[11px] tabular-nums font-bold">
                      {l.totalPrev === 0 ? "—" : `${fmt(l.totalPct, 0)}%`}
                    </div>
                    <div className="text-[9px] text-muted-foreground tabular-nums">
                      {fmt(l.totalReal)} / {fmt(l.totalPrev)}
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

/* =========================================================================
 * Aba 3 — Histórico / auditoria MB51
 * Tabela completa de movimentos do casco selecionado com:
 *   busca, ordenação, filtro por tipo de movimento, marcação de estornos,
 *   exportação CSV.
 * ========================================================================= */
function AbaHistorico({
  movs, cascoAtivoId,
}: { movs: Mov[]; cascoAtivoId: string | null }) {
  const [busca, setBusca] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<"todos" | "consumo" | "estorno">("todos");
  const [sortKey, setSortKey] = useState<keyof Mov>("data_lancamento");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const tiposUnicos = useMemo(
    () => Array.from(new Set(movs.map((m) => m.tipo_movimento).filter(Boolean))).sort(),
    [movs],
  );

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    let arr = movs.filter((m) => {
      const isEst = isEstornoOuDevolucao(m.tipo_movimento, m.quantidade);
      if (tipoFiltro === "consumo" && isEst) return false;
      if (tipoFiltro === "estorno" && !isEst) return false;
      if (q && ![m.material, m.descricao, m.tipo_movimento, m.classificacao_mb51]
        .some((v) => String(v ?? "").toLowerCase().includes(q))) return false;
      return true;
    });
    arr = [...arr].sort((a, b) => {
      const av = a[sortKey] as any, bv = b[sortKey] as any;
      const cmp = av == null ? -1 : bv == null ? 1
        : typeof av === "number" ? av - bv
        : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [movs, busca, tipoFiltro, sortKey, sortDir]);

  const toggleSort = (k: keyof Mov) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("desc"); }
  };

  const exportarCsv = () => {
    const header = ["data", "tipo_mov", "material", "descricao", "categoria",
      "quantidade", "consumo_liquido", "unidade", "classificacao_mb51"];
    const linhas = visiveis.map((m) => [
      m.data_lancamento ?? "", m.tipo_movimento ?? "", m.material,
      m.descricao ?? "", m.categoria, m.quantidade, m.consumo, m.unidade ?? "",
      m.classificacao_mb51 ?? "",
    ]);
    const csv = [header, ...linhas].map((r) =>
      r.map((v) => {
        const s = String(v ?? "");
        return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(";"),
    ).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mb51_${cascoAtivoId ?? "casco"}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const Th = ({ k, children, className = "" }: { k: keyof Mov; children: any; className?: string }) => (
    <th
      className={`px-2 py-2 font-semibold cursor-pointer select-none hover:text-primary ${className}`}
      onClick={() => toggleSort(k)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortKey === k && <ArrowUpDown className="h-3 w-3" />}
      </span>
    </th>
  );

  return (
    <Card>
      <CardHeader className="pb-2 pt-3 px-4 flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <Search className="h-4 w-4 text-primary" />
          Histórico de movimentos — {visiveis.length} de {movs.length}
        </CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2 top-2.5 text-muted-foreground" />
            <Input
              placeholder="código, descrição, tipo…"
              value={busca} onChange={(e) => setBusca(e.target.value)}
              className="h-8 pl-7 w-[220px] text-xs"
            />
          </div>
          <Select value={tipoFiltro} onValueChange={(v) => setTipoFiltro(v as any)}>
            <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos movimentos</SelectItem>
              <SelectItem value="consumo">Apenas consumo</SelectItem>
              <SelectItem value="estorno">Apenas estorno/dev.</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-8" onClick={exportarCsv}>
            <Download className="h-3.5 w-3.5 mr-1" /> CSV
          </Button>
        </div>
      </CardHeader>
      {tiposUnicos.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1">
          {tiposUnicos.map((t) => (
            <Badge key={t} variant="secondary" className="text-[10px] font-mono">{t}</Badge>
          ))}
        </div>
      )}
      <CardContent className="p-0 max-h-[520px] overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur z-10">
            <tr className="text-left">
              <Th k="data_lancamento">Data</Th>
              <Th k="tipo_movimento">TM</Th>
              <Th k="material">Material</Th>
              <Th k="descricao">Descrição</Th>
              <Th k="categoria">Cat</Th>
              <Th k="quantidade" className="text-right">Qtd (SAP)</Th>
              <Th k="consumo" className="text-right">Consumo líq.</Th>
              <Th k="unidade">UM</Th>
              <Th k="classificacao_mb51">Classif.</Th>
            </tr>
          </thead>
          <tbody>
            {visiveis.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">
                Sem movimentos para o filtro atual.
              </td></tr>
            )}
            {visiveis.map((m) => {
              const est = isEstornoOuDevolucao(m.tipo_movimento, m.quantidade);
              return (
                <tr key={m.id} className={`border-b border-border/50 hover:bg-muted/50 ${est ? "bg-amber-50/40" : ""}`}>
                  <td className="px-2 py-1.5 tabular-nums">{m.data_lancamento ?? "—"}</td>
                  <td className="px-2 py-1.5 font-mono text-[10px]">
                    {m.tipo_movimento ?? "—"}
                    {est && <span title="Estorno/devolução" className="ml-1 text-amber-600">⟲</span>}
                  </td>
                  <td className="px-2 py-1.5 font-mono">{m.material}</td>
                  <td className="px-2 py-1.5 max-w-[260px] truncate" title={m.descricao ?? ""}>{m.descricao}</td>
                  <td className="px-2 py-1.5">
                    <span className="inline-block h-2 w-2 rounded-sm mr-1 align-middle" style={{ background: CAT_COLOR[m.categoria] }} />
                    <span className="text-[10px]">{m.categoria}</span>
                  </td>
                  <td className={`px-2 py-1.5 text-right tabular-nums ${m.quantidade > 0 ? "text-amber-700" : ""}`}>{fmt(m.quantidade, 2)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{fmt(m.consumo, 2)}</td>
                  <td className="px-2 py-1.5 text-[10px] uppercase text-muted-foreground">{m.unidade ?? "—"}</td>
                  <td className="px-2 py-1.5 text-[10px] text-muted-foreground truncate max-w-[120px]" title={m.classificacao_mb51 ?? ""}>{m.classificacao_mb51 ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

/* =========================================================================
 * Aba 4 — Drill-down por código
 * Tabela compacta por código (real / prev) e Sheet com todos os movimentos.
 * ========================================================================= */
function AbaDrillDown({
  movs, listaItens, baseMpMap,
}: { movs: Mov[]; listaItens: any[]; baseMpMap: Map<string, TipoMP> }) {
  const [codigoSel, setCodigoSel] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  const previstoPorCod = useMemo(() => {
    const m = new Map<string, number>();
    (listaItens as any[]).forEach((it) => {
      const cod = String(it.codigo_sap ?? "");
      if (!cod) return;
      m.set(cod, (m.get(cod) ?? 0) + Math.abs(Number(it.quantidade ?? 0)));
    });
    return m;
  }, [listaItens]);

  const linhas = useMemo(() => {
    const m = new Map<string, {
      codigo: string; descricao: string; unidade: string; categoria: TipoMP;
      real: number; movimentos: number; estornos: number; ultima: string | null;
    }>();
    movs.forEach((mv) => {
      const cod = String(mv.material);
      const cur = m.get(cod) ?? {
        codigo: cod, descricao: String(mv.descricao ?? ""), unidade: String(mv.unidade ?? "—"),
        categoria: mv.categoria, real: 0, movimentos: 0, estornos: 0, ultima: null,
      };
      cur.real += mv.consumo;
      cur.movimentos += 1;
      if (isEstornoOuDevolucao(mv.tipo_movimento, mv.quantidade)) cur.estornos += 1;
      const d = mv.data_lancamento ? String(mv.data_lancamento).slice(0, 10) : null;
      if (d && (!cur.ultima || d > cur.ultima)) cur.ultima = d;
      m.set(cod, cur);
    });
    const arr = Array.from(m.values()).map((l) => ({
      ...l,
      previsto: previstoPorCod.get(l.codigo) ?? 0,
    }));
    const q = busca.trim().toLowerCase();
    const filt = q
      ? arr.filter((l) => [l.codigo, l.descricao].some((v) => v.toLowerCase().includes(q)))
      : arr;
    return filt.sort((a, b) => Math.abs(b.real) - Math.abs(a.real));
  }, [movs, previstoPorCod, busca]);

  const detalhe = useMemo(() => {
    if (!codigoSel) return null;
    const list = movs.filter((m) => String(m.material) === codigoSel)
      .sort((a, b) => String(b.data_lancamento ?? "").localeCompare(String(a.data_lancamento ?? "")));
    const meta = linhas.find((l) => l.codigo === codigoSel);
    return { list, meta };
  }, [codigoSel, movs, linhas]);

  return (
    <>
      <Card>
        <CardHeader className="pb-2 pt-3 px-4 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" /> Códigos consumidos — clique para detalhar
          </CardTitle>
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2 top-2.5 text-muted-foreground" />
            <Input
              placeholder="código ou descrição…"
              value={busca} onChange={(e) => setBusca(e.target.value)}
              className="h-8 pl-7 w-[220px] text-xs"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 max-h-[520px] overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur z-10">
              <tr className="text-left">
                <th className="px-2 py-2 font-semibold">Código</th>
                <th className="px-2 py-2 font-semibold">Descrição</th>
                <th className="px-2 py-2 font-semibold">Cat</th>
                <th className="px-2 py-2 font-semibold text-right">Real</th>
                <th className="px-2 py-2 font-semibold text-right">Prev.</th>
                <th className="px-2 py-2 font-semibold text-right">% prev</th>
                <th className="px-2 py-2 font-semibold text-right">Mov.</th>
                <th className="px-2 py-2 font-semibold text-right">Última</th>
              </tr>
            </thead>
            <tbody>
              {linhas.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">Sem movimentos no período.</td></tr>
              )}
              {linhas.map((l) => {
                const pct = l.previsto > 0 ? (l.real / l.previsto) * 100 : null;
                const corPct =
                  pct == null ? "text-muted-foreground"
                  : pct > 110 ? "text-red-600 font-bold"
                  : pct > 100 ? "text-amber-600 font-semibold"
                  : "text-emerald-700";
                return (
                  <tr
                    key={l.codigo}
                    onClick={() => setCodigoSel(l.codigo)}
                    className="border-b border-border/50 hover:bg-primary/5 cursor-pointer"
                  >
                    <td className="px-2 py-1.5 font-mono">{l.codigo}</td>
                    <td className="px-2 py-1.5 max-w-[260px] truncate" title={l.descricao}>{l.descricao}</td>
                    <td className="px-2 py-1.5">
                      <span className="inline-block h-2 w-2 rounded-sm mr-1 align-middle" style={{ background: CAT_COLOR[l.categoria] }} />
                      <span className="text-[10px]">{l.categoria}</span>
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-semibold">{fmt(l.real, 2)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">{l.previsto > 0 ? fmt(l.previsto, 2) : "—"}</td>
                    <td className={`px-2 py-1.5 text-right tabular-nums ${corPct}`}>
                      {pct == null ? "novo" : `${fmt(pct, 0)}%`}
                    </td>
                    <td className="px-2 py-1.5 text-right text-[10px] text-muted-foreground">
                      {l.movimentos}{l.estornos > 0 && <span className="text-amber-600"> ⟲{l.estornos}</span>}
                    </td>
                    <td className="px-2 py-1.5 text-right text-[10px] tabular-nums text-muted-foreground">{l.ultima ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Sheet open={!!codigoSel} onOpenChange={(o) => !o && setCodigoSel(null)}>
        <SheetContent className="w-full sm:max-w-[640px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-mono">{codigoSel}</SheetTitle>
            <SheetDescription>{detalhe?.meta?.descricao}</SheetDescription>
          </SheetHeader>
          {detalhe && (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <KpiMini label="Real" value={fmt(detalhe.meta?.real ?? 0, 2)} accent="text-primary" />
                <KpiMini label="Previsto" value={detalhe.meta?.previsto ? fmt(detalhe.meta.previsto, 2) : "—"} accent="text-muted-foreground" />
                <KpiMini label="Movimentos" value={`${detalhe.list.length}`} accent="text-foreground" />
              </div>
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60">
                    <tr className="text-left">
                      <th className="px-2 py-1.5 font-semibold">Data</th>
                      <th className="px-2 py-1.5 font-semibold">TM</th>
                      <th className="px-2 py-1.5 font-semibold text-right">Qtd</th>
                      <th className="px-2 py-1.5 font-semibold">UM</th>
                      <th className="px-2 py-1.5 font-semibold">Classif.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalhe.list.map((m) => {
                      const est = isEstornoOuDevolucao(m.tipo_movimento, m.quantidade);
                      return (
                        <tr key={m.id} className={`border-t ${est ? "bg-amber-50/40" : ""}`}>
                          <td className="px-2 py-1.5 tabular-nums">{m.data_lancamento ?? "—"}</td>
                          <td className="px-2 py-1.5 font-mono text-[10px]">
                            {m.tipo_movimento ?? "—"}{est && <span className="ml-1 text-amber-600">⟲</span>}
                          </td>
                          <td className={`px-2 py-1.5 text-right tabular-nums ${m.quantidade > 0 ? "text-amber-700" : ""}`}>{fmt(m.quantidade, 2)}</td>
                          <td className="px-2 py-1.5 text-[10px] uppercase text-muted-foreground">{m.unidade ?? "—"}</td>
                          <td className="px-2 py-1.5 text-[10px] text-muted-foreground truncate max-w-[150px]" title={m.classificacao_mb51 ?? ""}>{m.classificacao_mb51 ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function KpiMini({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-md border bg-card p-2">
      <div className="text-[9px] uppercase text-muted-foreground font-semibold">{label}</div>
      <div className={`text-sm font-bold tabular-nums ${accent}`}>{value}</div>
    </div>
  );
}