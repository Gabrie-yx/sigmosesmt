import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { NRS_LIST } from "@/lib/constants";

export const Route = createFileRoute("/app/roles")({
  component: RolesPage,
});

type Role = { id: string; name: string; req_aso: boolean; req_integra: boolean; req_nrs: string[] };
const empty: Partial<Role> = { name: "", req_aso: true, req_integra: true, req_nrs: [] };

function RolesPage() {
  const qc = useQueryClient();
  const { isEditor, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Role> | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("roles").select("*").order("name");
      if (error) throw error;
      return data as Role[];
    },
  });

  const save = useMutation({
    mutationFn: async (v: Partial<Role>) => {
      const payload = { name: v.name!, req_aso: !!v.req_aso, req_integra: !!v.req_integra, req_nrs: v.req_nrs ?? [] };
      if (v.id) {
        const { error } = await supabase.from("roles").update(payload).eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("roles").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles"] });
      setOpen(false); setEditing(null);
      toast.success("Salvo");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("roles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles"] });
      toast.success("Excluído");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function toggleNr(nr: string) {
    const cur = editing?.req_nrs ?? [];
    const next = cur.includes(nr) ? cur.filter((x) => x !== nr) : [...cur, nr];
    setEditing({ ...editing!, req_nrs: next });
  }

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cargos / Riscos</h1>
          <p className="text-muted-foreground">Funções de trabalho e requisitos NR</p>
        </div>
        {isEditor && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditing({ ...empty }); setOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />Novo cargo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{editing?.id ? "Editar" : "Novo"} cargo</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); save.mutate(editing!); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input required value={editing?.name ?? ""} onChange={(e) => setEditing({ ...editing!, name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center justify-between rounded-md border p-3">
                    <span className="text-sm font-medium">Exige ASO</span>
                    <Switch checked={!!editing?.req_aso} onCheckedChange={(v) => setEditing({ ...editing!, req_aso: v })} />
                  </label>
                  <label className="flex items-center justify-between rounded-md border p-3">
                    <span className="text-sm font-medium">Exige Integração</span>
                    <Switch checked={!!editing?.req_integra} onCheckedChange={(v) => setEditing({ ...editing!, req_integra: v })} />
                  </label>
                </div>
                <div className="space-y-2">
                  <Label>NRs requeridas</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {NRS_LIST.map((nr) => (
                      <label key={nr} className="flex items-center gap-2 rounded-md border p-2 cursor-pointer">
                        <Checkbox checked={(editing?.req_nrs ?? []).includes(nr)} onCheckedChange={() => toggleNr(nr)} />
                        <span className="text-xs font-semibold">{nr}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={save.isPending}>Salvar</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>ASO</TableHead>
              <TableHead>Integração</TableHead>
              <TableHead>NRs</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Carregando…</TableCell></TableRow>}
            {!isLoading && data?.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum cargo</TableCell></TableRow>
            )}
            {data?.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{r.req_aso ? "Sim" : "Não"}</TableCell>
                <TableCell>{r.req_integra ? "Sim" : "Não"}</TableCell>
                <TableCell className="space-x-1">
                  {(r.req_nrs ?? []).map((n: string) => <Badge key={n} variant="outline">{n}</Badge>)}
                </TableCell>
                <TableCell className="text-right space-x-1">
                  {isEditor && (
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {isAdmin && (
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir cargo?")) del.mutate(r.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}