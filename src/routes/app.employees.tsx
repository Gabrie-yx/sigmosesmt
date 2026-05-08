import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/app/employees")({
  component: EmployeesPage,
});

function EmployeesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold tracking-tight mb-2">Funcionários</h1>
      <p className="text-muted-foreground mb-6">Cadastro de colaboradores</p>
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>CPF</TableHead>
              <TableHead>Matrícula</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>}
            {!isLoading && data?.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nenhum funcionário cadastrado</TableCell></TableRow>
            )}
            {data?.map((e: any) => (
              <TableRow key={e.id}>
                <TableCell className="font-medium">{e.nome}</TableCell>
                <TableCell>{e.cpf ?? "—"}</TableCell>
                <TableCell>{e.matricula ?? "—"}</TableCell>
                <TableCell><Badge variant={e.status === "ATIVO" ? "default" : "secondary"}>{e.status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}