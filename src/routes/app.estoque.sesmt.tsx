import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  HardHat,
  Package,
  AlertTriangle,
  XCircle,
  Plus,
  Minus,
  Search,
  Download,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

type Variant = {
  id: string;
  cor?: string;
  tamanho?: string;
  qtd: number;
};

type EpiProduct = {
  id: string;
  item: string;
  ca?: string;
  unidade: "UN" | "CX";
  minimo: number;
  variantes: Variant[];
};

const SEED: EpiProduct[] = [
  {
    id: "camisa",
    item: "CAMISA",
    unidade: "UN",
    minimo: 5,
    variantes: [
      { id: "v1", cor: "AZUL", tamanho: "P", qtd: 0 },
      { id: "v2", cor: "AZUL", tamanho: "M", qtd: 0 },
      { id: "v3", cor: "AZUL", tamanho: "G", qtd: 0 },
      { id: "v4", cor: "AZUL", tamanho: "GG", qtd: 0 },
      { id: "v5", cor: "CINZA", tamanho: "M", qtd: 0 },
    ],
  },
  {
    id: "calca",
    item: "CALÇA",
    unidade: "UN",
    minimo: 5,
    variantes: [
      { id: "v1", cor: "AZUL", tamanho: "P", qtd: 0 },
      { id: "v2", cor: "AZUL", tamanho: "M", qtd: 0 },
      { id: "v3", cor: "AZUL", tamanho: "GG", qtd: 0 },
      { id: "v4", cor: "AZUL", tamanho: "EG", qtd: 0 },
      { id: "v5", cor: "CINZA", tamanho: "P", qtd: 0 },
      { id: "v6", cor: "CINZA", tamanho: "M", qtd: 0 },
    ],
  },
  {
    id: "macacao",
    item: "MACACÃO",
    ca: "41609",
    unidade: "UN",
    minimo: 3,
    variantes: [
      { id: "v1", cor: "AZUL", tamanho: "P", qtd: 0 },
      { id: "v2", cor: "AZUL", tamanho: "M", qtd: 0 },
      { id: "v3", cor: "AZUL", tamanho: "G", qtd: 0 },
      { id: "v4", cor: "CINZA", tamanho: "P", qtd: 2 },
      { id: "v5", cor: "CINZA", tamanho: "M", qtd: 3 },
    ],
  },
  {
    id: "bota",
    item: "BOTA",
    ca: "43164",
    unidade: "UN",
    minimo: 3,
    variantes: [
      { id: "v1", tamanho: "36", qtd: 0 },
      { id: "v2", tamanho: "37", qtd: 3 },
      { id: "v3", tamanho: "39", qtd: 8 },
      { id: "v4", tamanho: "40", qtd: 0 },
      { id: "v5", tamanho: "41", qtd: 0 },
      { id: "v6", tamanho: "42", qtd: 0 },
      { id: "v7", tamanho: "44", qtd: 0 },
    ],
  },
  {
    id: "bota-pvc",
    item: "BOTA PVC CANO CURTO",
    ca: "37456",
    unidade: "UN",
    minimo: 3,
    variantes: [
      { id: "v1", tamanho: "42", qtd: 0 },
      { id: "v2", tamanho: "44", qtd: 0 },
    ],
  },
  {
    id: "colete",
    item: "COLETE",
    unidade: "UN",
    minimo: 5,
    variantes: [{ id: "v1", cor: "LARANJA", qtd: 8 }],
  },
  {
    id: "capacete",
    item: "CAPACETE",
    unidade: "UN",
    minimo: 3,
    variantes: [
      { id: "v1", cor: "BRANCO", qtd: 2 },
      { id: "v2", cor: "VERDE", qtd: 3 },
      { id: "v3", cor: "VERMELHO", qtd: 7 },
    ],
  },
  {
    id: "carneira",
    item: "CARNEIRA",
    unidade: "UN",
    minimo: 3,
    variantes: [
      { id: "v1", cor: "CINZA", qtd: 8 },
      { id: "v2", cor: "3M", qtd: 0 },
      { id: "v3", cor: "MSA", qtd: 0 },
    ],
  },
  {
    id: "viseira",
    item: "VISEIRA",
    unidade: "UN",
    minimo: 10,
    variantes: [{ id: "v1", qtd: 56 }],
  },
  {
    id: "balaclava",
    item: "BALACLAVA",
    unidade: "UN",
    minimo: 5,
    variantes: [
      { id: "v1", cor: "PRETA", qtd: 15 },
      { id: "v2", cor: "BRANCA", qtd: 0 },
    ],
  },
  {
    id: "respirador-semifacial",
    item: "RESPIRADOR SEMIFACIAL",
    unidade: "UN",
    minimo: 5,
    variantes: [{ id: "v1", qtd: 15 }],
  },
  {
    id: "retentor-filtro",
    item: "RETENTOR PARA FILTRO",
    unidade: "CX",
    minimo: 2,
    variantes: [{ id: "v1", qtd: 5 }],
  },
  {
    id: "filtro-particula",
    item: "FILTRO PARA PARTÍCULA",
    unidade: "UN",
    minimo: 5,
    variantes: [{ id: "v1", qtd: 14 }],
  },
  {
    id: "cartucho-vapores",
    item: "CARTUCHO PARA VAPORES",
    unidade: "UN",
    minimo: 5,
    variantes: [{ id: "v1", qtd: 20 }],
  },
  {
    id: "filtro-particula-3m",
    item: "FILTRO PARA PARTÍCULA 3M",
    unidade: "CX",
    minimo: 5,
    variantes: [{ id: "v1", qtd: 20 }],
  },
  {
    id: "respirador-descartavel",
    item: "RESPIRADOR DESCARTÁVEL",
    ca: "44594",
    unidade: "UN",
    minimo: 10,
    variantes: [{ id: "v1", qtd: 43 }],
  },
  {
    id: "oculos",
    item: "ÓCULOS",
    unidade: "UN",
    minimo: 5,
    variantes: [
      { id: "v1", cor: "JAGUAR TRANSPARENTE", qtd: 25 },
      { id: "v2", cor: "PRETO", qtd: 19 },
      { id: "v3", cor: "AMARELO", qtd: 12 },
    ],
  },
  {
    id: "luva-vaqueta",
    item: "LUVA VAQUETA",
    ca: "253961",
    unidade: "UN",
    minimo: 20,
    variantes: [
      { id: "v1", cor: "PUNHO LONGO", qtd: 192 },
      { id: "v2", cor: "PUNHO CURTO", qtd: 125 },
    ],
  },
  {
    id: "luva-raspa",
    item: "LUVA DE RASPA",
    unidade: "UN",
    minimo: 20,
    variantes: [
      { id: "v1", cor: "VOLK", qtd: 157 },
      { id: "v2", cor: "DMN", qtd: 0 },
    ],
  },
  {
    id: "luva-branca",
    item: "LUVA BRANCA / ALGODÃO",
    ca: "30521",
    unidade: "UN",
    minimo: 20,
    variantes: [{ id: "v1", qtd: 118 }],
  },
  {
    id: "macacao-seguranca",
    item: "MACACÃO DE SEGURANÇA",
    ca: "36783",
    unidade: "UN",
    minimo: 3,
    variantes: [{ id: "v1", qtd: 0 }],
  },
  {
    id: "avental-solda",
    item: "AVENTAL DE SOLDA",
    ca: "38716",
    unidade: "UN",
    minimo: 5,
    variantes: [{ id: "v1", qtd: 40 }],
  },
  {
    id: "perneira-raspa",
    item: "PERNEIRA DE RASPA",
    unidade: "UN",
    minimo: 5,
    variantes: [{ id: "v1", qtd: 58 }],
  },
  {
    id: "luva-preta",
    item: "LUVA PRETA",
    unidade: "UN",
    minimo: 20,
    variantes: [{ id: "v1", qtd: 202 }],
  },
  {
    id: "protetor-solar",
    item: "PROTETOR SOLAR",
    ca: "4114",
    unidade: "UN",
    minimo: 3,
    variantes: [{ id: "v1", qtd: 6 }],
  },
  {
    id: "lente-protecao",
    item: "LENTE DE PROTEÇÃO",
    unidade: "UN",
    minimo: 30,
    variantes: [
      { id: "v1", cor: "ESCURA", qtd: 347 },
      { id: "v2", cor: "TRANSPARENTE", qtd: 461 },
    ],
  },
  {
    id: "talabarte",
    item: "TALABARTE",
    ca: "35531",
    unidade: "UN",
    minimo: 2,
    variantes: [{ id: "v1", qtd: 4 }],
  },
  {
    id: "protetor-auricular",
    item: "PROTETOR AURICULAR",
    ca: "5745",
    unidade: "UN",
    minimo: 20,
    variantes: [{ id: "v1", qtd: 168 }],
  },
  {
    id: "jugular",
    item: "JUGULAR",
    unidade: "UN",
    minimo: 3,
    variantes: [
      { id: "v1", cor: "MSA", qtd: 0 },
      { id: "v2", cor: "3M", qtd: 12 },
    ],
  },
  {
    id: "mangote-raspa",
    item: "MANGOTE RASPA",
    ca: "39273",
    unidade: "UN",
    minimo: 10,
    variantes: [{ id: "v1", qtd: 98 }],
  },
];

