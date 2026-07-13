import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Target, Plus, ChevronRight, ChevronLeft, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/app/sesmt/inspecoes")({
  component: InspecoesList,
});

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  rascunho: { label: "Rascunho", cls: "bg-slate-200 text-slate-700" },
  em_revisao: { label: "Em revisão", cls: "bg-amber-200 text-amber-800" },
  publicada: { label: "Publicada", cls: "bg-emerald-200 text-emerald-800" },
  arquivada: { label: "Arquivada", cls: "bg-zinc-200 text-zinc-600" },
};

function InspecoesList() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const { data: inspecoes = [], isLoading } = useQuery({
    queryKey: ["inspecoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspecoes")
        .select("id, local_descricao, data_inspecao, escopo, status, tipo_local, participantes, created_at, empresa_id, companies(nome_fantasia,name)")
        .order("data_inspecao", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: empresas = [] } = useQuery({
    queryKey: ["companies-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("id, name, nome_fantasia").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [form, setForm] = useState({
    empresa_id: "",
    local_descricao: "",
    data_inspecao: format(new Date(), "yyyy-MM-dd"),
    escopo: "",
    tipo_local: "",
    participantes: "",
  });

  const criar = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessão expirada");
      if (!form.local_descricao.trim()) throw new Error("Informe o local");
      const { data, error } = await supabase
        .from("inspecoes")
        .insert({
          empresa_id: form.empresa_id || null,
          local_descricao: form.local_descricao.trim(),
          data_inspecao: form.data_inspecao,
          escopo: form.escopo.trim() || null,
          tipo_local: form.tipo_local.trim() || null,
          participantes: form.participantes.trim() || null,
          aberta_por: user.id,
          status: "rascunho",
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      toast.success("Rascunho criado");
      qc.invalidateQueries({ queryKey: ["inspecoes"] });
      setOpen(false);
      navigate({ to: "/app/sesmt/inspecoes/$id", params: { id } });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao criar"),
  });

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      <Link to="/app" className="text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-slate-800 flex items-center gap-1">
        <ChevronLeft className="h-3 w-3" /> Início
      </Link>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Target className="h-6 w-6 text-emerald-700" />
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight text-slate-900">Inspeções de Segurança</h1>
            <p className="text-xs text-slate-500">Registro rastreável de inspeções, NCs e planos de ação (PDCA)</p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> Nova inspeção</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nova inspeção (rascunho)</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3">
              <div>
                <Label>Empresa</Label>
                <Select value={form.empresa_id} onValueChange={(v) => setForm((f) => ({ ...f, empresa_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {empresas.map((e: any) => (
                      <SelectItem key={e.id} value={e.id}>{e.nome_fantasia ?? e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Local / área inspecionada *</Label>
                <Input value={form.local_descricao} onChange={(e) => setForm((f) => ({ ...f, local_descricao: e.target.value }))} placeholder="Ex.: Casco 421 — deck principal" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Data</Label>
                  <Input type="date" value={form.data_inspecao} onChange={(e) => setForm((f) => ({ ...f, data_inspecao: e.target.value }))} />
                </div>
                <div>
                  <Label>Tipo do local</Label>
                  <Input value={form.tipo_local} onChange={(e) => setForm((f) => ({ ...f, tipo_local: e.target.value }))} placeholder="Ex.: Espaço confinado" />
                </div>
              </div>
              <div>
                <Label>Escopo</Label>
                <Textarea rows={2} value={form.escopo} onChange={(e) => setForm((f) => ({ ...f, escopo: e.target.value }))} placeholder="O que está sendo inspecionado" />
              </div>
              <div>
                <Label>Participantes</Label>
                <Textarea rows={2} value={form.participantes} onChange={(e) => setForm((f) => ({ ...f, participantes: e.target.value }))} placeholder="Nome / função dos presentes" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => criar.mutate()} disabled={criar.isPending}>Criar e abrir</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-black uppercase tracking-wide text-slate-800 flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> Inspeções recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-slate-500">Carregando...</div>
          ) : inspecoes.length === 0 ? (
            <div className="text-sm text-slate-500 py-8 text-center">Nenhuma inspeção ainda. Clique em "Nova inspeção" para começar.</div>
          ) : (
            <div className="divide-y">
              {inspecoes.map((it: any) => {
                const st = STATUS_LABEL[it.status] ?? STATUS_LABEL.rascunho;
                return (
                  <Link key={it.id} to="/app/sesmt/inspecoes/$id" params={{ id: it.id }} className="flex items-center gap-3 py-3 hover:bg-slate-50 -mx-2 px-2 rounded">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-800 truncate">{it.local_descricao}</div>
                      <div className="text-[11px] text-slate-500 flex gap-2 flex-wrap">
                        <span>{format(new Date(it.data_inspecao + "T00:00:00"), "dd/MM/yyyy")}</span>
                        {it.companies && <span>· {it.companies.nome_fantasia ?? it.companies.name}</span>}
                        {it.tipo_local && <span>· {it.tipo_local}</span>}
                      </div>
                    </div>
                    <Badge className={st.cls + " text-[10px]"}>{st.label}</Badge>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}