import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowRight, ArrowRightLeft, Archive, UserCheck, AlertTriangle } from "lucide-react";
import {
  listPendenciasParaTransferencia,
  transferEmployee,
} from "@/lib/employees-transfer.functions";
import { formatDateBR } from "@/lib/utils-date";

type Props = {
  open: boolean;
  onClose: () => void;
  employee: { id: string; nome: string; company_id: string | null };
};

type Decisao =
  | { action: "REASSIGN"; to_employee_id: string }
  | { action: "ARCHIVE" };

export function TransferirEmpresaDialog({ open, onClose, employee }: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [novaEmpresaId, setNovaEmpresaId] = useState("");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [decisoesApr, setDecisoesApr] = useState<Record<string, Decisao>>({});
  const [decisoesPte, setDecisoesPte] = useState<Record<string, Decisao>>({});

  const listPend = useServerFn(listPendenciasParaTransferencia);
  const doTransfer = useServerFn(transferEmployee);

  useEffect(() => {
    if (!open) {
      setStep(1); setNovaEmpresaId(""); setMotivo("");
      setDecisoesApr({}); setDecisoesPte({});
    }
  }, [open]);

  const { data: companies } = useQuery({
    queryKey: ["transfer-companies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const { data: pend, isLoading: loadPend } = useQuery({
    queryKey: ["transfer-pendencias", employee.id],
    queryFn: async () => await listPend({ data: { employee_id: employee.id } }),
    enabled: open && step >= 2,
  });

  // Funcionários ATIVOS da empresa ANTIGA (destino da reatribuição)
  const { data: colegasAntigos } = useQuery({
    queryKey: ["colegas-antigos", employee.company_id],
    queryFn: async () => {
      if (!employee.company_id) return [];
      const { data, error } = await supabase
        .from("employees")
        .select("id, nome")
        .eq("company_id", employee.company_id)
        .eq("status", "ATIVO")
        .neq("id", employee.id)
        .order("nova");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && !!employee.company_id,
  });

  const empresasDestino = useMemo(
    () => (companies ?? []).filter((c: any) => c.id !== employee.company_id),
    [companies, employee.company_id]
  );

  const totalPendencias = (pend?.aprs.length ?? 0) + (pend?.ptes.length ?? 0);
  const totalDecididas = Object.keys(decisoesApr).length + Object.keys(decisoesPte).length;
  const podeConfirmar = totalDecididas === totalPendencias;

  const nomeAntiga = (companies ?? []).find((c: any) => c.id === employee.company_id)?.name ?? "—";
  const nomeNova = (companies ?? []).find((c: any) => c.id === novaEmpresaId)?.name ?? "—";

  async function confirmar() {
    setSaving(true);
    try {
      const decisoes_aprs = (pend?.aprs ?? []).map((a: any) => ({
        assinatura_id: a.assinatura_id,
        apr_id: a.apr_id,
        decision: decisoesApr[a.assinatura_id],
      }));
      const decisoes_ptes = (pend?.ptes ?? []).map((p: any) => ({
        pte_id: p.id,
        decision: decisoesPte[p.id],
      }));
      const res = await doTransfer({
        data: {
          employee_id: employee.id,
          nova_empresa_id: novaEmpresaId,
          motivo: motivo.trim(),
          decisoes_aprs,
          decisoes_ptes,
        },
      });
      toast.success(
        `Transferido. ${res.aprs_reatribuidas + res.ptes_reatribuidas} reatribuídos, ` +
        `${res.aprs_arquivadas + res.ptes_arquivadas} arquivados.`
      );
      qc.invalidateQueries();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro na transferência");
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" /> Transferir Funcionário — Passo {step}/3
          </DialogTitle>
        </DialogHeader>

        {/* PASSO 1 — Destino e motivo */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold">{employee.nome}</span>
              <Badge variant="secondary">{nomeAntiga}</Badge>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground italic">nova empresa a definir</span>
            </div>
            <div>
              <Label>Empresa de destino *</Label>
              <Select value={novaEmpresaId} onValueChange={setNovaEmpresaId}>
                <SelectTrigger><SelectValue placeholder="Selecione a nova empresa" /></SelectTrigger>
                <SelectContent>
                  {empresasDestino.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Motivo da transferência *</Label>
              <Textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex: Realocação para nova frente, mudança de contrato, etc."
                rows={3}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Obrigatório. Fica registrado no histórico e nos documentos arquivados.
              </p>
            </div>
          </div>
        )}

        {/* PASSO 2 — Pendências */}
        {step === 2 && (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {loadPend && <p className="text-sm text-muted-foreground">Carregando pendências…</p>}
            {!loadPend && totalPendencias === 0 && (
              <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
                Nenhuma APR ou PTE aberta vinculada. Pode confirmar direto.
              </div>
            )}

            {(pend?.aprs.length ?? 0) > 0 && (
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-600 mb-2">
                  APRs ({pend?.aprs.length})
                </h4>
                {pend?.aprs.map((a: any) => (
                  <PendenciaRow
                    key={a.assinatura_id}
                    label={`APR ${a.numero ?? "s/nº"} — ${a.papel ?? "papel"} — ${a.data_emissao ? formatDateBR(a.data_emissao) : ""}`}
                    decisao={decisoesApr[a.assinatura_id]}
                    onDecisao={(d) => setDecisoesApr((prev) => ({ ...prev, [a.assinatura_id]: d }))}
                    colegas={colegasAntigos ?? []}
                  />
                ))}
              </div>
            )}

            {(pend?.ptes.length ?? 0) > 0 && (
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-600 mb-2 mt-4">
                  PTEs ({pend?.ptes.length})
                </h4>
                {pend?.ptes.map((p: any) => (
                  <PendenciaRow
                    key={p.id}
                    label={`PTE ${p.numero ?? "s/nº"} — ${p.tipo_pt ?? ""} — ${p.data_emissao ? formatDateBR(p.data_emissao) : ""}`}
                    decisao={decisoesPte[p.id]}
                    onDecisao={(d) => setDecisoesPte((prev) => ({ ...prev, [p.id]: d }))}
                    colegas={colegasAntigos ?? []}
                  />
                ))}
              </div>
            )}

            {!podeConfirmar && totalPendencias > 0 && (
              <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-2 text-xs text-amber-900">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                Cada pendência precisa ter uma decisão (reatribuir a alguém OU arquivar) antes de confirmar.
              </div>
            )}
          </div>
        )}

        {/* PASSO 3 — Revisão */}
        {step === 3 && (
          <div className="space-y-3 text-sm">
            <div className="rounded-md border p-3 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{employee.nome}</span>
                <Badge variant="secondary">{nomeAntiga}</Badge>
                <ArrowRight className="h-4 w-4" />
                <Badge>{nomeNova}</Badge>
              </div>
              <p className="text-xs text-muted-foreground"><b>Motivo:</b> {motivo}</p>
            </div>
            <div className="rounded-md border p-3">
              <p><b>APRs:</b> {Object.values(decisoesApr).filter(d => d.action === "REASSIGN").length} reatribuídas, {Object.values(decisoesApr).filter(d => d.action === "ARCHIVE").length} arquivadas</p>
              <p><b>PTEs:</b> {Object.values(decisoesPte).filter(d => d.action === "REASSIGN").length} reatribuídas, {Object.values(decisoesPte).filter(d => d.action === "ARCHIVE").length} arquivadas</p>
              <p className="text-xs text-muted-foreground mt-2">ASOs, vacinas e atestados seguem com o funcionário (não são alterados).</p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step > 1 && <Button variant="outline" onClick={() => setStep((s) => (s - 1) as any)} disabled={saving}>Voltar</Button>}
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          {step === 1 && (
            <Button
              onClick={() => setStep(2)}
              disabled={!novaEmpresaId || motivo.trim().length < 5}
            >Próximo</Button>
          )}
          {step === 2 && (
            <Button onClick={() => setStep(3)} disabled={!podeConfirmar || loadPend}>Próximo</Button>
          )}
          {step === 3 && (
            <Button onClick={confirmar} disabled={saving}>
              {saving ? "Transferindo…" : "Confirmar Transferência"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PendenciaRow({
  label, decisao, onDecisao, colegas,
}: {
  label: string;
  decisao: Decisao | undefined;
  onDecisao: (d: Decisao) => void;
  colegas: { id: string; nome: string }[];
}) {
  return (
    <div className="rounded-md border p-3 mb-2 space-y-2">
      <div className="text-xs font-medium">{label}</div>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={decisao?.action === "REASSIGN" ? decisao.to_employee_id : ""}
          onValueChange={(v) => onDecisao({ action: "REASSIGN", to_employee_id: v })}
        >
          <SelectTrigger className="w-72 h-8 text-xs">
            <SelectValue placeholder="Reatribuir para…" />
          </SelectTrigger>
          <SelectContent>
            {colegas.length === 0 && <div className="px-2 py-1 text-xs text-muted-foreground">Sem funcionários elegíveis na empresa antiga</div>}
            {colegas.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant={decisao?.action === "ARCHIVE" ? "default" : "outline"}
          onClick={() => onDecisao({ action: "ARCHIVE" })}
          className="h-8 text-xs"
        >
          <Archive className="h-3.5 w-3.5 mr-1" /> Arquivar
        </Button>
        {decisao?.action === "REASSIGN" && (
          <Badge variant="secondary" className="text-[10px]"><UserCheck className="h-3 w-3 mr-1" />Reatribuído</Badge>
        )}
        {decisao?.action === "ARCHIVE" && (
          <Badge variant="destructive" className="text-[10px]">Arquivado</Badge>
        )}
      </div>
    </div>
  );
}