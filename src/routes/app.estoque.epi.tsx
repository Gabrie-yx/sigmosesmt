import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { AlertTriangle, Package, Plus, History, ImageIcon } from "lucide-react";

export const Route = createFileRoute("/app/estoque/epi")({
  component: EstoqueEpiPage,
});

type EpiRow = {
  id: string;
  codigo_material: string;
  nome_material: string;
  quantidade_atual: number;
  estoque_minimo: number;
  imagem_url: string | null;
};

type Entrega = {
  id: string;
  cpf_colaborador: string;
  nome_colaborador: string;
  epi_id: string;
  quantidade_entregue: number;
  data_entrega: string;
  estoque_epi?: { nome_material: string; codigo_material: string } | null;
};

function maskCpf(v: string) {
  return v
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function EstoqueEpiPage() {
  const qc = useQueryClient();
  const [showHistory, setShowHistory] = useState(false);

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
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            Estoque de EPIs — SESMT
          </h1>
          <p className="text-sm text-muted-foreground">
            Controle visual de saldo, alerta de estoque crítico e baixa automática por entrega.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowHistory(true)}>
            <History className="h-4 w-4" /> Histórico
          </Button>
          <NewEpiDialog
            onCreated={() => qc.invalidateQueries({ queryKey: ["estoque_epi"] })}
          />
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
          <div
            className={`text-2xl font-black ${criticos > 0 ? "text-destructive" : ""}`}
          >
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

      <HistoryDialog open={showHistory} onOpenChange={setShowHistory} />
    </div>
  );
}

function EpiCard({ epi }: { epi: EpiRow }) {
  const critico = epi.quantidade_atual <= epi.estoque_minimo;
  return (
    <Card
      className={`overflow-hidden transition-all hover:shadow-md ${
        critico ? "border-destructive border-2 bg-destructive/5" : ""
      }`}
    >
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
        {critico && (
          <div className="absolute top-2 left-2 right-2 flex items-center justify-center gap-1.5 rounded-md bg-destructive px-2 py-1 text-[10px] font-black uppercase tracking-widest text-destructive-foreground shadow">
            <AlertTriangle className="h-3.5 w-3.5" /> Estoque Crítico
          </div>
        )}
      </div>
      <div className="p-3 space-y-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {epi.codigo_material}
          </div>
          <div className="font-bold text-sm leading-tight line-clamp-2">{epi.nome_material}</div>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Saldo
            </div>
            <div
              className={`text-2xl font-black ${critico ? "text-destructive" : "text-foreground"}`}
            >
              {epi.quantidade_atual}
            </div>
          </div>
          <Badge variant="outline" className="text-[10px]">
            mín {epi.estoque_minimo}
          </Badge>
        </div>
        <DeliveryDialog epi={epi} />
      </div>
    </Card>
  );
}

function DeliveryDialog({ epi }: { epi: EpiRow }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [cpf, setCpf] = useState("");
  const [nome, setNome] = useState("");
  const [qtd, setQtd] = useState<number>(1);

  const mut = useMutation({
    mutationFn: async () => {
      const cpfLimpo = cpf.replace(/\D/g, "");
      if (cpfLimpo.length !== 11) throw new Error("CPF inválido");
      if (!nome.trim()) throw new Error("Informe o nome do colaborador");
      if (qtd <= 0) throw new Error("Quantidade deve ser maior que zero");
      if (qtd > epi.quantidade_atual)
        throw new Error(`Saldo insuficiente (atual: ${epi.quantidade_atual})`);

      const { error } = await (supabase as any).rpc("registrar_entrega_epi", {
        _epi_id: epi.id,
        _cpf: cpfLimpo,
        _nome: nome.trim().toUpperCase(),
        _qtd: qtd,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Entrega registrada e estoque atualizado");
      qc.invalidateQueries({ queryKey: ["estoque_epi"] });
      qc.invalidateQueries({ queryKey: ["historico_entregas"] });
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
          className="w-full"
          disabled={epi.quantidade_atual <= 0}
          variant={epi.quantidade_atual <= 0 ? "outline" : "default"}
        >
          {epi.quantidade_atual <= 0 ? "Sem estoque" : "Registrar Entrega"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Entrega de EPI — {epi.nome_material}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>CPF do colaborador</Label>
            <Input
              value={cpf}
              onChange={(e) => setCpf(maskCpf(e.target.value))}
              placeholder="000.000.000-00"
              inputMode="numeric"
            />
          </div>
          <div>
            <Label>Nome do colaborador</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome completo"
            />
          </div>
          <div>
            <Label>Quantidade a entregar (saldo: {epi.quantidade_atual})</Label>
            <Input
              type="number"
              min={1}
              max={epi.quantidade_atual}
              value={qtd}
              onChange={(e) => setQtd(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? "Registrando…" : "Confirmar entrega"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewEpiDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [qtd, setQtd] = useState(0);
  const [min, setMin] = useState(5);
  const [img, setImg] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!codigo.trim() || !nome.trim()) {
      toast.error("Informe código e nome do EPI");
      return;
    }
    setSaving(true);
    try {
      const { error } = await (supabase as any).from("estoque_epi").insert({
        codigo_material: codigo.trim().toUpperCase(),
        nome_material: nome.trim().toUpperCase(),
        quantidade_atual: qtd,
        estoque_minimo: min,
        imagem_url: img.trim() || null,
      });
      if (error) throw error;
      toast.success("EPI cadastrado");
      setCodigo("");
      setNome("");
      setQtd(0);
      setMin(5);
      setImg("");
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
            <Label className="flex items-center gap-1">
              <ImageIcon className="h-3.5 w-3.5" /> URL da imagem (opcional)
            </Label>
            <Input value={img} onChange={(e) => setImg(e.target.value)} placeholder="https://…" />
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

function HistoryDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data = [] } = useQuery({
    queryKey: ["historico_entregas"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("historico_entregas")
        .select("*, estoque_epi(nome_material, codigo_material)")
        .order("data_entrega", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Entrega[];
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Histórico de entregas (últimas 200)</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto">
          {data.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              Nenhuma entrega registrada ainda.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background border-b">
                <tr className="text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                  <th className="py-2 pr-2">Data</th>
                  <th className="py-2 pr-2">CPF</th>
                  <th className="py-2 pr-2">Colaborador</th>
                  <th className="py-2 pr-2">EPI</th>
                  <th className="py-2 pr-2 text-right">Qtd</th>
                </tr>
              </thead>
              <tbody>
                {data.map((h) => (
                  <tr key={h.id} className="border-b hover:bg-muted/30">
                    <td className="py-2 pr-2 whitespace-nowrap">
                      {new Date(h.data_entrega).toLocaleString("pt-BR")}
                    </td>
                    <td className="py-2 pr-2 font-mono text-xs">
                      {maskCpf(h.cpf_colaborador)}
                    </td>
                    <td className="py-2 pr-2">{h.nome_colaborador}</td>
                    <td className="py-2 pr-2">
                      {h.estoque_epi?.nome_material ?? "—"}
                      <span className="text-[10px] text-muted-foreground ml-1">
                        {h.estoque_epi?.codigo_material}
                      </span>
                    </td>
                    <td className="py-2 pr-2 text-right font-bold">{h.quantidade_entregue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}