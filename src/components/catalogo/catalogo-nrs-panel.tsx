import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Search, Pencil, Trash2, BookOpen, Power, PowerOff } from "lucide-react";
import { toast } from "sonner";

type NR = {
  id: string;
  codigo: string;
  titulo: string;
  ativo: boolean;
};

const empty: Partial<NR> = { codigo: "", titulo: "", ativo: true };

export function CatalogoNrsPanel() {
  const qc = useQueryClient();
  const { isEditor, isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<Partial<NR> | null>(null);

  const { data: nrs = [], isLoading } = useQuery({
    queryKey: ["catalogo_nrs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("catalogo_nrs").select("*").order("codigo");
      if (error) throw error;
      return (data ?? []) as NR[];
    },
  });

  const filtered = useMemo(() => {
    return nrs.filter((n) => {
      if (!showInactive && !n.ativo) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!n.codigo.toLowerCase().includes(q) && !n.titulo.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [nrs, search, showInactive]);

  const save = useMutation({
    mutationFn: async (v: Partial<NR>) => {
      const payload = {
        codigo: v.codigo!.trim(),
        titulo: v.titulo!.trim(),
        ativo: v.ativo ?? true,
      };
      if (v.id) {
        const { error } = await supabase.from("catalogo_nrs").update(payload).eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("catalogo_nrs").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalogo_nrs"] });
      toast.success("NR salva");
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("catalogo_nrs").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["catalogo_nrs"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("catalogo_nrs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalogo_nrs"] });
      toast.success("NR excluída");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-sky-600" />
          <h2 className="text-lg font-bold text-slate-800">Catálogo de NRs</h2>
          <Badge variant="secondary">{filtered.length}</Badge>
        </div>
        {isEditor && (
          <Button onClick={() => setEditing({ ...empty })} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Nova NR
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Buscar NR (código ou título)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Mostrar inativas
        </label>
      </div>

      {isLoading ? (
        <div className="text-center text-slate-400 py-12">Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-slate-400 py-12 border-2 border-dashed border-slate-200 rounded-xl">
          Nenhuma NR encontrada
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((n) => (
            <div
              key={n.id}
              className={`border border-slate-200 rounded-2xl p-5 bg-white shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-sky-300 flex items-center justify-between gap-3 transition-all ${!n.ativo ? "opacity-50" : ""}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-black text-sky-700 text-lg">{n.codigo}</span>
                  {!n.ativo && <span className="text-[10px] font-bold uppercase text-slate-400">inativa</span>}
                </div>
                <div className="text-sm text-slate-600 truncate mt-0.5">{n.titulo}</div>
              </div>
              {isEditor && (
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(n)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8"
                    onClick={() => toggleAtivo.mutate({ id: n.id, ativo: !n.ativo })}
                    title={n.ativo ? "Desativar" : "Ativar"}>
                    {n.ativo ? <PowerOff className="h-4 w-4 text-amber-600" /> : <Power className="h-4 w-4 text-emerald-600" />}
                  </Button>
                  {isAdmin && (
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-600"
                      onClick={() => { if (confirm(`Excluir ${n.codigo}?`)) del.mutate(n.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar NR" : "Nova NR"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3 py-2">
              <div>
                <Label>Código *</Label>
                <Input
                  value={editing.codigo ?? ""}
                  onChange={(e) => setEditing({ ...editing, codigo: e.target.value })}
                  placeholder="Ex.: NR-35"
                />
              </div>
              <div>
                <Label>Título *</Label>
                <Input
                  value={editing.titulo ?? ""}
                  onChange={(e) => setEditing({ ...editing, titulo: e.target.value })}
                  placeholder="Ex.: Trabalho em Altura"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ativo-nr"
                  checked={editing.ativo ?? true}
                  onChange={(e) => setEditing({ ...editing, ativo: e.target.checked })}
                />
                <Label htmlFor="ativo-nr" className="cursor-pointer">Ativa</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!editing?.codigo?.trim() || !editing?.titulo?.trim()) {
                  toast.error("Preencha código e título"); return;
                }
                save.mutate(editing);
              }}
              disabled={save.isPending}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}