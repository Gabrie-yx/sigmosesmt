import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Building2, RotateCcw, AlertTriangle, PowerOff, Trash2 } from "lucide-react";

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
  const { isAdmin } = useAuth();
  const isDesativada = (company.status ?? "ATIVA") === "DESATIVADA";
  const [motivo, setMotivo] = useState("");
  const [desligarTodos, setDesligarTodos] = useState(false);
  const [modoExcluir, setModoExcluir] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["companies"] });
    qc.invalidateQueries({ queryKey: ["companies-light"] });
    qc.invalidateQueries({ queryKey: ["employees-light"] });
    qc.invalidateQueries({ queryKey: ["employees"] });
  };

  const fechar = () => {
    setMotivo("");
    setDesligarTodos(false);
    setModoExcluir(false);
    setConfirmacao("");
    onClose();
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
      fechar();
    },
    onError: (e: any) => toast.error(e.message || "Falha ao reativar empresa"),
  });

  const desativar = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).rpc("desativar_empresa", {
        _company_id: company.id,
        _motivo: motivo.trim(),
        _desligar_funcionarios: desligarTodos,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success(
        desligarTodos && ativosCount > 0
          ? `${company.name} desativada e ${ativosCount} funcionário(s) desligado(s)`
          : `${company.name} desativada`,
      );
      fechar();
    },
    onError: (e: any) => toast.error(e.message || "Falha ao desativar empresa"),
  });

  const excluir = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).rpc("excluir_empresa_permanente", {
        _company_id: company.id,
        _justificativa: motivo.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success(`${company.name} excluída definitivamente`);
      fechar();
    },
    onError: (e: any) => toast.error(e.message || "Falha ao excluir empresa"),
  });

  const podeExcluir = isAdmin && isDesativada;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && fechar()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            {modoExcluir
              ? <><Trash2 className="h-5 w-5 text-destructive" /> Excluir empresa definitivamente</>
              : isDesativada
                ? <><RotateCcw className="h-5 w-5 text-emerald-400" /> Reativar empresa</>
                : <><PowerOff className="h-5 w-5 text-rose-400" /> Desativar empresa</>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <p className="flex items-center gap-2 font-black uppercase tracking-wide text-foreground">
            <Building2 className="h-4 w-4 text-muted-foreground" /> {company.name}
          </p>

          {modoExcluir ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive-foreground space-y-1">
              <div className="flex items-center gap-1.5 font-black">
                <AlertTriangle className="h-3.5 w-3.5" /> Ação irreversível
              </div>
              <ul className="list-disc ml-5 space-y-0.5">
                <li>A empresa é apagada de forma permanente</li>
                <li><strong>Todos os funcionários vinculados a ela são apagados</strong> junto</li>
                <li>Não há como desfazer — use apenas para cadastros errados ou de teste</li>
                <li>Fica registrado no histórico de auditoria (quem excluiu e por quê)</li>
              </ul>
            </div>
          ) : isDesativada ? (
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
                documentos e emissões. Todo o histórico é preservado. Os funcionários desligados continuam
                desligados — readmita ou atualize um a um conforme a necessidade.
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
                <label className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200 cursor-pointer">
                  <Checkbox
                    checked={desligarTodos}
                    onCheckedChange={(v) => setDesligarTodos(v === true)}
                    className="mt-0.5"
                  />
                  <span>
                    Desligar também os <strong>{ativosCount}</strong> funcionário(s) ativo(s) desta empresa.
                    Sem marcar esta opção, é preciso desligá-los antes.
                  </span>
                </label>
              )}
            </>
          )}

          <div className="space-y-1.5">
            <Label>
              Justificativa {modoExcluir ? "da exclusão" : isDesativada ? "da reativação" : "da desativação"} *
            </Label>
            <Textarea
              rows={4}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder={
                modoExcluir
                  ? "Ex.: cadastro duplicado/de teste criado por engano…"
                  : isDesativada
                    ? "Ex.: retomada de contrato no pátio; nova obra iniciada…"
                    : "Ex.: encerramento das atividades no pátio do estaleiro; fim de contrato…"
              }
            />
            <p className="text-[10px] text-muted-foreground">
              Mínimo {modoExcluir ? 10 : 5} caracteres. Fica registrado no sistema.
            </p>
          </div>

          {modoExcluir && (
            <div className="space-y-1.5">
              <Label>Digite <span className="font-black">EXCLUIR</span> para confirmar *</Label>
              <Input value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} placeholder="EXCLUIR" />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <div>
            {podeExcluir && !modoExcluir && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setModoExcluir(true); setMotivo(""); }}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir definitivamente
              </Button>
            )}
            {modoExcluir && (
              <Button variant="ghost" size="sm" onClick={() => { setModoExcluir(false); setConfirmacao(""); setMotivo(""); }}>
                Voltar
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fechar}>Cancelar</Button>
            {modoExcluir ? (
              <Button
                variant="destructive"
                onClick={() => excluir.mutate()}
                disabled={excluir.isPending || motivo.trim().length < 10 || confirmacao.trim().toUpperCase() !== "EXCLUIR"}
              >
                {excluir.isPending ? "Excluindo…" : "Excluir para sempre"}
              </Button>
            ) : isDesativada ? (
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
                disabled={
                  desativar.isPending ||
                  motivo.trim().length < 5 ||
                  (ativosCount > 0 && !desligarTodos)
                }
                className="bg-rose-700 hover:bg-rose-800 text-white"
              >
                {desativar.isPending ? "Desativando…" : "Desativar empresa"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
