import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  ClipboardList, GripVertical, Lock, Unlock, RotateCcw, Plus, Save,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/producao/criar-ordem")({
  component: CriarOrdemPage,
});

type Layout = { i: string; x: number; y: number; w: number; h: number; minW?: number; minH?: number };

type FieldKind = "text" | "textarea" | "number" | "date" | "select-casco" | "select-tipo" | "select-um";

type FieldDef = {
  key: string;
  label: string;
  kind: FieldKind;
  placeholder?: string;
};

const FIELDS: FieldDef[] = [
  { key: "qtde_itens",         label: "Qtde. Itens",                kind: "number" },
  { key: "descricao_material", label: "Descrição do Material",      kind: "textarea" },
  { key: "casco",              label: "Casco",                      kind: "select-casco" },
  { key: "unidade_medida",     label: "Unidade de Medida",          kind: "select-um" },
  { key: "grupo_compradores",  label: "Grupo Compradores",          kind: "text" },
  { key: "tipo_produto",       label: "Tipo de Produto",            kind: "select-tipo" },
  { key: "ncm",                label: "NCM",                        kind: "text" },
  { key: "centro",             label: "Centro",                     kind: "text" },
  { key: "deposito",           label: "Depósito",                   kind: "text" },
  { key: "grupo_mercadorias",  label: "Grupo de Mercadorias",       kind: "text" },
  { key: "setor_atividade",    label: "Setor de Atividade",         kind: "text" },
  { key: "grupo_categ_item",   label: "Grupo de Categoria Item Ger",kind: "text" },
  { key: "classe_avaliacao",   label: "Classe de Avaliação",        kind: "text" },
  { key: "determ_preco",       label: "Determinação de Preço",      kind: "text" },
  { key: "controle_preco",     label: "Controle de Preço",          kind: "text" },
  { key: "origem_material",    label: "Origem do Material",         kind: "text" },
  { key: "utilizacao_material",label: "Utilização do Material",     kind: "text" },
  { key: "solicitante",        label: "Solicitante",                kind: "text" },
  { key: "data",               label: "Data",                       kind: "date" },
];

const LS_KEY = "producao-criar-ordem-layout-v1";

// Default 12-col layout: pairs of widgets, each 6w x 3h; descricao spans 12w
const DEFAULT_LAYOUT: Layout[] = (() => {
  let y = 0;
  const out: Layout[] = [];
  // row 1
  out.push({ i: "qtde_itens",  x: 0, y, w: 6, h: 3, minW: 2, minH: 3 });
  out.push({ i: "data",        x: 6, y, w: 6, h: 3, minW: 2, minH: 3 });
  y += 3;
  // descricao full width
  out.push({ i: "descricao_material", x: 0, y, w: 8, h: 4, minW: 4, minH: 3 });
  out.push({ i: "casco",              x: 8, y, w: 4, h: 4, minW: 3, minH: 3 });
  y += 4;
  // 3-up
  out.push({ i: "unidade_medida",    x: 0, y, w: 4, h: 3, minW: 2, minH: 3 });
  out.push({ i: "grupo_compradores", x: 4, y, w: 4, h: 3, minW: 2, minH: 3 });
  out.push({ i: "tipo_produto",      x: 8, y, w: 4, h: 3, minW: 2, minH: 3 });
  y += 3;
  // 3-up
  out.push({ i: "ncm",      x: 0, y, w: 4, h: 3, minW: 2, minH: 3 });
  out.push({ i: "centro",   x: 4, y, w: 4, h: 3, minW: 2, minH: 3 });
  out.push({ i: "deposito", x: 8, y, w: 4, h: 3, minW: 2, minH: 3 });
  y += 3;
  // 2-up
  out.push({ i: "grupo_mercadorias", x: 0, y, w: 6, h: 3, minW: 3, minH: 3 });
  out.push({ i: "setor_atividade",   x: 6, y, w: 6, h: 3, minW: 3, minH: 3 });
  y += 3;
  out.push({ i: "grupo_categ_item",  x: 0, y, w: 6, h: 3, minW: 3, minH: 3 });
  out.push({ i: "classe_avaliacao",  x: 6, y, w: 6, h: 3, minW: 3, minH: 3 });
  y += 3;
  out.push({ i: "determ_preco",      x: 0, y, w: 6, h: 3, minW: 3, minH: 3 });
  out.push({ i: "controle_preco",    x: 6, y, w: 6, h: 3, minW: 3, minH: 3 });
  y += 3;
  out.push({ i: "origem_material",   x: 0, y, w: 6, h: 3, minW: 3, minH: 3 });
  out.push({ i: "utilizacao_material",x:6, y, w: 6, h: 3, minW: 3, minH: 3 });
  y += 3;
  out.push({ i: "solicitante", x: 0, y, w: 12, h: 3, minW: 4, minH: 3 });
  return out;
})();

