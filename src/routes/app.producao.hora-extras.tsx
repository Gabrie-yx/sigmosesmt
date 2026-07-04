import { createFileRoute } from "@tanstack/react-router";
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
  Search, Check, UserPlus, Users, Loader2, Clock, ShieldAlert,
  Plus, ClipboardList, ChevronLeft, CheckCircle2, XCircle, HourglassIcon, Trash2,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/app/producao/hora-extras")({
  component: HoraExtrasProducaoPage,
});

type LiderInfo = { id: string; employee_id: string; user_id: string; nome: string; observacao: string | null };
type Convocacao = {
  id: string; data: string; tipo_convocacao: "SABADO" | "DIAS_UTEIS";
  horario_inicio: string; horario_fim: string;
  justificativa: string; status: "PENDENTE"|"APROVADA"|"INDEFERIDA";
  motivo_indeferimento: string | null; qtd_marcados: number; criado_em: string;
};

function HoraExtrasProducaoPage() {
  const { user, isExtraSabadoMarcador, isAdmin, isModerator } = useAuth();
  const qc = useQueryClient();
  const [convocacaoAtivaId, setConvocacaoAtivaId] = useState<string | null>(null);
  const [novaOpen, setNovaOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const [externoOpen, setExternoOpen] = useState(false);

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

  const { data: minhasConvocacoes, isLoading: loadingConvs } = useQuery({
    queryKey: ["convocacoes-do-lider", user?.id],
    enabled: !!user?.id && isLider,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("listar_convocacoes_extra_lider");
      if (error) throw error;
      return (data ?? []) as Convocacao[];
    },
  });

  useEffect(() => {
    if (!convocacaoAtivaId && minhasConvocacoes && minhasConvocacoes.length > 0) {
      const editavel = minhasConvocacoes.find(c => c.status !== "INDEFERIDA");
      setConvocacaoAtivaId((editavel ?? minhasConvocacoes[0]).id);
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
  const readOnly = !isAdmin && status === "INDEFERIDA";

  const filtrados = useMemo(() => {
    const s = busca.trim().toLowerCase();
    if (!s) return employees ?? [];
    return (employees ?? []).filter((e: any) =>
      e.nome.toLowerCase().includes(s) ||
      (e.setor ?? "").toLowerCase().includes(s) ||
      (e.empresa_nome ?? "").toLowerCase().includes(s)
    );
  }, [employees, busca]);

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

  if (loadingLider) {
    return <div className="p-8 text-center text-sm text-slate-400"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>;
  }

  if (!isMarcador) {
    return (
      <div className="p-8 text-center space-y-3">
        <ShieldAlert className="h-10 w-10 text-amber-400 mx-auto" />
        <h1 className="text-lg font-black">Sem acesso a Hora Extras</h1>
        <p className="text-sm text-slate-400">Este módulo é dos líderes convocantes. Fale com o SESMT se você deveria ter acesso.</p>
      </div>
    );
  }

  const dataConv = conv?.data ? new Date(conv.data + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }) : "…";
  const tipoLabel = conv?.tipo_convocacao === "DIAS_UTEIS" ? "Extra Dia Útil" : "Extra de Sábado";

  return (
    <div className="pb-20">
      <header className="px-4 py-4 border-b border-white/10 bg-white/[0.02]">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-rose-300/80">Hora Extras — {tipoLabel}</div>
            <div className="text-base font-black leading-tight truncate">
              {conv ? `${dataConv} · ${conv.horario_inicio}–${conv.horario_fim}` : (lider ? `Líder: ${lider.nome.split(" ").slice(0,2).join(" ")}` : "Nenhuma convocação selecionada")}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isLider && (
              <Button size="sm" onClick={() => setNovaOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="h-4 w-4 mr-1" /> Nova convocação
              </Button>
            )}
            {convId && (isLider || isAdmin) && conv && conv.status !== "APROVADA" && (
              <Button
                size="sm"
                variant="destructive"
                onClick={async () => {
                  if (!confirm("Excluir esta convocação? Essa ação não pode ser desfeita.")) return;
                  const { error } = await supabase.rpc("excluir_convocacao_extra_lider", { _hora_extra_id: convId });
                  if (error) return toast.error(error.message);
                  toast.success("Convocação excluída");
                  setConvocacaoAtivaId(null);
                  qc.invalidateQueries({ queryKey: ["convocacoes-do-lider"] });
                }}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Excluir
              </Button>
            )}
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
            <div className="space-y-2 max-w-xl mx-auto">
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
        </div>
      )}

      {convId && (
        <>
          {isLider && minhasConvocacoes && minhasConvocacoes.length > 1 && (
            <div className="px-4 py-2 border-b border-white/10 bg-white/[0.02]">
              <button onClick={() => setConvocacaoAtivaId(null)} className="text-xs text-rose-300 hover:text-rose-200 font-bold flex items-center gap-1">
                <ChevronLeft className="h-3 w-3" /> Voltar às convocações
              </button>
            </div>
          )}
          {conv?.justificativa && (
            <div className="px-4 py-3 border-b border-white/10">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Justificativa</div>
              <div className="text-sm text-slate-200 whitespace-pre-wrap">{conv.justificativa}</div>
            </div>
          )}
          <div className="px-4 py-3 border-b border-white/10">
            <div className="grid grid-cols-2 gap-3 max-w-md">
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
            {readOnly && (
              <div className="mt-3 rounded-lg px-3 py-2 text-xs font-bold flex items-center gap-2 bg-slate-500/20 text-slate-200 border border-slate-400/30">
                <Clock className="h-4 w-4" />
                Somente leitura — convocação indeferida
              </div>
            )}
          </div>

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
                    {!readOnly && (isAdmin || r.marcado_por === user?.id) && (
                      <button onClick={() => desmarcar.mutate(r.id)} className="text-xs text-red-300 hover:text-red-200 font-bold shrink-0 px-2">Remover</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="px-4 py-3 border-b border-white/10 flex gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome, setor…" className="pl-9" />
            </div>
            {!readOnly && (
              <Button size="sm" variant="secondary" onClick={() => setExternoOpen(true)}>
                <UserPlus className="h-4 w-4 mr-1" /> Externo
              </Button>
            )}
          </div>

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
                <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {funcs.map((e: any) => {
                    const marcado = marcadosMap.get(e.id);
                    const podeToggle = !readOnly
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
                        className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${marcado ? "bg-emerald-500/15 border border-emerald-400/40" : "bg-white/5 border border-white/10 hover:bg-white/10"} ${!podeToggle && !marcado ? "opacity-50" : ""}`}
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
      return (data ?? []) as Array<{ id: string; nome: string; setor: string | null; funcao: string | null }>;
    },
  });

  useEffect(() => {
    if (!open) return;
    setJust(""); setBusca(""); setSel(new Set()); setTipo("SABADO");
    setHi("07:30"); setHf("15:00");
    const hoje = new Date();
    const dow = hoje.getDay();
    const dias = (6 - dow + 7) % 7 || 7;
    const sab = new Date(hoje); sab.setDate(hoje.getDate() + dias);
    setData(sab.toISOString().slice(0, 10));
  }, [open]);

  useEffect(() => {
    if (tipo === "SABADO") { setHi("07:30"); setHf("15:00"); }
    else { setHi("17:00"); setHf("19:00"); }
  }, [tipo]);

  const filtrados = useMemo(() => {
    const s = busca.trim().toLowerCase();
    const list = employees ?? [];
    if (!s) return list;
    return list.filter((e) =>
      e.nome.toLowerCase().includes(s) || (e.setor ?? "").toLowerCase().includes(s)
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
    if (just.trim().length < 5) return toast.error("Justificativa muito curta (mín. 5 caracteres)");
    if (!data || !hi || !hf) return toast.error("Preencha data, hora início e hora fim");
    if (sel.size === 0) return toast.error("Selecione pelo menos 1 funcionário");
    setSaving(true);
    const { data: id, error } = await supabase.rpc("criar_convocacao_extra_lider", {
      _tipo: tipo, _data: data, _horario_inicio: hi, _horario_fim: hf,
      _justificativa: just, _employee_ids: Array.from(sel),
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
          <DialogTitle>Nova convocação</DialogTitle>
          <DialogDescription>Escolha o tipo, horário, quem vai e a justificativa. Anderson vai aprovar ou indeferir.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SABADO">Extra de Sábado</SelectItem>
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
            <Label>Justificativa da hora extra (obrigatória)</Label>
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