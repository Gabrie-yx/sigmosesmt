import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Printer, X } from "lucide-react";
import { toast } from "sonner";
import { PTE_RISCOS } from "@/lib/constants";
import { formatDateBR } from "@/lib/utils-date";

export const Route = createFileRoute("/app/ptes")({
  component: PtesPage,
});

function PtesPage() {
  const qc = useQueryClient();
  const { isEditor, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState<any>({
    data: today, employee_id: "", company_id: "", risco: PTE_RISCOS[0], local: "", observacoes: "",
  });

  const { data: ptes } = useQuery({
    queryKey: ["ptes"],
    queryFn: async () => (await supabase.from("ptes").select("*").order("data_emissao", { ascending: false })).data ?? [],
  });
  const { data: emps } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => (await supabase.from("employees").select("id,nome,company_id,role_id").order("nome")).data ?? [],
  });
  const { data: companies } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => (await supabase.from("companies").select("id,name")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const emp = (emps ?? []).find((e: any) => e.id === f.employee_id);
      const numero = `PTE-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000 + 1000)}`;
      const { error } = await supabase.from("ptes").insert({
        numero, data: f.data, local: f.local || null, risco: f.risco, status: "ATIVA",
        employee_id: f.employee_id || null, employee_name: emp?.nome ?? null,
        company_id: f.company_id || emp?.company_id || null,
        dados: { observacoes: f.observacoes },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ptes"] });
      setOpen(false);
      setF({ data: today, employee_id: "", company_id: "", risco: PTE_RISCOS[0], local: "", observacoes: "" });
      toast.success("PTE emitida");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const close = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ptes").update({ status: "ENCERRADA" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ptes"] }); toast.success("PTE encerrada"); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("ptes").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ptes"] }); toast.success("Removido"); },
  });

  function printPte(p: any) {
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(`
      <html><head><title>${p.numero}</title>
      <style>body{font-family:system-ui;padding:40px;max-width:760px;margin:auto;color:#0f172a}
      h1{margin:0 0 4px;font-size:22px}h2{font-size:14px;margin:24px 0 8px;color:#475569;text-transform:uppercase;letter-spacing:.05em}
      .row{display:flex;justify-content:space-between;border-bottom:1px solid #e5e7eb;padding:8px 0}
      .row b{color:#64748b;font-weight:600}.box{border:2px solid #0f172a;padding:24px;border-radius:8px}
      .sig{margin-top:60px;display:flex;gap:40px}.sig div{flex:1;text-align:center;border-top:1px solid #0f172a;padding-top:8px}
      </style></head><body>
      <div class="box">
        <h1>Permissão de Trabalho Especial</h1>
        <div style="color:#64748b;font-size:13px">Nº ${p.numero}</div>
        <h2>Dados</h2>
        <div class="row"><b>Data</b><span>${formatDateBR(p.data)}</span></div>
        <div class="row"><b>Risco</b><span>${p.risco ?? "—"}</span></div>
        <div class="row"><b>Local</b><span>${p.local ?? "—"}</span></div>
        <div class="row"><b>Colaborador</b><span>${p.employee_name ?? "—"}</span></div>
        <div class="row"><b>Status</b><span>${p.status}</span></div>
        ${p.dados?.observacoes ? `<h2>Observações</h2><div>${p.dados.observacoes}</div>` : ""}
        <div class="sig">
          <div>Executante</div><div>Emitente / TST</div>
        </div>
      </div>
      <script>window.print()</script>
      </body></html>
    `);
    w.document.close();
  }

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">PTEs</h1>
          <p className="text-muted-foreground">Permissões de Trabalho Especial</p>
        </div>
        {isEditor && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Emitir PTE</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Emitir PTE</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>Data *</Label><Input type="date" required value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></div>
                  <div className="space-y-2">
                    <Label>Risco *</Label>
                    <Select value={f.risco} onValueChange={(v) => setF({ ...f, risco: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{PTE_RISCOS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Colaborador *</Label>
                  <Select value={f.employee_id} onValueChange={(v) => setF({ ...f, employee_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                    <SelectContent>{(emps ?? []).map((e: any) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Empresa</Label>
                  <Select value={f.company_id} onValueChange={(v) => setF({ ...f, company_id: v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{(companies ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Local</Label><Input value={f.local} onChange={(e) => setF({ ...f, local: e.target.value })} /></div>
                <div className="space-y-2"><Label>Observações</Label><Input value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} /></div>
                <DialogFooter><Button type="submit" disabled={create.isPending}>Emitir</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader><TableRow><TableHead>Número</TableHead><TableHead>Data</TableHead><TableHead>Risco</TableHead><TableHead>Colaborador</TableHead><TableHead>Local</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {(ptes ?? []).length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Nenhuma PTE</TableCell></TableRow>}
            {(ptes ?? []).map((p: any) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs font-semibold">{p.numero ?? "—"}</TableCell>
                <TableCell>{formatDateBR(p.data)}</TableCell>
                <TableCell>{p.risco ?? "—"}</TableCell>
                <TableCell>{p.employee_name ?? "—"}</TableCell>
                <TableCell>{p.local ?? "—"}</TableCell>
                <TableCell><Badge variant={p.status === "ATIVA" ? "default" : "secondary"}>{p.status}</Badge></TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="icon" variant="ghost" onClick={() => printPte(p)}><Printer className="h-4 w-4" /></Button>
                  {isEditor && p.status === "ATIVA" && (
                    <Button size="icon" variant="ghost" onClick={() => close.mutate(p.id)}><X className="h-4 w-4" /></Button>
                  )}
                  {isAdmin && <Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir?")) del.mutate(p.id); }}>×</Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}