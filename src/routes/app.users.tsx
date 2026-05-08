import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/app/users")({
  component: UsersPage,
});

const ROLES = ["admin", "tst", "viewer"] as const;

function UsersPage() {
  const qc = useQueryClient();
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate({ to: "/app" });
    }
  }, [loading, isAdmin, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["users-with-roles"],
    enabled: isAdmin,
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, full_name"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      return (profiles ?? []).map((p) => ({
        ...p,
        roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as string),
      }));
    },
  });

  const setRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      await supabase.from("user_roles").delete().eq("user_id", userId);
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: role as any });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users-with-roles"] }); toast.success("Papel atualizado"); },
    onError: (e: any) => toast.error(e.message),
  });

  if (loading || !isAdmin) {
    return (
      <div className="p-8 text-sm text-muted-foreground">Carregando…</div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold tracking-tight mb-2">Usuários</h1>
      <p className="text-muted-foreground mb-6">Gestão de papéis (admin · tst · viewer)</p>
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Papéis atuais</TableHead>
              <TableHead className="w-48">Definir papel</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Carregando...</TableCell></TableRow>}
            {data?.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.full_name ?? u.id.slice(0, 8)}</TableCell>
                <TableCell className="space-x-1">
                  {u.roles.length === 0 && <Badge variant="outline">sem papel</Badge>}
                  {u.roles.map((r) => <Badge key={r} variant="secondary">{r}</Badge>)}
                </TableCell>
                <TableCell>
                  <Select onValueChange={(v) => setRole.mutate({ userId: u.id, role: v })}>
                    <SelectTrigger><SelectValue placeholder="Trocar papel" /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}