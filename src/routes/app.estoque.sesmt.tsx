import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  HardHat, Search, Download, Upload, RotateCcw, Plus, History,
  ArrowUp, ArrowDown, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

/* ============================== Types ============================== */
type Movement = {
  id: string;
  date: string; // ISO date (YYYY-MM-DD)
  delta: number; // +entrada / -saida
  tipo: "ENTRADA" | "SAIDA" | "AJUSTE";
  obs?: string;
};
type Variant = {
  id: string;
  label: string;        // ex: "AZUL TAM. P", "TAM. 39", "VERDE"
  estoqueInicial: number;
  movements: Movement[];
};
type Product = {
  id: string;
  base: string;         // ex: "CAMISA", "CAPACETE"
  umb: "UN" | "CX" | "PC" | "KG" | "M" | "GAL";
  ca?: string;
  variants: Variant[];
};

const STORAGE_KEY = "estoque-epi-sesmt-v4";

export const Route = createFileRoute("/app/estoque/sesmt")({
  component: EstoqueSesmtPage,
});

/* ============================== Seed ============================== */
const RAW_SEED: Array<{ descricao: string; umb: Product["umb"]; estoque: number; ca?: string }> = [
  { descricao: "CAMISA AZUL TAM. P", umb: "UN", estoque: 0 },
  { descricao: "CAMISA AZUL TAM. M", umb: "UN", estoque: 0 },
  { descricao: "CAMISA AZUL TAM. G", umb: "UN", estoque: 0 },
  { descricao: "CAMISA AZUL TAM. GG", umb: "UN", estoque: 0 },
  { descricao: "CAMISA CINZA TAM. M", umb: "UN", estoque: 0 },
  { descricao: "CALÇA AZUL TAM. P", umb: "UN", estoque: 0 },
  { descricao: "CALÇA AZUL TAM. M", umb: "UN", estoque: 0 },
  { descricao: "CALÇA AZUL TAM. GG", umb: "UN", estoque: 0 },
  { descricao: "CALÇA AZUL TAM. EG", umb: "UN", estoque: 0 },
  { descricao: "CALÇA CINZA TAM. P", umb: "UN", estoque: 0 },
  { descricao: "CALÇA CINZA TAM. M", umb: "UN", estoque: 0 },
  { descricao: "MACACÃO AZUL TAM. P", umb: "UN", estoque: 0, ca: "41609" },
  { descricao: "MACACÃO AZUL TAM. M", umb: "UN", estoque: 0, ca: "41609" },
  { descricao: "MACACÃO AZUL TAM. G", umb: "UN", estoque: 0, ca: "41609" },
  { descricao: "MACACÃO CINZA TAM. P", umb: "UN", estoque: 2, ca: "41609" },
  { descricao: "MACACÃO CINZA TAM. M", umb: "UN", estoque: 3, ca: "41609" },
  { descricao: "BOTA TAM. 36", umb: "UN", estoque: 0, ca: "43164" },
  { descricao: "BOTA TAM. 37", umb: "UN", estoque: 3, ca: "43164" },
  { descricao: "BOTA TAM. 39", umb: "UN", estoque: 8, ca: "43164" },
  { descricao: "BOTA TAM. 40", umb: "UN", estoque: 0, ca: "43164" },
  { descricao: "BOTA TAM. 41", umb: "UN", estoque: 0, ca: "43164" },
  { descricao: "BOTA TAM. 42", umb: "UN", estoque: 0, ca: "43164" },
  { descricao: "BOTA TAM. 44", umb: "UN", estoque: 0, ca: "43164" },
  { descricao: "BOTA PVC CANO CURTO TAM. 42", umb: "UN", estoque: 0, ca: "37456" },
  { descricao: "BOTA PVC CANO CURTO TAM. 44", umb: "UN", estoque: 0, ca: "37456" },
  { descricao: "COLETE LARANJA", umb: "UN", estoque: 8 },
  { descricao: "CAPACETE BRANCO", umb: "UN", estoque: 2, ca: "29792" },
  { descricao: "CAPACETE VERDE", umb: "UN", estoque: 3, ca: "8304" },
  { descricao: "CAPACETE VERMELHO", umb: "UN", estoque: 7, ca: "8304" },
  { descricao: "CARNEIRA CINZA", umb: "UN", estoque: 8 },
  { descricao: "CARNEIRA 3M", umb: "UN", estoque: 0 },
  { descricao: "CARNEIRA MSA", umb: "UN", estoque: 0, ca: "29638" },
  { descricao: "VISEIRA PADRÃO", umb: "UN", estoque: 56 },
  { descricao: "BALACLAVA PRETA", umb: "UN", estoque: 15 },
  { descricao: "BALACLAVA BRANCA", umb: "UN", estoque: 0 },
  { descricao: "RESPIRADOR SEMIFACIAL", umb: "UN", estoque: 15 },
  { descricao: "RESPIRADOR DESCARTÁVEL", umb: "UN", estoque: 43, ca: "44594" },
  { descricao: "FILTRO PARA PARTÍCULA", umb: "UN", estoque: 14 },
  { descricao: "FILTRO PARA PARTÍCULA 3M", umb: "CX", estoque: 20 },
  { descricao: "CARTUCHO PARA VAPORES", umb: "UN", estoque: 20 },
  { descricao: "RETENTOR PARA FILTRO", umb: "CX", estoque: 5 },
  { descricao: "ÓCULOS JAGUAR TRANSPARENTE", umb: "UN", estoque: 25, ca: "12572" },
  { descricao: "ÓCULOS PRETO", umb: "UN", estoque: 19, ca: "27418" },
  { descricao: "ÓCULOS AMARELO", umb: "UN", estoque: 12, ca: "12572" },
  { descricao: "LUVA VAQUETA PUNHO LONGO", umb: "UN", estoque: 192, ca: "253961" },
  { descricao: "LUVA VAQUETA PUNHO CURTO", umb: "UN", estoque: 125, ca: "253961" },
  { descricao: "LUVA RASPA VOLK", umb: "UN", estoque: 157, ca: "17158" },
  { descricao: "LUVA RASPA DMN", umb: "UN", estoque: 0 },
  { descricao: "LUVA BRANCA ALGODÃO", umb: "UN", estoque: 118, ca: "30521" },
  { descricao: "LUVA PRETA", umb: "UN", estoque: 202 },
  { descricao: "AVENTAL DE SOLDA", umb: "UN", estoque: 40, ca: "38716" },
  { descricao: "PERNEIRA RASPA", umb: "UN", estoque: 58 },
  { descricao: "PROTETOR SOLAR", umb: "UN", estoque: 6, ca: "4114" },
  { descricao: "LENTE PROTEÇÃO ESCURA", umb: "UN", estoque: 347 },
  { descricao: "LENTE PROTEÇÃO TRANSPARENTE", umb: "UN", estoque: 461 },
  { descricao: "TALABARTE PADRÃO", umb: "UN", estoque: 4, ca: "35531" },
  { descricao: "PROTETOR AURICULAR", umb: "UN", estoque: 168, ca: "5745" },
  { descricao: "JUGULAR MSA", umb: "UN", estoque: 0 },
  { descricao: "JUGULAR 3M", umb: "UN", estoque: 12 },
  { descricao: "MANGOTE RASPA", umb: "UN", estoque: 98, ca: "39273" },
];

