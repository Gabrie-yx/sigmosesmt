import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wizard, type WizardStep } from "@/components/wizard";
import { maskCPF, maskCNPJ } from "@/lib/masks";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultCompanyId?: string;
};

export function NewEmployeeDialog({ open, onOpenChange, defaultCompanyId }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>({ nome: "", cpf: "", matricula: "", status: "ATIVO", company_id: defaultCompanyId ?? "", role_id: "", tipo_cadastro: "NAO_MEI", cnpj: "" });

  useEffect(() => {
    if (open) {
      setForm({ nome: "", cpf: "", matricula: "", status: "ATIVO", company_id: defaultCompanyId ?? "", role_id: "", tipo_cadastro: "NAO_MEI", cnpj: "" });
    }
  }, [open, defaultCompanyId]);

  const { data: companies } = useQuery({
    queryKey: ["companies-with-type"],
    queryFn: async () => (await supabase.from("companies").select("id,name,type").order("name")).data ?? [],
  });
  const { data: roles } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => (await supabase.from("roles").select("id,name").order("name")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async (v: any) => {
      const { error } = await supabase.from("employees").insert({
        nome: v.nome,
        cpf: v.cpf || null,
        matricula: v.matricula || null,
        status: v.status,
        company_id: v.company_id || null,
        role_id: v.role_id || null,
        tipo_cadastro: v.tipo_cadastro || "NAO_MEI",
        cnpj: v.tipo_cadastro === "MEI" ? (v.cnpj || null) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["employees-light"] });
      onOpenChange(false);
      toast.success("Funcionário criado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const selectedCompany = useMemo(() => (companies ?? []).find((c: any) => c.id === form.company_id), [companies, form.company_id]);
  const cName = selectedCompany?.name ?? "—";
  const isTerceiro = selectedCompany?.type === "TERCEIRIZADO";
  const rName = (roles ?? []).find((r: any) => r.id === form.role_id)?.name ?? "—";

  const steps: WizardStep[] = [
    {
      id: "dados",
      title: "Dados pessoais",
      description: "Identificação básica do funcionário.",
      isValid: () => form.nome.trim().length > 0,
      invalidMessage: "Informe o nome.",
      content: (
        <div className="space-y-3">
          <div className="space-y-2"><Label>Nome *</Label><Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>CPF</Label><Input inputMode="numeric" placeholder="000.000.000-00" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: maskCPF(e.target.value) })} /></div>
            <div className="space-y-2"><Label>Matrícula</Label><Input value={form.matricula} onChange={(e) => setForm({ ...form, matricula: e.target.value })} /></div>
          </div>
        </div>
      ),
    },
    {
      id: "vinculo",
      title: "Vínculo",
      description: "Empresa, cargo e situação.",
      content: (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Select value={form.company_id} onValueChange={(v) => setForm({ ...form, company_id: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{(companies ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}{c.type === "TERCEIRIZADO" ? " · TERCEIRO" : ""}</SelectItem>)}</SelectContent>
              </Select>
              {isTerceiro && (
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700">Vínculo: TERCEIRO</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Cargo</Label>
              <Select value={form.role_id} onValueChange={(v) => setForm({ ...form, role_id: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{(roles ?? []).map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ATIVO">ATIVO</SelectItem>
                <SelectItem value="INATIVO">INATIVO</SelectItem>
                <SelectItem value="AFASTADO">AFASTADO</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo de cadastro</Label>
              <Select value={form.tipo_cadastro} onValueChange={(v) => setForm({ ...form, tipo_cadastro: v, cnpj: v === "MEI" ? form.cnpj : "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NAO_MEI">CLT</SelectItem>
                  <SelectItem value="MEI">MEI</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.tipo_cadastro === "MEI" && (
              <div className="space-y-2">
                <Label>CNPJ (MEI)</Label>
                <Input inputMode="numeric" maxLength={18} placeholder="00.000.000/0000-00" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: maskCNPJ(e.target.value) })} />
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      id: "revisao",
      title: "Revisão",
      description: "Confirme os dados antes de salvar.",
      content: (
        <dl className="rounded-xl border border-slate-200 bg-slate-50/60 divide-y divide-slate-200 text-sm">
          {[
            ["Nome", form.nome || "—"],
            ["CPF", form.cpf || "—"],
            ["Matrícula", form.matricula || "—"],
            ["Empresa", cName],
            ["Cargo", rName],
            ["Status", form.status],
            ["Vínculo", isTerceiro ? "TERCEIRO" : "PRÓPRIO (DMN)"],
            ["Tipo", form.tipo_cadastro === "MEI" ? "MEI" : "CLT"],
            ...(form.tipo_cadastro === "MEI" ? [["CNPJ MEI", form.cnpj || "—"]] : []),
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between px-3 py-2">
              <dt className="text-[10px] font-black uppercase tracking-widest text-slate-500">{k}</dt>
              <dd className="font-semibold text-slate-900 text-right truncate ml-3">{v}</dd>
            </div>
          ))}
        </dl>
      ),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo funcionário</DialogTitle></DialogHeader>
        <Wizard
          steps={steps}
          isSubmitting={create.isPending}
          completeLabel="Criar funcionário"
          onCancel={() => onOpenChange(false)}
          onComplete={() => create.mutate(form)}
        />
      </DialogContent>
    </Dialog>
  );
}
