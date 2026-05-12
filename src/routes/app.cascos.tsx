import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Ship, Search } from "lucide-react";
import { toast } from "sonner";
import { CascoForm, type CascoRecord } from "@/components/cascos/cascos-form";
import { formatDateBR } from "@/lib/utils-date";

export const Route = createFileRoute("/app/cascos")({
  component: CascosPage,
});

function CascosPage() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CascoRecord | null>(null);
  const [filter, setFilter] = useState("");

  const { data: cascos = [], isLoading } = useQuery({
    queryKey: ["cascos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cascos")
        .select("*")
        .order("numero", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CascoRecord[];
    },
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["companies-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("id, name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, nome")
        .eq("status", "ATIVO")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cascos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cascos"] });
      toast.success("Casco excluído");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = cascos.filter((c) => {
    const f = filter.toLowerCase().trim();
    if (!f) return true;
    return (
      c.numero?.toLowerCase().includes(f) ||
      c.nome?.toLowerCase().includes(f)
    );
  });

  const empresaName = (id: string | null) =>
    companies.find((c: any) => c.id === id)?.name ?? "—";
  const encarregadoName = (id: string | null) =>
    employees.find((e: any) => e.id === id)?.nome ?? "—";

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-red-700 to-red-900 text-white flex items-center justify-center shadow-md">
            <Ship className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight">Cascos / Embarcações</h1>
            <p className="text-xs text-muted-foreground">
              Cadastro de cascos para uso em PTE, APR e demais documentos.
            </p>
          </div>
        </div>
        <Button
          onClick={() => { setEditing(null); setOpen(true); }}
          className="bg-red-700 hover:bg-red-800 text-white"
        >
          <Plus className="h-4 w-4 mr-1" /> Novo Casco
        </Button>
      </div>

      <Card className="p-4 rounded-2xl">
        <div className="flex items-center gap-2 mb-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por número ou nome…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="max-w-sm"
          />
          <span className="text-[11px] text-muted-foreground ml-auto">
            {filtered.length} de {cascos.length}
          </span>
        </div>

        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-28">Número</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Empresa Responsável</TableHead>
                <TableHead>Encarregado</TableHead>
                <TableHead className="w-28">Início</TableHead>
                <TableHead className="w-28">Fim Previsto</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-6 text-muted-foreground text-xs">
                    Carregando…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground text-xs">
                    Nenhum casco cadastrado.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-bold">{c.numero}</TableCell>
                  <TableCell>{c.nome ?? "—"}</TableCell>
                  <TableCell className="text-xs">{empresaName(c.empresa_responsavel_id)}</TableCell>
                  <TableCell className="text-xs">{encarregadoName(c.encarregado_id)}</TableCell>
                  <TableCell className="text-xs">
                    {c.data_inicio ? formatDateBR(c.data_inicio) : "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {c.data_fim ? formatDateBR(c.data_fim) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        c.status === "ATIVO"
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                          : c.status === "CONCLUIDO"
                          ? "border-slate-300 bg-slate-50 text-slate-700"
                          : "border-amber-300 bg-amber-50 text-amber-800"
                      }
                    >
                      {c.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => { setEditing(c); setOpen(true); }}
                      className="h-8 w-8"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {isAdmin && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Excluir casco ${c.numero}?`)) del.mutate(c.id);
                        }}
                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? `Editar Casco ${editing.numero}` : "Novo Casco"}</DialogTitle>
          </DialogHeader>
          <CascoForm
            initial={editing}
            companies={companies as any}
            employees={employees as any}
            onDone={() => {
              setOpen(false);
              qc.invalidateQueries({ queryKey: ["cascos"] });
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}