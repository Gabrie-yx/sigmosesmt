import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  LogOut, Search, Check, UserPlus, AlertTriangle, Users, Loader2, Clock, ShieldAlert,
  Plus, CalendarDays, ClipboardList, ChevronLeft, CheckCircle2, XCircle, HourglassIcon, Trash2, FileText,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PDFPreviewDialog } from "@/components/pdf-preview-dialog";
import { buildHoraExtraSabadoPdf } from "@/lib/hora-extra-sabado-build";
import type jsPDF from "jspdf";

export const Route = createFileRoute("/extra-sabado")({
  component: ExtraSabadoMobilePage,
});

type LiderInfo = { id: string; employee_id: string; user_id: string; nome: string; observacao: string | null };
type Convocacao = {
  id: string; data: string; tipo_convocacao: "SABADO" | "DIAS_UTEIS";
  horario_inicio: string; horario_fim: string;
  justificativa: string; status: "PENDENTE"|"APROVADA"|"INDEFERIDA";
  motivo_indeferimento: string | null; qtd_marcados: number; criado_em: string;
};

function ExtraSabadoMobilePage() {
  const { session, loading, user, isExtraSabadoMarcador, isAdmin, isModerator } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [convocacaoAtivaId, setConvocacaoAtivaId] = useState<string | null>(null);
  const [novaOpen, setNovaOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const [externoOpen, setExternoOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<jsPDF | null>(null);
  const [previewFileName, setPreviewFileName] = useState("hora-extra.pdf");
  const [gerandoPdf, setGerandoPdf] = useState(false);

  async function gerarPdfDaConvocacao() {
    if (!convId) return;
    setGerandoPdf(true);
    try {
      const solicitanteNome =
        (user as any)?.user_metadata?.full_name ??
        (user as any)?.email?.split("@")[0] ??
        null;
      const result = await buildHoraExtraSabadoPdf({ fichaId: convId, solicitanteNome });
      if (!result) {
        toast.error("Ficha não encontrada");
        return;
      }
      setPreviewFileName(result.fileName);
      setPreviewDoc(result.doc);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar o PDF");
    } finally {
      setGerandoPdf(false);
    }
  }

  useEffect(() => {
    if (!loading && !session) {
      try { sessionStorage.setItem("post_login_redirect", "/extra-sabado"); } catch {}
      navigate({ to: "/login", search: { redirect: "/extra-sabado" } as any });
    }
  }, [loading, session, navigate]);

  // Detecta se é líder (via RPC)
  const { data: lider, isLoading: loadingLider } = useQuery({
    queryKey: ["meu-lider-extra", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("meu_lider_extra");
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row ?? null) as LiderInfo | null;
    },
  });

  const isLider = !!lider;
  const isMarcador = isLider || isExtraSabadoMarcador || isAdmin || isModerator;

  // Convocações criadas por este líder
  const { data: minhasConvocacoes, isLoading: loadingConvs } = useQuery({
    queryKey: ["convocacoes-do-lider", user?.id],
    enabled: !!user?.id && isLider,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("listar_convocacoes_extra_lider");
      if (error) throw error;
      return (data ?? []) as Convocacao[];
    },
  });

  // Convocação selecionada (default = mais recente pendente/aprovada)
  useEffect(() => {
    if (!convocacaoAtivaId && minhasConvocacoes && minhasConvocacoes.length > 0) {
      const devolvida = minhasConvocacoes.find(c => c.status === "INDEFERIDA");
      const editavel = minhasConvocacoes.find(c => c.status !== "INDEFERIDA");
      setConvocacaoAtivaId((devolvida ?? editavel ?? minhasConvocacoes[0]).id);
    }
  }, [minhasConvocacoes, convocacaoAtivaId]);

  const convId = convocacaoAtivaId;

  const { data: conv } = useQuery({
    queryKey: ["extra-sabado-conv", convId],
    enabled: !!convId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hora_extra_sabado")
        .select("*, companies(name)")
        .eq("id", convId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: marcados } = useQuery({
    queryKey: ["extra-sabado-marcados", convId],
    enabled: !!convId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hora_extra_sabado_funcionarios")
        .select("id, employee_id, nome, externo, externo_empresa, funcao, marcado_por, marcado_por_nome")
        .eq("hora_extra_id", convId!)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Realtime: sincroniza marcações entre marcadores
  useEffect(() => {
    if (!convId) return;
    const ch = supabase
      .channel(`extra-sabado-${convId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "hora_extra_sabado_funcionarios", filter: `hora_extra_id=eq.${convId}` },
        () => qc.invalidateQueries({ queryKey: ["extra-sabado-marcados", convId] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "hora_extra_sabado", filter: `id=eq.${convId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["extra-sabado-conv", convId] });
          qc.invalidateQueries({ queryKey: ["convocacoes-do-lider"] });
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [convId, qc]);

  // Employees convocáveis pelo líder
  const { data: employees, isLoading: loadingEmployees } = useQuery({
    queryKey: ["convocaveis-lider", lider?.id],
    enabled: !!lider?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("listar_convocaveis_lider", { _lider_id: lider!.id });
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; nome: string; setor: string | null; funcao: string | null; tipo_vinculo: string; empresa_id: string | null; empresa_nome: string | null }>;
    },
  });

  const marcadosMap = useMemo(() => {
    const m = new Map<string, any>();
    (marcados ?? []).forEach((r: any) => {
      if (r.employee_id) m.set(r.employee_id, r);
    });
    return m;
  }, [marcados]);

  const externosMarcados = (marcados ?? []).filter((r: any) => r.externo);

  const marcar = useMutation({
    mutationFn: async (employee_id: string) => {
      const { error } = await supabase.rpc("marcar_funcionario_sabado", {
        _hora_extra_id: convId!,
        _employee_id: employee_id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["extra-sabado-marcados", convId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const desmarcar = useMutation({
    mutationFn: async (row_id: string) => {
      const { error } = await supabase.rpc("desmarcar_funcionario_sabado", { _row_id: row_id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["extra-sabado-marcados", convId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const totalConfirmados = (marcados ?? []).length;
  const meusMarcados = (marcados ?? []).filter((r: any) => r.marcado_por === user?.id).length;
  const status = conv?.status as "PENDENTE"|"APROVADA"|"INDEFERIDA" | undefined;
  // Indeferida volta para o solicitante: ele vê o motivo e pode ajustar antes de reenviar.
  const readOnly = false;
  const expirado = false;

  const reenviar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("reenviar_hora_extra_modulo", { _hora_extra_id: convId! });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Convocação reenviada para aprovação");
      qc.invalidateQueries({ queryKey: ["extra-sabado-conv", convId] });
      qc.invalidateQueries({ queryKey: ["convocacoes-do-lider"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtrados = useMemo(() => {
    const s = busca.trim().toLowerCase();
    if (!s) return employees ?? [];
    return (employees ?? []).filter((e: any) =>
      e.nome.toLowerCase().includes(s) ||
      (e.setor ?? "").toLowerCase().includes(s) ||
      (e.empresa_nome ?? "").toLowerCase().includes(s)
    );
  }, [employees, busca]);

  // Agrupa por empresa / setor
  const grupos = useMemo(() => {
    const g = new Map<string, any[]>();
    filtrados.forEach((e: any) => {
      const key = e.empresa_nome
        ?? (e.tipo_vinculo === "MEI" ? "MEIs" : (e.setor || "Sem empresa"));
      if (!g.has(key)) g.set(key, []);
      g.get(key)!.push(e);
    });
    return Array.from(g.entries()).sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [filtrados]);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  if (loading || !session) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300 text-sm">Carregando…</div>;
  }

  if (loadingLider) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300 text-sm"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  if (!isMarcador) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 px-6">
        <div className="max-w-sm text-center space-y-4">
          <ShieldAlert className="h-12 w-12 text-amber-400 mx-auto" />
          <h1 className="text-xl font-black">Sem acesso</h1>
          <p className="text-sm text-slate-400">Este painel é exclusivo dos marcadores de Extra de Sábado. Fale com o SESMT se acha que deveria ter acesso.</p>
          <Button variant="secondary" onClick={signOut}>Sair</Button>
        </div>
      </div>
    );
  }

  const dataConv = conv?.data ? new Date(conv.data + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }) : "…";
  const tipoLabel = conv?.tipo_convocacao === "DIAS_UTEIS" ? "Extra Dia Útil" : "Extra de Sábado";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20">
      {/* Header sticky */}
      <header className="sticky top-0 z-20 bg-gradient-to-b from-[#7f1212] to-[#5a0f22] px-4 py-3 shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-rose-200/80">{tipoLabel}</div>
            <div className="text-base font-black leading-tight truncate">
              {conv ? `${dataConv} · ${conv.horario_inicio}–${conv.horario_fim}` : (lider ? `Líder: ${lider.nome.split(" ").slice(0,2).join(" ")}` : "…")}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isLider && (
              <button onClick={() => setNovaOpen(true)} className="p-2 rounded-full bg-emerald-500/90 hover:bg-emerald-500 transition text-white" aria-label="Nova convocação">
                <Plus className="h-4 w-4" />
              </button>
            )}
            {convId && (isLider || isAdmin) && conv && conv.status !== "APROVADA" && (
              <button
                onClick={async () => {
                  if (!confirm("Arquivar esta convocação? Ela sai da tela normal, mas o histórico fica preservado no banco.")) return;
                  const { error } = await supabase.rpc("excluir_convocacao_extra_lider", { _hora_extra_id: convId });
                  if (error) return toast.error(error.message);
                  toast.success("Convocação arquivada com histórico preservado");
                  setConvocacaoAtivaId(null);
                  qc.invalidateQueries({ queryKey: ["convocacoes-do-lider"] });
                }}
                className="p-2 rounded-full bg-rose-500/90 hover:bg-rose-500 transition text-white"
                aria-label="Excluir convocação"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button onClick={signOut} className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition text-white" aria-label="Sair">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
        {status && (
          <div className={`mt-2 text-[10px] font-bold rounded px-2 py-1 inline-flex items-center gap-1
            ${status === "PENDENTE" ? "bg-amber-500/20 text-amber-200" :
              status === "APROVADA" ? "bg-emerald-500/20 text-emerald-200" :
              "bg-red-500/20 text-red-200"}`}>
            {status === "PENDENTE" && <><HourglassIcon className="h-3 w-3" /> Aguardando aprovação do Anderson</>}
            {status === "APROVADA" && <><CheckCircle2 className="h-3 w-3" /> Aprovada</>}
            {status === "INDEFERIDA" && <><XCircle className="h-3 w-3" /> Indeferida — {conv?.motivo_indeferimento}</>}
          </div>
        )}
      </header>

      {status === "INDEFERIDA" && (
        <div className="mx-4 mt-4 rounded-xl border border-red-400/30 bg-red-500/10 p-3 space-y-2">
          <div className="text-xs font-black uppercase tracking-widest text-red-200 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Convocação devolvida
          </div>
          <p className="text-sm text-red-50 whitespace-pre-wrap">{conv?.motivo_indeferimento ?? "Sem motivo informado."}</p>
          <Button className="w-full bg-red-700 hover:bg-red-800" onClick={() => reenviar.mutate()} disabled={reenviar.isPending}>
            {reenviar.isPending ? "Reenviando…" : "Reenviar para aprovação"}
          </Button>
        </div>
      )}

      {isLider && !convId && (
        <div className="p-6 text-center space-y-4">
          <ClipboardList className="h-12 w-12 text-slate-500 mx-auto" />
          <div className="text-slate-300">
            {loadingConvs ? "Carregando…" :
             (minhasConvocacoes ?? []).length === 0
               ? "Nenhuma convocação criada ainda."
               : "Selecione uma convocação abaixo ou crie uma nova."}
          </div>
          {(minhasConvocacoes ?? []).length > 0 && (
            <div className="space-y-2">
              {minhasConvocacoes!.map(c => (
                <button key={c.id} onClick={() => setConvocacaoAtivaId(c.id)}
                  className="w-full text-left rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-bold">{new Date(c.data + "T12:00").toLocaleDateString("pt-BR")} · {c.horario_inicio}–{c.horario_fim}</div>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded ${c.status === "APROVADA" ? "bg-emerald-500/30 text-emerald-200" : c.status === "INDEFERIDA" ? "bg-red-500/30 text-red-200" : "bg-amber-500/30 text-amber-200"}`}>{c.status}</span>
                  </div>
                  <div className="text-[11px] text-slate-400">{c.tipo_convocacao === "DIAS_UTEIS" ? "Dia útil" : "Sábado"} · {c.qtd_marcados} convocado{c.qtd_marcados===1?"":"s"}</div>
                </button>
              ))}
            </div>
          )}
          <Button onClick={() => setNovaOpen(true)} className="w-full h-11 bg-emerald-600 hover:bg-emerald-700">
            <Plus className="h-4 w-4 mr-2" /> Nova convocação
          </Button>
        </div>
      )}

      {convId && (
        <>
          {isLider && minhasConvocacoes && minhasConvocacoes.length > 1 && (
            <div className="px-4 py-2 border-b border-white/10 bg-slate-900">
              <button onClick={() => setConvocacaoAtivaId(null)} className="text-xs text-rose-300 hover:text-rose-200 font-bold flex items-center gap-1">
                <ChevronLeft className="h-3 w-3" /> Voltar às convocações
              </button>
            </div>
          )}
          {conv?.justificativa && (
            <div className="px-4 py-3 border-b border-white/10 bg-slate-900">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Justificativa</div>
              <div className="text-sm text-slate-200 whitespace-pre-wrap">{conv.justificativa}</div>
            </div>
          )}
          {/* Status */}
          <div className="px-4 py-3 border-b border-white/10 bg-slate-900">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Você marcou</div>
                <div className="text-2xl font-black text-rose-300 tabular-nums">{meusMarcados}</div>
              </div>
              <div className={`rounded-xl border p-3 ${totalConfirmados >= 20 ? "bg-amber-500/20 border-amber-400/40" : "bg-white/5 border-white/10"}`}>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total geral</div>
                <div className={`text-2xl font-black tabular-nums ${totalConfirmados >= 20 ? "text-amber-300" : "text-slate-100"}`}>{totalConfirmados}</div>
                {totalConfirmados >= 20 && <div className="text-[10px] font-bold text-amber-200 mt-0.5">🚨 rota + refeitório ON</div>}
              </div>
            </div>
            {(readOnly || expirado) && (
              <div className={`mt-3 rounded-lg px-3 py-2 text-xs font-bold flex items-center gap-2 ${expirado ? "bg-red-500/20 text-red-200 border border-red-400/40" : "bg-slate-500/20 text-slate-200 border border-slate-400/30"}`}>
                <Clock className="h-4 w-4" />
                {expirado ? "Convocação encerrada" : "Somente leitura — convocação indeferida"}
              </div>
            )}
          </div>

          {/* Externos já marcados */}
          {externosMarcados.length > 0 && (
            <div className="px-4 py-3 border-b border-white/10">
              <div className="text-[10px] font-black uppercase tracking-widest text-amber-300 mb-2">Externos ({externosMarcados.length})</div>
              <div className="space-y-1.5">
                {externosMarcados.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg bg-amber-500/10 border border-amber-400/20 px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-sm font-bold truncate">{r.nome}</div>
                      <div className="text-[10px] text-slate-400 truncate">{r.externo_empresa}{r.funcao ? ` · ${r.funcao}` : ""} · marcado por {r.marcado_por_nome ?? "—"}</div>
                    </div>
                    {!readOnly && !expirado && (isAdmin || r.marcado_por === user?.id) && (
                      <button onClick={() => desmarcar.mutate(r.id)} className="text-xs text-red-300 hover:text-red-200 font-bold shrink-0 px-2">Remover</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Busca + adicionar externo */}
          <div className="sticky top-[68px] z-10 bg-slate-950/95 backdrop-blur px-4 py-3 border-b border-white/10 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome, setor…" className="pl-9 h-11 bg-white/5 border-white/10 text-slate-100 placeholder:text-slate-500" />
            </div>
            {!readOnly && !expirado && (
              <Button size="sm" variant="secondary" onClick={() => setExternoOpen(true)} className="h-11 px-3 shrink-0">
                <UserPlus className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Lista agrupada */}
          <div className="px-4 py-4 space-y-5">
            {loadingEmployees ? (
              <div className="text-center text-slate-500 text-sm py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
            ) : grupos.length === 0 ? (
              <div className="text-center text-slate-500 text-sm py-8">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                {lider ? "Nenhum funcionário no seu escopo. Fale com o SESMT." : "Perfil sem escopo configurado. Fale com o SESMT."}
              </div>
            ) : grupos.map(([grupoNome, funcs]) => (
              <div key={grupoNome}>
                <div className="text-[10px] font-black uppercase tracking-widest text-rose-300 mb-2 px-1">{grupoNome} · {funcs.length}</div>
                <div className="space-y-1.5">
                  {funcs.map((e: any) => {
                    const marcado = marcadosMap.get(e.id);
                    const podeToggle = !readOnly && !expirado
                      && (isAdmin || !marcado || marcado.marcado_por === user?.id);
                    return (
                      <button
                        key={e.id}
                        onClick={() => {
                          if (!podeToggle) {
                            if (marcado) toast.info(`Marcado por ${marcado.marcado_por_nome ?? "outro"} — só ele pode desmarcar`);
                            return;
                          }
                          if (marcado) desmarcar.mutate(marcado.id);
                          else marcar.mutate(e.id);
                        }}
                        disabled={marcar.isPending || desmarcar.isPending}
                        className={`w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left transition ${marcado ? "bg-emerald-500/15 border border-emerald-400/40" : "bg-white/5 border border-white/10 hover:bg-white/10"} ${!podeToggle && !marcado ? "opacity-50" : ""}`}
                      >
                        <div className={`h-6 w-6 rounded-md shrink-0 flex items-center justify-center border-2 ${marcado ? "bg-emerald-500 border-emerald-500" : "border-slate-500"}`}>
                          {marcado && <Check className="h-4 w-4 text-white" strokeWidth={3} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold truncate">{e.nome}</div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {[e.setor, e.funcao].filter(Boolean).join(" · ") || "—"}
                            {marcado?.marcado_por === user?.id ? " · você marcou" : marcado ? ` · por ${marcado.marcado_por_nome ?? "—"}` : ""}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <NovaConvocacaoDialog
        open={novaOpen}
        onOpenChange={setNovaOpen}
        liderId={lider?.id ?? null}
        onCreated={(id) => {
          setConvocacaoAtivaId(id);
          qc.invalidateQueries({ queryKey: ["convocacoes-do-lider"] });
        }}
      />

      {/* Adicionar externo */}
      <AdicionarExternoDialog
        open={externoOpen}
        onOpenChange={setExternoOpen}
        convId={convId ?? null}
        onSaved={() => qc.invalidateQueries({ queryKey: ["extra-sabado-marcados", convId] })}
      />
    </div>
  );
}

function NovaConvocacaoDialog({ open, onOpenChange, onCreated, liderId }: {
  open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: string) => void; liderId: string | null;
}) {
  const [tipo, setTipo] = useState<"SABADO"|"DIAS_UTEIS">("SABADO");
  const [data, setData] = useState("");
  const [turno, setTurno] = useState("1º");
  const [hi, setHi] = useState("07:30");
  const [hf, setHf] = useState("15:00");
  const [just, setJust] = useState("");
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const { data: employees } = useQuery({
    queryKey: ["convocaveis-lider-dialog", liderId],
    enabled: !!liderId && open,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("listar_convocaveis_lider", { _lider_id: liderId! });
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; nome: string; setor: string | null; funcao: string | null; empresa_nome?: string | null; tipo_vinculo?: string | null }>;
    },
  });

  // Cabeçalho fixo com Setor · Empresa (deriva do escopo do líder = 1ª pessoa da lista)
  const escopoLabel = useMemo(() => {
    const list = employees ?? [];
    if (list.length === 0) return null;
    const setores = Array.from(new Set(list.map((e: any) => e.setor).filter(Boolean)));
    const empresas = Array.from(new Set(list.map((e: any) => e.empresa_nome).filter(Boolean)));
    return {
      setor: setores.join(" · ") || "—",
      empresa: empresas.join(" · ") || "—",
    };
  }, [employees]);

  useEffect(() => {
    if (!open) return;
    setJust(""); setBusca(""); setSel(new Set()); setTipo("SABADO"); setTurno("1º");
    setHi("07:30"); setHf("15:00");
    const hoje = new Date();
    const dow = hoje.getDay();
    const dias = (6 - dow + 7) % 7 || 7;
    const sab = new Date(hoje); sab.setDate(hoje.getDate() + dias);
    setData(sab.toISOString().slice(0, 10));
  }, [open]);

  // Ao trocar tipo, ajusta defaults de horário
  useEffect(() => {
    if (tipo === "SABADO") { setHi("07:30"); setHf("15:00"); }
    else { setHi("17:30"); setHf("19:30"); }
  }, [tipo]);

  const filtrados = useMemo(() => {
    const s = busca.trim().toLowerCase();
    const list = employees ?? [];
    if (!s) return list;
    return list.filter(
      (e) =>
        e.nome.toLowerCase().includes(s) ||
        (e.setor ?? "").toLowerCase().includes(s) ||
        (e.empresa_nome ?? "").toLowerCase().includes(s),
    );
  }, [employees, busca]);

  function toggle(id: string) {
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }
  function toggleTodos() {
    if (sel.size === filtrados.length) setSel(new Set());
    else setSel(new Set(filtrados.map((e) => e.id)));
  }

  async function salvar() {
    if (just.trim().length < 5) return toast.error("Motivo da extra muito curto (mín. 5 caracteres)");
    if (!data || !hi || !hf) return toast.error("Preencha data, hora início e hora fim");
    if (sel.size === 0) return toast.error("Selecione pelo menos 1 funcionário");
    setSaving(true);
    const { data: id, error } = await supabase.rpc("criar_convocacao_extra_lider", {
      _tipo: tipo, _data: data, _horario_inicio: hi, _horario_fim: hf,
      _justificativa: just, _employee_ids: Array.from(sel), _turno: turno,
      _modulo_origem: escopoLabel?.setor ?? undefined,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Convocação criada — aguardando Anderson aprovar");
    onCreated(id as string);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova convocação de extra</DialogTitle>
          <DialogDescription>Escolha o tipo, turno, horário, quem vai e o motivo. Anderson vai aprovar ou indeferir.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {escopoLabel && (
            <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-[11px] flex flex-wrap gap-x-4 gap-y-1">
              <span><span className="font-black text-rose-300 uppercase tracking-widest text-[10px] mr-1">Setor:</span>{escopoLabel.setor}</span>
              <span><span className="font-black text-rose-300 uppercase tracking-widest text-[10px] mr-1">Empresa:</span>{escopoLabel.empresa}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SABADO">Extra Sábado</SelectItem>
                  <SelectItem value="DIAS_UTEIS">Extra Dia Útil</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Hora início</Label>
              <Input type="time" value={hi} onChange={(e) => setHi(e.target.value)} />
            </div>
            <div>
              <Label>Hora fim</Label>
              <Input type="time" value={hf} onChange={(e) => setHf(e.target.value)} />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Funcionários ({sel.size} selecionado{sel.size===1?"":"s"})</Label>
              <button type="button" onClick={toggleTodos} className="text-[11px] font-bold text-rose-300 hover:text-rose-200">
                {sel.size === filtrados.length && filtrados.length > 0 ? "Desmarcar todos" : `Marcar todos (${filtrados.length})`}
              </button>
            </div>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-60" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome, setor…" className="pl-9 h-9" />
            </div>
            <div className="max-h-64 overflow-y-auto rounded-md border border-white/10 divide-y divide-white/10">
              {(!employees || employees.length === 0) && (
                <p className="px-3 py-3 text-xs opacity-60 italic">Nenhum funcionário no seu escopo.</p>
              )}
              {filtrados.map((e) => {
                const checked = sel.has(e.id);
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => toggle(e.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left transition ${checked ? "bg-emerald-500/15" : "hover:bg-white/[0.05]"}`}
                  >
                    <div className={`h-5 w-5 rounded shrink-0 flex items-center justify-center border-2 ${checked ? "bg-emerald-500 border-emerald-500" : "border-slate-500"}`}>
                      {checked && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold truncate">{e.nome}</div>
                      <div className="text-[10px] text-slate-400 truncate">{[e.setor, e.funcao].filter(Boolean).join(" · ") || "—"}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label>DIGITE AQUI O MOTIVO DA EXTRA</Label>
            <Textarea value={just} onChange={(e) => setJust(e.target.value)} rows={3}
              placeholder="Ex: reparo das bóias e pintura dos cascos 131 e 133" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>{saving ? "Enviando…" : "Criar e enviar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdicionarExternoDialog({ open, onOpenChange, convId, onSaved }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  convId: string | null;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [funcao, setFuncao] = useState("");
  const [saving, setSaving] = useState(false);

  async function salvar() {
    if (!convId) return;
    if (nome.trim().length < 3) return toast.error("Informe o nome completo");
    if (empresa.trim().length < 2) return toast.error("Informe a empresa");
    setSaving(true);
    const { error } = await supabase.rpc("adicionar_externo_sabado", {
      _hora_extra_id: convId,
      _nome: nome.trim(),
      _empresa: empresa.trim(),
      _funcao: funcao.trim() || undefined,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Externo adicionado");
    setNome(""); setEmpresa(""); setFuncao("");
    onSaved();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Adicionar externo</DialogTitle>
          <DialogDescription>Colaborador que não está na base de funcionários.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome completo</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="José da Silva" autoFocus />
          </div>
          <div>
            <Label>Empresa</Label>
            <Input value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="LF Serviços" />
          </div>
          <div>
            <Label>Função (opcional)</Label>
            <Input value={funcao} onChange={(e) => setFuncao(e.target.value)} placeholder="Mecânico" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>{saving ? "Salvando…" : "Adicionar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}