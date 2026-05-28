import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, ShieldCheck, AlertTriangle } from "lucide-react";

type Row = {
  id: string;
  intensidade: number | null;
  unidade: string | null;
  limite_tolerancia: number | null;
  tecnica_medicao: string | null;
  fonte_geradora: string | null;
  epi_atenuacao_db: number | null;
  status_avaliacao: "AVALIADO" | "PENDENTE" | "NAO_APLICAVEL" | "EM_REVISAO";
  insalubridade_grau: "MINIMO" | "MEDIO" | "MAXIMO" | "NAO_INSALUBRE" | null;
  periculosidade: boolean;
  aposentadoria_especial_anos: number | null;
  data_avaliacao: string | null;
  observacao: string | null;
  catalogo_riscos: { nome: string; categoria: string } | null;
  roles: { name: string } | null;
};

export function EditarCargoRiscoDialog({
  row, open, onOpenChange,
}: { row: Row | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<Partial<Row>>({});

  useEffect(() => {
    if (row) setForm({ ...row });
  }, [row]);

  const mut = useMutation({
    mutationFn: async () => {
      if (!row) throw new Error("Sem registro");
      const dataAvaliacao =
        form.status_avaliacao === "AVALIADO" && !form.data_avaliacao
          ? new Date().toISOString().slice(0, 10)
          : form.data_avaliacao ?? null;
      const { error } = await supabase
        .from("cargo_riscos")
        .update({
          intensidade: form.intensidade ?? null,
          unidade: form.unidade?.trim() || null,
          limite_tolerancia: form.limite_tolerancia ?? null,
          tecnica_medicao: form.tecnica_medicao?.trim() || null,
          fonte_geradora: form.fonte_geradora?.trim() || null,
          epi_atenuacao_db: form.epi_atenuacao_db ?? null,
          status_avaliacao: form.status_avaliacao ?? "EM_REVISAO",
          insalubridade_grau: form.insalubridade_grau ?? null,
          periculosidade: !!form.periculosidade,
          aposentadoria_especial_anos: form.aposentadoria_especial_anos ?? null,
          observacao: form.observacao?.trim() || null,
          data_avaliacao: dataAvaliacao,
        })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Risco atualizado com sucesso ✅");
      qc.invalidateQueries({ queryKey: ["cargo_riscos"] });
      onOpenChange(false);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });

  if (!row) return null;

  const setField = <K extends keyof Row>(k: K, v: Row[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const setNumOrNull = (k: keyof Row, v: string) => {
    const n = v.trim() === "" ? null : Number(v);
    setForm((f) => ({ ...f, [k]: Number.isNaN(n as number) ? null : n }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-rose-600" />
            Validar risco — {row.catalogo_riscos?.nome}
          </DialogTitle>
          <DialogDescription>
            Cargo: <b>{row.roles?.name}</b> · Categoria: {row.catalogo_riscos?.categoria}
          </DialogDescription>
        </DialogHeader>

        {form.status_avaliacao === "EM_REVISAO" && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Este risco foi pré-mapeado. Confirme com o LTCAT/PGR oficial antes de marcar como <b>Avaliado</b>.
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
          <div className="md:col-span-2">
            <Label>Status da avaliação</Label>
            <Select
              value={form.status_avaliacao ?? "EM_REVISAO"}
              onValueChange={(v) => setField("status_avaliacao", v as Row["status_avaliacao"])}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="EM_REVISAO">🟡 Em revisão (pendente validação)</SelectItem>
                <SelectItem value="AVALIADO">🟢 Avaliado (laudo conferido)</SelectItem>
                <SelectItem value="PENDENTE">🔴 Pendente (precisa medir)</SelectItem>
                <SelectItem value="NAO_APLICAVEL">⚪ Não aplicável</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Intensidade medida</Label>
            <Input
              type="number" step="0.01"
              value={form.intensidade ?? ""}
              onChange={(e) => setNumOrNull("intensidade", e.target.value)}
              placeholder="Ex: 92"
            />
          </div>
          <div>
            <Label>Unidade</Label>
            <Input
              value={form.unidade ?? ""}
              onChange={(e) => setField("unidade", e.target.value)}
              placeholder="dB(A), mg/m³, °C..."
            />
          </div>

          <div>
            <Label>Limite de tolerância (NR-15)</Label>
            <Input
              type="number" step="0.01"
              value={form.limite_tolerancia ?? ""}
              onChange={(e) => setNumOrNull("limite_tolerancia", e.target.value)}
              placeholder="Ex: 85"
            />
          </div>
          <div>
            <Label>EPI atenua (dB)</Label>
            <Input
              type="number" step="0.1"
              value={form.epi_atenuacao_db ?? ""}
              onChange={(e) => setNumOrNull("epi_atenuacao_db", e.target.value)}
              placeholder="Ex: 25"
            />
          </div>

          <div className="md:col-span-2">
            <Label>Técnica de medição</Label>
            <Input
              value={form.tecnica_medicao ?? ""}
              onChange={(e) => setField("tecnica_medicao", e.target.value)}
              placeholder="Dosimetria NHO-01, IBUTG NHO-06, gravimetria..."
            />
          </div>

          <div className="md:col-span-2">
            <Label>Fonte geradora</Label>
            <Input
              value={form.fonte_geradora ?? ""}
              onChange={(e) => setField("fonte_geradora", e.target.value)}
              placeholder="Equipamento, processo ou ambiente que gera o agente"
            />
          </div>

          <div>
            <Label>Grau de insalubridade (NR-15)</Label>
            <Select
              value={form.insalubridade_grau ?? "NAO_INSALUBRE"}
              onValueChange={(v) => setField("insalubridade_grau", v as Row["insalubridade_grau"])}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NAO_INSALUBRE">Não insalubre</SelectItem>
                <SelectItem value="MINIMO">Mínimo (10%)</SelectItem>
                <SelectItem value="MEDIO">Médio (20%)</SelectItem>
                <SelectItem value="MAXIMO">Máximo (40%)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Aposent. especial (anos)</Label>
            <Select
              value={form.aposentadoria_especial_anos == null ? "NAO" : String(form.aposentadoria_especial_anos)}
              onValueChange={(v) =>
                setField("aposentadoria_especial_anos", v === "NAO" ? null : Number(v))
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NAO">Não dá direito</SelectItem>
                <SelectItem value="15">15 anos</SelectItem>
                <SelectItem value="20">20 anos</SelectItem>
                <SelectItem value="25">25 anos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2 flex items-center justify-between rounded-md border p-3 bg-rose-50/40">
            <div>
              <Label className="text-rose-900">Periculosidade (NR-16)</Label>
              <p className="text-xs text-rose-700/80 mt-0.5">
                Eletricidade SEP &gt;250V, inflamáveis, explosivos, radiação ionizante etc. — adicional de 30%
              </p>
            </div>
            <Switch
              checked={!!form.periculosidade}
              onCheckedChange={(v) => setField("periculosidade", v)}
            />
          </div>

          <div>
            <Label>Data da avaliação</Label>
            <Input
              type="date"
              value={form.data_avaliacao ?? ""}
              onChange={(e) => setField("data_avaliacao", e.target.value || null)}
            />
          </div>

          <div className="md:col-span-2">
            <Label>Observação / referência do laudo</Label>
            <Textarea
              rows={3}
              value={form.observacao ?? ""}
              onChange={(e) => setField("observacao", e.target.value)}
              placeholder="Ex: LTCAT 2025 página 12 — assinado por Eng. João Silva CREA-XX"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mut.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending} className="bg-rose-600 hover:bg-rose-700">
            {mut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}