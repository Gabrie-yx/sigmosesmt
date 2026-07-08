import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  MinusCircle,
  Search,
  ListChecks,
  CalendarClock,
  CalendarCheck2,
  CalendarX2,
  Scale,
} from "lucide-react";

/* ============================================================
 * Painel Dinâmico — cards com donut de % + histograma mensal
 * Inspirado no dashboard do Ius Natura, mas no visual do SIGMO.
 * ============================================================ */

type Tone = "success" | "danger" | "warning" | "info" | "muted";

const TONE_STROKE: Record<Tone, string> = {
  success: "#10b981", // emerald-500
  danger: "#ef4444", // red-500
  warning: "#f59e0b", // amber-500
  info: "#3b82f6", // blue-500
  muted: "#94a3b8", // slate-400
};

const TONE_TEXT: Record<Tone, string> = {
  success: "text-emerald-400",
  danger: "text-red-400",
  warning: "text-amber-400",
  info: "text-sky-400",
  muted: "text-slate-300",
};

function Donut({ pct, tone }: { pct: number; tone: Tone }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct));
  const dash = (p / 100) * c;
  return (
    <div className="relative h-14 w-14 shrink-0">
      <svg viewBox="0 0 60 60" className="h-full w-full -rotate-90">
        <circle cx="30" cy="30" r={r} fill="none" stroke="currentColor" className="text-foreground/15" strokeWidth="5" />
        <circle
          cx="30"
          cy="30"
          r={r}
          fill="none"
          stroke={TONE_STROKE[tone]}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          style={{ transition: "stroke-dasharray .6s ease-out" }}
        />
      </svg>
      <div className={`absolute inset-0 flex items-center justify-center text-[10px] font-bold ${TONE_TEXT[tone]}`}>
        {p.toFixed(p >= 10 ? 0 : 1)}%
      </div>
    </div>
  );
}

type CardItem = {
  key: string;
  label: string;
  value: number;
  tone: Tone;
  icon: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
};

