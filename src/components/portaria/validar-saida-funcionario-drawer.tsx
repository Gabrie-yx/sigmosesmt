// Drawer "Validar Saída de Funcionário".
// Busca por CPF/nome as autorizações do SESMT (employee_saidas_expediente)
// que ainda não foram validadas fisicamente (não existe linha em
// portaria_saidas_funcionarios). Ao confirmar, grava o check-out físico e
// o registro entra na trilha de auditoria via trigger.

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SignedAvatarImg } from "@/components/signed-avatar-img";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Check, Search, AlertCircle, Clock, ChevronRight, LogOut, ArrowLeft, CalendarDays } from "lucide-react";
import { formatCPFFromDigits, onlyDigits } from "@/lib/validators/cpf";

type SaidaAutorizada = {
  id: string;
  employee_id: string;
  data: string;
  horario_saida: string;
  horario_retorno: string | null;
  com_retorno: boolean;
  tipo: string;
  motivo: string | null;
  observacao: string | null;
  employees: { id: string; nome: string; cpf: string | null; foto_url: string | null; matricula: string | null };
};

export function ValidarSaidaFuncionarioDrawer({
  open, onClose,
}: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [selecionada, setSelecionada] = useState<SaidaAutorizada | null>(null);
  const [obs, setObs] = useState("");

  // Lista de saídas do dia sem validação física
  const { data: pendentes, isLoading, refetch } = useQuery({
    queryKey: ["portaria-saidas-pendentes"],
    enabled: open,
    queryFn: async () => {
      const hoje = new Date().toISOString().slice(0, 10);
      // Últimos 3 dias (o funcionário pode ter autorizado ontem e sair hoje cedo)
      const desde = new Date(); desde.setDate(desde.getDate() - 3);
      const desdeIso = desde.toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("employee_saidas_expediente")
        .select("id, employee_id, data, horario_saida, horario_retorno, com_retorno, tipo, motivo, observacao, employees:employee_id(id,nome,cpf,foto_url,matricula)")
        .gte("data", desdeIso)
        .lte("data", hoje)
        .order("data", { ascending: false })
        .order("horario_saida", { ascending: false });
      if (error) throw error;
      // filtra as que já foram validadas
      const ids = (data ?? []).map((s: any) => s.id);
      if (ids.length === 0) return [];
      const { data: validadas } = await supabase
        .from("portaria_saidas_funcionarios")
        .select("saida_expediente_id")
        .in("saida_expediente_id", ids);
      const validSet = new Set((validadas ?? []).map((v: any) => v.saida_expediente_id));
      return (data ?? []).filter((s: any) => !validSet.has(s.id)) as SaidaAutorizada[];
    },
  });

  useEffect(() => { if (!open) { setSelecionada(null); setObs(""); setQ(""); } }, [open]);

  const filtered = (pendentes ?? []).filter((s) => {
    if (!q.trim()) return true;
    const n = q.trim().toLowerCase();
    const cpfDig = onlyDigits(q);
    return (
      s.employees?.nome?.toLowerCase().includes(n) ||
      (cpfDig && (s.employees?.cpf ?? "").includes(cpfDig))
    );
  });

  const confirmar = useMutation({
    mutationFn: async () => {
      if (!selecionada) throw new Error("Nenhuma saída selecionada");
      const { error } = await supabase.from("portaria_saidas_funcionarios").insert({
        saida_expediente_id: selecionada.id,
        employee_id: selecionada.employee_id,
        validada_por_user_id: user?.id ?? null,
        observacao_portaria: obs.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saída validada");
      qc.invalidateQueries({ queryKey: ["portaria-saidas-pendentes"] });
      qc.invalidateQueries({ queryKey: ["portaria-kpis"] });
      setSelecionada(null); setObs(""); refetch();
    },
    onError: (e: any) => toast.error("Falha: " + e.message),
  });

  const listaOpen = open && !selecionada;
  const detalheOpen = open && !!selecionada;

  return (
    <>
      {/* Modal 1 — Lista de saídas pendentes */}
      <Dialog open={listaOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden gap-0 border-border">
          <DialogHeader className="px-5 py-4 border-b border-border bg-muted/30 space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-primary/15 text-primary grid place-items-center shrink-0">
                <LogOut className="h-4 w-4" />
              </div>
              <div className="min-w-0 text-left">
                <DialogTitle className="text-base font-bold leading-tight">Validar saída de funcionário</DialogTitle>
                <DialogDescription className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                  Confirme visualmente antes de liberar a saída física
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="px-5 pt-4 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por CPF ou nome…" className="h-11 pl-10 text-sm" autoFocus />
            </div>
            <div className="flex items-center justify-between mt-3 mb-1">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Autorizadas pelo SESMT</p>
              <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{filtered.length} pendente{filtered.length === 1 ? "" : "s"}</span>
            </div>
          </div>

          <div className="px-3 pb-4 max-h-[60vh] overflow-y-auto">
            {isLoading ? (
              <div className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-10 px-6 text-muted-foreground">
                <AlertCircle className="h-7 w-7 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-semibold text-foreground">Nenhuma saída pendente</p>
                <p className="text-xs mt-1 opacity-80">Peça ao SESMT para gerar a autorização primeiro.</p>
              </div>
            ) : (
              <ul className="space-y-1.5">
                {filtered.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => setSelecionada(s)}
                      className="w-full text-left rounded-xl border border-border bg-card hover:bg-muted/50 hover:border-primary/40 transition p-2.5 flex items-center gap-3"
                    >
                      {s.employees?.foto_url
                        ? <SignedAvatarImg src={s.employees.foto_url} className="h-11 w-11 rounded-full object-cover border border-border shrink-0" />
                        : <div className="h-11 w-11 rounded-full bg-muted text-muted-foreground font-bold text-xs flex items-center justify-center border border-border shrink-0">
                            {s.employees?.nome?.split(/\s+/).map((p) => p[0]).slice(0,2).join("").toUpperCase()}
                          </div>}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate text-foreground">{s.employees?.nome}</p>
                        <p className="text-[10px] text-muted-foreground">{s.employees?.cpf ? formatCPFFromDigits(s.employees.cpf) : "—"}</p>
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          <span className="text-[9px] font-semibold uppercase tracking-wider bg-primary/10 text-primary rounded px-1.5 py-0.5">{s.tipo}</span>
                          <span className="text-[9px] font-semibold uppercase tracking-wider bg-muted text-muted-foreground rounded px-1.5 py-0.5">{s.com_retorno ? "Com retorno" : "Sem retorno"}</span>
                          <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" /> {s.horario_saida?.slice(0,5)} · {new Date(s.data + "T00:00:00").toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal 2 — Confirmação da saída selecionada */}
      <Dialog open={detalheOpen} onOpenChange={(o) => { if (!o) setSelecionada(null); }}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden gap-0 border-border max-h-[100dvh] sm:max-h-[90vh] flex flex-col">
          <DialogHeader className="px-5 py-4 border-b border-border bg-muted/30 space-y-0">
            <div className="flex items-center gap-2.5">
              <button onClick={() => setSelecionada(null)} className="h-8 w-8 rounded-md hover:bg-muted grid place-items-center text-muted-foreground shrink-0" aria-label="Voltar">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="min-w-0 text-left">
                <DialogTitle className="text-base font-bold leading-tight">Confirmar saída</DialogTitle>
                <DialogDescription className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                  Revise os dados antes de liberar
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {selecionada && (
            <div className="p-5 space-y-4 flex-1 overflow-y-auto min-h-0">
              <div className="flex items-center gap-3">
                {selecionada.employees?.foto_url
                  ? <SignedAvatarImg src={selecionada.employees.foto_url} className="h-20 w-20 rounded-2xl object-cover border border-border shrink-0" />
                  : <div className="h-20 w-20 rounded-2xl bg-muted text-muted-foreground font-bold text-xl flex items-center justify-center border border-border shrink-0">
                      {selecionada.employees?.nome?.split(/\s+/).map((p) => p[0]).slice(0,2).join("").toUpperCase()}
                    </div>}
                <div className="min-w-0">
                  <h3 className="font-bold text-base leading-tight text-foreground">{selecionada.employees?.nome}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{selecionada.employees?.cpf ? formatCPFFromDigits(selecionada.employees.cpf) : "—"}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">Mat. {selecionada.employees?.matricula ?? "—"}</p>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-muted/30 divide-y divide-border overflow-hidden">
                <Row label="Tipo" value={selecionada.tipo} />
                <Row label="Horário de saída" value={selecionada.horario_saida?.slice(0,5)} icon={<Clock className="h-3 w-3" />} />
                <Row label="Retorno" value={selecionada.com_retorno ? `Sim · ${selecionada.horario_retorno?.slice(0,5) ?? "—"}` : "Não"} />
                <Row label="Data" value={new Date(selecionada.data + "T00:00:00").toLocaleDateString("pt-BR")} icon={<CalendarDays className="h-3 w-3" />} />
                {selecionada.motivo && (
                  <div className="px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Motivo</p>
                    <p className="text-sm text-foreground mt-0.5">{selecionada.motivo}</p>
                  </div>
                )}
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Observação da portaria (opcional)</label>
                <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} className="mt-1.5 text-sm" placeholder="Ex.: saiu de moto, sem uniforme, etc." />
              </div>
            </div>
          )}
          {selecionada && (
            <div
              className="shrink-0 border-t border-border bg-background px-5 pt-3 grid grid-cols-2 gap-2"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
            >
              <Button variant="outline" onClick={() => setSelecionada(null)} className="h-12">Voltar</Button>
              <Button onClick={() => confirmar.mutate()} disabled={confirmar.isPending} className="h-12 font-semibold">
                {confirmar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 mr-1.5" /> Confirmar</>}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Row({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="px-3 py-2.5 flex items-center justify-between gap-3">
      <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground inline-flex items-center gap-1.5">{icon}{label}</span>
      <span className="text-sm font-semibold text-foreground text-right">{value}</span>
    </div>
  );
}