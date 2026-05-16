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
import { AlertTriangle, Plus, Search, ShieldAlert, CheckCircle2, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/ncs")({
  component: NCsPage,
});

const SEV_STYLES: Record<string, string> = {
  BAIXA: "bg-slate-100 text-slate-700 border-slate-200",
  MEDIA: "bg-amber-100 text-amber-700 border-amber-200",
  ALTA: "bg-orange-100 text-orange-700 border-orange-200",
  CRITICA: "bg-red-100 text-red-700 border-red-200",
};
const STATUS_STYLES: Record<string, string> = {
  ABERTA: "bg-red-100 text-red-700 border-red-200",
  EM_ANALISE: "bg-amber-100 text-amber-700 border-amber-200",
  EM_TRATAMENTO: "bg-blue-100 text-blue-700 border-blue-200",
  CONCLUIDA: "bg-emerald-100 text-emerald-700 border-emerald-200",
  CANCELADA: "bg-slate-100 text-slate-500 border-slate-200",
};

function NCsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    titulo: "", descricao: "", origem: "AUDITORIA",
    severidade: "MEDIA", data_limite: "", causa_raiz: "", acao_imediata: "",
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["ncs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("nao_conformidades")
        .select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.titulo.trim()) throw new Error("Informe o título");
      const { error } = await supabase.from("nao_conformidades").insert({
        titulo: form.titulo, descricao: form.descricao || null,
        origem: form.origem, severidade: form.severidade,
        data_limite: form.data_limite || null,
        causa_raiz: form.causa_raiz || null, acao_imediata: form.acao_imediata || null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("NC registrada");
      setOpen(false);
      setForm({ titulo: "", descricao: "", origem: "AUDITORIA", severidade: "MEDIA", data_limite: "", causa_raiz: "", acao_imediata: "" });
      qc.invalidateQueries({ queryKey: ["ncs"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return items;
    return items.filter((i: any) =>
      i.titulo?.toLowerCase().includes(s) || i.descricao?.toLowerCase().includes(s));
  }, [items, search]);

  const stats = useMemo(() => ({
    total: items.length,
    abertas: items.filter((i: any) => i.status === "ABERTA").length,
    tratamento: items.filter((i: any) => i.status === "EM_TRATAMENTO" || i.status === "EM_ANALISE").length,
    concluidas: items.filter((i: any) => i.status === "CONCLUIDA").length,
  }), [items]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-red-600" /> Não Conformidades
          </h1>
          <p className="text-sm text-slate-500">Registro e tratamento de desvios — ciclo AGIR (PDCA)</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-red-700 hover:bg-red-800"><Plus className="h-4 w-4 mr-1" /> Nova NC</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Registrar Não Conformidade</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>Título *</Label><Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} /></div>
              <div><Label>Descrição</Label><Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Origem</Label>
                  <Select value={form.origem} onValueChange={(v) => setForm({ ...form, origem: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AUDITORIA">Auditoria</SelectItem>
                      <SelectItem value="INSPECAO">Inspeção</SelectItem>
                      <SelectItem value="INCIDENTE">Incidente</SelectItem>
                      <SelectItem value="CLIENTE">Cliente</SelectItem>
                      <SelectItem value="OUTRO">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Severidade</Label>
                  <Select value={form.severidade} onValueChange={(v) => setForm({ ...form, severidade: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BAIXA">Baixa</SelectItem>
                      <SelectItem value="MEDIA">Média</SelectItem>
                      <SelectItem value="ALTA">Alta</SelectItem>
                      <SelectItem value="CRITICA">Crítica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Prazo</Label><Input type="date" value={form.data_limite} onChange={(e) => setForm({ ...form, data_limite: e.target.value })} /></div>
              </div>
              <div><Label>Ação imediata</Label><Textarea value={form.acao_imediata} onChange={(e) => setForm({ ...form, acao_imediata: e.target.value })} /></div>
              <div><Label>Causa raiz (se já identificada)</Label><Textarea value={form.causa_raiz} onChange={(e) => setForm({ ...form, causa_raiz: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => create.mutate()} disabled={create.isPending} className="bg-red-700 hover:bg-red-800">Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4"><div className="flex items-center justify-between"><div><div className="text-xs text-slate-500">Total</div><div className="text-2xl font-bold">{stats.total}</div></div><AlertTriangle className="h-7 w-7 text-slate-400" /></div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center justify-between"><div><div className="text-xs text-slate-500">Abertas</div><div className="text-2xl font-bold text-red-600">{stats.abertas}</div></div><XCircle className="h-7 w-7 text-red-400" /></div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center justify-between"><div><div className="text-xs text-slate-500">Em tratamento</div><div className="text-2xl font-bold text-blue-600">{stats.tratamento}</div></div><Clock className="h-7 w-7 text-blue-400" /></div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center justify-between"><div><div className="text-xs text-slate-500">Concluídas</div><div className="text-2xl font-bold text-emerald-600">{stats.concluidas}</div></div><CheckCircle2 className="h-7 w-7 text-emerald-400" /></div></CardContent></Card>
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
            filtered.length === 0 ? <div className="text-sm text-slate-500 text-center py-8">Nenhuma não conformidade registrada.</div> :
            <div className="space-y-2">
              {filtered.map((i: any) => (
                <div key={i.id} className="border rounded-lg p-3 hover:bg-slate-50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-900">{i.titulo}</div>
                      {i.descricao && <div className="text-xs text-slate-500 line-clamp-2">{i.descricao}</div>}
                      <div className="text-[11px] text-slate-400 mt-1">
                        Identificada em {new Date(i.data_identificacao).toLocaleDateString("pt-BR")}
                        {i.data_limite && ` · prazo ${new Date(i.data_limite).toLocaleDateString("pt-BR")}`}
                        {i.origem && ` · origem ${i.origem}`}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Badge variant="outline" className={SEV_STYLES[i.severidade]}>{i.severidade}</Badge>
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