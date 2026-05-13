import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2, Plus, Tags } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/producao/tipos-produto")({
  component: TiposProdutoPage,
});

type Tipo = {
  id: string;
  nome: string;
  ncm: string | null;
  grupo_mercadorias: string | null;
  ativo: boolean;
};

function TiposProdutoPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Tipo | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<Tipo | null>(null);

  const { data: tipos = [], isLoading } = useQuery({
    queryKey: ["producao-tipos-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("producao_tipos_produto")
        .select("id, nome, ncm, grupo_mercadorias, ativo")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Tipo[];
    },
  });

  const { data: gruposMerc = [] } = useQuery({
    queryKey: ["producao-grupo-merc-admin"],
    queryFn: async () => {
      const { data } = await supabase
        .from("producao_grupo_mercadorias")
        .select("codigo, descricao").eq("ativo", true).order("codigo");
      return data ?? [];
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("producao_tipos_produto").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tipo excluído");
      qc.invalidateQueries({ queryKey: ["producao-tipos-admin"] });
      qc.invalidateQueries({ queryKey: ["producao-tipos"] });
      setDeleting(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir"),
  });

  function novo() {
    setEditing({ id: "", nome: "", ncm: "", grupo_mercadorias: "", ativo: true });
    setOpen(true);
  }
  function editar(t: Tipo) {
    setEditing({ ...t });
    setOpen(true);
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Tags className="h-5 w-5" />
          <h1 className="text-xl font-bold">Tipos de Produto</h1>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/app/producao/criar-ordem">Voltar</Link>
          </Button>
          <Button size="sm" onClick={novo}>
            <Plus className="h-4 w-4 mr-1" /> Novo Tipo
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Configure NCM e Grupo de Mercadorias padrão por Tipo de Produto. Esses valores são
        preenchidos automaticamente no formulário de criação de ordem.
      </p>

      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>NCM</TableHead>
              <TableHead>Grupo de Mercadorias</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-32 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Carregando…</TableCell></TableRow>
            )}
            {!isLoading && tipos.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Nenhum tipo cadastrado</TableCell></TableRow>
            )}
            {tipos.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.nome}</TableCell>
                <TableCell>{t.ncm || <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>{t.grupo_mercadorias || <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>{t.ativo ? "Ativo" : "Inativo"}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="icon" onClick={() => editar(t)} title="Editar">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleting(t)} title="Excluir">
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <TipoDialog
        open={open}
        tipo={editing}
        gruposMerc={gruposMerc as any[]}
        onClose={() => { setOpen(false); setEditing(null); }}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["producao-tipos-admin"] });
          qc.invalidateQueries({ queryKey: ["producao-tipos"] });
          setOpen(false); setEditing(null);
        }}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tipo de produto?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.nome ? <>O tipo <b>{deleting.nome}</b> será removido.</> : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleting && remove.mutate(deleting.id)}
              className="bg-red-600 hover:bg-red-700"
            >Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TipoDialog({
  open, tipo, gruposMerc, onClose, onSaved,
}: {
  open: boolean;
  tipo: Tipo | null;
  gruposMerc: { codigo: string; descricao: string | null }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState("");
  const [ncm, setNcm] = useState("");
  const [grupo, setGrupo] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [saving, setSaving] = useState(false);

  // sync when opening
  useState(() => 0); // placeholder

  // reset on tipo change
  if (open && tipo && nome !== tipo.nome && (tipo.id || nome === "")) {
    // Run only when we open with a different record; guarded above.
  }

  // Use effect-like sync via key on Dialog mount: simpler — re-init when `tipo` changes
  // Replaced below using useEffect would be ideal; using inline sync via render guard:
  if (open && tipo && (tipo.id !== "" ? tipo.id !== (nome === tipo.nome ? tipo.id : "") : false)) {
    // no-op
  }

  // Simple controlled re-init using a ref-less approach:
  // We rely on `key` prop set by parent if needed. To keep it robust, sync on open transitions.
  // Implement via plain effect:
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useSyncTipo(open, tipo, { setNome, setNcm, setGrupo, setAtivo });

  async function salvar() {
    if (!nome.trim()) { toast.error("Nome é obrigatório"); return; }
    setSaving(true);
    try {
      const payload = {
        nome: nome.trim(),
        ncm: ncm.trim() || null,
        grupo_mercadorias: grupo.trim() || null,
        ativo,
      };
      if (tipo?.id) {
        const { error } = await supabase.from("producao_tipos_produto").update(payload).eq("id", tipo.id);
        if (error) throw error;
        toast.success("Tipo atualizado");
      } else {
        const { error } = await supabase.from("producao_tipos_produto").insert(payload);
        if (error) throw error;
        toast.success("Tipo cadastrado");
      }
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{tipo?.id ? "Editar Tipo de Produto" : "Novo Tipo de Produto"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: EMBARCAÇÃO" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>NCM padrão</Label>
              <Input value={ncm} onChange={(e) => setNcm(e.target.value)} placeholder="Ex: 89011000" />
            </div>
            <div>
              <Label>Grupo de Mercadorias padrão</Label>
              <Input
                value={grupo}
                onChange={(e) => setGrupo(e.target.value)}
                placeholder="Ex: NAVAL01"
                list="grupos-merc-list"
              />
              <datalist id="grupos-merc-list">
                {gruposMerc.map((g) => (
                  <option key={g.codigo} value={g.codigo}>
                    {g.descricao ?? g.codigo}
                  </option>
                ))}
              </datalist>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Switch checked={ativo} onCheckedChange={setAtivo} />
            <Label className="cursor-pointer" onClick={() => setAtivo(!ativo)}>Ativo</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Sync local form state when the dialog opens with a different tipo
import { useEffect } from "react";
function useSyncTipo(
  open: boolean,
  tipo: Tipo | null,
  s: {
    setNome: (v: string) => void;
    setNcm: (v: string) => void;
    setGrupo: (v: string) => void;
    setAtivo: (v: boolean) => void;
  },
) {
  useEffect(() => {
    if (!open) return;
    s.setNome(tipo?.nome ?? "");
    s.setNcm(tipo?.ncm ?? "");
    s.setGrupo(tipo?.grupo_mercadorias ?? "");
    s.setAtivo(tipo?.ativo ?? true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tipo?.id]);
}