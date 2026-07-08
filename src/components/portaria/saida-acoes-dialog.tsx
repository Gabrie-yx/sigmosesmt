// Dialog de ações da portaria para uma saída de funcionário autorizada:
// Validar (confirma saída física), Indeferir (portaria recusa), Cancelar
// (anula a autorização) e Editar (ajusta horário/motivo/observação).

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Check, XCircle, Ban, Pencil, Loader2, ArrowLeft } from "lucide-react";
import { formatCPFFromDigits } from "@/lib/validators/cpf";

export type SaidaRow = {
  id: string;
  employee_id: string;
  data: string;
  horario_saida: string;
  horario_retorno: string | null;
  com_retorno: boolean;
  tipo: string;
  motivo: string | null;
  observacao: string | null;
  status?: string | null;
  employees?: { nome?: string; cpf?: string | null; matricula?: string | null } | null;
  validacao?: { validada_at: string; observacao_portaria: string | null } | null;
};

type Modo = "menu" | "validar" | "indeferir" | "cancelar" | "editar";

export function SaidaAcoesDialog({
  open, onClose, saida,
}: { open: boolean; onClose: () => void; saida: SaidaRow | null }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [modo, setModo] = useState<Modo>("menu");
  const [obs, setObs] = useState("");
  const [motivo, setMotivo] = useState("");
  const [editData, setEditData] = useState({ data: "", horario_saida: "", horario_retorno: "", motivo: "", observacao: "" });

  useEffect(() => {
    if (open && saida) {
      setModo("menu"); setObs(""); setMotivo("");
      setEditData({
        data: saida.data,
        horario_saida: saida.horario_saida?.slice(0, 5) ?? "",
        horario_retorno: saida.horario_retorno?.slice(0, 5) ?? "",
        motivo: saida.motivo ?? "",
        observacao: saida.observacao ?? "",
      });
    }
  }, [open, saida]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["portaria-sesmt-saidas"] });
    qc.invalidateQueries({ queryKey: ["portaria-saidas-pendentes"] });
    qc.invalidateQueries({ queryKey: ["portaria-kpis"] });
  };

  const validar = useMutation({
    mutationFn: async () => {
      if (!saida) throw new Error("Sem saída");
      const { error } = await supabase.from("portaria_saidas_funcionarios").insert({
        saida_expediente_id: saida.id,
        employee_id: saida.employee_id,
        validada_por_user_id: user?.id ?? null,
        observacao_portaria: obs.trim() || null,
      });
      if (error) throw error;
      await (supabase as any).from("employee_saidas_expediente").update({
        status: "VALIDADA",
        decisao_portaria_at: new Date().toISOString(),
        decisao_portaria_por: user?.id ?? null,
      }).eq("id", saida.id);
    },
    onSuccess: () => { toast.success("Saída validada"); invalidate(); onClose(); },
    onError: (e: any) => toast.error("Falha: " + e.message),
  });

  const indeferir = useMutation({
    mutationFn: async () => {
      if (!saida) throw new Error("Sem saída");
      if (!motivo.trim()) throw new Error("Informe o motivo do indeferimento");
      const { error } = await (supabase as any).from("employee_saidas_expediente").update({
        status: "INDEFERIDA",
        decisao_portaria_at: new Date().toISOString(),
        decisao_portaria_por: user?.id ?? null,
        decisao_motivo: motivo.trim(),
      }).eq("id", saida.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Saída indeferida"); invalidate(); onClose(); },
    onError: (e: any) => toast.error("Falha: " + e.message),
  });

  const cancelar = useMutation({
    mutationFn: async () => {
      if (!saida) throw new Error("Sem saída");
      if (!motivo.trim()) throw new Error("Informe o motivo do cancelamento");
      const { error } = await (supabase as any).from("employee_saidas_expediente").update({
        status: "CANCELADA",
        decisao_portaria_at: new Date().toISOString(),
        decisao_portaria_por: user?.id ?? null,
        decisao_motivo: motivo.trim(),
      }).eq("id", saida.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Autorização cancelada"); invalidate(); onClose(); },
    onError: (e: any) => toast.error("Falha: " + e.message),
  });

  const editar = useMutation({
    mutationFn: async () => {
      if (!saida) throw new Error("Sem saída");
      const payload: Record<string, any> = {
        data: editData.data,
        horario_saida: editData.horario_saida,
        horario_retorno: editData.horario_retorno || null,
        motivo: editData.motivo || null,
        observacao: editData.observacao || null,
      };
      const { error } = await supabase.from("employee_saidas_expediente").update(payload).eq("id", saida.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Saída atualizada"); invalidate(); onClose(); },
    onError: (e: any) => toast.error("Falha: " + e.message),
  });

  if (!saida) return null;
  const jaValidada = !!saida.validacao;
  const status = (saida.status ?? "AUTORIZADA").toUpperCase();

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden gap-0">
        <DialogHeader className="px-5 py-4 border-b bg-muted/30 space-y-1">
          <div className="flex items-center gap-2.5">
            {modo !== "menu" && (
              <button onClick={() => setModo("menu")} className="h-8 w-8 rounded-md hover:bg-muted grid place-items-center text-muted-foreground" aria-label="Voltar">
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div className="min-w-0 text-left flex-1">
              <DialogTitle className="text-base font-bold leading-tight truncate">{saida.employees?.nome ?? "Funcionário"}</DialogTitle>
              <DialogDescription className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                {saida.employees?.cpf ? formatCPFFromDigits(saida.employees.cpf) : "—"} · Mat. {saida.employees?.matricula ?? "—"} · {status}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-3 max-h-[75vh] overflow-y-auto">
          {modo === "menu" && (
            <>
              <div className="rounded-xl border bg-muted/30 p-3 text-xs space-y-1">
                <div><b>Autorização:</b> {new Date(saida.data + "T00:00:00").toLocaleDateString("pt-BR")} às {saida.horario_saida?.slice(0,5)}</div>
                <div><b>Tipo:</b> {saida.tipo} · {saida.com_retorno ? `c/ retorno${saida.horario_retorno ? " " + saida.horario_retorno.slice(0,5) : ""}` : "s/ retorno"}</div>
                {saida.motivo && <div><b>Motivo:</b> {saida.motivo}</div>}
                {jaValidada && (
                  <div className="text-emerald-700 font-semibold">
                    ✓ Validada em {new Date(saida.validacao!.validada_at).toLocaleString("pt-BR")}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={() => setModo("validar")}
                  disabled={jaValidada || status === "INDEFERIDA" || status === "CANCELADA"}
                  className="h-16 flex-col gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Check className="h-4 w-4" /> <span className="text-xs font-bold">Validar</span>
                </Button>
                <Button
                  onClick={() => setModo("indeferir")}
                  disabled={jaValidada || status === "INDEFERIDA" || status === "CANCELADA"}
                  variant="outline"
                  className="h-16 flex-col gap-1 border-amber-400 text-amber-700 hover:bg-amber-50"
                >
                  <XCircle className="h-4 w-4" /> <span className="text-xs font-bold">Indeferir</span>
                </Button>
                <Button
                  onClick={() => setModo("cancelar")}
                  disabled={jaValidada || status === "CANCELADA"}
                  variant="outline"
                  className="h-16 flex-col gap-1 border-red-400 text-red-700 hover:bg-red-50"
                >
                  <Ban className="h-4 w-4" /> <span className="text-xs font-bold">Cancelar</span>
                </Button>
                <Button
                  onClick={() => setModo("editar")}
                  disabled={jaValidada}
                  variant="outline"
                  className="h-16 flex-col gap-1"
                >
                  <Pencil className="h-4 w-4" /> <span className="text-xs font-bold">Editar</span>
                </Button>
              </div>
              {jaValidada && (
                <p className="text-[11px] text-muted-foreground text-center">
                  Saída já validada pela portaria — ações bloqueadas.
                </p>
              )}
            </>
          )}

          {modo === "validar" && (
            <div className="space-y-3">
              <p className="text-sm">Confirmar que <b>{saida.employees?.nome}</b> saiu fisicamente agora?</p>
              <div>
                <Label className="text-xs">Observação da portaria (opcional)</Label>
                <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} placeholder="Ex.: saiu de moto, sem crachá…" />
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setModo("menu")}>Voltar</Button>
                <Button onClick={() => validar.mutate()} disabled={validar.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  {validar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 mr-1" /> Confirmar saída</>}
                </Button>
              </DialogFooter>
            </div>
          )}

          {modo === "indeferir" && (
            <div className="space-y-3">
              <p className="text-sm">Indeferir esta autorização (portaria não liberou a saída).</p>
              <div>
                <Label className="text-xs">Motivo do indeferimento <span className="text-red-600">*</span></Label>
                <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} placeholder="Ex.: não portava crachá, veículo sem autorização…" />
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setModo("menu")}>Voltar</Button>
                <Button onClick={() => indeferir.mutate()} disabled={indeferir.isPending || !motivo.trim()} className="bg-amber-600 hover:bg-amber-700 text-white">
                  {indeferir.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><XCircle className="h-4 w-4 mr-1" /> Indeferir</>}
                </Button>
              </DialogFooter>
            </div>
          )}

          {modo === "cancelar" && (
            <div className="space-y-3">
              <p className="text-sm">Cancelar a autorização de saída? Ela não poderá mais ser validada.</p>
              <div>
                <Label className="text-xs">Motivo do cancelamento <span className="text-red-600">*</span></Label>
                <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} placeholder="Ex.: funcionário desistiu, autorização duplicada…" />
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setModo("menu")}>Voltar</Button>
                <Button onClick={() => cancelar.mutate()} disabled={cancelar.isPending || !motivo.trim()} variant="destructive">
                  {cancelar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Ban className="h-4 w-4 mr-1" /> Cancelar autorização</>}
                </Button>
              </DialogFooter>
            </div>
          )}

          {modo === "editar" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Data</Label>
                  <Input type="date" value={editData.data} onChange={(e) => setEditData({ ...editData, data: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Saída</Label>
                  <Input type="time" value={editData.horario_saida} onChange={(e) => setEditData({ ...editData, horario_saida: e.target.value })} />
                </div>
                {saida.com_retorno && (
                  <div>
                    <Label className="text-xs">Retorno</Label>
                    <Input type="time" value={editData.horario_retorno} onChange={(e) => setEditData({ ...editData, horario_retorno: e.target.value })} />
                  </div>
                )}
              </div>
              <div>
                <Label className="text-xs">Motivo</Label>
                <Textarea value={editData.motivo} onChange={(e) => setEditData({ ...editData, motivo: e.target.value })} rows={2} />
              </div>
              <div>
                <Label className="text-xs">Observação</Label>
                <Textarea value={editData.observacao} onChange={(e) => setEditData({ ...editData, observacao: e.target.value })} rows={2} />
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setModo("menu")}>Voltar</Button>
                <Button onClick={() => editar.mutate()} disabled={editar.isPending}>
                  {editar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Pencil className="h-4 w-4 mr-1" /> Salvar</>}
                </Button>
              </DialogFooter>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
