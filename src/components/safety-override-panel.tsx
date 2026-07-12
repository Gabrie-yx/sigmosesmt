import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Unlock, Lock, ShieldAlert, Plus } from "lucide-react";
import { toast } from "sonner";
import { formatDateBR } from "@/lib/utils-date";
import { type SafetyOverride, filterActiveOverrides } from "@/lib/safety-overrides";

interface Props {
  employeeId: string;
  employeeName?: string;
  /** Lista de chaves de item disponíveis (ex: ["ASO", "INTEGRACAO", "NR-35", "EXAME:Audiometria", "VACINA:Hepatite B"]). */
  availableItemKeys?: string[];
}

export function SafetyOverridePanel({ employeeId, employeeName, availableItemKeys = [] }: Props) {
  const qc = useQueryClient();
  const { isAdmin, user } = useAuth();
  const [openDialog, setOpenDialog] = useState(false);
  const [scope, setScope] = useState<"GLOBAL" | "ITEM">("GLOBAL");
  const [itemKey, setItemKey] = useState<string>("");
  const [justificativa, setJustificativa] = useState("");
  const [validade, setValidade] = useState<"7" | "15" | "30" | "INDEFINIDO">("15");

  const { data: overrides = [] } = useQuery({
    queryKey: ["safety-overrides", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("safety_overrides")
        .select("*")
        .eq("employee_id", employeeId)
        .order("liberado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SafetyOverride[];
    },
  });

  const active = useMemo(() => filterActiveOverrides(overrides), [overrides]);
  const historico = useMemo(
    () => overrides.filter((o) => !active.find((a) => a.id === o.id)),
    [overrides, active],
  );

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sessão expirada");
      if (!justificativa.trim() || justificativa.trim().length < 10) {
        throw new Error("Justificativa deve ter pelo menos 10 caracteres (exigência ISO 9001)");
      }
      if (scope === "ITEM" && !itemKey) throw new Error("Selecione qual exigência liberar");
      const expira_em =
        validade === "INDEFINIDO"
          ? null
          : new Date(Date.now() + parseInt(validade) * 86400000).toISOString();
      const { error } = await supabase.from("safety_overrides").insert({
        employee_id: employeeId,
        scope,
        item_key: scope === "GLOBAL" ? null : itemKey,
        justificativa: justificativa.trim(),
        liberado_por: user.id,
        liberado_por_email: user.email ?? null,
        expira_em,
        ativo: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["safety-overrides", employeeId] });
      qc.invalidateQueries({ queryKey: ["safety-overrides-all"] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Liberação registrada");
      setOpenDialog(false);
      setJustificativa("");
      setItemKey("");
      setScope("GLOBAL");
      setValidade("15");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      if (!user) throw new Error("Sessão expirada");
      const { error } = await supabase
        .from("safety_overrides")
        .update({
          ativo: false,
          revogado_por: user.id,
          revogado_em: new Date().toISOString(),
          motivo_revogacao: motivo,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["safety-overrides", employeeId] });
      qc.invalidateQueries({ queryKey: ["safety-overrides-all"] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Liberação revogada");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function handleRevoke(id: string) {
    const motivo = window.prompt("Motivo da revogação (obrigatório):") ?? "";
    if (motivo.trim().length < 5) {
      toast.error("Motivo obrigatório (mín. 5 caracteres)");
      return;
    }
    revoke.mutate({ id, motivo: motivo.trim() });
  }

  return (
    <Card className="glass-vinho p-4 rounded-2xl h-full flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldAlert className="h-4 w-4 text-amber-300 shrink-0" />
          <span className="text-xs font-black uppercase tracking-widest text-amber-100/90 truncate">
            Liberações Manuais (Override SST)
          </span>
          {active.length > 0 && (
            <Badge className="bg-amber-500/20 text-amber-100 border border-amber-300/30 text-[10px]">
              {active.length} ativa(s)
            </Badge>
          )}
        </div>
        {isAdmin && (
          <Button
            size="sm"
            onClick={() => setOpenDialog(true)}
            className="bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs h-8"
          >
            <Plus className="h-3 w-3 mr-1" /> Liberar
          </Button>
        )}
      </div>

      {active.length === 0 && (
        <div className="text-[11px] text-white/55 italic">
          Nenhuma liberação ativa. Bloqueios padrão aplicados.
        </div>
      )}

      {active.map((o) => (
        <div
          key={o.id}
          className="bg-white/5 rounded-lg p-3 border border-white/10 flex flex-col gap-2 w-full"
        >
          <div className="flex items-center gap-2 flex-wrap w-full">
            <Unlock className="h-4 w-4 text-amber-300 shrink-0" />
            <Badge className="bg-amber-500/15 text-amber-100 border border-amber-300/30 text-[10px] font-black">
              {o.scope === "GLOBAL" ? "TODOS OS BLOQUEIOS" : o.item_key}
            </Badge>
            <span className="text-[10px] text-white/55">
              até {o.expira_em ? formatDateBR(o.expira_em.slice(0, 10)) : "indefinido"}
            </span>
            {isAdmin && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleRevoke(o.id)}
                className="ml-auto text-[10px] h-7 border-rose-300/40 text-rose-200 hover:bg-rose-500/10 bg-transparent"
              >
                <Lock className="h-3 w-3 mr-1" /> Revogar
              </Button>
            )}
          </div>
          <div className="text-xs text-white/85 w-full break-words">{o.justificativa}</div>
          <div className="flex flex-wrap items-center justify-between gap-2 w-full text-[10px] text-white/50">
            <span>Por {o.liberado_por_email ?? "—"}</span>
            <span>em {formatDateBR(o.liberado_em.slice(0, 10))}</span>
          </div>
        </div>
      ))}

      {historico.length > 0 && (
        <details className="mt-1">
          <summary className="text-[10px] font-bold uppercase tracking-widest text-white/55 cursor-pointer">
            Histórico ({historico.length})
          </summary>
          <div className="mt-2 space-y-1">
            {historico.slice(0, 10).map((o) => (
              <div
                key={o.id}
                className="text-[10px] text-white/60 bg-white/5 p-2 rounded border border-white/10"
              >
                <span className="font-bold text-white/80">
                  {o.scope === "GLOBAL" ? "GLOBAL" : o.item_key}
                </span>{" "}
                — {o.justificativa.slice(0, 80)}
                {o.justificativa.length > 80 ? "…" : ""}
                <div className="text-white/45">
                  Revogado{o.revogado_em ? ` em ${formatDateBR(o.revogado_em.slice(0, 10))}` : ""}
                  {o.motivo_revogacao ? ` — ${o.motivo_revogacao}` : ""}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Unlock className="h-5 w-5 text-amber-600" />
              Liberar bloqueios — {employeeName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-[10px] font-black uppercase">Escopo</Label>
              <Select value={scope} onValueChange={(v: any) => setScope(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="GLOBAL">Liberar TODOS os bloqueios</SelectItem>
                  <SelectItem value="ITEM">Liberar apenas 1 exigência</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {scope === "ITEM" && (
              <div>
                <Label className="text-[10px] font-black uppercase">Exigência</Label>
                <Select value={itemKey} onValueChange={setItemKey}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {availableItemKeys.length === 0 && <SelectItem value="ASO">ASO</SelectItem>}
                    {availableItemKeys.map((k) => (
                      <SelectItem key={k} value={k}>{k}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-[10px] font-black uppercase">Validade</Label>
              <Select value={validade} onValueChange={(v: any) => setValidade(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 dias</SelectItem>
                  <SelectItem value="15">15 dias</SelectItem>
                  <SelectItem value="30">30 dias</SelectItem>
                  <SelectItem value="INDEFINIDO">Indefinido (até revogar)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] font-black uppercase">Justificativa (mín. 10 caracteres) *</Label>
              <Textarea
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                rows={4}
                placeholder="Ex: Aguardando agendamento de exame periódico — autorização do gerente de operações para manter atividade no pátio."
              />
            </div>
            <div className="text-[10px] text-amber-700 bg-amber-100 p-2 rounded border border-amber-300">
              ⚠ Esta liberação será registrada no log de auditoria com seu nome, data/hora e justificativa.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(false)}>Cancelar</Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending} className="bg-amber-600 hover:bg-amber-700 text-white">
              Confirmar Liberação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}