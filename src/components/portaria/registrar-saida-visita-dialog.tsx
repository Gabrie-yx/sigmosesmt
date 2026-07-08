// Dialog rápido — porteiro clica em uma visita "DENTRO" e confirma a saída física.
// Grava saida_at + saida_por_user_id + status = SAIDA_VALIDADA.

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, LogOut, Ban, ShieldOff, ShieldCheck, Clock, Car, Building2, User2, AlertTriangle } from "lucide-react";

export function RegistrarSaidaVisitaDialog({
  visita, open, onClose,
}: { visita: any | null; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { user, isAdmin } = useAuth();
  const [obs, setObs] = useState("");
  const [cancelMode, setCancelMode] = useState(false);
  const [blockMode, setBlockMode] = useState(false);
  const [motivoCancel, setMotivoCancel] = useState("");
  const [motivoBloqueio, setMotivoBloqueio] = useState("");

  const registrarSaida = useMutation({
    mutationFn: async () => {
      if (!visita) throw new Error("Nenhuma visita");
      const { error } = await supabase.from("portaria_visitas").update({
        saida_at: new Date().toISOString(),
        saida_por_user_id: user?.id ?? null,
        status: "SAIDA_VALIDADA",
        observacoes: obs.trim() ? (visita.observacoes ? `${visita.observacoes} | Saída: ${obs.trim()}` : `Saída: ${obs.trim()}`) : visita.observacoes,
      }).eq("id", visita.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saída registrada");
      qc.invalidateQueries({ queryKey: ["portaria-visitas"] });
      qc.invalidateQueries({ queryKey: ["portaria-kpis"] });
      onClose();
    },
    onError: (e: any) => toast.error("Falha: " + e.message),
  });

  const cancelar = useMutation({
    mutationFn: async () => {
      if (!visita) throw new Error("");
      if (!motivoCancel.trim()) throw new Error("Informe o motivo do cancelamento");
      const { error } = await supabase.from("portaria_visitas").update({
        status: "CANCELADA",
        motivo_cancelamento: motivoCancel.trim(),
        saida_por_user_id: user?.id ?? null,
      }).eq("id", visita.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Visita cancelada"); qc.invalidateQueries({ queryKey: ["portaria-visitas"] }); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleBloqueio = useMutation({
    mutationFn: async (bloquear: boolean) => {
      if (!visita?.pessoa?.id) throw new Error("Pessoa não encontrada");
      if (bloquear && !motivoBloqueio.trim()) throw new Error("Informe o motivo do bloqueio");
      const { error } = await supabase.from("portaria_pessoas").update({
        bloqueado: bloquear,
        motivo_bloqueio: bloquear ? motivoBloqueio.trim() : null,
      }).eq("id", visita.pessoa.id);
      if (error) throw error;
    },
    onSuccess: (_d, bloquear) => {
      toast.success(bloquear ? "Pessoa bloqueada" : "Bloqueio removido");
      qc.invalidateQueries({ queryKey: ["portaria-visitas"] });
      qc.invalidateQueries({ queryKey: ["portaria-pessoas"] });
      setBlockMode(false); setMotivoBloqueio("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!visita) return null;
  const dentro = visita.status === "DENTRO";
  const bloqueada = !!visita.pessoa?.bloqueado;
  const statusLabel = dentro ? "Dentro" : visita.status === "SAIDA_VALIDADA" ? "Saída validada" : visita.status === "CANCELADA" ? "Cancelada" : visita.status;
  const statusColor = dentro ? "bg-destructive/15 text-destructive" : visita.status === "SAIDA_VALIDADA" ? "bg-emerald-500/15 text-emerald-500" : "bg-amber-500/15 text-amber-500";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setCancelMode(false); setBlockMode(false); setObs(""); setMotivoCancel(""); setMotivoBloqueio(""); } }}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        {/* Header com foto + flare */}
        <div className="relative px-5 pt-5 pb-4 bg-gradient-to-br from-primary/10 via-transparent to-transparent border-b border-border">
          <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
          <DialogHeader className="relative">
            <div className="flex items-center gap-3">
              {visita.foto_rosto_url ? (
                <img src={visita.foto_rosto_url} className="h-14 w-14 rounded-full object-cover object-top border-2 border-primary/40 shadow-lg" alt="" />
              ) : (
                <div className="h-14 w-14 rounded-full bg-muted grid place-items-center border-2 border-border">
                  <User2 className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1 text-left">
                <DialogTitle className="text-base truncate">{visita.pessoa?.nome}</DialogTitle>
                <DialogDescription className="text-xs mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusColor}`}>{statusLabel}</span>
                  {bloqueada && <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-amber-500/15 text-amber-500"><ShieldOff className="h-2.5 w-2.5" /> Bloqueada</span>}
                  <span className="text-muted-foreground">{visita.tipo}</span>
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Corpo */}
        <div className="px-5 py-4 space-y-3 text-sm">
          {bloqueada && visita.pessoa?.motivo_bloqueio && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2.5 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs"><b className="text-amber-500">Pessoa bloqueada:</b> {visita.pessoa.motivo_bloqueio}</div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg bg-muted/40 p-2.5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1"><Clock className="h-3 w-3" /> Entrada</div>
              <div className="font-semibold mt-0.5">{new Date(visita.entrada_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</div>
            </div>
            <div className="rounded-lg bg-muted/40 p-2.5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1"><LogOut className="h-3 w-3" /> Saída</div>
              <div className="font-semibold mt-0.5">{visita.saida_at ? new Date(visita.saida_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}</div>
            </div>
            {visita.veiculo?.placa && (
              <div className="rounded-lg bg-muted/40 p-2.5 col-span-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1"><Car className="h-3 w-3" /> Veículo</div>
                <div className="font-semibold mt-0.5">{visita.veiculo.placa} {visita.veiculo.modelo && `· ${visita.veiculo.modelo}`}</div>
              </div>
            )}
            {visita.empresa?.name && (
              <div className="rounded-lg bg-muted/40 p-2.5 col-span-2">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1"><Building2 className="h-3 w-3" /> Empresa visitada</div>
                <div className="font-semibold mt-0.5">{visita.empresa.name}</div>
              </div>
            )}
          </div>

          {dentro && !cancelMode && !blockMode && (
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observação da saída (opcional)" rows={2} />
          )}
          {cancelMode && (
            <Textarea value={motivoCancel} onChange={(e) => setMotivoCancel(e.target.value)} placeholder="Motivo do cancelamento *" rows={2} />
          )}
          {blockMode && (
            <Textarea value={motivoBloqueio} onChange={(e) => setMotivoBloqueio(e.target.value)} placeholder="Motivo do bloqueio (visível para porteiros) *" rows={2} />
          )}
        </div>

        <DialogFooter className="px-5 pb-5 pt-0 grid grid-cols-2 gap-2 sm:flex-row">
          {!cancelMode && !blockMode && (
            <>
              {dentro && (
                <>
                  <Button variant="outline" onClick={() => setCancelMode(true)} className="text-destructive"><Ban className="h-4 w-4 mr-1" /> Cancelar visita</Button>
                  <Button onClick={() => registrarSaida.mutate()} disabled={registrarSaida.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    {registrarSaida.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><LogOut className="h-4 w-4 mr-1" /> Confirmar saída</>}
                  </Button>
                </>
              )}
              {!dentro && isAdmin && (
                bloqueada ? (
                  <Button variant="outline" onClick={() => toggleBloqueio.mutate(false)} disabled={toggleBloqueio.isPending} className="col-span-2 text-emerald-500 border-emerald-500/40 hover:bg-emerald-500/10">
                    {toggleBloqueio.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ShieldCheck className="h-4 w-4 mr-1" /> Desbloquear pessoa</>}
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => setBlockMode(true)} className="col-span-2 text-amber-500 border-amber-500/40 hover:bg-amber-500/10">
                    <ShieldOff className="h-4 w-4 mr-1" /> Bloquear pessoa
                  </Button>
                )
              )}
              {!dentro && !isAdmin && (
                <Button variant="outline" onClick={onClose} className="col-span-2">Fechar</Button>
              )}
              {dentro && isAdmin && (
                <div className="col-span-2 pt-1 border-t border-border">
                  {bloqueada ? (
                    <Button variant="ghost" size="sm" onClick={() => toggleBloqueio.mutate(false)} disabled={toggleBloqueio.isPending} className="w-full text-emerald-500">
                      <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Desbloquear pessoa
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => setBlockMode(true)} className="w-full text-amber-500">
                      <ShieldOff className="h-3.5 w-3.5 mr-1" /> Bloquear esta pessoa
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
          {cancelMode && (
            <>
              <Button variant="outline" onClick={() => setCancelMode(false)}>Voltar</Button>
              <Button onClick={() => cancelar.mutate()} disabled={cancelar.isPending} className="bg-destructive hover:bg-destructive/90">
                {cancelar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar cancelamento"}
              </Button>
            </>
          )}
          {blockMode && (
            <>
              <Button variant="outline" onClick={() => { setBlockMode(false); setMotivoBloqueio(""); }}>Voltar</Button>
              <Button onClick={() => toggleBloqueio.mutate(true)} disabled={toggleBloqueio.isPending} className="bg-amber-600 hover:bg-amber-700 text-white">
                {toggleBloqueio.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ShieldOff className="h-4 w-4 mr-1" /> Confirmar bloqueio</>}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}