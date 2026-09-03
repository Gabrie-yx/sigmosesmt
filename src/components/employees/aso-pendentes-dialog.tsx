import { useMemo, useState, lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, AlertTriangle } from "lucide-react";
import { computeAso, diasParaVencer, fmtDate, type ExamRow } from "@/lib/aso-status";
import { gerarPdfAsoPendentes, type LinhaAsoPendente } from "@/lib/aso-pendentes-pdf";
import type jsPDFType from "jspdf";

const PDFPreviewDialog = lazy(() =>
  import("@/components/pdf-preview-dialog").then((m) => ({ default: m.PDFPreviewDialog })),
);

type Situacao = "PENDENTES" | "VENCIDO" | "SEM_ASO" | "A_VENCER";

const SITUACAO_LABEL: Record<Situacao, string> = {
  PENDENTES: "Vencidos e sem ASO",
  VENCIDO: "Somente vencidos",
  SEM_ASO: "Somente sem ASO",
  A_VENCER: "A vencer (dentro do período)",
};

export function AsoPendentesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [companyFilter, setCompanyFilter] = useState("TODAS");
  const [situacao, setSituacao] = useState<Situacao>("PENDENTES");
  const [ini, setIni] = useState("");
  const [fim, setFim] = useState("");
  const [pdf, setPdf] = useState<{ doc: jsPDFType; fileName: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["aso-pendentes-relatorio", open],
    enabled: open,
    queryFn: async () => {
      const [empQ, exQ, cQ, rQ] = await Promise.all([
        supabase.from("employees").select("id, nome, matricula, company_id, role_id, data_aso, status").eq("status", "ATIVO").order("nome").limit(5000),
        supabase.from("employee_exams").select("employee_id, tipo_exame, natureza, data_realizacao, data_vencimento, periodicidade_meses, aptidao").limit(20000),
        supabase.from("companies").select("id, name").order("name"),
        supabase.from("roles").select("id, name"),
      ]);
      if (empQ.error) throw empQ.error;
      return {
        emps: empQ.data ?? [],
        exams: (exQ.data ?? []) as ExamRow[],
        companies: cQ.data ?? [],
        roles: rQ.data ?? [],
      };
    },
  });

  const linhas: LinhaAsoPendente[] = useMemo(() => {
    if (!data) return [];
    const cMap = new Map(data.companies.map((c: any) => [c.id, c.name]));
    const rMap = new Map(data.roles.map((r: any) => [r.id, r.name]));
    const byEmp = new Map<string, ExamRow[]>();
    for (const ex of data.exams) {
      const arr = byEmp.get(ex.employee_id) ?? [];
      arr.push(ex);
      byEmp.set(ex.employee_id, arr);
    }

    const out: LinhaAsoPendente[] = [];
    for (const e of data.emps as any[]) {
      if (companyFilter !== "TODAS" && e.company_id !== companyFilter) continue;
      const info = computeAso(byEmp.get(e.id) ?? [], e.data_aso);
      const dias = diasParaVencer(info);
      const semAso = info.origem === "NENHUM" || !info.vencimento;
      const sit: LinhaAsoPendente["situacao"] = semAso ? "SEM ASO" : (dias as number) < 0 ? "VENCIDO" : "A VENCER";

      if (situacao === "VENCIDO" && sit !== "VENCIDO") continue;
      if (situacao === "SEM_ASO" && sit !== "SEM ASO") continue;
      if (situacao === "A_VENCER" && sit !== "A VENCER") continue;
      if (situacao === "PENDENTES" && sit === "A VENCER") continue;

      // Período aplica-se à data de vencimento (quem não tem ASO não tem data).
      if ((ini || fim) && !semAso) {
        const v = info.vencimento!.toISOString().slice(0, 10);
        if (ini && v < ini) continue;
        if (fim && v > fim) continue;
      }
      if ((ini || fim) && semAso && situacao === "A_VENCER") continue;

      out.push({
        matricula: e.matricula ?? null,
        nome: e.nome,
        cargo: (rMap.get(e.role_id) as string) ?? "",
        empresa: (cMap.get(e.company_id) as string) ?? "",
        ultimo: info.ultimo ? fmtDate(info.ultimo) : null,
        vencimento: info.vencimento ? fmtDate(info.vencimento) : null,
        situacao: sit,
        dias: semAso ? null : dias,
      });
    }
    return out.sort((a, b) => (a.dias ?? -99999) - (b.dias ?? -99999) || a.nome.localeCompare(b.nome, "pt-BR"));
  }, [data, companyFilter, situacao, ini, fim]);

  const empresaLabel = companyFilter === "TODAS"
    ? "Todas"
    : ((data?.companies as any[])?.find((c) => c.id === companyFilter)?.name ?? "—");

  function gerar() {
    const periodoLabel = ini || fim
      ? `Vencimento: ${ini ? ini.split("-").reverse().join("/") : "início"} a ${fim ? fim.split("-").reverse().join("/") : "hoje em diante"}`
      : "Período: todo o histórico";
    const doc = gerarPdfAsoPendentes(linhas, {
      empresaLabel,
      situacaoLabel: SITUACAO_LABEL[situacao],
      periodoLabel,
    });
    setPdf({ doc, fileName: `ASOs_pendentes_${empresaLabel.replace(/\s+/g, "_")}.pdf` });
  }

  const totVenc = linhas.filter((l) => l.situacao === "VENCIDO").length;
  const totSem = linhas.filter((l) => l.situacao === "SEM ASO").length;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-300" /> ASOs atrasados / sem ASO
            </DialogTitle>
            <DialogDescription>
              Colaboradores ativos com ASO vencido ou sem registro (NR-07). Filtre por empresa e por período de vencimento e emita o relatório em PDF.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Empresa</Label>
              <Select value={companyFilter} onValueChange={setCompanyFilter}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODAS">Todas as empresas</SelectItem>
                  {(data?.companies ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Situação</Label>
              <Select value={situacao} onValueChange={(v) => setSituacao(v as Situacao)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(SITUACAO_LABEL) as Situacao[]).map((s) => (
                    <SelectItem key={s} value={s}>{SITUACAO_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Vencimento de</Label>
              <Input type="date" className="h-9" value={ini} onChange={(e) => setIni(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Vencimento até</Label>
              <Input type="date" className="h-9" value={fim} onChange={(e) => setFim(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <Badge className="bg-red-500/15 text-red-200 ring-1 ring-red-400/30">{totVenc} vencidos</Badge>
            <Badge className="bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/30">{totSem} sem ASO</Badge>
            <Badge variant="outline">{linhas.length} no relatório</Badge>
          </div>

          <div className="flex-1 overflow-y-auto rounded-lg border border-white/10 divide-y divide-white/5 min-h-[180px]">
            {isLoading && <div className="p-4 text-sm text-slate-400">Carregando…</div>}
            {!isLoading && linhas.length === 0 && (
              <div className="p-6 text-sm text-emerald-300">Nenhum colaborador nessa condição. 🎉</div>
            )}
            {linhas.map((l, i) => (
              <div key={`${l.nome}-${i}`} className="flex items-center gap-3 px-3 py-2 text-xs">
                <span className="w-8 text-slate-500 tabular-nums">{String(i + 1).padStart(3, "0")}</span>
                <span className="flex-1 truncate text-white">{l.nome}</span>
                <span className="hidden md:block w-40 truncate text-slate-400">{l.cargo || "—"}</span>
                <span className="hidden md:block w-40 truncate text-slate-400">{l.empresa || "—"}</span>
                <span className="w-24 tabular-nums text-slate-400">{l.ultimo ?? "—"}</span>
                <span className="w-24 tabular-nums">{l.vencimento ?? "—"}</span>
                <span className={`w-28 text-right font-semibold ${l.situacao === "VENCIDO" ? "text-red-300" : l.situacao === "SEM ASO" ? "text-amber-300" : "text-emerald-300"}`}>
                  {l.situacao === "SEM ASO" ? "SEM ASO" : l.dias !== null && l.dias < 0 ? `${Math.abs(l.dias)}d atraso` : `${l.dias}d`}
                </span>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
            <Button onClick={gerar} disabled={linhas.length === 0} className="gap-1.5">
              <FileText className="h-4 w-4" /> Gerar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {pdf && (
        <Suspense fallback={null}>
          <PDFPreviewDialog
            open={!!pdf}
            onClose={() => setPdf(null)}
            doc={pdf.doc}
            fileName={pdf.fileName}
            title="ASOs atrasados / sem ASO"
          />
        </Suspense>
      )}
    </>
  );
}
