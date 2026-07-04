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
} from "lucide-react";

export const Route = createFileRoute("/extra-sabado")({
  component: ExtraSabadoMobilePage,
});

type MarcadorConfig = {
  user_id: string;
  nome: string;
  ativo: boolean;
  escopo: any;
  self_employee_id: string | null;
};

function ExtraSabadoMobilePage() {
  const { session, loading, user, isExtraSabadoMarcador, isAdmin, isModerator } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [externoOpen, setExternoOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Relógio pra reagir ao corte 18:29/19h sem F5
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!loading && !session) {
      try { sessionStorage.setItem("post_login_redirect", "/extra-sabado"); } catch {}
      navigate({ to: "/login", search: { redirect: "/extra-sabado" } as any });
    }
  }, [loading, session, navigate]);

  const isMarcador = isExtraSabadoMarcador || isAdmin || isModerator;

  // Config do marcador logado (define escopo)
  const { data: minhaConfig } = useQuery({
    queryKey: ["marcador-config", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("hora_extra_marcadores")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return (data ?? null) as MarcadorConfig | null;
    },
  });

  // Get-or-create convocação do próximo sábado
  const { data: convId, isLoading: loadingConv, error: convError } = useQuery({
    queryKey: ["extra-sabado-conv-atual"],
    enabled: !!session && (isExtraSabadoMarcador || !!minhaConfig || isAdmin),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_or_create_convocacao_sabado_atual");
      if (error) throw error;
      return data as string;
    },
  });

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
        () => qc.invalidateQueries({ queryKey: ["extra-sabado-conv", convId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [convId, qc]);

  // Employees que caem no escopo do marcador (query construída no client)
  const { data: employees, isLoading: loadingEmployees } = useQuery({
    queryKey: ["extra-sabado-employees", minhaConfig?.user_id, isAdmin],
    enabled: !!user?.id && (isAdmin || !!minhaConfig),
    queryFn: async () => {
      // Admin vê todos ativos
      if (isAdmin && !minhaConfig) {
        const { data } = await supabase
          .from("employees")
          .select("id, nome, setor, tipo_vinculo, empresa_terceira_id, empresas_terceiras(nome_fantasia, razao_social)")
          .eq("status", "ATIVO")
          .order("nome");
        return data ?? [];
      }
      const escopo = minhaConfig!.escopo as any;
      const tipo = escopo?.tipo as string;
      let q = supabase
        .from("employees")
        .select("id, nome, setor, tipo_vinculo, empresa_terceira_id, empresas_terceiras(nome_fantasia, razao_social)")
        .eq("status", "ATIVO");

      if (tipo === "SELF") {
        q = q.eq("id", minhaConfig!.self_employee_id ?? "00000000-0000-0000-0000-000000000000");
      } else if (tipo === "SETOR") {
        q = q.in("setor", (escopo.valores ?? []) as string[]);
      } else if (tipo === "EMPRESA_TERCEIRA") {
        q = q.in("empresa_terceira_id", (escopo.ids ?? []) as string[]);
      } else if (tipo === "DMN_APOIO") {
        q = q.is("empresa_terceira_id", null).in("setor", (escopo.setores ?? []) as string[]);
      }
      // TUDO = sem filtro adicional
      const { data } = await q.order("nome");
      return data ?? [];
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
  const editAte = conv?.marcadores_edit_ate ? new Date(conv.marcadores_edit_ate).getTime() : null;
  const expiraEm = conv?.marcadores_expira_em ? new Date(conv.marcadores_expira_em).getTime() : null;
  const readOnly = !isAdmin && editAte !== null && now > editAte;
  const expirado = !isAdmin && expiraEm !== null && now > expiraEm;

  const filtrados = useMemo(() => {
    const s = busca.trim().toLowerCase();
    if (!s) return employees ?? [];
    return (employees ?? []).filter((e: any) =>
      e.nome.toLowerCase().includes(s) ||
      (e.setor ?? "").toLowerCase().includes(s) ||
      (e.empresas_terceiras?.nome_fantasia ?? "").toLowerCase().includes(s)
    );
  }, [employees, busca]);

  // Agrupa por empresa (terceirizada) / setor
  const grupos = useMemo(() => {
    const g = new Map<string, any[]>();
    filtrados.forEach((e: any) => {
      const key = e.empresas_terceiras?.nome_fantasia
        ?? e.empresas_terceiras?.razao_social
        ?? (e.tipo_vinculo === "MEI" ? "MEIs" : (e.setor || "DMN"));
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

  const dataSabado = conv?.data ? new Date(conv.data + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }) : "…";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-20">
      {/* Header sticky */}
      <header className="sticky top-0 z-20 bg-gradient-to-b from-[#7f1212] to-[#5a0f22] px-4 py-3 shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-rose-200/80">Extra de Sábado</div>
            <div className="text-base font-black leading-tight truncate">{dataSabado}</div>
          </div>
          <button onClick={signOut} className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition text-white shrink-0" aria-label="Sair">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        {conv?.criado_automatico && (
          <div className="mt-2 text-[10px] text-rose-100/90 bg-white/10 rounded px-2 py-1">
            Convocação criada automaticamente por <b>{conv.criado_automatico_por_nome ?? "marcador"}</b>
          </div>
        )}
      </header>

      {loadingConv ? (
        <div className="p-8 text-center text-slate-400 text-sm">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
          Abrindo convocação…
        </div>
      ) : convError ? (
        <div className="p-6 rounded-2xl m-4 border border-amber-400/30 bg-amber-500/10 text-amber-200 text-sm">
          <AlertTriangle className="h-5 w-5 mb-2" />
          {(convError as any).message}
        </div>
      ) : (
        <>
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
                {expirado ? "Convocação encerrada (após sexta 19h)" : "Somente leitura — edição encerra às 18:30 de sexta"}
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
                {minhaConfig ? "Nenhum funcionário no seu escopo." : "Seu perfil de marcador ainda não foi configurado. Fale com o SESMT."}
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
                            {e.setor ?? "—"}
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