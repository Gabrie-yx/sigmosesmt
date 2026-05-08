import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/companies")({
  component: CompaniesPage,
});

type Company = {
  id: string;
  name: string;
  type: string;
  cnpj: string | null;
  email: string | null;
  encarregado1: string | null;
  encarregado2: string | null;
};

const empty: Partial<Company> = { name: "", type: "CLT", cnpj: "", email: "", encarregado1: "", encarregado2: "" };

function CompaniesPage() {
  const qc = useQueryClient();
  const { isEditor, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Company> | null>(null);

  const { data: companies, isLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("*").order("name");
      if (error) throw error;
      return data as Company[];
    },
  });

  const save = useMutation({
    mutationFn: async (v: Partial<Company>) => {
      if (v.id) {
        const { error } = await supabase.from("companies").update({
          name: v.name, type: v.type, cnpj: v.cnpj || null, email: v.email || null,
          encarregado1: v.encarregado1 || null, encarregado2: v.encarregado2 || null,
        }).eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("companies").insert({
          name: v.name!, type: v.type ?? "CLT", cnpj: v.cnpj || null, email: v.email || null,
          encarregado1: v.encarregado1 || null, encarregado2: v.encarregado2 || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      setOpen(false); setEditing(null);
      toast.success("Salvo");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("companies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      toast.success("Excluído");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function openNew() { setEditing({ ...empty }); setOpen(true); }
  function openEdit(c: Company) { setEditing(c); setOpen(true); }

  return (
    <div className="p-6 md:p-8 animate-fadeIn">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="heading-display text-3xl md:text-4xl text-brand">Empresas</h2>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">
            Cadastro de Contratantes / Terceirizadas / CLT
          </p>
        </div>
        {isEditor && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={openNew}
                className="bg-[#0f172a] hover:bg-brand text-white text-[11px] font-black uppercase tracking-widest rounded-xl px-5 py-3 h-auto shadow-lg"
              >
                <Plus className="h-4 w-4 mr-2" />Nova empresa
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing?.id ? "Editar" : "Nova"} empresa</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); save.mutate(editing!); }} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input required value={editing?.name ?? ""} onChange={(e) => setEditing({ ...editing!, name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={editing?.type ?? "CLT"} onValueChange={(v) => setEditing({ ...editing!, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CLT">CLT</SelectItem>
                      <SelectItem value="TERCEIRIZADA">Terceirizada</SelectItem>
                      <SelectItem value="CONTRATANTE">Contratante</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>CNPJ</Label>
                    <Input value={editing?.cnpj ?? ""} onChange={(e) => setEditing({ ...editing!, cnpj: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={editing?.email ?? ""} onChange={(e) => setEditing({ ...editing!, email: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Encarregado 1</Label>
                    <Input value={editing?.encarregado1 ?? ""} onChange={(e) => setEditing({ ...editing!, encarregado1: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Encarregado 2</Label>
                    <Input value={editing?.encarregado2 ?? ""} onChange={(e) => setEditing({ ...editing!, encarregado2: e.target.value })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={save.isPending}>Salvar</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-600">Nome</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-600">Tipo</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-600">CNPJ</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-600">Email</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-600">Encarregados</TableHead>
              <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-600">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={6} className="text-center text-slate-400 py-10 text-xs font-bold uppercase tracking-widest">Carregando...</TableCell></TableRow>}
            {!isLoading && companies?.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-slate-400 py-10 text-xs font-bold uppercase tracking-widest">Nenhuma empresa cadastrada</TableCell></TableRow>
            )}
            {companies?.map((c) => (
              <TableRow key={c.id} className="hover:bg-slate-50/60">
                <TableCell className="font-black uppercase text-sm text-slate-900">{c.name}</TableCell>
                <TableCell><Badge variant="secondary" className="text-[10px] font-black uppercase tracking-widest">{c.type}</Badge></TableCell>
                <TableCell>{c.cnpj ?? "—"}</TableCell>
                <TableCell>{c.email ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {[c.encarregado1, c.encarregado2].filter(Boolean).join(", ") || "—"}
                </TableCell>
                <TableCell className="text-right space-x-1">
                  {isEditor && (
                    <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                  )}
                  {isAdmin && (
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir?")) del.mutate(c.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}