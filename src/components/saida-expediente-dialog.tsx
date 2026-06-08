import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export function SaidaExpedienteDialog({
  open, onOpenChange, editId,
}: { open: boolean; onOpenChange: (b: boolean) => void; editId: string | null }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [form, setForm] = useState<any>({
    employee_id: "", data: new Date().toISOString().slice(0, 10),
    horario_saida: "", tipo: "PESSOAL", com_retorno: false,
    horario_retorno: "", motivo: "", observacao: "",
  });

  const { data: employees } = useQuery({
    queryKey: ["employees-min"],
    queryFn: async () => (await supabase.from("employees").select("id,nome,cpf,rg,role_id,status").eq("status","ATIVO").order("nome")).data ?? [],
  });

  useEffect(() => {
    if (!open) return;
    if (editId) {
      supabase.from("employee_saidas_expediente").select("*").eq("id", editId).maybeSingle().then(({ data }) => {
        if (data) setForm(data);
      });
    } else {
      setForm({
        employee_id: "", data: new Date().toISOString().slice(0,10),
        horario_saida: "", tipo: "PESSOAL", com_retorno: false,
        horario_retorno: "", motivo: "", observacao: "",
      });
    }
  }, [open, editId]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.employee_id) throw new Error("Selecione o funcionário");
      if (!form.horario_saida) throw new Error("Informe o horário de saída");
      if (form.com_retorno && !form.horario_retorno) throw new Error("Informe o horário de retorno");
      const payload: any = {
        employee_id: form.employee_id, data: form.data,
        horario_saida: form.horario_saida, tipo: form.tipo,
        com_retorno: !!form.com_retorno,
        horario_retorno: form.com_retorno ? form.horario_retorno : null,
        motivo: form.motivo || null, observacao: form.observacao || null,
      };
      if (editId) {
        const { error } = await supabase.from("employee_saidas_expediente").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        payload.created_by = user?.id ?? null;
        const { error } = await supabase.from("employee_saidas_expediente").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editId ? "Autorização atualizada" : "Autorização registrada");
      qc.invalidateQueries({ queryKey: ["saidas-expediente"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{editId ? "Editar autorização" : "Nova autorização de saída"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Funcionário *</Label>
            <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent className="max-h-72">
                {(employees ?? []).map((e: any) => (
                  <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Data *</Label>
              <Input type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
            </div>
            <div className="space-y-1.5"><Label>Horário de saída *</Label>
              <Input type="time" value={form.horario_saida} onChange={(e) => setForm({ ...form, horario_saida: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Tipo *</Label>
            <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PESSOAL">Assuntos pessoais</SelectItem>
                <SelectItem value="SERVICO">A serviço da empresa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3 items-end">
            <div className="space-y-1.5">
              <Label>Retorno</Label>
              <Select value={form.com_retorno ? "SIM" : "NAO"} onValueChange={(v) => setForm({ ...form, com_retorno: v === "SIM" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NAO">Sem retorno</SelectItem>
                  <SelectItem value="SIM">Com retorno</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.com_retorno && (
              <div className="space-y-1.5"><Label>Horário de retorno *</Label>
                <Input type="time" value={form.horario_retorno ?? ""} onChange={(e) => setForm({ ...form, horario_retorno: e.target.value })} />
              </div>
            )}
          </div>
          <div className="space-y-1.5"><Label>Motivo</Label>
            <Textarea rows={3} value={form.motivo ?? ""} onChange={(e) => setForm({ ...form, motivo: e.target.value })} placeholder="Ex.: dor de cabeça forte, foi ao médico..." />
          </div>
          <div className="space-y-1.5"><Label>Observação interna</Label>
            <Textarea rows={2} value={form.observacao ?? ""} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}