import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { MoreVertical, Ban, Archive, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Em = {
  id: string;
  status: string;
  pdf_assinado_path?: string | null;
  pdf_gerado_path?: string | null;
};

export function OssRowActions({ em, invalidateKeys }: { em: Em; invalidateKeys: any[][] }) {
  const qc = useQueryClient();
  const { isEditor, isAdmin } = useAuth();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [inativarOpen, setInativarOpen] = useState(false);
  const [reativarOpen, setReativarOpen] = useState(false);

  const invalidate = () => invalidateKeys.forEach((k) => qc.invalidateQueries({ queryKey: k }));

  const setStatus = useMutation({
    mutationFn: async (payload: { status: string; observacoes?: string }) => {
      const upd: any = { status: payload.status, updated_at: new Date().toISOString() };
      if (payload.observacoes !== undefined) upd.observacoes = payload.observacoes;
      const { error } = await supabase.from("oss_emissoes").update(upd).eq("id", em.id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const cancelarOs = useMutation({
    mutationFn: async (motivo: string) => {
      const { error } = await (supabase as any).rpc("cancelar_os", {
        _os_id: em.id,
        _motivo: motivo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("OS cancelada. Pendência aberta para nova emissão.");
      invalidate();
      qc.invalidateQueries({ queryKey: ["pend-oss"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeRow = useMutation({
    mutationFn: async () => {
      // Tenta apagar PDFs do storage (não falha se não existir)
      const paths = [em.pdf_assinado_path, em.pdf_gerado_path].filter(Boolean) as string[];
      if (paths.length > 0) {
        await supabase.storage.from("oss-pdfs").remove(paths).catch(() => {});
      }
      const { error } = await supabase.from("oss_emissoes").delete().eq("id", em.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("OS excluída"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  if (!isEditor) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" title="Mais ações"><MoreVertical className="h-3.5 w-3.5" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {(em.status === "PENDENTE_ASSINATURA" || em.status === "ASSINADO") && (
            <DropdownMenuItem onClick={() => setCancelOpen(true)} className="text-red-600">
              <Ban className="h-3.5 w-3.5 mr-2" />Cancelar OS
            </DropdownMenuItem>
          )}
          {em.status !== "SUBSTITUIDO" && em.status !== "CANCELADO" && (
            <DropdownMenuItem onClick={() => setInativarOpen(true)}>
              <Archive className="h-3.5 w-3.5 mr-2" />Inativar (substituir)
            </DropdownMenuItem>
          )}
          {(em.status === "SUBSTITUIDO" || em.status === "CANCELADO" || em.status === "VENCIDO") && (
            <DropdownMenuItem onClick={() => setReativarOpen(true)}>
              <RefreshCw className="h-3.5 w-3.5 mr-2" />Reativar
            </DropdownMenuItem>
          )}
          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setDeleteOpen(true)} className="text-red-700">
                <Trash2 className="h-3.5 w-3.5 mr-2" />Excluir definitivamente
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Cancelar com motivo */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Ordem de Serviço</DialogTitle>
            <DialogDescription>
              A OS deixa de ser válida e fica registrada como <strong>CANCELADO</strong>.
              O histórico é preservado para auditoria.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-[11px] font-black uppercase">Motivo do cancelamento *</label>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Ex.: emissão duplicada, template incorreto, funcionário desligado..."
              rows={3}
            />
            <p className="text-[10px] text-slate-500">
              Mínimo 20 caracteres. A OS NÃO é apagada (documento legal NR-1) — fica registrada como CANCELADA no histórico, e uma pendência de nova emissão é aberta automaticamente.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCancelOpen(false)}>Voltar</Button>
            <Button
              variant="destructive"
              disabled={cancelReason.trim().length < 20 || cancelarOs.isPending}
              onClick={async () => {
                try {
                  await cancelarOs.mutateAsync(cancelReason.trim());
                  setCancelOpen(false);
                  setCancelReason("");
                } catch {}
              }}
            >
              Confirmar cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inativar (substituído) */}
      <AlertDialog open={inativarOpen} onOpenChange={setInativarOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Inativar esta OS?</AlertDialogTitle>
            <AlertDialogDescription>
              Marca como <strong>SUBSTITUÍDO</strong>. A OS deixa de contar como ativa, mas permanece no histórico.
              Use isso quando uma versão mais nova já cobre o trabalhador.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await setStatus.mutateAsync({ status: "SUBSTITUIDO" });
                toast.success("OS inativada");
              }}
            >Inativar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reativar */}
      <AlertDialog open={reativarOpen} onOpenChange={setReativarOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reativar esta OS?</AlertDialogTitle>
            <AlertDialogDescription>
              {em.pdf_assinado_path
                ? "A OS voltará para o status ASSINADO (já tem PDF assinado anexado)."
                : "A OS voltará para PENDENTE_ASSINATURA — você precisará anexar o PDF assinado de novo."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await setStatus.mutateAsync({
                  status: em.pdf_assinado_path ? "ASSINADO" : "PENDENTE_ASSINATURA",
                });
                toast.success("OS reativada");
              }}
            >Reativar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Excluir definitivamente (admin) */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta OS definitivamente?</AlertDialogTitle>
            <AlertDialogDescription>
              Ação <strong>irreversível</strong>. A OS e os PDFs anexados serão removidos do banco e do Storage.
              Para preservar a rastreabilidade, prefira <em>Cancelar</em>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-700 hover:bg-red-800"
              onClick={() => removeRow.mutate()}
              disabled={removeRow.isPending}
            >Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}