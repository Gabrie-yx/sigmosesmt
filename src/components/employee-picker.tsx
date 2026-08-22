import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, ChevronsUpDown, X } from "lucide-react";

export type EmployeeOption = {
  id: string;
  nome: string;
  funcao: string | null;
  setor: string | null;
  company_id: string | null;
};

/** Busca única de funcionários ATIVOS — usada por todos os pickers de nome do SIGMO. */
export function useActiveEmployees(companyIds?: string[]) {
  const key = (companyIds ?? []).slice().sort().join(",");
  return useQuery({
    queryKey: ["employee-picker-ativos", key],
    staleTime: 60_000,
    queryFn: async (): Promise<EmployeeOption[]> => {
      let q = supabase
        .from("employees")
        .select("id,nome,setor,company_id,roles(name)")
        .eq("status", "ATIVO")
        .order("nome")
        .limit(5000);
      if (companyIds && companyIds.length > 0) q = q.in("company_id", companyIds);
      const { data } = await q;
      return (data ?? []).map((e: any) => ({
        id: e.id,
        nome: e.nome,
        funcao: e.roles?.name ?? null,
        setor: e.setor ?? null,
        company_id: e.company_id ?? null,
      }));
    },
  });
}

export function EmployeePicker({
  value,
  onSelect,
  onClear,
  placeholder = "Buscar funcionário...",
  companyIds,
  disabled,
}: {
  /** Nome exibido (pode vir de texto legado, sem id). */
  value: string;
  onSelect: (emp: EmployeeOption) => void;
  onClear?: () => void;
  placeholder?: string;
  companyIds?: string[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const { data: emps = [], isLoading } = useActiveEmployees(companyIds);

  const list = useMemo(() => {
    const term = q.toLowerCase().trim();
    const base = term ? emps.filter((e) => e.nome.toLowerCase().includes(term)) : emps;
    return base.slice(0, 200);
  }, [emps, q]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className={`truncate ${value ? "" : "text-muted-foreground"}`}>
            {value || placeholder}
          </span>
          <span className="flex items-center gap-1 shrink-0">
            {value && onClear && (
              <span
                role="button"
                tabIndex={-1}
                onClick={(e) => { e.stopPropagation(); onClear(); }}
                className="rounded p-0.5 hover:bg-muted"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[min(28rem,90vw)]" align="start">
        <div className="p-2 border-b">
          <Input autoFocus placeholder="Digite o nome..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="max-h-64 overflow-auto divide-y">
          {isLoading && <div className="p-3 text-xs text-muted-foreground text-center">Carregando...</div>}
          {!isLoading && list.length === 0 && (
            <div className="p-3 text-xs text-muted-foreground text-center">Nenhum funcionário ativo encontrado</div>
          )}
          {list.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => { onSelect(e); setOpen(false); setQ(""); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-center gap-2"
            >
              <Check className={`h-3.5 w-3.5 shrink-0 ${value === e.nome ? "opacity-100" : "opacity-0"}`} />
              <span className="flex-1 truncate">{e.nome}</span>
              {e.funcao && <span className="text-[10px] text-muted-foreground truncate max-w-[40%]">{e.funcao}</span>}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