const STORAGE_KEY = "estoque-epi-sesmt-v2";

export const Route = createFileRoute("/app/estoque/sesmt")({
  component: EstoqueSesmtPage,
});

function EstoqueSesmtPage() {
  const [products, setProducts] = useState<EpiProduct[]>(() => SEED);
  const [query, setQuery] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as EpiProduct[];
        if (Array.isArray(parsed) && parsed.length) setProducts(parsed);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
    } catch {}
  }, [products]);

  const totals = useMemo(() => {
    const totalProdutos = products.length;
    const totalVariantes = products.reduce((a, p) => a + p.variantes.length, 0);
    const totalUnidades = products.reduce(
      (a, p) => a + p.variantes.reduce((b, v) => b + v.qtd, 0),
      0,
    );
    let semEstoque = 0;
    let baixo = 0;
    products.forEach((p) => {
      p.variantes.forEach((v) => {
        if (v.qtd === 0) semEstoque++;
        else if (v.qtd <= p.minimo) baixo++;
      });
    });
    return { totalProdutos, totalVariantes, totalUnidades, semEstoque, baixo };
  }, [products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.item.toLowerCase().includes(q) ||
        (p.ca || "").toLowerCase().includes(q) ||
        p.variantes.some(
          (v) =>
            (v.cor || "").toLowerCase().includes(q) ||
            (v.tamanho || "").toLowerCase().includes(q),
        ),
    );
  }, [products, query]);

  function updateVariant(productId: string, variantId: string, patch: Partial<Variant>) {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId
          ? {
              ...p,
              variantes: p.variantes.map((v) =>
                v.id === variantId ? { ...v, ...patch } : v,
              ),
            }
          : p,
      ),
    );
  }

  function adjustVariant(productId: string, variantId: string, delta: number) {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId
          ? {
              ...p,
              variantes: p.variantes.map((v) =>
                v.id === variantId
                  ? { ...v, qtd: Math.max(0, v.qtd + delta) }
                  : v,
              ),
            }
          : p,
      ),
    );
  }

  function addVariant(productId: string) {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId
          ? {
              ...p,
              variantes: [
                ...p.variantes,
                {
                  id: `v${Date.now()}`,
                  cor: "",
                  tamanho: "",
                  qtd: 0,
                },
              ],
            }
          : p,
      ),
    );
  }

  function removeVariant(productId: string, variantId: string) {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId
          ? { ...p, variantes: p.variantes.filter((v) => v.id !== variantId) }
          : p,
      ),
    );
  }

  function updateProduct(productId: string, patch: Partial<EpiProduct>) {
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, ...patch } : p)),
    );
  }

  function exportCsv() {
    const header = ["Produto", "CA", "Cor", "Tamanho", "Quantidade", "Unidade", "Mínimo", "Status"];
    const rows: string[][] = [];
    products.forEach((p) => {
      p.variantes.forEach((v) => {
        rows.push([
          p.item,
          p.ca || "",
          v.cor || "",
          v.tamanho || "",
          String(v.qtd),
          p.unidade,
          String(p.minimo),
          statusFor(v.qtd, p.minimo),
        ]);
      });
    });
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `estoque-epi-sesmt-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Estoque exportado");
  }

  function resetData() {
    if (!confirm("Restaurar estoque para os valores originais?")) return;
    setProducts(SEED);
    toast.success("Estoque restaurado");
  }

  return (
    <div className="container mx-auto px-4 md:px-8 py-6 space-y-6">
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
            Controle de Equipamentos de Proteção Individual agrupados por produto e variação.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={resetData}>
            <RotateCcw className="h-4 w-4 mr-1.5" /> Restaurar
          </Button>
          <Button size="sm" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-1.5" /> Exportar CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard icon={Package} label="Produtos" value={totals.totalProdutos} tone="slate" />
        <SummaryCard icon={Package} label="Variações" value={totals.totalVariantes} tone="slate" />
        <SummaryCard icon={Package} label="Unidades" value={totals.totalUnidades} tone="blue" />
        <SummaryCard icon={AlertTriangle} label="Baixo estoque" value={totals.baixo} tone="amber" />
        <SummaryCard icon={XCircle} label="Sem estoque" value={totals.semEstoque} tone="red" />
      </div>

      <div className="relative max-w-md">
        <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por produto, CA, cor ou tamanho…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-8"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map((p) => {
          const totalQtd = p.variantes.reduce((a, v) => a + v.qtd, 0);
          const hasCor = p.variantes.some((v) => v.cor);
          const hasTam = p.variantes.some((v) => v.tamanho);
          return (
            <Card key={p.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-base font-black uppercase tracking-tight">
                      {p.item}
                    </CardTitle>
                    <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>
                        CA:{" "}
                        <input
                          value={p.ca || ""}
                          onChange={(e) => updateProduct(p.id, { ca: e.target.value })}
                          placeholder="—"
                          className="bg-transparent outline-none border-b border-dashed border-muted-foreground/30 focus:border-foreground w-20 text-foreground"
                        />
                      </span>
                      <span>Un.: {p.unidade}</span>
                      <span>
                        Mínimo:{" "}
                        <input
                          value={p.minimo}
                          onChange={(e) =>
                            updateProduct(p.id, {
                              minimo: Math.max(0, parseInt(e.target.value || "0", 10) || 0),
                            })
                          }
                          inputMode="numeric"
                          className="bg-transparent outline-none border-b border-dashed border-muted-foreground/30 focus:border-foreground w-10 text-foreground text-center"
                        />
                      </span>
                    </div>
                  </div>
                  <Badge variant="secondary" className="font-black">
                    {totalQtd} {p.unidade}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {hasCor && <TableHead className="h-8">Variação</TableHead>}
                      {hasTam && <TableHead className="h-8">Tamanho</TableHead>}
                      <TableHead className="h-8 text-center">Qtd.</TableHead>
                      <TableHead className="h-8">Status</TableHead>
                      <TableHead className="h-8 w-8"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {p.variantes.map((v) => {
                      const status = statusFor(v.qtd, p.minimo);
                      return (
                        <TableRow key={v.id}>
                          {hasCor && (
                            <TableCell className="py-1.5">
                              <Input
                                value={v.cor || ""}
                                onChange={(e) =>
                                  updateVariant(p.id, v.id, { cor: e.target.value })
                                }
                                placeholder="—"
                                className="h-7 text-xs uppercase font-semibold"
                              />
                            </TableCell>
                          )}
                          {hasTam && (
                            <TableCell className="py-1.5">
                              <Input
                                value={v.tamanho || ""}
                                onChange={(e) =>
                                  updateVariant(p.id, v.id, { tamanho: e.target.value })
                                }
                                placeholder="—"
                                className="h-7 text-xs uppercase text-center w-14"
                              />
                            </TableCell>
                          )}
                          <TableCell className="py-1.5">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => adjustVariant(p.id, v.id, -1)}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <Input
                                value={v.qtd}
                                onChange={(e) =>
                                  updateVariant(p.id, v.id, {
                                    qtd: Math.max(0, parseInt(e.target.value || "0", 10) || 0),
                                  })
                                }
                                inputMode="numeric"
                                className="h-7 w-14 text-center text-sm"
                              />
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => adjustVariant(p.id, v.id, 1)}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="py-1.5">
                            <StatusBadge status={status} />
                          </TableCell>
                          <TableCell className="py-1.5">
                            {p.variantes.length > 1 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-red-700"
                                onClick={() => removeVariant(p.id, v.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <div className="mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => addVariant(p.id)}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Adicionar variação
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-full text-center text-muted-foreground py-10">
            Nenhum produto encontrado.
          </div>
        )}
      </div>
    </div>
  );
}

function statusFor(qtd: number, minimo: number): "Sem estoque" | "Baixo" | "OK" {
  if (qtd === 0) return "Sem estoque";
  if (qtd <= minimo) return "Baixo";
  return "OK";
}

function StatusBadge({ status }: { status: "Sem estoque" | "Baixo" | "OK" }) {
  if (status === "Sem estoque")
    return <Badge className="bg-red-100 text-red-800 border border-red-200">Sem estoque</Badge>;
  if (status === "Baixo")
    return <Badge className="bg-amber-100 text-amber-800 border border-amber-200">Baixo</Badge>;
  return <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200">OK</Badge>;
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: "slate" | "blue" | "amber" | "red";
}) {
  const toneCls = {
    slate: "bg-slate-50 text-slate-700 border-slate-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
  }[tone];
  return (
    <Card className={`border ${toneCls}`}>
      <CardContent className="p-3 flex items-center gap-3">
        <div className="h-9 w-9 rounded-md bg-white/70 flex items-center justify-center">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest opacity-80">{label}</div>
          <div className="text-xl font-black leading-tight">{value.toLocaleString("pt-BR")}</div>
        </div>
      </CardContent>
    </Card>
  );
}