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
import { SignaturePadDialog } from "@/components/signature-pad-dialog";
import { PenLine, Check } from "lucide-react";

type SignatureTarget = "FUNC" | "SESMT" | "SUPERVISOR";

const emptyForm = () => ({
  company_id: "", employee_id: "", data: new Date().toISOString().slice(0, 10),
  horario_saida: "", tipo: "PESSOAL", com_retorno: false,
  horario_retorno: "", motivo: "", observacao: "",
  assinatura_funcionario: null,
  assinatura_sesmt: null,
  assinatura_supervisor: null,
});

export function SaidaExpedienteDialog({
  open, onOpenChange, editId,
}: { open: boolean; onOpenChange: (b: boolean) => void; editId: string | null }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [form, setForm] = useState<any>(emptyForm);
  const [sigOpen, setSigOpen] = useState<SignatureTarget | null>(null);

  const { data: companies } = useQuery({
    queryKey: ["companies-min"],
    queryFn: async () => (await supabase.from("companies").select("id,name,type,encarregado1,encarregado2").order("name")).data ?? [],
  });

  const { data: employees } = useQuery({
    queryKey: ["employees-by-company", form.company_id],
    enabled: !!form.company_id,
    queryFn: async () => (await supabase.from("employees")
      .select("id,nome,cpf,rg,role_id,status,company_id")
      .eq("status","ATIVO")
      .eq("company_id", form.company_id)
      .order("nome")).data ?? [],
  });

  useEffect(() => {
    if (!open) return;
    if (editId) {
      supabase.from("employee_saidas_expediente").select("*").eq("id", editId).maybeSingle().then(({ data }) => {
        if (data) setForm(data);
      });
    } else {
      setForm(emptyForm());
    }
  }, [open, editId]);

  const selectedCompany = (companies ?? []).find((c: any) => c.id === form.company_id);
  const supervisorLabel = selectedCompany?.type === "TERCEIRIZADO" ? "Encarregado" : "Supervisor Geral";

  const save = useMutation({
    mutationFn: async () => {
      if (!form.company_id) throw new Error("Selecione a empresa");
      if (!form.employee_id) throw new Error("Selecione o funcionário");
      if (!form.horario_saida) throw new Error("Informe o horário de saída");
      if (form.com_retorno && !form.horario_retorno) throw new Error("Informe o horário de retorno");
      const payload: any = {
        company_id: form.company_id, employee_id: form.employee_id, data: form.data,
        horario_saida: form.horario_saida, tipo: form.tipo,
        com_retorno: !!form.com_retorno,
        horario_retorno: form.com_retorno ? form.horario_retorno : null,
        motivo: form.motivo || null, observacao: form.observacao || null,
        assinatura_funcionario: form.assinatura_funcionario || null,
        assinatura_sesmt: form.assinatura_sesmt || null,
        assinatura_supervisor: form.assinatura_supervisor || null,
      };
      if (form.assinatura_sesmt) {
        payload.assinado_sesmt_por = user?.id ?? null;
        payload.assinado_sesmt_em = new Date().toISOString();
      } else {
        payload.assinado_sesmt_por = null;
        payload.assinado_sesmt_em = null;
      }
      if (form.assinatura_supervisor) {
        payload.assinado_supervisor_por = user?.id ?? null;
        payload.assinado_supervisor_em = new Date().toISOString();
      } else {
        payload.assinado_supervisor_por = null;
        payload.assinado_supervisor_em = null;
      }
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

  const renderSignatureOption = (target: SignatureTarget, label: string, value: string | null | undefined) => (
    <div className="rounded-lg border bg-slate-50 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-bold">{label}</Label>
        {value && <span className="text-xs text-emerald-700 font-bold inline-flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Assinado</span>}
      </div>
      {value ? (
        <div className="mt-2 flex items-center gap-3">
          <img src={value} alt={`Assinatura ${label}`} className="h-14 max-w-40 bg-white border rounded px-2 object-contain" />
          <div className="ml-auto flex gap-1">
            <Button type="button" size="sm" variant="ghost" onClick={() => setSigOpen(target)}>Refazer</Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setForm((f: any) => ({ ...f, [target === "FUNC" ? "assinatura_funcionario" : target === "SESMT" ? "assinatura_sesmt" : "assinatura_supervisor"]: null }))}
            >
              Remover
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => setSigOpen(target)}>
          <PenLine className="h-3.5 w-3.5 mr-1.5" />Inserir assinatura
        </Button>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{editId ? "Editar autorização" : "Nova autorização de saída"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Empresa que está liberando *</Label>
            <Select value={form.company_id} onValueChange={(v) => setForm({ ...form, company_id: v, employee_id: "" })}>
              <SelectTrigger><SelectValue placeholder="Selecione a empresa..." /></SelectTrigger>
              <SelectContent className="max-h-72">
                {(companies ?? []).map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} {c.type === "TERCEIRIZADO" ? "· Terceirizada" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Funcionário *</Label>
            <Select value={form.employee_id} onValueChange={(v) => setForm({ ...form, employee_id: v })} disabled={!form.company_id}>
              <SelectTrigger><SelectValue placeholder={form.company_id ? "Selecione..." : "Escolha a empresa primeiro"} /></SelectTrigger>
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
          <div className="space-y-2 pt-2 border-t">
            <Label>Assinaturas do documento</Label>
            {renderSignatureOption("SESMT", "Minha assinatura — TST/SESMT", form.assinatura_sesmt)}
            {renderSignatureOption("FUNC", "Assinatura do funcionário", form.assinatura_funcionario)}
            {renderSignatureOption("SUPERVISOR", `Assinatura do ${supervisorLabel}`, form.assinatura_supervisor)}
            <p className="text-[11px] text-slate-500">Opcional — cada assinatura é independente e pode ser removida/refeita antes de salvar.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
      <SignaturePadDialog
        open={!!sigOpen}
        onClose={() => setSigOpen(null)}
        onConfirm={(r) => {
          const target = sigOpen;
          setSigOpen(null);
          if (!target) return;
          const field = target === "FUNC" ? "assinatura_funcionario" : target === "SESMT" ? "assinatura_sesmt" : "assinatura_supervisor";
          setForm((f: any) => ({ ...f, [field]: r.dataUrl }));
        }}
        title={sigOpen === "FUNC" ? "Assinatura do funcionário" : sigOpen === "SESMT" ? "Assinatura do TST/SESMT" : `Assinatura do ${supervisorLabel}`}
      />
    </Dialog>
  );
}