function StatsCard({ items, total }: { items: CardItem[]; total: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map((it) => {
        const pct = total > 0 ? (it.value / total) * 100 : 0;
        return (
          <button
            key={it.key}
            type="button"
            onClick={it.onClick}
            className={`group relative flex items-center gap-4 rounded-xl border bg-card p-4 text-left transition
              hover:border-primary/50 hover:shadow-md
              ${it.active ? "border-primary ring-2 ring-primary/30" : "border-border"}
              ${it.onClick ? "cursor-pointer" : "cursor-default"}`}
          >
            <Donut pct={pct} tone={it.tone} />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className={`text-3xl font-bold leading-none ${TONE_TEXT[it.tone]}`}>{it.value}</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/90">{it.label}</span>
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-foreground/70">
                <span className={`inline-flex ${TONE_TEXT[it.tone]}`}>{it.icon}</span>
                <span>de {total.toLocaleString("pt-BR")} no total</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
        {icon}
      </span>
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">{title}</h3>
        {subtitle && <p className="text-[11px] text-foreground/70">{subtitle}</p>}
      </div>
    </div>
  );
}

/* ---------------- Histórico (barras empilhadas) ---------------- */

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(k: string) {
  const [y, m] = k.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

function HistoricoChart<T extends { created_at?: string | null }>({
  rows,
  months = 6,
  series,
}: {
  rows: T[];
  months?: number;
  series: { key: string; label: string; color: string; match: (r: T) => boolean }[];
}) {
  const data = useMemo(() => {
    const buckets: Record<string, Record<string, number>> = {};
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets[monthKey(d)] = { label: monthLabel(monthKey(d)) as any };
      series.forEach((s) => (buckets[monthKey(d)][s.key] = 0));
    }
    for (const r of rows) {
      if (!r.created_at) continue;
      const d = new Date(r.created_at);
      const k = monthKey(d);
      if (!buckets[k]) continue;
      for (const s of series) if (s.match(r)) buckets[k][s.key] = (buckets[k][s.key] ?? 0) + 1;
    }
    return Object.entries(buckets).map(([k, v]) => ({ mes: monthLabel(k), ...v }));
  }, [rows, months, series]);

  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 16, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" opacity={0.12} />
          <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#e2e8f0" }} stroke="#94a3b8" />
          <YAxis tick={{ fontSize: 11, fill: "#e2e8f0" }} stroke="#94a3b8" />
          <Tooltip
            contentStyle={{
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: 8,
              fontSize: 12,
              color: "#f1f5f9",
            }}
            labelStyle={{ color: "#f1f5f9", fontWeight: 600 }}
            itemStyle={{ color: "#f1f5f9" }}
            cursor={{ fill: "#ffffff", fillOpacity: 0.05 }}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "#e2e8f0" }} />
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} stackId="a" fill={s.color} radius={[0, 0, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ================================================================
 * PAINEL DINÂMICO — REQUISITOS
 * ================================================================ */

export type RequisitoLite = {
  id: string;
  status: string | null;
  created_at?: string | null;
  prazo_atendimento?: string | null;
};

export function PainelDinamicoRequisitos({
  requisitos,
  onFiltro,
  filtroAtivo,
}: {
  requisitos: RequisitoLite[];
  onFiltro?: (
    k: "atendidos" | "nao_atendidos" | "nao_avaliados" | "nao_aplicaveis" | "em_analise" | "monitoramento",
  ) => void;
  filtroAtivo?: string | null;
}) {
  const stats = useMemo(() => {
    const total = requisitos.length;
    const atendidos = requisitos.filter((r) => r.status === "atendido").length;
    const naoAplicaveis = requisitos.filter((r) => r.status === "nao_aplicavel").length;
    const emAnalise = requisitos.filter((r) => r.status === "em_analise").length;
    const naoAvaliados = requisitos.filter((r) => r.status === "recebido").length;
    const monitoramento = requisitos.filter((r) => r.status === "monitoramento").length;
    const naoAtendidos = requisitos.filter((r) =>
      ["aplicavel", "em_tratativa"].includes(r.status ?? ""),
    ).length;
    return { total, atendidos, naoAtendidos, naoAvaliados, naoAplicaveis, emAnalise, monitoramento };
  }, [requisitos]);

  const items: CardItem[] = [
    {
      key: "atendidos",
      label: "Atendidos",
      value: stats.atendidos,
      tone: "success",
      icon: <CheckCircle2 className="h-3 w-3" />,
      onClick: () => onFiltro?.("atendidos"),
      active: filtroAtivo === "atendidos",
    },
    {
      key: "nao_atendidos",
      label: "Não atendidos",
      value: stats.naoAtendidos,
      tone: "danger",
      icon: <AlertTriangle className="h-3 w-3" />,
      onClick: () => onFiltro?.("nao_atendidos"),
      active: filtroAtivo === "nao_atendidos",
    },
    {
      key: "em_analise",
      label: "Em análise",
      value: stats.emAnalise,
      tone: "info",
      icon: <Search className="h-3 w-3" />,
      onClick: () => onFiltro?.("em_analise"),
      active: filtroAtivo === "em_analise",
    },
    {
      key: "nao_avaliados",
      label: "Não avaliados",
      value: stats.naoAvaliados,
      tone: "warning",
      icon: <Clock className="h-3 w-3" />,
      onClick: () => onFiltro?.("nao_avaliados"),
      active: filtroAtivo === "nao_avaliados",
    },
    {
      key: "nao_aplicaveis",
      label: "Não aplicáveis",
      value: stats.naoAplicaveis,
      tone: "muted",
      icon: <MinusCircle className="h-3 w-3" />,
      onClick: () => onFiltro?.("nao_aplicaveis"),
      active: filtroAtivo === "nao_aplicaveis",
    },
    {
      key: "monitoramento",
      label: "Monitoramento",
      value: stats.monitoramento,
      tone: "info",
      icon: <ListChecks className="h-3 w-3" />,
      onClick: () => onFiltro?.("monitoramento"),
      active: filtroAtivo === "monitoramento",
    },
  ];

  return (
    <Card className="p-5 space-y-5 bg-gradient-to-br from-card via-card to-card/60">
      <SectionHeader
        icon={<Scale className="h-3.5 w-3.5" />}
        title="Status Consolidado do Requisito"
        subtitle={`${stats.total.toLocaleString("pt-BR")} requisitos no total — clique para filtrar`}
      />
      <StatsCard items={items} total={stats.total} />
      <div className="pt-4 border-t">
        <SectionHeader
          icon={<CalendarClock className="h-3.5 w-3.5" />}
          title="Histórico de Status Consolidado"
          subtitle="Distribuição por mês (últimos 6 meses, por data de inclusão)"
        />
        <HistoricoChart
          rows={requisitos}
          series={[
            { key: "atendido", label: "Atendido", color: "#10b981", match: (r) => r.status === "atendido" },
            {
              key: "nao_atendido",
              label: "Não atendido",
              color: "#ef4444",
              match: (r) => ["aplicavel", "em_tratativa"].includes(r.status ?? ""),
            },
            { key: "em_analise", label: "Em análise", color: "#3b82f6", match: (r) => r.status === "em_analise" },
            { key: "nao_avaliado", label: "Não avaliado", color: "#f59e0b", match: (r) => r.status === "recebido" },
            {
              key: "nao_aplicavel",
              label: "Não aplicável",
              color: "#94a3b8",
              match: (r) => r.status === "nao_aplicavel",
            },
          ]}
        />
      </div>
    </Card>
  );
}

/* ================================================================
 * PAINEL DINÂMICO — PLANOS DE AÇÃO
 * ================================================================ */

export type PlanoLite = {
  id: string;
  status?: string | null;
  data_prevista: string | null;
  data_conclusao: string | null;
  created_at?: string | null;
};

export function PainelDinamicoPlanos({
  planos,
  onFiltro,
  filtroAtivo,
}: {
  planos: PlanoLite[];
  onFiltro?: (k: "vencidos" | "vencendo" | "em_dia" | "concluidos" | "sem_prazo") => void;
  filtroAtivo?: string | null;
}) {
  const stats = useMemo(() => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    let vencidos = 0, vencendo = 0, emDia = 0, concluidos = 0, semPrazo = 0;
    for (const p of planos) {
      if (p.data_conclusao) {
        concluidos++;
        continue;
      }
      if (!p.data_prevista) {
        semPrazo++;
        continue;
      }
      const dias = Math.round(
        (new Date(p.data_prevista + "T00:00:00").getTime() - hoje.getTime()) / 86400000,
      );
      if (dias < 0) vencidos++;
      else if (dias <= 30) vencendo++;
      else emDia++;
    }
    return { total: planos.length, vencidos, vencendo, emDia, concluidos, semPrazo };
  }, [planos]);

  const items: CardItem[] = [
    {
      key: "vencidos",
      label: "Vencidos",
      value: stats.vencidos,
      tone: "danger",
      icon: <CalendarX2 className="h-3 w-3" />,
      onClick: () => onFiltro?.("vencidos"),
      active: filtroAtivo === "vencidos",
    },
    {
      key: "vencendo",
      label: "Vencimento Próximo",
      value: stats.vencendo,
      tone: "warning",
      icon: <CalendarClock className="h-3 w-3" />,
      onClick: () => onFiltro?.("vencendo"),
      active: filtroAtivo === "vencendo",
    },
    {
      key: "em_dia",
      label: "Em dia",
      value: stats.emDia,
      tone: "info",
      icon: <CalendarCheck2 className="h-3 w-3" />,
      onClick: () => onFiltro?.("em_dia"),
      active: filtroAtivo === "em_dia",
    },
    {
      key: "concluidos",
      label: "Concluídos",
      value: stats.concluidos,
      tone: "success",
      icon: <CheckCircle2 className="h-3 w-3" />,
      onClick: () => onFiltro?.("concluidos"),
      active: filtroAtivo === "concluidos",
    },
    {
      key: "sem_prazo",
      label: "Sem prazo",
      value: stats.semPrazo,
      tone: "muted",
      icon: <MinusCircle className="h-3 w-3" />,
      onClick: () => onFiltro?.("sem_prazo"),
      active: filtroAtivo === "sem_prazo",
    },
  ];

  return (
    <Card className="p-5 space-y-5 bg-gradient-to-br from-card via-card to-card/60">
      <SectionHeader
        icon={<ListChecks className="h-3.5 w-3.5" />}
        title="Planos de Ação — Status por Vencimento"
        subtitle={`${stats.total.toLocaleString("pt-BR")} planos no total — clique para filtrar`}
      />
      <StatsCard items={items} total={stats.total} />
      <div className="pt-4 border-t">
        <SectionHeader
          icon={<CalendarClock className="h-3.5 w-3.5" />}
          title="Histórico de Planos de Ação"
          subtitle="Distribuição por mês (últimos 6 meses, por criação)"
        />
        <HistoricoChart
          rows={planos}
          series={[
            { key: "concluido", label: "Concluído", color: "#10b981", match: (p) => !!p.data_conclusao },
            {
              key: "vencido",
              label: "Vencido",
              color: "#ef4444",
              match: (p) => {
                if (p.data_conclusao || !p.data_prevista) return false;
                return new Date(p.data_prevista + "T00:00:00").getTime() < Date.now();
              },
            },
            {
              key: "vencendo",
              label: "A vencer",
              color: "#f59e0b",
              match: (p) => {
                if (p.data_conclusao || !p.data_prevista) return false;
                const dias = Math.round(
                  (new Date(p.data_prevista + "T00:00:00").getTime() - Date.now()) / 86400000,
                );
                return dias >= 0 && dias <= 30;
              },
            },
            {
              key: "em_dia",
              label: "Em dia",
              color: "#3b82f6",
              match: (p) => {
                if (p.data_conclusao || !p.data_prevista) return false;
                const dias = Math.round(
                  (new Date(p.data_prevista + "T00:00:00").getTime() - Date.now()) / 86400000,
                );
                return dias > 30;
              },
            },
          ]}
        />
      </div>
    </Card>
  );
}