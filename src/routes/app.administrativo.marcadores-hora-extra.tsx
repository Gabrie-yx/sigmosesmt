import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Save, Search, UserCog, Building2, UserX, Info } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/app/administrativo/marcadores-hora-extra")({
  head: () => ({ meta: [{ title: "Marcadores de Hora Extra — Escopo · SIGMO" }] }),
  component: MarcadoresHoraExtraPage,
});

type Marcador = {
  user_id: string;
  nome: string;
  ativo: boolean;
  escopo: {
    tipo?: string;
    exclude_company_ids?: string[];
    exclude_employee_ids?: string[];
    company_ids?: string[];
    employee_ids?: string[];
  } | null;
};

function MarcadoresHoraExtraPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");

  const { data: marcadores = [] } = useQuery({
    queryKey: ["marcadores-hora-extra"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hora_extra_marcadores")
        .select("user_id,nome,ativo,escopo")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as Marcador[];
    },
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["companies-terceirizadas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id,name,type")
        .eq("type", "TERCEIRIZADO")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-terceirizados"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id,nome,company_id,companies(name,type)")
        .in("company_id", companies.map((c) => c.id))
        .eq("status", "ATIVO")
        .order("nome");
      if (error) throw error;
      return (data ?? []).filter((e: any) => !!e.company_id) as { id: string; nome: string; company_id: string; companies: any }[];
    },
    enabled: companies.length > 0,
  });

  if (!isAdmin) {
    return <div className="p-6 text-sm text-muted-foreground">Somente administradores acessam esta tela.</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
      <header className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/20 border border-primary/40 p-2 text-primary">
          <UserCog className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-black">Marcadores de Hora Extra — Escopo</h1>
          <p className="text-sm text-muted-foreground">
            Configure quais empresas e pessoas cada marcador enxerga. Empresas novas cadastradas como <b>TERCEIRIZADO</b> entram automaticamente no escopo — use os checkboxes abaixo para excluir exceções.
          </p>
        </div>
      </header>

      {marcadores.length === 0 ? (
        <Card className="glass-card"><CardContent className="p-6 text-sm text-muted-foreground">Nenhum marcador ativo cadastrado.</CardContent></Card>
      ) : marcadores.map((m) => (
        <MarcadorCard
          key={m.user_id}
          marcador={m}
          companies={companies}
          employees={employees}
          busca={busca}
          setBusca={setBusca}
          onSaved={() => qc.invalidateQueries({ queryKey: ["marcadores-hora-extra"] })}
        />
      ))}
    </div>
  );
}

function MarcadorCard({ marcador, companies, employees, busca, setBusca, onSaved }: {
  marcador: Marcador;
  companies: { id: string; name: string }[];
  employees: { id: string; nome: string; company_id: string; companies: any }[];
  busca: string;
  setBusca: (v: string) => void;
  onSaved: () => void;
}) {
  const esc = marcador.escopo ?? {};
  const [excCompanies, setExcCompanies] = useState<Set<string>>(new Set(esc.exclude_company_ids ?? []));
  const [excEmployees, setExcEmployees] = useState<Set<string>>(new Set(esc.exclude_employee_ids ?? []));
  const isAuto = esc.tipo === "TERCEIRIZADAS_AUTO";

  const empresasIncluidas = useMemo(
    () => companies.filter((c) => !excCompanies.has(c.id)),
    [companies, excCompanies],
  );

  const empresasIncluidasIds = useMemo(() => new Set(empresasIncluidas.map((c) => c.id)), [empresasIncluidas]);

  const employeesFiltered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return employees
      .filter((e) => empresasIncluidasIds.has(e.company_id))
      .filter((e) => !q || e.nome?.toLowerCase().includes(q));
  }, [employees, empresasIncluidasIds, busca]);

  const salvar = useMutation({
    mutationFn: async () => {
      const novoEscopo = {
        ...esc,
        tipo: esc.tipo ?? "TERCEIRIZADAS_AUTO",
        exclude_company_ids: Array.from(excCompanies),
        exclude_employee_ids: Array.from(excEmployees),
      };
      const { error } = await supabase
        .from("hora_extra_marcadores")
        .update({ escopo: novoEscopo })
        .eq("user_id", marcador.user_id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Escopo atualizado");
      onSaved();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  function toggleCompany(id: string) {
    setExcCompanies((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }
  function toggleEmployee(id: string) {
    setExcEmployees((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between gap-3 flex-wrap">
          <span className="flex items-center gap-2">
            <UserCog className="h-4 w-4" /> {marcador.nome}
            {isAuto && <Badge variant="outline" className="text-[10px]">AUTO — Terceirizadas</Badge>}
          </span>
          <Button size="sm" onClick={() => salvar.mutate()} disabled={salvar.isPending} className="bg-red-700 hover:bg-red-800">
            <Save className="h-4 w-4 mr-1" /> Salvar escopo
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {!isAuto && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200 flex gap-2">
            <Info className="h-4 w-4 shrink-0" />
            Este marcador ainda usa escopo fixo ({esc.tipo ?? "—"}). Salvar aqui converte para regra automática de terceirizadas + exceções.
          </div>
        )}

        <section>
          <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5" /> Empresas terceirizadas — marque para EXCLUIR do escopo
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {companies.map((c) => {
              const excluida = excCompanies.has(c.id);
              return (
                <label
                  key={c.id}
                  className={`flex items-center gap-2 rounded-md border p-2 cursor-pointer text-sm transition ${
                    excluida ? "border-destructive/40 bg-destructive/10 line-through text-muted-foreground" : "border-border bg-card/40 hover:bg-accent/30"
                  }`}
                >
                  <Checkbox checked={excluida} onCheckedChange={() => toggleCompany(c.id)} />
                  <span>{c.name}</span>
                </label>
              );
            })}
          </div>
        </section>

        <section>
          <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
            <UserX className="h-3.5 w-3.5" /> Pessoas excluídas individualmente
          </h3>
          <div className="relative mb-2">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar funcionário…" className="pl-8" />
          </div>
          <div className="max-h-72 overflow-y-auto rounded-md border border-border divide-y divide-border">
            {employeesFiltered.length === 0 ? (
              <p className="p-3 text-xs text-muted-foreground">Nenhum funcionário encontrado.</p>
            ) : employeesFiltered.map((e) => {
              const excluido = excEmployees.has(e.id);
              return (
                <label key={e.id} className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-sm ${excluido ? "bg-destructive/10 line-through text-muted-foreground" : "hover:bg-accent/30"}`}>
                  <Checkbox checked={excluido} onCheckedChange={() => toggleEmployee(e.id)} />
                  <span className="flex-1">{e.nome}</span>
                  <span className="text-xs text-muted-foreground">{e.companies?.name ?? "—"}</span>
                </label>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Se o funcionário estiver em uma empresa já excluída acima, ele nem aparece aqui.
          </p>
        </section>
      </CardContent>
    </Card>
  );
}