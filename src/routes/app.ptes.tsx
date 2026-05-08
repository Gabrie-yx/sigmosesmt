import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/app/ptes")({
  component: PtesPage,
});

function PtesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["ptes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ptes").select("*").order("data", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold tracking-tight mb-2">PTEs</h1>
      <p className="text-muted-foreground mb-6">Permissões de Trabalho Especial</p>
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>}
            {!isLoading && data?.length === 0 && (
              <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">Nenhuma PTE cadastrada</TableCell></TableRow>
            )}
            {data?.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.numero ?? "—"}</TableCell>
                <TableCell>{p.data}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}