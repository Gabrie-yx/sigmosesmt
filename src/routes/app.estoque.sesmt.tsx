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
import { HardHat, Package, AlertTriangle, XCircle, Plus, Minus, Search, Download, RotateCcw } from "lucide-react";
import { toast } from "sonner";

type EpiItem = {
  id: string;
  item: string;
  ca: string;
  tamanho: string;
  qtd: number;
  unidade: "UN" | "CX";
  minimo: number;
};

const SEED: Omit<EpiItem, "id" | "minimo">[] = [
  { item: "CAMISA AZUL", ca: "", tamanho: "P", qtd: 0, unidade: "UN" },
  { item: "CAMISA AZUL", ca: "", tamanho: "M", qtd: 0, unidade: "UN" },
  { item: "CAMISA AZUL", ca: "", tamanho: "G", qtd: 0, unidade: "UN" },
  { item: "CAMISA AZUL", ca: "", tamanho: "GG", qtd: 0, unidade: "UN" },
  { item: "CALÇA AZUL", ca: "", tamanho: "P", qtd: 0, unidade: "UN" },
  { item: "CALÇA AZUL", ca: "", tamanho: "M", qtd: 0, unidade: "UN" },
  { item: "CALÇA AZUL", ca: "", tamanho: "GG", qtd: 0, unidade: "UN" },
  { item: "CALÇA AZUL", ca: "", tamanho: "EG", qtd: 0, unidade: "UN" },
  { item: "MACACÃO AZUL", ca: "", tamanho: "P", qtd: 0, unidade: "UN" },
  { item: "MACACÃO AZUL", ca: "", tamanho: "M", qtd: 0, unidade: "UN" },
  { item: "MACACÃO AZUL", ca: "", tamanho: "G", qtd: 0, unidade: "UN" },
  { item: "CAMISA CINZA", ca: "", tamanho: "M", qtd: 0, unidade: "UN" },
  { item: "CALÇA CINZA", ca: "", tamanho: "P", qtd: 0, unidade: "UN" },
  { item: "CALÇA CINZA", ca: "", tamanho: "M", qtd: 0, unidade: "UN" },
  { item: "MACACÃO CINZA", ca: "41609", tamanho: "P", qtd: 2, unidade: "UN" },
  { item: "MACACÃO CINZA", ca: "41609", tamanho: "M", qtd: 3, unidade: "UN" },
  { item: "BOTA", ca: "43164", tamanho: "36", qtd: 0, unidade: "UN" },
  { item: "BOTA", ca: "43164", tamanho: "37", qtd: 3, unidade: "UN" },
  { item: "BOTA", ca: "43164", tamanho: "39", qtd: 8, unidade: "UN" },
  { item: "BOTA", ca: "43164", tamanho: "40", qtd: 0, unidade: "UN" },
  { item: "BOTA", ca: "43164", tamanho: "41", qtd: 0, unidade: "UN" },
  { item: "BOTA", ca: "43164", tamanho: "42", qtd: 0, unidade: "UN" },
  { item: "BOTA", ca: "43164", tamanho: "44", qtd: 0, unidade: "UN" },
  { item: "BOTA PVC CANO CURTO", ca: "37456", tamanho: "42", qtd: 0, unidade: "UN" },
  { item: "BOTA PVC CANO CURTO", ca: "37456", tamanho: "44", qtd: 0, unidade: "UN" },
  { item: "COLETE LARANJA VICSA", ca: "", tamanho: "", qtd: 8, unidade: "UN" },
  { item: "CAPACETE BRANCO", ca: "29792", tamanho: "", qtd: 2, unidade: "UN" },
  { item: "CAPACETE VERDE", ca: "8304", tamanho: "", qtd: 3, unidade: "UN" },
  { item: "CAPACETE VERMELHO", ca: "8304", tamanho: "", qtd: 7, unidade: "UN" },
  { item: "CARNEIRA CINZA", ca: "", tamanho: "", qtd: 8, unidade: "UN" },
  { item: "CARNEIRA 3M", ca: "", tamanho: "", qtd: 0, unidade: "UN" },
  { item: "CARNEIRA MSA", ca: "29638", tamanho: "", qtd: 0, unidade: "UN" },
  { item: "VISEIRA", ca: "", tamanho: "", qtd: 56, unidade: "UN" },
  { item: "BALA CLAVA PRETA", ca: "", tamanho: "", qtd: 15, unidade: "UN" },
  { item: "BALA CLAVA BRANCA", ca: "", tamanho: "", qtd: 0, unidade: "UN" },
  { item: "RESPIRADOR SEMIFACIAL", ca: "", tamanho: "", qtd: 15, unidade: "UN" },
  { item: "RETENTOR PARA FILTRO", ca: "", tamanho: "", qtd: 5, unidade: "CX" },
  { item: "FILTRO PARA PARTICULA", ca: "", tamanho: "", qtd: 14, unidade: "UN" },
  { item: "CARTUCHO PARA VAPORES", ca: "", tamanho: "", qtd: 20, unidade: "UN" },
  { item: "FILTRO PARA PARTICULA 3M", ca: "", tamanho: "", qtd: 20, unidade: "CX" },
  { item: "RESPIRADOR DESCARTAVEL", ca: "44594", tamanho: "", qtd: 43, unidade: "UN" },
  { item: "OCULOS JAGUAR TRANSPARENTE", ca: "12572", tamanho: "", qtd: 25, unidade: "UN" },
  { item: "OCULOS PRETO", ca: "27418", tamanho: "", qtd: 19, unidade: "UN" },
  { item: "OCULOS AMARELO", ca: "12572", tamanho: "", qtd: 12, unidade: "UN" },
  { item: "LUVA VAQUETA - PUNHO LONGO", ca: "253961", tamanho: "", qtd: 192, unidade: "UN" },
  { item: "LUVA VAQUETA - PUNHO CURTO", ca: "253961", tamanho: "", qtd: 125, unidade: "UN" },
  { item: "LUVA DE RASPA VOLK", ca: "17158", tamanho: "", qtd: 157, unidade: "UN" },
  { item: "LUVA DE RASPA DMN", ca: "", tamanho: "", qtd: 0, unidade: "UN" },
  { item: "LUVA BRANCA / ALGODÃO", ca: "30521", tamanho: "", qtd: 118, unidade: "UN" },
  { item: "MACACÃO DE SEGURANÇA", ca: "36783", tamanho: "", qtd: 0, unidade: "UN" },
  { item: "AVENTAL DE SOLDA", ca: "38716", tamanho: "", qtd: 40, unidade: "UN" },
  { item: "PERNEIRA DE RASPA", ca: "", tamanho: "", qtd: 58, unidade: "UN" },
  { item: "LUVA PRETA", ca: "", tamanho: "", qtd: 202, unidade: "UN" },
  { item: "PROTETOR SOLAR", ca: "4114", tamanho: "", qtd: 6, unidade: "UN" },
  { item: "LENTE DE PROTEÇÃO ESCURA", ca: "", tamanho: "", qtd: 347, unidade: "UN" },
  { item: "LENTE DE PROTEÇÃO TRANSPARENTE", ca: "", tamanho: "", qtd: 461, unidade: "UN" },
  { item: "TALABARTE", ca: "35531", tamanho: "", qtd: 4, unidade: "UN" },
  { item: "PROTETOR AURICULAR", ca: "5745", tamanho: "", qtd: 168, unidade: "UN" },
  { item: "JUGULAR MSA", ca: "", tamanho: "", qtd: 0, unidade: "UN" },
  { item: "JUGULAR 3M", ca: "", tamanho: "", qtd: 12, unidade: "UN" },
  { item: "MANGOTE RASPA", ca: "39273", tamanho: "", qtd: 98, unidade: "UN" },
];

