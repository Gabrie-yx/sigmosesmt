import { Link } from "@tanstack/react-router";
import {
  Megaphone, Package, ShoppingCart, ShieldAlert, Stethoscope, CheckCircle2, ArrowRight,
  CalendarClock, FileWarning, Syringe, UserX, ClipboardCheck, GraduationCap, KeyRound, BellOff,
  FileWarning as TncIcon,
} from "lucide-react";
import { Sigla } from "@/components/sigla";
import { cn } from "@/lib/utils";
import { usePendencias, severityRank, type PendenciaItem } from "@/hooks/use-pendencias";
import { snoozeUntilTomorrow, isSnoozed, clearSnooze } from "@/lib/pendencias-snooze";
import { useEffect, useState } from "react";

function diaSemanaPt() {
  const nomes = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
  return nomes[new Date().getDay()];
}

interface CardMeta {
  titulo: React.ReactNode;
  descricaoPend: (n: number) => React.ReactNode;
  descricaoOk: React.ReactNode;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  ctaPend: string;
  ctaOk?: string;
  snoozable?: boolean;
}

const META: Record<string, CardMeta> = {
  "asos-vencidos": {
    titulo: <><Sigla>ASO</Sigla>s vencidos</>,
    descricaoPend: (n) => `${n} colaborador(es) com ASO fora da validade — bloqueia acesso.`,
    descricaoOk: "Todos os ASOs em dia.",
    to: "/app/employees", icon: Stethoscope, ctaPend: "Renovar urgente",
  },
  "aprs-vencidas": {
    titulo: <><Sigla>APR</Sigla>s vencidas</>,
    descricaoPend: (n) => `${n} APR(s) já passaram da validade. Renove antes de liberar o trabalho.`,
    descricaoOk: "Nenhuma APR vencida.",
    to: "/app/aprs", icon: FileWarning, ctaPend: "Renovar agora",
  },
  "pops-atrasados": {
    titulo: "POPs com revisão atrasada",
    descricaoPend: (n) => `${n} procedimento(s) com revisão vencida.`,
    descricaoOk: "Procedimentos em dia.",
    to: "/app/sesmt/procedimentos", icon: ClipboardCheck, ctaPend: "Revisar POPs",
  },
  "vacinas-vencidas": {
    titulo: "Vacinas vencidas",
    descricaoPend: (n) => `${n} dose(s) com data ultrapassada.`,
    descricaoOk: "Esquema vacinal em dia.",
    to: "/app/employees", icon: Syringe, ctaPend: "Atualizar carteira",
  },
  "colab-sem-docs": {
    titulo: "Colaboradores sem documentação",
    descricaoPend: (n) => `${n} ativo(s) sem ASO ou integração registrados.`,
    descricaoOk: "Todos os colaboradores documentados.",
    to: "/app/employees", icon: UserX, ctaPend: "Completar cadastro",
  },
  "dds-hoje": {
    titulo: <><Sigla>DDS</Sigla> de hoje</>,
    descricaoPend: () => "Hoje é dia de DDS. Registre o diálogo com a equipe.",
    descricaoOk: "DDS de hoje já lançado.",
    to: "/app/dds", icon: Megaphone, ctaPend: "Registrar DDS", snoozable: true,
  },
  "aprs-vencendo": {
    titulo: <><Sigla>APR</Sigla>s vencendo (7 dias)</>,
    descricaoPend: (n) => `${n} APR(s) perto do vencimento.`,
    descricaoOk: "Nenhuma APR vencendo nesta semana.",
    to: "/app/aprs", icon: ShieldAlert, ctaPend: "Renovar antes",
  },
  "ptes-vencidas": {
    titulo: <><Sigla>PTE</Sigla>s antigas (+7 dias)</>,
    descricaoPend: (n) => `${n} PTE(s) com mais de 7 dias — revise ou reemita.`,
    descricaoOk: "PTEs em dia.",
    to: "/app/ptes", icon: KeyRound, ctaPend: "Revisar PTEs",
  },
  "exames-30": {
    titulo: "Exames vencendo (30 dias)",
    descricaoPend: (n) => `${n} colaborador(es) com exames a vencer.`,
    descricaoOk: "Nenhum exame vencendo no próximo mês.",
    to: "/app/employees", icon: Stethoscope, ctaPend: "Agendar exames",
  },
  "trein-60": {
    titulo: "Treinamentos vencendo (60 dias)",
    descricaoPend: (n) => `${n} reciclagem(ns) próximas do vencimento.`,
    descricaoOk: "Matriz de treinamento em dia.",
    to: "/app/matriz-treinamento", icon: GraduationCap, ctaPend: "Programar reciclagem",
  },
  "req-pendentes": {
    titulo: "Requisições pendentes",
    descricaoPend: (n) => `${n} requisição(ões) aguardando parecer.`,
    descricaoOk: "Nenhuma requisição em análise.",
    to: "/app/sesmt/requisicoes", icon: ShoppingCart, ctaPend: "Analisar agora",
  },
  "epi-baixo": {
    titulo: <><Sigla>EPI</Sigla>s em estoque baixo</>,
    descricaoPend: (n) => `${n} item(s) no/abaixo do mínimo.`,
    descricaoOk: "Estoque de EPIs saudável.",
    to: "/app/estoque/epi", icon: Package, ctaPend: "Repor estoque",
  },
  "inspecao-epi": {
    titulo: "Inspeção mensal de EPI",
    descricaoPend: () => "Fim de mês: registre a inspeção mensal antes de fechar.",
    descricaoOk: "Inspeção mensal já realizada.",
    to: "/app/estoque/epi", icon: ClipboardCheck, ctaPend: "Realizar inspeção", snoozable: true,
  },
};

