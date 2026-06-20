import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Wizard, type WizardStep } from "@/components/wizard";
import { maskCPF, maskCNPJ, onlyDigits } from "@/lib/masks";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultCompanyId?: string;
  onCreated?: () => void;
};

type Company = { id: string; name: string; type: string | null };
type Role = { id: string; name: string };
type EmployeeForm = {
  nome: string;
  cpf: string;
  matricula: string;
  status: string;
  company_id: string;
  role_id: string;
  tipo_cadastro: string;
  cnpj: string;
};
type ExistingEmployee = {
  id: string;
  nome: string;
  cpf: string | null;
  status: string;
  company_id: string | null;
  companies?: { name: string | null } | null;
};
type SupabaseLikeError = { code?: string; message?: string; details?: string };
type DuplicateCpfError = Error & { code: "DUPLICATE_EMPLOYEE_CPF"; employee: ExistingEmployee };

const EMPTY_FORM = (companyId?: string): EmployeeForm => ({
  nome: "",
  cpf: "",
  matricula: "",
  status: "ATIVO",
  company_id: companyId ?? "",
  role_id: "",
  tipo_cadastro: "NAO_MEI",
  cnpj: "",
});

function isCpfDuplicateError(error: SupabaseLikeError) {
  const msg = `${error.message ?? ""} ${error.details ?? ""}`;
  return error.code === "23505" && msg.includes("employees_cpf_digits_unique");
}

function duplicateCpfMessage(employee: ExistingEmployee) {
  const companyName = employee.companies?.name ? ` na empresa ${employee.companies.name}` : "";
  const status = employee.status ? ` · status ${employee.status}` : "";
  return `CPF já cadastrado para ${employee.nome}${companyName}${status}. Abra o cadastro existente em vez de criar outro.`;
}

function isDuplicateCpfMutationError(error: unknown): error is DuplicateCpfError {
  return (
    error instanceof Error &&
    (error as Partial<DuplicateCpfError>).code === "DUPLICATE_EMPLOYEE_CPF"
  );
}

export function NewEmployeeDialog({ open, onOpenChange, defaultCompanyId, onCreated }: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState<EmployeeForm>(() => EMPTY_FORM(defaultCompanyId));

  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM(defaultCompanyId));
    }
  }, [open, defaultCompanyId]);

  const { data: companies } = useQuery<Company[]>({
    queryKey: ["companies-with-type"],
    queryFn: async () =>
      (await supabase.from("companies").select("id,name,type").order("name")).data ?? [],
  });
  const { data: roles } = useQuery<Role[]>({
    queryKey: ["roles"],
    queryFn: async () => (await supabase.from("roles").select("id,name").order("name")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async (v: EmployeeForm) => {
      const cpfDigits = onlyDigits(v.cpf);
      const cpfFormatado = cpfDigits ? maskCPF(cpfDigits) : "";
      if (cpfDigits && cpfDigits.length !== 11) {
        throw new Error("CPF incompleto. Informe os 11 dígitos ou deixe o campo em branco.");
      }
      if (cpfDigits) {
        const { data, error: lookupError } = await supabase
          .from("employees")
          .select("id,nome,cpf,status,company_id,companies(name)")
          .or(`cpf.eq.${cpfFormatado},cpf.eq.${cpfDigits}`)
          .maybeSingle();
        const existing = data as ExistingEmployee | null;
        if (lookupError) throw lookupError;
        if (existing) {
          throw Object.assign(new Error(duplicateCpfMessage(existing)), {
            code: "DUPLICATE_EMPLOYEE_CPF",
            employee: existing,
          });
        }
      }
      const { error } = await supabase.from("employees").insert({
        nome: v.nome,
        cpf: cpfFormatado || null,
        matricula: v.matricula || null,
        status: v.status,
        company_id: v.company_id || null,
        role_id: v.role_id || null,
        tipo_cadastro: v.tipo_cadastro || "NAO_MEI",
        cnpj: v.tipo_cadastro === "MEI" ? v.cnpj || null : null,
      });
      if (error) {
        if (isCpfDuplicateError(error)) {
          throw new Error(
            "CPF já cadastrado em outro funcionário. Busque pelo CPF na lista e abra o cadastro existente.",
          );
        }
        throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["employees-light"] });
      onCreated?.();
      onOpenChange(false);
      toast.success("Funcionário criado");
    },
    onError: (e: unknown) => {
      if (isDuplicateCpfMutationError(e)) {
        toast.error("CPF já cadastrado", {
          description: e.message,
          action: {
            label: "Abrir cadastro",
            onClick: () => {
              onOpenChange(false);
              navigate({ to: "/app/employees/$id", params: { id: e.employee.id } });
            },
          },
        });
        return;
      }
      toast.error(e instanceof Error ? e.message : "Não foi possível criar o funcionário.");
    },
  });

  const selectedCompany = useMemo(
    () => (companies ?? []).find((c) => c.id === form.company_id),
    [companies, form.company_id],
  );
  const cName = selectedCompany?.name ?? "—";
  const isTerceiro = selectedCompany?.type === "TERCEIRIZADO";
  const rName = (roles ?? []).find((r) => r.id === form.role_id)?.name ?? "—";

  const steps: WizardStep[] = [
    {
      id: "dados",
      title: "Dados pessoais",
      description: "Identificação básica do funcionário.",
      isValid: () => form.nome.trim().length > 0,
      invalidMessage: "Informe o nome.",
      content: (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input
              required
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>CPF</Label>
              <Input
                inputMode="numeric"
                placeholder="000.000.000-00"
                value={form.cpf}
                onChange={(e) => setForm({ ...form, cpf: maskCPF(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Matrícula</Label>
              <Input
                value={form.matricula}
                onChange={(e) => setForm({ ...form, matricula: e.target.value })}
              />
            </div>
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
              <Select
                value={form.company_id}
                onValueChange={(v) => setForm({ ...form, company_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {(companies ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                      {c.type === "TERCEIRIZADO" ? " · TERCEIRO" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isTerceiro && (
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700">
                  Vínculo: TERCEIRO
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Cargo</Label>
              <Select value={form.role_id} onValueChange={(v) => setForm({ ...form, role_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {(roles ?? []).map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
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
              <Select
                value={form.tipo_cadastro}
                onValueChange={(v) =>
                  setForm({ ...form, tipo_cadastro: v, cnpj: v === "MEI" ? form.cnpj : "" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NAO_MEI">CLT</SelectItem>
                  <SelectItem value="MEI">MEI</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.tipo_cadastro === "MEI" && (
              <div className="space-y-2">
                <Label>CNPJ (MEI)</Label>
                <Input
                  inputMode="numeric"
                  maxLength={18}
                  placeholder="00.000.000/0000-00"
                  value={form.cnpj}
                  onChange={(e) => setForm({ ...form, cnpj: maskCNPJ(e.target.value) })}
                />
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
              <dt className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                {k}
              </dt>
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
        <DialogHeader>
          <DialogTitle>Novo funcionário</DialogTitle>
        </DialogHeader>
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
