import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { DDSTabsNav } from "@/components/dds-tabs-nav";
import { toast } from "sonner";

export const Route = createFileRoute("/app/dds/gestores")({
  component: DDSGestoresPage,
});

type Gestor = {
  id: string;
  nome: string;
  employee_id: string | null;
  setor: string | null;
  ativo: boolean;
};

const empty: Partial<Gestor> = { nome: "", employee_id: null, setor: "", ativo: true };

function DDSGestoresPage() {
  const qc = useQueryClient();
  const { isEditor, isAdmin } = useAuth();
  const [editing, setEditing] = useState<Partial<Gestor> | null>(null);

  const { data: gestores = [] } = useQuery({
    queryKey: ["dds-gestores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("dds_gestores").select("*").order("nome");
      if (error) throw error;
      return data as Gestor[];
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-light-dds"],
    queryFn: async () => (await supabase.from("employees").select("id,nome").eq("status", "ATIVO").order("nome")).data ?? [],
  });

  const save = useMutation({
    mutationFn: async (v: Partial<Gestor>) => {
      const payload = {
        nome: (v.nome ?? "").trim(),
        employee_id: v.employee_id || null,
        setor: v.setor?.trim() || null,
        ativo: v.ativo ?? true,
      };
      if (!payload.nome) throw new Error("Nome obrigatório");
      if (v.id) {
        const { error } = await supabase.from("dds_gestores").update(payload).eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("dds_gestores").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dds-gestores"] });
      qc.invalidateQueries({ queryKey: ["dds-gestores-active"] });
      setEditing(null);
      toast.success("Gestor salvo");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dds_gestores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dds-gestores"] });
      qc.invalidateQueries({ queryKey: ["dds-gestores-active"] });
      toast.success("Excluído");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <DDSTabsNav />
        <h1 className="text-xl md:text-2xl font-bold flex-1">Gestores de DDS</h1>
        {isEditor && <Button onClick={() => setEditing({ ...empty })}><Plus className="h-4 w-4 mr-1" />Novo gestor</Button>}
      </div>

      <div className="bg-white border rounded-lg overflow-hidden divide-y">
        {gestores.map((g) => (
          <div key={g.id} className={`flex items-center gap-3 px-4 py-3 ${!g.ativo ? "opacity-50" : ""}`}>
            <div className="flex-1">
              <div className="font-semibold">{g.nome}</div>
              <div className="text-xs text-muted-foreground">{g.setor || "—"}</div>
            </div>
            {!g.ativo && <Badge variant="outline">inativo</Badge>}
            {isEditor && <Button size="icon" variant="ghost" onClick={() => setEditing(g)}><Pencil className="h-4 w-4" /></Button>}
            {isAdmin && <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Excluir "${g.nome}"?`)) del.mutate(g.id); }}><Trash2 className="h-4 w-4 text-red-600" /></Button>}
          </div>
        ))}
        {gestores.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">Nenhum gestor cadastrado</div>}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Editar gestor" : "Novo gestor"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Nome *</Label>
                <Input value={editing.nome ?? ""} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} />
              </div>
              <div>
                <Label>Vincular a funcionário (opcional)</Label>
                <Select value={editing.employee_id ?? "none"} onValueChange={(v) => {
                  const emp = employees.find((e) => e.id === v);
                  setEditing({ ...editing, employee_id: v === "none" ? null : v, nome: editing.nome || (emp?.nome ?? "") });
                }}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sem vínculo —</SelectItem>
                    {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Setor / Área</Label>
                <Input value={editing.setor ?? ""} onChange={(e) => setEditing({ ...editing, setor: e.target.value })} placeholder="Ex: PCP, Expedição, Produção..." />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={() => editing && save.mutate(editing)} disabled={save.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}