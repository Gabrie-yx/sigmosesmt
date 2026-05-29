import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { UserPlus } from "lucide-react";

type Att = { id: string; employee_id: string; status: string; employees?: { nome: string } | null };

/**
 * Editor de presenças de um DDS já criado.
 * Marca/desmarca participantes e ao salvar:
 *  - atualiza dds_attendees.status (PRESENTE / AUSENTE)
 *  - recalcula dds.participantes_presentes e dds.aderencia
 */
export function DDSAttendeesEditor({
  ddsId,
  esperados,
  onSaved,
  autoSave = false,
}: {
  ddsId: string;
  esperados: number;
  onSaved?: () => void;
  autoSave?: boolean;
}) {
  const { data: attendees = [], refetch, isLoading } = useQuery({
    queryKey: ["dds-att-edit", ddsId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dds_attendees")
        .select("id, employee_id, status")
        .eq("dds_id", ddsId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const rows = (data ?? []) as { id: string; employee_id: string; status: string }[];
      const empIds = Array.from(new Set(rows.map((r) => r.employee_id)));
      let nomeMap: Record<string, string> = {};
      if (empIds.length > 0) {
        const { data: emps } = await supabase.from("employees").select("id, nome").in("id", empIds);
        nomeMap = Object.fromEntries((emps ?? []).map((e: any) => [e.id, e.nome]));
      }
      return rows.map((r) => ({ ...r, employees: { nome: nomeMap[r.employee_id] ?? "—" } })) as Att[];
    },
  });

  const [presentes, setPresentes] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState("");
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    setPresentes(new Set(attendees.filter((a) => a.status === "PRESENTE").map((a) => a.id)));
  }, [attendees]);

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    if (!q) return attendees;
    return attendees.filter((a) => (a.employees?.nome ?? "").toLowerCase().includes(q));
  }, [attendees, busca]);

  const total = attendees.length;
  const totalPresentes = presentes.size;
  const aderencia = esperados > 0 ? Math.round((totalPresentes / esperados) * 100) : 0;

  function toggle(id: string) {
    const novo = new Set(presentes);
    if (novo.has(id)) novo.delete(id); else novo.add(id);
    setPresentes(novo);
  }

  async function salvar() {
    setSaving(true);
    try {
      const presIds = Array.from(presentes);
      const ausIds = attendees.map((a) => a.id).filter((id) => !presentes.has(id));
      if (presIds.length > 0) {
        const { error } = await supabase.from("dds_attendees").update({ status: "PRESENTE" }).in("id", presIds);
        if (error) throw error;
      }
      if (ausIds.length > 0) {
        const { error } = await supabase.from("dds_attendees").update({ status: "AUSENTE" }).in("id", ausIds);
        if (error) throw error;
      }
      const { error: e2 } = await supabase
        .from("dds")
        .update({ participantes_presentes: totalPresentes })
        .eq("id", ddsId);
      if (e2) throw e2;
      toast.success("Presenças atualizadas");
      await refetch();
      onSaved?.();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return <div className="text-sm text-muted-foreground p-3">Carregando...</div>;
  if (total === 0) {
    return (
      <div className="space-y-2">
        <div className="text-sm text-muted-foreground p-3 text-center border rounded">Sem participantes registrados</div>
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
            <UserPlus className="h-4 w-4 mr-1" /> Adicionar funcionários
          </Button>
        </div>
        <AddAttendeesDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          ddsId={ddsId}
          jaIncluidos={new Set()}
          onAdded={async () => { await refetch(); onSaved?.(); }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Input placeholder="Buscar participante..." value={busca} onChange={(e) => setBusca(e.target.value)} className="h-8" />
        <Badge variant="outline">{totalPresentes}/{esperados || total} · {aderencia}%</Badge>
      </div>
      <div className="border rounded max-h-72 overflow-auto divide-y">
        {filtrados.map((a) => {
          const checked = presentes.has(a.id);
          return (
            <label key={a.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-sm">
              <Checkbox checked={checked} onCheckedChange={() => toggle(a.id)} />
              <span className="flex-1 truncate">{a.employees?.nome ?? "—"}</span>
              <span className={`text-[10px] font-bold ${checked ? "text-emerald-600" : "text-red-600"}`}>
                {checked ? "PRESENTE" : "AUSENTE"}
              </span>
            </label>
          );
        })}
      </div>
      <div className="flex justify-between items-center gap-2">
        <div className="text-xs text-muted-foreground">
          {totalPresentes} presente(s) · {total - totalPresentes} ausente(s)
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
            <UserPlus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
          <Button size="sm" variant="outline" onClick={() => setPresentes(new Set(attendees.map((a) => a.id)))}>Marcar todos</Button>
          <Button size="sm" variant="outline" onClick={() => setPresentes(new Set())}>Desmarcar</Button>
          <Button size="sm" onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Salvar presenças"}</Button>
        </div>
      </div>
      <AddAttendeesDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        ddsId={ddsId}
        jaIncluidos={new Set(attendees.map((a) => a.employee_id))}
        onAdded={async () => { await refetch(); onSaved?.(); }}
      />
    </div>
  );
}

function AddAttendeesDialog({
  open, onOpenChange, ddsId, jaIncluidos, onAdded,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ddsId: string;
  jaIncluidos: Set<string>;
  onAdded: () => void | Promise<void>;
}) {
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["dds-add-employees-all"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, nome, company_id, companies(name)")
        .order("nome", { ascending: true })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string; company_id: string | null; companies: { name: string } | null }[];
    },
  });

  const disponiveis = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return employees
      .filter((e) => !jaIncluidos.has(e.id))
      .filter((e) => !q || e.nome.toLowerCase().includes(q) || (e.companies?.name ?? "").toLowerCase().includes(q));
  }, [employees, busca, jaIncluidos]);

  function toggle(id: string) {
    const n = new Set(sel);
    if (n.has(id)) n.delete(id); else n.add(id);
    setSel(n);
  }

  async function adicionar() {
    if (sel.size === 0) return;
    setSaving(true);
    try {
      const rows = Array.from(sel).map((eid) => ({ dds_id: ddsId, employee_id: eid, status: "PRESENTE" }));
      const { error } = await supabase.from("dds_attendees").insert(rows);
      if (error) throw error;
      // recalcula presentes no DDS
      const { count } = await supabase
        .from("dds_attendees").select("id", { count: "exact", head: true })
        .eq("dds_id", ddsId).eq("status", "PRESENTE");
      await supabase.from("dds").update({ participantes_presentes: count ?? 0 }).eq("id", ddsId);
      toast.success(`${sel.size} funcionário(s) adicionado(s). Reabra o PDF para gerar novamente.`);
      setSel(new Set());
      setBusca("");
      await onAdded();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao adicionar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Adicionar funcionários ao DDS</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Input placeholder="Buscar por nome ou empresa..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          {isLoading ? (
            <div className="text-sm text-muted-foreground p-3">Carregando funcionários...</div>
          ) : (
            <div className="border rounded max-h-80 overflow-auto divide-y">
              {disponiveis.slice(0, 300).map((e) => {
                const checked = sel.has(e.id);
                return (
                  <label key={e.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-sm">
                    <Checkbox checked={checked} onCheckedChange={() => toggle(e.id)} />
                    <span className="flex-1 truncate">{e.nome}</span>
                    <span className="text-[10px] text-muted-foreground truncate max-w-[140px]">{e.companies?.name ?? ""}</span>
                  </label>
                );
              })}
              {disponiveis.length === 0 && (
                <div className="text-xs text-muted-foreground p-3 text-center">Nenhum funcionário disponível</div>
              )}
            </div>
          )}
          <div className="text-xs text-muted-foreground">{sel.size} selecionado(s)</div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={adicionar} disabled={saving || sel.size === 0}>
            {saving ? "Adicionando..." : `Adicionar ${sel.size > 0 ? `(${sel.size})` : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}