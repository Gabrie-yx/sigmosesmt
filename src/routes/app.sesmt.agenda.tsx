import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CalendarCheck2, Stethoscope, GraduationCap, FileText, Search,
  AlertTriangle, Clock, Activity, ListChecks,
} from "lucide-react";
import { formatDateBR } from "@/lib/utils-date";
import { EmployeeQuickView } from "@/components/employees/employee-quick-view";
import { GuiaEncaminhamentoDialog } from "@/components/employees/guia-encaminhamento-dialog";

export const Route = createFileRoute("/app/sesmt/agenda")({
  component: AgendaInteligente,
});

type Janela = "VENCIDOS" | "7" | "30" | "60" | "90" | "TODOS";
type Tipo = "ASO" | "CONVOCACAO" | "TREINAMENTO";

type Item = {
  id: string;
  tipo: Tipo;
  employeeId: string;
  employeeNome: string;
  cargo?: string;
  titulo: string;
  data: string; // ISO date
  diasAteVencer: number;
  detalhe?: string;
};

function daysBetween(date: string) {
  const d = new Date(date.slice(0, 10) + "T00:00:00").getTime();
  const now = new Date(new Date().toISOString().slice(0, 10)).getTime();
  return Math.round((d - now) / 86400000);
}

function toneFor(dias: number) {
  if (dias < 0) return { bg: "bg-rose-500/15 border-rose-400/40", text: "text-rose-200", label: `vencido ${Math.abs(dias)}d` };
  if (dias <= 7) return { bg: "bg-rose-500/10 border-rose-400/30", text: "text-rose-200", label: `${dias}d` };
  if (dias <= 30) return { bg: "bg-amber-500/15 border-amber-400/40", text: "text-amber-200", label: `${dias}d` };
  if (dias <= 60) return { bg: "bg-yellow-500/10 border-yellow-300/30", text: "text-yellow-200", label: `${dias}d` };
  return { bg: "bg-emerald-500/10 border-emerald-400/30", text: "text-emerald-200", label: `${dias}d` };
}

