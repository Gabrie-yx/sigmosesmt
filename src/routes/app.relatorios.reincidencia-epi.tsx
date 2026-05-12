import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, ChevronRight, FileWarning, Repeat } from "lucide-react";
import { formatDateBR } from "@/lib/utils-date";

export const Route = createFileRoute("/app/relatorios/reincidencia-epi")({
  component: ReincidenciaEpiPage,
});

type Periodo = "30" | "60" | "90" | "180" | "365";

function ReincidenciaEpiPage() {
  const [periodo, setPeriodo] = useState<Periodo>("30");
  const [minOcorrencias, setMinOcorrencias] = useState<string>("2");

  const { data: deliveries, isLoading } = useQuery({
    queryKey: ["reincidencia-epi", periodo],
    queryFn: async () => {
      const cutoff = new Date(Date.now() - Number(periodo) * 86400000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("epi_deliveries")
        .select("id, employee_id, item, qtd, data_entrega, motivo_entrega, valor_unitario, observacoes")
        .eq("motivo_entrega", "PERDA_EXTRAVIO")
        .gte("data_entrega", cutoff)
        .order("data_entrega", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: emps } = useQuery({
    queryKey: ["employees-min"],
    queryFn: async () => (await supabase.from("employees").select("id, nome, cpf, matricula, company_id, role_id")).data ?? [],
  });
  const { data: companies } = useQuery({
    queryKey: ["companies-min"],
    queryFn: async () => (await supabase.from("companies").select("id, name")).data ?? [],
  });
  const { data: roles } = useQuery({
    queryKey: ["roles-min"],
    queryFn: async () => (await supabase.from("roles").select("id, name")).data ?? [],
  });

  const empMap = useMemo(() => new Map((emps ?? []).map((e: any) => [e.id, e])), [emps]);
  const cMap = useMemo(() => new Map((companies ?? []).map((c: any) => [c.id, c.name])), [companies]);
  const rMap = useMemo(() => new Map((roles ?? []).map((r: any) => [r.id, r.name])), [roles]);

  // agrupa por colaborador
  const grouped = useMemo(() => {
    const min = Math.max(2, Number(minOcorrencias) || 2);
    const byEmp = new Map<string, any[]>();
    for (const d of (deliveries ?? [])) {
      const arr = byEmp.get(d.employee_id) ?? [];
      arr.push(d);
      byEmp.set(d.employee_id, arr);
    }
    const list: { emp: any; perdas: any[]; valorTotal: number; itens: Map<string, number> }[] = [];
    for (const [empId, perdas] of byEmp.entries()) {
      if (perdas.length < min) continue;
      const emp = empMap.get(empId);
      if (!emp) continue;
      const valorTotal = perdas.reduce((s, p) => s + (Number(p.valor_unitario) || 0) * (Number(p.qtd) || 1), 0);
      const itens = new Map<string, number>();
      for (const p of perdas) itens.set(p.item, (itens.get(p.item) ?? 0) + (Number(p.qtd) || 1));
      list.push({ emp, perdas, valorTotal, itens });
    }
    list.sort((a, b) => b.perdas.length - a.perdas.length || b.valorTotal - a.valorTotal);
    return list;
  }, [deliveries, empMap, minOcorrencias]);

  const totalPerdas = (deliveries ?? []).length;
  const colabsAfetados = grouped.length;
  const valorGlobal = grouped.reduce((s, g) => s + g.valorTotal, 0);

  return (
    <div className="p-6 md:p-8 space-y-6 animate-fadeIn">
      <div>
        <div className="flex items-center gap-2">
          <Repeat className="h-5 w-5 text-rose-600" />
          <h2 className="heading-display text-3xl md:text-4xl text-brand">Reincidência de Perda de EPI</h2>
        </div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">
          Colaboradores com múltiplas perdas/extravios no período
        </p>
      </div>

      <Card className="p-4 rounded-2xl flex flex-wrap items-end gap-4">
        <div className="space-y-1.5 min-w-[160px]">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Período</label>
          <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="60">Últimos 60 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="180">Últimos 180 dias</SelectItem>
              <SelectItem value="365">Último ano</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 min-w-[160px]">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Mínimo de ocorrências</label>
          <Select value={minOcorrencias} onValueChange={setMinOcorrencias}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="2">2 ou mais</SelectItem>
              <SelectItem value="3">3 ou mais</SelectItem>
              <SelectItem value="4">4 ou mais</SelectItem>
              <SelectItem value="5">5 ou mais</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto flex items-center gap-3 flex-wrap">
          <KPI label="Perdas no período" value={String(totalPerdas)} tone="slate" />
          <KPI label="Colab. reincidentes" value={String(colabsAfetados)} tone="rose" />
          <KPI label="Prejuízo estimado" value={`R$ ${valorGlobal.toFixed(2).replace(".", ",")}`} tone="amber" />
        </div>
      </Card>

      {isLoading && (
        <Card className="p-10 text-center text-xs font-bold uppercase tracking-widest text-slate-400">Carregando…</Card>
      )}

      {!isLoading && grouped.length === 0 && (
        <Card className="p-10 text-center text-sm text-slate-500">
          <AlertTriangle className="h-8 w-8 mx-auto text-emerald-500 mb-2" />
          Nenhuma reincidência detectada no período selecionado. ✅
        </Card>
      )}

      <div className="space-y-3">
        {grouped.map(({ emp, perdas, valorTotal, itens }) => (
          <Card key={emp.id} className="p-4 rounded-2xl border-rose-200">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-black uppercase text-base text-slate-900">{emp.nome}</span>
                  <Badge className="bg-rose-600 text-white text-[10px]">{perdas.length} perdas</Badge>
                  {perdas.length >= 4 && (
                    <Badge className="bg-rose-900 text-white text-[10px]">CRÍTICO</Badge>
                  )}
                </div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mt-1">
                  {cMap.get(emp.company_id) ?? "—"} • {rMap.get(emp.role_id) ?? "—"} • CPF {emp.cpf ?? "—"}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Prejuízo estimado</div>
                  <div className="font-black text-rose-700">R$ {valorTotal.toFixed(2).replace(".", ",")}</div>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link to="/app/employees/$id" params={{ id: emp.id }}>
                    Abrir ficha <ChevronRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {Array.from(itens.entries()).map(([nome, qtd]) => (
                <Badge key={nome} variant="secondary" className="text-[10px] uppercase">
                  {nome} × {qtd}
                </Badge>
              ))}
            </div>

            <div className="mt-3 border-t border-slate-100 pt-3 space-y-1.5">
              {perdas.map((p) => (
                <div key={p.id} className="flex items-center gap-2 text-[11px] text-slate-600">
                  <FileWarning className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                  <span className="font-bold uppercase">{p.item}</span>
                  <span className="text-slate-400">•</span>
                  <span>{formatDateBR(p.data_entrega)}</span>
                  <span className="text-slate-400">•</span>
                  <span>QTD {p.qtd}</span>
                  {p.valor_unitario && (
                    <>
                      <span className="text-slate-400">•</span>
                      <span>R$ {Number(p.valor_unitario).toFixed(2).replace(".", ",")}</span>
                    </>
                  )}
                  {p.observacoes && (
                    <span className="text-slate-500 italic truncate">— {p.observacoes}</span>
                  )}
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function KPI({ label, value, tone }: { label: string; value: string; tone: "slate" | "rose" | "amber" }) {
  const cls =
    tone === "rose" ? "border-rose-200 bg-rose-50 text-rose-800"
    : tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-800"
    : "border-slate-200 bg-slate-50 text-slate-800";
  return (
    <div className={`rounded-xl border px-3 py-2 ${cls}`}>
      <div className="text-[9px] font-black uppercase tracking-widest opacity-70">{label}</div>
      <div className="text-base font-black">{value}</div>
    </div>
  );
}