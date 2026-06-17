import { Link } from "@tanstack/react-router";
import {
  Megaphone, Package, ShoppingCart, ShieldAlert, Stethoscope, CheckCircle2, ArrowRight,
  CalendarClock, FileWarning, Syringe, UserX, ClipboardCheck, GraduationCap, KeyRound, BellOff,
  FileWarning as TncIcon,
  HelpCircle, PackageX, Wrench, ShieldCheck,
  FileSignature,
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
  "epi-critico": {
    titulo: <><Sigla>EPI</Sigla>s críticos (≤5 un / zerados)</>,
    descricaoPend: (n) => `${n} item(s) com 5 unidades ou menos — risco de ruptura.`,
    descricaoOk: "Nenhum EPI em nível crítico.",
    to: "/app/estoque/epi", icon: PackageX, ctaPend: "Repor urgente",
  },
  "inspecao-epi": {
    titulo: "Inspeção mensal de EPI",
    descricaoPend: () => "Fim de mês: registre a inspeção mensal antes de fechar.",
    descricaoOk: "Inspeção mensal já realizada.",
    to: "/app/estoque/epi", icon: ClipboardCheck, ctaPend: "Realizar inspeção", snoozable: true,
  },
  "acoes-atrasadas": {
    titulo: "Ações 5W2H atrasadas",
    descricaoPend: (n) => `${n} ação(ões) do plano com prazo vencido — trate antes da auditoria.`,
    descricaoOk: "Plano de ações em dia.",
    to: "/app/acoes", icon: Wrench, ctaPend: "Tratar ações",
  },
  "acoes-eficacia": {
    titulo: "Eficácia pendente de validação",
    descricaoPend: (n) => `${n} ação(ões) concluídas aguardando validação da eficácia (ISO 9001).`,
    descricaoOk: "Nenhuma eficácia em aberto.",
    to: "/app/acoes", icon: ShieldCheck, ctaPend: "Validar eficácia",
  },
  "oss-pendentes": {
    titulo: "OSS pendentes (NR-01)",
    descricaoPend: (n) => `${n} Ordem(ns) de Serviço aguardando assinatura, vencidas ou substituídas por mudança de cargo/risco.`,
    descricaoOk: "Todas as OSS estão em dia.",
    to: "/app/oss", icon: FileSignature, ctaPend: "Tratar OSS",
  },
};

const SEV_PALETTE = {
  // Accent overlays para o tema dark glass. Cada severidade tem:
  //  edge   → gradient sutil no topo do card (faixa de acento)
  //  glow   → box-shadow ambiente
  //  border → cor da borda sutil
  //  icon   → badge translúcido do ícone
  //  chip   → pill da severidade (canto direito)
  //  cta    → cor do link "Renovar agora →"
  critico: {
    edge: "from-red-500/40 via-red-500/10",
    glow: "shadow-[0_0_40px_-12px_rgba(239,68,68,0.55)]",
    border: "border-red-400/25 hover:border-red-400/45",
    icon: "bg-red-500/15 text-red-300 ring-1 ring-red-400/30",
    chip: "bg-red-500/15 text-red-200 ring-1 ring-red-400/30",
    cta: "text-red-300 hover:text-red-200",
    number: "text-red-100",
    label: "Crítico",
  },
  alto: {
    edge: "from-amber-400/35 via-amber-400/10",
    glow: "shadow-[0_0_36px_-14px_rgba(251,191,36,0.45)]",
    border: "border-amber-300/20 hover:border-amber-300/40",
    icon: "bg-amber-400/15 text-amber-200 ring-1 ring-amber-300/30",
    chip: "bg-amber-400/15 text-amber-100 ring-1 ring-amber-300/30",
    cta: "text-amber-200 hover:text-amber-100",
    number: "text-amber-50",
    label: "Alto",
  },
  medio: {
    edge: "from-sky-400/30 via-sky-400/10",
    glow: "shadow-[0_0_32px_-14px_rgba(56,189,248,0.4)]",
    border: "border-sky-300/20 hover:border-sky-300/40",
    icon: "bg-sky-400/15 text-sky-200 ring-1 ring-sky-300/30",
    chip: "bg-sky-400/15 text-sky-100 ring-1 ring-sky-300/30",
    cta: "text-sky-200 hover:text-sky-100",
    number: "text-sky-50",
    label: "Médio",
  },
  ok: {
    edge: "from-emerald-400/30 via-emerald-400/10",
    glow: "shadow-[0_0_30px_-14px_rgba(52,211,153,0.4)]",
    border: "border-emerald-300/20 hover:border-emerald-300/40",
    icon: "bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/30",
    chip: "bg-emerald-400/15 text-emerald-100 ring-1 ring-emerald-300/30",
    cta: "text-emerald-200 hover:text-emerald-100",
    number: "text-emerald-50",
    label: "OK",
  },
  neutro: {
    edge: "from-white/15 via-white/5",
    glow: "",
    border: "border-white/10 hover:border-white/20",
    icon: "bg-white/5 text-[rgba(245,225,225,0.6)] ring-1 ring-white/10",
    chip: "bg-white/5 text-[rgba(245,225,225,0.55)] ring-1 ring-white/10",
    cta: "text-[rgba(245,225,225,0.6)] hover:text-[rgba(245,225,225,0.85)]",
    number: "text-[rgba(245,225,225,0.55)]",
    label: "Sem dados",
  },
} as const;

