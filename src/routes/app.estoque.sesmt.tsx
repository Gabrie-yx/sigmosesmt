import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { HardHat, Search, Download, RotateCcw, Plus } from "lucide-react";
import { toast } from "sonner";

type EpiRow = {
  id: string;
  arvAv: string;
  material: string;
  descricao: string;
  umb: "UN" | "CX" | "PC" | "KG" | "M" | "GAL";
  estoqueInicial: number;
  entradas: number;
  saidas: number;
  ca?: string;
};

const SEED_RAW: Omit<EpiRow, "id" | "arvAv" | "material">[] = [
  // CAMISA
  { descricao: "CAMISA AZUL TAM. P", umb: "UN", estoqueInicial: 0, entradas: 0, saidas: 0 },
  { descricao: "CAMISA AZUL TAM. M", umb: "UN", estoqueInicial: 0, entradas: 0, saidas: 0 },
  { descricao: "CAMISA AZUL TAM. G", umb: "UN", estoqueInicial: 0, entradas: 0, saidas: 0 },
  { descricao: "CAMISA AZUL TAM. GG", umb: "UN", estoqueInicial: 0, entradas: 0, saidas: 0 },
  { descricao: "CAMISA CINZA TAM. M", umb: "UN", estoqueInicial: 0, entradas: 0, saidas: 0 },
  // CALÇA
  { descricao: "CALÇA AZUL TAM. P", umb: "UN", estoqueInicial: 0, entradas: 0, saidas: 0 },
  { descricao: "CALÇA AZUL TAM. M", umb: "UN", estoqueInicial: 0, entradas: 0, saidas: 0 },
  { descricao: "CALÇA AZUL TAM. GG", umb: "UN", estoqueInicial: 0, entradas: 0, saidas: 0 },
  { descricao: "CALÇA AZUL TAM. EG", umb: "UN", estoqueInicial: 0, entradas: 0, saidas: 0 },
  { descricao: "CALÇA CINZA TAM. P", umb: "UN", estoqueInicial: 0, entradas: 0, saidas: 0 },
  { descricao: "CALÇA CINZA TAM. M", umb: "UN", estoqueInicial: 0, entradas: 0, saidas: 0 },
  // MACACÃO
  { descricao: "MACACÃO AZUL TAM. P", umb: "UN", estoqueInicial: 0, entradas: 0, saidas: 0, ca: "41609" },
  { descricao: "MACACÃO AZUL TAM. M", umb: "UN", estoqueInicial: 0, entradas: 0, saidas: 0, ca: "41609" },
  { descricao: "MACACÃO AZUL TAM. G", umb: "UN", estoqueInicial: 0, entradas: 0, saidas: 0, ca: "41609" },
  { descricao: "MACACÃO CINZA TAM. P", umb: "UN", estoqueInicial: 2, entradas: 0, saidas: 0, ca: "41609" },
  { descricao: "MACACÃO CINZA TAM. M", umb: "UN", estoqueInicial: 3, entradas: 0, saidas: 0, ca: "41609" },
  // BOTA
  { descricao: "BOTA TAM. 36", umb: "UN", estoqueInicial: 0, entradas: 0, saidas: 0, ca: "43164" },
  { descricao: "BOTA TAM. 37", umb: "UN", estoqueInicial: 3, entradas: 0, saidas: 0, ca: "43164" },
  { descricao: "BOTA TAM. 39", umb: "UN", estoqueInicial: 8, entradas: 0, saidas: 0, ca: "43164" },
  { descricao: "BOTA TAM. 40", umb: "UN", estoqueInicial: 0, entradas: 0, saidas: 0, ca: "43164" },
  { descricao: "BOTA TAM. 41", umb: "UN", estoqueInicial: 0, entradas: 0, saidas: 0, ca: "43164" },
  { descricao: "BOTA TAM. 42", umb: "UN", estoqueInicial: 0, entradas: 0, saidas: 0, ca: "43164" },
  { descricao: "BOTA TAM. 44", umb: "UN", estoqueInicial: 0, entradas: 0, saidas: 0, ca: "43164" },
  // BOTA PVC
  { descricao: "BOTA PVC CANO CURTO TAM. 42", umb: "UN", estoqueInicial: 0, entradas: 0, saidas: 0, ca: "37456" },
  { descricao: "BOTA PVC CANO CURTO TAM. 44", umb: "UN", estoqueInicial: 0, entradas: 0, saidas: 0, ca: "37456" },
  // CAPACETE
  { descricao: "COLETE LARANJA", umb: "UN", estoqueInicial: 8, entradas: 0, saidas: 0 },
  { descricao: "CAPACETE BRANCO", umb: "UN", estoqueInicial: 2, entradas: 0, saidas: 0, ca: "29792" },
  { descricao: "CAPACETE VERDE", umb: "UN", estoqueInicial: 3, entradas: 0, saidas: 0, ca: "8304" },
  { descricao: "CAPACETE VERMELHO", umb: "UN", estoqueInicial: 7, entradas: 0, saidas: 0, ca: "8304" },
  // CARNEIRA
  { descricao: "CARNEIRA CINZA", umb: "UN", estoqueInicial: 8, entradas: 0, saidas: 0 },
  { descricao: "CARNEIRA 3M", umb: "UN", estoqueInicial: 0, entradas: 0, saidas: 0 },
  { descricao: "CARNEIRA MSA", umb: "UN", estoqueInicial: 0, entradas: 0, saidas: 0, ca: "29638" },
  { descricao: "VISEIRA", umb: "UN", estoqueInicial: 56, entradas: 0, saidas: 0 },
  // BALACLAVA
  { descricao: "BALACLAVA PRETA", umb: "UN", estoqueInicial: 15, entradas: 0, saidas: 0 },
  { descricao: "BALACLAVA BRANCA", umb: "UN", estoqueInicial: 0, entradas: 0, saidas: 0 },
  // RESPIRADOR
  { descricao: "RESPIRADOR SEMIFACIAL", umb: "UN", estoqueInicial: 15, entradas: 0, saidas: 0 },
  { descricao: "RETENTOR PARA FILTRO", umb: "CX", estoqueInicial: 5, entradas: 0, saidas: 0 },
  { descricao: "FILTRO PARA PARTÍCULA", umb: "UN", estoqueInicial: 14, entradas: 0, saidas: 0 },
  { descricao: "CARTUCHO PARA VAPORES", umb: "UN", estoqueInicial: 20, entradas: 0, saidas: 0 },
  { descricao: "FILTRO PARA PARTÍCULA 3M", umb: "CX", estoqueInicial: 20, entradas: 0, saidas: 0 },
  { descricao: "RESPIRADOR DESCARTÁVEL", umb: "UN", estoqueInicial: 43, entradas: 0, saidas: 0, ca: "44594" },
  // ÓCULOS
  { descricao: "ÓCULOS JAGUAR TRANSPARENTE", umb: "UN", estoqueInicial: 25, entradas: 0, saidas: 0, ca: "12572" },
  { descricao: "ÓCULOS PRETO", umb: "UN", estoqueInicial: 19, entradas: 0, saidas: 0, ca: "27418" },
  { descricao: "ÓCULOS AMARELO", umb: "UN", estoqueInicial: 12, entradas: 0, saidas: 0, ca: "12572" },
  // LUVAS
  { descricao: "LUVA VAQUETA PUNHO LONGO", umb: "UN", estoqueInicial: 192, entradas: 0, saidas: 0, ca: "253961" },
  { descricao: "LUVA VAQUETA PUNHO CURTO", umb: "UN", estoqueInicial: 125, entradas: 0, saidas: 0, ca: "253961" },
  { descricao: "LUVA DE RASPA VOLK", umb: "UN", estoqueInicial: 157, entradas: 0, saidas: 0, ca: "17158" },
  { descricao: "LUVA DE RASPA DMN", umb: "UN", estoqueInicial: 0, entradas: 0, saidas: 0 },
  { descricao: "LUVA BRANCA / ALGODÃO", umb: "UN", estoqueInicial: 118, entradas: 0, saidas: 0, ca: "30521" },
  { descricao: "LUVA PRETA", umb: "UN", estoqueInicial: 202, entradas: 0, saidas: 0 },
  // OUTROS
  { descricao: "MACACÃO DE SEGURANÇA", umb: "UN", estoqueInicial: 0, entradas: 0, saidas: 0, ca: "36783" },
  { descricao: "AVENTAL DE SOLDA", umb: "UN", estoqueInicial: 40, entradas: 0, saidas: 0, ca: "38716" },
  { descricao: "PERNEIRA DE RASPA", umb: "UN", estoqueInicial: 58, entradas: 0, saidas: 0 },
  { descricao: "PROTETOR SOLAR", umb: "UN", estoqueInicial: 6, entradas: 0, saidas: 0, ca: "4114" },
  { descricao: "LENTE DE PROTEÇÃO ESCURA", umb: "UN", estoqueInicial: 347, entradas: 0, saidas: 0 },
  { descricao: "LENTE DE PROTEÇÃO TRANSPARENTE", umb: "UN", estoqueInicial: 461, entradas: 0, saidas: 0 },
  { descricao: "TALABARTE", umb: "UN", estoqueInicial: 4, entradas: 0, saidas: 0, ca: "35531" },
  { descricao: "PROTETOR AURICULAR", umb: "UN", estoqueInicial: 168, entradas: 0, saidas: 0, ca: "5745" },
  { descricao: "JUGULAR MSA", umb: "UN", estoqueInicial: 0, entradas: 0, saidas: 0 },
  { descricao: "JUGULAR 3M", umb: "UN", estoqueInicial: 12, entradas: 0, saidas: 0 },
  { descricao: "MANGOTE RASPA", umb: "UN", estoqueInicial: 98, entradas: 0, saidas: 0, ca: "39273" },
];

