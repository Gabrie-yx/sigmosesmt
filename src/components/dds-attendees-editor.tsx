import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

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
  if (total === 0) return <div className="text-sm text-muted-foreground p-3 text-center border rounded">Sem participantes registrados</div>;

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
          <Button size="sm" variant="outline" onClick={() => setPresentes(new Set(attendees.map((a) => a.id)))}>Marcar todos</Button>
          <Button size="sm" variant="outline" onClick={() => setPresentes(new Set())}>Desmarcar</Button>
          <Button size="sm" onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Salvar presenças"}</Button>
        </div>
      </div>
    </div>
  );
}