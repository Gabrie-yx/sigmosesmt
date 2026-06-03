import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  AlertTriangle,
  Package,
  Plus,
  ImageIcon,
  CheckCircle2,
  AlertCircle,
  Truck,
  PackagePlus,
  Undo2,
  Search,
  Pencil,
  Save,
  X,
  ShieldCheck,
  Upload,
  User,
  Warehouse,
  History,
  Download,
  FileText,
  Printer,
} from "lucide-react";
import { PDFPreviewDialog } from "@/components/pdf-preview-dialog";
import { gerarPdfEntregasEpi, type EntregaRow } from "@/lib/epi-entregas-pdf";
import { gerarPdfCatalogoEpi } from "@/lib/epi-catalogo-pdf";
import type jsPDF from "jspdf";

export const Route = createFileRoute("/app/estoque/epi")({
  component: EstoqueEpiPage,
});

type Tipo = "SAIDA_ENTREGA" | "ENTRADA_REPOSICAO" | "DEVOLUCAO";

type EpiRow = {
  id: string;
  codigo_material: string;
  nome_material: string;
  quantidade_atual: number;
  estoque_minimo: number;
  imagem_url: string | null;
  ultimo_fornecedor: string | null;
};

type Movimentacao = {
  id: string;
  cpf_colaborador: string;
  nome_colaborador: string;
  epi_id: string;
  quantidade_entregue: number;
  data_entrega: string;
  tipo_movimentacao: Tipo;
  estoque_epi?: { nome_material: string; codigo_material: string } | null;
};

// ───────────────────────── helpers ─────────────────────────

