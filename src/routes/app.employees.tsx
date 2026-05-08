import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/employees")({
  component: EmployeesPage,
});

function EmployeesPage() {
  const qc = useQueryClient();
  const { isEditor } = useAuth();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [form, setForm] = useState<any>({ nome: "", cpf: "", matricula: "", status: "ATIVO", company_id: "", role_id: "" });

  const { data: emps, isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });
  const { data: companies } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => (await supabase.from("companies").select("id,name").order("name")).data ?? [],
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
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      setOpen(false);
      setForm({ nome: "", cpf: "", matricula: "", status: "ATIVO", company_id: "", role_id: "" });
      toast.success("Colaborador criado");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return emps ?? [];
    return (emps ?? []).filter((e: any) =>
      e.nome.toLowerCase().includes(s) || (e.cpf ?? "").toLowerCase().includes(s) || (e.matricula ?? "").toLowerCase().includes(s),
    );
  }, [emps, q]);

  const cMap = new Map((companies ?? []).map((c: any) => [c.id, c.name]));
  const rMap = new Map((roles ?? []).map((r: any) => [r.id, r.name]));

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Colaboradores</h1>
          <p className="text-muted-foreground">Cadastro de colaboradores</p>
        </div>
        {isEditor && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Novo colaborador</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo colaborador</DialogTitle></DialogHeader>
              <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); create.mutate(form); }}>
                <div className="space-y-2"><Label>Nome *</Label><Input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>CPF</Label><Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Matrícula</Label><Input value={form.matricula} onChange={(e) => setForm({ ...form, matricula: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Empresa</Label>
                    <Select value={form.company_id} onValueChange={(v) => setForm({ ...form, company_id: v })}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{(companies ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
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
                <DialogFooter><Button type="submit" disabled={create.isPending}>Criar</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-10" placeholder="Buscar por nome, CPF, matrícula…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>CPF</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Carregando…</TableCell></TableRow>}
            {!isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum colaborador</TableCell></TableRow>
            )}
            {filtered.map((e: any) => (
              <TableRow key={e.id}>
                <TableCell className="font-medium">{e.nome}</TableCell>
                <TableCell>{cMap.get(e.company_id) ?? "—"}</TableCell>
                <TableCell>{rMap.get(e.role_id) ?? "—"}</TableCell>
                <TableCell>{e.cpf ?? "—"}</TableCell>
                <TableCell><Badge variant={e.status === "ATIVO" ? "default" : "secondary"}>{e.status}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button asChild size="sm" variant="ghost">
                    <Link to="/app/employees/$id" params={{ id: e.id }}>Abrir <ChevronRight className="h-4 w-4 ml-1" /></Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}