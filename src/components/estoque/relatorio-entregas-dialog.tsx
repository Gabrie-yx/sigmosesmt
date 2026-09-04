import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type jsPDF from "jspdf";
import { PDFPreviewDialog } from "@/components/pdf-preview-dialog";
import { buildRelatorioEntregasPdf, type EntregaRow } from "@/lib/relatorio-entregas-pdf";

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

/** "BOTA DE SEGURANÇA BRACOL - 41" -> "BOTA DE SEGURANÇA BRACOL" (tipo, sem tamanho) */
function tipoDoItem(item: string): string {
  return (item || "—")
    .split(/\s+[-–]\s+/)[0]
    .trim()
    .toUpperCase();
}

export function RelatorioEntregasDialog({ open, onOpenChange, responsavel }: Props) {
  const [inicio, setInicio] = useState(firstDayOfMonthISO());
  const [fim, setFim] = useState(todayISO());
  const [agrupamento, setAgrupamento] = useState<"semanal" | "mensal" | "epi">("epi");
  const [tipoEpi, setTipoEpi] = useState<string>("__ALL__");
  const [companyId, setCompanyId] = useState<string>("__ALL__");
  const [gerando, setGerando] = useState(false);
  const [doc, setDoc] = useState<jsPDF | null>(null);

  const { data: companies = [] } = useQuery({
    queryKey: ["companies_relatorio_epi"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, razao_social, nome_fantasia")
        .order("razao_social");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const { data: tipos = [] } = useQuery({
    queryKey: ["tipos_epi_entregues"],
    queryFn: async () => {
      const { data, error } = await supabase.from("epi_deliveries").select("item").limit(20000);
      if (error) throw error;
      const set = new Set<string>();
      (data ?? []).forEach((r: any) => r.item && set.add(tipoDoItem(r.item)));
      return Array.from(set).sort();
    },
    enabled: open,
  });

  const empresaNome = useMemo(() => {
    if (companyId === "__ALL__") return null;
    const c: any = companies.find((x: any) => x.id === companyId);
    return c ? (c.razao_social ?? c.nome_fantasia ?? null) : null;
  }, [companyId, companies]);

  async function gerar() {
    if (!inicio || !fim) { toast.error("Informe o período"); return; }
    if (inicio > fim) { toast.error("Data inicial deve ser anterior à final"); return; }
    setGerando(true);
    try {
      const { data: entregas, error } = await supabase
        .from("epi_deliveries")
        .select("employee_id, item, ca, tamanho, qtd, data_entrega")
        .gte("data_entrega", inicio)
        .lte("data_entrega", fim)
        .order("data_entrega", { ascending: true })
        .limit(20000);
      if (error) throw error;

      const list = (entregas ?? []) as Array<{
        employee_id: string; item: string | null; ca: string | null;
        tamanho: string | null; qtd: number | null; data_entrega: string;
      }>;

      const ids = Array.from(new Set(list.map((e) => e.employee_id).filter(Boolean)));
      const empMap = new Map<string, { nome: string; cpf: string | null; company_id: string | null }>();
      for (let i = 0; i < ids.length; i += 200) {
        const { data: emps, error: e2 } = await supabase
          .from("employees")
          .select("id, nome, cpf, company_id")
          .in("id", ids.slice(i, i + 200));
        if (e2) throw e2;
        (emps ?? []).forEach((e: any) => empMap.set(e.id, { nome: e.nome, cpf: e.cpf, company_id: e.company_id }));
      }
      const compMap = new Map<string, string>();
      (companies as any[]).forEach((c) => compMap.set(c.id, c.razao_social ?? c.nome_fantasia ?? "—"));

      const rows: EntregaRow[] = list
        .filter((r) => {
          const emp = empMap.get(r.employee_id);
          if (companyId !== "__ALL__" && emp?.company_id !== companyId) return false;
          if (tipoEpi !== "__ALL__" && tipoDoItem(r.item ?? "") !== tipoEpi) return false;
          return true;
        })
        .map((r) => {
          const emp = empMap.get(r.employee_id);
          return {
            data_entrega: r.data_entrega,
            epi_nome: r.item ?? "—",
            epi_codigo: "",
            ca: r.ca && r.ca !== "N/A" ? r.ca : null,
            tamanho: r.tamanho,
            nome_colaborador: emp?.nome ?? "—",
            cpf_colaborador: emp?.cpf ?? "",
            empresa: emp?.company_id ? (compMap.get(emp.company_id) ?? "—") : "—",
            quantidade: r.qtd ?? 0,
          };
        });

      if (rows.length === 0) {
        toast.warning("Nenhuma entrega encontrada com esses filtros");
        return;
      }

      setDoc(
        buildRelatorioEntregasPdf({
          rows,
          inicio, fim, agrupamento,
          filtroEpi: tipoEpi !== "__ALL__" ? tipoEpi : null,
          filtroEmpresa: empresaNome,
          responsavel: responsavel ?? null,
        }),
      );
      toast.success(`Relatório gerado · ${rows.length} entrega(s)`);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar relatório");
    } finally {
      setGerando(false);
    }
  }

  return (
    <>
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
              <Label className="text-xs">Empresa</Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger><SelectValue placeholder="Todas as empresas" /></SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="__ALL__">Todas as empresas</SelectItem>
                  {companies.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.razao_social ?? c.nome_fantasia}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Tipo de EPI</Label>
              <Select value={tipoEpi} onValueChange={setTipoEpi}>
                <SelectTrigger><SelectValue placeholder="Todos os tipos" /></SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="__ALL__">Todos os tipos de EPI</SelectItem>
                  {tipos.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Agrupar por</Label>
              <Select value={agrupamento} onValueChange={(v) => setAgrupamento(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="epi">Tipo de EPI</SelectItem>
                  <SelectItem value="semanal">Semanal (segunda a domingo)</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="text-[11px] text-muted-foreground bg-muted/40 border border-border rounded-md p-2">
              O PDF traz o resumo por {agrupamento === "epi" ? "tipo de EPI" : agrupamento === "semanal" ? "semana" : "mês"} e
              o detalhamento de cada entrega (data, EPI, CA, colaborador, empresa e quantidade). Inclui bloco de assinatura.
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

      <PDFPreviewDialog
        open={!!doc}
        onClose={() => setDoc(null)}
        doc={doc}
        fileName={`relatorio-entregas-epi-${inicio}-a-${fim}.pdf`}
        title="Relatório de Entregas de EPI"
      />
    </>
  );
}
