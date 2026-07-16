import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { UserMinus, RotateCcw, AlertTriangle } from "lucide-react";

const MOTIVOS = [
  "Fim de contrato terceirizado",
  "Pedido de demissão",
  "Dispensa sem justa causa",
  "Dispensa por justa causa",
  "Acordo entre as partes",
  "Aposentadoria",
  "Término de obra",
  "Falecimento",
  "Outro",
];

const CHECKLIST_ITEMS: { key: string; label: string }[] = [
  { key: "epis_devolvidos", label: "EPIs devolvidos / baixa registrada" },
  { key: "aso_demissional", label: "ASO demissional emitido (NR-07)" },
  { key: "equipamentos_devolvidos", label: "Equipamentos / crachá / uniforme devolvidos" },
  { key: "ferramentas_devolvidas", label: "Ferramentas devolvidas" },
  { key: "acessos_revogados", label: "Acessos físicos e de sistema revogados" },
  { key: "ppp_pendente", label: "PPP entregue ao colaborador" },
];

type Props = {
  emp: { id: string; nome: string; status: string; data_desligamento?: string | null; motivo_desligamento?: string | null };
  open: boolean;
  onClose: () => void;
};

export function DesligamentoDialog({ emp, open, onClose }: Props) {
  const qc = useQueryClient();
  const isDesligado = emp.status === "DESLIGADO";

  const [data, setData] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [motivo, setMotivo] = useState<string>(MOTIVOS[0]);
  const [motivoOutro, setMotivoOutro] = useState<string>("");
  const [obs, setObs] = useState<string>("");
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [confirmacao, setConfirmacao] = useState(false);
  const [motivoReativacao, setMotivoReativacao] = useState<string>("");

  const desligar = useMutation({
    mutationFn: async () => {
      const motivoFinal = motivo === "Outro" ? (motivoOutro.trim() || "Outro") : motivo;
      const { error } = await (supabase as any).rpc("registrar_desligamento_funcionario", {
        _employee_id: emp.id,
        _data_desligamento: data,
        _motivo: motivoFinal,
        _observacoes: obs || null,
        _checklist: checklist,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee", emp.id] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["employees-listagem"] });
      qc.invalidateQueries({ queryKey: ["oss-by-employee", emp.id] });
      toast.success(`${emp.nome} marcado como DESLIGADO`);
      onClose();
    },
    onError: (e: any) => toast.error(e.message || "Falha ao registrar desligamento"),
  });

  const reativar = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).rpc("reativar_funcionario", {
        _employee_id: emp.id,
        _motivo: motivoReativacao.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee", emp.id] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["employees-desligados"] });
      qc.invalidateQueries({ queryKey: ["safety-overrides", emp.id] });
      toast.success(`${emp.nome} reativado`);
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isDesligado) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground"><RotateCcw className="h-5 w-5 text-emerald-300" />Reativar funcionário</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p><strong>{emp.nome}</strong> está marcado como DESLIGADO desde {emp.data_desligamento ? new Date(emp.data_desligamento + "T00:00:00").toLocaleDateString("pt-BR") : "—"}.</p>
            {emp.motivo_desligamento && <p className="text-muted-foreground">Motivo: {emp.motivo_desligamento}</p>}
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
              Ao reativar, o bloqueio global de segurança será revogado e o funcionário poderá receber novas OSs, EPIs e treinamentos. O histórico será preservado.
            </div>
            <div className="space-y-1.5">
              <Label>Justificativa da reativação *</Label>
              <Textarea
                rows={4}
                value={motivoReativacao}
                onChange={(e) => setMotivoReativacao(e.target.value)}
                placeholder="Ex.: Recontratação por retorno de obra; reintegração por decisão judicial; erro operacional no desligamento anterior…"
              />
              <p className="text-[10px] text-muted-foreground">
                Mínimo 5 caracteres. Será registrada em auditoria (audit_logs) com data, hora e responsável.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button
              onClick={() => reativar.mutate()}
              disabled={reativar.isPending || motivoReativacao.trim().length < 5}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {reativar.isPending ? "Reativando…" : "Reativar funcionário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-700">
            <UserMinus className="h-5 w-5" />Registrar desligamento — {emp.nome}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data do desligamento *</Label>
              <Input type="date" value={data} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setData(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Motivo *</Label>
              <Select value={motivo} onValueChange={setMotivo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MOTIVOS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {motivo === "Outro" && (
            <div className="space-y-1.5">
              <Label>Especifique o motivo</Label>
              <Input value={motivoOutro} onChange={(e) => setMotivoOutro(e.target.value)} placeholder="Ex.: rescisão indireta…" />
            </div>
          )}

          <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Checklist de saída</Label>
            <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
              {CHECKLIST_ITEMS.map((it) => (
                <label key={it.key} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-accent hover:text-accent-foreground">
                  <Checkbox checked={!!checklist[it.key]} onCheckedChange={(v) => setChecklist((c) => ({ ...c, [it.key]: !!v }))} />
                  <span className="text-sm">{it.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea rows={3} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Pendências, pertences não devolvidos, observações para o RH…" />
          </div>

          <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 space-y-1.5">
            <div className="flex items-center gap-1.5 font-black"><AlertTriangle className="h-3.5 w-3.5" />O que acontece ao confirmar:</div>
            <ul className="list-disc ml-5 space-y-0.5">
              <li>Status passa a <strong>DESLIGADO</strong> e some das listagens de ativos</li>
              <li>Todas as OSs ativas viram <strong>SUBSTITUIDO</strong></li>
              <li>Bloqueio global impede novas emissões (PTE, OS, EPI)</li>
              <li>Todo o histórico (ASOs, PPP, EPIs, treinamentos, OSs) é <strong>preservado</strong></li>
              <li>Exclusão definitiva continua bloqueada — exigida por lei (até 20 anos)</li>
            </ul>
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <Checkbox checked={confirmacao} onCheckedChange={(v) => setConfirmacao(!!v)} />
            <span className="text-xs text-muted-foreground">Confirmo que as informações acima estão corretas e que o processo legal de desligamento foi (ou será) conduzido pelo RH / empresa contratante.</span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => desligar.mutate()}
            disabled={!confirmacao || !data || !motivo || desligar.isPending}
            className="bg-rose-700 hover:bg-rose-800 text-white"
          >
            {desligar.isPending ? "Registrando…" : "Confirmar desligamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}