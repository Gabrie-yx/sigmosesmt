import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { newId } from "@/lib/uuid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { EmployeePicker, type EmployeeOption } from "@/components/employee-picker";
import { ShieldCheck, Info, Plus, Trash2 } from "lucide-react";
import {
  MOTIVO_EPI_OPCOES, expiraEmISO, type MotivoEntregaEpi,
} from "@/lib/epi-autorizacoes";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Quando aberto pela ficha do funcionário, já vem preenchido. */
  employee?: { id: string; nome: string; company_id?: string | null } | null;
};

type LinhaItem = {
  key: string;
  descricao: string;
  estoqueId: string;
  tamanho: string;
  qtd: string;
  motivo: MotivoEntregaEpi;
  previsao: string;
};

function novaLinha(): LinhaItem {
  return {
    key: newId(),
    descricao: "",
    estoqueId: "",
    tamanho: "",
    qtd: "1",
    motivo: "TROCA_DESGASTE",
    previsao: "",
  };
}

/**
 * TST / Admin autoriza a entrega de um ou vários EPIs para o mesmo funcionário.
 * Nada sai do estoque aqui — cada item entra na fila do almoxarifado.
 */
export function AutorizarEpiDialog({ open, onOpenChange, employee }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();

  const [emp, setEmp] = useState<{ id: string; nome: string; company_id?: string | null } | null>(
    employee ?? null,
  );
  const [linhas, setLinhas] = useState<LinhaItem[]>([novaLinha()]);
  const [obs, setObs] = useState("");

  useEffect(() => {
    if (open) {
      setEmp(employee ?? null);
      setLinhas([novaLinha()]);
      setObs("");
    }
  }, [open, employee]);

  const { data: itens = [] } = useQuery({
    queryKey: ["estoque_epi_opcoes"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque_epi")
        .select("id, nome_material, ca, quantidade_atual")
        .order("nome_material");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["meu-nome-perfil", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("profiles").select("full_name, email").eq("id", user!.id).maybeSingle();
      return data as { full_name?: string | null; email?: string | null } | null;
    },
  });

  const setLinha = (key: string, patch: Partial<LinhaItem>) =>
    setLinhas((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const validas = useMemo(
    () => linhas.filter((l) => (l.descricao || itens.find((i: any) => i.id === l.estoqueId)?.nome_material || "").trim()),
    [linhas, itens],
  );

  const salvar = useMutation({
    mutationFn: async () => {
      if (!emp?.id) throw new Error("Selecione o funcionário");
      const payload = linhas.map((l) => {
        const it: any = itens.find((i: any) => i.id === l.estoqueId);
        const desc = (l.descricao || it?.nome_material || "").trim();
        return { l, desc };
      }).filter((x) => x.desc);
      if (!payload.length) throw new Error("Informe ao menos um EPI autorizado");

      const rows = payload.map(({ l, desc }) => ({
        employee_id: emp.id,
        company_id: emp.company_id ?? null,
        epi_descricao: desc,
        estoque_epi_id: l.estoqueId || null,
        tamanho: l.tamanho || null,
        quantidade: Math.max(1, Number(l.qtd) || 1),
        motivo: l.motivo,
        previsao_devolucao: l.motivo === "EMPRESTIMO" && l.previsao ? l.previsao : null,
        gera_termo: l.motivo === "PERDA_EXTRAVIO",
        observacoes: obs || null,
        autorizado_por: user?.id ?? null,
        autorizado_por_nome: profile?.full_name || profile?.email || user?.email || null,
        status: "PENDENTE",
        expira_em: expiraEmISO(),
      }));

      const { error } = await (supabase as any).from("epi_autorizacoes").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["epi_autorizacoes"] });
      toast.success(
        n === 1
          ? "Entrega autorizada — enviada ao almoxarifado"
          : `${n} itens autorizados — enviados ao almoxarifado`,
      );
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Autorizar entrega de EPI
          </DialogTitle>
          <DialogDescription>
            Você pode autorizar <strong>vários EPIs de uma vez</strong> para o mesmo funcionário.
            O estoque só é baixado quando o almoxarifado registrar cada entrega.
            Validade da autorização: <strong>2 dias</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Funcionário
            </Label>
            {employee ? (
              <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm font-semibold">
                {employee.nome}
              </div>
            ) : (
              <EmployeePicker
                value={emp?.nome ?? ""}
                onSelect={(e: EmployeeOption) =>
                  setEmp({ id: e.id, nome: e.nome, company_id: e.company_id })}
                onClear={() => setEmp(null)}
              />
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                EPIs autorizados ({validas.length})
              </Label>
              <Button
                type="button" size="sm" variant="outline"
                onClick={() => setLinhas((ls) => [...ls, novaLinha()])}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar EPI
              </Button>
            </div>

            {linhas.map((l, idx) => (
              <div key={l.key} className="rounded-xl border bg-muted/20 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Item {idx + 1}
                  </span>
                  {linhas.length > 1 && (
                    <Button
                      type="button" size="sm" variant="ghost"
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setLinhas((ls) => ls.filter((x) => x.key !== l.key))}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Remover
                    </Button>
                  )}
                </div>

                <Input
                  value={l.descricao}
                  onChange={(e) => setLinha(l.key, { descricao: e.target.value })}
                  placeholder="EPI (tipo). Ex.: Protetor auditivo, Luva de raspa, Bota de segurança…"
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2 space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Item específico do estoque (opcional)
                    </Label>
                    <Select
                      value={l.estoqueId || "__none"}
                      onValueChange={(v) => {
                        const id = v === "__none" ? "" : v;
                        const it: any = itens.find((i: any) => i.id === id);
                        setLinha(l.key, {
                          estoqueId: id,
                          descricao: l.descricao || (it?.nome_material ?? ""),
                        });
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Deixar a critério do almoxarifado" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">Deixar a critério do almoxarifado</SelectItem>
                        {itens.map((i: any) => (
                          <SelectItem key={i.id} value={i.id}>
                            {i.nome_material} · saldo {i.quantidade_atual ?? 0}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Quantidade
                    </Label>
                    <Input
                      type="number" min={1} value={l.qtd}
                      onChange={(e) => setLinha(l.key, { qtd: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2 space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Motivo da entrega
                    </Label>
                    <Select
                      value={l.motivo}
                      onValueChange={(v) => setLinha(l.key, { motivo: v as MotivoEntregaEpi })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MOTIVO_EPI_OPCOES.map((m) => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Tamanho / variação
                    </Label>
                    <Input
                      value={l.tamanho}
                      onChange={(e) => setLinha(l.key, { tamanho: e.target.value })}
                      placeholder="Ex.: 41, GG"
                    />
                  </div>
                </div>

                {l.motivo === "EMPRESTIMO" && (
                  <div className="space-y-1.5 md:max-w-[240px]">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      Previsão de devolução
                    </Label>
                    <Input
                      type="date" value={l.previsao}
                      onChange={(e) => setLinha(l.key, { previsao: e.target.value })}
                    />
                  </div>
                )}

                {l.motivo === "PERDA_EXTRAVIO" && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-[11px] text-foreground">
                    Este item gera <strong>termo de responsabilidade</strong> na entrega.
                  </div>
                )}
              </div>
            ))}

            <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              O almoxarifado dá baixa item por item da lista — cada entrega gera sua própria
              assinatura na ficha do colaborador (FOR-SEG_02).
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Observações (aplicam-se a todos os itens)
            </Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3}
              placeholder="Condição do EPI apresentado, contexto da troca, etc." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending || !validas.length}>
            <ShieldCheck className="h-4 w-4 mr-2" />
            {salvar.isPending
              ? "Autorizando…"
              : `Autorizar ${validas.length > 1 ? `${validas.length} itens` : "entrega"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
