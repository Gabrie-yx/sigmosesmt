import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { downloadRelatorioEntregasPdf, type EntregaRow } from "@/lib/relatorio-entregas-pdf";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  responsavel?: string | null;
};

function firstDayOfMonthISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function RelatorioEntregasDialog({ open, onOpenChange, responsavel }: Props) {
  const [inicio, setInicio] = useState(firstDayOfMonthISO());
  const [fim, setFim] = useState(todayISO());
  const [agrupamento, setAgrupamento] = useState<"semanal" | "mensal">("semanal");
  const [epiId, setEpiId] = useState<string>("__ALL__");
  const [gerando, setGerando] = useState(false);

  const { data: epis = [] } = useQuery({
    queryKey: ["estoque_epi_select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque_epi")
        .select("id, nome_material, codigo_material, ca")
        .order("nome_material");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const epiMap = useMemo(() => {
    const m = new Map<string, { nome: string; codigo: string; ca: string | null }>();
    epis.forEach((e: any) => m.set(e.id, { nome: e.nome_material, codigo: e.codigo_material, ca: e.ca }));
    return m;
  }, [epis]);

  async function gerar() {
    if (!inicio || !fim) { toast.error("Informe o período"); return; }
    if (inicio > fim) { toast.error("Data inicial deve ser anterior à final"); return; }
    setGerando(true);
    try {
      let query = supabase
        .from("historico_entregas")
        .select("*")
        .eq("tipo_movimentacao", "SAIDA_ENTREGA")
        .gte("data_entrega", `${inicio}T00:00:00`)
        .lte("data_entrega", `${fim}T23:59:59`)
        .order("data_entrega", { ascending: true })
        .limit(5000);
      if (epiId !== "__ALL__") query = query.eq("epi_id", epiId);

      const { data, error } = await query;
      if (error) throw error;
      const rows = (data ?? []) as Array<{
        epi_id: string; data_entrega: string; quantidade_entregue: number;
        nome_colaborador: string; cpf_colaborador: string;
      }>;

      if (rows.length === 0) {
        toast.warning("Nenhuma entrega encontrada no período");
        setGerando(false);
        return;
      }

      const mapped: EntregaRow[] = rows.map((r) => {
        const e = epiMap.get(r.epi_id);
        return {
          data_entrega: r.data_entrega,
          epi_nome: e?.nome ?? "EPI removido",
          epi_codigo: e?.codigo ?? "",
          ca: e?.ca ?? null,
          nome_colaborador: r.nome_colaborador ?? "",
          cpf_colaborador: r.cpf_colaborador ?? "",
          quantidade: r.quantidade_entregue ?? 0,
        };
      });

      const filtroEpi = epiId !== "__ALL__" ? epiMap.get(epiId)?.nome ?? null : null;

      downloadRelatorioEntregasPdf({
        rows: mapped,
        inicio, fim, agrupamento,
        filtroEpi,
        responsavel: responsavel ?? null,
      });
      toast.success(`PDF gerado · ${rows.length} entrega(s)`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar relatório");
    } finally {
      setGerando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
        <DialogHeader>
          <DialogTitle>Relatório de Entregas de EPI</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Data inicial</Label>
              <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Data final</Label>
              <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-xs">Agrupar por</Label>
            <Select value={agrupamento} onValueChange={(v) => setAgrupamento(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="semanal">Semanal (segunda a domingo)</SelectItem>
                <SelectItem value="mensal">Mensal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">EPI</Label>
            <Select value={epiId} onValueChange={setEpiId}>
              <SelectTrigger><SelectValue placeholder="Todos os EPIs" /></SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="__ALL__">Todos os EPIs</SelectItem>
                {epis.map((e: any) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nome_material} {e.ca ? `· CA ${e.ca}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-md p-2">
            O PDF traz totais por {agrupamento === "semanal" ? "semana" : "mês"} e o detalhamento de cada entrega
            (data, EPI, CA, colaborador, CPF e quantidade). Inclui bloco de assinatura.
          </div>
        </div>
        <DialogFooter className="flex-row justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={gerando}>Cancelar</Button>
          <Button size="sm" onClick={gerar} disabled={gerando} className="bg-brand text-white">
            {gerando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileDown className="h-4 w-4 mr-2" />}
            Gerar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}