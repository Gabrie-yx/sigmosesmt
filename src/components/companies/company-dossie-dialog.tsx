import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  FileText, ShieldCheck, AlertTriangle, Plus, Upload, Download,
  CheckCircle2, XCircle, Clock, History, FileCheck2, Eye, Printer, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { openStorageFile } from "@/components/file-viewer";

const DOSSIE_BUCKET = "sesmt-docs";

type Criticidade = "VERMELHA" | "ACORDAVEL";

/** Checklist NR-01 + Arteniza para empresas contratadas (MEI / Terceirizada). */
const CHECKLIST: { value: string; label: string; criticidade: Criticidade; valida_dias?: number }[] = [
  // 🔴 Linha vermelha — existência jurídica
  { value: "CCMEI",            label: "CCMEI / Contrato Social",          criticidade: "VERMELHA" },
  { value: "CARTAO_CNPJ",      label: "Cartão CNPJ",                      criticidade: "VERMELHA" },
  // 🟡 Acordáveis — sanitárias / fiscais / SST empresa
  { value: "PGR",              label: "PGR",                              criticidade: "ACORDAVEL", valida_dias: 730 },
  { value: "PCMSO",            label: "PCMSO",                            criticidade: "ACORDAVEL", valida_dias: 365 },
  { value: "ART_PGR",          label: "ART do PGR",                       criticidade: "ACORDAVEL" },
  { value: "ART_PCMSO",        label: "ART do PCMSO",                     criticidade: "ACORDAVEL" },
  { value: "ALVARA",           label: "Alvará / Inscrição Municipal",     criticidade: "ACORDAVEL", valida_dias: 365 },
  { value: "CND_FEDERAL",      label: "CND Federal",                      criticidade: "ACORDAVEL", valida_dias: 180 },
  { value: "CND_FGTS",         label: "CRF / FGTS",                       criticidade: "ACORDAVEL", valida_dias: 30 },
  { value: "CND_TRABALHISTA",  label: "CND Trabalhista (CNDT)",           criticidade: "ACORDAVEL", valida_dias: 180 },
  { value: "SEGURO_VIDA",      label: "Apólice de Seguro de Vida",        criticidade: "ACORDAVEL", valida_dias: 365 },
  { value: "TERMO_PGR_DMN",    label: "Termo de Adesão ao PGR DMN",       criticidade: "ACORDAVEL" },
];

const TIPOS_DOCUMENTO = CHECKLIST.map((c) => ({ value: c.value, label: c.label }));

type CardStatus = "VAZIO" | "VENCIDO" | "VENCENDO" | "VIGENTE" | "SEM_VALIDADE";

function statusOf(doc: any | undefined): CardStatus {
  if (!doc || !doc.arquivo_path) return "VAZIO";
  if (!doc.data_validade) return "SEM_VALIDADE";
  const dias = Math.ceil((new Date(doc.data_validade).getTime() - Date.now()) / 86400000);
  if (dias < 0) return "VENCIDO";
  if (dias <= 30) return "VENCENDO";
  return "VIGENTE";
}

/** Glass card colors per status — sempre alto contraste. */
function cardClass(s: CardStatus): string {
  switch (s) {
    case "VAZIO":        return "border-rose-500/70 bg-gradient-to-br from-rose-950/70 to-rose-900/40 animate-pulse-critical";
    case "VENCIDO":      return "border-rose-500/70 bg-gradient-to-br from-rose-950/80 to-rose-900/50";
    case "VENCENDO":     return "border-amber-400/70 bg-gradient-to-br from-amber-900/40 to-amber-800/30";
    case "SEM_VALIDADE": return "border-sky-400/60  bg-gradient-to-br from-sky-950/60  to-sky-900/30";
    case "VIGENTE":      return "border-emerald-400/70 bg-gradient-to-br from-emerald-950/60 to-emerald-900/40";
  }
}
function statusLabel(s: CardStatus) {
  return {
    VAZIO:        { txt: "Pendente",     icon: <XCircle className="h-3 w-3" />,        cls: "bg-rose-500/20 text-rose-100 border-rose-400/50" },
    VENCIDO:      { txt: "Vencido",      icon: <XCircle className="h-3 w-3" />,        cls: "bg-rose-500/20 text-rose-100 border-rose-400/50" },
    VENCENDO:     { txt: "A vencer",     icon: <Clock className="h-3 w-3" />,          cls: "bg-amber-500/20 text-amber-100 border-amber-400/50" },
    SEM_VALIDADE: { txt: "Sem validade", icon: <Clock className="h-3 w-3" />,          cls: "bg-sky-500/20 text-sky-100 border-sky-400/50" },
    VIGENTE:      { txt: "Vigente",      icon: <CheckCircle2 className="h-3 w-3" />,   cls: "bg-emerald-500/20 text-emerald-100 border-emerald-400/50" },
  }[s];
}

