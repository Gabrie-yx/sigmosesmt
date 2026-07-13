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
import { Target, Plus, ChevronRight, ChevronLeft, ClipboardList, Trash2, Info, Camera, ShieldAlert, FileText, Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/app/sesmt/inspecoes/")({
  component: InspecoesList,
});

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  rascunho: { label: "Rascunho", cls: "bg-slate-200 text-slate-700" },
  em_revisao: { label: "Em revisão", cls: "bg-amber-200 text-amber-800" },
  publicada: { label: "Publicada", cls: "bg-emerald-200 text-emerald-800" },
  arquivada: { label: "Arquivada", cls: "bg-zinc-200 text-zinc-600" },
};

function InspecoesList() {
  const { user, roles } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [excluir, setExcluir] = useState<{ id: string; local: string } | null>(null);
  const canDelete = roles?.some((r) => r === "admin" || r === "tst");

  const { data: notifs = [] } = useQuery({
    queryKey: ["sesmt-notifs-me", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sesmt_notificacoes")
        .select("id, titulo, corpo, link, prazo, created_at, lida_em")
        .eq("user_id", user!.id)
        .is("lida_em", null)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  const marcarLida = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sesmt_notificacoes").update({ lida_em: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sesmt-notifs-me"] }),
  });

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
    ghe_id: "",
  });

  const { data: ghes = [] } = useQuery({
    queryKey: ["pgr-ghes-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pgr_ghe").select("id, numero, setor, descricao_ambiente").eq("ativo", true).order("numero");
      if (error) throw error;
      return data ?? [];
    },
  });

  const criar = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessão expirada");
      if (!form.local_descricao.trim()) throw new Error("Informe o local");
      const { data, error } = await supabase
        .from("inspecoes")
        .insert({
          empresa_id: form.empresa_id || null,
          ghe_id: form.ghe_id || null,
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

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inspecoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Inspeção excluída");
      qc.invalidateQueries({ queryKey: ["inspecoes"] });
      setExcluir(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir"),
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
        <div className="flex items-center gap-2">
          {canDelete && (
            <Button asChild size="sm" variant="outline" className="gap-1 h-9 text-xs">
              <Link to="/app/sesmt/vincular-usuarios">Vincular usuários</Link>
            </Button>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> Nova inspeção</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nova inspeção (rascunho)</DialogTitle>
            </DialogHeader>
            <div className="rounded border border-emerald-200 bg-emerald-50 text-emerald-900 text-[11px] p-2 flex gap-2">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                Isto cria um <b>rascunho</b>. No próximo passo você vai <b>anexar fotos</b> (celular ou CFTV),
                <b> registrar não conformidades</b> (NR + matriz 5x5) e montar o <b>plano de ação (PDCA)</b>.
                Nada é publicado até você clicar em <b>Publicar</b>. Fotos e dados podem ser editados/excluídos enquanto estiver em rascunho.
              </div>
            </div>
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
                <Label>GHE / setor (opcional)</Label>
                <Select
                  value={form.ghe_id}
                  onValueChange={(v) => {
                    const g = ghes.find((x: any) => x.id === v);
                    setForm((f) => ({
                      ...f,
                      ghe_id: v,
                      local_descricao: f.local_descricao.trim()
                        ? f.local_descricao
                        : g ? `GHE ${g.numero} — ${g.setor}` : f.local_descricao,
                    }));
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Vincular a um GHE do PGR..." /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {ghes.map((g: any) => (
                      <SelectItem key={g.id} value={g.id}>GHE {g.numero} — {g.setor}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-slate-500 mt-1">Ao escolher um GHE, o local é preenchido automaticamente e a inspeção alimenta o inventário de riscos daquele GHE.</p>
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
                const podeExcluir = canDelete && (it.status === "rascunho" || it.status === "em_revisao");
                return (
                  <div key={it.id} className="flex items-center gap-2 py-3 hover:bg-slate-50 -mx-2 px-2 rounded">
                    <Link to="/app/sesmt/inspecoes/$id" params={{ id: it.id }} className="flex items-center gap-3 flex-1 min-w-0">
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
                    {podeExcluir && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-red-600 hover:bg-red-50"
                        title="Excluir inspeção"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setExcluir({ id: it.id, local: it.local_descricao }); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {notifs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-wide text-orange-700 flex items-center gap-2">
              <Bell className="h-4 w-4" /> Minhas pendências ({notifs.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {notifs.map((n: any) => (
              <div key={n.id} className="flex items-start gap-2 border rounded p-2 bg-orange-50/40">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-slate-800">{n.titulo}</div>
                  {n.corpo && <div className="text-[11px] text-slate-600 whitespace-pre-line">{n.corpo}</div>}
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {n.prazo && <>Prazo: {format(new Date(n.prazo + "T00:00:00"), "dd/MM/yyyy")} · </>}
                    {format(new Date(n.created_at), "dd/MM/yyyy HH:mm")}
                  </div>
                </div>
                {n.link && (
                  <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => navigate({ to: n.link })}>
                    Abrir
                  </Button>
                )}
                <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-700" title="Marcar como lida" onClick={() => marcarLida.mutate(n.id)}>
                  <CheckCheck className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-[11px] font-black uppercase tracking-wide text-slate-600 flex items-center gap-2">
            <Info className="h-3.5 w-3.5" /> Como funciona
          </CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-3 text-[11px] text-slate-600">
          <div className="flex gap-2"><Camera className="h-4 w-4 text-emerald-700 shrink-0" /><div><b>1. Rascunho + evidências.</b> Crie a inspeção e anexe fotos (celular/CFTV). Cada foto guarda hash, timestamp e GPS.</div></div>
          <div className="flex gap-2"><ShieldAlert className="h-4 w-4 text-orange-600 shrink-0" /><div><b>2. NCs + PDCA.</b> Registre não conformidades por NR, classifique risco (matriz 5x5) e crie plano de ação.</div></div>
          <div className="flex gap-2"><FileText className="h-4 w-4 text-slate-700 shrink-0" /><div><b>3. Publicar.</b> Em rascunho, tudo é editável/excluível. Após publicar, vira registro rastreável.</div></div>
        </CardContent>
      </Card>

      <Dialog open={!!excluir} onOpenChange={(v) => !v && setExcluir(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Excluir inspeção?</DialogTitle></DialogHeader>
          <div className="text-sm text-slate-700">
            Vai remover permanentemente a inspeção <b>{excluir?.local}</b> junto com todas as fotos, NCs e planos vinculados.
            Essa ação não pode ser desfeita.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExcluir(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => excluir && remover.mutate(excluir.id)} disabled={remover.isPending}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}