function buildSeed(): EpiRow[] {
  return SEED_RAW.map((r, i) => ({
    ...r,
    id: `epi-${i + 1}`,
    arvAv: "C030",
    material: String(40000001 + i),
  }));
}

const STORAGE_KEY = "estoque-epi-sesmt-v3";

export const Route = createFileRoute("/app/estoque/sesmt")({
  component: EstoqueSesmtPage,
});

function EstoqueSesmtPage() {
  const [rows, setRows] = useState<EpiRow[]>(() => buildSeed());
  const [query, setQuery] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as EpiRow[];
        if (Array.isArray(parsed) && parsed.length) setRows(parsed);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    } catch {}
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.descricao.toLowerCase().includes(q) ||
        r.material.toLowerCase().includes(q) ||
        (r.ca || "").toLowerCase().includes(q),
    );
  }, [rows, query]);

  const totals = useMemo(() => {
    let inicial = 0, ent = 0, sai = 0, fin = 0;
    rows.forEach((r) => {
      inicial += r.estoqueInicial;
      ent += r.entradas;
      sai += r.saidas;
      fin += r.estoqueInicial + r.entradas - r.saidas;
    });
    return { inicial, ent, sai, fin, total: rows.length };
  }, [rows]);

  function update(id: string, patch: Partial<EpiRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        id: `epi-${Date.now()}`,
        arvAv: "C030",
        material: String(40000001 + prev.length),
        descricao: "",
        umb: "UN",
        estoqueInicial: 0,
        entradas: 0,
        saidas: 0,
      },
    ]);
  }

  function exportCsv() {
    const header = [
      "ÁrAv", "Material", "Texto breve material", "UMB",
      "Estoque inicial", "Totais qtds.entrada", "Totais qtds.saída", "Estoque final", "CA",
    ];
    const out = rows.map((r) => [
      r.arvAv, r.material, r.descricao, r.umb,
      String(r.estoqueInicial), String(r.entradas), String(r.saidas),
      String(r.estoqueInicial + r.entradas - r.saidas), r.ca || "",
    ]);
    const csv = [header, ...out]
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
    setRows(buildSeed());
    toast.success("Estoque restaurado");
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
            Controle de Estoque — formato SAP (ÁrAv · Material · Estoque inicial · Entradas · Saídas · Estoque final).
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={resetData}>
            <RotateCcw className="h-4 w-4 mr-1.5" /> Restaurar
          </Button>
          <Button variant="outline" size="sm" onClick={addRow}>
            <Plus className="h-4 w-4 mr-1.5" /> Novo material
          </Button>
          <Button size="sm" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-1.5" /> Exportar CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Materiais" value={totals.total} />
        <Stat label="Estoque inicial" value={totals.inicial} />
        <Stat label="Entradas" value={totals.ent} tone="green" />
        <Stat label="Saídas" value={totals.sai} tone="red" />
        <Stat label="Estoque final" value={totals.fin} tone="bold" />
      </div>

      <div className="relative max-w-md">
        <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por descrição, material ou CA…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-8"
        />
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[1000px] text-[12px] font-mono">
            <TableHeader>
              <TableRow className="bg-slate-100 hover:bg-slate-100 border-b-2 border-slate-300">
                <TableHead className="h-8 font-bold text-slate-700 w-[60px]">ÁrAv</TableHead>
                <TableHead className="h-8 font-bold text-slate-700 w-[90px]">Material</TableHead>
                <TableHead className="h-8 font-bold text-slate-700">Texto breve material</TableHead>
                <TableHead className="h-8 font-bold text-slate-700 w-[60px]">UMB</TableHead>
                <TableHead className="h-8 font-bold text-slate-700 text-right w-[110px]">Estoque inicial</TableHead>
                <TableHead className="h-8 font-bold text-slate-700 text-right w-[120px]">Totais qtds.entrada</TableHead>
                <TableHead className="h-8 font-bold text-slate-700 text-right w-[120px]">Totais qtds.saída</TableHead>
                <TableHead className="h-8 font-bold text-slate-700 text-right w-[110px]">Estoque final</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const final = r.estoqueInicial + r.entradas - r.saidas;
                return (
                  <TableRow key={r.id} className="hover:bg-slate-50/60 border-b border-slate-200">
                    <TableCell className="py-1 px-2 text-slate-700">{r.arvAv}</TableCell>
                    <TableCell className="py-1 px-2 text-slate-700">{r.material}</TableCell>
                    <TableCell className="py-1 px-2">
                      <input
                        value={r.descricao}
                        onChange={(e) => update(r.id, { descricao: e.target.value })}
                        className="w-full bg-transparent outline-none focus:bg-yellow-50 px-1"
                      />
                    </TableCell>
                    <TableCell className="py-1 px-2 text-slate-700">{r.umb}</TableCell>
                    <Numeric
                      value={r.estoqueInicial}
                      onChange={(v) => update(r.id, { estoqueInicial: v })}
                      highlight={r.estoqueInicial > 0 ? "green" : undefined}
                    />
                    <Numeric
                      value={r.entradas}
                      onChange={(v) => update(r.id, { entradas: v })}
                      highlight={r.entradas > 0 ? "green" : undefined}
                    />
                    <Numeric
                      value={r.saidas}
                      onChange={(v) => update(r.id, { saidas: v })}
                      highlight={r.saidas > 0 ? "red" : undefined}
                      suffix={r.saidas > 0 ? "-" : ""}
                    />
                    <TableCell
                      className={`py-1 px-2 text-right font-semibold ${
                        final > 0 ? "bg-emerald-50 text-emerald-900" : final < 0 ? "bg-red-100 text-red-900" : "text-slate-500"
                      }`}
                    >
                      {formatNum(final, r.umb)}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Nenhum material encontrado.
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

function formatNum(n: number, umb: string) {
  if (umb === "KG" || umb === "M" || umb === "GAL") {
    return n.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  }
  return n.toLocaleString("pt-BR");
}

function Numeric({
  value,
  onChange,
  highlight,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  highlight?: "green" | "red";
  suffix?: string;
}) {
  const cls =
    highlight === "green"
      ? "bg-emerald-100/70 text-emerald-900"
      : highlight === "red"
        ? "bg-red-100 text-red-900"
        : "text-slate-500";
  return (
    <TableCell className={`py-1 px-2 text-right ${cls}`}>
      <div className="flex items-center justify-end gap-0.5">
        <input
          value={value}
          onChange={(e) => {
            const v = parseInt(e.target.value || "0", 10);
            onChange(Math.max(0, Number.isFinite(v) ? v : 0));
          }}
          inputMode="numeric"
          className="w-full bg-transparent outline-none text-right focus:bg-yellow-50 px-1"
        />
        {suffix && <span className="text-red-900">{suffix}</span>}
      </div>
    </TableCell>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "green" | "red" | "bold";
}) {
  const cls =
    tone === "green"
      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
      : tone === "red"
        ? "bg-red-50 border-red-200 text-red-900"
        : tone === "bold"
          ? "bg-slate-900 border-slate-900 text-white"
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