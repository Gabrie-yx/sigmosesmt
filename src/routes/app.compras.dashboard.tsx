import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  ShoppingCart, Clock, AlertTriangle, CheckCircle2, XCircle,
  DollarSign, Timer, Trophy, TrendingUp, Package,
} from "lucide-react";

export const Route = createFileRoute("/app/compras/dashboard")({
  component: DashboardComprasPage,
});

type Rc = {
  id: string;
  numero: string;
  status: string;
  setor: string | null;
  urgencia: string | null;
  sla_deadline: string | null;
  created_at: string;
  cotacao_at: string | null;
  decidido_em: string | null;
  pc_valor: number | null;
  pc_fornecedor: string | null;
  classificacao: string | null;
};

type Cotacao = {
  rc_id: string;
  fornecedor: string | null;
  valor: number | null;
  is_vencedora: boolean | null;
};

const dayMs = 86400000;
const fmt = (d: Date) => d.toISOString().slice(0, 10);
const now = new Date();

const STATUS_COLOR: Record<string, string> = {
  PENDENTE: "#f59e0b",
  EM_COTACAO: "#3b82f6",
  COTADA: "#8b5cf6",
  APROVADA: "#10b981",
  INDEFERIDA: "#ef4444",
  ARQUIVADA: "#64748b",
  PC_EMITIDO: "#0ea5e9",
  RECEBIDA: "#059669",
};

const URGENCIA_COLOR: Record<string, string> = {
  NORMAL: "#22c55e",
  URGENTE: "#f59e0b",
  EMERGENCIA: "#ef4444",
};

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