function loadLayout(): Layout[] {
  if (typeof window === "undefined") return DEFAULT_LAYOUT;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw) as Layout[];
    const valid = new Set(FIELDS.map((f) => f.key));
    const kept = parsed.filter((p) => valid.has(p.i));
    const ids = new Set(kept.map((p) => p.i));
    const missing = DEFAULT_LAYOUT.filter((d) => !ids.has(d.i));
    return [...kept, ...missing];
  } catch {
    return DEFAULT_LAYOUT;
  }
}

// Auto-fit: quando widgets compartilham a mesma linha (mesmo Y) e a soma das
// larguras passa de 12 colunas (ou há sobreposição em X), redistribui as
// larguras igualmente entre eles, preenchendo as 12 colunas.
function autoFitRows(layout: Layout[]): Layout[] {
  const groups = new Map<number, Layout[]>();
  layout.forEach((l) => {
    const arr = groups.get(l.y) ?? [];
    arr.push(l);
    groups.set(l.y, arr);
  });

  const result: Layout[] = [];
  groups.forEach((items) => {
    if (items.length <= 1) {
      result.push(...items);
      return;
    }
    const sorted = [...items].sort((a, b) => a.x - b.x);
    const totalW = sorted.reduce((s, it) => s + it.w, 0);
    const overlap = sorted.some((it, i) => i > 0 && it.x < sorted[i - 1].x + sorted[i - 1].w);
    if (totalW <= 12 && !overlap) {
      result.push(...items);
      return;
    }
    const n = sorted.length;
    const base = Math.floor(12 / n);
    const extra = 12 - base * n;
    let cursor = 0;
    sorted.forEach((it, i) => {
      const w = Math.max(it.minW ?? 2, base + (i < extra ? 1 : 0));
      result.push({ ...it, x: cursor, w });
      cursor += w;
    });
  });
  return result;
}

