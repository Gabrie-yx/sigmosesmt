import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Anchor, Plus, Search, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/producao/embarcacoes")({
  component: EmbarcacoesPage,
});

type Embarcacao = {
  id: string;
  nome: string;
  numero_casco: string | null;
  tipo: string;
  ncm: string | null;
  status: string;
  observacoes: string | null;
};

const TIPOS = ["BALSA", "EMPURRADOR", "ESTRUTURA FLUTUANTE", "EMBARCAÇÃO", "OUTRO"];
const STATUS_BADGE: Record<string, string> = {
  EM_PRODUCAO: "bg-amber-100 text-amber-800 border-amber-300",
  CONCLUIDO: "bg-emerald-100 text-emerald-800 border-emerald-300",
  PARALISADO: "bg-slate-100 text-slate-800 border-slate-300",
  ENTREGUE: "bg-blue-100 text-blue-800 border-blue-300",
};

function EmbarcacoesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Embarcacao | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["producao_embarcacoes_full"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("producao_embarcacoes")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data as Embarcacao[];
    },
  });

  const filtered = useMemo(() => {
    const s = search.toLowerCase().trim();
    return rows.filter(
      (r) =>
        !s ||
        r.nome.toLowerCase().includes(s) ||
        (r.numero_casco ?? "").includes(s) ||
        r.tipo.toLowerCase().includes(s),
    );
  }, [rows, search]);

  const save = useMutation({
    mutationFn: async (p: Partial<Embarcacao>) => {
      if (editing) {
        const { error } = await (supabase as any)
          .from("producao_embarcacoes")
          .update(p)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("producao_embarcacoes")
          .insert(p);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["producao_embarcacoes_full"] });
      qc.invalidateQueries({ queryKey: ["producao_embarcacoes"] });
      toast.success(editing ? "Embarcação atualizada" : "Embarcação cadastrada");
      setOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="container mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-lg bg-gradient-to-br from-sky-600 to-blue-700 flex items-center justify-center shadow-md">
            <Anchor className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Embarcações da Produção</h1>
            <p className="text-xs text-muted-foreground font-medium">
              Cascos, balsas, empurradores e estruturas flutuantes em produção
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nome, casco, tipo…"
              className="pl-8 w-64"
            />
          </div>
          <Button
            onClick={() => { setEditing(null); setOpen(true); }}
            className="gap-2 bg-blue-700 hover:bg-blue-800"
          >
            <Plus className="h-4 w-4" /> Nova Embarcação
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="w-[90px]">Casco</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead className="w-[180px]">Tipo</TableHead>
              <TableHead className="w-[120px]">NCM</TableHead>
              <TableHead className="w-[140px]">Status</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma embarcação encontrada.</TableCell></TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs font-bold">
                    {r.numero_casco ? `#${r.numero_casco}` : "—"}
                  </TableCell>
                  <TableCell className="font-medium">{r.nome}</TableCell>
                  <TableCell className="text-xs">{r.tipo}</TableCell>
                  <TableCell className="font-mono text-xs">{r.ncm ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_BADGE[r.status] ?? ""}>
                      {r.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon" variant="ghost"
                      onClick={() => { setEditing(r); setOpen(true); }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <EmbarcacaoDialog
        open={open}
        onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}
        editing={editing}
        saving={save.isPending}
        onSave={(p) => save.mutate(p)}
      />
    </div>
  );
}

function EmbarcacaoDialog({
  open, onOpenChange, editing, onSave, saving,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Embarcacao | null;
  onSave: (p: Partial<Embarcacao>) => void;
  saving: boolean;
}) {
  const init: Partial<Embarcacao> = editing ?? {
    tipo: "BALSA",
    status: "EM_PRODUCAO",
    ncm: "89079000",
  };
  const [f, setF] = useState<Partial<Embarcacao>>(init);
  useMemo(() => setF(init), [editing]); // eslint-disable-line react-hooks/exhaustive-deps

  function submit() {
    if (!f.nome) { toast.error("Nome é obrigatório"); return; }
    onSave(f);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Anchor className="h-5 w-5 text-blue-700" />
            {editing ? "Editar Embarcação" : "Nova Embarcação"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs font-semibold">Nome / Descrição *</Label>
            <Input value={f.nome ?? ""} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="ex: BALSA CASCO 130 - AMAZON AGRO" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Número do Casco</Label>
            <Input value={f.numero_casco ?? ""} onChange={(e) => setF({ ...f, numero_casco: e.target.value || null })} placeholder="130" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Tipo</Label>
            <Select value={f.tipo} onValueChange={(v) => setF({ ...f, tipo: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">NCM</Label>
            <Input value={f.ncm ?? ""} onChange={(e) => setF({ ...f, ncm: e.target.value })} placeholder="89079000" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Status</Label>
            <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="EM_PRODUCAO">Em Produção</SelectItem>
                <SelectItem value="PARALISADO">Paralisado</SelectItem>
                <SelectItem value="CONCLUIDO">Concluído</SelectItem>
                <SelectItem value="ENTREGUE">Entregue</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label className="text-xs font-semibold">Observações</Label>
            <Textarea value={f.observacoes ?? ""} onChange={(e) => setF({ ...f, observacoes: e.target.value })} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving} className="bg-blue-700 hover:bg-blue-800">
            {saving ? "Salvando…" : editing ? "Salvar" : "Cadastrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}