function DashboardComprasPage() {
  const [periodo, setPeriodo] = useState<"30" | "60" | "90" | "180" | "365">("30");
  const dias = Number(periodo);
  const since = fmt(new Date(now.getTime() - dias * dayMs));

  const { data: rcs = [], isLoading } = useQuery({
    queryKey: ["dash-compras-rcs", since],
    queryFn: async () => {
      const { data } = await supabase
        .from("purchase_requisitions")
        .select("id,numero,status,setor,urgencia,sla_deadline,created_at,cotacao_at,decidido_em,pc_valor,pc_fornecedor,classificacao")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(2000);
      return (data ?? []) as Rc[];
    },
  });

  const rcIds = useMemo(() => rcs.map((r) => r.id), [rcs]);

  const { data: cots = [] } = useQuery({
    queryKey: ["dash-compras-cots", rcIds.length, since],
    queryFn: async () => {
      if (rcIds.length === 0) return [] as Cotacao[];
      const chunks: string[][] = [];
      for (let i = 0; i < rcIds.length; i += 200) chunks.push(rcIds.slice(i, i + 200));
      const out: Cotacao[] = [];
      for (const c of chunks) {
        const { data } = await supabase
          .from("rc_cotacoes")
          .select("rc_id,fornecedor,valor,is_vencedora")
          .in("rc_id", c);
        if (data) out.push(...(data as Cotacao[]));
      }
      return out;
    },
    enabled: rcIds.length > 0,
  });

  const total = rcs.length;
  const abertas = rcs.filter((r) => ["PENDENTE", "EM_COTACAO", "COTADA"].includes(r.status)).length;
  const aprovadas = rcs.filter((r) => r.status === "APROVADA" || r.status === "PC_EMITIDO" || r.status === "RECEBIDA").length;
  const indeferidas = rcs.filter((r) => r.status === "INDEFERIDA").length;
  const slaVencido = rcs.filter((r) =>
    r.sla_deadline &&
    new Date(r.sla_deadline) < now &&
    ["PENDENTE", "EM_COTACAO", "COTADA"].includes(r.status),
  ).length;

  const valorAprovado = rcs
    .filter((r) => ["APROVADA", "PC_EMITIDO", "RECEBIDA"].includes(r.status))
    .reduce((s, r) => s + Number(r.pc_valor || 0), 0);

  const cotadasComTempo = rcs.filter((r) => r.cotacao_at);
  const tempoMedioCotacaoH =
    cotadasComTempo.length > 0
      ? cotadasComTempo.reduce(
          (s, r) => s + (new Date(r.cotacao_at!).getTime() - new Date(r.created_at).getTime()) / 3600000,
          0,
        ) / cotadasComTempo.length
      : 0;

  const decididas = rcs.filter((r) => r.decidido_em && r.cotacao_at);
  const tempoMedioAprovacaoH =
    decididas.length > 0
      ? decididas.reduce(
          (s, r) => s + (new Date(r.decidido_em!).getTime() - new Date(r.cotacao_at!).getTime()) / 3600000,
          0,
        ) / decididas.length
      : 0;

  const statusData = useMemo(() => {
    const map = new Map<string, number>();
    rcs.forEach((r) => map.set(r.status, (map.get(r.status) ?? 0) + 1));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [rcs]);

  const setorData = useMemo(() => {
    const map = new Map<string, number>();
    rcs.forEach((r) => {
      const k = r.setor?.trim() || "Sem setor";
      map.set(k, (map.get(k) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [rcs]);

  const urgenciaData = useMemo(() => {
    const map = new Map<string, number>();
    rcs.forEach((r) => {
      const k = r.urgencia || "NORMAL";
      map.set(k, (map.get(k) ?? 0) + 1);
    });
    return ["NORMAL", "URGENTE", "EMERGENCIA"].map((k) => ({ name: k, value: map.get(k) ?? 0 }));
  }, [rcs]);

  const rankingFornecedores = useMemo(() => {
    const map = new Map<string, { fornecedor: string; wins: number; valor: number }>();
    // 1) contam vitórias reais registradas em rc_cotacoes
    cots
      .filter((c) => c.is_vencedora && c.fornecedor)
      .forEach((c) => {
        const key = (c.fornecedor as string).trim();
        const cur = map.get(key) ?? { fornecedor: key, wins: 0, valor: 0 };
        cur.wins += 1;
        cur.valor += Number(c.valor || 0);
        map.set(key, cur);
      });
    // 2) soma valor efetivado no PC quando a RC já foi aprovada
    rcs
      .filter((r) => r.pc_fornecedor && r.pc_valor)
      .forEach((r) => {
        const key = (r.pc_fornecedor as string).trim();
        const cur = map.get(key) ?? { fornecedor: key, wins: 0, valor: 0 };
        cur.valor += Number(r.pc_valor || 0);
        map.set(key, cur);
      });
    return Array.from(map.values())
      .sort((a, b) => b.valor - a.valor || b.wins - a.wins)
      .slice(0, 10);
  }, [cots, rcs]);

  const evolucaoData = useMemo(() => {
    const buckets = new Map<string, number>();
    rcs.forEach((r) => {
      const d = r.created_at.slice(0, 10);
      buckets.set(d, (buckets.get(d) ?? 0) + 1);
    });
    const arr: { data: string; total: number }[] = [];
    for (let i = dias - 1; i >= 0; i--) {
      const d = fmt(new Date(now.getTime() - i * dayMs));
      arr.push({ data: d.slice(5), total: buckets.get(d) ?? 0 });
    }
    return arr;
  }, [rcs, dias]);

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-red-700" /> Dashboard Compras
          </h1>
          <p className="text-sm text-slate-500">KPIs, SLA e ranking de fornecedores</p>
        </div>
        <Select value={periodo} onValueChange={(v) => setPeriodo(v as typeof periodo)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="60">Últimos 60 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
            <SelectItem value="180">Últimos 6 meses</SelectItem>
            <SelectItem value="365">Últimos 12 meses</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={Package} label="Total de RCs" value={total} color="text-slate-700" />
        <KpiCard icon={Clock} label="Em aberto" value={abertas} color="text-blue-600" />
        <KpiCard icon={CheckCircle2} label="Aprovadas" value={aprovadas} color="text-emerald-600" />
        <KpiCard icon={XCircle} label="Indeferidas" value={indeferidas} color="text-red-600" />
        <KpiCard icon={AlertTriangle} label="SLA vencido" value={slaVencido} color="text-orange-600" alert={slaVencido > 0} />
        <KpiCard icon={Timer} label="Média p/ cotar" value={`${tempoMedioCotacaoH.toFixed(1)}h`} color="text-violet-600" />
        <KpiCard icon={TrendingUp} label="Média p/ decidir" value={`${tempoMedioAprovacaoH.toFixed(1)}h`} color="text-sky-600" />
        <KpiCard icon={DollarSign} label="Valor aprovado" value={brl(valorAprovado)} color="text-emerald-700" />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">RCs por status</CardTitle></CardHeader>
          <CardContent style={{ height: 280 }}>
            {statusData.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                    {statusData.map((s) => (
                      <Cell key={s.name} fill={STATUS_COLOR[s.name] ?? "#94a3b8"} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">RCs por setor</CardTitle></CardHeader>
          <CardContent style={{ height: 280 }}>
            {setorData.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={setorData} layout="vertical" margin={{ left: 100 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={140} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#dc2626" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Urgência</CardTitle></CardHeader>
          <CardContent style={{ height: 260 }}>
            {urgenciaData.every((u) => u.value === 0) ? <Empty /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={urgenciaData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {urgenciaData.map((u) => (
                      <Cell key={u.name} fill={URGENCIA_COLOR[u.name] ?? "#94a3b8"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Evolução diária</CardTitle></CardHeader>
          <CardContent style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={evolucaoData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="data" tick={{ fontSize: 11 }} interval={Math.max(0, Math.floor(evolucaoData.length / 15))} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="total" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Ranking fornecedores */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" /> Top 10 fornecedores (vencedores + PC emitido)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rankingFornecedores.length === 0 ? <Empty /> : (
            <div className="divide-y">
              {rankingFornecedores.map((f, i) => (
                <div key={f.fornecedor} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      i === 0 ? "bg-amber-100 text-amber-700"
                      : i === 1 ? "bg-slate-200 text-slate-700"
                      : i === 2 ? "bg-orange-100 text-orange-700"
                      : "bg-slate-100 text-slate-600"
                    }`}>{i + 1}</div>
                    <div>
                      <div className="text-sm font-medium text-slate-900">{f.fornecedor}</div>
                      <div className="text-xs text-slate-500">{f.wins} cotação(ões) vencedora(s)</div>
                    </div>
                  </div>
                  <Badge variant="secondary" className="font-mono">{brl(f.valor)}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {isLoading && (
        <div className="text-center text-sm text-slate-400 py-4">Carregando...</div>
      )}
    </div>
  );
}

function KpiCard({
  icon: Icon, label, value, color, alert,
}: {
  icon: typeof Package;
  label: string;
  value: string | number;
  color: string;
  alert?: boolean;
}) {
  return (
    <Card className={alert ? "border-orange-400 shadow-orange-100 shadow" : ""}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500 font-medium">{label}</div>
            <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
          </div>
          <Icon className={`h-8 w-8 ${color} opacity-70`} />
        </div>
      </CardContent>
    </Card>
  );
}

function Empty() {
  return (
    <div className="h-full flex items-center justify-center text-sm text-slate-400">
      Sem dados no período
    </div>
  );
}