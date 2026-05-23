import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Wrench, Plus, Search, CheckCircle2, Clock, AlertTriangle, ShieldCheck, Info, ThumbsUp, ThumbsDown, Pencil, Trash2 } from "lucide-react";
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
const EFICACIA_STYLES: Record<string, string> = {
  PENDENTE: "bg-purple-100 text-purple-700 border-purple-200",
  EFICAZ: "bg-emerald-100 text-emerald-700 border-emerald-200",
  INEFICAZ: "bg-red-100 text-red-700 border-red-200",
};
const ORIGEM_LABEL: Record<string, string> = {
  AUDITORIA: "Auditoria",
  INSPECAO_SST: "Inspeção SST",
  QUASE_ACIDENTE: "Quase Acidente",
  CIPA: "CIPA",
  PGR_APR: "PGR / APR",
  CHECKLIST: "Checklist",
  OUTRO: "Outro",
};

const EMPTY_FORM = {
  tipo_registro: "ACAO_CORRETIVA",
  origem_acao: "",
  nc_id: "",
  titulo: "",
  descricao: "",
  analise_causa: "",
  como: "",
  onde: "",
  quando: "",
  prioridade: "MEDIA",
  custo: "",
  responsavel_execucao: "",
  responsavel_validacao_id: "",
  observacoes: "",
};

