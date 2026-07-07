// Dialog rápido — porteiro clica em uma visita "DENTRO" e confirma a saída física.
// Grava saida_at + saida_por_user_id + status = SAIDA_VALIDADA.

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, LogOut, Ban } from "lucide-react";

export function RegistrarSaidaVisitaDialog({
  visita, open, onClose,
}: { visita: any | null; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [obs, setObs] = useState("");
  const [cancelMode, setCancelMode] = useState(false);
  const [motivoCancel, setMotivoCancel] = useState("");

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

  if (!visita) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setCancelMode(false); setObs(""); setMotivoCancel(""); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{cancelMode ? "Cancelar visita" : "Registrar saída"}</DialogTitle></DialogHeader>
        <div className="space-y-2 text-sm">
          <p className="font-black text-base">{visita.pessoa?.nome}</p>
          <p className="text-xs text-slate-500">
            Entrada às {new Date(visita.entrada_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            {visita.veiculo?.placa && ` · Placa ${visita.veiculo.placa}`}
          </p>
          {!cancelMode ? (
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observação da saída (opcional)" rows={2} />
          ) : (
            <Textarea value={motivoCancel} onChange={(e) => setMotivoCancel(e.target.value)} placeholder="Motivo do cancelamento *" rows={2} />
          )}
        </div>
        <DialogFooter className="grid grid-cols-2 gap-2 sm:flex-row">
          {!cancelMode ? (
            <>
              <Button variant="outline" onClick={() => setCancelMode(true)} className="text-red-600"><Ban className="h-4 w-4 mr-1" /> Cancelar visita</Button>
              <Button onClick={() => registrarSaida.mutate()} disabled={registrarSaida.isPending} className="bg-emerald-600 hover:bg-emerald-700">
                {registrarSaida.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><LogOut className="h-4 w-4 mr-1" /> Confirmar saída</>}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setCancelMode(false)}>Voltar</Button>
              <Button onClick={() => cancelar.mutate()} disabled={cancelar.isPending} className="bg-red-600 hover:bg-red-700">
                {cancelar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar cancelamento"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}