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
import { Wrench, Plus, Search, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/acoes")({
  component: AcoesPage,
});

const PRIO_STYLES: Record<string, string> = {
  BAIXA: "bg-slate-100 text-slate-700 border-slate-200",
  MEDIA: "bg-blue-100 text-blue-700 border-blue-200",
  ALTA: "bg-orange-100 text-orange-700 border-orange-200",
  CRITICA: "bg-red-100 text-red-700 border-red-200",
};
const STATUS_STYLES: Record<string, string> = {
  PENDENTE: "bg-amber-100 text-amber-700 border-amber-200",
  EM_ANDAMENTO: "bg-blue-100 text-blue-700 border-blue-200",
  CONCLUIDA: "bg-emerald-100 text-emerald-700 border-emerald-200",
  CANCELADA: "bg-slate-100 text-slate-500 border-slate-200",
  ATRASADA: "bg-red-100 text-red-700 border-red-200",
};

function AcoesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    titulo: "", descricao: "", como: "", onde: "",
    quando: "", prioridade: "MEDIA", custo: "", observacoes: "",
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["plano-acoes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plano_acoes")
        .select("*").order("quando", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.titulo.trim()) throw new Error("Informe o título");
      const { error } = await supabase.from("plano_acoes").insert({
        titulo: form.titulo, descricao: form.descricao || null,
        como: form.como || null, onde: form.onde || null,
        quando: form.quando || null, prioridade: form.prioridade,
        custo: form.custo ? Number(form.custo) : null,
        observacoes: form.observacoes || null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ação adicionada ao plano");
      setOpen(false);
      setForm({ titulo: "", descricao: "", como: "", onde: "", quando: "", prioridade: "MEDIA", custo: "", observacoes: "" });
      qc.invalidateQueries({ queryKey: ["plano-acoes"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const hoje = new Date().toISOString().slice(0, 10);
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return items;
    return items.filter((i: any) =>
      i.titulo?.toLowerCase().includes(s) || i.descricao?.toLowerCase().includes(s));
  }, [items, search]);

  const stats = useMemo(() => ({
    total: items.length,
    pendentes: items.filter((i: any) => i.status === "PENDENTE" || i.status === "EM_ANDAMENTO").length,
    atrasadas: items.filter((i: any) => i.status !== "CONCLUIDA" && i.status !== "CANCELADA" && i.quando && i.quando < hoje).length,
    concluidas: items.filter((i: any) => i.status === "CONCLUIDA").length,
  }), [items, hoje]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Wrench className="h-6 w-6 text-red-600" /> Plano de Ações (5W2H)
          </h1>
          <p className="text-sm text-slate-500">Ações corretivas e melhorias — ciclo AGIR (PDCA)</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-red-700 hover:bg-red-800"><Plus className="h-4 w-4 mr-1" /> Nova ação</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Nova Ação · 5W2H</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>O QUÊ (título) *</Label><Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} /></div>
              <div><Label>POR QUÊ (justificativa)</Label><Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={2} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>COMO</Label><Textarea value={form.como} onChange={(e) => setForm({ ...form, como: e.target.value })} rows={2} /></div>
                <div><Label>ONDE</Label><Textarea value={form.onde} onChange={(e) => setForm({ ...form, onde: e.target.value })} rows={2} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>QUANDO (prazo)</Label><Input type="date" value={form.quando} onChange={(e) => setForm({ ...form, quando: e.target.value })} /></div>
                <div><Label>Prioridade</Label>
                  <Select value={form.prioridade} onValueChange={(v) => setForm({ ...form, prioridade: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BAIXA">Baixa</SelectItem>
                      <SelectItem value="MEDIA">Média</SelectItem>
                      <SelectItem value="ALTA">Alta</SelectItem>
                      <SelectItem value="CRITICA">Crítica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>QUANTO (R$)</Label><Input type="number" step="0.01" value={form.custo} onChange={(e) => setForm({ ...form, custo: e.target.value })} /></div>
              </div>
              <div><Label>Observações</Label><Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={2} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => create.mutate()} disabled={create.isPending} className="bg-red-700 hover:bg-red-800">Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4"><div className="flex items-center justify-between"><div><div className="text-xs text-slate-500">Total</div><div className="text-2xl font-bold">{stats.total}</div></div><Wrench className="h-7 w-7 text-slate-400" /></div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center justify-between"><div><div className="text-xs text-slate-500">Em andamento</div><div className="text-2xl font-bold text-blue-600">{stats.pendentes}</div></div><Clock className="h-7 w-7 text-blue-400" /></div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center justify-between"><div><div className="text-xs text-slate-500">Atrasadas</div><div className="text-2xl font-bold text-red-600">{stats.atrasadas}</div></div><AlertTriangle className="h-7 w-7 text-red-400" /></div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center justify-between"><div><div className="text-xs text-slate-500">Concluídas</div><div className="text-2xl font-bold text-emerald-600">{stats.concluidas}</div></div><CheckCircle2 className="h-7 w-7 text-emerald-400" /></div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Ações</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
            <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="text-sm text-slate-500">Carregando...</div> :
            filtered.length === 0 ? <div className="text-sm text-slate-500 text-center py-8">Nenhuma ação cadastrada.</div> :
            <div className="space-y-2">
              {filtered.map((i: any) => {
                const atrasada = i.quando && i.quando < hoje && i.status !== "CONCLUIDA" && i.status !== "CANCELADA";
                return (
                  <div key={i.id} className={`border rounded-lg p-3 hover:bg-slate-50 ${atrasada ? "border-red-300 bg-red-50/30" : ""}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-900">{i.titulo}</div>
                        {i.descricao && <div className="text-xs text-slate-500 line-clamp-2">{i.descricao}</div>}
                        <div className="text-[11px] text-slate-400 mt-1">
                          {i.quando && <span className={atrasada ? "text-red-600 font-semibold" : ""}>Prazo: {new Date(i.quando).toLocaleDateString("pt-BR")}</span>}
                          {i.custo != null && ` · R$ ${Number(i.custo).toFixed(2)}`}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Badge variant="outline" className={PRIO_STYLES[i.prioridade]}>{i.prioridade}</Badge>
                        <Badge variant="outline" className={STATUS_STYLES[atrasada ? "ATRASADA" : i.status]}>{(atrasada ? "ATRASADA" : i.status).replace("_", " ")}</Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          }
        </CardContent>
      </Card>
    </div>
  );
}