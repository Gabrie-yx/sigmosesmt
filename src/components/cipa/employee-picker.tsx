import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type CipaEmployee = {
  id: string;
  nome: string;
  admissao: string | null;
  matricula?: string | null;
  setor?: string | null;
  company_id: string | null;
  roles: { name: string } | null;
  companies: { name: string } | null;
};

export function useCipaEmployees(enabled = true) {
  return useQuery({
    queryKey: ["cipa", "employees-lookup"],
    queryFn: async (): Promise<CipaEmployee[]> => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, nome, admissao, matricula, setor, company_id, roles(name), companies!employees_company_id_fkey(name)")
        .eq("status", "ATIVO")
        .order("nome")
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as unknown as CipaEmployee[];
    },
    enabled,
  });
}

type PickerProps = {
  funcs: CipaEmployee[] | undefined;
  value: string;
  onChange: (id: string) => void;
  excludeIds?: string[];
  placeholder?: string;
  label?: string | null;
  triggerClassName?: string;
};

export function CipaEmployeePicker({ funcs, value, onChange, excludeIds = [], placeholder = "Selecione…", label = "Funcionário", triggerClassName }: PickerProps) {
  const [empresaId, setEmpresaId] = useState("ALL");

  const empresas = (() => {
    const map = new Map<string, string>();
    (funcs ?? []).forEach((f) => {
      if (f.company_id && f.companies?.name) map.set(f.company_id, f.companies.name);
    });
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  })();

  const lista = (funcs ?? []).filter(
    (f) => !excludeIds.includes(f.id) && (empresaId === "ALL" || f.company_id === empresaId),
  );

  return (
    <div className="space-y-2">
      {empresas.length > 1 && (
        <div>
          <Label>Empresa</Label>
          <Select
            value={empresaId}
            onValueChange={(v) => {
              setEmpresaId(v);
              const sel = (funcs ?? []).find((f) => f.id === value);
              if (sel && v !== "ALL" && sel.company_id !== v) onChange("");
            }}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="ALL">Todas as empresas</SelectItem>
              {empresas.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div>
        {label && <Label>{label}</Label>}
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className={triggerClassName}><SelectValue placeholder={placeholder} /></SelectTrigger>
          <SelectContent className="max-h-72">
            {lista.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.nome}{f.roles?.name ? ` — ${f.roles.name}` : ""}
              </SelectItem>
            ))}
            {lista.length === 0 && (
              <div className="px-2 py-3 text-xs text-muted-foreground">Nenhum funcionário ativo nesta empresa.</div>
            )}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
