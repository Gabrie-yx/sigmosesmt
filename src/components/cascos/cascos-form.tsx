import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export interface CascoRecord {
  id: string;
  numero: string;
  nome: string | null;
  empresa_responsavel_id: string | null;
  encarregado_id: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  status: string;
  observacoes: string | null;
}

interface Props {
  initial: CascoRecord | null;
  companies: { id: string; name: string }[];
  employees: { id: string; nome: string }[];
  onDone: () => void;
}

export function CascoForm({ initial, companies, employees, onDone }: Props) {
  const [numero, setNumero] = useState(initial?.numero ?? "");
  const [nome, setNome] = useState(initial?.nome ?? "");
  const [empresaId, setEmpresaId] = useState(initial?.empresa_responsavel_id ?? "");
  const [encarregadoId, setEncarregadoId] = useState(initial?.encarregado_id ?? "");
  const [dataInicio, setDataInicio] = useState(initial?.data_inicio ?? "");
  const [dataFim, setDataFim] = useState(initial?.data_fim ?? "");
  const [status, setStatus] = useState(initial?.status ?? "ATIVO");
  const [obs, setObs] = useState(initial?.observacoes ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!numero.trim()) {
      toast.error("Número do casco é obrigatório");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        numero: numero.trim(),
        nome: nome.trim() || null,
        empresa_responsavel_id: empresaId || null,
        encarregado_id: encarregadoId || null,
        data_inicio: dataInicio || null,
        data_fim: dataFim || null,
        status,
        observacoes: obs.trim() || null,
      };
      if (initial) {
        const { error } = await supabase.from("cascos").update(payload).eq("id", initial.id);
        if (error) throw error;
        toast.success("Casco atualizado");
      } else {
        const { error } = await supabase.from("cascos").insert(payload);
        if (error) throw error;
        toast.success("Casco cadastrado");
      }
      onDone();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label className="text-[10px] font-black uppercase">Número *</Label>
          <Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Ex: C-2026-001" />
        </div>
        <div className="md:col-span-2">
          <Label className="text-[10px] font-black uppercase">Nome / Identificação</Label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Embarcação Atlântico" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-[10px] font-black uppercase">Empresa Responsável</Label>
          <Select value={empresaId} onValueChange={setEmpresaId}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] font-black uppercase">Encarregado</Label>
          <Select value={encarregadoId} onValueChange={setEncarregadoId}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label className="text-[10px] font-black uppercase">Data Início</Label>
          <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
        </div>
        <div>
          <Label className="text-[10px] font-black uppercase">Data Fim Previsto</Label>
          <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
        </div>
        <div>
          <Label className="text-[10px] font-black uppercase">Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ATIVO">Ativo</SelectItem>
              <SelectItem value="PAUSADO">Pausado</SelectItem>
              <SelectItem value="CONCLUIDO">Concluído</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="text-[10px] font-black uppercase">Observações</Label>
        <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onDone} disabled={saving}>Cancelar</Button>
        <Button onClick={save} disabled={saving} className="bg-red-700 hover:bg-red-800 text-white">
          {saving ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </div>
  );
}