const STORAGE_KEY = "estoque-epi-sesmt-v1";

function buildSeed(): EpiItem[] {
  return SEED.map((s, i) => ({
    ...s,
    id: `${s.item}-${s.tamanho}-${i}`,
    minimo: 5,
  }));
}

export const Route = createFileRoute("/app/estoque/sesmt")({
  component: EstoqueSesmtPage,
});

function EstoqueSesmtPage() {
  const [items, setItems] = useState<EpiItem[]>(() => buildSeed());
  const [query, setQuery] = useState("");

  // Load
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as EpiItem[];
        if (Array.isArray(parsed) && parsed.length) setItems(parsed);
      }
    } catch {}
  }, []);

  // Save
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {}
  }, [items]);

  const totals = useMemo(() => {
    const totalItens = items.length;
    const totalUnidades = items.reduce((a, b) => a + b.qtd, 0);
    const semEstoque = items.filter((i) => i.qtd === 0).length;
    const baixoEstoque = items.filter((i) => i.qtd > 0 && i.qtd <= i.minimo).length;
    return { totalItens, totalUnidades, semEstoque, baixoEstoque };
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.item.toLowerCase().includes(q) ||
        i.ca.toLowerCase().includes(q) ||
        i.tamanho.toLowerCase().includes(q),
    );
  }, [items, query]);

  function adjust(id: string, delta: number) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, qtd: Math.max(0, i.qtd + delta) } : i)),
    );
  }

  function setQtd(id: string, value: number) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, qtd: Math.max(0, Number.isFinite(value) ? value : 0) } : i)),
    );
  }

  function setMin(id: string, value: number) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, minimo: Math.max(0, Number.isFinite(value) ? value : 0) } : i)),
    );
  }

  function exportCsv() {
    const header = ["Item", "CA", "Tamanho", "Quantidade", "Unidade", "Mínimo", "Status"];
    const rows = items.map((i) => [
      i.item,
      i.ca,
      i.tamanho,
      String(i.qtd),
      i.unidade,
      String(i.minimo),
      statusLabel(i),
    ]);
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
    if (!confirm("Restaurar estoque para os valores originais da planilha?")) return;
    setItems(buildSeed());
    toast.success("Estoque restaurado");
  }

  function statusLabel(i: EpiItem) {
    if (i.qtd === 0) return "Sem estoque";
    if (i.qtd <= i.minimo) return "Baixo";
    return "OK";
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
            Controle de estoque de Equipamentos de Proteção Individual.
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard icon={Package} label="Itens cadastrados" value={totals.totalItens} tone="slate" />
        <SummaryCard icon={Package} label="Unidades em estoque" value={totals.totalUnidades} tone="blue" />
        <SummaryCard icon={AlertTriangle} label="Baixo estoque" value={totals.baixoEstoque} tone="amber" />
        <SummaryCard icon={XCircle} label="Sem estoque" value={totals.semEstoque} tone="red" />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 gap-3">
          <CardTitle className="text-base font-bold">Itens em estoque</CardTitle>
          <div className="relative w-full max-w-xs">
            <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por item, CA ou tamanho…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Item</TableHead>
                <TableHead>CA</TableHead>
                <TableHead>Tamanho</TableHead>
                <TableHead className="text-center w-[180px]">Quantidade</TableHead>
                <TableHead>Un.</TableHead>
                <TableHead className="text-center w-[80px]">Mínimo</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((i) => {
                const status = statusLabel(i);
                return (
                  <TableRow key={i.id}>
                    <TableCell className="font-semibold">{i.item}</TableCell>
                    <TableCell className="text-muted-foreground">{i.ca || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{i.tamanho || "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => adjust(i.id, -1)}
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <Input
                          value={i.qtd}
                          onChange={(e) => setQtd(i.id, parseInt(e.target.value || "0", 10))}
                          className="h-7 w-16 text-center text-sm"
                          inputMode="numeric"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => adjust(i.id, 1)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{i.unidade}</TableCell>
                    <TableCell>
                      <Input
                        value={i.minimo}
                        onChange={(e) => setMin(i.id, parseInt(e.target.value || "0", 10))}
                        className="h-7 w-14 text-center text-sm mx-auto"
                        inputMode="numeric"
                      />
                    </TableCell>
                    <TableCell>
                      {status === "Sem estoque" && (
                        <Badge className="bg-red-100 text-red-800 border border-red-200">Sem estoque</Badge>
                      )}
                      {status === "Baixo" && (
                        <Badge className="bg-amber-100 text-amber-800 border border-amber-200">Baixo</Badge>
                      )}
                      {status === "OK" && (
                        <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200">OK</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhum item encontrado.
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
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-10 w-10 rounded-md bg-white/70 flex items-center justify-center">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest opacity-80">{label}</div>
          <div className="text-2xl font-black leading-tight">{value.toLocaleString("pt-BR")}</div>
        </div>
      </CardContent>
    </Card>
  );
}