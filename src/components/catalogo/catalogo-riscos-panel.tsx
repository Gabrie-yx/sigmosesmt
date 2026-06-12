import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type Risco = {
  id: string;
  categoria: string;
  nome: string;
  efeitos_tipicos: string[];
  medidas_controle_padrao: string[];
  nrs_aplicaveis: string[];
  epis_sugeridos: string[];
  ativo: boolean;
  codigo_esocial?: string | null;
  aposentadoria_especial_anos?: number | null;
};

const CATEGORIAS = [
  { value: "FISICO", label: "Físico" },
  { value: "QUIMICO", label: "Químico" },
  { value: "BIOLOGICO", label: "Biológico" },
  { value: "ERGONOMICO", label: "Ergonômico" },
  { value: "ACIDENTE_MECANICO", label: "Acidente / Mecânico" },
];

const TONE: Record<string, string> = {
  FISICO: "bg-sky-100 text-sky-700 border-sky-200",
  QUIMICO: "bg-amber-100 text-amber-700 border-amber-200",
  BIOLOGICO: "bg-emerald-100 text-emerald-700 border-emerald-200",
  ERGONOMICO: "bg-violet-100 text-violet-700 border-violet-200",
  ACIDENTE_MECANICO: "bg-rose-100 text-rose-700 border-rose-200",
};

const empty: Partial<Risco> = {
  categoria: "FISICO",
  nome: "",
  efeitos_tipicos: [],
  medidas_controle_padrao: [],
  nrs_aplicaveis: [],
  epis_sugeridos: [],
  ativo: true,
  codigo_esocial: "",
  aposentadoria_especial_anos: null,
};

function csvToArr(s: string): string[] {
  return s.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);
}

