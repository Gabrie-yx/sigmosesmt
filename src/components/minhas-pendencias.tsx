import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Megaphone,
  Package,
  ShoppingCart,
  ShieldAlert,
  Stethoscope,
  CheckCircle2,
  ArrowRight,
  CalendarClock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Sigla } from "@/components/sigla";
import { cn } from "@/lib/utils";

// Dias da semana em que o DDS é realizado (1=seg, 3=qua, 5=sex)
const DIAS_DDS = [1, 3, 5];
const NOMES_DIAS_DDS = "segundas, quartas e sextas";

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daqui(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function diaSemanaPt() {
  const nomes = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
  return nomes[new Date().getDay()];
}

/** Card visual de pendência. */
function PendenciaCard({
  icon: Icon,
  titulo,
  valor,
  descricao,
  to,
  cor,
  loading,
  ok,
  ctaLabel = "Resolver agora",
}: {
  icon: React.ComponentType<{ className?: string }>;
  titulo: React.ReactNode;
  valor: number | string;
  descricao: React.ReactNode;
  to: string;
  cor: "red" | "amber" | "blue" | "emerald" | "slate";
  loading?: boolean;
  ok?: boolean;
  ctaLabel?: string;
}) {
  const palette: Record<string, { ring: string; bg: string; icon: string; chip: string; cta: string }> = {
    red: {
      ring: "ring-red-200",
      bg: "from-red-50 to-white",
      icon: "bg-red-600 text-white",
      chip: "bg-red-100 text-red-800",
      cta: "text-red-700 hover:text-red-900",
    },
    amber: {
      ring: "ring-amber-200",
      bg: "from-amber-50 to-white",
      icon: "bg-amber-500 text-white",
      chip: "bg-amber-100 text-amber-800",
      cta: "text-amber-700 hover:text-amber-900",
    },
    blue: {
      ring: "ring-blue-200",
      bg: "from-blue-50 to-white",
      icon: "bg-blue-600 text-white",
      chip: "bg-blue-100 text-blue-800",
      cta: "text-blue-700 hover:text-blue-900",
    },
    emerald: {
      ring: "ring-emerald-200",
      bg: "from-emerald-50 to-white",
      icon: "bg-emerald-600 text-white",
      chip: "bg-emerald-100 text-emerald-800",
      cta: "text-emerald-700 hover:text-emerald-900",
    },
    slate: {
      ring: "ring-slate-200",
      bg: "from-slate-50 to-white",
      icon: "bg-slate-600 text-white",
      chip: "bg-slate-100 text-slate-800",
      cta: "text-slate-700 hover:text-slate-900",
    },
  };
  const c = palette[ok ? "emerald" : cor];

  return (
    <Link
      to={to}
      className={cn(
        "group relative flex flex-col gap-3 rounded-2xl border bg-gradient-to-br p-5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all ring-1",
        c.bg,
        c.ring,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={cn("p-2.5 rounded-xl shadow-sm", c.icon)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className={cn("text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full", c.chip)}>
          {ok ? "Tudo certo" : loading ? "Verificando…" : "Pendente"}
        </div>
      </div>
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-black text-slate-900 leading-none tabular-nums">
            {loading ? "—" : ok ? <CheckCircle2 className="h-9 w-9 text-emerald-600 inline" /> : valor}
          </span>
        </div>
        <div className="mt-1 text-sm font-bold text-slate-900">{titulo}</div>
        <div className="mt-1 text-xs text-slate-600 leading-relaxed">{descricao}</div>
      </div>
      <div className={cn("mt-auto pt-2 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider", c.cta)}>
        {ok ? "Ver detalhes" : ctaLabel}
        <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
      </div>
    </Link>
  );
}

export function MinhasPendencias() {
  const hoje = hojeISO();
  const limite30 = daqui(30);
  const limite7 = daqui(7);
  const diaSem = new Date().getDay();
  const ehDiaDeDDS = DIAS_DDS.includes(diaSem);

  // 1) DDS de hoje (só conta como pendente se hoje for seg/qua/sex)
  const dds = useQuery({
    queryKey: ["pendencia-dds", hoje],
    enabled: ehDiaDeDDS,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("dds")
        .select("id", { count: "exact", head: true })
        .eq("data", hoje);
      if (error) throw error;
      return count ?? 0;
    },
  });

  // 2) Requisições aguardando aprovação
  const req = useQuery({
    queryKey: ["pendencia-requisicoes"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("purchase_requisitions")
        .select("id", { count: "exact", head: true })
        .eq("status", "PENDENTE");
      if (error) throw error;
      return count ?? 0;
    },
  });

  // 3) EPIs em estoque baixo (quantidade <= mínimo)
  const epi = useQuery({
    queryKey: ["pendencia-epi-baixo"],
    queryFn: async () => {
      // PostgREST não suporta comparar duas colunas diretamente — busca todos e filtra
      const { data, error } = await supabase
        .from("estoque_epi")
        .select("id, quantidade_atual, estoque_minimo");
      if (error) throw error;
      return (data ?? []).filter((e) => (e.quantidade_atual ?? 0) <= (e.estoque_minimo ?? 0)).length;
    },
  });

  // 4) Exames vencendo em até 30 dias
  const exames = useQuery({
    queryKey: ["pendencia-exames", limite30],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("employee_exams")
        .select("id", { count: "exact", head: true })
        .lte("data_vencimento", limite30)
        .gte("data_vencimento", hoje);
      if (error) throw error;
      return count ?? 0;
    },
  });

  // 5) APRs vencendo em até 7 dias
  const aprs = useQuery({
    queryKey: ["pendencia-aprs", limite7],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("aprs")
        .select("id", { count: "exact", head: true })
        .lte("data_validade", limite7)
        .gte("data_validade", hoje);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const totalPendencias =
    (ehDiaDeDDS && (dds.data ?? 0) === 0 ? 1 : 0) +
    (req.data ?? 0) +
    (epi.data ?? 0) +
    (exames.data ?? 0) +
    (aprs.data ?? 0);

  return (
    <section className="px-6 md:px-14 pt-10 pb-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#7f1d1d]/10 border border-[#7f1d1d]/20 mb-3">
            <CalendarClock className="h-3.5 w-3.5 text-[#7f1d1d]" />
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#7f1d1d]">
              Hoje · {diaSemanaPt()}
            </span>
          </div>
          <h2 className="heading-display text-2xl md:text-4xl text-slate-900 tracking-tight">
            O que precisa ser feito agora
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            {totalPendencias === 0
              ? "Tudo em dia — sem pendências críticas no momento."
              : `Você tem ${totalPendencias} ${totalPendencias === 1 ? "pendência" : "pendências"} aguardando.`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {ehDiaDeDDS ? (
          <PendenciaCard
            icon={Megaphone}
            titulo={<><Sigla>DDS</Sigla> de hoje</>}
            valor={(dds.data ?? 0) > 0 ? "OK" : "1"}
            descricao={
              (dds.data ?? 0) > 0
                ? `${dds.data} registro(s) já lançado(s) hoje.`
                : `Hoje é dia de DDS. Registre o diálogo com a equipe.`
            }
            to="/app/dds"
            cor="red"
            loading={dds.isLoading}
            ok={(dds.data ?? 0) > 0}
            ctaLabel="Registrar DDS"
          />
        ) : (
          <PendenciaCard
            icon={Megaphone}
            titulo={<><Sigla>DDS</Sigla></>}
            valor="—"
            descricao={`Sem DDS hoje. Próximas datas: ${NOMES_DIAS_DDS}.`}
            to="/app/dds"
            cor="slate"
            ok
            ctaLabel="Ver histórico"
          />
        )}

        <PendenciaCard
          icon={ShoppingCart}
          titulo="Requisições pendentes"
          valor={req.data ?? 0}
          descricao={
            (req.data ?? 0) === 0
              ? "Nenhuma requisição aguardando análise."
              : `Requisição(ões) aguardando aprovação ou parecer.`
          }
          to="/app/sesmt/requisicoes"
          cor="amber"
          loading={req.isLoading}
          ok={(req.data ?? 0) === 0}
          ctaLabel="Analisar agora"
        />

        <PendenciaCard
          icon={Package}
          titulo={<><Sigla>EPI</Sigla>s em estoque baixo</>}
          valor={epi.data ?? 0}
          descricao={
            (epi.data ?? 0) === 0
              ? "Todos os EPIs acima do estoque mínimo."
              : `Item(s) atingiu(ram) o estoque mínimo. Reponha antes que falte.`
          }
          to="/app/estoque/epi"
          cor="blue"
          loading={epi.isLoading}
          ok={(epi.data ?? 0) === 0}
          ctaLabel="Repor estoque"
        />

        <PendenciaCard
          icon={Stethoscope}
          titulo="Exames vencendo (30 dias)"
          valor={exames.data ?? 0}
          descricao={
            (exames.data ?? 0) === 0
              ? "Nenhum exame periódico vencendo no próximo mês."
              : `Colaboradores com ASO/exames a vencer.`
          }
          to="/app/employees"
          cor="amber"
          loading={exames.isLoading}
          ok={(exames.data ?? 0) === 0}
          ctaLabel="Agendar exame"
        />

        <PendenciaCard
          icon={ShieldAlert}
          titulo={<><Sigla>APR</Sigla>s vencendo (7 dias)</>}
          valor={aprs.data ?? 0}
          descricao={
            (aprs.data ?? 0) === 0
              ? "Nenhuma APR vencendo na próxima semana."
              : `Análise(s) de risco perto do vencimento.`
          }
          to="/app/aprs"
          cor="red"
          loading={aprs.isLoading}
          ok={(aprs.data ?? 0) === 0}
          ctaLabel="Renovar agora"
        />
      </div>
    </section>
  );
}