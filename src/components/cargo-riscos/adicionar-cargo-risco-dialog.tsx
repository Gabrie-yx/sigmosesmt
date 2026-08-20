import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Search } from "lucide-react";

type Catalogo = { id: string; nome: string; categoria: string };

export function AdicionarCargoRiscoDialog({
  roleId, open, onOpenChange,
}: { roleId: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Catalogo | null>(null);

  const { data: catalogo = [] } = useQuery({
    queryKey: ["catalogo-riscos-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalogo_riscos").select("id, nome, categoria").order("categoria").order("nome");
      if (error) throw error;
      return (data ?? []) as Catalogo[];
    },
    enabled: open,
  });

  const { data: jaVinculados = [] } = useQuery({
    queryKey: ["cargo_riscos_ids", roleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cargo_riscos").select("risco_id").eq("role_id", roleId).eq("ativo", true);
      if (error) throw error;
      return (data ?? []).map((r) => r.risco_id as string);
    },
    enabled: open,
  });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return catalogo
      .filter((c) => !jaVinculados.includes(c.id))
      .filter((c) => !needle || c.nome.toLowerCase().includes(needle) || c.categoria.toLowerCase().includes(needle))
      .slice(0, 60);
  }, [catalogo, jaVinculados, q]);

  const mut = useMutation({
    mutationFn: async () => {
      if (!picked) throw new Error("Selecione um risco");
      const { error } = await supabase.from("cargo_riscos").insert({
        role_id: roleId,
        risco_id: picked.id,
        status_avaliacao: "PENDENTE",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Risco vinculado ao cargo. Agora clique em Validar para lançar intensidade e técnica de medição.");
      qc.invalidateQueries({ queryKey: ["cargo_riscos"] });
      qc.invalidateQueries({ queryKey: ["cargo_riscos_ids", roleId] });
      setPicked(null);
      setQ("");
      onOpenChange(false);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao vincular"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-rose-600" /> Adicionar risco ao cargo
          </DialogTitle>
          <DialogDescription>
            Selecione o agente do catálogo. Depois use <b>Validar</b> para preencher intensidade (PPP 15.4) e técnica de medição (PPP 15.5).
          </DialogDescription>
        </DialogHeader>

        <div>
          <Label>Buscar agente de risco</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ruído, calor, fumos metálicos..." className="pl-9" />
          </div>
        </div>

        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhum agente disponível para este filtro.</p>
          )}
          {filtered.map((c) => (
            <Card
              key={c.id}
              onClick={() => setPicked(c)}
              className={`p-3 cursor-pointer flex items-center justify-between gap-2 transition-colors ${
                picked?.id === c.id ? "border-rose-400 bg-rose-50/60" : "hover:bg-muted/50"
              }`}
            >
              <span className="font-semibold text-sm">{c.nome}</span>
              <Badge variant="outline" className="text-[10px]">{c.categoria}</Badge>
            </Card>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mut.isPending}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={!picked || mut.isPending} className="bg-rose-600 hover:bg-rose-700">
            {mut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Vincular risco
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