function PendenciaCard({ item }: { item: PendenciaItem }) {
  const meta = META[item.key];
  if (!meta) return null;
  const isNeutral = item.ok && item.noData;
  const sev: keyof typeof SEV_PALETTE = isNeutral ? "neutro" : item.ok ? "ok" : item.severity;
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
      "group relative flex flex-col gap-3 rounded-2xl border p-5 transition-all overflow-hidden",
      "bg-gradient-to-b from-white/[0.04] to-white/[0.015] backdrop-blur-xl",
      "hover:-translate-y-0.5",
      c.border, c.glow,
      snoozed && "opacity-50",
    )}>
      {/* faixa de acento no topo */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r to-transparent",
          c.edge,
        )}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -top-24 -right-16 h-48 w-48 rounded-full blur-3xl opacity-40 bg-gradient-radial",
          c.edge,
        )}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className={cn("p-2.5 rounded-xl", c.icon)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className={cn("text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full", c.chip)}>
          {item.loading ? "Verificando…" : isNeutral ? "Sem dados" : item.ok ? "Tudo certo" : c.label}
        </div>
      </div>
      <div className="relative">
        <div className="flex items-baseline gap-2">
          <span className={cn("text-4xl font-black leading-none tabular-nums", c.number)}>
            {item.loading
              ? "—"
              : isNeutral
                ? <HelpCircle className="h-9 w-9 text-[rgba(245,225,225,0.35)] inline" />
                : item.ok
                  ? <CheckCircle2 className="h-9 w-9 text-emerald-300 inline" />
                  : item.count}
          </span>
        </div>
        <div className="mt-1.5 text-sm font-bold text-[rgba(255,240,242,0.96)]">{meta.titulo}</div>
        <div className="mt-1 text-xs leading-relaxed text-[rgba(245,225,225,0.7)]">
          {isNeutral
            ? "Ainda não há dados cadastrados para avaliar este item."
            : item.ok ? meta.descricaoOk : meta.descricaoPend(item.count)}
        </div>
        {snoozed && (
          <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[rgba(245,225,225,0.55)]">
            <BellOff className="h-3 w-3" /> Adiado até amanhã
          </div>
        )}
      </div>
      <div className="relative mt-auto pt-3 flex items-center justify-between gap-2 border-t border-white/[0.06]">
        <Link
          to={meta.to}
          className={cn("inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider transition-colors", c.cta)}
        >
          {item.ok ? (meta.ctaOk ?? "Ver detalhes") : meta.ctaPend}
          <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
        </Link>
        {!item.ok && (
          snoozed ? (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); clearSnooze(item.key); }}
              className="text-[10px] font-bold uppercase tracking-wider text-[rgba(245,225,225,0.5)] hover:text-[rgba(245,225,225,0.9)] transition-colors"
            >
              Reativar
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); snoozeUntilTomorrow(item.key); }}
              className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[rgba(245,225,225,0.45)] hover:text-[rgba(245,225,225,0.85)] transition-colors"
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
          className="relative inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-b from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white text-[10px] font-black uppercase tracking-wider transition shadow-[0_8px_24px_-8px_rgba(220,38,38,0.6)] ring-1 ring-red-400/30"
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
  const semDadosCount = items.filter((i) => i.ok && i.noData).length;
  const [, force] = useState(0);
  useEffect(() => {
    const h = () => force((x) => x + 1);
    window.addEventListener("sigmo:snooze-changed", h);
    return () => window.removeEventListener("sigmo:snooze-changed", h);
  }, []);

  // Esconde "Tudo certo" — só faz sentido mostrar pendências reais e "Sem dados"
  // (que sinalizam rotinas ainda não configuradas).
  const visible = items.filter((i) => !(i.ok && !i.noData));

  // Ordenação automática: severidade > snoozed > sem dados
  const sorted = [...visible].sort((a, b) => {
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
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-400/25 mb-3">
            <CalendarClock className="h-3.5 w-3.5 text-red-300" />
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-red-200">
              Hoje · {diaSemanaPt()}
            </span>
          </div>
          <h2 className="heading-display text-2xl md:text-4xl text-brand tracking-tight">
            O que precisa ser feito agora
          </h2>
          <p className="text-sm text-[rgba(245,225,225,0.7)] mt-2">
            {totalPendencias === 0
              ? semDadosCount > 0
                ? `Sistema em configuração — ${semDadosCount} indicador(es) ainda sem dados para avaliar.`
                : "Tudo em dia — sem pendências críticas no momento."
              : `Você tem ${totalPendencias} ${totalPendencias === 1 ? "pendência" : "pendências"} aguardando.`}
          </p>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-emerald-300/25 bg-gradient-to-b from-emerald-500/10 to-emerald-500/[0.03] backdrop-blur-xl p-8 text-center shadow-[0_0_40px_-12px_rgba(52,211,153,0.35)]">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-emerald-400/15 ring-1 ring-emerald-300/40 text-emerald-200 mb-3">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <div className="text-lg font-black text-emerald-100">Tudo em dia</div>
          <div className="text-sm text-emerald-200/80 mt-1">
            Nenhuma pendência detectada. Bom trabalho!
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sorted.map((item) => <PendenciaCard key={item.key} item={item} />)}
        </div>
      )}
    </section>
  );
}
