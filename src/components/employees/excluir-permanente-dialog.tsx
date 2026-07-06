import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Trash2, AlertTriangle } from "lucide-react";

type Props = {
  emp: { id: string; nome: string };
  open: boolean;
  onClose: () => void;
  onDeleted?: () => void;
};

export function ExcluirPermanenteDialog({ emp, open, onClose, onDeleted }: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [justificativa, setJustificativa] = useState("");
  const [confirmNome, setConfirmNome] = useState("");

  const nomeOk = confirmNome.trim().toUpperCase() === emp.nome.trim().toUpperCase();
  const justOk = justificativa.trim().length >= 10;

  const excluir = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).rpc("excluir_funcionario_permanente", {
        _employee_id: emp.id,
        _justificativa: justificativa.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["employees-listagem"] });
      qc.invalidateQueries({ queryKey: ["employees-desligados"] });
      qc.removeQueries({ queryKey: ["employee", emp.id] });
      toast.success(`${emp.nome} excluído permanentemente`);
      onClose();
      if (onDeleted) onDeleted();
      else navigate({ to: "/app/employees" });
    },
    onError: (e: any) => toast.error(e.message || "Falha ao excluir funcionário"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !excluir.isPending && onClose()}>
      <DialogContent className="max-w-lg border-border bg-popover text-popover-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-popover-foreground">
            <Trash2 className="h-5 w-5" /> Excluir funcionário permanentemente
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg bg-muted/70 border border-border p-3 text-xs text-popover-foreground space-y-1.5">
            <div className="flex items-center gap-1.5 font-black uppercase tracking-widest text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" /> Ação irreversível
            </div>
            <ul className="list-disc ml-5 space-y-0.5">
              <li>Uso previsto: <strong>duplicidade</strong> ou cadastro criado por engano.</li>
              <li>Todo o histórico ligado (ASOs, EPIs, treinamentos, OSs, atestados, PPP, integrações) será apagado ou desvinculado.</li>
              <li>Somente <strong>administradores</strong> podem executar. Fica registrado em auditoria com data, hora, usuário e justificativa.</li>
              <li>Para funcionário que saiu da empresa, use <strong>Desligamento</strong> — não esta opção.</li>
            </ul>
          </div>

          <div className="space-y-1.5">
            <Label className="text-foreground">Justificativa *</Label>
            <Textarea
              rows={3}
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Ex.: cadastro duplicado do CPF xxx.xxx.xxx-xx; registro criado por engano na importação de dd/mm; ..."
              className="bg-background/50 text-foreground placeholder:text-muted-foreground border-input"
            />
            <p className="text-[10px] text-muted-foreground">Mínimo 10 caracteres.</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-foreground">Digite o nome completo do funcionário para confirmar *</Label>
            <Input
              value={confirmNome}
              onChange={(e) => setConfirmNome(e.target.value)}
              placeholder={emp.nome}
              className="bg-background/50 text-foreground placeholder:text-muted-foreground border-input"
            />
            <p className="text-[10px] text-muted-foreground">Esperado: <span className="font-mono text-foreground">{emp.nome}</span></p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={excluir.isPending}>Cancelar</Button>
          <Button
            variant="destructive"
            onClick={() => excluir.mutate()}
            disabled={!justOk || !nomeOk || excluir.isPending}
          >
            {excluir.isPending ? "Excluindo…" : "Excluir definitivamente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
