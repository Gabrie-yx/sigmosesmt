import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Calculator, Lock, LockOpen, RefreshCw, Save, Sparkles } from "lucide-react";
import { resolveTipo } from "@/lib/mb51-parser";
import type { TipoMP } from "@/lib/base-mp-parser";
type CategoriaMaterial = TipoMP;

export const Route = createFileRoute("/app/producao/fatores-consumo")({
  component: FatoresConsumoPage,
});

type Fator = {
  id?: string;
  tipo_embarcacao: string;
  categoria: CategoriaMaterial;
  unidade: string;
  fator_por_ton_aco: number;
  fonte: "AUTO" | "MANUAL";
  cascos_base: number;
  travado: boolean;
  observacoes?: string | null;
};

const CATEGORIAS: CategoriaMaterial[] = ["FERRO", "SOLDA", "GÁS", "TINTA", "OUTROS"];
const fmt = (n: number, d = 1) => Number.isFinite(n) ? n.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—";

function FatoresConsumoPage() {
  const qc = useQueryClient();
  const [editBuffer, setEditBuffer] = useState<Record<string, Partial<Fator>>>({});

  const { data: fatores = [] } = useQuery({
    queryKey: ["fatores-consumo-admin"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("producao_fatores_consumo")
        .select("*")
        .order("tipo_embarcacao")
        .order("categoria");
      if (error) throw error;
      return (data ?? []) as Fator[];
    },
  });

  // Tipos de embarcação distintos (vindos da tabela cascos)
  const { data: tiposEmb = [] } = useQuery({
    queryKey: ["cascos-tipos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cascos")
        .select("tipo_embarcacao")
        .not("tipo_embarcacao", "is", null);
      if (error) throw error;
      const set = new Set<string>();
      (data ?? []).forEach((r: any) => r.tipo_embarcacao && set.add(r.tipo_embarcacao));
      return Array.from(set).sort();
    },
  });

  const upsertMut = useMutation({
    mutationFn: async (rows: Fator[]) => {
      const { error } = await (supabase as any)
        .from("producao_fatores_consumo")
        .upsert(rows, { onConflict: "tipo_embarcacao,categoria" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fatores-consumo-admin"] });
      qc.invalidateQueries({ queryKey: ["fatores-consumo"] });
      toast.success("Fatores salvos.");
      setEditBuffer({});
    },
    onError: (e: any) => toast.error("Erro ao salvar", { description: e?.message }),
  });

  // Recalcula AUTO a partir do histórico (cascos com B51 + MB51)
  const [recalculando, setRecalculando] = useState(false);
  async function recalcularAuto() {
    setRecalculando(true);
    try {
      // 1) cascos com tipo
      const { data: cascos } = await supabase
        .from("cascos")
        .select("id, numero, tipo_embarcacao")
        .not("tipo_embarcacao", "is", null);

      // 2) ordens com casco
      const { data: ordens } = await supabase
        .from("producao_ordens")
        .select("id, casco_id, numero_sap");

      // 3) base mp para classificação
      const { data: baseMp } = await supabase
        .from("producao_base_materia_prima")
        .select("codigo_sap, tipo, descricao_sap");
      const baseMpMap = new Map<string, TipoMP>();
      const baseMpDescMap = new Map<string, string | null>();
      (baseMp ?? []).forEach((b: any) => {
        if (b.tipo) baseMpMap.set(String(b.codigo_sap), b.tipo as TipoMP);
        baseMpDescMap.set(String(b.codigo_sap), b.descricao_sap);
      });

      // 4) listas técnicas ativas dos cascos
      const cascoIds = (cascos ?? []).map((c: any) => c.id);
      if (cascoIds.length === 0) {
        toast.warning("Nenhum casco com tipo de embarcação cadastrado.");
        return;
      }
      const { data: listas } = await (supabase as any)
        .from("producao_listas_tecnicas")
        .select("id, casco_id, ativa")
        .in("casco_id", cascoIds)
        .eq("ativa", true);
      const listaPorCasco = new Map<string, string>();
      (listas ?? []).forEach((l: any) => listaPorCasco.set(l.casco_id, l.id));

      const listaIds = Array.from(listaPorCasco.values());
      const { data: itensB51 } = listaIds.length
        ? await supabase
            .from("producao_lista_tecnica_itens")
            .select("lista_id, codigo_sap, quantidade, unidade, peso_real, peso_total_estimado, peso_chapa, qtd_pecas")
            .in("lista_id", listaIds)
        : { data: [] as any[] };

      // 5) MB51 movimentos por ordem
      const ordensComCasco = (ordens ?? []).filter((o: any) => o.casco_id);
      const ordemIds = ordensComCasco.map((o: any) => o.id);
      const { data: mov } = ordemIds.length
        ? await supabase
            .from("producao_mb51_movimentos")
            .select("ordem_id, codigo_sap, descricao_material, unidade, quantidade, tipo_movimento, classificacao_tipo")
            .in("ordem_id", ordemIds)
        : { data: [] as any[] };

      // 6) agrega por tipo_embarcacao + categoria
      type Agg = { aco_kg: number; insumos: Record<CategoriaMaterial, { qtd: number; um: string }>; cascos: Set<string> };
      const porTipo: Record<string, Agg> = {};
      const cascoMeta = new Map<string, { tipo: string }>();
      (cascos ?? []).forEach((c: any) => cascoMeta.set(c.id, { tipo: c.tipo_embarcacao }));

      // FERRO planejado (kg) por casco
      const ferroKgPorCasco = new Map<string, number>();
      (itensB51 ?? []).forEach((it: any) => {
        const cascoId = Array.from(listaPorCasco.entries()).find(([, lid]) => lid === it.lista_id)?.[0];
        if (!cascoId) return;
        const cat = resolveTipo(String(it.codigo_sap ?? ""), null, baseMpMap, baseMpDescMap.get(String(it.codigo_sap)) ?? null);
        if (cat !== "FERRO") return;
        const um = String(it.unidade ?? "").toUpperCase();
        const kg =
          Number(it.peso_real ?? 0) ||
          Number(it.peso_total_estimado ?? 0) ||
          Number(it.peso_chapa ?? 0) * Number(it.qtd_pecas ?? 0) ||
          (um === "KG" ? Math.abs(Number(it.quantidade ?? 0)) : 0);
        ferroKgPorCasco.set(cascoId, (ferroKgPorCasco.get(cascoId) ?? 0) + kg);
      });

      // Insumos aplicados (MB51) por casco
      type InsAgg = Map<string, Record<CategoriaMaterial, { qtd: number; um: string }>>;
      const insumosPorCasco: InsAgg = new Map();
      const ordemParaCasco = new Map<string, string>();
      ordensComCasco.forEach((o: any) => ordemParaCasco.set(o.id, o.casco_id));
      (mov ?? []).forEach((m: any) => {
        const cascoId = ordemParaCasco.get(m.ordem_id);
        if (!cascoId) return;
        const cat = resolveTipo(String(m.codigo_sap ?? ""), m.classificacao_tipo ?? null, baseMpMap, m.descricao_material ?? null);
        const um = String(m.unidade ?? "").toUpperCase();
        const tm = String(m.tipo_movimento ?? "");
        // 261 saída, 262 estorno
        const sinal = tm.startsWith("262") || tm.startsWith("532") ? -1 : 1;
        const qtd = sinal * Math.abs(Number(m.quantidade ?? 0));
        const slot = insumosPorCasco.get(cascoId) ?? { FERRO: { qtd: 0, um }, SOLDA: { qtd: 0, um }, "GÁS": { qtd: 0, um }, TINTA: { qtd: 0, um }, OUTROS: { qtd: 0, um } } as any;
        slot[cat].qtd += qtd;
        slot[cat].um = um || slot[cat].um;
        insumosPorCasco.set(cascoId, slot);
      });

      // Junta por tipo
      cascoMeta.forEach((meta, cascoId) => {
        const aco = ferroKgPorCasco.get(cascoId) ?? 0;
        const ins = insumosPorCasco.get(cascoId);
        if (aco <= 0 || !ins) return;
        const agg = porTipo[meta.tipo] ?? { aco_kg: 0, insumos: { FERRO: { qtd: 0, um: "KG" }, SOLDA: { qtd: 0, um: "KG" }, "GÁS": { qtd: 0, um: "KG" }, TINTA: { qtd: 0, um: "KG" }, OUTROS: { qtd: 0, um: "KG" } }, cascos: new Set() } as any;
        agg.aco_kg += aco;
        (Object.keys(ins) as CategoriaMaterial[]).forEach((cat) => {
          agg.insumos[cat].qtd += Math.max(0, ins[cat].qtd);
          agg.insumos[cat].um = ins[cat].um || agg.insumos[cat].um;
        });
        agg.cascos.add(cascoId);
        porTipo[meta.tipo] = agg;
      });

      // Monta rows a salvar — só categorias não-FERRO (FERRO se calcula direto da B51)
      const rows: Fator[] = [];
      const existentesTrava = new Map<string, boolean>();
      (fatores as Fator[]).forEach((f) => existentesTrava.set(`${f.tipo_embarcacao}|${f.categoria}`, f.travado));

      Object.entries(porTipo).forEach(([tipo, agg]) => {
        const tonAco = agg.aco_kg / 1000;
        if (tonAco <= 0) return;
        (["SOLDA", "GÁS", "TINTA", "OUTROS"] as CategoriaMaterial[]).forEach((cat) => {
          const travado = existentesTrava.get(`${tipo}|${cat}`) ?? false;
          if (travado) return;
          const fator = agg.insumos[cat].qtd / tonAco;
          if (!Number.isFinite(fator) || fator <= 0) return;
          rows.push({
            tipo_embarcacao: tipo,
            categoria: cat,
            unidade: agg.insumos[cat].um || "KG",
            fator_por_ton_aco: Number(fator.toFixed(3)),
            fonte: "AUTO",
            cascos_base: agg.cascos.size,
            travado: false,
          });
        });
      });

      if (rows.length === 0) {
        toast.warning("Nada para recalcular (sem cascos completos com tipo).");
        return;
      }

      await upsertMut.mutateAsync(rows);
      toast.success(`Fatores recalculados (${rows.length} linhas)`, {
        description: `${Object.keys(porTipo).length} tipo(s) de embarcação`,
      });
    } catch (e: any) {
      toast.error("Falha no recálculo", { description: e?.message });
    } finally {
      setRecalculando(false);
    }
  }

  // Index por (tipo, cat)
  const map = useMemo(() => {
    const m = new Map<string, Fator>();
    (fatores as Fator[]).forEach((f) => m.set(`${f.tipo_embarcacao}|${f.categoria}`, f));
    return m;
  }, [fatores]);

  function getCell(tipo: string, cat: CategoriaMaterial): Fator {
    const key = `${tipo}|${cat}`;
    const base = map.get(key) ?? {
      tipo_embarcacao: tipo,
      categoria: cat,
      unidade: "KG",
      fator_por_ton_aco: 0,
      fonte: "MANUAL",
      cascos_base: 0,
      travado: false,
    };
    return { ...base, ...editBuffer[key] } as Fator;
  }

  function setCell(tipo: string, cat: CategoriaMaterial, patch: Partial<Fator>) {
    const key = `${tipo}|${cat}`;
    setEditBuffer((b) => ({ ...b, [key]: { ...b[key], ...patch } }));
  }

  async function salvar() {
    const rows: Fator[] = [];
    Object.entries(editBuffer).forEach(([key, patch]) => {
      const [tipo, cat] = key.split("|") as [string, CategoriaMaterial];
      const base = map.get(key);
      rows.push({
        ...(base ?? {
          tipo_embarcacao: tipo,
          categoria: cat,
          unidade: "KG",
          fator_por_ton_aco: 0,
          fonte: "MANUAL",
          cascos_base: 0,
          travado: false,
        }),
        ...patch,
        tipo_embarcacao: tipo,
        categoria: cat,
        fonte: "MANUAL",
      });
    });
    if (rows.length === 0) return;
    await upsertMut.mutateAsync(rows);
  }

  const dirty = Object.keys(editBuffer).length > 0;

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calculator className="h-6 w-6 text-primary" />
            Fatores de Consumo
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Estima o <b>plano de insumos</b> (solda, gás, tinta, outros) a partir
            do peso de aço (FERRO) da Lista Técnica. Usado nos cards "Material
            Planejado" do Dashboard quando não há plano direto em KG.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={recalcularAuto} disabled={recalculando}>
            <RefreshCw className={`h-4 w-4 mr-2 ${recalculando ? "animate-spin" : ""}`} />
            Recalcular do histórico
          </Button>
          <Button onClick={salvar} disabled={!dirty || upsertMut.isPending}>
            <Save className="h-4 w-4 mr-2" />
            Salvar {dirty ? `(${Object.keys(editBuffer).length})` : ""}
          </Button>
        </div>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Como funciona
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1">
          <p>
            <b>Fator AUTO</b> = soma do consumo MB51 da categoria ÷ toneladas de aço
            planejadas (B51), considerando todos os cascos completos daquele tipo de embarcação.
          </p>
          <p>
            <b>Fator MANUAL</b> = você sobrescreve o valor. Ative <Lock className="inline h-3 w-3" /> "Travado" para preservar contra o próximo recálculo.
          </p>
          <p>Exemplo: 18 kg de SOLDA por tonelada de aço → casco com 250 t de aço prevê 4.500 kg de solda.</p>
        </CardContent>
      </Card>

      {tiposEmb.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground text-sm">
            Nenhum tipo de embarcação cadastrado nos cascos. Edite os cascos e
            informe <i>tipo_embarcacao</i> primeiro.
          </CardContent>
        </Card>
      ) : (
        tiposEmb.map((tipo) => (
          <Card key={tipo}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{tipo}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="w-[140px]">Fator (kg/ton aço)</TableHead>
                    <TableHead className="w-[100px]">Unidade</TableHead>
                    <TableHead className="w-[100px]">Fonte</TableHead>
                    <TableHead className="w-[100px]">Base</TableHead>
                    <TableHead className="w-[120px]">Travado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(["SOLDA", "GÁS", "TINTA", "OUTROS"] as CategoriaMaterial[]).map((cat) => {
                    const f = getCell(tipo, cat);
                    const isDirty = !!editBuffer[`${tipo}|${cat}`];
                    return (
                      <TableRow key={cat} className={isDirty ? "bg-amber-500/5" : ""}>
                        <TableCell className="font-medium">{cat}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.1"
                            value={f.fator_por_ton_aco}
                            onChange={(e) => setCell(tipo, cat, { fator_por_ton_aco: Number(e.target.value) })}
                            className="h-8 tabular-nums"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={f.unidade}
                            onChange={(e) => setCell(tipo, cat, { unidade: e.target.value.toUpperCase() })}
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Badge variant={f.fonte === "AUTO" ? "secondary" : "default"}>
                            {f.fonte}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground tabular-nums">
                          {f.cascos_base} casco(s)
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={f.travado}
                              onCheckedChange={(v) => setCell(tipo, cat, { travado: v })}
                            />
                            {f.travado ? <Lock className="h-3 w-3 text-amber-500" /> : <LockOpen className="h-3 w-3 text-muted-foreground" />}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
