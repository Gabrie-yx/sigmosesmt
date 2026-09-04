import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
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
import { ShieldCheck, Info } from "lucide-react";
import {
  MOTIVO_EPI_OPCOES, expiraEmISO, type MotivoEntregaEpi,
} from "@/lib/epi-autorizacoes";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Quando aberto pela ficha do funcionário, já vem preenchido. */
  employee?: { id: string; nome: string; company_id?: string | null } | null;
};

/**
 * TST / Admin autoriza a entrega de um EPI.
 * Nada sai do estoque aqui — apenas entra na fila do almoxarifado.
 */
export function AutorizarEpiDialog({ open, onOpenChange, employee }: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();

  const [emp, setEmp] = useState<{ id: string; nome: string; company_id?: string | null } | null>(
    employee ?? null,
  );
  const [descricao, setDescricao] = useState("");
  const [estoqueId, setEstoqueId] = useState<string>("");
  const [tamanho, setTamanho] = useState("");
  const [qtd, setQtd] = useState("1");
  const [motivo, setMotivo] = useState<MotivoEntregaEpi>("TROCA_DESGASTE");
  const [previsao, setPrevisao] = useState("");
  const [obs, setObs] = useState("");

  useEffect(() => {
    if (open) {
      setEmp(employee ?? null);
      setDescricao(""); setEstoqueId(""); setTamanho(""); setQtd("1");
      setMotivo("TROCA_DESGASTE"); setPrevisao(""); setObs("");
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

  const selecionado = useMemo(
    () => itens.find((i: any) => i.id === estoqueId) ?? null,
    [itens, estoqueId],
  );

  const salvar = useMutation({
    mutationFn: async () => {
      if (!emp?.id) throw new Error("Selecione o funcionário");
      const desc = (descricao || selecionado?.nome_material || "").trim();
      if (!desc) throw new Error("Informe o EPI autorizado");
      const q = Math.max(1, Number(qtd) || 1);
      const { error } = await (supabase as any).from("epi_autorizacoes").insert({
        employee_id: emp.id,
        company_id: emp.company_id ?? null,
        epi_descricao: desc,
        estoque_epi_id: estoqueId || null,
        tamanho: tamanho || null,
        quantidade: q,
        motivo,
        previsao_devolucao: motivo === "EMPRESTIMO" && previsao ? previsao : null,
        gera_termo: motivo === "PERDA_EXTRAVIO",
        observacoes: obs || null,
        autorizado_por: user?.id ?? null,
        autorizado_por_nome: profile?.full_name || profile?.email || user?.email || null,
        status: "PENDENTE",
        expira_em: expiraEmISO(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["epi_autorizacoes"] });
      toast.success("Entrega autorizada — enviada ao almoxarifado");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Autorizar entrega de EPI
          </DialogTitle>
          <DialogDescription>
            A autorização vai para a fila do almoxarifado. O estoque só é baixado quando o
            almoxarifado registrar a entrega. Validade da autorização: <strong>2 dias</strong>.
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

          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Motivo da entrega
            </Label>
            <Select value={motivo} onValueChange={(v) => setMotivo(v as MotivoEntregaEpi)}>
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
              EPI autorizado (tipo)
            </Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: Bota de segurança, Óculos de proteção, Luva de raspa…"
            />
            <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              Você pode autorizar o tipo genérico e deixar o almoxarifado escolher marca/tamanho
              conforme o que houver em estoque — ou já apontar o item exato abaixo.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Item específico do estoque (opcional)
              </Label>
              <Select
                value={estoqueId || "__none"}
                onValueChange={(v) => {
                  const id = v === "__none" ? "" : v;
                  setEstoqueId(id);
                  const it: any = itens.find((i: any) => i.id === id);
                  if (it && !descricao) setDescricao(it.nome_material);
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
              <Input type="number" min={1} value={qtd} onChange={(e) => setQtd(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Tamanho / variação (opcional)
              </Label>
              <Input
                value={tamanho}
                onChange={(e) => setTamanho(e.target.value)}
                placeholder="Ex.: 41, GG, lente escura"
              />
            </div>
            {motivo === "EMPRESTIMO" && (
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Previsão de devolução
                </Label>
                <Input type="date" value={previsao} onChange={(e) => setPrevisao(e.target.value)} />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Observações {motivo === "PERDA_EXTRAVIO" && "(serão impressas no termo de responsabilidade)"}
            </Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3}
              placeholder="Condição do EPI apresentado, contexto da troca, etc." />
          </div>

          {motivo === "PERDA_EXTRAVIO" && (
            <div className="rounded-lg border-2 border-rose-300 bg-rose-50 p-3 text-xs text-rose-900">
              Esta autorização gera <strong>termo de responsabilidade</strong> no momento da entrega
              pelo almoxarifado.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
            <ShieldCheck className="h-4 w-4 mr-2" />
            {salvar.isPending ? "Autorizando…" : "Autorizar entrega"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
