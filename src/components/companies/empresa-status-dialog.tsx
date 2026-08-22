import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Building2, RotateCcw, AlertTriangle, PowerOff } from "lucide-react";

type Props = {
  company: {
    id: string;
    name: string;
    status?: string | null;
    data_desativacao?: string | null;
    motivo_desativacao?: string | null;
  };
  ativosCount: number;
  open: boolean;
  onClose: () => void;
};

export function EmpresaStatusDialog({ company, ativosCount, open, onClose }: Props) {
  const qc = useQueryClient();
  const isDesativada = (company.status ?? "ATIVA") === "DESATIVADA";
  const [motivo, setMotivo] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["companies"] });
    qc.invalidateQueries({ queryKey: ["companies-light"] });
    qc.invalidateQueries({ queryKey: ["employees-light"] });
  };

  const reativar = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).rpc("reativar_empresa", {
        _company_id: company.id,
        _motivo: motivo.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success(`${company.name} reativada`);
      onClose();
    },
    onError: (e: any) => toast.error(e.message || "Falha ao reativar empresa"),
  });

  const desativar = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).rpc("desativar_empresa", {
        _company_id: company.id,
        _motivo: motivo.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success(`${company.name} desativada`);
      onClose();
    },
    onError: (e: any) => toast.error(e.message || "Falha ao desativar empresa"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            {isDesativada
              ? <><RotateCcw className="h-5 w-5 text-emerald-400" /> Reativar empresa</>
              : <><PowerOff className="h-5 w-5 text-rose-400" /> Desativar empresa</>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <p className="flex items-center gap-2 font-black uppercase tracking-wide text-foreground">
            <Building2 className="h-4 w-4 text-muted-foreground" /> {company.name}
          </p>

          {isDesativada ? (
            <>
              <p className="text-muted-foreground">
                Desativada desde{" "}
                {company.data_desativacao
                  ? new Date(company.data_desativacao + "T00:00:00").toLocaleDateString("pt-BR")
                  : "—"}
                {company.motivo_desativacao ? ` · ${company.motivo_desativacao}` : ""}
              </p>
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">
                Ao reativar, a empresa volta a aparecer nas listagens ativas e pode receber novos vínculos,
                documentos e emissões. Todo o histórico é preservado.
              </div>
            </>
          ) : (
            <>
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200 space-y-1">
                <div className="flex items-center gap-1.5 font-black">
                  <AlertTriangle className="h-3.5 w-3.5" /> O que acontece ao desativar:
                </div>
                <ul className="list-disc ml-5 space-y-0.5">
                  <li>A empresa sai das listagens ativas e vai para a seção <strong>DESATIVADAS</strong></li>
                  <li>Não aparece em seleções de admissão / transferência</li>
                  <li>Todo o histórico (funcionários, documentos, dossiê) é <strong>preservado</strong></li>
                  <li>Se um funcionário ativo for vinculado a ela, volta automaticamente para ATIVA</li>
                </ul>
              </div>
              {ativosCount > 0 && (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
                  Esta empresa ainda possui <strong>{ativosCount}</strong> funcionário(s) ativo(s).
                  Registre o desligamento deles antes de desativar.
                </div>
              )}
            </>
          )}

          <div className="space-y-1.5">
            <Label>Justificativa {isDesativada ? "da reativação" : "da desativação"} *</Label>
            <Textarea
              rows={4}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder={
                isDesativada
                  ? "Ex.: retomada de contrato no pátio; nova obra iniciada…"
                  : "Ex.: encerramento das atividades no pátio do estaleiro; fim de contrato…"
              }
            />
            <p className="text-[10px] text-muted-foreground">Mínimo 5 caracteres. Fica registrado na empresa.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          {isDesativada ? (
            <Button
              onClick={() => reativar.mutate()}
              disabled={reativar.isPending || motivo.trim().length < 5}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {reativar.isPending ? "Reativando…" : "Reativar empresa"}
            </Button>
          ) : (
            <Button
              onClick={() => desativar.mutate()}
              disabled={desativar.isPending || motivo.trim().length < 5 || ativosCount > 0}
              className="bg-rose-700 hover:bg-rose-800 text-white"
            >
              {desativar.isPending ? "Desativando…" : "Desativar empresa"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
