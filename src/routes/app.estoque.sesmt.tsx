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
  Search, Download, Upload, RotateCcw, Plus, History,
  ArrowUp, ArrowDown, Trash2, X, ExternalLink,
} from "lucide-react";
import protectiveClothingIcon from "@/assets/protective-clothing.png";
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

const STORAGE_KEY = "estoque-epi-sesmt-v5";

export const Route = createFileRoute("/app/estoque/sesmt")({
  component: EstoqueSesmtPage,
});

/* ============================== Seed ============================== */
const RAW_SEED: Array<{ descricao: string; umb: Product["umb"]; estoque: number; ca?: string }> = [
  { descricao: "CAMISA TAM. P", umb: "UN", estoque: 0 },
  { descricao: "CAMISA TAM. M", umb: "UN", estoque: 0 },
  { descricao: "CAMISA TAM. G", umb: "UN", estoque: 0 },
  { descricao: "CAMISA TAM. GG", umb: "UN", estoque: 0 },
  { descricao: "CALÇA TAM. P", umb: "UN", estoque: 0 },
  { descricao: "CALÇA TAM. M", umb: "UN", estoque: 0 },
  { descricao: "CALÇA TAM. GG", umb: "UN", estoque: 0 },
  { descricao: "CALÇA TAM. EG", umb: "UN", estoque: 0 },
  { descricao: "MACACÃO TAM. P", umb: "UN", estoque: 2, ca: "41609" },
  { descricao: "MACACÃO TAM. M", umb: "UN", estoque: 3, ca: "41609" },
  { descricao: "MACACÃO TAM. G", umb: "UN", estoque: 0, ca: "41609" },
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
  const estoqueInicial = Number(v.estoqueInicial) || 0;
  const movements = Array.isArray(v.movements) ? v.movements : [];
  return estoqueInicial + movements.reduce((s, m) => s + (Number(m.delta) || 0), 0);
}
function productBalance(p: Product): number {
  const variants = Array.isArray(p.variants) ? p.variants : [];
  return variants.reduce((s, v) => s + variantBalance(v), 0);
}
function fmt(n: number) {
  return n.toLocaleString("pt-BR");
}

function normalizeStoredProducts(value: unknown): Product[] | null {
  if (!Array.isArray(value)) return null;
  const normalized = value
    .filter((p): p is Product => !!p && typeof p === "object" && typeof (p as Product).base === "string")
    .map((p) => ({
      ...p,
      id: typeof p.id === "string" ? p.id : `p-${crypto.randomUUID?.() ?? Date.now()}`,
      umb: p.umb || "UN",
      variants: (Array.isArray(p.variants) ? p.variants : []).map((v, i) => ({
        ...v,
        id: typeof v.id === "string" ? v.id : `${p.id || "p"}-v${i + 1}`,
        label: typeof v.label === "string" ? v.label : "PADRÃO",
        estoqueInicial: Number(v.estoqueInicial) || 0,
        movements: Array.isArray(v.movements) ? v.movements : [],
      })),
    }))
    .filter((p) => p.variants.length > 0);
  return normalized.length ? normalized : null;
}