function CriarOrdemPage() {
  const qc = useQueryClient();
  const [layout, setLayout] = useState<Layout[]>(() => loadLayout());
  const [locked, setLocked] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [Grid, setGrid] = useState<any>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [gridWidth, setGridWidth] = useState(0);
  const initial = useRef(true);
  const [umDialogOpen, setUmDialogOpen] = useState(false);
  const [newUm, setNewUm] = useState({ sigla: "", descricao: "" });

  useEffect(() => {
    let mounted = true;
    import("react-grid-layout").then((mod) => {
      const RGL: any = (mod as any).default ?? (mod as any).ReactGridLayout ?? (mod as any).GridLayout;
      if (mounted) setGrid(() => RGL);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => setGridWidth(Math.max(320, Math.floor(el.clientWidth)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (initial.current) { initial.current = false; return; }
    try { localStorage.setItem(LS_KEY, JSON.stringify(layout)); } catch {}
  }, [layout]);

  // data sources
  const { data: cascos = [] } = useQuery({
    queryKey: ["cascos-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cascos").select("id, numero").order("numero");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: tipos = [] } = useQuery({
    queryKey: ["producao-tipos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("producao_tipos_produto").select("id, nome").eq("ativo", true).order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: unidades = [] } = useQuery({
    queryKey: ["producao-um"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("producao_unidades_medida").select("id, sigla, descricao").eq("ativo", true).order("sigla");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Default UM = "UN" once available
  useEffect(() => {
    if (unidades.length && !values.unidade_medida) {
      const un = unidades.find((u: any) => u.sigla === "UN") ?? unidades[0];
      setValues((v) => ({ ...v, unidade_medida: un.sigla }));
    }
  }, [unidades, values.unidade_medida]);

  // NCM automático com base no Tipo de Produto
  const NCM_POR_TIPO: Record<string, string> = {
    BALSA: "89079000",
    EMPURRADOR: "89040000",
    EMBARCACAO: "89011000",
    "ESTRUTURA FLUTUANTE": "89079000",
  };
  useEffect(() => {
    const tipo = (values.tipo_produto ?? "").toString().toUpperCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (!tipo) return;
    let ncm = "";
    if (tipo.includes("EMPURRADOR")) ncm = NCM_POR_TIPO.EMPURRADOR;
    else if (tipo.includes("BALSA")) ncm = NCM_POR_TIPO.BALSA;
    else if (tipo.includes("ESTRUTURA")) ncm = NCM_POR_TIPO["ESTRUTURA FLUTUANTE"];
    else if (tipo.includes("EMBARCACAO") || tipo.includes("EMBARCA")) ncm = NCM_POR_TIPO.EMBARCACAO;
    if (ncm) setValues((v) => (v.ncm === ncm ? v : { ...v, ncm }));
  }, [values.tipo_produto]);

  // Sugestão: próximo número de casco sequencial = max + 1
  const proximoCascoNum = useMemo(() => {
    let max = 0;
    cascos.forEach((c: any) => {
      const m = String(c.numero).match(/(\d+)/);
      if (m) { const n = parseInt(m[1], 10); if (n > max) max = n; }
    });
    return max + 1;
  }, [cascos]);

  const addUm = useMutation({
    mutationFn: async () => {
      const sigla = newUm.sigla.trim().toUpperCase();
      if (!sigla) throw new Error("Informe a sigla");
      const { error } = await supabase
        .from("producao_unidades_medida")
        .insert({ sigla, descricao: newUm.descricao || null });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["producao-um"] });
      toast.success("Unidade adicionada");
      setUmDialogOpen(false);
      setValues((v) => ({ ...v, unidade_medida: newUm.sigla.trim().toUpperCase() }));
      setNewUm({ sigla: "", descricao: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const setVal = (k: string, v: string) => setValues((s) => ({ ...s, [k]: v }));

  const fieldByKey = useMemo(
    () => Object.fromEntries(FIELDS.map((f) => [f.key, f])) as Record<string, FieldDef>,
    []
  );

  const renderField = (f: FieldDef) => {
    const v = values[f.key] ?? "";
    switch (f.kind) {
      case "textarea":
        return (
          <Textarea
            value={v}
            onChange={(e) => setVal(f.key, e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder="Descreva o material…"
            className="h-full resize-none"
          />
        );
      case "number":
        return (
          <Input type="number" inputMode="numeric" value={v}
            onChange={(e) => setVal(f.key, e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder="0"
          />
        );
      case "date":
        return (
          <Input type="date" value={v}
            onChange={(e) => setVal(f.key, e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
          />
        );
      case "select-casco":
        return (
          <div onMouseDown={(e) => e.stopPropagation()}>
            <Select value={v} onValueChange={(val) => setVal(f.key, val)}>
              <SelectTrigger><SelectValue placeholder="Selecione o casco…" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {cascos.map((c: any) => (
                  <SelectItem key={c.id} value={c.numero}>{c.numero}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Próximo sequencial sugerido: <span className="font-bold text-amber-700">CASCO {String(proximoCascoNum).padStart(3, "0")}</span>
            </p>
          </div>
        );
      case "select-tipo":
        return (
          <div onMouseDown={(e) => e.stopPropagation()}>
            <Select value={v} onValueChange={(val) => setVal(f.key, val)}>
              <SelectTrigger><SelectValue placeholder="Tipo de produto…" /></SelectTrigger>
              <SelectContent>
                {tipos.map((t: any) => (
                  <SelectItem key={t.id} value={t.nome}>{t.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      case "select-um":
        return (
          <div className="flex gap-2" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex-1">
              <Select value={v} onValueChange={(val) => setVal(f.key, val)}>
                <SelectTrigger><SelectValue placeholder="UM…" /></SelectTrigger>
                <SelectContent>
                  {unidades.map((u: any) => (
                    <SelectItem key={u.id} value={u.sigla}>
                      {u.sigla}{u.descricao ? ` — ${u.descricao}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" variant="outline" size="icon"
              className="shrink-0"
              onClick={() => setUmDialogOpen(true)}
              title="Adicionar nova unidade">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        );
      default:
        return (
          <Input value={v}
            onChange={(e) => setVal(f.key, e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder={f.placeholder ?? ""}
          />
        );
    }
  };

  const resetLayout = () => {
    setLayout(DEFAULT_LAYOUT);
    try { localStorage.removeItem(LS_KEY); } catch {}
    toast.success("Layout restaurado");
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-5 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md">
            <ClipboardList className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Nova Ordem de Produção</h1>
            <p className="text-[11px] text-muted-foreground font-medium">
              FORMULÁRIO – MATERIAIS HALB · widgets arrastáveis e redimensionáveis
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="sm"
            onClick={() => setLocked((v) => !v)}
            className="gap-1.5"
          >
            {locked ? <><Lock className="h-3.5 w-3.5" /> Bloqueado</> : <><Unlock className="h-3.5 w-3.5" /> Editar layout</>}
          </Button>
          <Button variant="outline" size="sm" onClick={resetLayout} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" /> Resetar
          </Button>
          <Button size="sm" className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
            onClick={() => toast.message("Persistência será habilitada na próxima etapa.")}>
            <Save className="h-3.5 w-3.5" /> Salvar
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div ref={wrapRef} className="min-w-0 rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50/40 to-white p-3">
        {Grid && gridWidth > 0 ? (
          <Grid
            className="layout"
            layout={layout}
            width={gridWidth}
            gridConfig={{ cols: 12, rowHeight: 32, margin: [12, 12], containerPadding: [0, 0] }}
            onLayoutChange={(l: Layout[]) => setLayout(autoFitRows(l))}
            dragConfig={{ enabled: !locked, handle: ".widget-drag-handle" }}
            resizeConfig={{ enabled: !locked }}
          >
            {layout.map((l) => {
              const f = fieldByKey[l.i];
              if (!f) return null;
              return (
                <div key={l.i}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden hover:border-amber-300 transition-colors">
                  <div className={`widget-drag-handle ${locked ? "cursor-default" : "cursor-grab active:cursor-grabbing"} flex items-center justify-between px-3 py-1.5 border-b border-slate-100 bg-gradient-to-b from-white to-slate-50`}>
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-700">
                      {f.label}
                    </Label>
                    {!locked && <GripVertical className="h-3.5 w-3.5 text-slate-300" />}
                  </div>
                  <div className="flex-1 p-3 min-h-0 overflow-hidden">
                    {renderField(f)}
                  </div>
                </div>
              );
            })}
          </Grid>
        ) : (
          <div className="text-center text-xs text-slate-400 py-12">Carregando layout…</div>
        )}
      </div>

      {/* Assinatura */}
      <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-6 text-center">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Assinatura</p>
        <div className="h-16 border-b-2 border-slate-400 mx-auto max-w-md" />
      </div>

      {/* Add UM dialog */}
      <Dialog open={umDialogOpen} onOpenChange={setUmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Unidade de Medida</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Sigla *</Label>
              <Input value={newUm.sigla}
                onChange={(e) => setNewUm((s) => ({ ...s, sigla: e.target.value.toUpperCase() }))}
                placeholder="Ex.: KG, M, L"
                maxLength={10}
              />
            </div>
            <div>
              <Label className="text-xs">Descrição</Label>
              <Input value={newUm.descricao}
                onChange={(e) => setNewUm((s) => ({ ...s, descricao: e.target.value }))}
                placeholder="Ex.: Quilograma"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUmDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => addUm.mutate()} disabled={addUm.isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white">
              {addUm.isPending ? "Salvando…" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