/* split descrição em base (1ª palavra) + variação (resto, ou PADRÃO) */
function splitDesc(desc: string): { base: string; variant: string } {
  const parts = desc.trim().split(/\s+/);
  const base = parts[0];
  const variant = parts.slice(1).join(" ").trim() || "PADRÃO";
  return { base, variant };
}

function buildSeed(): Product[] {
  const map = new Map<string, Product>();
  for (const r of RAW_SEED) {
    const { base, variant } = splitDesc(r.descricao);
    const key = base + "|" + r.umb;
    let p = map.get(key);
    if (!p) {
      p = { id: `p-${map.size + 1}`, base, umb: r.umb, ca: r.ca, variants: [] };
      map.set(key, p);
    }
    if (r.ca && !p.ca) p.ca = r.ca;
    p.variants.push({
      id: `${p.id}-v${p.variants.length + 1}`,
      label: variant,
      estoqueInicial: r.estoque,
      movements: [],
    });
  }
  return Array.from(map.values());
}

/* ============================== Helpers ============================== */
function variantBalance(v: Variant): number {
  return v.estoqueInicial + v.movements.reduce((s, m) => s + m.delta, 0);
}
function productBalance(p: Product): number {
  return p.variants.reduce((s, v) => s + variantBalance(v), 0);
}
function fmt(n: number) {
  return n.toLocaleString("pt-BR");
}

