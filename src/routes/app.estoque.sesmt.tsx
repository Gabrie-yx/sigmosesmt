import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, Download, Plus, History,
  Trash2, ExternalLink, AlertTriangle, Pencil, X, Upload, ImageIcon, Copy,
  ArrowDownToLine,
} from "lucide-react";
import protectiveClothingIcon from "@/assets/protective-clothing.png";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/utils-date";

type Item = {
  id: string;
  codigo_material: string;
  nome_material: string;
  ca: string | null;
  ca_validade: string | null;
  numero_pedido: string | null;
  imagem_url: string | null;
  quantidade_atual: number;
  estoque_minimo: number;
  ultimo_fornecedor: string | null;
};
type Movimento = {
  id: string;
  epi_id: string;
  data_entrega: string;
  quantidade_entregue: number;
  tipo_movimentacao: "SAIDA_ENTREGA" | "ENTRADA_REPOSICAO" | "DEVOLUCAO";
  cpf_colaborador: string;
  nome_colaborador: string;
};

export const Route = createFileRoute("/app/estoque/sesmt")({
  component: EstoqueSesmtPage,
});

function EstoqueSesmtPage() {
  const qc = useQueryClient();
  const { isAdmin, isEditor } = useAuth();
  const [search, setSearch] = useState("");

  const { data: items = [] } = useQuery({
    queryKey: ["estoque_epi"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque_epi")
        .select("*")
        .order("nome_material");
      if (error) throw error;
      return (data ?? []) as Item[];
    },
  });

  const { data: movs = [] } = useQuery({
    queryKey: ["historico_entregas_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("historico_entregas")
        .select("*")
        .order("data_entrega", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as Movimento[];
    },
  });

  const movsByItem = useMemo(() => {
    const map = new Map<string, Movimento[]>();
    movs.forEach((m) => {
      const arr = map.get(m.epi_id) ?? [];
      arr.push(m);
      map.set(m.epi_id, arr);
    });
    return map;
  }, [movs]);

  // Mês corrente (America/Sao_Paulo aproximado pelo cliente)
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1; // 1-12
  const monthStart = useMemo(() => new Date(curYear, curMonth - 1, 1), [curYear, curMonth]);

  const { data: snapshots = [] } = useQuery({
    queryKey: ["estoque_epi_snapshots", curYear, curMonth],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("estoque_epi_monthly_snapshots")
        .select("epi_id, estoque_inicial")
        .eq("year", curYear)
        .eq("month", curMonth);
      if (error) throw error;
      return (data ?? []) as { epi_id: string; estoque_inicial: number }[];
    },
  });

  const snapshotByItem = useMemo(() => {
    const map = new Map<string, number>();
    snapshots.forEach((s) => map.set(s.epi_id, s.estoque_inicial ?? 0));
    return map;
  }, [snapshots]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) =>
      i.nome_material.toLowerCase().includes(q) ||
      (i.codigo_material ?? "").toLowerCase().includes(q) ||
      (i.ca ?? "").toLowerCase().includes(q),
    );
  }, [items, search]);

  const totals = useMemo(() => {
    let total = 0, entradas = 0, saidas = 0;
    items.forEach((i) => { total += i.quantidade_atual ?? 0; });
    movs.forEach((m) => {
      const q = m.quantidade_entregue ?? 0;
      if (m.tipo_movimentacao === "SAIDA_ENTREGA") saidas += q;
      else entradas += q;
    });
    return { total, entradas, saidas };
  }, [items, movs]);

  /* ---------- Mutations ---------- */
  const createMut = useMutation({
    mutationFn: async (payload: any[]) => {
      const { error } = await supabase.from("estoque_epi").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estoque_epi"] });
      toast.success("Produto(s) cadastrado(s)");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("estoque_epi").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estoque_epi"] });
      toast.success("Item excluído");
    },
    onError: (e: any) => toast.error(e.message),
  });

  /* ---------- Dialogs ---------- */
  const [showNew, setShowNew] = useState(false);
  const [histItem, setHistItem] = useState<Item | null>(null);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [dupItem, setDupItem] = useState<Item | null>(null);
  const [showEntrada, setShowEntrada] = useState(false);

  const entradaMut = useMutation({
    mutationFn: async (args: { epi_id: string; qtd: number; fornecedor?: string }) => {
      const { error } = await (supabase as any).rpc("registrar_movimentacao_epi", {
        _epi_id: args.epi_id,
        _qtd: args.qtd,
        _tipo: "ENTRADA_REPOSICAO",
        _fornecedor: args.fornecedor || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estoque_epi"] });
      qc.invalidateQueries({ queryKey: ["historico_entregas_all"] });
      toast.success("Entrada registrada");
      setShowEntrada(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: async (args: { id: string; patch: Partial<Item> }) => {
      const { error } = await supabase.from("estoque_epi").update(args.patch).eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estoque_epi"] });
      toast.success("Item atualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function exportXlsx() {
    const rows = items.map((i) => ({
      Codigo: i.codigo_material,
      Produto: i.nome_material,
      CA: i.ca ?? "",
      CA_Validade: i.ca_validade ?? "",
      NumeroPedido: i.numero_pedido ?? "",
      Quantidade: i.quantidade_atual,
      EstoqueMinimo: i.estoque_minimo,
      UltimoFornecedor: i.ultimo_fornecedor ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Estoque SESMT");
    XLSX.writeFile(wb, `estoque-sesmt-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <div className="p-6 md:p-8 space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Estoque · SESMT</div>
          <div className="flex items-center gap-3 mt-1">
            <img src={protectiveClothingIcon} alt="" className="h-8 w-8" />
            <h1 className="text-2xl font-black uppercase tracking-wider text-slate-800">
              Painel de Estoque SESMT
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Cada item é uma linha. As saídas são automáticas a cada entrega na ficha do colaborador.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isEditor && (
            <>
              <Button onClick={() => setShowEntrada(true)} variant="outline" className="border-emerald-600 text-emerald-700 hover:bg-emerald-50">
                <ArrowDownToLine className="h-4 w-4 mr-2" /> Dar entrada
              </Button>
              <Button onClick={() => setShowNew(true)} className="bg-brand text-white">
                <Plus className="h-4 w-4 mr-2" /> Novo produto
              </Button>
            </>
          )}
          <Button variant="outline" onClick={exportXlsx}>
            <Download className="h-4 w-4 mr-2" /> Exportar XLSX
          </Button>
        </div>
      </div>

      {/* Stats — consolidados para evitar redundância */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <StatCard label="Produtos cadastrados" value={items.length} />
        <StatCard label="Estoque total (em mãos)" value={totals.total} highlight />
        <MovStatCard entradas={totals.entradas} saidas={totals.saidas} />
      </div>

      {/* Search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por produto, código ou CA…"
            className="pl-9"
          />
        </div>
        <Button
          asChild
          className="bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold uppercase tracking-wide shadow-lg shadow-orange-500/30 hover:from-amber-600 hover:to-orange-700"
        >
          <a href="https://consultaca.com.br" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-2" /> Consultar CA
          </a>
        </Button>
      </div>

      {/* Table */}
      <Card className="rounded-2xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">Foto</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">Produto</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500">CA</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Estoque Inicial</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Qtde Entradas</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Qtde Saída</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Estoque Final</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Qtd. atual</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Mínimo</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-500 text-center">Histórico</TableHead>
              {isEditor && <TableHead></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={isEditor ? 10 : 9} className="text-center text-sm text-muted-foreground py-10">
                  Nenhum item cadastrado. Clique em "Novo produto" para começar.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((i) => {
              const low = i.quantidade_atual <= (i.estoque_minimo ?? 0);
              const caDays = i.ca_validade
                ? Math.floor((new Date(i.ca_validade).getTime() - Date.now()) / 86400000)
                : null;
              const caExpired = caDays !== null && caDays < 0;
              const caSoon = caDays !== null && caDays >= 0 && caDays <= 180;
              const itemMovs = movsByItem.get(i.id) ?? [];
              let entradasItem = 0, saidasItem = 0;
              itemMovs.forEach((m) => {
                const d = m.data_entrega ? new Date(m.data_entrega) : null;
                if (!d || d < monthStart) return;
                const q = m.quantidade_entregue ?? 0;
                if (m.tipo_movimentacao === "SAIDA_ENTREGA") saidasItem += q;
                else entradasItem += q;
              });
              const estoqueInicial = snapshotByItem.get(i.id) ?? 0;
              const estoqueFinal = estoqueInicial + entradasItem - saidasItem;
              return (
                <TableRow
                  key={i.id}
                  className={
                    caExpired
                      ? "bg-rose-50 hover:bg-rose-100"
                      : caSoon
                      ? "bg-slate-200/70 hover:bg-slate-200"
                      : "hover:bg-slate-50/50"
                  }
                >
                  <TableCell>
                    {i.imagem_url ? (
                      <img src={i.imagem_url} alt="" className="h-10 w-10 rounded object-cover border border-slate-200" />
                    ) : (
                      <div className="h-10 w-10 rounded border border-dashed border-slate-300 flex items-center justify-center text-slate-300">
                        <ImageIcon className="h-4 w-4" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-bold text-slate-800 uppercase">{i.nome_material}</TableCell>
                  <TableCell className="text-xs">
                    {i.ca ? (
                      <div className="flex flex-col gap-0.5">
                        <Badge
                          variant="secondary"
                          className={`w-fit ${
                            caExpired
                              ? "bg-rose-600 text-white hover:bg-rose-600"
                              : caSoon
                              ? "bg-slate-700 text-white hover:bg-slate-700"
                              : ""
                          }`}
                        >
                          {i.ca}
                          {caExpired && <AlertTriangle className="inline h-3 w-3 ml-1" />}
                        </Badge>
                        {i.ca_validade && (
                          <span
                            className={`text-[10px] font-semibold ${
                              caExpired
                                ? "text-rose-700"
                                : caSoon
                                ? "text-slate-700"
                                : "text-slate-500"
                            }`}
                          >
                            {caExpired ? "VENCIDO em " : "val. "}
                            {formatDateBR(i.ca_validade)}
                          </span>
                        )}
                      </div>
                    ) : <span className="text-slate-300">—</span>}
                  </TableCell>
                  <TableCell className="text-right text-xs text-slate-600 font-semibold">{estoqueInicial}</TableCell>
                  <TableCell className="text-right text-xs text-emerald-700 font-semibold">{entradasItem}</TableCell>
                  <TableCell className="text-right text-xs text-rose-700 font-semibold">{saidasItem}</TableCell>
                  <TableCell className="text-right text-xs text-slate-800 font-black">{estoqueFinal}</TableCell>
                  <TableCell className="text-right font-black">
                    <span className={low ? "text-rose-600" : "text-slate-800"}>{i.quantidade_atual}</span>
                    {low && <AlertTriangle className="inline h-3.5 w-3.5 ml-1 text-rose-500" />}
                  </TableCell>
                  <TableCell className="text-right text-xs text-slate-500">{i.estoque_minimo}</TableCell>
                  <TableCell className="text-center">
                    <Button size="sm" variant="ghost" onClick={() => setHistItem(i)}>
                      <History className="h-4 w-4 mr-1" /> Ver
                    </Button>
                  </TableCell>
                  {isEditor && (
                    <TableCell>
                      <div className="inline-flex gap-1">
                        <Button size="icon" variant="ghost" title="Editar" onClick={() => setEditItem(i)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" title="Duplicar" onClick={() => setDupItem(i)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        {isAdmin && (
                          <Button size="icon" variant="ghost" onClick={() => {
                            if (confirm(`Excluir "${i.nome_material}"?`)) delMut.mutate(i.id);
                          }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* New product */}
      <NewItemDialog
        open={showNew}
        onOpenChange={setShowNew}
        onSubmit={(rows: any[]) => createMut.mutate(rows, { onSuccess: () => setShowNew(false) })}
        pending={createMut.isPending}
      />

      {/* Edit product */}
      <EditItemDialog
        item={editItem}
        onClose={() => setEditItem(null)}
        onSubmit={(patch: any) => {
          if (!editItem) return;
          updateMut.mutate({ id: editItem.id, patch }, { onSuccess: () => setEditItem(null) });
        }}
        pending={updateMut.isPending}
        movsByItem={movsByItem}
        snapshotByItem={snapshotByItem}
        monthStart={monthStart}
      />

      {/* Duplicate product */}
      <EditItemDialog
        mode="duplicate"
        item={dupItem}
        onClose={() => setDupItem(null)}
        onSubmit={(payload: any) => {
          const rows = Array.isArray(payload) ? payload : [payload];
          createMut.mutate(rows, { onSuccess: () => setDupItem(null) });
        }}
        pending={createMut.isPending}
        movsByItem={movsByItem}
        snapshotByItem={snapshotByItem}
        monthStart={monthStart}
      />

      {/* History */}
      <HistoryDialog
        item={histItem}
        movs={histItem ? (movsByItem.get(histItem.id) ?? []) : []}
        onClose={() => setHistItem(null)}
      />

      {/* Entrada de estoque */}
      <EntradaDialog
        open={showEntrada}
        onOpenChange={setShowEntrada}
        items={items}
        onSubmit={(v) => entradaMut.mutate(v)}
        pending={entradaMut.isPending}
      />
    </div>
  );
}

/* ---------- Components ---------- */
function StatCard({ label, value, variant, highlight }: { label: string; value: number; variant?: "emerald" | "rose"; highlight?: boolean }) {
  const cls =
    variant === "emerald" ? "bg-emerald-50 border-emerald-200 text-emerald-800"
    : variant === "rose" ? "bg-rose-50 border-rose-200 text-rose-800"
    : highlight ? "bg-slate-900 text-white"
    : "bg-white border-slate-200";
  return (
    <Card className={`p-4 rounded-2xl border ${cls}`}>
      <div className="text-[10px] font-black uppercase tracking-widest opacity-70">{label}</div>
      <div className="text-3xl font-black mt-1">{value}</div>
    </Card>
  );
}

function MovStatCard({ entradas, saidas }: { entradas: number; saidas: number }) {
  const saldo = entradas - saidas;
  return (
    <Card className="p-4 rounded-2xl border bg-white border-slate-200">
      <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">
        Movimentações (total)
      </div>
      <div className="mt-2 grid grid-cols-3 gap-3">
        <div>
          <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-700">Entradas</div>
          <div className="text-2xl font-black text-emerald-700 leading-tight">{entradas}</div>
        </div>
        <div>
          <div className="text-[9px] font-bold uppercase tracking-wider text-rose-700">Saídas</div>
          <div className="text-2xl font-black text-rose-700 leading-tight">{saidas}</div>
        </div>
        <div>
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Saldo</div>
          <div className={`text-2xl font-black leading-tight ${saldo >= 0 ? "text-slate-800" : "text-rose-700"}`}>
            {saldo >= 0 ? "+" : ""}{saldo}
          </div>
        </div>
      </div>
    </Card>
  );
}

const TIPO_PRESETS: Record<string, string[]> = {
  CALÇA: ["PP", "P", "M", "G", "GG", "XGG"],
  CAMISA: ["PP", "P", "M", "G", "GG", "XGG"],
  BOTA: ["37", "38", "39", "40", "41", "42", "43", "44"],
  LUVA: [
    "VAQUETA LONGA",
    "VAQUETA CURTA",
    "RASPA VOLK",
    "RASPA DMN",
    "ALGODÃO BRANCA",
    "ALGODÃO PRETA",
  ],
  OUTRO: [],
};

function detectTipoFromName(nome: string): { tipo: string; base: string; variacao: string | null } {
  const n = (nome ?? "").trim();
  for (const [tipo, presets] of Object.entries(TIPO_PRESETS)) {
    for (const p of presets) {
      const suf = " - " + p;
      if (n.toUpperCase().endsWith(suf)) {
        return { tipo, base: n.slice(0, -suf.length), variacao: p };
      }
    }
  }
  // Generic " - XYZ" suffix → keep tipo OUTRO but expose suffix as variation
  const m = n.match(/^(.*) - ([^-]+)$/);
  if (m) return { tipo: "OUTRO", base: m[1], variacao: m[2].trim().toUpperCase() };
  return { tipo: "OUTRO", base: n, variacao: null };
}

async function uploadFotoEpi(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("epis-fotos").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("epis-fotos").getPublicUrl(path);
  return data.publicUrl;
}

function NewItemDialog({ open, onOpenChange, onSubmit, pending }: any) {
  const initial = {
    tipo: "OUTRO",
    nome_base: "",
    codigo_base: "",
    ca: "",
    ca_validade: "",
    numero_pedido: "",
    qtd_inicial: "0",
    estoque_minimo: "5",
  };
  const [f, setF] = useState(initial);
  const [caNA, setCaNA] = useState(false);
  const [variacoes, setVariacoes] = useState<string[]>([]);
  const [novaVar, setNovaVar] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setF(initial);
      setVariacoes([]);
      setNovaVar("");
      setFoto(null);
      setCaNA(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const presets = TIPO_PRESETS[f.tipo] ?? [];

  function toggleVar(v: string) {
    setVariacoes((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));
  }
  function addNovaVar() {
    const v = novaVar.trim().toUpperCase();
    if (!v) return;
    if (!variacoes.includes(v)) setVariacoes((c) => [...c, v]);
    setNovaVar("");
  }

  async function handleSubmit() {
    const nome = f.nome_base.trim().toUpperCase();
    const codigo = f.codigo_base.trim();
    if (!nome || !codigo) return;

    let imagem_url: string | null = null;
    if (foto) {
      try {
        setUploading(true);
        imagem_url = await uploadFotoEpi(foto);
      } catch (e: any) {
        toast.error("Falha ao enviar foto: " + e.message);
        setUploading(false);
        return;
      } finally {
        setUploading(false);
      }
    }

    const qtd = Math.max(0, Number(f.qtd_inicial) || 0);
    const min = Math.max(0, Number(f.estoque_minimo) || 0);
    const ca = caNA ? "N/A" : (f.ca.trim() || null);
    const ca_validade = caNA ? null : (f.ca_validade || null);
    const pedido = f.numero_pedido.trim() || null;

    const rows =
      variacoes.length > 0
        ? variacoes.map((v, idx) => ({
            nome_material: `${nome} - ${v}`,
            codigo_material: `${codigo}-${v.replace(/\s+/g, "")}`,
            ca,
            ca_validade,
            numero_pedido: pedido,
            quantidade_atual: qtd,
            estoque_minimo: min,
            imagem_url,
          }))
        : [{
            nome_material: nome,
            codigo_material: codigo,
            ca,
            ca_validade,
            numero_pedido: pedido,
            quantidade_atual: qtd,
            estoque_minimo: min,
            imagem_url,
          }];

    onSubmit(rows);
  }

  const busy = pending || uploading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Novo produto</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Descrição do EPI</Label>
            <Input
              value={f.nome_base}
              onChange={(e) => setF({ ...f, nome_base: e.target.value.toUpperCase() })}
              placeholder="Ex: CALÇA BRIM AZUL MARINHO"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">CA</Label>
                <label className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={caNA} onChange={(e) => setCaNA(e.target.checked)} className="h-3 w-3" />
                  Não Aplicável
                </label>
              </div>
              <Input
                value={caNA ? "N/A" : f.ca}
                onChange={(e) => setF({ ...f, ca: e.target.value })}
                placeholder="Apenas número"
                disabled={caNA}
              />
            </div>
            <div>
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Validade do CA</Label>
              <Input
                type="date"
                value={f.ca_validade}
                onChange={(e) => setF({ ...f, ca_validade: e.target.value })}
                disabled={caNA}
              />
            </div>
            <div>
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Nº do Pedido</Label>
              <Input value={f.numero_pedido} onChange={(e) => setF({ ...f, numero_pedido: e.target.value })} placeholder="Código do pedido externo" />
            </div>
            <div>
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Cód. do Material</Label>
              <Input value={f.codigo_base} onChange={(e) => setF({ ...f, codigo_base: e.target.value })} placeholder="SKU / Ref base" />
            </div>
            <div>
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Tipo (define variações)</Label>
              <Select value={f.tipo} onValueChange={(v) => { setF({ ...f, tipo: v }); setVariacoes([]); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CALÇA">CALÇA (PP–XGG)</SelectItem>
                  <SelectItem value="CAMISA">CAMISA (PP–XGG)</SelectItem>
                  <SelectItem value="BOTA">BOTA (37–44)</SelectItem>
                  <SelectItem value="LUVA">LUVA (modelos)</SelectItem>
                  <SelectItem value="OUTRO">OUTRO / sem variação</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Variações */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Variações</Label>
              <span className="text-[10px] text-slate-400">{variacoes.length} selecionada(s) → 1 linha cada</span>
            </div>

            {presets.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {presets.map((p) => {
                  const on = variacoes.includes(p);
                  return (
                    <button
                      type="button"
                      key={p}
                      onClick={() => toggleVar(p)}
                      className={`px-2.5 py-1 rounded-full text-xs font-bold border transition ${
                        on ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-300 hover:border-slate-500"
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                value={novaVar}
                onChange={(e) => setNovaVar(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNovaVar(); } }}
                placeholder="Adicionar variação manual (ex.: TAM. ÚNICO, 45, MODELO X)"
                className="bg-white"
              />
              <Button type="button" variant="outline" onClick={addNovaVar}>Adicionar</Button>
            </div>

            {variacoes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-200">
                {variacoes.map((v) => (
                  <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                    {v}
                    <button type="button" onClick={() => toggleVar(v)} className="hover:text-emerald-950">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <p className="text-[10px] text-slate-400">
              Sem variação = 1 linha. Com variações = 1 linha por variante (cada uma com saldo independente).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Qtd. inicial (por variação)</Label>
              <Input type="number" min="0" value={f.qtd_inicial} onChange={(e) => setF({ ...f, qtd_inicial: e.target.value })} />
            </div>
            <div>
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Estoque mínimo</Label>
              <Input type="number" min="0" value={f.estoque_minimo} onChange={(e) => setF({ ...f, estoque_minimo: e.target.value })} />
            </div>
          </div>

          {/* Foto */}
          <div>
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Foto do produto (opcional)</Label>
            <div className="flex items-center gap-3 mt-1">
              {foto ? (
                <img src={URL.createObjectURL(foto)} alt="" className="h-16 w-16 rounded object-cover border border-slate-200" />
              ) : (
                <div className="h-16 w-16 rounded border border-dashed border-slate-300 flex items-center justify-center text-slate-300">
                  <ImageIcon className="h-5 w-5" />
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
              />
              <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" /> {foto ? "Trocar" : "Enviar"}
              </Button>
              {foto && (
                <Button type="button" variant="ghost" onClick={() => setFoto(null)}>Remover</Button>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={busy || !f.nome_base.trim() || !f.codigo_base.trim()}
            onClick={handleSubmit}
            className="bg-brand text-white"
          >
            {uploading ? "Enviando foto..." : variacoes.length > 1 ? `Cadastrar ${variacoes.length} itens` : "Cadastrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditItemDialog({ item, onClose, onSubmit, pending, mode = "edit", movsByItem, snapshotByItem, monthStart }: any) {
  const isDup = mode === "duplicate";
  const [f, setF] = useState({ nome_material: "", codigo_material: "", ca: "", ca_validade: "", numero_pedido: "", estoque_minimo: "0", quantidade_atual: "0" });
  const [caNA, setCaNA] = useState(false);
  const [foto, setFoto] = useState<File | null>(null);
  const [removeFoto, setRemoveFoto] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tipo, setTipo] = useState<string>("OUTRO");
  const [variacoes, setVariacoes] = useState<string[]>([]);
  const [novaVar, setNovaVar] = useState("");
  const [baseNome, setBaseNome] = useState("");
  const [baseCodigo, setBaseCodigo] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const { estoqueInicial, qtdEntradas } = (() => {
    if (!item) return { estoqueInicial: 0, qtdEntradas: 0 };
    const inicial = snapshotByItem?.get?.(item.id) ?? 0;
    const arr = movsByItem?.get?.(item.id) ?? [];
    let entradas = 0;
    arr.forEach((m: any) => {
      const d = m.data_entrega ? new Date(m.data_entrega) : null;
      if (monthStart && (!d || d < monthStart)) return;
      if (m.tipo_movimentacao !== "SAIDA_ENTREGA") entradas += (m.quantidade_entregue ?? 0);
    });
    return { estoqueInicial: inicial, qtdEntradas: entradas };
  })();

  useEffect(() => {
    if (item) {
      const isNA = (item.ca ?? "").trim().toUpperCase() === "N/A";
      setCaNA(isNA);
      setF({
        nome_material: item.nome_material ?? "",
        codigo_material: item.codigo_material ?? "",
        ca: isNA ? "" : (item.ca ?? ""),
        ca_validade: item.ca_validade ?? "",
        numero_pedido: item.numero_pedido ?? "",
        estoque_minimo: String(item.estoque_minimo ?? 0),
        quantidade_atual: String(item.quantidade_atual ?? 0),
      });
      setFoto(null);
      setRemoveFoto(false);
      // Detect tipo + base name/code by stripping a trailing " - VAR"
      const nome = (item.nome_material ?? "") as string;
      const codigo = (item.codigo_material ?? "") as string;
      const detected = detectTipoFromName(nome);
      setTipo(detected.tipo);
      setBaseNome(detected.base);
      setVariacoes(detected.variacao ? [detected.variacao] : []);
      // Strip suffix from code as well, if present
      if (detected.variacao) {
        const suf = "-" + detected.variacao.replace(/\s+/g, "");
        setBaseCodigo(codigo.endsWith(suf) ? codigo.slice(0, -suf.length) : codigo);
      } else {
        setBaseCodigo(codigo);
      }
      setNovaVar("");
    }
  }, [item]);

  const presets = TIPO_PRESETS[tipo] ?? [];
  function toggleVar(v: string) {
    if (isDup) {
      setVariacoes((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]));
    } else {
      setVariacoes((cur) => (cur[0] === v ? [] : [v]));
    }
  }
  function addNovaVar() {
    const v = novaVar.trim().toUpperCase();
    if (!v) return;
    if (!variacoes.includes(v)) {
      setVariacoes((c) => (isDup ? [...c, v] : [v]));
    }
    setNovaVar("");
  }

  async function handleSave() {
    let imagem_url: string | null | undefined = undefined;
    if (removeFoto) imagem_url = null;
    if (foto) {
      try {
        setUploading(true);
        imagem_url = await uploadFotoEpi(foto);
      } catch (e: any) {
        toast.error("Falha ao enviar foto: " + e.message);
        setUploading(false);
        return;
      } finally {
        setUploading(false);
      }
    }
    const ca = caNA ? "N/A" : (f.ca.trim() || null);
    const ca_validade = caNA ? null : (f.ca_validade || null);
    const pedido = f.numero_pedido.trim() || null;
    const min = Math.max(0, Number(f.estoque_minimo) || 0);
    const qtd = Math.max(0, Number(f.quantidade_atual) || 0);
    const baseN = (baseNome || f.nome_material).trim().toUpperCase();
    const baseC = (baseCodigo || f.codigo_material).trim();

    if (isDup && variacoes.length > 0) {
      const rows = variacoes.map((v) => ({
        nome_material: `${baseN} - ${v}`,
        codigo_material: `${baseC}-${v.replace(/\s+/g, "")}`,
        ca,
        ca_validade,
        numero_pedido: pedido,
        quantidade_atual: qtd,
        estoque_minimo: min,
        ...(imagem_url !== undefined ? { imagem_url } : {}),
      }));
      onSubmit(rows);
      return;
    }

    // Single row (edit, or duplicate without variations)
    const v = variacoes[0];
    const nome_material = v ? `${baseN} - ${v}` : f.nome_material.trim().toUpperCase();
    const codigo_material = v ? `${baseC}-${v.replace(/\s+/g, "")}` : f.codigo_material.trim();
    const patch: any = {
      nome_material,
      codigo_material,
      ca,
      ca_validade,
      numero_pedido: pedido,
      estoque_minimo: min,
      quantidade_atual: qtd,
    };
    if (imagem_url !== undefined) patch.imagem_url = imagem_url;
    onSubmit(patch);
  }

  const busy = pending || uploading;
  const currentImg = removeFoto ? null : item?.imagem_url;

  return (
    <Dialog open={!!item} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isDup ? "Duplicar produto" : "Editar produto"}</DialogTitle></DialogHeader>
        {item && (
          <div className="space-y-3">
            <div>
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Descrição</Label>
              <Input value={f.nome_material} onChange={(e) => setF({ ...f, nome_material: e.target.value.toUpperCase() })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">CA</Label>
                  <label className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 cursor-pointer">
                    <input type="checkbox" checked={caNA} onChange={(e) => setCaNA(e.target.checked)} className="h-3 w-3" />
                    Não Aplicável
                  </label>
                </div>
                <Input
                  value={caNA ? "N/A" : f.ca}
                  onChange={(e) => setF({ ...f, ca: e.target.value })}
                  disabled={caNA}
                />
              </div>
              <div>
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Validade do CA</Label>
                <Input
                  type="date"
                  value={f.ca_validade}
                  onChange={(e) => setF({ ...f, ca_validade: e.target.value })}
                  disabled={caNA}
                />
              </div>
              <div>
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Estoque Inicial (informativo)</Label>
                <Input value={String(estoqueInicial)} readOnly disabled className="bg-slate-50 font-semibold" />
              </div>
              <div>
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Qtde Entradas (informativo)</Label>
                <Input value={String(qtdEntradas)} readOnly disabled className="bg-slate-50 font-semibold text-emerald-700" />
              </div>
              <div>
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Estoque mínimo</Label>
                <Input type="number" min="0" value={f.estoque_minimo} onChange={(e) => setF({ ...f, estoque_minimo: e.target.value })} />
              </div>
              <div>
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Quantidade em estoque</Label>
                <Input type="number" min="0" value={f.quantidade_atual} onChange={(e) => setF({ ...f, quantidade_atual: e.target.value })} />
              </div>
            </div>
            {/* Variações (tamanho/modelo) */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Variação {isDup ? "(selecione 1 ou várias para criar)" : "(tamanho / modelo)"}
                </Label>
                <span className="text-[10px] text-slate-400">
                  {isDup
                    ? `${variacoes.length} selecionada(s) → ${variacoes.length || 1} novo(s) item(ns)`
                    : variacoes[0]
                      ? `Atual: ${variacoes[0]}`
                      : "Sem variação"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] font-bold uppercase text-slate-500">Tipo</Label>
                  <Select value={tipo} onValueChange={(v) => { setTipo(v); setVariacoes([]); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CALÇA">CALÇA (PP–XGG)</SelectItem>
                      <SelectItem value="CAMISA">CAMISA (PP–XGG)</SelectItem>
                      <SelectItem value="BOTA">BOTA (37–44)</SelectItem>
                      <SelectItem value="LUVA">LUVA (modelos)</SelectItem>
                      <SelectItem value="OUTRO">OUTRO / sem variação</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] font-bold uppercase text-slate-500">Nome base</Label>
                  <Input value={baseNome} onChange={(e) => setBaseNome(e.target.value.toUpperCase())} placeholder="Ex: BOTA DE SEGURANÇA" />
                </div>
              </div>
              {presets.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {presets.map((p) => {
                    const on = variacoes.includes(p);
                    return (
                      <button
                        type="button"
                        key={p}
                        onClick={() => toggleVar(p)}
                        className={`px-2.5 py-1 rounded-full text-xs font-bold border transition ${
                          on ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-300 hover:border-slate-500"
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  value={novaVar}
                  onChange={(e) => setNovaVar(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNovaVar(); } }}
                  placeholder="Adicionar variação manual (ex.: 45, MODELO X)"
                  className="bg-white"
                />
                <Button type="button" variant="outline" onClick={addNovaVar}>Adicionar</Button>
              </div>
              {variacoes.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-200">
                  {variacoes.map((v) => (
                    <span key={v} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                      {v}
                      <button type="button" onClick={() => toggleVar(v)} className="hover:text-emerald-950">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-slate-400">
                {isDup
                  ? "Cada variação cria 1 item independente com saldo próprio. Se nenhuma for selecionada, cria 1 cópia com o nome/código atual."
                  : "A variação selecionada será aplicada ao nome e código do item ao salvar."}
              </p>
            </div>
            <div>
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Foto</Label>
              <div className="flex items-center gap-3 mt-1">
                {foto ? (
                  <img src={URL.createObjectURL(foto)} alt="" className="h-16 w-16 rounded object-cover border border-slate-200" />
                ) : currentImg ? (
                  <img src={currentImg} alt="" className="h-16 w-16 rounded object-cover border border-slate-200" />
                ) : (
                  <div className="h-16 w-16 rounded border border-dashed border-slate-300 flex items-center justify-center text-slate-300">
                    <ImageIcon className="h-5 w-5" />
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => { setFoto(e.target.files?.[0] ?? null); setRemoveFoto(false); }} />
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" /> {currentImg || foto ? "Trocar" : "Enviar"}
                </Button>
                {(currentImg || foto) && (
                  <Button type="button" variant="ghost" onClick={() => { setFoto(null); setRemoveFoto(true); }}>
                    Remover
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={busy || !f.nome_material.trim() || !f.codigo_material.trim()} onClick={handleSave} className="bg-brand text-white">
            {uploading ? "Enviando foto..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MovementDialog({ state, onClose, onSubmit, pending }: any) {
  const [qtd, setQtd] = useState("1");
  const [forn, setForn] = useState("");
  const isEntrada = state?.tipo === "ENTRADA_REPOSICAO";
  return (
    <Dialog open={!!state} onOpenChange={(v) => { if (!v) { onClose(); setQtd("1"); setForn(""); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEntrada ? "Entrada / Reposição" : "Devolução ao estoque"}
          </DialogTitle>
        </DialogHeader>
        {state && (
          <div className="space-y-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="font-black uppercase text-sm">{state.item.nome_material}</div>
              <div className="text-xs text-slate-500 mt-0.5">Saldo atual: {state.item.quantidade_atual}</div>
            </div>
            <div>
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Quantidade</Label>
              <Input type="number" min="1" value={qtd} onChange={(e) => setQtd(e.target.value)} />
            </div>
            {isEntrada && (
              <div>
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Fornecedor (opcional)</Label>
                <Input value={forn} onChange={(e) => setForn(e.target.value)} />
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button
            className={isEntrada ? "bg-emerald-600 text-white" : "bg-amber-600 text-white"}
            disabled={pending || !(Number(qtd) > 0)}
            onClick={() => onSubmit(Number(qtd), forn.trim() || undefined)}
          >
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdjustDialog({ item, onClose, onSubmit, pending }: any) {
  const [novo, setNovo] = useState("0");
  return (
    <Dialog open={!!item} onOpenChange={(v) => { if (!v) { onClose(); setNovo("0"); } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Ajustar saldo</DialogTitle></DialogHeader>
        {item && (
          <div className="space-y-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="font-black uppercase text-sm">{item.nome_material}</div>
              <div className="text-xs text-slate-500 mt-0.5">Saldo atual: {item.quantidade_atual}</div>
            </div>
            <div>
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Novo saldo</Label>
              <Input type="number" min="0" value={novo} onChange={(e) => setNovo(e.target.value)} />
              <p className="text-[10px] text-slate-400 mt-1">Use apenas para correções de inventário (apenas admin).</p>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={pending || Number(novo) < 0} onClick={() => onSubmit(Number(novo))} className="bg-brand text-white">
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({ item, movs, onClose }: { item: Item | null; movs: Movimento[]; onClose: () => void }) {
  const tipoLabel: Record<string, string> = {
    SAIDA_ENTREGA: "Saída (entrega)",
    ENTRADA_REPOSICAO: "Entrada (reposição)",
    DEVOLUCAO: "Devolução",
  };
  return (
    <Dialog open={!!item} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="uppercase">{item?.nome_material}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] uppercase">Data</TableHead>
                <TableHead className="text-[10px] uppercase">Tipo</TableHead>
                <TableHead className="text-[10px] uppercase text-right">Qtd</TableHead>
                <TableHead className="text-[10px] uppercase">Colaborador</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movs.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">Nenhuma movimentação registrada.</TableCell></TableRow>
              )}
              {movs.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="text-xs">{formatDateBR(m.data_entrega)}</TableCell>
                  <TableCell>
                    <Badge className={
                      m.tipo_movimentacao === "SAIDA_ENTREGA" ? "bg-rose-500 text-white"
                      : m.tipo_movimentacao === "ENTRADA_REPOSICAO" ? "bg-emerald-500 text-white"
                      : "bg-amber-500 text-white"
                    }>{tipoLabel[m.tipo_movimentacao]}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {m.tipo_movimentacao === "SAIDA_ENTREGA" ? "-" : "+"}{m.quantidade_entregue}
                  </TableCell>
                  <TableCell className="text-xs">{m.nome_colaborador || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Entrada (reposição) Dialog ---------- */
function EntradaDialog({
  open, onOpenChange, items, onSubmit, pending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  items: Item[];
  onSubmit: (v: { epi_id: string; qtd: number; fornecedor?: string }) => void;
  pending: boolean;
}) {
  const [epiId, setEpiId] = useState<string>("");
  const [qtd, setQtd] = useState<string>("");
  const [fornecedor, setFornecedor] = useState<string>("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) {
      setEpiId(""); setQtd(""); setFornecedor(""); setSearch("");
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) =>
      i.nome_material.toLowerCase().includes(q) ||
      (i.codigo_material ?? "").toLowerCase().includes(q) ||
      (i.ca ?? "").toLowerCase().includes(q),
    );
  }, [items, search]);

  const selected = items.find((i) => i.id === epiId) || null;

  function submit() {
    const n = Number(qtd);
    if (!epiId) { toast.error("Selecione um produto"); return; }
    if (!n || n <= 0) { toast.error("Quantidade inválida"); return; }
    onSubmit({ epi_id: epiId, qtd: n, fornecedor: fornecedor.trim() || undefined });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Dar entrada em estoque</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Buscar produto</Label>
            <div className="relative mt-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nome, código ou CA…"
                className="pl-9"
              />
            </div>
          </div>
          <div>
            <Label>Produto *</Label>
            <Select value={epiId} onValueChange={setEpiId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione um produto existente" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {filtered.length === 0 && (
                  <div className="px-2 py-3 text-xs text-muted-foreground">Nenhum produto encontrado</div>
                )}
                {filtered.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.nome_material}
                    {i.ca ? ` · CA ${i.ca}` : ""}
                    {` · saldo ${i.quantidade_atual}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected && (
              <div className="text-[11px] text-slate-500 mt-1">
                Saldo atual: <b>{selected.quantidade_atual}</b>
                {selected.ultimo_fornecedor ? ` · último fornecedor: ${selected.ultimo_fornecedor}` : ""}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Quantidade *</Label>
              <Input
                type="number"
                min={1}
                value={qtd}
                onChange={(e) => setQtd(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Fornecedor</Label>
              <Input
                value={fornecedor}
                onChange={(e) => setFornecedor(e.target.value)}
                placeholder="Opcional"
                className="mt-1"
              />
            </div>
          </div>
          {selected && Number(qtd) > 0 && (
            <div className="rounded-md bg-emerald-50 border border-emerald-200 p-2 text-xs text-emerald-800">
              Novo saldo após entrada: <b>{selected.quantidade_atual + Number(qtd)}</b>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={pending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <ArrowDownToLine className="h-4 w-4 mr-2" />
            {pending ? "Registrando…" : "Registrar entrada"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
