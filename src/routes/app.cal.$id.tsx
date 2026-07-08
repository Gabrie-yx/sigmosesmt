import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, CheckCircle2, XCircle, Upload, Paperclip, ClockIcon, Scale, ShieldCheck, Link2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  CAL_STATUS_LABEL, CAL_STATUS_COLOR, CAL_CRITICIDADE_LABEL, CAL_CRITICIDADE_COLOR,
  CAL_MODULOS, CAL_MODULO_LABEL, daysUntil, type CalStatus, type CalModulo,
} from "@/lib/cal-utils";

export const Route = createFileRoute("/app/cal/$id")({
  component: CalDetalhePage,
  head: () => ({ meta: [{ title: "Detalhe do CAL · SIGMO" }] }),
});

function CalDetalhePage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: req } = useQuery({
    queryKey: ["cal_req", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cal_requisitos").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: aplic } = useQuery({
    queryKey: ["cal_aplic", id],
    queryFn: async () => {
      const { data } = await supabase.from("cal_aplicabilidade").select("*").eq("requisito_id", id).maybeSingle();
      return data;
    },
  });

  const { data: impactos = [] } = useQuery({
    queryKey: ["cal_imp", id],
    queryFn: async () => {
      const { data } = await supabase.from("cal_impactos_modulos").select("*").eq("requisito_id", id).order("criado_em");
      return data ?? [];
    },
  });

  const { data: evid = [] } = useQuery({
    queryKey: ["cal_ev", id],
    queryFn: async () => {
      const { data } = await supabase.from("cal_evidencias").select("*").eq("requisito_id", id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: hist = [] } = useQuery({
    queryKey: ["cal_hist", id],
    queryFn: async () => {
      const { data } = await supabase.from("cal_historico").select("*").eq("requisito_id", id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const mudarStatus = useMutation({
    mutationFn: async (status: CalStatus) => {
      const patch: any = { status };
      if (status === "atendido") { patch.fechado_em = new Date().toISOString(); patch.fechado_por = user?.id ?? null; }
      const { error } = await supabase.from("cal_requisitos").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Status atualizado"); qc.invalidateQueries({ queryKey: ["cal_req", id] }); qc.invalidateQueries({ queryKey: ["cal_hist", id] }); qc.invalidateQueries({ queryKey: ["cal_requisitos"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  if (!req) return <div className="p-6 text-muted-foreground">Carregando...</div>;

  const d = daysUntil(req.prazo_atendimento);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/app/cal" })}><ArrowLeft className="h-4 w-4 mr-1" />Voltar</Button>
        <Scale className="h-5 w-5 text-red-500" />
        <h1 className="text-xl font-semibold flex-1">CAL {req.numero_cal}</h1>
        <Badge variant="outline" className={CAL_STATUS_COLOR[req.status]}>{CAL_STATUS_LABEL[req.status]}</Badge>
        <Badge variant="outline" className={CAL_CRITICIDADE_COLOR[req.criticidade]}>{CAL_CRITICIDADE_LABEL[req.criticidade]}</Badge>
      </div>

      {/* Cabeçalho */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Requisito Legal</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="Norma" value={req.norma} />
            <Field label="Órgão" value={req.orgao} />
            <Field label="Área" value={req.area} />
            <Field label="Data publicação" value={req.data_publicacao ? new Date(req.data_publicacao + "T00:00:00").toLocaleDateString("pt-BR") : "—"} />
            <Field label="Recebido em" value={new Date(req.data_recebimento + "T00:00:00").toLocaleDateString("pt-BR")} />
            <Field label="Cliente" value={req.cliente} />
            <Field label="Prazo" value={req.prazo_atendimento ? `${new Date(req.prazo_atendimento + "T00:00:00").toLocaleDateString("pt-BR")}${d !== null ? ` (${d < 0 ? -d + "d atraso" : d + "d"})` : ""}` : "—"} tone={d !== null && d < 0 ? "danger" : undefined} />
            <Field label="Origem" value={req.origem} />
          </div>
          <Separator className="my-2" />
          <div>
            <div className="text-xs text-muted-foreground mb-1">Ementa</div>
            <p className="whitespace-pre-wrap">{req.ementa}</p>
          </div>
          {req.texto_legal && (
            <div className="mt-2">
              <div className="text-xs text-muted-foreground mb-1">Texto legal</div>
              <p className="whitespace-pre-wrap text-xs bg-muted/40 p-2 rounded max-h-64 overflow-y-auto">{req.texto_legal}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Aplicabilidade */}
      <AplicabilidadeCard requisitoId={id} atual={aplic} userId={user?.id ?? null} status={req.status} onChange={() => { qc.invalidateQueries({ queryKey: ["cal_aplic", id] }); qc.invalidateQueries({ queryKey: ["cal_req", id] }); qc.invalidateQueries({ queryKey: ["cal_hist", id] }); }} />

      {/* Impactos + Desdobramento */}
      <ImpactosCard requisito={req} impactos={impactos} onChange={() => { qc.invalidateQueries({ queryKey: ["cal_imp", id] }); qc.invalidateQueries({ queryKey: ["cal_hist", id] }); }} userId={user?.id ?? null} />

      {/* Evidências */}
      <EvidenciasCard requisitoId={id} evid={evid} userId={user?.id ?? null} onChange={() => qc.invalidateQueries({ queryKey: ["cal_ev", id] })} />

      {/* Ações de status */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Fluxo</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {(["em_analise","aplicavel","nao_aplicavel","em_tratativa","atendido","monitoramento"] as CalStatus[]).map((s) => (
            <Button key={s} size="sm" variant={req.status === s ? "default" : "outline"} onClick={() => mudarStatus.mutate(s)} disabled={mudarStatus.isPending}>
              {CAL_STATUS_LABEL[s]}
            </Button>
          ))}
        </CardContent>
      </Card>

      {/* Histórico */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ClockIcon className="h-4 w-4" />Histórico</CardTitle></CardHeader>
        <CardContent>
          {hist.length === 0 ? <p className="text-xs text-muted-foreground">Sem eventos ainda</p> : (
            <ul className="space-y-2 text-sm">
              {hist.map((h) => (
                <li key={h.id} className="flex items-start gap-3 border-l-2 border-muted pl-3">
                  <div className="flex-1">
                    <div className="font-medium capitalize">{h.acao.replace(/_/g, " ")}</div>
                    {h.status_anterior && <div className="text-xs text-muted-foreground">{CAL_STATUS_LABEL[h.status_anterior]} → {h.status_novo ? CAL_STATUS_LABEL[h.status_novo] : "—"}</div>}
                    {h.detalhes && <div className="text-xs text-muted-foreground">{JSON.stringify(h.detalhes)}</div>}
                  </div>
                  <div className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString("pt-BR")}</div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value, tone }: { label: string; value: any; tone?: "danger" }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={tone === "danger" ? "text-red-400 text-sm font-medium" : "text-sm"}>{value ?? "—"}</div>
    </div>
  );
}

function AplicabilidadeCard({ requisitoId, atual, userId, status, onChange }: any) {
  const [sesmtValor, setSesmtValor] = useState<string>(atual?.sesmt_valor ?? "");
  const [sesmtJust, setSesmtJust] = useState<string>(atual?.sesmt_justificativa ?? "");
  const [gestorComentario, setGestorComentario] = useState<string>(atual?.gestor_comentario ?? "");

  async function salvarSesmt() {
    if (!sesmtValor) { toast.error("Selecione a aplicabilidade"); return; }
    const payload = {
      requisito_id: requisitoId,
      sesmt_valor: sesmtValor as any,
      sesmt_justificativa: sesmtJust || null,
      sesmt_analisado_por: userId,
      sesmt_analisado_em: new Date().toISOString(),
    };
    const { error } = await supabase.from("cal_aplicabilidade").upsert(payload, { onConflict: "requisito_id" });
    if (error) return toast.error(error.message);
    // muda status do requisito
    const novoStatus = sesmtValor === "nao" ? "nao_aplicavel" : "em_analise";
    await supabase.from("cal_requisitos").update({ status: novoStatus }).eq("id", requisitoId);
    await supabase.from("cal_historico").insert({ requisito_id: requisitoId, acao: "analisou", autor_id: userId, detalhes: { sesmt_valor: sesmtValor } });
    toast.success("Análise SESMT registrada");
    onChange();
  }

  async function aprovarGestor(status: "aprovado" | "rejeitado") {
    if (!atual) { toast.error("Faça a análise SESMT primeiro"); return; }
    const payload = {
      requisito_id: requisitoId,
      sesmt_valor: atual.sesmt_valor,
      gestor_status: status as any,
      gestor_comentario: gestorComentario || null,
      gestor_aprovado_por: userId,
      gestor_aprovado_em: new Date().toISOString(),
    };
    const { error } = await supabase.from("cal_aplicabilidade").upsert(payload, { onConflict: "requisito_id" });
    if (error) return toast.error(error.message);
    if (status === "aprovado" && atual.sesmt_valor !== "nao") {
      await supabase.from("cal_requisitos").update({ status: "aplicavel" }).eq("id", requisitoId);
    }
    await supabase.from("cal_historico").insert({ requisito_id: requisitoId, acao: status === "aprovado" ? "aprovou" : "rejeitou", autor_id: userId, detalhes: { comentario: gestorComentario } });
    toast.success(status === "aprovado" ? "Aprovado pelo gestor" : "Rejeitado pelo gestor");
    onChange();
  }

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4" />Aplicabilidade — 2 olhos</CardTitle></CardHeader>
      <CardContent className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground">1. Análise SESMT</div>
          <Select value={sesmtValor} onValueChange={setSesmtValor}>
            <SelectTrigger><SelectValue placeholder="Aplicabilidade..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sim">Sim — se aplica</SelectItem>
              <SelectItem value="parcial">Parcial</SelectItem>
              <SelectItem value="nao">Não — não se aplica</SelectItem>
            </SelectContent>
          </Select>
          <Textarea rows={3} placeholder="Justificativa técnica..." value={sesmtJust} onChange={(e) => setSesmtJust(e.target.value)} />
          <Button size="sm" onClick={salvarSesmt}>Salvar análise SESMT</Button>
          {atual?.sesmt_analisado_em && (
            <p className="text-xs text-muted-foreground">Analisado em {new Date(atual.sesmt_analisado_em).toLocaleString("pt-BR")}</p>
          )}
        </div>
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground">2. Aprovação Gestor da Área</div>
          <div>
            <Badge variant="outline" className={
              atual?.gestor_status === "aprovado" ? "bg-emerald-500/15 text-emerald-200 border-emerald-500/30" :
              atual?.gestor_status === "rejeitado" ? "bg-red-500/15 text-red-200 border-red-500/30" :
              "bg-slate-500/15 text-slate-200 border-slate-500/30"
            }>{atual?.gestor_status ?? "pendente"}</Badge>
          </div>
          <Textarea rows={3} placeholder="Comentário do gestor..." value={gestorComentario} onChange={(e) => setGestorComentario(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => aprovarGestor("aprovado")}><CheckCircle2 className="h-4 w-4 mr-1" />Aprovar</Button>
            <Button size="sm" variant="outline" onClick={() => aprovarGestor("rejeitado")}><XCircle className="h-4 w-4 mr-1" />Rejeitar</Button>
          </div>
          {atual?.gestor_aprovado_em && (
            <p className="text-xs text-muted-foreground">Decisão em {new Date(atual.gestor_aprovado_em).toLocaleString("pt-BR")}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ImpactosCard({ requisito, impactos, onChange, userId }: any) {
  const jaMarcados = useMemo(() => new Set(impactos.map((i: any) => i.modulo)), [impactos]);
  const [modulo, setModulo] = useState<CalModulo>("plano_acoes");

  async function desdobrarPA() {
    const { data, error } = await supabase.from("plano_acoes").insert({
      titulo: `[CAL ${requisito.numero_cal}] ${requisito.norma}`,
      descricao: requisito.ementa,
      quando: requisito.prazo_atendimento,
      prioridade: requisito.criticidade === "critica" ? "alta" : requisito.criticidade === "alta" ? "alta" : "media",
      status: "aberta",
      tipo_registro: "acao",
      origem_acao: "cal",
      created_by: userId,
    }).select().single();
    if (error) return toast.error(error.message);
    await supabase.from("cal_impactos_modulos").insert({
      requisito_id: requisito.id,
      modulo: "plano_acoes",
      ref_id: data.id,
      ref_descricao: `PA: ${data.titulo}`,
      criado_por: userId,
    });
    await supabase.from("cal_requisitos").update({ status: "em_tratativa" }).eq("id", requisito.id);
    await supabase.from("cal_historico").insert({ requisito_id: requisito.id, acao: "desdobrou", autor_id: userId, detalhes: { modulo: "plano_acoes", pa_id: data.id } });
    toast.success("Plano de Ação criado");
    onChange();
  }

  async function desdobrarControleDoc() {
    const { data, error } = await supabase.from("controle_documentos").insert({
      numero: `CAL-${requisito.numero_cal}`,
      titulo: `${requisito.norma} — ${requisito.ementa.slice(0, 80)}`,
      descricao: requisito.ementa,
      origem: "Requisito Legal (CAL)",
      data_recebimento: requisito.data_recebimento,
      prazo: requisito.prazo_atendimento,
      criticidade: requisito.criticidade === "critica" ? "alta" : requisito.criticidade,
      status: "aberto",
      tags: ["cal", requisito.norma],
      created_by: userId,
    }).select().single();
    if (error) return toast.error(error.message);
    await supabase.from("cal_impactos_modulos").insert({
      requisito_id: requisito.id,
      modulo: "controle_documentos",
      ref_id: data.id,
      ref_descricao: `Documento: ${data.numero}`,
      criado_por: userId,
    });
    await supabase.from("cal_historico").insert({ requisito_id: requisito.id, acao: "desdobrou", autor_id: userId, detalhes: { modulo: "controle_documentos", doc_id: data.id } });
    toast.success("Documento criado no Controle de Documentos");
    onChange();
  }

  async function marcarImpactoSimples() {
    if (jaMarcados.has(modulo)) { toast.info("Já marcado"); return; }
    const { error } = await supabase.from("cal_impactos_modulos").insert({
      requisito_id: requisito.id,
      modulo,
      ref_descricao: `Impacto registrado em ${CAL_MODULO_LABEL[modulo]} (Fase 2/3)`,
      criado_por: userId,
    });
    if (error) return toast.error(error.message);
    toast.success("Impacto registrado");
    onChange();
  }

  async function removerImpacto(impId: string) {
    const { error } = await supabase.from("cal_impactos_modulos").delete().eq("id", impId);
    if (error) return toast.error(error.message);
    onChange();
  }

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Link2 className="h-4 w-4" />Impacto & Desdobramento</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={desdobrarPA}>Criar Plano de Ação</Button>
          <Button size="sm" variant="outline" onClick={desdobrarControleDoc}>Criar em Controle de Documentos</Button>
        </div>
        <div className="flex gap-2 items-end">
          <div className="flex-1 max-w-xs">
            <Label className="text-xs">Registrar outro impacto</Label>
            <Select value={modulo} onValueChange={(v) => setModulo(v as CalModulo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CAL_MODULOS.filter((m) => !["plano_acoes","controle_documentos"].includes(m.value)).map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" variant="outline" onClick={marcarImpactoSimples}>Marcar impacto</Button>
        </div>
        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-2">Impactos registrados</div>
          {impactos.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum</p> : (
            <ul className="space-y-1">
              {impactos.map((i: any) => (
                <li key={i.id} className="flex items-center justify-between text-sm border rounded p-2">
                  <div>
                    <Badge variant="outline" className="mr-2">{CAL_MODULO_LABEL[i.modulo as CalModulo]}</Badge>
                    <span className="text-muted-foreground">{i.ref_descricao ?? ""}</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removerImpacto(i.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function EvidenciasCard({ requisitoId, evid, userId, onChange }: any) {
  const [uploading, setUploading] = useState(false);
  const [descricao, setDescricao] = useState("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const clean = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "_");
      const path = `${requisitoId}/${Date.now()}_${clean}`;
      const { error: eUp } = await supabase.storage.from("cal-evidencias").upload(path, file);
      if (eUp) throw eUp;
      const { error: eIns } = await supabase.from("cal_evidencias").insert({
        requisito_id: requisitoId,
        tipo: "upload",
        descricao: descricao || null,
        arquivo_url: path,
        arquivo_nome: file.name,
        mime: file.type,
        tamanho_bytes: file.size,
        created_by: userId,
      });
      if (eIns) throw eIns;
      await supabase.from("cal_historico").insert({ requisito_id: requisitoId, acao: "anexou", autor_id: userId, detalhes: { arquivo: file.name } });
      toast.success("Evidência anexada");
      setDescricao("");
      onChange();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function abrir(path: string) {
    const { data, error } = await supabase.storage.from("cal-evidencias").createSignedUrl(path, 3600);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  }

  async function remover(id: string, path: string) {
    await supabase.storage.from("cal-evidencias").remove([path]);
    await supabase.from("cal_evidencias").delete().eq("id", id);
    onChange();
  }

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Paperclip className="h-4 w-4" />Evidências</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <Label className="text-xs">Descrição (opcional)</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Portaria assinada, laudo LTCAT..." />
          </div>
          <div>
            <Label className="text-xs">Arquivo</Label>
            <Input type="file" onChange={handleFile} disabled={uploading} />
          </div>
        </div>
        {evid.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma evidência anexada</p> : (
          <ul className="space-y-1">
            {evid.map((e: any) => (
              <li key={e.id} className="flex items-center justify-between text-sm border rounded p-2">
                <button className="text-left flex-1 hover:underline" onClick={() => abrir(e.arquivo_url)}>
                  <div className="font-medium">{e.arquivo_nome}</div>
                  {e.descricao && <div className="text-xs text-muted-foreground">{e.descricao}</div>}
                </button>
                <Button variant="ghost" size="sm" onClick={() => remover(e.id, e.arquivo_url)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