function maskCpf(v: string) {
  return v
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

/** Valida CPF pelo algoritmo dos dois dígitos verificadores. */
function validaCpf(raw: string): boolean {
  const cpf = raw.replace(/\D/g, "");
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (slice: number) => {
    let sum = 0;
    for (let i = 0; i < slice; i++) sum += parseInt(cpf[i], 10) * (slice + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === parseInt(cpf[9], 10) && calc(10) === parseInt(cpf[10], 10);
}

function statusInfo(saldo: number, minimo: number) {
  if (saldo <= minimo)
    return {
      label: "ESTOQUE CRÍTICO",
      cls: "bg-destructive text-destructive-foreground",
      icon: AlertTriangle,
      cardCls: "border-destructive border-2 bg-destructive/5 animate-pulse-critical",
    };
  if (saldo <= 10)
    return {
      label: "ESTOQUE MODERADO",
      cls: "bg-amber-500 text-white",
      icon: AlertCircle,
      cardCls: "border-amber-400/60 border-2",
    };
  return {
    label: "ESTOQUE OK",
    cls: "bg-emerald-600 text-white",
    icon: CheckCircle2,
    cardCls: "",
  };
}

const TIPO_LABEL: Record<Tipo, string> = {
  SAIDA_ENTREGA: "Saída · Entrega",
  ENTRADA_REPOSICAO: "Entrada · Reposição",
  DEVOLUCAO: "Devolução",
};

// ───────────────────────── page ─────────────────────────

export function EstoqueEpiPage() {
  const qc = useQueryClient();

  const { data: epis = [], isLoading } = useQuery({
    queryKey: ["estoque_epi"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("estoque_epi")
        .select("*")
        .order("nome_material");
      if (error) throw error;
      return (data ?? []) as EpiRow[];
    },
  });

  const criticos = epis.filter((e) => e.quantidade_atual <= e.estoque_minimo).length;
  const totalItens = epis.reduce((s, e) => s + e.quantidade_atual, 0);

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Estoque de EPIs — SESMT
          </h1>
          <p className="text-sm text-muted-foreground">
            Inventário visual, baixa atômica por entrega e histórico completo de movimentações.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link to="/app/estoque/sesmt">
              <Warehouse className="h-4 w-4" />
              Painel de Estoque SESMT
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (!epis.length) {
                toast.info("Nenhum EPI cadastrado para exportar");
                return;
              }
              const doc = gerarPdfCatalogoEpi(epis as any);
              doc.save(`catalogo-epis-${new Date().toISOString().slice(0, 10)}.pdf`);
            }}
          >
            <FileText className="h-4 w-4" />
            Exportar Catálogo (PDF)
          </Button>
          <NewEpiDialog onCreated={() => qc.invalidateQueries({ queryKey: ["estoque_epi"] })} />
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Itens cadastrados
          </div>
          <div className="text-2xl font-black">{epis.length}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Unidades em estoque
          </div>
          <div className="text-2xl font-black">{totalItens}</div>
        </Card>
        <Card className={`p-3 ${criticos > 0 ? "border-destructive/40 bg-destructive/5" : ""}`}>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Itens críticos
          </div>
          <div className={`text-2xl font-black ${criticos > 0 ? "text-destructive" : ""}`}>
            {criticos}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Mínimo padrão
          </div>
          <div className="text-2xl font-black">5</div>
        </Card>
      </div>

      <Tabs defaultValue="inventario">
        <TabsList>
          <TabsTrigger value="inventario">Inventário</TabsTrigger>
          <TabsTrigger value="colaborador">Consulta por Colaborador</TabsTrigger>
          <TabsTrigger value="historico">Histórico Geral</TabsTrigger>
          <TabsTrigger value="entregas">Ficha de Entregas (NR-06)</TabsTrigger>
        </TabsList>

        <TabsContent value="inventario" className="mt-4">
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-10 text-center">Carregando…</div>
          ) : epis.length === 0 ? (
            <Card className="p-10 text-center text-sm text-muted-foreground">
              Nenhum EPI cadastrado. Clique em <strong>“Novo EPI”</strong> para começar.
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {epis.map((e) => (
                <EpiCard key={e.id} epi={e} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <HistoricoGeral epis={epis} />
        </TabsContent>

        <TabsContent value="colaborador" className="mt-4">
          <ConsultaColaborador />
        </TabsContent>

        <TabsContent value="entregas" className="mt-4">
          <EntregasFichaReport />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ───────────────────────── EPI Card ─────────────────────────

function EpiCard({ epi }: { epi: EpiRow }) {
  const { isAdmin } = useAuth();
  const status = statusInfo(epi.quantidade_atual, epi.estoque_minimo);
  const Icon = status.icon;

  return (
    <Card className={`overflow-hidden transition-all hover:shadow-md ${status.cardCls}`}>
      <div className="aspect-square bg-muted/40 flex items-center justify-center overflow-hidden relative">
        {epi.imagem_url ? (
          <img
            src={epi.imagem_url}
            alt={epi.nome_material}
            className="h-full w-full object-cover"
            onError={(ev) => {
              (ev.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <Package className="h-16 w-16 text-muted-foreground/40" />
        )}
        <div
          className={`absolute top-2 left-2 right-2 flex items-center justify-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-widest shadow ${status.cls}`}
        >
          <Icon className="h-3.5 w-3.5" /> {status.label}
        </div>
      </div>
      <div className="p-3 space-y-2">
        <div>
          <div className="font-bold text-sm leading-tight line-clamp-2">{epi.nome_material}</div>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Saldo
            </div>
            {isAdmin ? (
              <SaldoInlineEdit epi={epi} />
            ) : (
              <div className="text-2xl font-black">{epi.quantidade_atual}</div>
            )}
          </div>
          <Badge variant="outline" className="text-[10px]">
            mín {epi.estoque_minimo}
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <DeliveryDialog epi={epi} />
          <EntradaDialog epi={epi} />
        </div>
        <HistoricoEpiDialog epi={epi} />
        <div className="pt-2 border-t border-border/60 text-[10px] text-muted-foreground space-y-0.5">
          <div>
            <span className="font-bold">Cód.:</span> {epi.codigo_material}
          </div>
          <div className="truncate">
            <span className="font-bold">Últ. fornecedor:</span> {epi.ultimo_fornecedor || "—"}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ───────────────────────── Inline edit (admin) ─────────────────────────

function SaldoInlineEdit({ epi }: { epi: EpiRow }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(epi.quantidade_atual);

  const mut = useMutation({
    mutationFn: async () => {
      if (val < 0) throw new Error("Saldo não pode ser negativo");
      const { error } = await (supabase as any).rpc("ajustar_saldo_epi", {
        _epi_id: epi.id,
        _novo_saldo: val,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saldo ajustado");
      qc.invalidateQueries({ queryKey: ["estoque_epi"] });
      setEditing(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setVal(epi.quantidade_atual);
          setEditing(true);
        }}
        title="Ajustar saldo (admin)"
        className="text-2xl font-black hover:text-primary inline-flex items-center gap-1 group"
      >
        {epi.quantidade_atual}
        <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        type="number"
        min={0}
        value={val}
        onChange={(e) => setVal(Math.max(0, Number(e.target.value) || 0))}
        className="h-8 w-20"
        autoFocus
      />
      <Button size="icon" className="h-7 w-7" onClick={() => mut.mutate()} disabled={mut.isPending}>
        <Save className="h-3.5 w-3.5" />
      </Button>
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(false)}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ───────────────────────── Entrega (saída) ─────────────────────────

function DeliveryDialog({ epi }: { epi: EpiRow }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [cpf, setCpf] = useState("");
  const [nome, setNome] = useState("");
  const [qtd, setQtd] = useState<number>(1);

  const cpfValido = validaCpf(cpf);
  const nomeValido = nome.trim().length >= 3;
  const qtdValida = qtd > 0 && qtd <= epi.quantidade_atual;
  const semSaldo = qtd > epi.quantidade_atual;
  const podeConfirmar = cpfValido && nomeValido && qtdValida;

  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).rpc("registrar_entrega_epi", {
        _epi_id: epi.id,
        _cpf: cpf.replace(/\D/g, ""),
        _nome: nome.trim().toUpperCase().slice(0, 120),
        _qtd: qtd,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Baixa realizada com sucesso!");
      qc.invalidateQueries({ queryKey: ["estoque_epi"] });
      qc.invalidateQueries({ queryKey: ["historico_movimentacoes"] });
      setCpf("");
      setNome("");
      setQtd(1);
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          disabled={epi.quantidade_atual <= 0}
          variant={epi.quantidade_atual <= 0 ? "outline" : "default"}
        >
          <Truck className="h-3.5 w-3.5" /> Entrega
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" /> Entrega de EPI — {epi.nome_material}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md border bg-muted/40 p-2 text-xs">
            <span className="font-bold">Saldo disponível: </span>
            <span className={epi.quantidade_atual <= 5 ? "text-destructive font-black" : "font-black"}>
              {epi.quantidade_atual}
            </span>
          </div>
          <div>
            <Label>CPF do colaborador</Label>
            <Input
              value={cpf}
              onChange={(e) => setCpf(maskCpf(e.target.value))}
              placeholder="000.000.000-00"
              inputMode="numeric"
              maxLength={14}
              className={cpf && !cpfValido ? "border-destructive" : ""}
            />
            {cpf && !cpfValido && (
              <p className="text-[11px] text-destructive mt-1">CPF inválido</p>
            )}
          </div>
          <div>
            <Label>Nome completo do colaborador</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value.slice(0, 120))}
              placeholder="Nome completo"
            />
          </div>
          <div>
            <Label>Quantidade a entregar</Label>
            <Input
              type="number"
              min={1}
              max={epi.quantidade_atual}
              value={qtd}
              onChange={(e) => setQtd(Math.max(1, Number(e.target.value) || 1))}
              className={semSaldo ? "border-destructive" : ""}
            />
            {semSaldo && (
              <p className="text-[11px] text-destructive mt-1 font-bold">Saldo insuficiente</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={() => mut.mutate()} disabled={!podeConfirmar || mut.isPending}>
            {mut.isPending ? "Registrando…" : "Confirmar entrega"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────── Entrada / Devolução ─────────────────────────

function EntradaDialog({ epi }: { epi: EpiRow }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<Exclude<Tipo, "SAIDA_ENTREGA">>("ENTRADA_REPOSICAO");
  const [qtd, setQtd] = useState(1);
  const [fornecedor, setFornecedor] = useState("");
  const [cpf, setCpf] = useState("");
  const [nome, setNome] = useState("");

  const isDev = tipo === "DEVOLUCAO";
  const cpfOk = !isDev || validaCpf(cpf);
  const nomeOk = !isDev || nome.trim().length >= 3;
  const podeSalvar = qtd > 0 && cpfOk && nomeOk;

  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).rpc("registrar_movimentacao_epi", {
        _epi_id: epi.id,
        _qtd: qtd,
        _tipo: tipo,
        _cpf: isDev ? cpf.replace(/\D/g, "") : null,
        _nome: isDev ? nome.trim().toUpperCase().slice(0, 120) : null,
        _fornecedor: tipo === "ENTRADA_REPOSICAO" ? fornecedor.trim().slice(0, 120) || null : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Movimentação registrada!");
      qc.invalidateQueries({ queryKey: ["estoque_epi"] });
      qc.invalidateQueries({ queryKey: ["historico_movimentacoes"] });
      setOpen(false);
      setQtd(1);
      setFornecedor("");
      setCpf("");
      setNome("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <PackagePlus className="h-3.5 w-3.5" /> Entrada
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Entrada de estoque — {epi.nome_material}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Tipo de movimentação</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ENTRADA_REPOSICAO">
                  <span className="inline-flex items-center gap-2">
                    <PackagePlus className="h-3.5 w-3.5" /> Entrada / Reposição
                  </span>
                </SelectItem>
                <SelectItem value="DEVOLUCAO">
                  <span className="inline-flex items-center gap-2">
                    <Undo2 className="h-3.5 w-3.5" /> Devolução de colaborador
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Quantidade</Label>
            <Input
              type="number"
              min={1}
              value={qtd}
              onChange={(e) => setQtd(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
          {tipo === "ENTRADA_REPOSICAO" && (
            <div>
              <Label>Fornecedor</Label>
              <Input
                value={fornecedor}
                onChange={(e) => setFornecedor(e.target.value.slice(0, 120))}
                placeholder="Ex.: 3M, Marluvas, etc."
              />
            </div>
          )}
          {isDev && (
            <>
              <div>
                <Label>CPF do colaborador (devolvendo)</Label>
                <Input
                  value={cpf}
                  onChange={(e) => setCpf(maskCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  className={cpf && !cpfOk ? "border-destructive" : ""}
                />
                {cpf && !cpfOk && (
                  <p className="text-[11px] text-destructive mt-1">CPF inválido</p>
                )}
              </div>
              <div>
                <Label>Nome do colaborador</Label>
                <Input
                  value={nome}
                  onChange={(e) => setNome(e.target.value.slice(0, 120))}
                  placeholder="Nome completo"
                />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={() => mut.mutate()} disabled={!podeSalvar || mut.isPending}>
            {mut.isPending ? "Salvando…" : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────── Novo EPI ─────────────────────────

function NewEpiDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [qtd, setQtd] = useState(0);
  const [min, setMin] = useState(5);
  const [img, setImg] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function handleUpload(file: File) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem maior que 5MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("epis-fotos")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("epis-fotos").getPublicUrl(path);
      setImg(data.publicUrl);
      toast.success("Foto enviada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro no upload");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!codigo.trim() || !nome.trim()) {
      toast.error("Informe código e nome do EPI");
      return;
    }
    setSaving(true);
    try {
      const { error } = await (supabase as any).from("estoque_epi").insert({
        codigo_material: codigo.trim().toUpperCase().slice(0, 60),
        nome_material: nome.trim().toUpperCase().slice(0, 200),
        quantidade_atual: Math.max(0, qtd),
        estoque_minimo: Math.max(0, min),
        imagem_url: img.trim() || null,
        ultimo_fornecedor: fornecedor.trim().slice(0, 120) || null,
      });
      if (error) throw error;
      toast.success("EPI cadastrado");
      setCodigo("");
      setNome("");
      setQtd(0);
      setMin(5);
      setImg("");
      setFornecedor("");
      setOpen(false);
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao cadastrar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" /> Novo EPI
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cadastrar novo EPI</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Código do material</Label>
            <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="EPI-001" />
          </div>
          <div className="col-span-2">
            <Label>Nome do material</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Capacete classe B" />
          </div>
          <div>
            <Label>Quantidade inicial</Label>
            <Input type="number" min={0} value={qtd} onChange={(e) => setQtd(Number(e.target.value) || 0)} />
          </div>
          <div>
            <Label>Estoque mínimo</Label>
            <Input type="number" min={0} value={min} onChange={(e) => setMin(Number(e.target.value) || 0)} />
          </div>
          <div className="col-span-2">
            <Label>Fornecedor padrão (opcional)</Label>
            <Input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} placeholder="Ex.: 3M" />
          </div>
          <div className="col-span-2">
            <Label className="flex items-center gap-1">
              <ImageIcon className="h-3.5 w-3.5" /> URL da imagem (opcional)
            </Label>
            <Input value={img} onChange={(e) => setImg(e.target.value)} placeholder="https://…" />
            <div className="mt-2 flex items-center gap-2">
              <label className="inline-flex items-center gap-2 text-xs cursor-pointer rounded-md border px-3 py-1.5 hover:bg-muted">
                <Upload className="h-3.5 w-3.5" />
                {uploading ? "Enviando…" : "Enviar foto do EPI"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                  }}
                />
              </label>
              {img && (
                <img src={img} alt="preview" className="h-10 w-10 object-cover rounded border" />
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Salvando…" : "Cadastrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────── Consulta por Colaborador (Dossiê) ─────────────────────────

export function ConsultaColaborador() {
  const [cpfBusca, setCpfBusca] = useState("");
  const cpfDigits = cpfBusca.replace(/\D/g, "");
  const cpfValido = validaCpf(cpfBusca);

  const { data = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["dossie_colaborador", cpfDigits],
    enabled: cpfDigits.length === 11 && cpfValido,
    queryFn: async () => {
      const seisMesesAtras = new Date();
      seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6);
      const { data, error } = await (supabase as any)
        .from("historico_entregas")
        .select("*, estoque_epi(nome_material, codigo_material)")
        .eq("cpf_colaborador", cpfDigits)
        .gte("data_entrega", seisMesesAtras.toISOString())
        .order("data_entrega", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Movimentacao[];
    },
  });

  const nomeColaborador = data[0]?.nome_colaborador;
  const totalEntregue = data
    .filter((m) => m.tipo_movimentacao === "SAIDA_ENTREGA")
    .reduce((s, m) => s + m.quantidade_entregue, 0);
  const totalDevolvido = data
    .filter((m) => m.tipo_movimentacao === "DEVOLUCAO")
    .reduce((s, m) => s + m.quantidade_entregue, 0);

  // Agrupa por EPI
  const porEpi = useMemo(() => {
    const map = new Map<string, { nome: string; codigo: string; entregue: number; devolvido: number; ultima: string }>();
    for (const m of data) {
      const k = m.epi_id;
      const cur = map.get(k) ?? {
        nome: m.estoque_epi?.nome_material ?? "—",
        codigo: m.estoque_epi?.codigo_material ?? "",
        entregue: 0,
        devolvido: 0,
        ultima: m.data_entrega,
      };
      if (m.tipo_movimentacao === "SAIDA_ENTREGA") cur.entregue += m.quantidade_entregue;
      if (m.tipo_movimentacao === "DEVOLUCAO") cur.devolvido += m.quantidade_entregue;
      if (new Date(m.data_entrega) > new Date(cur.ultima)) cur.ultima = m.data_entrega;
      map.set(k, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.entregue - a.entregue);
  }, [data]);

  return (
    <Card className="p-4 space-y-4">
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[240px]">
          <Label className="flex items-center gap-1">
            <User className="h-3.5 w-3.5" /> CPF do colaborador
          </Label>
          <Input
            value={cpfBusca}
            onChange={(e) => setCpfBusca(maskCpf(e.target.value))}
            placeholder="000.000.000-00"
            inputMode="numeric"
            maxLength={14}
            className={cpfBusca && !cpfValido ? "border-destructive" : ""}
          />
          {cpfBusca && !cpfValido && (
            <p className="text-[11px] text-destructive mt-1">CPF inválido</p>
          )}
        </div>
        <Button onClick={() => refetch()} disabled={!cpfValido || isFetching}>
          <Search className="h-4 w-4" /> {isFetching ? "Buscando…" : "Buscar"}
        </Button>
      </div>

      {!cpfValido ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          Digite um CPF válido para gerar o dossiê dos últimos 6 meses.
        </div>
      ) : isLoading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Carregando…</div>
      ) : data.length === 0 ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          Nenhuma movimentação encontrada para este CPF nos últimos 6 meses.
        </div>
      ) : (
        <>
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Colaborador
            </div>
            <div className="font-bold text-base">{nomeColaborador}</div>
            <div className="text-xs text-muted-foreground font-mono">{maskCpf(cpfDigits)}</div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Card className="p-2 text-center">
              <div className="text-[10px] uppercase text-muted-foreground">Movimentações</div>
              <div className="text-xl font-black">{data.length}</div>
            </Card>
            <Card className="p-2 text-center">
              <div className="text-[10px] uppercase text-muted-foreground">Entregues</div>
              <div className="text-xl font-black text-destructive">{totalEntregue}</div>
            </Card>
            <Card className="p-2 text-center">
              <div className="text-[10px] uppercase text-muted-foreground">Devolvidos</div>
              <div className="text-xl font-black text-amber-600">{totalDevolvido}</div>
            </Card>
          </div>

          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
              Resumo por EPI
            </div>
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-[10px] uppercase tracking-widest text-muted-foreground">
                  <tr>
                    <th className="text-left py-2 px-2">EPI</th>
                    <th className="text-right py-2 px-2">Entregue</th>
                    <th className="text-right py-2 px-2">Devolvido</th>
                    <th className="text-left py-2 px-2">Última</th>
                  </tr>
                </thead>
                <tbody>
                  {porEpi.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="py-2 px-2">
                        {r.nome}{" "}
                        <span className="text-[10px] text-muted-foreground">{r.codigo}</span>
                      </td>
                      <td className="py-2 px-2 text-right font-bold">{r.entregue}</td>
                      <td className="py-2 px-2 text-right">{r.devolvido}</td>
                      <td className="py-2 px-2 text-xs">
                        {new Date(r.ultima).toLocaleDateString("pt-BR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
              Linha do tempo
            </div>
            <div className="border rounded-md max-h-[40vh] overflow-auto">
              <table className="w-full text-sm">
                <tbody>
                  {data.map((h) => (
                    <tr key={h.id} className="border-b hover:bg-muted/30">
                      <td className="py-2 px-2 text-xs whitespace-nowrap">
                        {new Date(h.data_entrega).toLocaleString("pt-BR")}
                      </td>
                      <td className="py-2 px-2">
                        <Badge
                          variant="outline"
                          className={
                            h.tipo_movimentacao === "SAIDA_ENTREGA"
                              ? "border-destructive/40 text-destructive"
                              : h.tipo_movimentacao === "DEVOLUCAO"
                                ? "border-amber-500/40 text-amber-700"
                                : "border-emerald-500/40 text-emerald-700"
                          }
                        >
                          {TIPO_LABEL[h.tipo_movimentacao]}
                        </Badge>
                      </td>
                      <td className="py-2 px-2">
                        {h.estoque_epi?.nome_material ?? "—"}
                      </td>
                      <td className="py-2 px-2 text-right font-bold">
                        {h.tipo_movimentacao === "SAIDA_ENTREGA" ? "−" : "+"}
                        {h.quantidade_entregue}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

// ───────────────────────── Histórico Geral ─────────────────────────

function HistoricoGeral({ epis }: { epis: EpiRow[] }) {
  const [filtroCpf, setFiltroCpf] = useState("");
  const [filtroEpi, setFiltroEpi] = useState<string>("todos");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");

  const { data = [], isLoading } = useQuery({
    queryKey: ["historico_movimentacoes"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("historico_entregas")
        .select("*, estoque_epi(nome_material, codigo_material)")
        .order("data_entrega", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Movimentacao[];
    },
  });

  const filtrado = useMemo(() => {
    const cpfDigits = filtroCpf.replace(/\D/g, "");
    return data.filter((m) => {
      if (filtroEpi !== "todos" && m.epi_id !== filtroEpi) return false;
      if (filtroTipo !== "todos" && m.tipo_movimentacao !== filtroTipo) return false;
      if (cpfDigits && !m.cpf_colaborador.includes(cpfDigits)) return false;
      return true;
    });
  }, [data, filtroCpf, filtroEpi, filtroTipo]);

  return (
    <Card className="p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={filtroCpf}
            onChange={(e) => setFiltroCpf(maskCpf(e.target.value))}
            placeholder="Filtrar por CPF"
            className="pl-8"
          />
        </div>
        <Select value={filtroEpi} onValueChange={setFiltroEpi}>
          <SelectTrigger>
            <SelectValue placeholder="EPI" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os EPIs</SelectItem>
            {epis.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.nome_material}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger>
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            <SelectItem value="SAIDA_ENTREGA">Saída · Entrega</SelectItem>
            <SelectItem value="ENTRADA_REPOSICAO">Entrada · Reposição</SelectItem>
            <SelectItem value="DEVOLUCAO">Devolução</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="text-xs text-muted-foreground">
        Exibindo <strong>{filtrado.length}</strong> de {data.length} movimentações
      </div>

      <div className="max-h-[60vh] overflow-auto border rounded-md">
        {isLoading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Carregando…</div>
        ) : filtrado.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            Nenhuma movimentação encontrada com esses filtros.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background border-b">
              <tr className="text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="py-2 px-2">Data</th>
                <th className="py-2 px-2">Tipo</th>
                <th className="py-2 px-2">CPF</th>
                <th className="py-2 px-2">Colaborador</th>
                <th className="py-2 px-2">EPI</th>
                <th className="py-2 px-2 text-right">Qtd</th>
              </tr>
            </thead>
            <tbody>
              {filtrado.map((h) => (
                <tr key={h.id} className="border-b hover:bg-muted/30">
                  <td className="py-2 px-2 whitespace-nowrap">
                    {new Date(h.data_entrega).toLocaleString("pt-BR")}
                  </td>
                  <td className="py-2 px-2">
                    <Badge
                      variant="outline"
                      className={
                        h.tipo_movimentacao === "SAIDA_ENTREGA"
                          ? "border-destructive/40 text-destructive"
                          : h.tipo_movimentacao === "ENTRADA_REPOSICAO"
                            ? "border-emerald-500/40 text-emerald-700"
                            : "border-amber-500/40 text-amber-700"
                      }
                    >
                      {TIPO_LABEL[h.tipo_movimentacao]}
                    </Badge>
                  </td>
                  <td className="py-2 px-2 font-mono text-xs">
                    {h.cpf_colaborador ? maskCpf(h.cpf_colaborador) : "—"}
                  </td>
                  <td className="py-2 px-2">{h.nome_colaborador || "—"}</td>
                  <td className="py-2 px-2">
                    {h.estoque_epi?.nome_material ?? "—"}
                    <span className="text-[10px] text-muted-foreground ml-1">
                      {h.estoque_epi?.codigo_material}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-right font-bold">
                    {h.tipo_movimentacao === "SAIDA_ENTREGA" ? "−" : "+"}
                    {h.quantidade_entregue}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}
// ───────────────────────── Histórico por EPI ─────────────────────────

function HistoricoEpiDialog({ epi }: { epi: EpiRow }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busca, setBusca] = useState("");

  const { data = [], isLoading } = useQuery({
    queryKey: ["historico-por-epi", epi.id, from, to],
    enabled: open,
    queryFn: async () => {
      let q = supabase
        .from("historico_entregas")
        .select("id, cpf_colaborador, nome_colaborador, quantidade_entregue, data_entrega, tipo_movimentacao, created_by")
        .eq("epi_id", epi.id)
        .order("data_entrega", { ascending: false })
        .limit(1000);
      if (from) q = q.gte("data_entrega", from);
      if (to) q = q.lte("data_entrega", to + "T23:59:59");
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return data;
    return data.filter((m: any) =>
      [m.nome_colaborador, m.cpf_colaborador].filter(Boolean).some((x: string) => x.toLowerCase().includes(t))
    );
  }, [data, busca]);

  const totais = useMemo(() => {
    let entregue = 0, entrada = 0, devolucao = 0;
    for (const m of filtradas as any[]) {
      if (m.tipo_movimentacao === "SAIDA_ENTREGA") entregue += m.quantidade_entregue;
      else if (m.tipo_movimentacao === "ENTRADA_REPOSICAO") entrada += m.quantidade_entregue;
      else if (m.tipo_movimentacao === "DEVOLUCAO") devolucao += m.quantidade_entregue;
    }
    return { entregue, entrada, devolucao };
  }, [filtradas]);

  function exportCsv() {
    const linhas = [
      ["Data", "Tipo", "CPF", "Nome", "Quantidade"].join(";"),
      ...(filtradas as any[]).map((m) => [
        new Date(m.data_entrega).toLocaleString("pt-BR"),
        m.tipo_movimentacao,
        m.cpf_colaborador ? maskCpf(m.cpf_colaborador) : "",
        (m.nome_colaborador ?? "").replace(/;/g, ","),
        m.quantidade_entregue,
      ].join(";")),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + linhas], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historico_${epi.codigo_material}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const tipoBadge = (t: Tipo) =>
    t === "SAIDA_ENTREGA"
      ? <Badge className="bg-blue-100 text-blue-800 border-blue-200">Entrega</Badge>
      : t === "ENTRADA_REPOSICAO"
      ? <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Entrada</Badge>
      : <Badge className="bg-amber-100 text-amber-800 border-amber-200">Devolução</Badge>;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
          <History className="h-3.5 w-3.5" /> Ver entregas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-blue-600" />
            Histórico — {epi.nome_material}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <div>
            <Label className="text-[10px] uppercase">De</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-[10px] uppercase">Até</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <Label className="text-[10px] uppercase">Buscar colaborador</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Nome ou CPF…" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md border bg-blue-50 p-2">
            <div className="text-[10px] uppercase text-blue-700 font-bold">Entregue</div>
            <div className="text-xl font-black text-blue-800">{totais.entregue}</div>
          </div>
          <div className="rounded-md border bg-emerald-50 p-2">
            <div className="text-[10px] uppercase text-emerald-700 font-bold">Entradas</div>
            <div className="text-xl font-black text-emerald-800">{totais.entrada}</div>
          </div>
          <div className="rounded-md border bg-amber-50 p-2">
            <div className="text-[10px] uppercase text-amber-700 font-bold">Devoluções</div>
            <div className="text-xl font-black text-amber-800">{totais.devolucao}</div>
          </div>
        </div>

        <div className="max-h-[50vh] overflow-y-auto rounded-md border">
          {isLoading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Carregando…</div>
          ) : filtradas.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Nenhuma movimentação encontrada.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 sticky top-0">
                <tr className="text-left text-[11px] uppercase tracking-wider">
                  <th className="py-2 px-2">Data</th>
                  <th className="py-2 px-2">Tipo</th>
                  <th className="py-2 px-2">CPF</th>
                  <th className="py-2 px-2">Colaborador</th>
                  <th className="py-2 px-2 text-right">Qtd</th>
                </tr>
              </thead>
              <tbody>
                {(filtradas as any[]).map((m) => (
                  <tr key={m.id} className="border-t hover:bg-muted/30">
                    <td className="py-2 px-2 text-xs">{new Date(m.data_entrega).toLocaleString("pt-BR")}</td>
                    <td className="py-2 px-2">{tipoBadge(m.tipo_movimentacao)}</td>
                    <td className="py-2 px-2 font-mono text-xs">
                      {m.cpf_colaborador ? maskCpf(m.cpf_colaborador) : "—"}
                    </td>
                    <td className="py-2 px-2">{m.nome_colaborador || "—"}</td>
                    <td className="py-2 px-2 text-right font-bold">
                      {m.tipo_movimentacao === "SAIDA_ENTREGA" ? "−" : "+"}{m.quantidade_entregue}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={exportCsv} disabled={filtradas.length === 0} className="gap-1.5">
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>
          <Button onClick={() => setOpen(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────── Ficha de Entregas (NR-06) ─────────────────────────

type EntregaJoined = {
  id: string;
  employee_id: string;
  item: string | null;
  ca: string | null;
  tamanho: string | null;
  qtd: number | null;
  data_entrega: string | null;
  motivo_entrega: string | null;
  employees?: {
    nome: string | null;
    matricula: string | null;
    cpf: string | null;
    role_id: string | null;
    company_id: string | null;
  } | null;
};

const MOTIVO_LABEL_UI: Record<string, string> = {
  PRIMEIRA_ENTREGA: "1ª Entrega",
  TROCA_DESGASTE: "Troca",
  EMPRESTIMO: "Empréstimo",
  PERDA_EXTRAVIO: "Perda/Extravio",
};

const MOTIVO_BADGE: Record<string, string> = {
  PRIMEIRA_ENTREGA: "border-emerald-500/40 text-emerald-700",
  TROCA_DESGASTE: "border-sky-500/40 text-sky-700",
  EMPRESTIMO: "border-amber-500/40 text-amber-700",
  PERDA_EXTRAVIO: "border-destructive/40 text-destructive",
};

function fmtDateBR(d?: string | null) {
  if (!d) return "—";
  const s = d.split("T")[0];
  const [y, m, day] = s.split("-");
  return y && m && day ? `${day}/${m}/${y}` : d;
}

function EntregasFichaReport() {
  const hoje = new Date();
  const trintaDias = new Date(hoje); trintaDias.setDate(hoje.getDate() - 30);
  const [from, setFrom] = useState(trintaDias.toISOString().slice(0, 10));
  const [to, setTo] = useState(hoje.toISOString().slice(0, 10));
  const [busca, setBusca] = useState("");
  const [filtroMotivo, setFiltroMotivo] = useState<string>("todos");
  const [filtroEpi, setFiltroEpi] = useState<string>("todos");
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfDoc, setPdfDoc] = useState<jsPDF | null>(null);

  const { data: entregas = [], isLoading } = useQuery({
    queryKey: ["epi_entregas_ficha", from, to],
    refetchInterval: 30_000,
    queryFn: async () => {
      let q = (supabase as any)
        .from("epi_deliveries")
        .select("id, employee_id, item, ca, tamanho, qtd, data_entrega, motivo_entrega, employees(nome, matricula, cpf, role_id, company_id)")
        .order("data_entrega", { ascending: false })
        .limit(2000);
      if (from) q = q.gte("data_entrega", from);
      if (to) q = q.lte("data_entrega", to);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as EntregaJoined[];
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["roles_simple"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("roles").select("id, nome");
      return (data ?? []) as { id: string; nome: string }[];
    },
  });
  const { data: companies = [] } = useQuery({
    queryKey: ["companies_simple"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("companies").select("id, nome");
      return (data ?? []) as { id: string; nome: string }[];
    },
  });
  const roleMap = useMemo(() => new Map(roles.map((r) => [r.id, r.nome])), [roles]);
  const companyMap = useMemo(() => new Map(companies.map((c) => [c.id, c.nome])), [companies]);

  const epiOptions = useMemo(() => {
    const set = new Set<string>();
    entregas.forEach((e) => e.item && set.add(e.item));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [entregas]);

  const rows: EntregaRow[] = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return entregas
      .filter((e) => {
        if (filtroMotivo !== "todos" && (e.motivo_entrega ?? "") !== filtroMotivo) return false;
        if (filtroEpi !== "todos" && (e.item ?? "") !== filtroEpi) return false;
        if (t) {
          const hay = [
            e.employees?.nome,
            e.employees?.matricula,
            e.employees?.cpf,
            e.item,
            e.ca,
          ].filter(Boolean).join(" ").toLowerCase();
          if (!hay.includes(t)) return false;
        }
        return true;
      })
      .map((e) => ({
        data_entrega: e.data_entrega,
        item: e.item,
        ca: e.ca,
        tamanho: e.tamanho,
        qtd: e.qtd,
        motivo_entrega: e.motivo_entrega,
        colaborador: e.employees?.nome ?? "—",
        matricula: e.employees?.matricula ?? null,
        cpf: e.employees?.cpf ?? null,
        cargo: e.employees?.role_id ? (roleMap.get(e.employees.role_id) ?? "—") : "—",
        empresa: e.employees?.company_id ? (companyMap.get(e.employees.company_id) ?? "—") : "—",
      }));
  }, [entregas, busca, filtroMotivo, filtroEpi, roleMap, companyMap]);

  const totalQtd = rows.reduce((s, r) => s + (r.qtd ?? 0), 0);

  function gerarPdf() {
    const filtros: string[] = [];
    if (filtroEpi !== "todos") filtros.push(`EPI: ${filtroEpi}`);
    if (filtroMotivo !== "todos") filtros.push(`Motivo: ${MOTIVO_LABEL_UI[filtroMotivo] ?? filtroMotivo}`);
    if (busca.trim()) filtros.push(`Busca: "${busca.trim()}"`);
    const doc = gerarPdfEntregasEpi(rows, {
      periodoLabel: `Período: ${fmtDateBR(from)} a ${fmtDateBR(to)}`,
      filtros: filtros.length ? `Filtros: ${filtros.join(" • ")}` : "Filtros: nenhum",
    });
    setPdfDoc(doc);
    setPdfOpen(true);
  }

  function exportCsv() {
    const head = ["Data", "Matrícula", "Colaborador", "CPF", "Cargo", "Empresa", "EPI", "CA", "Tamanho", "Qtd", "Motivo"];
    const lines = [head.join(";")];
    rows.forEach((r) => {
      lines.push([
        fmtDateBR(r.data_entrega),
        r.matricula ?? "",
        r.colaborador,
        r.cpf ?? "",
        r.cargo ?? "",
        r.empresa ?? "",
        r.item ?? "",
        r.ca ?? "",
        r.tamanho ?? "",
        String(r.qtd ?? 0),
        MOTIVO_LABEL_UI[r.motivo_entrega ?? ""] ?? (r.motivo_entrega ?? ""),
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"));
    });
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `entregas_epi_${from}_a_${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Ficha de Entregas de EPI — NR-06
          </h2>
          <p className="text-xs text-muted-foreground">
            Listagem em tempo real • Atualiza automaticamente a cada 30s
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0} className="gap-1.5">
            <Download className="h-4 w-4" />CSV
          </Button>
          <Button onClick={gerarPdf} disabled={rows.length === 0} className="gap-1.5">
            <Printer className="h-4 w-4" />Gerar PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 items-end">
        <div>
          <Label className="text-[10px] uppercase tracking-widest">De</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-widest">Até</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="col-span-2 md:col-span-1">
          <Label className="text-[10px] uppercase tracking-widest">Motivo</Label>
          <Select value={filtroMotivo} onValueChange={setFiltroMotivo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="PRIMEIRA_ENTREGA">1ª Entrega</SelectItem>
              <SelectItem value="TROCA_DESGASTE">Troca</SelectItem>
              <SelectItem value="EMPRESTIMO">Empréstimo</SelectItem>
              <SelectItem value="PERDA_EXTRAVIO">Perda/Extravio</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-widest">EPI</Label>
          <Select value={filtroEpi} onValueChange={setFiltroEpi}>
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {epiOptions.map((nome) => (
                <SelectItem key={nome} value={nome}>{nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-widest">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome, CPF, CA…" className="pl-8" />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground border-t pt-2">
        <span><strong className="text-foreground">{rows.length}</strong> entrega(s)</span>
        <span><strong className="text-foreground">{totalQtd}</strong> item(ns) entregue(s)</span>
        <span><strong className="text-foreground">{new Set(rows.map((r) => r.colaborador)).size}</strong> colaborador(es)</span>
      </div>

      <div className="max-h-[60vh] overflow-auto border rounded-md">
        {isLoading ? (
          <div className="text-sm text-muted-foreground py-10 text-center">Carregando…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground py-10 text-center">
            Nenhuma entrega encontrada com esses filtros.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background border-b">
              <tr className="text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="py-2 px-2">Data</th>
                <th className="py-2 px-2">Matrícula</th>
                <th className="py-2 px-2">Colaborador</th>
                <th className="py-2 px-2">Cargo</th>
                <th className="py-2 px-2">EPI</th>
                <th className="py-2 px-2">CA</th>
                <th className="py-2 px-2">Tam.</th>
                <th className="py-2 px-2 text-right">Qtd</th>
                <th className="py-2 px-2">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b hover:bg-muted/30">
                  <td className="py-2 px-2 whitespace-nowrap font-mono text-xs">{fmtDateBR(r.data_entrega)}</td>
                  <td className="py-2 px-2 font-mono text-xs">{r.matricula ?? "—"}</td>
                  <td className="py-2 px-2">{r.colaborador}</td>
                  <td className="py-2 px-2 text-xs">{r.cargo ?? "—"}</td>
                  <td className="py-2 px-2">{r.item ?? "—"}</td>
                  <td className="py-2 px-2 font-mono text-xs">{r.ca ?? "—"}</td>
                  <td className="py-2 px-2 text-xs text-center">{r.tamanho ?? "—"}</td>
                  <td className="py-2 px-2 text-right font-bold">{r.qtd ?? 0}</td>
                  <td className="py-2 px-2">
                    <Badge variant="outline" className={MOTIVO_BADGE[r.motivo_entrega ?? ""] ?? ""}>
                      {MOTIVO_LABEL_UI[r.motivo_entrega ?? ""] ?? (r.motivo_entrega ?? "—")}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <PDFPreviewDialog
        open={pdfOpen}
        onClose={() => setPdfOpen(false)}
        doc={pdfDoc}
        fileName={`ficha-entregas-epi-${from}_a_${to}.pdf`}
        title="Ficha de Entregas de EPI — NR-06"
      />
    </Card>
  );
}