const SEV_PALETTE = {
  critico: { ring: "ring-red-300", bg: "from-red-50 to-white", icon: "bg-red-600 text-white", chip: "bg-red-100 text-red-800", cta: "text-red-700 hover:text-red-900", label: "Crítico" },
  alto:    { ring: "ring-amber-200", bg: "from-amber-50 to-white", icon: "bg-amber-500 text-white", chip: "bg-amber-100 text-amber-800", cta: "text-amber-700 hover:text-amber-900", label: "Alto" },
  medio:   { ring: "ring-blue-200", bg: "from-blue-50 to-white", icon: "bg-blue-600 text-white", chip: "bg-blue-100 text-blue-800", cta: "text-blue-700 hover:text-blue-900", label: "Médio" },
  ok:      { ring: "ring-emerald-200", bg: "from-emerald-50 to-white", icon: "bg-emerald-600 text-white", chip: "bg-emerald-100 text-emerald-800", cta: "text-emerald-700 hover:text-emerald-900", label: "OK" },
} as const;

function PendenciaCard({ item }: { item: PendenciaItem }) {
  const meta = META[item.key];
  if (!meta) return null;
  const sev = item.ok ? "ok" : item.severity;
  const c = SEV_PALETTE[sev];
  const Icon = meta.icon;
  const snoozed = isSnoozed(item.key);

  // Sugere abrir TNC apenas em pendências críticas concretas
  const canOpenTnc = !item.ok && item.severity === "critico" && item.count > 0;
  const tncSearch = canOpenTnc
    ? {
        titulo: `[Detectado pelo sistema] ${typeof meta.titulo === "string" ? meta.titulo : item.key}`,
        descricao: typeof meta.descricaoPend === "function"
          ? (meta.descricaoPend(item.count) as any)?.toString?.() ?? ""
          : "",
        origem: "SISTEMA",
        severidade: "ALTA",
        pendencia: item.key,
      }
    : null;

  return (
    <div className={cn(
      "group relative flex flex-col gap-3 rounded-2xl border bg-gradient-to-br p-5 shadow-sm hover:shadow-lg transition-all ring-1",
      c.bg, c.ring, snoozed && "opacity-60",
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className={cn("p-2.5 rounded-xl shadow-sm", c.icon)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className={cn("text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full", c.chip)}>
          {item.ok ? "Tudo certo" : item.loading ? "Verificando…" : c.label}
        </div>
      </div>
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-black text-slate-900 leading-none tabular-nums">
            {item.loading ? "—" : item.ok ? <CheckCircle2 className="h-9 w-9 text-emerald-600 inline" /> : item.count}
          </span>
        </div>
        <div className="mt-1 text-sm font-bold text-slate-900">{meta.titulo}</div>
        <div className="mt-1 text-xs text-slate-600 leading-relaxed">
          {item.ok ? meta.descricaoOk : meta.descricaoPend(item.count)}
        </div>
        {snoozed && (
          <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <BellOff className="h-3 w-3" /> Adiado até amanhã
          </div>
        )}
      </div>
      <div className="mt-auto pt-2 flex items-center justify-between gap-2">
        <Link
          to={meta.to}
          className={cn("inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider", c.cta)}
        >
          {item.ok ? (meta.ctaOk ?? "Ver detalhes") : meta.ctaPend}
          <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
        </Link>
        {!item.ok && (
          snoozed ? (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); clearSnooze(item.key); }}
              className="text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800"
            >
              Reativar
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); snoozeUntilTomorrow(item.key); }}
              className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800"
              title="Lembrar amanhã"
            >
              <BellOff className="h-3 w-3" /> Adiar
            </button>
          )
        )}
      </div>
      {canOpenTnc && tncSearch && (
        <Link
          to="/app/ncs"
          search={tncSearch as any}
          className="inline-flex items-center justify-center gap-1.5 mt-1 px-2 py-1.5 rounded-md bg-red-700 hover:bg-red-800 text-white text-[10px] font-bold uppercase tracking-wider transition"
          title="Abrir Tratativa de Não Conformidade pré-preenchida"
        >
          <TncIcon className="h-3 w-3" /> Abrir TNC
        </Link>
      )}
    </div>
  );
}

export function MinhasPendencias() {
  const { items, totalPendencias } = usePendencias();
  const [, force] = useState(0);
  useEffect(() => {
    const h = () => force((x) => x + 1);
    window.addEventListener("sigmo:snooze-changed", h);
    return () => window.removeEventListener("sigmo:snooze-changed", h);
  }, []);

  // Ordenação automática: severidade > snoozed > ok
  const sorted = [...items].sort((a, b) => {
    const aSnoozed = isSnoozed(a.key) && !a.ok ? 1 : 0;
    const bSnoozed = isSnoozed(b.key) && !b.ok ? 1 : 0;
    const aRank = a.ok ? 99 : severityRank(a.severity) + aSnoozed * 10;
    const bRank = b.ok ? 99 : severityRank(b.severity) + bSnoozed * 10;
    return aRank - bRank;
  });

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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {sorted.map((item) => <PendenciaCard key={item.key} item={item} />)}
      </div>
    </section>
  );
}
