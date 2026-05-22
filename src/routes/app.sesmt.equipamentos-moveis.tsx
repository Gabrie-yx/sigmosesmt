import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Wrench, ClipboardCheck, History, Pencil, Search, FolderArchive } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/sesmt/equipamentos-moveis")({
  component: EquipamentosMoveisPage,
  head: () => ({ meta: [{ title: "Checklist de Equipamentos · SIGMO" }] }),
});

type Equip = any;
type Modelo = any;

const STATUS_LABEL: Record<string, string> = {
  ATIVO: "Ativo",
  INATIVO: "Inativo",
  MANUTENCAO: "Em manutenção",
  BLOQUEADO: "Bloqueado",
};
const STATUS_STYLE: Record<string, string> = {
  ATIVO: "bg-emerald-100 text-emerald-700 border-emerald-300",
  INATIVO: "bg-slate-100 text-slate-500 border-slate-200",
  MANUTENCAO: "bg-amber-100 text-amber-700 border-amber-300",
  BLOQUEADO: "bg-red-100 text-red-700 border-red-300",
};

function EquipamentosMoveisPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [openNovo, setOpenNovo] = useState(false);
  const [edit, setEdit] = useState<Equip | null>(null);

  const equipamentos = useQuery({
    queryKey: ["equipamentos-moveis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipamentos_moveis").select("*").order("tag");
      if (error) throw error;
      return (data ?? []) as Equip[];
    },
  });

  const modelos = useQuery({
    queryKey: ["checklist-modelos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_modelos").select("*").eq("ativo", true).order("codigo");
      if (error) throw error;
      return (data ?? []) as Modelo[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (payload: any) => {
      if (payload.id) {
        const { error } = await supabase.from("equipamentos_moveis")
          .update(payload).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("equipamentos_moveis")
          .insert({ ...payload, created_by: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["equipamentos-moveis"] });
      setOpenNovo(false);
      setEdit(null);
      toast.success("Equipamento salvo");
    },
    onError: (e: any) => toast.error(e.message ?? "Falha ao salvar"),
  });

  const lista = (equipamentos.data ?? []).filter((e) => {
    const q = busca.toLowerCase();
    return !q || e.tag?.toLowerCase().includes(q) || e.nome?.toLowerCase().includes(q)
      || e.fabricante?.toLowerCase().includes(q) || e.modelo?.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">SESMT · DMN ISO 9001</p>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Wrench className="h-6 w-6 text-red-700" /> Checklist de Equipamentos Móveis
          </h1>
          <p className="text-sm text-slate-500">Frota mecânica · Pá Carregadeira, Guindaste, Compressor, Draga, Guincho.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="font-black uppercase tracking-widest text-[11px]">
            <Link to="/app/sesmt/equipamentos-moveis/arquivos-mensais">
              <FolderArchive className="h-4 w-4 mr-1" /> Arquivos Mensais
            </Link>
          </Button>
          <Button onClick={() => { setEdit(null); setOpenNovo(true); }} className="bg-[#7B1E2B] hover:bg-[#5a1620] text-white font-black uppercase tracking-widest text-[11px]">
            <Plus className="h-4 w-4 mr-1" /> Novo Equipamento
          </Button>
        </div>
      </header>

      <Card>
        <CardContent className="p-3">
          <div className="relative max-w-md">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
            <Input className="pl-8" placeholder="Buscar por TAG, nome, fabricante..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>TAG</TableHead>
                <TableHead>Nome / Modelo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Horímetro</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Modelo Checklist</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {equipamentos.isLoading && (
                <TableRow><TableCell colSpan={7} className="text-center text-sm text-slate-400 py-8">Carregando…</TableCell></TableRow>
              )}
              {!equipamentos.isLoading && lista.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-sm text-slate-400 py-8">Nenhum equipamento cadastrado.</TableCell></TableRow>
              )}
              {lista.map((e) => {
                const modelo = modelos.data?.find((m) => m.id === e.modelo_checklist_id);
                return (
                  <TableRow key={e.id}>
                    <TableCell className="font-black">{e.tag}</TableCell>
                    <TableCell>
                      <div className="font-semibold">{e.nome}</div>
                      <div className="text-xs text-slate-500">{[e.fabricante, e.modelo].filter(Boolean).join(" · ")}</div>
                    </TableCell>
                    <TableCell><Badge variant="outline">{e.tipo}</Badge></TableCell>
                    <TableCell className="tabular-nums">{e.horimetro_atual ?? "—"} h</TableCell>
                    <TableCell>
                      <Badge className={STATUS_STYLE[e.status] ?? ""} variant="outline">{STATUS_LABEL[e.status] ?? e.status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{modelo ? `${modelo.codigo} · ${modelo.nome}` : <span className="text-amber-600 font-semibold">Não vinculado</span>}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button asChild size="sm" variant="outline" disabled={!e.modelo_checklist_id}>
                          <Link to="/app/sesmt/equipamentos-moveis/checklist/$equipamentoId" params={{ equipamentoId: e.id }}>
                            <ClipboardCheck className="h-3.5 w-3.5 mr-1" /> Checklist
                          </Link>
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <Link to="/app/sesmt/equipamentos-moveis/historico/$equipamentoId" params={{ equipamentoId: e.id }}>
                            <History className="h-3.5 w-3.5 mr-1" /> Histórico
                          </Link>
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setEdit(e); setOpenNovo(true); }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <EquipDialog
        open={openNovo}
        onClose={() => { setOpenNovo(false); setEdit(null); }}
        modelos={modelos.data ?? []}
        initial={edit}
        onSave={(p) => upsert.mutate(p)}
        saving={upsert.isPending}
      />
    </div>
  );
}

function EquipDialog({ open, onClose, modelos, initial, onSave, saving }: {
  open: boolean; onClose: () => void; modelos: Modelo[]; initial: Equip | null;
  onSave: (p: any) => void; saving: boolean;
}) {
  const [form, setForm] = useState<any>(() => initial ?? {
    tag: "", nome: "", tipo: "PA_CARREGADEIRA", fabricante: "", modelo: "",
    ano: null, numero_serie: "", numero_patrimonio: "", horimetro_atual: 0,
    status: "ATIVO", modelo_checklist_id: null, observacoes: "",
  });

  // Reset on open change
  if (open && initial && form.id !== initial.id) setForm(initial);
  if (open && !initial && form.id) setForm({
    tag: "", nome: "", tipo: "PA_CARREGADEIRA", fabricante: "", modelo: "",
    ano: null, numero_serie: "", numero_patrimonio: "", horimetro_atual: 0,
    status: "ATIVO", modelo_checklist_id: null, observacoes: "",
  });

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar Equipamento" : "Novo Equipamento"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>TAG *</Label>
            <Input value={form.tag ?? ""} onChange={(e) => set("tag", e.target.value.toUpperCase())} placeholder="PC-01" />
          </div>
          <div>
            <Label>Tipo *</Label>
            <Select value={form.tipo} onValueChange={(v) => set("tipo", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PA_CARREGADEIRA">Pá Carregadeira</SelectItem>
                <SelectItem value="GUINDASTE">Guindaste</SelectItem>
                <SelectItem value="COMPRESSOR">Compressor</SelectItem>
                <SelectItem value="DRAGA">Draga</SelectItem>
                <SelectItem value="GUINCHO">Guincho</SelectItem>
                <SelectItem value="ESCAVADEIRA">Escavadeira</SelectItem>
                <SelectItem value="OUTRO">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Nome / Descrição *</Label>
            <Input value={form.nome ?? ""} onChange={(e) => set("nome", e.target.value)} placeholder="Pá Carregadeira CAT 924K" />
          </div>
          <div>
            <Label>Fabricante</Label>
            <Input value={form.fabricante ?? ""} onChange={(e) => set("fabricante", e.target.value)} />
          </div>
          <div>
            <Label>Modelo</Label>
            <Input value={form.modelo ?? ""} onChange={(e) => set("modelo", e.target.value)} />
          </div>
          <div>
            <Label>Ano</Label>
            <Input type="number" value={form.ano ?? ""} onChange={(e) => set("ano", e.target.value ? parseInt(e.target.value) : null)} />
          </div>
          <div>
            <Label>Nº Patrimônio</Label>
            <Input value={form.numero_patrimonio ?? ""} onChange={(e) => set("numero_patrimonio", e.target.value)} />
          </div>
          <div>
            <Label>Nº Série</Label>
            <Input value={form.numero_serie ?? ""} onChange={(e) => set("numero_serie", e.target.value)} />
          </div>
          <div>
            <Label>Horímetro Atual</Label>
            <Input type="number" step="0.1" value={form.horimetro_atual ?? 0} onChange={(e) => set("horimetro_atual", parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ATIVO">Ativo</SelectItem>
                <SelectItem value="INATIVO">Inativo</SelectItem>
                <SelectItem value="MANUTENCAO">Em manutenção</SelectItem>
                <SelectItem value="BLOQUEADO">Bloqueado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Modelo de Checklist (DMN)</Label>
            <Select value={form.modelo_checklist_id ?? "NONE"} onValueChange={(v) => set("modelo_checklist_id", v === "NONE" ? null : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">— Não vinculado —</SelectItem>
                {modelos.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.codigo} · {m.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Observações</Label>
            <Textarea value={form.observacoes ?? ""} onChange={(e) => set("observacoes", e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => {
              if (!form.tag || !form.nome) { toast.error("TAG e Nome são obrigatórios"); return; }
              onSave(form);
            }}
            disabled={saving}
            className="bg-[#7B1E2B] hover:bg-[#5a1620] text-white"
          >Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}