function AgendaInteligente() {
  const [janela, setJanela] = useState<Janela>("90");
  const [tipo, setTipo] = useState<Tipo | "TODOS">("TODOS");
  const [busca, setBusca] = useState("");
  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const [guiaId, setGuiaId] = useState<string | null>(null);

  const { data: asoItems = [] } = useQuery({
    queryKey: ["agenda-aso"],
    queryFn: async () => {
      const { data } = await supabase
        .from("employee_exams")
        .select("id, employee_id, tipo_exame, natureza, data_vencimento, employees(id, nome, status, roles(name))")
        .not("data_vencimento", "is", null)
        .order("data_vencimento", { ascending: true })
        .limit(800);
      return (data ?? [])
        .filter((r: any) => r.employees?.status === "ATIVO")
        .map<Item>((r: any) => ({
          id: `aso-${r.id}`,
          tipo: "ASO",
          employeeId: r.employee_id,
          employeeNome: r.employees?.nome ?? "—",
          cargo: r.employees?.roles?.name,
          titulo: `ASO ${r.natureza ?? r.tipo_exame ?? ""}`,
          data: r.data_vencimento,
          diasAteVencer: daysBetween(r.data_vencimento),
          detalhe: r.tipo_exame,
        }));
    },
  });

  const { data: convItems = [] } = useQuery({
    queryKey: ["agenda-conv"],
    queryFn: async () => {
      const { data } = await supabase
        .from("convocacoes_exames")
        .select("id, employee_id, tipos_exame, data_limite, status, employees(id, nome, status, roles(name))")
        .eq("status", "PENDENTE")
        .order("data_limite", { ascending: true })
        .limit(500);
      return (data ?? [])
        .filter((r: any) => r.employees?.status === "ATIVO" && r.data_limite)
        .map<Item>((r: any) => ({
          id: `conv-${r.id}`,
          tipo: "CONVOCACAO",
          employeeId: r.employee_id,
          employeeNome: r.employees?.nome ?? "—",
          cargo: r.employees?.roles?.name,
          titulo: "Convocação ASO pendente",
          data: r.data_limite,
          diasAteVencer: daysBetween(r.data_limite),
          detalhe: (r.tipos_exame ?? []).join(", "),
        }));
    },
  });

  const { data: trainItems = [] } = useQuery({
    queryKey: ["agenda-train"],
    queryFn: async () => {
      const { data } = await supabase
        .from("training_attendees")
        .select("id, employee_id, situacao, data_vencimento, trainings(titulo, tipo), employees(id, nome, status, roles(name))")
        .not("data_vencimento", "is", null)
        .order("data_vencimento", { ascending: true })
        .limit(800);
      return (data ?? [])
        .filter((r: any) => r.employees?.status === "ATIVO")
        .map<Item>((r: any) => ({
          id: `tr-${r.id}`,
          tipo: "TREINAMENTO",
          employeeId: r.employee_id,
          employeeNome: r.employees?.nome ?? "—",
          cargo: r.employees?.roles?.name,
          titulo: `Treino · ${r.trainings?.titulo ?? "—"}`,
          data: r.data_vencimento,
          diasAteVencer: daysBetween(r.data_vencimento),
          detalhe: r.trainings?.tipo,
        }));
    },
  });

  const all = useMemo(() => [...asoItems, ...convItems, ...trainItems], [asoItems, convItems, trainItems]);

  const filtered = useMemo(() => {
    const limite =
      janela === "VENCIDOS" ? -99999 :
      janela === "TODOS" ? Infinity :
      parseInt(janela, 10);
    const q = busca.toLowerCase().trim();
    return all
      .filter(i => tipo === "TODOS" || i.tipo === tipo)
      .filter(i => {
        if (janela === "VENCIDOS") return i.diasAteVencer < 0;
        if (janela === "TODOS") return true;
        return i.diasAteVencer <= limite;
      })
      .filter(i => !q || i.employeeNome.toLowerCase().includes(q) || i.titulo.toLowerCase().includes(q))
      .sort((a, b) => a.diasAteVencer - b.diasAteVencer);
  }, [all, janela, tipo, busca]);

  const kpi = {
    vencidos: all.filter(i => i.diasAteVencer < 0).length,
    semana: all.filter(i => i.diasAteVencer >= 0 && i.diasAteVencer <= 7).length,
    mes: all.filter(i => i.diasAteVencer > 7 && i.diasAteVencer <= 30).length,
    proximos: all.filter(i => i.diasAteVencer > 30 && i.diasAteVencer <= 90).length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a0408] via-rose-950/30 to-[#1a0408] p-4 md:p-6 text-rose-50">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-rose-500 to-rose-700 grid place-items-center shadow-lg shadow-rose-900/40">
            <CalendarCheck2 className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Agenda Inteligente — SST</h1>
            <p className="text-xs text-rose-200/60">Cruza ASOs, Convocações e Treinamentos em uma linha do tempo única (NR-7 + NR-1).</p>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard icon={AlertTriangle} label="Vencidos" value={kpi.vencidos} tone="rose" />
          <KpiCard icon={Clock} label="Próx. 7 dias" value={kpi.semana} tone="amber" />
          <KpiCard icon={Activity} label="Em 30 dias" value={kpi.mes} tone="yellow" />
          <KpiCard icon={ListChecks} label="60–90 dias" value={kpi.proximos} tone="emerald" />
        </div>

        {/* Filtros */}
        <div className="p-3 rounded-2xl border border-rose-100/15 bg-gradient-to-br from-rose-100/5 to-transparent backdrop-blur-md flex flex-wrap gap-2 items-center">
          <div className="flex gap-1">
            {(["VENCIDOS", "7", "30", "60", "90", "TODOS"] as Janela[]).map(j => (
              <Button key={j} size="sm" variant={janela === j ? "default" : "outline"}
                onClick={() => setJanela(j)}
                className={janela === j ? "bg-rose-600 hover:bg-rose-700 h-8 text-xs" : "h-8 text-xs bg-transparent border-rose-100/20 text-rose-100 hover:bg-rose-100/5"}>
                {j === "VENCIDOS" ? "Vencidos" : j === "TODOS" ? "Todos" : `${j}d`}
              </Button>
            ))}
          </div>
          <div className="w-px h-6 bg-rose-100/15" />
          <div className="flex gap-1">
            {(["TODOS", "ASO", "CONVOCACAO", "TREINAMENTO"] as const).map(t => (
              <Button key={t} size="sm" variant={tipo === t ? "default" : "outline"}
                onClick={() => setTipo(t)}
                className={tipo === t ? "bg-rose-600 hover:bg-rose-700 h-8 text-xs" : "h-8 text-xs bg-transparent border-rose-100/20 text-rose-100 hover:bg-rose-100/5"}>
                {t === "TODOS" ? "Todos" : t === "ASO" ? "ASO" : t === "CONVOCACAO" ? "Convocações" : "Treinos"}
              </Button>
            ))}
          </div>
          <div className="relative ml-auto flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-rose-300/60" />
            <Input placeholder="Buscar colaborador…" value={busca} onChange={(e) => setBusca(e.target.value)}
              className="pl-7 h-8 bg-rose-100/5 border-rose-100/15 text-rose-50 text-xs" />
          </div>
        </div>

        {/* Lista */}
        <div className="space-y-1.5">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-rose-200/40 text-sm border border-dashed border-rose-100/10 rounded-2xl">
              Nada pendente nesta janela. 🎉
            </div>
          ) : (
            filtered.map(item => {
              const tone = toneFor(item.diasAteVencer);
              const Icon = item.tipo === "ASO" ? Stethoscope : item.tipo === "TREINAMENTO" ? GraduationCap : FileText;
              return (
                <div key={item.id}
                  className={`p-3 rounded-xl border ${tone.bg} backdrop-blur-md flex items-center gap-3 hover:bg-rose-100/[0.06] transition`}>
                  <Icon className={`h-4 w-4 ${tone.text} shrink-0`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setQuickViewId(item.employeeId)} className="text-sm font-medium text-rose-50 hover:text-rose-200 truncate">
                        {item.employeeNome}
                      </button>
                      {item.cargo && <span className="text-[10px] text-rose-200/50 truncate">· {item.cargo}</span>}
                    </div>
                    <div className="text-[11px] text-rose-200/70 truncate">
                      {item.titulo}{item.detalhe ? ` · ${item.detalhe}` : ""}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[11px] text-rose-200/70">{formatDateBR(item.data)}</div>
                    <Badge variant="outline" className={`${tone.bg} ${tone.text} text-[10px] mt-0.5`}>{tone.label}</Badge>
                  </div>
                  {item.tipo !== "TREINAMENTO" && (
                    <Button size="sm" onClick={() => setGuiaId(item.employeeId)}
                      className="bg-rose-600 hover:bg-rose-700 text-white h-7 text-[11px] shrink-0">
                      Guia
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <EmployeeQuickView employeeId={quickViewId} open={!!quickViewId} onClose={() => setQuickViewId(null)} />
      {guiaId && (
        <GuiaEncaminhamentoDialog
          open={!!guiaId}
          employeeId={guiaId}
          onClose={() => setGuiaId(null)}
        />
      )}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number; tone: "rose" | "amber" | "yellow" | "emerald" }) {
  const cls = {
    rose: "from-rose-500/20 to-rose-700/10 border-rose-400/30 text-rose-200",
    amber: "from-amber-500/20 to-amber-700/10 border-amber-400/30 text-amber-200",
    yellow: "from-yellow-500/15 to-yellow-700/5 border-yellow-300/25 text-yellow-200",
    emerald: "from-emerald-500/20 to-emerald-700/10 border-emerald-400/30 text-emerald-200",
  }[tone];
  return (
    <div className={`p-4 rounded-2xl border bg-gradient-to-br ${cls} backdrop-blur-md`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider opacity-80">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}