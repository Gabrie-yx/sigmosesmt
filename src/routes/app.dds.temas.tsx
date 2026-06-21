import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { DDSTabsNav } from "@/components/dds-tabs-nav";
import { toast } from "sonner";

export const Route = createFileRoute("/app/dds/temas")({
  component: DDSTemasPage,
});

type Tema = {
  id: string;
  codigo: number | null;
  titulo: string;
  categoria: "SIGNIFICATIVO" | "GERAL";
  criticidade: "ALTA" | "MEDIA" | "BAIXA";
  ativo: boolean;
};

const empty: Partial<Tema> = { titulo: "", categoria: "GERAL", criticidade: "MEDIA", ativo: true, codigo: null };

const critStyle: Record<string, string> = {
  ALTA: "bg-red-100 text-red-700 border-red-300",
  MEDIA: "bg-amber-100 text-amber-700 border-amber-300",
  BAIXA: "bg-emerald-100 text-emerald-700 border-emerald-300",
};
const catStyle: Record<string, string> = {
  SIGNIFICATIVO: "bg-indigo-100 text-indigo-700",
  GERAL: "bg-slate-100 text-slate-700",
};

function DDSTemasPage() {
  const qc = useQueryClient();
  const { isEditor, isAdmin } = useAuth();
  const [editing, setEditing] = useState<Partial<Tema> | null>(null);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("ALL");
  const [filterCrit, setFilterCrit] = useState<string>("ALL");

  const { data: temas = [] } = useQuery({
    queryKey: ["dds-temas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("dds_temas").select("*").order("codigo", { ascending: true });
      if (error) throw error;
      return data as Tema[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return temas.filter((t) => {
      if (filterCat !== "ALL" && t.categoria !== filterCat) return false;
      if (filterCrit !== "ALL" && t.criticidade !== filterCrit) return false;
      if (q && !t.titulo.toLowerCase().includes(q) && !String(t.codigo ?? "").includes(q)) return false;
      return true;
    });
  }, [temas, search, filterCat, filterCrit]);

  const save = useMutation({
    mutationFn: async (v: Partial<Tema>) => {
      const payload = {
        titulo: (v.titulo ?? "").trim(),
        categoria: v.categoria ?? "GERAL",
        criticidade: v.criticidade ?? "MEDIA",
        ativo: v.ativo ?? true,
        codigo: v.codigo ?? null,
      };
      if (!payload.titulo) throw new Error("Título obrigatório");
      if (v.id) {
        const { error } = await supabase.from("dds_temas").update(payload).eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("dds_temas").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dds-temas"] }); qc.invalidateQueries({ queryKey: ["dds-temas-active"] });
      setEditing(null);
      toast.success("Tema salvo");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dds_temas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dds-temas"] }); qc.invalidateQueries({ queryKey: ["dds-temas-active"] });
      toast.success("Tema excluído");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleAtivo = useMutation({
    mutationFn: async (t: Tema) => {
      const { error } = await supabase.from("dds_temas").update({ ativo: !t.ativo }).eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dds-temas"] });
      qc.invalidateQueries({ queryKey: ["dds-temas-active"] });
    },
  });

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <DDSTabsNav />
        <h1 className="text-xl md:text-2xl font-bold flex-1">Biblioteca de Temas — DDS</h1>
        {isEditor && (
          <Button onClick={() => setEditing({ ...empty })}><Plus className="h-4 w-4 mr-1" />Novo tema</Button>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-2 bg-white border rounded-lg p-3">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar título ou código..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
        </div>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="md:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas categorias</SelectItem>
            <SelectItem value="SIGNIFICATIVO">Significativo</SelectItem>
            <SelectItem value="GERAL">Geral</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCrit} onValueChange={setFilterCrit}>
          <SelectTrigger className="md:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas criticidades</SelectItem>
            <SelectItem value="ALTA">Alta</SelectItem>
            <SelectItem value="MEDIA">Média</SelectItem>
            <SelectItem value="BAIXA">Baixa</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="px-4 py-2 text-xs text-muted-foreground border-b bg-slate-50">
          {filtered.length} de {temas.length} temas
        </div>
        <div className="divide-y max-h-[65vh] overflow-auto">
          {filtered.map((t) => (
            <div key={t.id} className={`flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 ${!t.ativo ? "opacity-50" : ""}`}>
              <div className="w-12 text-xs font-mono text-muted-foreground text-right">{t.codigo ?? "—"}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{t.titulo}</div>
                <div className="flex gap-1.5 mt-0.5">
                  <Badge variant="secondary" className={`text-[10px] py-0 ${catStyle[t.categoria]}`}>{t.categoria}</Badge>
                  <Badge variant="outline" className={`text-[10px] py-0 border ${critStyle[t.criticidade]}`}>{t.criticidade}</Badge>
                  {!t.ativo && <Badge variant="outline" className="text-[10px] py-0">inativo</Badge>}
                </div>
              </div>
              {isEditor && (
                <>
                  <Button size="sm" variant="ghost" onClick={() => toggleAtivo.mutate(t)}>{t.ativo ? "Desativar" : "Ativar"}</Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditing(t)}><Pencil className="h-4 w-4" /></Button>
                </>
              )}
              {isAdmin && (
                <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Excluir tema "${t.titulo}"?`)) del.mutate(t.id); }}>
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              )}
            </div>
          ))}
          {filtered.length === 0 && <div className="p-8 text-center text-muted-foreground text-sm">Nenhum tema</div>}
        </div>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar tema" : "Novo tema"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Código</Label>
                  <Input type="number" value={editing.codigo ?? ""} onChange={(e) => setEditing({ ...editing, codigo: e.target.value ? Number(e.target.value) : null })} />
                </div>
                <div className="col-span-2">
                  <Label>Categoria</Label>
                  <Select value={editing.categoria} onValueChange={(v) => setEditing({ ...editing, categoria: v as any })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SIGNIFICATIVO">Significativo</SelectItem>
                      <SelectItem value="GERAL">Geral</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Título *</Label>
                <Input value={editing.titulo ?? ""} onChange={(e) => setEditing({ ...editing, titulo: e.target.value })} />
              </div>
              <div>
                <Label>Criticidade</Label>
                <Select value={editing.criticidade} onValueChange={(v) => setEditing({ ...editing, criticidade: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALTA">Alta</SelectItem>
                    <SelectItem value="MEDIA">Média</SelectItem>
                    <SelectItem value="BAIXA">Baixa</SelectItem>
                  </SelectContent>
                </Select>
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