/** Calcula estoque inicial / entradas / saídas / final de uma variante em um intervalo [startISO, endISO]. */
function variantPeriod(v: Variant, startISO: string, endISO: string) {
  let inicial = v.estoqueInicial;
  let entradas = 0;
  let saidas = 0;
  for (const m of Array.isArray(v.movements) ? v.movements : []) {
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
  const [refMonth, setRefMonth] = useState<string>(() => currentMonth());
  const fileRef = useRef<HTMLInputElement>(null);

  // hydrate
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = normalizeStoredProducts(JSON.parse(raw));
        if (parsed) setProducts(parsed);
      }
    } catch {}
  }, []);
  // Reagir a atualizações vindas da tela de entrega de EPI
  useEffect(() => {
    function reload() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = normalizeStoredProducts(JSON.parse(raw));
        if (parsed) setProducts(parsed);
      } catch {}
    }
    window.addEventListener("estoque-sesmt-updated", reload);
    window.addEventListener("storage", (e) => { if (e.key === STORAGE_KEY) reload(); });
    return () => {
      window.removeEventListener("estoque-sesmt-updated", reload);
    };
  }, []);
  // persist
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(products)); } catch {}
  }, [products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows: Array<{ product: Product; variant: Variant }> = [];
    products.forEach((p) => {
      const variants = Array.isArray(p.variants) ? p.variants : [];
      variants.forEach((v) => {
        const fullName = `${p.base} ${v.label}`.toLowerCase();
        if (
          !q ||
          fullName.includes(q) ||
          (p.ca || "").toLowerCase().includes(q)
        ) {
          rows.push({ product: p, variant: v });
        }
      });
    });
    return rows;
  }, [products, query]);

  const totals = useMemo(() => {
    let totalSku = 0, totalEst = 0, totalEnt = 0, totalSai = 0;
    products.forEach((p) => {
      const variants = Array.isArray(p.variants) ? p.variants : [];
      totalSku += variants.length;
      variants.forEach((v) => {
        totalEst += variantBalance(v);
        const movements = Array.isArray(v.movements) ? v.movements : [];
        movements.forEach((m) => {
          if (m.delta > 0) totalEnt += m.delta;
          else totalSai += -m.delta;
        });
      });
    });
    return { produtos: products.length, sku: totalSku, est: totalEst, ent: totalEnt, sai: totalSai };
  }, [products]);

  function addMovement(productId: string, variantId: string, delta: number, tipo: Movement["tipo"]) {
    if (!delta) return;
    setProducts((prev) => prev.map((p) => {
      if (p.id !== productId) return p;
      const variants = Array.isArray(p.variants) ? p.variants : [];
      return {
        ...p,
        variants: variants.map((v) => v.id !== variantId ? v : {
          ...v,
          movements: [...(Array.isArray(v.movements) ? v.movements : []), {
            id: `m-${Date.now()}`,
            date: new Date().toISOString().slice(0, 10),
            delta, tipo,
          }],
        }),
      };
    }));
    toast.success(`${tipo === "ENTRADA" ? "+" : ""}${delta} registrado`);
  }

  /** Aplica várias movimentações (uma por variação) de uma vez. */
  function bulkMove(
    productId: string,
    tipo: "ENTRADA" | "SAIDA",
    date: string,
    entries: Array<{ variantId: string; qty: number }>,
  ) {
    const valid = entries.filter((e) => e.qty > 0);
    if (!valid.length) { toast.error("Informe ao menos uma quantidade"); return; }
    setProducts((prev) => prev.map((p) => {
      if (p.id !== productId) return p;
      const variants = Array.isArray(p.variants) ? p.variants : [];
      return {
        ...p,
        variants: variants.map((v) => {
          const e = valid.find((x) => x.variantId === v.id);
          if (!e) return v;
          const delta = tipo === "ENTRADA" ? e.qty : -e.qty;
          return {
            ...v,
            movements: [...(Array.isArray(v.movements) ? v.movements : []), {
              id: `m-${Date.now()}-${v.id}`,
              date,
              delta,
              tipo,
            }],
          };
        }),
      };
    }));
    const total = valid.reduce((s, e) => s + e.qty, 0);
    toast.success(`${tipo === "ENTRADA" ? "Entrada" : "Saída"} de ${total} unidade(s) registrada`);
  }

  function resetData() {
    if (!confirm("Restaurar painel para os valores iniciais? Movimentações serão perdidas.")) return;
    setProducts(buildSeed());
    toast.success("Painel restaurado");
  }

  /* ---------- Cadastro de novo produto ---------- */
  function addProduct(input: {
    base: string;
    umb: Product["umb"];
    ca?: string;
    variants: Array<{ label: string; estoqueInicial: number }>;
  }) {
    const id = `p-${Date.now()}`;
    const novo: Product = {
      id,
      base: input.base.trim().toUpperCase(),
      umb: input.umb,
      ca: input.ca?.trim() || undefined,
      variants: input.variants.map((v, i) => ({
        id: `${id}-v${i + 1}`,
        label: v.label.trim().toUpperCase() || "PADRÃO",
        estoqueInicial: Number(v.estoqueInicial) || 0,
        movements: [],
      })),
    };
    setProducts((prev) => [novo, ...prev]);
    toast.success(`Produto "${novo.base}" cadastrado`);
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
      const variants = Array.isArray(p.variants) ? p.variants : [];
      variants.forEach((v) => {
        const movements = Array.isArray(v.movements) ? v.movements : [];
        out.push({
          Produto: p.base,
          Variação: v.label,
          UMB: p.umb,
          CA: p.ca || "",
          "Estoque inicial": v.estoqueInicial,
          Entradas: movements.filter((m) => m.delta > 0).reduce((s, m) => s + m.delta, 0),
          Saídas: movements.filter((m) => m.delta < 0).reduce((s, m) => s + -m.delta, 0),
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
            <img src={protectiveClothingIcon} alt="" className="h-6 w-6" />
            PAINEL DE ESTOQUE SESMT
          </h1>
          <p className="text-sm text-muted-foreground">
            Uma linha por item — cada variação (tamanho, cor, modelo) ocupa sua própria linha.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onImportFile} />
          <NewProductDialog onCreate={addProduct} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open("https://consultaca.com", "_blank", "noopener,noreferrer")}
          >
            <ExternalLink className="h-4 w-4 mr-1.5" /> Consultar CA
          </Button>
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
          <MonthPicker value={refMonth} onChange={setRefMonth} />
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[1200px] text-sm">
            <TableHeader>
              <TableRow className="bg-slate-100 hover:bg-slate-100 border-b-2 border-slate-300">
                <TableHead className="h-9 font-bold text-slate-700 min-w-[340px]">Produto</TableHead>
                <TableHead className="h-9 font-bold text-slate-700 w-[60px]">UMB</TableHead>
                <TableHead className="h-9 font-bold text-slate-700 w-[90px]">CA</TableHead>
                <TableHead className="h-9 font-bold text-slate-700 text-right w-[90px]">Est. inicial</TableHead>
                <TableHead className="h-9 font-bold text-slate-700 text-right w-[80px]">Entradas</TableHead>
                <TableHead className="h-9 font-bold text-slate-700 text-right w-[80px]">Saídas</TableHead>
                <TableHead className="h-9 font-bold text-slate-700 text-right w-[100px]">Est. final</TableHead>
                <TableHead className="h-9 font-bold text-slate-700 w-[120px]">Movimentar</TableHead>
                <TableHead className="h-9 font-bold text-slate-700 w-[90px] text-center">Histórico</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(({ product, variant }) => (
                <VariantRow
                  key={`${product.id}:${variant.id}`}
                  product={product}
                  variant={variant}
                  refMonth={refMonth}
                  onMove={(tipo, date, qty) =>
                    bulkMove(product.id, tipo, date, [{ variantId: variant.id, qty }])
                  }
                />
              ))}
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
function VariantRow({
  product, variant, refMonth, onMove,
}: {
  product: Product;
  variant: Variant;
  refMonth: string;
  onMove: (tipo: "ENTRADA" | "SAIDA", date: string, qty: number) => void;
}) {
  const { start, end } = monthRange(refMonth);
  const period = variantPeriod(variant, start, end);
  const fullName = variant.label === "PADRÃO"
    ? product.base
    : `${product.base} ${variant.label}`;

  return (
    <TableRow className="hover:bg-slate-50/60 border-b border-slate-200">
      <TableCell className="py-2 font-semibold align-middle">{fullName}</TableCell>
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
          <SingleMoveDialog label={fullName} tipo="ENTRADA" onConfirm={(date, qty) => onMove("ENTRADA", date, qty)} />
          <SingleMoveDialog label={fullName} tipo="SAIDA" onConfirm={(date, qty) => onMove("SAIDA", date, qty)} />
        </div>
      </TableCell>
      <TableCell className="py-2 text-center">
        <HistoryDialog product={product} variant={variant} />
      </TableCell>
    </TableRow>
  );
}

/* ============================== Single-variant move dialog ============================== */
function SingleMoveDialog({
  label, tipo, onConfirm,
}: {
  label: string;
  tipo: "ENTRADA" | "SAIDA";
  onConfirm: (date: string, qty: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [qty, setQty] = useState<number>(0);
  const isEntrada = tipo === "ENTRADA";

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setQty(0); setDate(new Date().toISOString().slice(0, 10)); } }}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className={"h-8 px-2 " + (isEntrada
            ? "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            : "border-red-300 text-red-700 hover:bg-red-50")}
        >
          {isEntrada ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEntrada ? "Entrada" : "Saída"} — {label}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground w-16">Data</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 flex-1" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground w-16">Qtd</label>
            <Input type="number" min={0} value={qty || ""} placeholder="0"
              onChange={(e) => { const n = parseInt(e.target.value || "0", 10); setQty(isNaN(n) || n < 0 ? 0 : n); }}
              className="h-9 flex-1 text-right font-mono" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              size="sm"
              className={isEntrada ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}
              onClick={() => {
                if (qty <= 0) { toast.error("Informe a quantidade"); return; }
                onConfirm(date, qty);
                setOpen(false);
                setQty(0);
              }}
            >
              Confirmar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ============================== History Dialog ============================== */
function HistoryDialog({ product, variant }: { product: Product; variant: Variant }) {
  const movements = Array.isArray(variant.movements) ? variant.movements : [];
  const data = useMemo(() => {
    // saldo acumulado por dia
    const byDay = new Map<string, number>();
    let acc = Number(variant.estoqueInicial) || 0;
    const sorted = [...movements].sort((a, b) => a.date.localeCompare(b.date));
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
  }, [movements, variant.estoqueInicial]);

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
                {fmt(movements.filter((m) => m.delta > 0).reduce((s, m) => s + m.delta, 0))}
              </div>
            </div>
            <div className="p-2 rounded border bg-red-50">
              <div className="text-[10px] uppercase tracking-wide text-red-800">Saídas</div>
              <div className="text-xl font-black text-red-800">
                {fmt(movements.filter((m) => m.delta < 0).reduce((s, m) => s + -m.delta, 0))}
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
                {movements.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-4">Sem movimentações</TableCell></TableRow>
                )}
                {[...movements].reverse().map((m) => (
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

/* ============================== Novo Produto Dialog ============================== */
const SUGESTOES: Record<string, string[]> = {
  Tamanhos: ["P", "M", "G", "GG", "EG"],
  Numeração: ["36", "37", "38", "39", "40", "41", "42", "43", "44"],
  Cores: ["AZUL", "CINZA", "PRETO", "BRANCO", "VERDE", "VERMELHO", "LARANJA", "AMARELO"],
  Genérico: ["PADRÃO"],
};
const UMBS: Product["umb"][] = ["UN", "CX", "PC", "KG", "M", "GAL"];

function NewProductDialog({
  onCreate,
}: {
  onCreate: (input: {
    base: string;
    umb: Product["umb"];
    ca?: string;
    variants: Array<{ label: string; estoqueInicial: number }>;
  }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [base, setBase] = useState("");
  const [umb, setUmb] = useState<Product["umb"]>("UN");
  const [ca, setCa] = useState("");
  const [variants, setVariants] = useState<Array<{ label: string; estoqueInicial: number }>>([
    { label: "PADRÃO", estoqueInicial: 0 },
  ]);

  function reset() {
    setBase(""); setUmb("UN"); setCa("");
    setVariants([{ label: "PADRÃO", estoqueInicial: 0 }]);
  }

  function addVariant(label = "") {
    setVariants((prev) => [...prev, { label, estoqueInicial: 0 }]);
  }
  function addManyVariants(labels: string[]) {
    setVariants((prev) => {
      // remove placeholder vazio "PADRÃO" se ainda for o único e não houver nada digitado
      const seed = prev.length === 1 && prev[0].label === "PADRÃO" && !prev[0].estoqueInicial ? [] : prev;
      const existing = new Set(seed.map((v) => v.label.toUpperCase()));
      const novos = labels
        .filter((l) => !existing.has(l.toUpperCase()))
        .map((l) => ({ label: l, estoqueInicial: 0 }));
      return [...seed, ...novos];
    });
  }
  function updateVariant(i: number, patch: Partial<{ label: string; estoqueInicial: number }>) {
    setVariants((prev) => prev.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  }
  function removeVariant(i: number) {
    setVariants((prev) => prev.filter((_, idx) => idx !== i));
  }

  function submit() {
    if (!base.trim()) { toast.error("Informe o nome do produto"); return; }
    const cleaned = variants.filter((v) => v.label.trim());
    if (!cleaned.length) { toast.error("Adicione ao menos uma variação"); return; }
    onCreate({ base, umb, ca: ca || undefined, variants: cleaned });
    setOpen(false);
    reset();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-red-700 hover:bg-red-800">
          <Plus className="h-4 w-4 mr-1.5" /> Novo produto
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cadastrar novo produto</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_140px] gap-3">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Nome do produto</label>
              <Input
                value={base}
                onChange={(e) => setBase(e.target.value.toUpperCase())}
                placeholder="Ex.: CAMISA, BOTA, CAPACETE"
                className="h-9"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">UMB</label>
              <Select value={umb} onValueChange={(v) => setUmb(v as Product["umb"])}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UMBS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">CA (opcional)</label>
              <Input
                value={ca}
                onChange={(e) => setCa(e.target.value.replace(/\D/g, ""))}
                placeholder="Ex.: 41609"
                className="h-9 font-mono"
              />
            </div>
          </div>

          <div className="rounded border bg-slate-50/40 p-3 space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              Sugestões rápidas — clique para adicionar variações
            </div>
            <div className="space-y-1.5">
              {Object.entries(SUGESTOES).map(([grupo, opts]) => (
                <div key={grupo} className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-semibold text-slate-500 w-20">{grupo}:</span>
                  {opts.map((o) => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => addManyVariants([grupo === "Tamanhos" || grupo === "Numeração" ? `TAM. ${o}` : o])}
                      className="px-2 py-0.5 rounded-full border border-slate-200 bg-white text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
                    >
                      {o}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => addManyVariants(opts.map((o) => grupo === "Tamanhos" || grupo === "Numeração" ? `TAM. ${o}` : o))}
                    className="px-2 py-0.5 rounded-full border border-red-200 bg-red-50 text-[11px] font-bold text-red-700 hover:bg-red-100"
                  >
                    + todos
                  </button>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Não achou a característica? Use o campo livre abaixo para criar qualquer variação (cor + tamanho, modelo, marca, etc.).
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Variações do produto
              </div>
              <Button size="sm" variant="outline" onClick={() => addVariant("")}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar variação
              </Button>
            </div>
            <div className="rounded border divide-y">
              <div className="grid grid-cols-[1fr_140px_40px] gap-2 px-3 py-2 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                <div>Característica / Variação</div>
                <div className="text-right">Estoque inicial</div>
                <div></div>
              </div>
              {variants.length === 0 && (
                <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                  Nenhuma variação. Use as sugestões acima ou adicione manualmente.
                </div>
              )}
              {variants.map((v, i) => (
                <div key={i} className="grid grid-cols-[1fr_140px_40px] gap-2 px-3 py-2 items-center">
                  <Input
                    value={v.label}
                    onChange={(e) => updateVariant(i, { label: e.target.value.toUpperCase() })}
                    placeholder="Ex.: AZUL TAM. P, MODELO X, MARCA 3M…"
                    className="h-9"
                  />
                  <Input
                    type="number"
                    min={0}
                    value={v.estoqueInicial}
                    onChange={(e) => updateVariant(i, { estoqueInicial: parseInt(e.target.value || "0", 10) || 0 })}
                    className="h-9 text-right font-mono"
                  />
                  <Button variant="ghost" size="icon" onClick={() => removeVariant(i)} className="h-8 w-8">
                    <X className="h-4 w-4 text-slate-500" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button size="sm" className="bg-red-700 hover:bg-red-800" onClick={submit}>
              Cadastrar produto
            </Button>
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

/* ============================== Month Picker ============================== */
const MESES_PT = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];
function MonthPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [yStr, mStr] = value.split("-");
  const year = Number(yStr) || new Date().getFullYear();
  const month = Number(mStr) || new Date().getMonth() + 1;
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 8 }, (_, i) => thisYear - 5 + i);
  return (
    <div className="flex items-center gap-1">
      <Select value={String(month)} onValueChange={(m) => onChange(`${year}-${String(Number(m)).padStart(2, "0")}`)}>
        <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          {MESES_PT.map((nm, i) => (
            <SelectItem key={i + 1} value={String(i + 1)}>{nm}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={String(year)} onValueChange={(y) => onChange(`${y}-${String(month).padStart(2, "0")}`)}>
        <SelectTrigger className="h-9 w-[100px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

/* ============================== Movement Dialog (multi-variação) ============================== */
function MovementDialog({
  product, tipo, onConfirm,
}: {
  product: Product;
  tipo: "ENTRADA" | "SAIDA";
  onConfirm: (date: string, entries: Array<{ variantId: string; qty: number }>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [qtys, setQtys] = useState<Record<string, number>>({});

  function reset() {
    setQtys({});
    setDate(new Date().toISOString().slice(0, 10));
  }

  const total = Object.values(qtys).reduce((s, n) => s + (n || 0), 0);
  const isEntrada = tipo === "ENTRADA";

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className={
            "h-9 " +
            (isEntrada
              ? "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              : "border-red-300 text-red-700 hover:bg-red-50")
          }
        >
          {isEntrada ? <ArrowUp className="h-4 w-4 mr-1" /> : <ArrowDown className="h-4 w-4 mr-1" />}
          {isEntrada ? "Entrada" : "Saída"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEntrada ? "Entrada" : "Saída"} — {product.base}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Data
            </label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 w-[180px]"
            />
          </div>
          <div className="rounded border divide-y">
            <div className="grid grid-cols-[1fr_auto_120px] gap-3 px-3 py-2 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-600">
              <div>Variação</div>
              <div className="text-right">Saldo atual</div>
              <div className="text-right">Quantidade</div>
            </div>
            {product.variants.map((v) => {
              const bal = variantBalance(v);
              return (
                <div key={v.id} className="grid grid-cols-[1fr_auto_120px] gap-3 px-3 py-2 items-center">
                  <div className="text-sm font-semibold">{v.label}</div>
                  <div className={"text-right font-mono text-sm " + (bal > 0 ? "text-emerald-700" : bal < 0 ? "text-red-700" : "text-slate-400")}>
                    {fmt(bal)}
                  </div>
                  <Input
                    type="number"
                    min={0}
                    value={qtys[v.id] ?? ""}
                    placeholder="0"
                    onChange={(e) => {
                      const n = parseInt(e.target.value || "0", 10);
                      setQtys((s) => ({ ...s, [v.id]: isNaN(n) || n < 0 ? 0 : n }));
                    }}
                    className="h-9 text-right"
                  />
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between pt-1">
            <div className="text-sm">
              Total: <span className="font-black">{fmt(total)}</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button
                size="sm"
                className={isEntrada ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}
                onClick={() => {
                  const entries = Object.entries(qtys)
                    .map(([variantId, qty]) => ({ variantId, qty: qty || 0 }))
                    .filter((e) => e.qty > 0);
                  if (!entries.length) { toast.error("Informe ao menos uma quantidade"); return; }
                  onConfirm(date, entries);
                  setOpen(false);
                  reset();
                }}
              >
                Confirmar {isEntrada ? "entrada" : "saída"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