export function CatalogoRiscosPanel() {
  const qc = useQueryClient();
  const { isEditor, isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string>("ALL");
  const [editing, setEditing] = useState<Partial<Risco> | null>(null);

  const { data: riscos = [], isLoading } = useQuery({
    queryKey: ["catalogo_riscos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("catalogo_riscos")
        .select("*")
        .order("categoria")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Risco[];
    },
  });

  const filtered = useMemo(() => {
    return riscos.filter((r) => {
      if (filterCat !== "ALL" && r.categoria !== filterCat) return false;
      if (search) {
        const q = search.toLowerCase();
        const hit =
          r.nome.toLowerCase().includes(q) ||
          (r.codigo_esocial ?? "").toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [riscos, search, filterCat]);

  const save = useMutation({
    mutationFn: async (v: Partial<Risco>) => {
      const payload = {
        categoria: v.categoria!,
        nome: v.nome!.trim(),
        efeitos_tipicos: v.efeitos_tipicos ?? [],
        medidas_controle_padrao: v.medidas_controle_padrao ?? [],
        nrs_aplicaveis: v.nrs_aplicaveis ?? [],
        epis_sugeridos: v.epis_sugeridos ?? [],
        ativo: v.ativo ?? true,
        codigo_esocial: v.codigo_esocial?.toString().trim() || null,
        aposentadoria_especial_anos: v.aposentadoria_especial_anos ?? null,
      };
      if (v.id) {
        const { error } = await supabase.from("catalogo_riscos").update(payload).eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("catalogo_riscos").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalogo_riscos"] });
      toast.success("Risco salvo");
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("catalogo_riscos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalogo_riscos"] });
      toast.success("Risco excluído");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-rose-600" />
          <h2 className="text-lg font-bold text-slate-800">Catálogo de Riscos</h2>
          <Badge variant="secondary">{filtered.length}</Badge>
        </div>
        {isEditor && (
          <Button onClick={() => setEditing({ ...empty })} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Novo Risco
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Buscar risco..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas as categorias</SelectItem>
            {CATEGORIAS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center text-slate-400 py-12">Carregando…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-slate-400 py-12 border-2 border-dashed border-slate-200 rounded-xl">
          Nenhum risco no catálogo
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((r) => (
            <div
              key={r.id}
              className={`border border-slate-200 rounded-2xl p-5 bg-white shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-rose-300 transition-all ${!r.ativo ? "opacity-50" : ""}`}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0">
                  <span className={`inline-block text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md border ${TONE[r.categoria] ?? ""}`}>
                    {CATEGORIAS.find((c) => c.value === r.categoria)?.label ?? r.categoria}
                  </span>
                  <div className="font-bold text-slate-800 text-base mt-2 truncate">{r.nome}</div>
                  {r.codigo_esocial && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                        eSocial {r.codigo_esocial}
                      </span>
                      {r.aposentadoria_especial_anos && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                          Aposent. esp. {r.aposentadoria_especial_anos} anos
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {isEditor && (
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(r)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {isAdmin && (
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-600"
                        onClick={() => { if (confirm(`Excluir "${r.nome}"?`)) del.mutate(r.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
              {r.nrs_aplicaveis?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {r.nrs_aplicaveis.map((nr) => (
                    <span key={nr} className="text-[11px] font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md">{nr}</span>
                  ))}
                </div>
              )}
              {r.epis_sugeridos?.length > 0 && (
                <div className="text-xs text-slate-500 mt-3 line-clamp-2">
                  <span className="font-bold uppercase">EPIs:</span> {r.epis_sugeridos.join(", ")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar Risco" : "Novo Risco"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-1">
                  <Label>Categoria</Label>
                  <Select value={editing.categoria} onValueChange={(v) => setEditing({ ...editing, categoria: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label>Nome do risco *</Label>
                  <Input value={editing.nome ?? ""} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} placeholder="Ex.: Ruído contínuo" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Código eSocial <span className="text-slate-400 text-xs">(Tabela 23, ex: 02.01.001)</span></Label>
                  <Input
                    value={editing.codigo_esocial ?? ""}
                    onChange={(e) => setEditing({ ...editing, codigo_esocial: e.target.value })}
                    placeholder="01.18.001"
                  />
                </div>
                <div>
                  <Label>Aposentadoria especial <span className="text-slate-400 text-xs">(anos)</span></Label>
                  <Select
                    value={editing.aposentadoria_especial_anos ? String(editing.aposentadoria_especial_anos) : "NONE"}
                    onValueChange={(v) => setEditing({ ...editing, aposentadoria_especial_anos: v === "NONE" ? null : parseInt(v, 10) })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">Não se aplica</SelectItem>
                      <SelectItem value="15">15 anos</SelectItem>
                      <SelectItem value="20">20 anos</SelectItem>
                      <SelectItem value="25">25 anos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Efeitos típicos / danos <span className="text-slate-400 text-xs">(separar por vírgula)</span></Label>
                <Textarea
                  value={(editing.efeitos_tipicos ?? []).join(", ")}
                  onChange={(e) => setEditing({ ...editing, efeitos_tipicos: csvToArr(e.target.value) })}
                  rows={2}
                />
              </div>
              <div>
                <Label>Medidas de controle padrão <span className="text-slate-400 text-xs">(separar por vírgula)</span></Label>
                <Textarea
                  value={(editing.medidas_controle_padrao ?? []).join(", ")}
                  onChange={(e) => setEditing({ ...editing, medidas_controle_padrao: csvToArr(e.target.value) })}
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>NRs aplicáveis <span className="text-slate-400 text-xs">(ex: NR-15, NR-06)</span></Label>
                  <Input
                    value={(editing.nrs_aplicaveis ?? []).join(", ")}
                    onChange={(e) => setEditing({ ...editing, nrs_aplicaveis: csvToArr(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>EPIs sugeridos</Label>
                  <Input
                    value={(editing.epis_sugeridos ?? []).join(", ")}
                    onChange={(e) => setEditing({ ...editing, epis_sugeridos: csvToArr(e.target.value) })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editing.ativo ?? true}
                  onChange={(e) => setEditing({ ...editing, ativo: e.target.checked })}
                  id="ativo-risco"
                />
                <Label htmlFor="ativo-risco" className="cursor-pointer">Ativo</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button
              onClick={() => editing?.nome?.trim() ? save.mutate(editing) : toast.error("Informe o nome")}
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