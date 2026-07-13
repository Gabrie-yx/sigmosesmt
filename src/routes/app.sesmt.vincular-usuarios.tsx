import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, Link2, Unlink, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/sesmt/vincular-usuarios")({
  component: VincularUsuarios,
});

function VincularUsuarios() {
  const { roles } = useAuth();
  const qc = useQueryClient();
  const isAdmin = roles?.some((r) => r === "admin" || r === "tst");
  const [q, setQ] = useState("");

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["employees-vinculo"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, nome, cpf, matricula, status, user_id, companies(name, nome_fantasia)")
        .eq("status", "ativo")
        .order("nome")
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-vinculo"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name").order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const usados = useMemo(() => new Set(employees.filter((e: any) => e.user_id).map((e: any) => e.user_id)), [employees]);

  const vincular = useMutation({
    mutationFn: async ({ employeeId, userId }: { employeeId: string; userId: string | null }) => {
      const { error } = await supabase.from("employees").update({ user_id: userId }).eq("id", employeeId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vínculo atualizado");
      qc.invalidateQueries({ queryKey: ["employees-vinculo"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return employees;
    return employees.filter((e: any) =>
      e.nome?.toLowerCase().includes(term) || e.cpf?.includes(term) || e.matricula?.toLowerCase().includes(term),
    );
  }, [employees, q]);

  if (!isAdmin) {
    return <div className="p-6 text-sm text-slate-500">Acesso restrito a admin/TST.</div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-4">
      <Link to="/app/sesmt/inspecoes" className="text-[10px] font-black uppercase tracking-wider text-slate-500 hover:text-slate-800 flex items-center gap-1">
        <ChevronLeft className="h-3 w-3" /> Inspeções
      </Link>
      <div className="flex items-center gap-2">
        <Users className="h-6 w-6 text-emerald-700" />
        <div>
          <h1 className="text-xl font-black uppercase tracking-tight text-slate-900">Vincular funcionários a usuários</h1>
          <p className="text-xs text-slate-500">Amarra cada funcionário ao login dele. Sem vínculo, notificações automáticas de planos de ação não chegam ao responsável.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-black uppercase tracking-wide text-slate-800">Funcionários ativos</CardTitle>
          <Input placeholder="Buscar por nome, CPF ou matrícula..." value={q} onChange={(e) => setQ(e.target.value)} className="mt-2 h-9 text-sm" />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-slate-500">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-slate-500 py-8 text-center">Nenhum funcionário encontrado.</div>
          ) : (
            <div className="divide-y">
              {filtered.map((e: any) => (
                <div key={e.id} className="py-2 flex items-center gap-2 flex-wrap">
                  <div className="flex-1 min-w-[180px]">
                    <div className="text-sm font-semibold text-slate-800">{e.nome}</div>
                    <div className="text-[10px] text-slate-500">
                      {e.matricula && <>Mat. {e.matricula} · </>}
                      {e.cpf && <>CPF {e.cpf} · </>}
                      {e.companies?.nome_fantasia ?? e.companies?.name}
                    </div>
                  </div>
                  {e.user_id ? (
                    <>
                      <Badge className="bg-emerald-100 text-emerald-800 text-[10px]"><Link2 className="h-3 w-3 mr-1" /> vinculado</Badge>
                      <span className="text-[11px] text-slate-600">{profiles.find((p: any) => p.id === e.user_id)?.full_name ?? "(usuário)"}</span>
                      <Button size="sm" variant="ghost" className="h-7 text-[11px] text-red-600" onClick={() => vincular.mutate({ employeeId: e.id, userId: null })}>
                        <Unlink className="h-3 w-3 mr-1" /> desvincular
                      </Button>
                    </>
                  ) : (
                    <Select onValueChange={(v) => vincular.mutate({ employeeId: e.id, userId: v })}>
                      <SelectTrigger className="h-8 w-64 text-xs"><SelectValue placeholder="Selecionar usuário do sistema..." /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        {profiles
                          .filter((p: any) => !usados.has(p.id))
                          .map((p: any) => (
                            <SelectItem key={p.id} value={p.id}>{p.full_name ?? p.id.slice(0, 8)}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}