/** Calcula estoque inicial / entradas / saídas / final de uma variante em um intervalo [startISO, endISO]. */
function variantPeriod(v: Variant, startISO: string, endISO: string) {
  let inicial = v.estoqueInicial;
  let entradas = 0;
  let saidas = 0;
  for (const m of v.movements) {
    if (m.date < startISO) {
      inicial += m.delta;
    } else if (m.date <= endISO) {
      if (m.delta > 0) entradas += m.delta;
      else saidas += -m.delta;
    }
  }
  const final = inicial + entradas - saidas;
  return { inicial, entradas, saidas, final };
}

/** Mês YYYY-MM -> [primeiro dia, último dia] em ISO YYYY-MM-DD. */
function monthRange(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const last = new Date(y, m, 0).getDate();
  const end = `${month}-${String(last).padStart(2, "0")}`;
  return { start, end };
}
function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/* ============================== Page ============================== */
function EstoqueSesmtPage() {
  const [products, setProducts] = useState<Product[]>(() => buildSeed());
  const [query, setQuery] = useState("");
  const [selectedVariant, setSelectedVariant] = useState<Record<string, string>>({});
  const [refMonth, setRefMonth] = useState<string>(() => currentMonth());
  const fileRef = useRef<HTMLInputElement>(null);

  // hydrate
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Product[];
        if (Array.isArray(parsed) && parsed.length) setProducts(parsed);
      }
    } catch {}
  }, []);
  // persist
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(products)); } catch {}
  }, [products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.base.toLowerCase().includes(q) ||
        (p.ca || "").toLowerCase().includes(q) ||
        p.variants.some((v) => v.label.toLowerCase().includes(q)),
    );
  }, [products, query]);

  const totals = useMemo(() => {
    let totalSku = 0, totalEst = 0, totalEnt = 0, totalSai = 0;
    products.forEach((p) => {
      totalSku += p.variants.length;
      p.variants.forEach((v) => {
        totalEst += variantBalance(v);
        v.movements.forEach((m) => {
          if (m.delta > 0) totalEnt += m.delta;
          else totalSai += -m.delta;
        });
      });
    });
    return { produtos: products.length, sku: totalSku, est: totalEst, ent: totalEnt, sai: totalSai };
  }, [products]);

  function getVariant(p: Product): Variant {
    const id = selectedVariant[p.id] ?? p.variants[0]?.id;
    return p.variants.find((v) => v.id === id) ?? p.variants[0];
  }

  function addMovement(productId: string, variantId: string, delta: number, tipo: Movement["tipo"]) {
    if (!delta) return;
    setProducts((prev) => prev.map((p) => {
      if (p.id !== productId) return p;
      return {
        ...p,
        variants: p.variants.map((v) => v.id !== variantId ? v : {
          ...v,
          movements: [...v.movements, {
            id: `m-${Date.now()}`,
            date: new Date().toISOString().slice(0, 10),
            delta, tipo,
          }],
        }),
      };
    }));
    toast.success(`${tipo === "ENTRADA" ? "+" : ""}${delta} registrado`);
  }

  function resetData() {
    if (!confirm("Restaurar painel para os valores iniciais? Movimentações serão perdidas.")) return;
    setProducts(buildSeed());
    setSelectedVariant({});
    toast.success("Painel restaurado");
  }

  /* ---------- Import ---------- */
  function handleImportClick() { fileRef.current?.click(); }
  async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      if (!rows.length) { toast.error("Planilha vazia"); return; }

      // detecta colunas (case-insensitive)
      const findKey = (row: any, opts: string[]) => {
        const keys = Object.keys(row);
        for (const o of opts) {
          const k = keys.find((kk) => kk.toLowerCase().trim() === o.toLowerCase());
          if (k) return k;
        }
        return null;
      };
      const sample = rows[0];
      const kDesc = findKey(sample, ["descricao", "descrição", "produto", "texto breve material", "material"]);
      const kUmb = findKey(sample, ["umb", "und", "unidade"]);
      const kEst = findKey(sample, ["estoque", "estoque inicial", "estoque final", "qtd", "quantidade", "saldo"]);
      const kCa = findKey(sample, ["ca", "c.a.", "ca nº"]);

      if (!kDesc) { toast.error("Coluna de descrição/produto não encontrada"); return; }

      const map = new Map<string, Product>();
      let pid = 1;
      for (const r of rows) {
        const desc = String(r[kDesc] || "").trim();
        if (!desc) continue;
        const { base, variant } = splitDesc(desc);
        const umb = (String(r[kUmb!] || "UN").toUpperCase() as Product["umb"]) || "UN";
        const est = Number(r[kEst!] || 0) || 0;
        const ca = kCa ? String(r[kCa] || "").trim() || undefined : undefined;
        const key = base + "|" + umb;
        let p = map.get(key);
        if (!p) {
          p = { id: `p-${pid++}`, base, umb, ca, variants: [] };
          map.set(key, p);
        }
        if (ca && !p.ca) p.ca = ca;
        p.variants.push({
          id: `${p.id}-v${p.variants.length + 1}`,
          label: variant,
          estoqueInicial: est,
          movements: [],
        });
      }
      setProducts(Array.from(map.values()));
      setSelectedVariant({});
      toast.success(`${rows.length} linhas importadas`);
    } catch (err: any) {
      toast.error("Falha ao importar: " + (err?.message ?? "erro"));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  /* ---------- Export ---------- */
  function exportXlsx() {
    const out: any[] = [];
    products.forEach((p) => {
      p.variants.forEach((v) => {
        out.push({
          Produto: p.base,
          Variação: v.label,
          UMB: p.umb,
          CA: p.ca || "",
          "Estoque inicial": v.estoqueInicial,
          Entradas: v.movements.filter((m) => m.delta > 0).reduce((s, m) => s + m.delta, 0),
          Saídas: v.movements.filter((m) => m.delta < 0).reduce((s, m) => s + -m.delta, 0),
          "Estoque atual": variantBalance(v),
        });
      });
    });
    const ws = XLSX.utils.json_to_sheet(out);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Estoque EPI");
    XLSX.writeFile(wb, `estoque-epi-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Exportado");
  }

  return (
    <div className="container mx-auto px-4 md:px-8 py-6 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Estoque · SESMT
          </div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <HardHat className="h-6 w-6 text-red-700" />
            Painel de EPI's
          </h1>
          <p className="text-sm text-muted-foreground">
            Um produto por linha. Selecione a variação para ver estoque e histórico.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onImportFile} />
          <Button variant="outline" size="sm" onClick={handleImportClick}>
            <Upload className="h-4 w-4 mr-1.5" /> Importar planilha
          </Button>
          <Button variant="outline" size="sm" onClick={resetData}>
            <RotateCcw className="h-4 w-4 mr-1.5" /> Restaurar
          </Button>
          <Button size="sm" onClick={exportXlsx}>
            <Download className="h-4 w-4 mr-1.5" /> Exportar XLSX
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Produtos" value={totals.produtos} />
        <Stat label="Variações (SKU)" value={totals.sku} />
        <Stat label="Estoque total" value={totals.est} tone="bold" />
        <Stat label="Entradas" value={totals.ent} tone="green" />
        <Stat label="Saídas" value={totals.sai} tone="red" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por produto, variação ou CA…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Mês de referência
          </label>
          <Input
            type="month"
            value={refMonth}
            onChange={(e) => setRefMonth(e.target.value || currentMonth())}
            className="h-9 w-[160px]"
          />
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[1200px] text-sm">
            <TableHeader>
              <TableRow className="bg-slate-100 hover:bg-slate-100 border-b-2 border-slate-300">
                <TableHead className="h-9 font-bold text-slate-700 min-w-[340px]">Produto / Variações</TableHead>
                <TableHead className="h-9 font-bold text-slate-700 w-[60px]">UMB</TableHead>
                <TableHead className="h-9 font-bold text-slate-700 w-[90px]">CA</TableHead>
                <TableHead className="h-9 font-bold text-slate-700 text-right w-[90px]">Est. inicial</TableHead>
                <TableHead className="h-9 font-bold text-slate-700 text-right w-[80px]">Entradas</TableHead>
                <TableHead className="h-9 font-bold text-slate-700 text-right w-[80px]">Saídas</TableHead>
                <TableHead className="h-9 font-bold text-slate-700 text-right w-[100px]">Est. final</TableHead>
                <TableHead className="h-9 font-bold text-slate-700 w-[240px]">Movimentar</TableHead>
                <TableHead className="h-9 font-bold text-slate-700 w-[90px] text-center">Histórico</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const v = getVariant(p);
                return (
                  <ProductRow
                    key={p.id}
                    product={p}
                    variant={v}
                    refMonth={refMonth}
                    onPickVariant={(vid) => setSelectedVariant((s) => ({ ...s, [p.id]: vid }))}
                    onMove={(delta, tipo) => addMovement(p.id, v.id, delta, tipo)}
                  />
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    Nenhum produto encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ============================== Row ============================== */
function ProductRow({
  product, variant, refMonth, onPickVariant, onMove,
}: {
  product: Product;
  variant: Variant;
  refMonth: string;
  onPickVariant: (id: string) => void;
  onMove: (delta: number, tipo: Movement["tipo"]) => void;
}) {
  const [qty, setQty] = useState<number>(1);
  const totalProduto = productBalance(product);
  const { start, end } = monthRange(refMonth);
  const period = variantPeriod(variant, start, end);

  return (
    <TableRow className="hover:bg-slate-50/60 border-b border-slate-200">
      <TableCell className="py-2 font-bold align-top">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline gap-2">
            <span>{product.base}</span>
            <span className="text-[10px] text-muted-foreground font-normal">
              Total: {fmt(totalProduto)}
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {product.variants.map((vv) => {
              const sel = vv.id === variant.id;
              const b = variantBalance(vv);
              return (
                <button
                  key={vv.id}
                  type="button"
                  onClick={() => onPickVariant(vv.id)}
                  className={
                    "px-2 py-0.5 rounded-full border text-[11px] font-semibold transition-colors " +
                    (sel
                      ? "bg-red-50 border-red-300 text-red-700"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50")
                  }
                  title={`${vv.label} — saldo ${fmt(b)}`}
                >
                  {vv.label}
                  <span className={"ml-1.5 font-mono " + (b > 0 ? "text-emerald-700" : b < 0 ? "text-red-700" : "text-slate-400")}>
                    {fmt(b)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </TableCell>
      <TableCell className="py-2 text-slate-700">{product.umb}</TableCell>
      <TableCell className="py-2">
        {product.ca ? <Badge variant="outline" className="font-mono">{product.ca}</Badge> : <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell className="py-2 text-right font-mono">{fmt(period.inicial)}</TableCell>
      <TableCell className="py-2 text-right font-mono text-emerald-700">{period.entradas ? `+${fmt(period.entradas)}` : "0"}</TableCell>
      <TableCell className="py-2 text-right font-mono text-red-700">{period.saidas ? `-${fmt(period.saidas)}` : "0"}</TableCell>
      <TableCell className={`py-2 text-right font-black text-base ${period.final > 0 ? "text-emerald-700" : period.final < 0 ? "text-red-700" : "text-slate-400"}`}>
        {fmt(period.final)}
      </TableCell>
      <TableCell className="py-2">
        <div className="flex items-center gap-1">
          <Input
            type="number"
            value={qty}
            min={1}
            onChange={(e) => setQty(Math.max(1, parseInt(e.target.value || "1", 10) || 1))}
            className="h-9 w-20"
          />
          <Button size="sm" variant="outline" className="h-9 border-emerald-300 text-emerald-700 hover:bg-emerald-50" onClick={() => onMove(qty, "ENTRADA")}>
            <ArrowUp className="h-4 w-4 mr-1" /> Entrada
          </Button>
          <Button size="sm" variant="outline" className="h-9 border-red-300 text-red-700 hover:bg-red-50" onClick={() => onMove(-qty, "SAIDA")}>
            <ArrowDown className="h-4 w-4 mr-1" /> Saída
          </Button>
        </div>
      </TableCell>
      <TableCell className="py-2 text-center">
        <HistoryDialog product={product} variant={variant} />
      </TableCell>
    </TableRow>
  );
}

/* ============================== History Dialog ============================== */
function HistoryDialog({ product, variant }: { product: Product; variant: Variant }) {
  const data = useMemo(() => {
    // saldo acumulado por dia
    const byDay = new Map<string, number>();
    let acc = variant.estoqueInicial;
    const sorted = [...variant.movements].sort((a, b) => a.date.localeCompare(b.date));
    if (!sorted.length) {
      const today = new Date().toISOString().slice(0, 10);
      return [{ date: today, saldo: acc }];
    }
    // ponto inicial
    const firstDay = sorted[0].date;
    byDay.set(firstDay, acc);
    for (const m of sorted) {
      acc += m.delta;
      byDay.set(m.date, acc);
    }
    return Array.from(byDay.entries()).map(([date, saldo]) => ({ date, saldo }));
  }, [variant]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <History className="h-4 w-4 mr-1" /> Ver
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {product.base} — <span className="text-muted-foreground font-normal">{variant.label}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="p-2 rounded border bg-slate-50">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Estoque inicial</div>
              <div className="text-xl font-black">{fmt(variant.estoqueInicial)}</div>
            </div>
            <div className="p-2 rounded border bg-emerald-50">
              <div className="text-[10px] uppercase tracking-wide text-emerald-800">Entradas</div>
              <div className="text-xl font-black text-emerald-800">
                {fmt(variant.movements.filter((m) => m.delta > 0).reduce((s, m) => s + m.delta, 0))}
              </div>
            </div>
            <div className="p-2 rounded border bg-red-50">
              <div className="text-[10px] uppercase tracking-wide text-red-800">Saídas</div>
              <div className="text-xl font-black text-red-800">
                {fmt(variant.movements.filter((m) => m.delta < 0).reduce((s, m) => s + -m.delta, 0))}
              </div>
            </div>
          </div>
          <div className="h-64 border rounded p-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Line type="monotone" dataKey="saldo" stroke="#0f766e" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="max-h-60 overflow-y-auto border rounded">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {variant.movements.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-4">Sem movimentações</TableCell></TableRow>
                )}
                {[...variant.movements].reverse().map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>{m.date}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={m.delta > 0 ? "border-emerald-300 text-emerald-700" : "border-red-300 text-red-700"}>
                        {m.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-right font-mono ${m.delta > 0 ? "text-emerald-700" : "text-red-700"}`}>
                      {m.delta > 0 ? "+" : ""}{m.delta}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ============================== Stat ============================== */
function Stat({ label, value, tone }: { label: string; value: number; tone?: "green" | "red" | "bold" }) {
  const cls =
    tone === "green" ? "bg-emerald-50 border-emerald-200 text-emerald-900"
    : tone === "red" ? "bg-red-50 border-red-200 text-red-900"
    : tone === "bold" ? "bg-slate-900 border-slate-900 text-white"
    : "bg-slate-50 border-slate-200 text-slate-800";
  return (
    <Card className={`border ${cls}`}>
      <CardContent className="p-3">
        <div className="text-[10px] font-black uppercase tracking-widest opacity-80">{label}</div>
        <div className="text-xl font-black leading-tight">{value.toLocaleString("pt-BR")}</div>
      </CardContent>
    </Card>
  );
}