function AcoesPage() {
  const { user, isModerator } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("identificacao");
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [eficaciaOpen, setEficaciaOpen] = useState<null | { id: string; titulo: string }>(null);
  const [eficaciaForm, setEficaciaForm] = useState<{ eficaz: "true" | "false"; obs: string }>({ eficaz: "true", obs: "" });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["plano-acoes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("plano_acoes")
        .select("*").order("quando", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: ncs = [] } = useQuery({
    queryKey: ["ncs-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("nao_conformidades")
        .select("id, numero, titulo, origem, analise_causa")
        .order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles")
        .select("id, full_name").order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const selectedNc = useMemo(
    () => ncs.find((n: any) => n.id === form.nc_id) ?? null,
    [ncs, form.nc_id]
  );

  useEffect(() => {
    if (selectedNc?.analise_causa && !form.analise_causa) {
      setForm((f) => ({ ...f, analise_causa: selectedNc.analise_causa ?? "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNc?.id]);

  const create = useMutation({
    mutationFn: async () => {
      if (!form.titulo.trim()) throw new Error("Informe o título (O Quê)");
      if (!form.responsavel_execucao.trim()) throw new Error("Informe o responsável pela execução");
      if (form.nc_id && form.analise_causa.trim()) {
        const { error: ncErr } = await supabase
          .from("nao_conformidades")
          .update({ analise_causa: form.analise_causa })
          .eq("id", form.nc_id);
        if (ncErr) throw ncErr;
      }
      const payload = {
        titulo: form.titulo,
        descricao: form.descricao || null,
        tipo_registro: form.tipo_registro,
        origem_acao: form.origem_acao || null,
        nc_id: form.nc_id || null,
        como: form.como || null,
        onde: form.onde || null,
        quando: form.quando || null,
        prioridade: form.prioridade,
        custo: form.custo ? Number(form.custo) : null,
        responsavel_execucao: form.responsavel_execucao || null,
        responsavel_validacao_id: form.responsavel_validacao_id || null,
        observacoes: form.observacoes || null,
      };
      if (editingId) {
        const { error } = await supabase.from("plano_acoes").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("plano_acoes").insert({ ...payload, created_by: user?.id ?? null });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "Ação atualizada" : "Ação adicionada ao plano");
      setOpen(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
      setTab("identificacao");
      qc.invalidateQueries({ queryKey: ["plano-acoes"] });
      qc.invalidateQueries({ queryKey: ["ncs-min"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const concluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("plano_acoes")
        .update({ status: "CONCLUIDA" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ação concluída — verificação de eficácia agendada");
      qc.invalidateQueries({ queryKey: ["plano-acoes"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("plano_acoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ação excluída");
      qc.invalidateQueries({ queryKey: ["plano-acoes"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  function openEdit(i: any) {
    setEditingId(i.id);
    setForm({
      tipo_registro: i.tipo_registro ?? "ACAO_CORRETIVA",
      origem_acao: i.origem_acao ?? "",
      nc_id: i.nc_id ?? "",
      titulo: i.titulo ?? "",
      descricao: i.descricao ?? "",
      analise_causa: "",
      como: i.como ?? "",
      onde: i.onde ?? "",
      quando: i.quando ? String(i.quando).slice(0, 10) : "",
      prioridade: i.prioridade ?? "MEDIA",
      custo: i.custo != null ? String(i.custo) : "",
      responsavel_execucao: i.responsavel_execucao ?? "",
      responsavel_validacao_id: i.responsavel_validacao_id ?? "",
      observacoes: i.observacoes ?? "",
    });
    setTab("identificacao");
    setOpen(true);
  }

  const validarEficacia = useMutation({
    mutationFn: async () => {
      if (!eficaciaOpen) return;
      const { error } = await supabase.rpc("validar_eficacia_acao", {
        _id: eficaciaOpen.id,
        _eficaz: eficaciaForm.eficaz === "true",
        _obs: eficaciaForm.obs || undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Eficácia registrada");
      setEficaciaOpen(null);
      setEficaciaForm({ eficaz: "true", obs: "" });
      qc.invalidateQueries({ queryKey: ["plano-acoes"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const hoje = new Date().toISOString().slice(0, 10);
  const agora = useMemo(() => new Date(), []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return items;
    return items.filter((i: any) =>
      i.titulo?.toLowerCase().includes(s) ||
      i.descricao?.toLowerCase().includes(s) ||
      i.responsavel_execucao?.toLowerCase().includes(s));
  }, [items, search]);

  const stats = useMemo(() => ({
    total: items.length,
    pendentes: items.filter((i: any) => i.status === "PENDENTE" || i.status === "EM_ANDAMENTO").length,
    atrasadas: items.filter((i: any) => i.status !== "CONCLUIDA" && i.status !== "CANCELADA" && i.quando && i.quando < hoje).length,
    concluidas: items.filter((i: any) => i.status === "CONCLUIDA").length,
    pendenteEficacia: items.filter((i: any) =>
      i.status === "CONCLUIDA" &&
      i.status_eficacia === "PENDENTE" &&
      i.data_verificacao_eficacia &&
      new Date(i.data_verificacao_eficacia) <= agora
    ).length,
  }), [items, hoje, agora]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Wrench className="h-6 w-6 text-red-600" /> Plano de Ações (5W2H)
          </h1>
          <p className="text-sm text-slate-500">Ações corretivas e melhorias — ISO 9001:2015 (PDCA)</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-red-700 hover:bg-red-800"><Plus className="h-4 w-4 mr-1" /> Nova ação</Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nova Ação · 5W2H</DialogTitle></DialogHeader>
            <Tabs value={tab} onValueChange={setTab} className="mt-2">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="identificacao">1. Identificação</TabsTrigger>
                <TabsTrigger value="investigacao">2. Investigação</TabsTrigger>
                <TabsTrigger value="planejamento">3. Planejamento</TabsTrigger>
              </TabsList>

              <TabsContent value="identificacao" className="space-y-4 pt-4">
                <div>
                  <Label className="mb-2 block">Tipo de Registro *</Label>
                  <RadioGroup
                    value={form.tipo_registro}
                    onValueChange={(v) => setForm({ ...form, tipo_registro: v })}
                    className="grid grid-cols-2 gap-3"
                  >
                    <label className="flex items-start gap-2 border rounded-lg p-3 cursor-pointer hover:bg-slate-50 [&:has([data-state=checked])]:border-red-600 [&:has([data-state=checked])]:bg-red-50/40">
                      <RadioGroupItem value="ACAO_CORRETIVA" className="mt-0.5" />
                      <div>
                        <div className="text-sm font-medium">Ação Corretiva</div>
                        <div className="text-xs text-slate-500">Corrigir desvio já ocorrido</div>
                      </div>
                    </label>
                    <label className="flex items-start gap-2 border rounded-lg p-3 cursor-pointer hover:bg-slate-50 [&:has([data-state=checked])]:border-emerald-600 [&:has([data-state=checked])]:bg-emerald-50/40">
                      <RadioGroupItem value="MELHORIA" className="mt-0.5" />
                      <div>
                        <div className="text-sm font-medium">Oportunidade de Melhoria</div>
                        <div className="text-xs text-slate-500">Aprimorar processo existente</div>
                      </div>
                    </label>
                  </RadioGroup>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Origem da Ação</Label>
                    <Select value={form.origem_acao} onValueChange={(v) => setForm({ ...form, origem_acao: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(ORIGEM_LABEL).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Vincular a uma NC (opcional)</Label>
                    <Select value={form.nc_id || "__none"} onValueChange={(v) => setForm({ ...form, nc_id: v === "__none" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">— Nenhuma —</SelectItem>
                        {ncs.map((n: any) => (
                          <SelectItem key={n.id} value={n.id}>{n.numero} · {n.titulo}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>O QUÊ (título da ação) *</Label>
                  <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
                </div>
                <div>
                  <Label>POR QUÊ (justificativa / descrição do desvio)</Label>
                  <Textarea rows={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
                </div>
              </TabsContent>

              <TabsContent value="investigacao" className="space-y-4 pt-4">
                <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 text-xs text-blue-900 flex gap-2">
                  <Info className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold mb-1">Técnica dos 5 Porquês</div>
                    Pergunte "por quê?" cinco vezes até chegar à causa raiz. Ex.: <em>1) Por que ocorreu? Por falha do equipamento. 2) Por que falhou? Falta de manutenção. 3) Por quê...</em>
                  </div>
                </div>

                {!form.nc_id && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900 flex gap-2">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <div>Para registrar a causa raiz no histórico ISO 9001, recomenda-se vincular esta ação a uma <strong>Não Conformidade</strong> na aba anterior.</div>
                  </div>
                )}

                <div>
                  <Label>Análise de Causa (O Porquê do Desvio)</Label>
                  <Textarea
                    rows={8}
                    value={form.analise_causa}
                    onChange={(e) => setForm({ ...form, analise_causa: e.target.value })}
                    placeholder={"1. Por que ocorreu?\n2. Por que isso aconteceu?\n3. Por quê?\n4. Por quê?\n5. Causa raiz:"}
                  />
                  {form.nc_id && (
                    <p className="text-[11px] text-slate-500 mt-1">Será salvo também na NC vinculada.</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="planejamento" className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>COMO (método)</Label><Textarea rows={3} value={form.como} onChange={(e) => setForm({ ...form, como: e.target.value })} /></div>
                  <div><Label>ONDE (local)</Label><Textarea rows={3} value={form.onde} onChange={(e) => setForm({ ...form, onde: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>QUANDO (prazo)</Label><Input type="date" value={form.quando} onChange={(e) => setForm({ ...form, quando: e.target.value })} /></div>
                  <div>
                    <Label>Prioridade</Label>
                    <Select value={form.prioridade} onValueChange={(v) => setForm({ ...form, prioridade: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BAIXA">Baixa (60d eficácia)</SelectItem>
                        <SelectItem value="MEDIA">Média (30d eficácia)</SelectItem>
                        <SelectItem value="ALTA">Alta (15d eficácia)</SelectItem>
                        <SelectItem value="CRITICA">Crítica (15d eficácia)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>QUANTO (R$)</Label><Input type="number" step="0.01" value={form.custo} onChange={(e) => setForm({ ...form, custo: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>QUEM executa *</Label>
                    <Input
                      placeholder="Nome do executor"
                      value={form.responsavel_execucao}
                      onChange={(e) => setForm({ ...form, responsavel_execucao: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>QUEM valida (gestor)</Label>
                    <Select
                      value={form.responsavel_validacao_id || "__none"}
                      onValueChange={(v) => setForm({ ...form, responsavel_validacao_id: v === "__none" ? "" : v })}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">— Não definido —</SelectItem>
                        {profiles
                          .filter((p: any) => p.id !== user?.id)
                          .map((p: any) => (
                            <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.id.slice(0, 8)}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Observações</Label><Textarea rows={2} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>
              </TabsContent>
            </Tabs>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              {tab !== "identificacao" && (
                <Button variant="outline" onClick={() => setTab(tab === "planejamento" ? "investigacao" : "identificacao")}>Anterior</Button>
              )}
              {tab !== "planejamento" ? (
                <Button onClick={() => setTab(tab === "identificacao" ? "investigacao" : "planejamento")} className="bg-red-700 hover:bg-red-800">Próximo</Button>
              ) : (
                <Button onClick={() => create.mutate()} disabled={create.isPending} className="bg-red-700 hover:bg-red-800">Salvar</Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="pt-4"><div className="flex items-center justify-between"><div><div className="text-xs text-slate-500">Total</div><div className="text-2xl font-bold">{stats.total}</div></div><Wrench className="h-7 w-7 text-slate-400" /></div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center justify-between"><div><div className="text-xs text-slate-500">Em andamento</div><div className="text-2xl font-bold text-blue-600">{stats.pendentes}</div></div><Clock className="h-7 w-7 text-blue-400" /></div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center justify-between"><div><div className="text-xs text-slate-500">Atrasadas</div><div className="text-2xl font-bold text-red-600">{stats.atrasadas}</div></div><AlertTriangle className="h-7 w-7 text-red-400" /></div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center justify-between"><div><div className="text-xs text-slate-500">Concluídas</div><div className="text-2xl font-bold text-emerald-600">{stats.concluidas}</div></div><CheckCircle2 className="h-7 w-7 text-emerald-400" /></div></CardContent></Card>
        <Card className="border-purple-200 bg-purple-50/40"><CardContent className="pt-4"><div className="flex items-center justify-between"><div><div className="text-xs text-purple-700">Pendente de eficácia</div><div className="text-2xl font-bold text-purple-700">{stats.pendenteEficacia}</div></div><ShieldCheck className="h-7 w-7 text-purple-500" /></div></CardContent></Card>
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
          {isLoading ? (
            <div className="text-sm text-slate-500">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-slate-500 text-center py-8">Nenhuma ação cadastrada.</div>
          ) : (
            <div className="space-y-2">
              {filtered.map((i: any) => {
                const atrasada = i.quando && i.quando < hoje && i.status !== "CONCLUIDA" && i.status !== "CANCELADA";
                const eficaciaDue = i.status === "CONCLUIDA" && i.status_eficacia === "PENDENTE" &&
                  i.data_verificacao_eficacia && new Date(i.data_verificacao_eficacia) <= agora;
                return (
                  <div key={i.id} className={`border rounded-lg p-3 hover:bg-slate-50 ${atrasada ? "border-red-300 bg-red-50/30" : ""} ${eficaciaDue ? "border-purple-300 bg-purple-50/20" : ""}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-900 flex items-center gap-2 flex-wrap">
                          <span>{i.titulo}</span>
                          {i.tipo_registro === "MELHORIA" && (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">Melhoria</Badge>
                          )}
                          {i.origem_acao && (
                            <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-[10px]">{ORIGEM_LABEL[i.origem_acao] ?? i.origem_acao}</Badge>
                          )}
                        </div>
                        {i.descricao && <div className="text-xs text-slate-500 line-clamp-2">{i.descricao}</div>}
                        <div className="text-[11px] text-slate-400 mt-1">
                          {i.quando && <span className={atrasada ? "text-red-600 font-semibold" : ""}>Prazo: {new Date(i.quando).toLocaleDateString("pt-BR")}</span>}
                          {i.custo != null && ` · R$ ${Number(i.custo).toFixed(2)}`}
                          {i.responsavel_execucao && ` · Exec: ${i.responsavel_execucao}`}
                          {i.data_verificacao_eficacia && i.status === "CONCLUIDA" && (
                            <span className="text-purple-700"> · Verif. eficácia: {new Date(i.data_verificacao_eficacia).toLocaleDateString("pt-BR")}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0 flex-wrap justify-end">
                        <Badge variant="outline" className={PRIO_STYLES[i.prioridade]}>{i.prioridade}</Badge>
                        <Badge variant="outline" className={STATUS_STYLES[atrasada ? "ATRASADA" : i.status]}>{(atrasada ? "ATRASADA" : i.status).replace("_", " ")}</Badge>
                        {i.status_eficacia && (
                          <Badge variant="outline" className={EFICACIA_STYLES[i.status_eficacia]}>
                            {i.status_eficacia === "PENDENTE" ? "Aguardando eficácia" : i.status_eficacia === "EFICAZ" ? "Eficaz" : "Ineficaz"}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2 justify-end">
                      {i.status !== "CONCLUIDA" && i.status !== "CANCELADA" && (
                        <Button size="sm" variant="outline" onClick={() => concluir.mutate(i.id)} disabled={concluir.isPending}>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Concluir
                        </Button>
                      )}
                      {eficaciaDue && isModerator && (
                        <Button
                          size="sm"
                          className="bg-purple-700 hover:bg-purple-800"
                          onClick={() => { setEficaciaOpen({ id: i.id, titulo: i.titulo }); setEficaciaForm({ eficaz: "true", obs: "" }); }}
                        >
                          <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Validar eficácia
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!eficaciaOpen} onOpenChange={(o) => !o && setEficaciaOpen(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Validar Eficácia da Ação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-slate-600 border-l-2 border-purple-300 pl-3">{eficaciaOpen?.titulo ?? ""}</div>
            <div>
              <Label className="mb-2 block">A ação eliminou definitivamente a causa raiz?</Label>
              <RadioGroup
                value={eficaciaForm.eficaz}
                onValueChange={(v) => setEficaciaForm({ ...eficaciaForm, eficaz: v as "true" | "false" })}
                className="grid grid-cols-2 gap-2"
              >
                <label className="flex items-center gap-2 border rounded-lg p-3 cursor-pointer hover:bg-emerald-50 [&:has([data-state=checked])]:border-emerald-600 [&:has([data-state=checked])]:bg-emerald-50">
                  <RadioGroupItem value="true" />
                  <ThumbsUp className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-medium">Sim — Eficaz</span>
                </label>
                <label className="flex items-center gap-2 border rounded-lg p-3 cursor-pointer hover:bg-red-50 [&:has([data-state=checked])]:border-red-600 [&:has([data-state=checked])]:bg-red-50">
                  <RadioGroupItem value="false" />
                  <ThumbsDown className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium">Não — Ineficaz</span>
                </label>
              </RadioGroup>
            </div>
            <div>
              <Label>Observação</Label>
              <Textarea
                rows={3}
                placeholder={eficaciaForm.eficaz === "false" ? "Descreva o que falhou — recomenda-se abrir nova ação" : "Evidências da eficácia (opcional)"}
                value={eficaciaForm.obs}
                onChange={(e) => setEficaciaForm({ ...eficaciaForm, obs: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEficaciaOpen(null)}>Cancelar</Button>
            <Button onClick={() => validarEficacia.mutate()} disabled={validarEficacia.isPending} className="bg-purple-700 hover:bg-purple-800">
              Registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}