export function CompanyDossieDialog({
  open,
  onOpenChange,
  companyId,
  companyName,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  companyId: string | null;
  companyName: string;
}) {
  const qc = useQueryClient();
  const { user, isAdmin } = useAuth();
  const [tab, setTab] = useState("docs");
  const [newDoc, setNewDoc] = useState<any>(null);
  const [editDoc, setEditDoc] = useState<any>(null);
  const [newAcordo, setNewAcordo] = useState<any>(null);
  const [historicoOf, setHistoricoOf] = useState<string | null>(null);

  const { data: docs = [] } = useQuery({
    queryKey: ["contratada-docs", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("contratada_documentos")
        .select("*")
        .eq("company_id", companyId)
        .order("tipo_documento");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!companyId && open,
  });

  const { data: acordos = [] } = useQuery({
    queryKey: ["contratada-acordos", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("contratada_acordos_adequacao")
        .select("*")
        .eq("company_id", companyId)
        .order("data_aprovacao", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!companyId && open,
  });

  const { data: historico = [] } = useQuery({
    queryKey: ["contratada-acordos-hist", historicoOf],
    queryFn: async () => {
      if (!historicoOf) return [];
      const { data } = await supabase
        .from("contratada_acordos_historico")
        .select("*")
        .eq("acordo_id", historicoOf)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!historicoOf,
  });

  const addDoc = useMutation({
    mutationFn: async (payload: any) => {
      const { error } = await supabase.from("contratada_documentos").insert({
        company_id: companyId!,
        tipo_documento: payload.tipo_documento,
        numero: payload.numero || null,
        data_emissao: payload.data_emissao || null,
        data_validade: payload.data_validade || null,
        arquivo_path: payload.arquivo_path || null,
        arquivo_nome: payload.arquivo_nome || null,
        responsavel_envio: payload.responsavel_envio || null,
        observacoes: payload.observacoes || null,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Documento adicionado");
      qc.invalidateQueries({ queryKey: ["contratada-docs", companyId] });
      setNewDoc(null);
      setEditDoc(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateDoc = useMutation({
    mutationFn: async (payload: any) => {
      const { error } = await supabase
        .from("contratada_documentos")
        .update({
          numero: payload.numero || null,
          data_emissao: payload.data_emissao || null,
          data_validade: payload.data_validade || null,
          arquivo_path: payload.arquivo_path || null,
          arquivo_nome: payload.arquivo_nome || null,
          responsavel_envio: payload.responsavel_envio || null,
          observacoes: payload.observacoes || null,
        })
        .eq("id", payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Documento atualizado");
      qc.invalidateQueries({ queryKey: ["contratada-docs", companyId] });
      setEditDoc(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteDoc = useMutation({
    mutationFn: async (doc: any) => {
      if (doc.arquivo_path) {
        await supabase.storage.from(DOSSIE_BUCKET).remove([doc.arquivo_path]);
      }
      const { error } = await supabase.from("contratada_documentos").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Documento removido");
      qc.invalidateQueries({ queryKey: ["contratada-docs", companyId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addAcordo = useMutation({
    mutationFn: async (payload: any) => {
      const maxLimite = new Date();
      maxLimite.setDate(maxLimite.getDate() + 90);
      const limite = payload.data_limite ? new Date(payload.data_limite) : null;
      if (!limite || limite > maxLimite) {
        throw new Error("Prazo máximo de 90 dias por acordo");
      }
      const { error } = await supabase.from("contratada_acordos_adequacao").insert({
        company_id: companyId!,
        tipo_documento: payload.tipo_documento,
        justificativa: payload.justificativa,
        plano_acao: payload.plano_acao,
        data_limite: payload.data_limite,
        aprovador_id: user!.id,
        aprovador_nome: payload.aprovador_nome || user?.email || "—",
        aprovador_cargo: payload.aprovador_cargo || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Acordo de adequação registrado");
      qc.invalidateQueries({ queryKey: ["contratada-acordos", companyId] });
      setNewAcordo(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const prorrogar = useMutation({
    mutationFn: async ({ acordo, novaData, just }: { acordo: any; novaData: string; just: string }) => {
      const limite = new Date(novaData);
      const maxLimite = new Date(acordo.data_limite);
      maxLimite.setDate(maxLimite.getDate() + 90);
      if (limite > maxLimite) throw new Error("Prorrogação máxima de 90 dias adicionais");
      const { error: e1 } = await supabase
        .from("contratada_acordos_adequacao")
        .update({
          data_limite: novaData,
          num_prorrogacoes: (acordo.num_prorrogacoes || 0) + 1,
        })
        .eq("id", acordo.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("contratada_acordos_historico").insert({
        acordo_id: acordo.id,
        acao: "PRORROGADO",
        data_limite_anterior: acordo.data_limite,
        data_limite_nova: novaData,
        justificativa: just,
        responsavel_id: user!.id,
        responsavel_nome: user?.email || "—",
      });
      if (e2) throw e2;
    },
    onSuccess: () => {
      toast.success("Acordo prorrogado");
      qc.invalidateQueries({ queryKey: ["contratada-acordos", companyId] });
      qc.invalidateQueries({ queryKey: ["contratada-acordos-hist"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const cumprir = useMutation({
    mutationFn: async (acordo: any) => {
      const { error } = await supabase
        .from("contratada_acordos_adequacao")
        .update({ status: "CUMPRIDO", data_cumprimento: new Date().toISOString().slice(0, 10) })
        .eq("id", acordo.id);
      if (error) throw error;
      await supabase.from("contratada_acordos_historico").insert({
        acordo_id: acordo.id,
        acao: "CUMPRIDO",
        justificativa: "Documento regularizado",
        responsavel_id: user!.id,
        responsavel_nome: user?.email || "—",
      });
    },
    onSuccess: () => {
      toast.success("Acordo marcado como cumprido");
      qc.invalidateQueries({ queryKey: ["contratada-acordos", companyId] });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-5 w-5 text-[#991b1b]" />
            Dossiê da Contratada — {companyName}
          </DialogTitle>
          <p className="text-xs text-slate-500 mt-1">
            NR-01 1.5.5 — Responsabilidade solidária. Linha vermelha: ASO, integração e NR críticas individuais
            <strong> nunca</strong> entram em acordo de adequação de empresa.
          </p>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-2">
          <TabsList>
            <TabsTrigger value="docs"><FileText className="h-4 w-4 mr-1" /> Documentos ({docs.filter((d: any) => d.arquivo_path).length}/{CHECKLIST.length})</TabsTrigger>
            <TabsTrigger value="acordos">
              <AlertTriangle className="h-4 w-4 mr-1" /> Acordos de Adequação ({acordos.filter((a: any) => a.status === "ATIVO").length})
            </TabsTrigger>
          </TabsList>

          {/* ===== DOCUMENTOS ===== */}
          <TabsContent value="docs" className="space-y-3">
            {(() => {
              const byTipo: Record<string, any> = {};
              for (const d of docs as any[]) byTipo[d.tipo_documento] = d;
              const counts = { ok: 0, alerta: 0, falta: 0 };
              for (const c of CHECKLIST) {
                const s = statusOf(byTipo[c.value]);
                if (s === "VIGENTE" || s === "SEM_VALIDADE") counts.ok++;
                else if (s === "VENCENDO") counts.alerta++;
                else counts.falta++;
              }
              const pct = Math.round((counts.ok / CHECKLIST.length) * 100);
              return (
                <>
                  <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur p-3 flex items-center gap-4">
                    <div className="text-2xl font-black tabular-nums">{pct}%</div>
                    <div className="flex-1">
                      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-[11px] text-slate-300 mt-1 flex gap-3">
                        <span className="text-emerald-300">✓ {counts.ok} ok</span>
                        <span className="text-amber-300">⚠ {counts.alerta} a vencer</span>
                        <span className="text-rose-300">● {counts.falta} pendente/vencido</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {CHECKLIST.map((c) => {
                      const d = byTipo[c.value];
                      const s = statusOf(d);
                      const lbl = statusLabel(s);
                      return (
                        <div key={c.value} className={`relative rounded-xl border-2 backdrop-blur-md p-3 flex flex-col gap-2 min-h-[140px] ${cardClass(s)}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-[11px] uppercase tracking-wide text-white/60 font-bold">
                                {c.criticidade === "VERMELHA" ? "🔴 Linha vermelha" : "🟡 Acordável"}
                              </div>
                              <div className="text-sm font-bold text-white leading-tight mt-0.5">{c.label}</div>
                            </div>
                            <Badge className={`shrink-0 border ${lbl.cls}`}>{lbl.icon}<span className="ml-1">{lbl.txt}</span></Badge>
                          </div>

                          {d ? (
                            <div className="text-[11px] text-white/80 leading-snug">
                              {d.numero && <>Nº {d.numero} · </>}
                              {d.data_validade
                                ? <>Válido até <strong>{new Date(d.data_validade).toLocaleDateString("pt-BR")}</strong></>
                                : "Sem data de validade"}
                              {d.responsavel_envio && <> · {d.responsavel_envio}</>}
                            </div>
                          ) : (
                            <div className="text-[11px] text-white/70 italic">Documento ainda não enviado.</div>
                          )}

                          <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                            {d?.arquivo_path ? (
                              <>
                                <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={() => openStorageFile(DOSSIE_BUCKET, d.arquivo_path, d.arquivo_nome ?? c.label)}>
                                  <Eye className="h-3 w-3 mr-1" /> Ver
                                </Button>
                                <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={() => setEditDoc({ ...d, tipo_label: c.label })}>
                                  <Upload className="h-3 w-3 mr-1" /> Substituir
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-rose-200 hover:text-rose-100" onClick={() => { if (confirm(`Remover ${c.label}?`)) deleteDoc.mutate(d); }}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </>
                            ) : (
                              <Button size="sm" className="h-7 px-2 text-xs bg-white text-slate-900 hover:bg-white/90" onClick={() => setNewDoc({ tipo_documento: c.value, tipo_label: c.label, valida_dias: c.valida_dias })}>
                                <Upload className="h-3 w-3 mr-1" /> Enviar
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </TabsContent>

          {/* ===== ACORDOS ===== */}
          <TabsContent value="acordos" className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setNewAcordo({ tipo_documento: "PGR" })}>
                <Plus className="h-4 w-4 mr-1" /> Novo acordo
              </Button>
            </div>
            {acordos.length === 0 ? (
              <div className="text-sm text-slate-500 text-center py-8 border-2 border-dashed rounded-lg">
                Nenhum acordo de adequação. Use somente quando um documento estiver pendente e a empresa precisar continuar operando.
              </div>
            ) : (
              <div className="space-y-2">
                {acordos.map((a: any) => {
                  const venceEm = Math.ceil(
                    (new Date(a.data_limite).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                  );
                  const cor =
                    a.status === "CUMPRIDO"
                      ? "bg-emerald-50 border-emerald-300"
                      : a.status === "CANCELADO"
                      ? "bg-slate-50 border-slate-300"
                      : venceEm < 0
                      ? "bg-rose-50 border-rose-400"
                      : venceEm < 15
                      ? "bg-amber-50 border-amber-300"
                      : "bg-blue-50 border-blue-300";
                  return (
                    <div key={a.id} className={`p-3 border-2 rounded-lg ${cor}`}>
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-sm">
                          {TIPOS_DOCUMENTO.find((t) => t.value === a.tipo_documento)?.label ?? a.tipo_documento}
                        </div>
                        <Badge variant={a.status === "ATIVO" ? "default" : "secondary"}>{a.status}</Badge>
                      </div>
                      <div className="text-xs mt-1 text-slate-700">
                        Vence em <strong>{new Date(a.data_limite).toLocaleDateString("pt-BR")}</strong>{" "}
                        {a.status === "ATIVO" && (
                          <span className={venceEm < 0 ? "text-rose-700 font-bold" : ""}>
                            ({venceEm < 0 ? `${Math.abs(venceEm)} dias vencido` : `${venceEm} dias restantes`})
                          </span>
                        )}
                        {a.num_prorrogacoes > 0 && <> · {a.num_prorrogacoes} prorrogação(ões)</>}
                      </div>
                      <div className="text-xs mt-2 italic text-slate-600">"{a.justificativa}"</div>
                      <div className="text-xs mt-1 text-slate-500">
                        Aprovador: <strong>{a.aprovador_nome}</strong>
                        {a.aprovador_cargo && <> ({a.aprovador_cargo})</>}
                      </div>
                      {a.status === "ATIVO" && (
                        <div className="flex gap-2 mt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const data = prompt("Nova data limite (AAAA-MM-DD):");
                              const just = prompt("Justificativa da prorrogação:");
                              if (data && just) prorrogar.mutate({ acordo: a, novaData: data, just });
                            }}
                          >
                            <Clock className="h-3 w-3 mr-1" /> Prorrogar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => cumprir.mutate(a)}>
                            <FileCheck2 className="h-3 w-3 mr-1" /> Marcar como cumprido
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setHistoricoOf(a.id === historicoOf ? null : a.id)}>
                            <History className="h-3 w-3 mr-1" /> Histórico
                          </Button>
                        </div>
                      )}
                      {historicoOf === a.id && (
                        <div className="mt-2 pt-2 border-t border-slate-300/50 space-y-1">
                          {historico.map((h: any) => (
                            <div key={h.id} className="text-[11px] text-slate-600">
                              <strong>{h.acao}</strong> · {new Date(h.created_at).toLocaleString("pt-BR")} · {h.responsavel_nome}
                              <div className="italic">"{h.justificativa}"</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* ===== Form Novo Doc ===== */}
        <DocFormDialog
          open={!!newDoc || !!editDoc}
          mode={editDoc ? "edit" : "new"}
          companyId={companyId}
          initial={editDoc ?? newDoc}
          onClose={() => { setNewDoc(null); setEditDoc(null); }}
          onSave={(payload) => editDoc ? updateDoc.mutate(payload) : addDoc.mutate(payload)}
          saving={addDoc.isPending || updateDoc.isPending}
        />

        {/* ===== Form Novo Acordo ===== */}
        <Dialog open={!!newAcordo} onOpenChange={(o) => !o && setNewAcordo(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Acordo de Adequação</DialogTitle></DialogHeader>
            <div className="bg-amber-50 border border-amber-300 rounded p-2 text-xs text-amber-900 mb-2">
              <strong>Linha vermelha:</strong> acordos de empresa <strong>não</strong> liberam pendências individuais
              (ASO, integração, NR-10/33/35 individual). Esses bloqueios continuam ativos.
            </div>
            <div className="space-y-3">
              <div>
                <Label>Documento pendente</Label>
                <Select value={newAcordo?.tipo_documento} onValueChange={(v) => setNewAcordo({ ...newAcordo, tipo_documento: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_DOCUMENTO.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Justificativa</Label><Textarea required value={newAcordo?.justificativa ?? ""} onChange={(e) => setNewAcordo({ ...newAcordo, justificativa: e.target.value })} placeholder="Por que a empresa segue operando sem este documento?" /></div>
              <div><Label>Plano de ação</Label><Textarea required value={newAcordo?.plano_acao ?? ""} onChange={(e) => setNewAcordo({ ...newAcordo, plano_acao: e.target.value })} placeholder="O que será feito para regularizar e quando?" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Data limite (máx 90 dias)</Label><Input type="date" value={newAcordo?.data_limite ?? ""} onChange={(e) => setNewAcordo({ ...newAcordo, data_limite: e.target.value })} /></div>
                <div><Label>Cargo do aprovador</Label><Input value={newAcordo?.aprovador_cargo ?? ""} onChange={(e) => setNewAcordo({ ...newAcordo, aprovador_cargo: e.target.value })} placeholder="TST / Supervisor / Admin" /></div>
              </div>
              <div className="text-[11px] text-slate-500">Aprovador: {user?.email}</div>
              <Button onClick={() => addAcordo.mutate(newAcordo)} disabled={addAcordo.isPending} className="w-full">Registrar acordo</Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

/* ============ Sub-dialog: upload + metadados ============ */
function DocFormDialog({
  open, mode, companyId, initial, onClose, onSave, saving,
}: {
  open: boolean;
  mode: "new" | "edit";
  companyId: string | null;
  initial: any;
  onClose: () => void;
  onSave: (p: any) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<any>(initial ?? {});
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // resync when re-opened with a different doc
  if (open && form?.id !== initial?.id && form?.tipo_documento !== initial?.tipo_documento) {
    // simple reset on identity change
    setForm(initial ?? {});
    setFile(null);
  }

  const label = initial?.tipo_label ?? CHECKLIST.find((c) => c.value === initial?.tipo_documento)?.label ?? "Documento";

  async function handleSubmit() {
    if (!companyId) return;
    try {
      let arquivo_path = form.arquivo_path ?? null;
      let arquivo_nome = form.arquivo_nome ?? null;
      if (file) {
        setUploading(true);
        const ext = file.name.split(".").pop() ?? "bin";
        const path = `contratada-dossie/${companyId}/${initial?.tipo_documento}-${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from(DOSSIE_BUCKET).upload(path, file, { upsert: true, contentType: file.type });
        if (error) throw error;
        arquivo_path = path;
        arquivo_nome = file.name;
      }
      // sugestão de validade
      let data_validade = form.data_validade || null;
      if (!data_validade && form.data_emissao && initial?.valida_dias) {
        const d = new Date(form.data_emissao);
        d.setDate(d.getDate() + initial.valida_dias);
        data_validade = d.toISOString().slice(0, 10);
      }
      onSave({
        ...form,
        id: initial?.id,
        tipo_documento: initial?.tipo_documento,
        arquivo_path,
        arquivo_nome,
        data_validade,
      });
    } catch (e: any) {
      toast.error(e.message ?? "Falha no upload");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Atualizar" : "Enviar"} — {label}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Arquivo (PDF/Imagem)</Label>
            <Input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {!file && form.arquivo_nome && <div className="text-xs text-slate-500 mt-1">Atual: {form.arquivo_nome}</div>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Nº / Identificação</Label><Input value={form.numero ?? ""} onChange={(e) => setForm({ ...form, numero: e.target.value })} /></div>
            <div><Label>Responsável envio</Label><Input value={form.responsavel_envio ?? ""} onChange={(e) => setForm({ ...form, responsavel_envio: e.target.value })} /></div>
            <div><Label>Emissão</Label><Input type="date" value={form.data_emissao ?? ""} onChange={(e) => setForm({ ...form, data_emissao: e.target.value })} /></div>
            <div><Label>Validade</Label><Input type="date" value={form.data_validade ?? ""} onChange={(e) => setForm({ ...form, data_validade: e.target.value })} /></div>
          </div>
          <div><Label>Observações</Label><Textarea value={form.observacoes ?? ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>
          <Button onClick={handleSubmit} disabled={saving || uploading} className="w-full">
            {uploading ? "Enviando arquivo..." : saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}