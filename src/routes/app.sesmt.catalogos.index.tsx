import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Library, Wind, ShieldAlert, Stethoscope, Syringe, HardHat, BookOpenCheck,
  Sparkles, ArrowRight, Layers,
} from "lucide-react";

export const Route = createFileRoute("/app/sesmt/catalogos/")({
  component: HubCatalogosPage,
  head: () => ({
    meta: [
      { title: "Hub de Catálogos SST — SIGMO" },
      { name: "description", content: "Biblioteca central de riscos, NRs, exames, vacinas, EPIs e gases atmosféricos com cruzamentos dinâmicos." },
    ],
  }),
});

type Card = {
  to: string;
  titulo: string;
  descricao: string;
  Icon: typeof Wind;
  gradient: string;
  badge?: string;
  disabled?: boolean;
};

const CARDS: Card[] = [
  {
    to: "/app/sesmt/catalogos/cruzamentos",
    titulo: "Cruzamentos Inteligentes",
    descricao: "Infográfico interativo: escolha um risco e veja em tempo real os exames, NRs, EPIs e vacinas vinculados. O cérebro do Safety Engine.",
    Icon: Sparkles,
    gradient: "from-fuchsia-600 via-purple-600 to-indigo-700",
    badge: "NOVO",
  },
  {
    to: "/app/sesmt/catalogos/riscos",
    titulo: "Catálogo de Riscos",
    descricao: "Biblioteca-mãe de perigos e agentes de risco (Físico, Químico, Biológico, Ergonômico, Acidente) — base do PGR e da Matriz.",
    Icon: ShieldAlert,
    gradient: "from-rose-600 via-red-600 to-orange-600",
  },
  {
    to: "/app/sesmt/catalogos/nrs",
    titulo: "Normas Regulamentadoras",
    descricao: "Catálogo oficial das NRs do MTE com link para o texto legal — usado em cargos, treinamentos, APRs, PETs e OSS.",
    Icon: BookOpenCheck,
    gradient: "from-emerald-600 via-teal-600 to-cyan-700",
  },
  {
    to: "/app/sesmt/catalogos/exames",
    titulo: "Catálogo de Exames (eSocial)",
    descricao: "Procedimentos médicos com códigos da Tabela 27 eSocial. Base do PCMSO e das convocações de ASO.",
    Icon: Stethoscope,
    gradient: "from-sky-600 via-blue-600 to-indigo-700",
  },
  {
    to: "/app/sesmt/catalogos/gases",
    titulo: "Gases Atmosféricos (NR-33)",
    descricao: "LEO / LIE / LSE — usado nas medições atmosféricas das Permissões de Trabalho em espaço confinado.",
    Icon: Wind,
    gradient: "from-cyan-500 via-sky-600 to-blue-700",
  },
  {
    to: "/app/sesmt/catalogos/vacinas",
    titulo: "Vacinas Ocupacionais",
    descricao: "PNI aplicado ao PCMSO — Hepatite B, Tétano, Febre Amarela e outras conforme risco biológico.",
    Icon: Syringe,
    gradient: "from-lime-500 via-green-600 to-emerald-700",
  },
  {
    to: "/app/sesmt/catalogos/epis",
    titulo: "Catálogo de EPIs (CA)",
    descricao: "Equipamentos de Proteção Individual com Certificado de Aprovação — base da Ficha de EPI, do PGR e do estoque.",
    Icon: HardHat,
    gradient: "from-amber-500 via-orange-600 to-red-600",
  },
];

function HubCatalogosPage() {
  return (
    <div className="min-h-full bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white">
      {/* HERO */}
      <div className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(139,92,246,0.25),transparent_50%),radial-gradient(circle_at_80%_80%,rgba(236,72,153,0.20),transparent_50%)]" />
        <div className="relative max-w-7xl mx-auto px-6 py-10">
          <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-white/60">
            <Layers className="h-3.5 w-3.5" />
            SESMT · Hub Central
          </div>
          <h1 className="mt-3 text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-white via-violet-200 to-fuchsia-300 bg-clip-text text-transparent">
            Catálogos SST
          </h1>
          <p className="mt-3 text-sm md:text-base text-white/70 max-w-2xl">
            A biblioteca única do SIGMO. Riscos, NRs, exames, vacinas, EPIs e gases — todos conectados.
            Alimenta o PGR, o PCMSO, a Matriz de Riscos, as OSS, as APRs, as PETs e a Ficha de EPI.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/10 border border-white/20">
              <Library className="h-3 w-3 inline mr-1" /> Fonte única da verdade
            </span>
            <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/10 border border-white/20">
              Governança
            </span>
            <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/10 border border-white/20">
              Reuso multi-módulo
            </span>
          </div>
        </div>
      </div>

      {/* GRID */}
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {CARDS.map((c) => (
            <HubCard key={c.to} {...c} />
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-5 text-xs text-white/70 leading-relaxed">
          <b className="text-white/90">Como funciona:</b> cada catálogo alimenta pontos diferentes do
          sistema. Ex.: um novo <em>Risco Biológico</em> no catálogo aparece automaticamente na Matriz de
          Riscos dos cargos que trabalham em contato com material contaminado; o Safety Engine cruza
          com exames e vacinas obrigatórias; e a Ficha de EPI puxa os equipamentos sugeridos.
        </div>
      </div>
    </div>
  );
}

function HubCard({ to, titulo, descricao, Icon, gradient, badge, disabled }: Card) {
  const content = (
    <div
      className={`group relative h-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur transition-all duration-300 ${
        disabled ? "opacity-60 cursor-not-allowed" : "hover:scale-[1.02] hover:border-white/30 hover:shadow-2xl hover:shadow-fuchsia-500/10"
      }`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-20 transition-opacity duration-500`} />
      <div className="relative p-6 flex flex-col h-full">
        <div className="flex items-start justify-between">
          <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${gradient} shadow-lg`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
          {badge && (
            <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
              badge === "NOVO"
                ? "bg-fuchsia-500/20 border-fuchsia-400/40 text-fuchsia-200"
                : "bg-white/5 border-white/20 text-white/50"
            }`}>
              {badge}
            </span>
          )}
        </div>
        <h3 className="mt-4 text-lg font-black tracking-tight text-white">{titulo}</h3>
        <p className="mt-2 text-xs text-white/60 leading-relaxed flex-1">{descricao}</p>
        {!disabled && (
          <div className="mt-4 flex items-center gap-1.5 text-xs font-bold text-white/80 group-hover:text-white transition">
            Abrir catálogo <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        )}
      </div>
    </div>
  );
  if (disabled) return content;
  return <Link to={to as never}>{content}</Link>;
}