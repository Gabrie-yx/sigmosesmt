import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Siren, Plus, Search, AlertTriangle, ShieldAlert, FileText, Camera, Paperclip, Trash2, ImageIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/incidentes")({
  component: IncidentesPage,
});

const TIPO_LABEL: Record<string, string> = {
  QUASE_ACIDENTE: "Quase-acidente",
  INCIDENTE: "Incidente",
  ACIDENTE_SEM_AFASTAMENTO: "Acidente s/ afast.",
  ACIDENTE_COM_AFASTAMENTO: "Acidente c/ afast.",
  DOENCA_OCUPACIONAL: "Doença ocupacional",
};
const GRAV_STYLES: Record<string, string> = {
  LEVE: "bg-slate-100 text-slate-700 border-slate-200",
  MODERADA: "bg-amber-100 text-amber-700 border-amber-200",
  GRAVE: "bg-orange-100 text-orange-700 border-orange-200",
  FATAL: "bg-red-100 text-red-700 border-red-200",
};
const STATUS_STYLES: Record<string, string> = {
  REGISTRADO: "bg-red-100 text-red-700 border-red-200",
  EM_INVESTIGACAO: "bg-amber-100 text-amber-700 border-amber-200",
  INVESTIGADO: "bg-blue-100 text-blue-700 border-blue-200",
  CONCLUIDO: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

function IncidentesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [evidOpen, setEvidOpen] = useState<string | null>(null);
  const [form, setForm] = useState({
    descricao: "", tipo: "QUASE_ACIDENTE", gravidade: "LEVE",
    data_ocorrencia: new Date().toISOString().slice(0, 16), local: "",
    causa_raiz: "", acoes_corretivas: "", cat_numero: "", cat_emitida: false,
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["incidentes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("incidentes")
        .select("*").order("data_ocorrencia", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.descricao.trim()) throw new Error("Informe a descrição");
      const { error } = await supabase.from("incidentes").insert({
        descricao: form.descricao, tipo: form.tipo, gravidade: form.gravidade,
        data_ocorrencia: new Date(form.data_ocorrencia).toISOString(),
        local: form.local || null,
        causa_raiz: form.causa_raiz || null, acoes_corretivas: form.acoes_corretivas || null,
        cat_emitida: form.cat_emitida, cat_numero: form.cat_numero || null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Incidente registrado");
      setOpen(false);
      setForm({ descricao: "", tipo: "QUASE_ACIDENTE", gravidade: "LEVE",
        data_ocorrencia: new Date().toISOString().slice(0, 16), local: "",
        causa_raiz: "", acoes_corretivas: "", cat_numero: "", cat_emitida: false });
      qc.invalidateQueries({ queryKey: ["incidentes"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return items;
    return items.filter((i: any) =>
      i.descricao?.toLowerCase().includes(s) || i.local?.toLowerCase().includes(s));
  }, [items, search]);

  const stats = useMemo(() => ({
    total: items.length,
    quase: items.filter((i: any) => i.tipo === "QUASE_ACIDENTE").length,
    investigando: items.filter((i: any) => i.status === "EM_INVESTIGACAO" || i.status === "REGISTRADO").length,
    graves: items.filter((i: any) => i.gravidade === "GRAVE" || i.gravidade === "FATAL").length,
  }), [items]);

  return (
    <div className="p-6 space-y-6">
      {evidOpen && (
        <EvidenciasDialog incidenteId={evidOpen} onClose={() => setEvidOpen(null)} userId={user?.id ?? null} />
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Siren className="h-6 w-6 text-red-600" /> Incidentes e Investigação
          </h1>
          <p className="text-sm text-slate-500">Registro de quase-acidentes, incidentes e acidentes — ciclo AGIR (PDCA)</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-red-700 hover:bg-red-800"><Plus className="h-4 w-4 mr-1" /> Novo registro</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Registrar Incidente</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Tipo</Label>
                  <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TIPO_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Gravidade</Label>
                  <Select value={form.gravidade} onValueChange={(v) => setForm({ ...form, gravidade: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LEVE">Leve</SelectItem>
                      <SelectItem value="MODERADA">Moderada</SelectItem>
                      <SelectItem value="GRAVE">Grave</SelectItem>
                      <SelectItem value="FATAL">Fatal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Data e hora</Label><Input type="datetime-local" value={form.data_ocorrencia} onChange={(e) => setForm({ ...form, data_ocorrencia: e.target.value })} /></div>
                <div><Label>Local</Label><Input value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })} placeholder="Onde ocorreu" /></div>
              </div>
              <div><Label>Descrição *</Label><Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={3} /></div>
              <div><Label>Causa raiz</Label><Textarea value={form.causa_raiz} onChange={(e) => setForm({ ...form, causa_raiz: e.target.value })} rows={2} /></div>
              <div><Label>Ações corretivas</Label><Textarea value={form.acoes_corretivas} onChange={(e) => setForm({ ...form, acoes_corretivas: e.target.value })} rows={2} /></div>
              <div className="grid grid-cols-3 gap-3 items-end">
                <div className="col-span-1 flex items-center gap-2 pb-2">
                  <input type="checkbox" id="cat" checked={form.cat_emitida} onChange={(e) => setForm({ ...form, cat_emitida: e.target.checked })} />
                  <Label htmlFor="cat" className="text-sm">CAT emitida</Label>
                </div>
                <div className="col-span-2"><Label>Nº da CAT</Label><Input value={form.cat_numero} onChange={(e) => setForm({ ...form, cat_numero: e.target.value })} disabled={!form.cat_emitida} /></div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => create.mutate()} disabled={create.isPending} className="bg-red-700 hover:bg-red-800">Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4"><div className="flex items-center justify-between"><div><div className="text-xs text-slate-500">Total</div><div className="text-2xl font-bold">{stats.total}</div></div><FileText className="h-7 w-7 text-slate-400" /></div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center justify-between"><div><div className="text-xs text-slate-500">Quase-acidentes</div><div className="text-2xl font-bold text-amber-600">{stats.quase}</div></div><AlertTriangle className="h-7 w-7 text-amber-400" /></div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center justify-between"><div><div className="text-xs text-slate-500">Investigando</div><div className="text-2xl font-bold text-blue-600">{stats.investigando}</div></div><Siren className="h-7 w-7 text-blue-400" /></div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center justify-between"><div><div className="text-xs text-slate-500">Graves/fatais</div><div className="text-2xl font-bold text-red-600">{stats.graves}</div></div><ShieldAlert className="h-7 w-7 text-red-400" /></div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Registros</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
            <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="text-sm text-slate-500">Carregando...</div> :
            filtered.length === 0 ? <div className="text-sm text-slate-500 text-center py-8">Nenhum incidente registrado.</div> :
            <div className="space-y-2">
              {filtered.map((i: any) => (
                <div key={i.id} className="border rounded-lg p-3 hover:bg-slate-50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-900 line-clamp-1">{i.descricao}</div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        {new Date(i.data_ocorrencia).toLocaleString("pt-BR")}
                        {i.local && ` · ${i.local}`}
                        {i.cat_emitida && ` · CAT ${i.cat_numero || "emitida"}`}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 shrink-0 justify-end">
                      <Badge variant="outline" className="bg-slate-50 text-slate-600">{TIPO_LABEL[i.tipo]}</Badge>
                      <Badge variant="outline" className={GRAV_STYLES[i.gravidade]}>{i.gravidade}</Badge>
                      <Badge variant="outline" className={STATUS_STYLES[i.status]}>{i.status.replace("_", " ")}</Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          }
        </CardContent>
      </Card>
    </div>
  );
}