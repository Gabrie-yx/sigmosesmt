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
  CheckCircle2, XCircle, Clock, History, FileCheck2,
} from "lucide-react";
import { toast } from "sonner";

const TIPOS_DOCUMENTO: { value: string; label: string }[] = [
  { value: "PGR", label: "PGR – Programa de Gerenciamento de Riscos" },
  { value: "PCMSO", label: "PCMSO – Programa de Controle Médico" },
  { value: "ART_PGR", label: "ART do PGR" },
  { value: "ART_PCMSO", label: "ART do PCMSO" },
  { value: "CND_FEDERAL", label: "CND Federal" },
  { value: "CND_TRABALHISTA", label: "CND Trabalhista (CNDT)" },
  { value: "CND_FGTS", label: "CRF / FGTS" },
  { value: "ALVARA", label: "Alvará de funcionamento" },
  { value: "SEGURO_VIDA", label: "Apólice de Seguro de Vida" },
  { value: "CONTRATO_SOCIAL", label: "Contrato Social" },
  { value: "CARTAO_CNPJ", label: "Cartão CNPJ" },
  { value: "OUTROS", label: "Outros" },
];

function statusDoc(d: any): "VIGENTE" | "VENCIDO" | "SEM_VALIDADE" {
  if (!d.data_validade) return "SEM_VALIDADE";
  return new Date(d.data_validade) >= new Date(new Date().toDateString())
    ? "VIGENTE"
    : "VENCIDO";
}

function statusBadge(s: string) {
  if (s === "VIGENTE")
    return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300"><CheckCircle2 className="h-3 w-3 mr-1" /> Vigente</Badge>;
  if (s === "VENCIDO")
    return <Badge className="bg-rose-100 text-rose-700 border-rose-300"><XCircle className="h-3 w-3 mr-1" /> Vencido</Badge>;
  return <Badge variant="outline" className="text-slate-500"><Clock className="h-3 w-3 mr-1" /> Sem validade</Badge>;
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
            <TabsTrigger value="docs"><FileText className="h-4 w-4 mr-1" /> Documentos ({docs.length})</TabsTrigger>
            <TabsTrigger value="acordos">
              <AlertTriangle className="h-4 w-4 mr-1" /> Acordos de Adequação ({acordos.filter((a: any) => a.status === "ATIVO").length})
            </TabsTrigger>
          </TabsList>

          {/* ===== DOCUMENTOS ===== */}
          <TabsContent value="docs" className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setNewDoc({ tipo_documento: "PGR" })}>
                <Plus className="h-4 w-4 mr-1" /> Novo documento
              </Button>
            </div>
            {docs.length === 0 ? (
              <div className="text-sm text-slate-500 text-center py-8 border-2 border-dashed rounded-lg">
                Nenhum documento cadastrado. Comece pelo PGR, PCMSO e CNDs.
              </div>
            ) : (
              <div className="space-y-2">
                {docs.map((d: any) => {
                  const tipo = TIPOS_DOCUMENTO.find((t) => t.value === d.tipo_documento)?.label ?? d.tipo_documento;
                  const s = statusDoc(d);
                  return (
                    <div key={d.id} className="flex items-center justify-between p-3 border rounded-lg bg-white">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900">{tipo}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {d.numero && <>Nº {d.numero} · </>}
                          {d.data_validade ? `Válido até ${new Date(d.data_validade).toLocaleDateString("pt-BR")}` : "Sem data de validade"}
                          {d.responsavel_envio && <> · enviado por {d.responsavel_envio}</>}
                        </div>
                      </div>
                      {statusBadge(s)}
                    </div>
                  );
                })}
              </div>
            )}
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
        <Dialog open={!!newDoc} onOpenChange={(o) => !o && setNewDoc(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Documento</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Tipo</Label>
                <Select value={newDoc?.tipo_documento} onValueChange={(v) => setNewDoc({ ...newDoc, tipo_documento: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_DOCUMENTO.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Nº/Identificação</Label><Input value={newDoc?.numero ?? ""} onChange={(e) => setNewDoc({ ...newDoc, numero: e.target.value })} /></div>
                <div><Label>Responsável envio</Label><Input value={newDoc?.responsavel_envio ?? ""} onChange={(e) => setNewDoc({ ...newDoc, responsavel_envio: e.target.value })} /></div>
                <div><Label>Emissão</Label><Input type="date" value={newDoc?.data_emissao ?? ""} onChange={(e) => setNewDoc({ ...newDoc, data_emissao: e.target.value })} /></div>
                <div><Label>Validade</Label><Input type="date" value={newDoc?.data_validade ?? ""} onChange={(e) => setNewDoc({ ...newDoc, data_validade: e.target.value })} /></div>
              </div>
              <div><Label>Observações</Label><Textarea value={newDoc?.observacoes ?? ""} onChange={(e) => setNewDoc({ ...newDoc, observacoes: e.target.value })} /></div>
              <Button onClick={() => addDoc.mutate(newDoc)} disabled={addDoc.isPending} className="w-full">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>

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