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
import { PenLine, Check, UserPlus, Pencil } from "lucide-react";

type SignatureTarget = "FUNC" | "SESMT" | "SUPERVISOR";

const emptyForm = () => ({
  company_id: "", employee_ids: [] as string[], data: new Date().toISOString().slice(0, 10),
  horario_saida: "", tipo: "PESSOAL", com_retorno: false,
  horario_retorno: "", motivo: "", observacao: "",
  assinatura_funcionario: null,
  assinatura_sesmt: null,
  assinatura_supervisor: null,
});

export function SaidaExpedienteDialog({
  open, onOpenChange, editId, duplicateData,
}: { 
  open: boolean; 
  onOpenChange: (b: boolean) => void; 
  editId: string | null;
  duplicateData?: any;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [form, setForm] = useState<any>(emptyForm);
  const [sigOpen, setSigOpen] = useState<SignatureTarget | null>(null);
  const [employeeSearch, setEmployeeSearch] = useState("");

  const { data: companies } = useQuery({
    queryKey: ["companies-min"],
    queryFn: async () => (await supabase.from("companies").select("id,name,type,encarregado1,encarregado2").order("name")).data ?? [],
  });

  const { data: employees, isFetching: loadingEmployees } = useQuery({
    queryKey: ["employees-by-company", form.company_id],
    enabled: !!form.company_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("employees")
        .select("id,nome,cpf,rg,role_id,status,company_id")
        .eq("status","ATIVO")
        .eq("company_id", form.company_id)
        .order("nome");
      if (error) {
        console.error("[SaidaExpediente] erro ao carregar funcionários:", error);
        toast.error("Erro ao carregar funcionários: " + error.message);
        return [];
      }
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!open) return;
    setEmployeeSearch("");
    if (editId) {
      supabase.from("employee_saidas_expediente").select("*").eq("id", editId).maybeSingle().then(({ data }) => {
        if (data) setForm({ ...data, employee_ids: [data.employee_id] });
      });
    } else if (duplicateData) {
      setForm({
        ...emptyForm(),
        ...duplicateData,
        data: new Date().toISOString().slice(0, 10),
        assinatura_funcionario: null,
        assinatura_sesmt: null,
        assinatura_supervisor: null,
      });
    } else {
      setForm(emptyForm());
    }
  }, [open, editId, duplicateData]);

  const selectedCompany = (companies ?? []).find((c: any) => c.id === form.company_id);
  const supervisorLabel = selectedCompany?.type === "TERCEIRIZADO" ? "Encarregado" : "Supervisor Geral";

  const save = useMutation({
    mutationFn: async () => {
      if (!form.company_id) throw new Error("Selecione a empresa");
      if (!form.employee_ids || form.employee_ids.length === 0) throw new Error("Selecione pelo menos um funcionário");
      if (!form.horario_saida) throw new Error("Informe o horário de saída");
      if (form.com_retorno && !form.horario_retorno) throw new Error("Informe o horário de retorno");

      const basePayload: any = {
        company_id: form.company_id, data: form.data,
        horario_saida: form.horario_saida, tipo: form.tipo,
        com_retorno: !!form.com_retorno,
        horario_retorno: form.com_retorno ? form.horario_retorno : null,
        motivo: form.motivo || null, observacao: form.observacao || null,
        assinatura_sesmt: form.assinatura_sesmt || null,
        assinatura_supervisor: form.assinatura_supervisor || null,
      };

      if (form.assinatura_sesmt) {
        basePayload.assinado_sesmt_por = user?.id ?? null;
        basePayload.assinado_sesmt_em = new Date().toISOString();
      }
      if (form.assinatura_supervisor) {
        basePayload.assinado_supervisor_por = user?.id ?? null;
        basePayload.assinado_supervisor_em = new Date().toISOString();
      }

      if (editId) {
        const { error } = await supabase.from("employee_saidas_expediente")
          .update({ ...basePayload, employee_id: form.employee_ids[0], assinatura_funcionario: form.assinatura_funcionario })
          .eq("id", editId);
        if (error) throw error;
      } else {
        const inserts = form.employee_ids.map((empId: string) => ({
          ...basePayload,
          employee_id: empId,
          created_by: user?.id ?? null,
          // Em saídas coletivas, a assinatura do funcionário geralmente é feita individualmente depois, 
          // mas se houver uma no form (improvável em coletiva), aplicamos a todos.
          assinatura_funcionario: form.assinatura_funcionario || null,
        }));
        const { error } = await supabase.from("employee_saidas_expediente").insert(inserts);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editId ? "Autorização atualizada" : "Autorização(ões) registrada(s)");
      qc.invalidateQueries({ queryKey: ["saidas-expediente"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const renderSignatureOption = (target: SignatureTarget, label: string, value: string | null | undefined) => (
    <div className="flex flex-col rounded-lg border border-white/10 bg-white/[0.03] p-2 min-w-0">
      <div className="flex items-center justify-between gap-1.5">
        <Label className="text-[10px] font-bold uppercase tracking-wide truncate">{label}</Label>
        {value && <span className="text-[10px] text-emerald-300 font-bold inline-flex items-center gap-0.5 shrink-0"><Check className="h-3 w-3" /> OK</span>}
      </div>
      {value ? (
        <div className="mt-1.5 flex items-center gap-1.5">
          <img src={value} alt={`Assinatura ${label}`} className="h-10 flex-1 min-w-0 bg-white/90 border border-white/10 rounded px-1 object-contain" />
          <div className="flex flex-col gap-0.5 shrink-0">
            <Button type="button" size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]" onClick={() => setSigOpen(target)}>Refazer</Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 px-1.5 text-[10px] text-rose-300 hover:text-rose-200"
              onClick={() => setForm((f: any) => ({ ...f, [target === "FUNC" ? "assinatura_funcionario" : target === "SESMT" ? "assinatura_sesmt" : "assinatura_supervisor"]: null }))}
            >
              Remover
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" size="sm" variant="outline" className="mt-1.5 h-8 text-[11px] w-full" onClick={() => setSigOpen(target)}>
          <PenLine className="h-3 w-3 mr-1" />Inserir
        </Button>
      )}
    </div>
  );

  const normalizedEmployeeSearch = employeeSearch.trim().toLowerCase();
  const filteredEmployees = (employees ?? []).filter((employee: any) => {
    if (!normalizedEmployeeSearch) return true;
    return [employee.nome, employee.cpf, employee.rg]
      .filter(Boolean)
      .some((value: string) => value.toLowerCase().includes(normalizedEmployeeSearch));
  });
  const selectedEmployeeIds = form.employee_ids ?? [];
  const toggleEmployee = (employeeId: string) => {
    setForm((current: any) => {
      const currentIds = current.employee_ids ?? [];
      const nextIds = currentIds.includes(employeeId)
        ? currentIds.filter((id: string) => id !== employeeId)
        : [...currentIds, employeeId];
      return { ...current, employee_ids: nextIds };
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[calc(100vw-2rem)] max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {editId ? <Pencil className="h-5 w-5 text-brand" /> : <UserPlus className="h-5 w-5 text-brand" />}
            {editId ? "Editar autorização" : "Nova autorização (Individual ou Coletiva)"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-500">Empresa que está liberando *</Label>
            <Select value={form.company_id} onValueChange={(v) => { setEmployeeSearch(""); setForm({ ...form, company_id: v, employee_ids: [] }); }}>
              <SelectTrigger className="rounded-xl border-slate-200"><SelectValue placeholder="Selecione a empresa..." /></SelectTrigger>
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
            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-500">Funcionário(s) *</Label>
            <div className="rounded-xl border border-slate-200 bg-background/60 p-2 shadow-sm">
              <Input
                disabled={!form.company_id}
                value={employeeSearch}
                onChange={(event) => setEmployeeSearch(event.target.value)}
                placeholder={form.company_id ? "Buscar por nome, CPF ou RG..." : "Escolha a empresa primeiro"}
                className="h-9 rounded-lg text-sm"
              />
              <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-slate-200/70 bg-background">
                {!form.company_id ? (
                  <div className="px-3 py-3 text-xs font-semibold text-slate-500">Selecione uma empresa para listar os funcionários.</div>
                ) : loadingEmployees ? (
                  <div className="px-3 py-3 text-xs font-semibold text-slate-500">Carregando funcionários...</div>
                ) : filteredEmployees.length === 0 ? (
                  <div className="px-3 py-3 text-xs font-semibold text-slate-500">Nenhum funcionário ativo encontrado.</div>
                ) : (
                  filteredEmployees.map((employee: any) => {
                    const checked = selectedEmployeeIds.includes(employee.id);
                    return (
                      <button
                        key={employee.id}
                        type="button"
                        onClick={() => toggleEmployee(employee.id)}
                        className={`flex w-full items-center gap-2 border-b border-slate-100 px-3 py-2 text-left text-sm transition last:border-b-0 ${checked ? "bg-rose-50 text-rose-950" : "hover:bg-slate-50"}`}
                      >
                        <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked ? "border-brand bg-brand text-white" : "border-slate-300"}`}>
                          {checked && <Check className="h-3 w-3" />}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-semibold">{employee.nome}</span>
                      </button>
                    );
                  })
                )}
              </div>
              {selectedEmployeeIds.length > 0 && (
                <div className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  {selectedEmployeeIds.length} funcionário(s) selecionado(s)
                </div>
              )}
            </div>
            {!editId && form.employee_ids.length > 1 && (
              <p className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded">
                Atenção: Será gerada uma autorização individual para cada funcionário selecionado.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-[11px] font-black uppercase tracking-widest text-slate-500">Data *</Label>
              <Input type="date" className="rounded-xl" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} />
            </div>
            <div className="space-y-1.5"><Label className="text-[11px] font-black uppercase tracking-widest text-slate-500">Horário de saída *</Label>
              <Input type="time" className="rounded-xl" value={form.horario_saida} onChange={(e) => setForm({ ...form, horario_saida: e.target.value })} />
            </div>
          </div>
          <div className={`grid gap-3 items-end ${form.com_retorno ? "grid-cols-3" : "grid-cols-2"}`}>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-black uppercase tracking-widest text-slate-500">Tipo *</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger className="rounded-xl border-slate-200"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PESSOAL">Assuntos pessoais</SelectItem>
                  <SelectItem value="SERVICO">A serviço da empresa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-black uppercase tracking-widest text-slate-500">Retorno</Label>
              <Select value={form.com_retorno ? "SIM" : "NAO"} onValueChange={(v) => setForm({ ...form, com_retorno: v === "SIM" })}>
                <SelectTrigger className="rounded-xl border-slate-200"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NAO">Sem retorno</SelectItem>
                  <SelectItem value="SIM">Com retorno</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.com_retorno && (
              <div className="space-y-1.5"><Label className="text-[11px] font-black uppercase tracking-widest text-slate-500">Horário de retorno *</Label>
                <Input type="time" className="rounded-xl" value={form.horario_retorno ?? ""} onChange={(e) => setForm({ ...form, horario_retorno: e.target.value })} />
              </div>
            )}
          </div>
          <div className="space-y-1.5"><Label className="text-[11px] font-black uppercase tracking-widest text-slate-500">Motivo</Label>
            <Textarea rows={3} className="rounded-xl" value={form.motivo ?? ""} onChange={(e) => setForm({ ...form, motivo: e.target.value })} placeholder="Ex.: dor de cabeça forte, foi ao médico..." />
          </div>
          <div className="space-y-1.5"><Label className="text-[11px] font-black uppercase tracking-widest text-slate-500">Observação interna</Label>
            <Textarea rows={2} className="rounded-xl" value={form.observacao ?? ""} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
          </div>
          <div className="space-y-2 pt-2 border-t border-white/10">
            <Label className="text-[11px] font-black uppercase tracking-widest text-slate-500">Assinaturas do documento</Label>
            <div className={`grid gap-2 ${editId ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"}`}>
              {renderSignatureOption("SESMT", "TST/SESMT", form.assinatura_sesmt)}
              {editId && renderSignatureOption("FUNC", "Funcionário", form.assinatura_funcionario)}
              {renderSignatureOption("SUPERVISOR", supervisorLabel, form.assinatura_supervisor)}
            </div>
            <p className="text-[10px] text-slate-500 font-medium italic">Opcional — cada assinatura é independente e pode ser coletada individualmente no PDF depois.</p>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" className="rounded-xl font-bold uppercase tracking-widest text-[10px]" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="rounded-xl font-bold uppercase tracking-widest text-[10px] bg-brand hover:bg-brand/90 text-white" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Salvando..." : "Salvar autorização"}</Button>
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