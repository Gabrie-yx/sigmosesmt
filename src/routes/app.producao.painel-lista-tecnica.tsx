import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import { Search, LayoutDashboard, RefreshCw } from "lucide-react";
import {
  CATEGORIAS, CATEGORIA_CLASSE, classificarMaterial, type CategoriaMaterial,
} from "@/lib/lista-tecnica-categorias";

export const Route = createFileRoute("/app/producao/painel-lista-tecnica")({
  component: PainelListaTecnicaPage,
});

const fmt = (n: number, d = 2) =>
  Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtInt = (n: number) => Number(n || 0).toLocaleString("pt-BR");

function PainelListaTecnicaPage() {
  const qc = useQueryClient();
  const [cascosSel, setCascosSel] = useState<Set<string>>(new Set());
  const [catSel, setCatSel] = useState<CategoriaMaterial | "TODAS">("TODAS");
  const [busca, setBusca] = useState("");

  const { data: cascos = [] } = useQuery({
    queryKey: ["cascos-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cascos").select("id, numero, nome").order("numero");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Última versão por casco
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

  // Inscrição realtime: invalida queries quando a tabela mudar
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

  // Mapas auxiliares
  const cascoById = useMemo(() => {
    const m = new Map<string, any>();
    (cascos as any[]).forEach((c) => m.set(c.id, c));
    return m;
  }, [cascos]);

  const listaIdToCasco = useMemo(() => {
    const m = new Map<string, string>();
    (listasAtuais as any[]).forEach((l) => m.set(l.id, l.casco_id));
    return m;
  }, [listasAtuais]);

  // Itens enriquecidos
  const itensEnriq = useMemo(() => {
    return (itens as any[]).map((it) => {
      const cascoId = listaIdToCasco.get(it.lista_id) ?? "";
      return {
        ...it,
        casco_id: cascoId,
        categoria: classificarMaterial(it.descricao_sap, it.codigo_sap) as CategoriaMaterial,
      };
    });
  }, [itens, listaIdToCasco]);

  // Cascos com dados (para listar como chips)
  const cascosComDados = useMemo(
    () =>
      (listasAtuais as any[])
        .map((l) => cascoById.get(l.casco_id))
        .filter(Boolean)
        .sort((a: any, b: any) => String(a.numero).localeCompare(String(b.numero))),
    [listasAtuais, cascoById],
  );

  const cascosFiltro = cascosSel.size === 0
    ? new Set(cascosComDados.map((c: any) => c.id))
    : cascosSel;

  const itensFiltrados = useMemo(
    () => itensEnriq.filter((it) => cascosFiltro.has(it.casco_id)),
    [itensEnriq, cascosFiltro],
  );

  // KPI por categoria (peso real)
  const totaisPorCategoria = useMemo(() => {
    const m: Record<CategoriaMaterial, { peso: number; pecas: number; linhas: number }> = {
      FERRO: { peso: 0, pecas: 0, linhas: 0 },
      SOLDA: { peso: 0, pecas: 0, linhas: 0 },
      "GÁS": { peso: 0, pecas: 0, linhas: 0 },
      TINTA: { peso: 0, pecas: 0, linhas: 0 },
      OUTROS: { peso: 0, pecas: 0, linhas: 0 },
    };
    itensFiltrados.forEach((it) => {
      m[it.categoria].peso += Number(it.peso_real ?? it.peso_total_estimado ?? 0);
      m[it.categoria].pecas += Number(it.qtd_pecas ?? 0);
      m[it.categoria].linhas += 1;
    });
    return m;
  }, [itensFiltrados]);

  // Dados do gráfico: categoria x casco (peso)
  const dadosGrafico = useMemo(() => {
    return CATEGORIAS.map((cat) => {
      const row: any = { categoria: cat };
      cascosComDados.forEach((c: any) => {
        if (!cascosFiltro.has(c.id)) return;
        const peso = itensFiltrados
          .filter((it) => it.casco_id === c.id && it.categoria === cat)
          .reduce((s, it) => s + Number(it.peso_real ?? it.peso_total_estimado ?? 0), 0);
        row[c.numero] = Math.round(peso);
      });
      return row;
    });
  }, [itensFiltrados, cascosComDados, cascosFiltro]);

  // Tabela consolidada de materiais
  const materiaisConsolidados = useMemo(() => {
    const map = new Map<string, any>();
    itensFiltrados.forEach((it) => {
      if (catSel !== "TODAS" && it.categoria !== catSel) return;
      const k = it.codigo_sap;
      const cur = map.get(k) ?? {
        codigo: it.codigo_sap,
        descricao: it.descricao_sap ?? "",
        unidade: it.unidade ?? "",
        categoria: it.categoria,
        quantidade: 0,
        peso: 0,
        pecas: 0,
      };
      cur.quantidade += Number(it.quantidade ?? 0);
      cur.peso += Number(it.peso_real ?? it.peso_total_estimado ?? 0);
      cur.pecas += Number(it.qtd_pecas ?? 0);
      map.set(k, cur);
    });
    let arr = Array.from(map.values());
    if (busca.trim()) {
      const q = busca.toLowerCase();
      arr = arr.filter((r) => [r.codigo, r.descricao].some((v) => String(v).toLowerCase().includes(q)));
    }
    return arr.sort((a, b) => b.peso - a.peso);
  }, [itensFiltrados, catSel, busca]);

  const totalGeralPeso = Object.values(totaisPorCategoria).reduce((s, v) => s + v.peso, 0);

  // Paleta usando tokens semânticos
  const paletaCasco = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--secondary))", "hsl(var(--destructive))", "hsl(var(--muted-foreground))"];

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6 text-primary" />
            Painel Dinâmico — Lista Técnica
          </h1>
          <p className="text-sm text-muted-foreground">
            Consolida a última versão importada de cada casco. Atualiza automaticamente quando há novas importações.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => {
          qc.invalidateQueries({ queryKey: ["listas-tecnicas-latest"] });
          qc.invalidateQueries({ queryKey: ["lista-tecnica-itens-painel"] });
        }}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      {/* Chips de cascos */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Cascos</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {cascosComDados.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum casco com lista técnica importada.</p>
          )}
          {cascosComDados.map((c: any) => {
            const ativo = cascosSel.size === 0 || cascosSel.has(c.id);
            return (
              <button
                key={c.id}
                onClick={() => {
                  setCascosSel((prev) => {
                    const n = new Set(prev);
                    if (n.has(c.id)) n.delete(c.id);
                    else n.add(c.id);
                    return n;
                  });
                }}
                className={`px-3 py-1.5 rounded-md text-sm border transition ${
                  ativo
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted text-muted-foreground border-border hover:bg-muted/70"
                }`}
              >
                {c.numero}{c.nome ? ` — ${c.nome}` : ""}
              </button>
            );
          })}
          {cascosSel.size > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setCascosSel(new Set())}>Limpar</Button>
          )}
        </CardContent>
      </Card>

      {/* KPIs por categoria */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
        {CATEGORIAS.map((cat) => {
          const v = totaisPorCategoria[cat];
          const pct = totalGeralPeso > 0 ? (v.peso / totalGeralPeso) * 100 : 0;
          const ativo = catSel === cat;
          return (
            <button
              key={cat}
              onClick={() => setCatSel((prev) => (prev === cat ? "TODAS" : cat))}
              className="text-left"
            >
              <Card className={`transition ${ativo ? "ring-2 ring-primary" : "hover:bg-muted/40"}`}>
                <CardContent className="py-3">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block h-3 w-3 rounded-sm ${CATEGORIA_CLASSE[cat]}`} />
                    <span className="text-xs font-medium uppercase tracking-wide">{cat}</span>
                  </div>
                  <div className="text-xl font-semibold mt-1">{fmt(v.peso, 0)} <span className="text-xs font-normal text-muted-foreground">kg</span></div>
                  <div className="text-xs text-muted-foreground">{fmtInt(v.pecas)} peças • {v.linhas} linhas • {pct.toFixed(1)}%</div>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>

      {/* Gráfico por categoria x casco */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Peso (kg) por categoria × casco</CardTitle></CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dadosGrafico} margin={{ left: 10, right: 10, top: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="categoria" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => Intl.NumberFormat("pt-BR", { notation: "compact" }).format(v)} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--popover-foreground))" }}
                formatter={(v: any) => `${fmt(Number(v), 0)} kg`}
              />
              {cascosComDados
                .filter((c: any) => cascosFiltro.has(c.id))
                .map((c: any, i: number) => (
                  <Bar key={c.id} dataKey={c.numero} fill={paletaCasco[i % paletaCasco.length]} radius={[4, 4, 0, 0]} />
                ))}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tabela de materiais */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm">
            Materiais consolidados {catSel !== "TODAS" && <Badge variant="secondary" className="ml-2">{catSel}</Badge>}
          </CardTitle>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8 h-9" placeholder="Buscar código ou descrição…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="overflow-auto max-h-[480px]">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Cat.</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
                <TableHead>UM</TableHead>
                <TableHead className="text-right">Peças</TableHead>
                <TableHead className="text-right">Peso (kg)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materiaisConsolidados.map((r) => (
                <TableRow key={r.codigo}>
                  <TableCell className="font-mono text-xs">{r.codigo}</TableCell>
                  <TableCell className="max-w-md truncate" title={r.descricao}>{r.descricao}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <span className={`inline-block h-2.5 w-2.5 rounded-sm ${CATEGORIA_CLASSE[r.categoria as CategoriaMaterial]}`} />
                      {r.categoria}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{fmt(r.quantidade)}</TableCell>
                  <TableCell>{r.unidade}</TableCell>
                  <TableCell className="text-right">{fmtInt(r.pecas)}</TableCell>
                  <TableCell className="text-right font-medium">{fmt(r.peso, 0)}</TableCell>
                </TableRow>
              ))}
              {materiaisConsolidados.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">Sem materiais para os filtros atuais.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}