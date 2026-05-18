import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  AreaChart, Area, LabelList,
} from "recharts";
import { LayoutDashboard, RefreshCw } from "lucide-react";
import {
  CATEGORIAS, CATEGORIA_CLASSE, classificarMaterial, type CategoriaMaterial,
} from "@/lib/lista-tecnica-categorias";

export const Route = createFileRoute("/app/producao/painel-lista-tecnica")({
  component: PainelListaTecnicaPage,
});

const fmt = (n: number, d = 2) =>
  Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

const MES_LABEL = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const mesKey = (d: Date) => `${MES_LABEL[d.getMonth()]} ${d.getFullYear()}`;

function PainelListaTecnicaPage() {
  const qc = useQueryClient();
  const [cascoSel, setCascoSel] = useState<string | null>(null);
  const [codigoSel, setCodigoSel] = useState<string | null>(null);

  const { data: cascos = [] } = useQuery({
    queryKey: ["cascos-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cascos").select("id, numero, nome").order("numero");
      if (error) throw error;
      return data ?? [];
    },
  });

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

  const listaIds = useMemo(() => (listasAtuais as any[]).map((l) => l.id), [listasAtuais]);

  const { data: itens = [], isFetching } = useQuery({
    queryKey: ["lista-tecnica-itens-painel", listaIds.sort().join(",")],
    enabled: listaIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("producao_lista_tecnica_itens")
        .select("*")
        .in("lista_id", listaIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("painel-lista-tecnica")
      .on("postgres_changes", { event: "*", schema: "public", table: "producao_lista_tecnica" }, () => {
        qc.invalidateQueries({ queryKey: ["listas-tecnicas-latest"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "producao_lista_tecnica_itens" }, () => {
        qc.invalidateQueries({ queryKey: ["lista-tecnica-itens-painel"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const cascoById = useMemo(() => {
    const m = new Map<string, any>();
    (cascos as any[]).forEach((c) => m.set(c.id, c));
    return m;
  }, [cascos]);

  const listaById = useMemo(() => {
    const m = new Map<string, any>();
    (listasAtuais as any[]).forEach((l) => m.set(l.id, l));
    return m;
  }, [listasAtuais]);

  const itensEnriq = useMemo(() => {
    return (itens as any[]).map((it) => {
      const l = listaById.get(it.lista_id);
      return {
        ...it,
        casco_id: l?.casco_id ?? "",
        lista_created_at: l?.created_at ?? null,
        categoria: classificarMaterial(it.descricao_sap, it.codigo_sap) as CategoriaMaterial,
      };
    });
  }, [itens, listaById]);

  const cascosComDados = useMemo(
    () =>
      (listasAtuais as any[])
        .map((l) => cascoById.get(l.casco_id))
        .filter(Boolean)
        .sort((a: any, b: any) => String(a.numero).localeCompare(String(b.numero))),
    [listasAtuais, cascoById],
  );

  const cascoAtivoId = cascoSel ?? cascosComDados[0]?.id ?? null;
  const cascoAtivo = cascoAtivoId ? cascoById.get(cascoAtivoId) : null;

  const itensFiltrados = useMemo(
    () => itensEnriq.filter((it) => it.casco_id === cascoAtivoId),
    [itensEnriq, cascoAtivoId],
  );

  // Top códigos FERT/HALB (SAP geralmente começa com 7)
  const topCodigos = useMemo(() => {
    const acc = new Map<string, number>();
    itensEnriq.forEach((it) => {
      const cod = String(it.codigo_sap ?? "");
      if (!/^7\d{5}/.test(cod)) return;
      const peso = Math.abs(Number(it.peso_real ?? it.peso_total_estimado ?? 0));
      acc.set(cod, (acc.get(cod) ?? 0) + peso);
    });
    return Array.from(acc.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([cod]) => cod);
  }, [itensEnriq]);

  const itensVisiveis = useMemo(
    () => codigoSel ? itensFiltrados.filter((it) => String(it.codigo_sap) === codigoSel) : itensFiltrados,
    [itensFiltrados, codigoSel],
  );

  const dadosPorCategoria = useMemo(() => {
    const result: Record<CategoriaMaterial, { barras: any[]; serie: any[]; totalPeso: number }> = {
      FERRO: { barras: [], serie: [], totalPeso: 0 },
      SOLDA: { barras: [], serie: [], totalPeso: 0 },
      "GÁS": { barras: [], serie: [], totalPeso: 0 },
      TINTA: { barras: [], serie: [], totalPeso: 0 },
      OUTROS: { barras: [], serie: [], totalPeso: 0 },
    };
    CATEGORIAS.forEach((cat) => {
      const itensCat = itensVisiveis.filter((it) => it.categoria === cat);
      const barMap = new Map<string, { label: string; valor: number }>();
      itensCat.forEach((it) => {
        const label = cat === "FERRO" || cat === "OUTROS"
          ? String(it.unidade ?? "—")
          : String(it.descricao_sap ?? it.codigo_sap ?? "—").slice(0, 14);
        const valor = Number(it.peso_real ?? it.peso_total_estimado ?? it.quantidade ?? 0);
        const cur = barMap.get(label) ?? { label, valor: 0 };
        cur.valor += valor;
        barMap.set(label, cur);
      });
      const barras = Array.from(barMap.values())
        .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor))
        .slice(0, 8);

      const serieMap = new Map<string, number>();
      itensCat.forEach((it) => {
        if (!it.lista_created_at) return;
        const d = new Date(it.lista_created_at);
        const k = mesKey(d);
        const valor = Number(it.peso_real ?? it.peso_total_estimado ?? 0);
        serieMap.set(k, (serieMap.get(k) ?? 0) + valor);
      });
      const serie = Array.from(serieMap.entries()).map(([mes, valor]) => ({ mes, valor }));
      const totalPeso = itensCat.reduce(
        (s, it) => s + Number(it.peso_real ?? it.peso_total_estimado ?? 0), 0,
      );
      result[cat] = { barras, serie, totalPeso };
    });
    return result;
  }, [itensVisiveis]);

  return (
    <div className="space-y-3 p-4 bg-muted/30 min-h-screen">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6 text-primary" />
            Dashboard Dinâmico
          </h1>
          <p className="text-xs text-muted-foreground">
            Clique em um código FERT/HALB para filtrar todo o painel. Atualiza em tempo real.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => {
          qc.invalidateQueries({ queryKey: ["listas-tecnicas-latest"] });
          qc.invalidateQueries({ queryKey: ["lista-tecnica-itens-painel"] });
        }}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      {/* Barra superior estilo Power BI: códigos + casco ativo */}
      <Card className="shadow-sm">
        <CardContent className="p-3 flex items-center gap-3 flex-wrap">
          <div className="flex flex-wrap gap-2 flex-1">
            {topCodigos.length === 0 && (
              <span className="text-xs text-muted-foreground">Sem códigos FERT/HALB detectados.</span>
            )}
            {topCodigos.map((cod) => {
              const ativo = codigoSel === cod;
              return (
                <button
                  key={cod}
                  onClick={() => setCodigoSel((prev) => (prev === cod ? null : cod))}
                  className={`px-4 py-2 rounded-md text-sm font-mono font-medium border transition shadow-sm ${
                    ativo
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-foreground border-border hover:bg-accent/40"
                  }`}
                >
                  {cod}
                </button>
              );
            })}
            {codigoSel && (
              <Button variant="ghost" size="sm" onClick={() => setCodigoSel(null)}>Limpar filtro</Button>
            )}
          </div>
          <select
            value={cascoAtivoId ?? ""}
            onChange={(e) => setCascoSel(e.target.value || null)}
            className="px-4 py-2 rounded-md text-sm font-semibold border border-border bg-card shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {cascosComDados.length === 0 && <option value="">Nenhum casco</option>}
            {cascosComDados.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.nome ? `${String(c.nome).toUpperCase()} - ` : ""}CASCO {c.numero}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {/* Linhas: 1 por categoria, barras + série temporal */}
      <div className="space-y-3">
        {(["FERRO", "SOLDA", "GÁS", "OUTROS"] as CategoriaMaterial[]).map((cat) => {
          const { barras, serie, totalPeso } = dadosPorCategoria[cat];
          const vazio = barras.length === 0;
          return (
            <div key={cat} className="grid gap-3 grid-cols-1 lg:grid-cols-2">
              <Card className="shadow-sm">
                <CardHeader className="pb-1 pt-3 px-4 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-bold tracking-wide flex items-center gap-2">
                    <span className={`inline-block h-3 w-3 rounded-sm ${CATEGORIA_CLASSE[cat]}`} />
                    {cat}
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">{fmt(totalPeso, 0)} kg</span>
                </CardHeader>
                <CardContent className="h-44 p-2">
                  {vazio ? (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Sem dados</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barras} margin={{ left: 4, right: 8, top: 18, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={10} interval={0} />
                        <YAxis hide />
                        <Tooltip
                          contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                          formatter={(v: any) => fmt(Number(v), 2)}
                        />
                        <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]}>
                          <LabelList dataKey="valor" position="top" fontSize={10} formatter={(v: any) => fmt(Number(v), 0)} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="pb-1 pt-3 px-4">
                  <CardTitle className="text-xs text-muted-foreground font-medium">
                    Evolução de importações — {cat}
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-44 p-2">
                  {serie.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Sem série temporal</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={serie} margin={{ left: 4, right: 8, top: 8, bottom: 4 }}>
                        <defs>
                          <linearGradient id={`grad-${cat}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                        <YAxis hide />
                        <Tooltip
                          contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                          formatter={(v: any) => `${fmt(Number(v), 0)} kg`}
                        />
                        <Area type="monotone" dataKey="valor" stroke="hsl(var(--primary))" strokeWidth={2} fill={`url(#grad-${cat})`} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>

      {cascoAtivo && (
        <p className="text-xs text-muted-foreground text-center pt-2">
          Exibindo dados de {cascoAtivo.nome ?? ""} — Casco {cascoAtivo.numero}
          {codigoSel ? ` • filtrado por ${codigoSel}` : ""}
        </p>
      )}
    </div>
  );
}
