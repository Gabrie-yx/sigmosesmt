import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { addMonthsToDate } from "@/lib/utils-date";
import { NATUREZAS_EXAME } from "@/lib/constants";

/**
 * Registro rápido do ÚLTIMO ASO de um funcionário.
 * Grava em employee_exams (fonte oficial) e sincroniza employees.data_aso (legado),
 * que é o campo lido por organograma, safety-engine e pendências.
 */
export function AsoEditarDialog({
  open,
  onOpenChange,
  employee,
  atual,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employee: { id: string; nome: string } | null;
  atual?: { data_realizacao?: string | null; natureza?: string | null; periodicidade?: number | null } | null;
  onSaved?: () => void;
}) {
  const [dataRealizacao, setDataRealizacao] = useState("");
  const [natureza, setNatureza] = useState<string>("Periódico");
  const [periodicidade, setPeriodicidade] = useState<number>(12);
  const [vencimento, setVencimento] = useState("");
  const [aptidao, setAptidao] = useState("SIM");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const d = atual?.data_realizacao?.slice(0, 10) ?? "";
    const p = atual?.periodicidade || 12;
    setDataRealizacao(d);
    setNatureza(atual?.natureza || "Periódico");
    setPeriodicidade(p);
    setVencimento(d ? addMonthsToDate(d, p) : "");
    setAptidao("SIM");
  }, [open, atual]);

  useEffect(() => {
    if (dataRealizacao) setVencimento(addMonthsToDate(dataRealizacao, Number(periodicidade) || 12));
  }, [dataRealizacao, periodicidade]);

  async function salvar() {
    if (!employee) return;
    if (!dataRealizacao) { toast.error("Informe a data do último exame."); return; }
    setSaving(true);
    try {
      const venc = vencimento || addMonthsToDate(dataRealizacao, Number(periodicidade) || 12);
      const { error } = await supabase.from("employee_exams").insert({
        employee_id: employee.id,
        tipo_exame: "ASO Clínico",
        natureza,
        periodicidade_meses: Number(periodicidade) || 12,
        data_realizacao: dataRealizacao,
        data_vencimento: venc,
        aptidao,
        observacoes: "Registro histórico informado pelo SESMT (relação de ASOs da clínica).",
      });
      if (error) throw error;
      await supabase.from("employees").update({ data_aso: dataRealizacao }).eq("id", employee.id);
      toast.success(`ASO de ${employee.nome} atualizado — vence em ${venc.split("-").reverse().join("/")}.`);
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao salvar ASO");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Último ASO — {employee?.nome ?? ""}</DialogTitle>
          <DialogDescription>
            Alimenta a data que aparece no ofício de convocação ("Último ASO realizado em… / Vencimento previsto em…").
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest">Data do último exame *</Label>
            <Input type="date" value={dataRealizacao} onChange={(e) => setDataRealizacao(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest">Natureza</Label>
            <Select value={natureza} onValueChange={setNatureza}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {NATUREZAS_EXAME.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest">Periodicidade (meses)</Label>
            <Input
              type="number" min={1} max={60}
              value={periodicidade}
              onChange={(e) => setPeriodicidade(Number(e.target.value) || 12)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest">Vencimento</Label>
            <Input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label className="text-[10px] font-black uppercase tracking-widest">Aptidão</Label>
            <Select value={aptidao} onValueChange={setAptidao}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SIM">APTO</SelectItem>
                <SelectItem value="NÃO">INAPTO</SelectItem>
                <SelectItem value="APTO COM RESTRIÇÃO">Apto com restrição</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>{saving ? "Salvando…" : "Salvar ASO"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
