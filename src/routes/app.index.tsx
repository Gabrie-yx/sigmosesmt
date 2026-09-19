import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  Anchor,
  ArrowRight,
  Award,
  BarChart3,
  Building2,
  CalendarCheck2,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  FileCheck2,
  Factory,
  Gem,
  GraduationCap,
  HardHat,
  HeartPulse,
  Leaf,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  Users,
  Waves,
  WifiOff,
} from "lucide-react";
import shipyardImg from "@/assets/dmn-shipyard.jpg";
import isoSeal from "@/assets/iso-9001.png";
import sigmoHomeLogo from "@/assets/sigmo-home-logo.png.asset.json";
import dmnLogoBranco from "@/assets/dmn-logo-branco-v2.png";
import { useAuth } from "@/hooks/use-auth";
import { IS_BACKEND_LOCAL } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/")({
  head: () => ({
    meta: [
      { title: "SIGMO | Sistema Integrado de Gestão Modular" },
      { name: "description", content: "Gestão integrada de Segurança e Saúde do Trabalho, documentos, pessoas, riscos e rotinas do SESMT." },
      { property: "og:title", content: "SIGMO | Gestão integrada de SST" },
      { property: "og:description", content: "Centralize pessoas, riscos, documentos e rotinas do SESMT em um único sistema." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { isModerator } = useAuth();
  return IS_BACKEND_LOCAL ? <DmnHome isModerator={isModerator} /> : <CloudHome isModerator={isModerator} />;
}

type HomeProps = { isModerator: boolean };

const cloudFeatures = [
  { icon: Users, title: "Pessoas e empresas", text: "Cadastros, vínculos, cargos, documentos e histórico reunidos em uma ficha completa.", to: "/app/employees" as const },
  { icon: TriangleAlert, title: "PGR e matriz de riscos", text: "Inventário de riscos por função, medidas de controle e planejamento conectado à operação.", to: "/app/pgr" as const },
  { icon: ClipboardCheck, title: "APR, PT e OSS", text: "Emissão, aprovação, assinaturas e rastreabilidade dos documentos de trabalho seguro.", to: "/app/aprs" as const },
  { icon: PackageCheck, title: "Gestão de EPI", text: "Estoque, autorizações, entregas assinadas, CAs, fichas e histórico por trabalhador.", to: "/app/estoque/epi" as const },
  { icon: HeartPulse, title: "Saúde ocupacional", text: "ASOs, convocações, vencimentos e alertas para agir antes de um bloqueio.", to: "/app/sesmt/medicina-ocupacional" as const },
  { icon: GraduationCap, title: "Treinamentos", text: "Matriz por função, turmas, certificados, validades e pendências em uma só visão.", to: "/app/matriz-treinamento" as const },
  { icon: HardHat, title: "DDS e inspeções", text: "Presenças, evidências, temas, checklists e acompanhamento das ações encontradas.", to: "/app/dds" as const },
  { icon: Activity, title: "Incidentes e ações", text: "Investigação, não conformidades, plano 5W2H, responsáveis, prazos e eficácia.", to: "/app/incidentes" as const },
  { icon: FileCheck2, title: "Documentos e assinaturas", text: "Assinatura de PDFs, versões, registros de uso e consulta dentro do próprio SIGMO.", to: "/app/assinador" as const },
];

function CloudHome({ isModerator }: HomeProps) {
  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-background text-foreground">
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="absolute inset-0 [background:var(--hero-grad)]" />
        <div className="absolute inset-0 [background:var(--hero-flare)]" />
        <div className="relative mx-auto grid min-h-[560px] max-w-7xl items-center gap-12 px-6 py-16 md:px-14 lg:grid-cols-[0.92fr_1.08fr] lg:py-20">
          <div className="max-w-xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/35 bg-background/20 px-3 py-1.5 backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-foreground/90">Sistema de Gestão SESMT</span>
            </div>
            <img src={sigmoHomeLogo.url} alt="SIGMO — Sistema Integrado de Gestão Modular" className="mb-7 h-auto w-[250px] max-w-full object-contain md:w-[310px]" />
            <h1 className="heading-display text-3xl font-semibold leading-tight text-foreground md:text-5xl">
              Segurança do trabalho organizada para qualquer operação.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-foreground/75 md:text-lg">
              O SIGMO reúne pessoas, riscos, documentos e rotinas do SESMT. Você enxerga pendências, registra evidências e acompanha a prevenção sem depender de controles espalhados.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/app/painel" className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-black text-primary-foreground shadow-lg transition-transform hover:-translate-y-0.5">
                <BarChart3 className="h-4 w-4" /> Abrir painel <ArrowRight className="h-4 w-4" />
              </Link>
              {isModerator && (
                <Link to="/app/hoje" className="inline-flex items-center gap-2 rounded-md border border-border bg-background/50 px-6 py-3 text-sm font-bold text-foreground backdrop-blur-md transition-colors hover:bg-accent">
                  <CalendarCheck2 className="h-4 w-4 text-primary" /> O que fazer hoje?
                </Link>
              )}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-2xl" aria-label="Visão original do painel SIGMO">
            <div className="absolute -inset-4 rounded-2xl bg-primary/10 blur-2xl" />
            <div className="relative overflow-hidden rounded-lg border border-border/70 bg-card/95 shadow-2xl backdrop-blur-xl">
              <div className="flex h-11 items-center justify-between border-b border-border/70 px-4">
                <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-primary" /><span className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">Painel SESMT</span></div>
                <span className="text-xs font-semibold text-muted-foreground">Visão geral</span>
              </div>
              <div className="grid gap-3 p-4 sm:grid-cols-3">
                {[
                  [ShieldCheck, "Status geral", "Aptidão e alertas"],
                  [CalendarCheck2, "Vencimentos", "ASO e treinamentos"],
                  [BarChart3, "Indicadores", "Acompanhamento mensal"],
                ].map(([Icon, title, text]) => {
                  const PreviewIcon = Icon as typeof ShieldCheck;
                  return <div key={String(title)} className="rounded-md border border-border bg-background/60 p-4"><PreviewIcon className="mb-6 h-7 w-7 text-primary" /><div className="text-sm font-bold">{String(title)}</div><div className="mt-1.5 text-xs text-muted-foreground">{String(text)}</div></div>;
                })}
              </div>
              <div className="grid gap-3 px-4 pb-4 sm:grid-cols-[1.35fr_0.65fr]">
                <div className="rounded-md border border-border bg-background/60 p-4">
                  <div className="mb-5 flex items-center justify-between"><span className="text-sm font-bold">Evolução da conformidade</span><span className="text-xs text-muted-foreground">Últimos meses</span></div>
                  <div className="flex h-28 items-end gap-2 border-b border-l border-border/70 px-2">
                    {[38, 52, 46, 68, 62, 82, 76, 92].map((height, index) => <div key={index} className="flex-1 rounded-t-sm bg-primary/80" style={{ height: `${height}%`, opacity: 0.45 + index * 0.06 }} />)}
                  </div>
                </div>
                <div className="rounded-md border border-border bg-background/60 p-4">
                  <div className="text-sm font-bold">Próximas ações</div>
                  <div className="mt-4 space-y-3">
                    {["Exames ocupacionais", "Treinamentos", "Inspeções"].map((label, index) => <div key={label} className="flex items-center gap-2"><CheckCircle2 className={`h-4 w-4 ${index === 0 ? "text-primary" : "text-muted-foreground"}`} /><span className="text-xs text-foreground/75">{label}</span></div>)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-card/45">
        <div className="mx-auto grid max-w-7xl gap-px px-6 py-8 md:grid-cols-4 md:px-14">
          {[
            [Building2, "Um só lugar", "Empresas, pessoas e histórico conectados"],
            [ShieldCheck, "Rastreabilidade", "Registros, responsáveis e evidências"],
            [WifiOff, "Continuidade", "Rotinas essenciais disponíveis mesmo offline"],
            [FileCheck2, "Menos papel", "Documentos gerados e consultados no sistema"],
          ].map(([Icon, title, text]) => {
            const BenefitIcon = Icon as typeof Building2;
            return <div key={String(title)} className="flex gap-3 px-4 py-4"><BenefitIcon className="mt-0.5 h-6 w-6 shrink-0 text-primary" /><div><div className="text-base font-bold">{String(title)}</div><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{String(text)}</p></div></div>;
          })}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20 md:px-14">
        <div className="max-w-2xl">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Rotina com clareza</div>
          <h2 className="heading-display mt-3 text-3xl font-semibold md:text-4xl">O sistema mostra o que exige atenção.</h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground md:text-base">Alertas deixam de ficar escondidos em planilhas. O painel diário organiza o trabalho por prioridade e leva cada responsável direto à pendência.</p>
        </div>
        <div className="mt-10 grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4"><div><div className="text-base font-black">O que fazer hoje?</div><div className="mt-1 text-xs text-muted-foreground">Prioridades organizadas automaticamente</div></div><CalendarCheck2 className="h-6 w-6 text-primary" /></div>
            <div className="grid gap-3 p-5 sm:grid-cols-2">
              {["Exames e ASOs", "Documentos de terceiros", "DDS e integrações", "EPI e autorizações"].map((title, index) => <div key={title} className="flex min-h-20 items-start gap-3 rounded-md border border-border bg-background/50 p-3"><div className={`mt-0.5 h-3 w-3 rounded-full ${index < 2 ? "bg-destructive" : "bg-primary"}`} /><div><div className="text-sm font-bold">{title}</div><div className="mt-1 text-xs leading-relaxed text-muted-foreground">Pendências, prazos e acesso à ação necessária</div></div></div>)}
            </div>
          </div>
          <div className="space-y-6">
            {["Prioriza o dia", "Evita vencimentos", "Distribui responsabilidades"].map((title, index) => <div key={title} className="flex gap-4"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-sm font-black text-primary">0{index + 1}</div><div><h3 className="font-bold">{title}</h3><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{index === 0 ? "Reúne as tarefas críticas para começar o expediente sabendo onde agir." : index === 1 ? "Antecipa ASOs, treinamentos, documentos e inspeções antes do prazo." : "Cada registro guarda responsável, andamento, evidência e conclusão."}</p></div></div>)}
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-card/35">
        <div className="mx-auto max-w-7xl px-6 py-20 md:px-14">
          <div className="text-center"><div className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Do campo à gestão</div><h2 className="heading-display mt-3 text-3xl font-semibold md:text-4xl">Uma plataforma, várias rotinas de SST.</h2></div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cloudFeatures.map(({ icon: Icon, title, text, to }) => (
              <Link key={title} to={to} className="group rounded-lg border border-border bg-background/45 p-6 transition-colors hover:border-primary/55 hover:bg-accent/40">
                <div className="flex items-start justify-between gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary"><Icon className="h-7 w-7" /></div><ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" /></div>
                <h3 className="mt-5 text-lg font-black">{title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20 md:px-14">
        <div className="grid items-center gap-10 lg:grid-cols-[0.82fr_1.18fr]">
          <div><div className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Capacitação sob controle</div><h2 className="heading-display mt-3 text-3xl font-semibold md:text-4xl">Treinamentos ligados à função e aos riscos.</h2><p className="mt-4 text-sm leading-relaxed text-muted-foreground md:text-base">A matriz mostra o que cada pessoa precisa realizar, o que está válido, a vencer, vencido ou programado. Os filtros ajudam a agir por empresa, função e situação.</p><Link to="/app/matriz-treinamento" className="mt-6 inline-flex items-center gap-2 text-sm font-black text-primary">Abrir matriz de treinamento <ArrowRight className="h-4 w-4" /></Link></div>
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3"><div className="flex items-center gap-2 text-xs font-black"><GraduationCap className="h-4 w-4 text-primary" /> Matriz de Treinamento</div><div className="flex gap-2"><span className="rounded-sm border border-border px-2 py-1 text-[9px] text-muted-foreground">Empresa</span><span className="rounded-sm border border-border px-2 py-1 text-[9px] text-muted-foreground">Situação</span></div></div>
            <div className="overflow-x-auto p-4"><div className="min-w-[520px]"><div className="grid grid-cols-[1.4fr_repeat(5,1fr)] gap-1 text-center text-[9px] font-bold text-muted-foreground"><div className="text-left">FUNÇÃO</div>{["NR-01", "NR-06", "NR-10", "NR-33", "NR-35"].map((nr) => <div key={nr}>{nr}</div>)}</div>{["Técnico de segurança", "Eletricista", "Operador", "Supervisor"].map((role, row) => <div key={role} className="mt-1 grid grid-cols-[1.4fr_repeat(5,1fr)] gap-1"><div className="flex min-h-9 items-center rounded-sm bg-muted/50 px-2 text-[9px] font-semibold">{role}</div>{Array.from({ length: 5 }, (_, col) => { const state = (row + col) % 4; return <div key={col} className={`min-h-9 rounded-sm ${state === 0 ? "bg-primary/80" : state === 1 ? "bg-chart-3/70" : state === 2 ? "bg-destructive/70" : "bg-chart-2/70"}`} />; })}</div>)}</div></div>
          </div>
        </div>
      </section>

      <section className="border-t border-border [background:var(--cta-grad)]">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-6 py-12 md:flex-row md:items-center md:px-14">
          <div><div className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">SIGMO</div><h2 className="heading-display mt-2 text-2xl font-semibold text-foreground md:text-3xl">Informação certa para prevenir, decidir e comprovar.</h2></div>
          <Link to="/app/painel" className="inline-flex shrink-0 items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-black text-primary-foreground">Entrar no painel <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>
    </div>
  );
}

function DmnHome({ isModerator }: HomeProps) {
  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-[#f1f5f9]">
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${shipyardImg})` }}
        />
        <div className="absolute inset-0 [background:var(--hero-grad)]" />
        <div className="absolute inset-0 [background:var(--hero-flare)]" />

        <div className="relative px-6 md:px-14 py-16 md:py-24 max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-[1.4fr_1fr] gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm mb-6">
                <Waves className="h-3.5 w-3.5 text-red-200" />
                <span className="text-[10px] font-black uppercase tracking-[0.25em] text-white/90">
                  {IS_BACKEND_LOCAL ? "Construção Naval · Amazônia" : "Sistema de Gestão SESMT"}
                </span>
              </div>
              <h1 className="mb-6">
                <img
                  src={IS_BACKEND_LOCAL ? dmnLogoBranco : sigmoHomeLogo.url}
                  alt={IS_BACKEND_LOCAL ? "Estaleiro DMN" : "SIGMO — Sistema de Gestão SESMT"}
                  className={
                    (IS_BACKEND_LOCAL
                      ? "w-[280px] md:w-[420px] lg:w-[500px]"
                      : "w-[210px] md:w-[260px] lg:w-[300px]") +
                    " max-w-full h-auto object-contain drop-shadow-[0_4px_20px_rgba(0,0,0,0.35)]"
                  }
                />
              </h1>
              <p className="text-base md:text-lg text-white/85 max-w-2xl leading-relaxed font-light mb-8">
                Há mais de uma década forjando a indústria naval da Amazônia.
                Tecnologia, sustentabilidade e excelência em cada embarcação que
                navega pelos rios do norte do Brasil.
              </p>
              <div className="flex flex-wrap gap-3">
                {isModerator && (
                  <Link
                    to="/app/hoje"
                    className="group inline-flex items-center gap-2 px-7 py-4 rounded-xl bg-white text-[color:var(--on-light-brand)] text-sm font-black uppercase tracking-widest shadow-2xl hover:-translate-y-0.5 transition-all"
                  >
                    <CalendarCheck2 className="h-5 w-5" />
                    O que fazer hoje?
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                )}
              </div>
            </div>

            {/* ISO 9001 SEAL CARD */}
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-br from-red-500/30 to-amber-500/20 rounded-3xl blur-2xl" />
              <div className="relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl">
                <div className="flex flex-col items-center text-center">
                  <img
                    src={isoSeal}
                    alt="Certificação ISO 9001"
                    className="w-40 h-40 object-contain drop-shadow-2xl mb-4"
                  />
                  <div className="text-[10px] font-black uppercase tracking-[0.3em] text-red-200 mb-1">
                    Certificação
                  </div>
                  <div className="text-2xl font-black text-white tracking-tight">
                    ISO 9001
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-white/60 mt-2">
                    Sistema de Gestão da Qualidade
                  </div>
                  <div className="mt-5 pt-5 border-t border-white/15 w-full grid grid-cols-3 gap-2">
                    {[
                      { icon: ShieldCheck, label: "Segurança" },
                      { icon: Gem, label: "Qualidade" },
                      { icon: Leaf, label: "Sustentável" },
                    ].map(({ icon: Icon, label }) => (
                      <div key={label} className="flex flex-col items-center gap-1">
                        <Icon className="h-4 w-4 text-red-200" />
                        <span className="text-[8px] font-black uppercase tracking-wider text-white/70">
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* wave divider */}
        <svg className="relative block w-full h-12 md:h-16 -mb-1" viewBox="0 0 1440 80" preserveAspectRatio="none">
          <path d="M0,40 C320,80 720,0 1440,50 L1440,80 L0,80 Z" fill="#f1f5f9" />
        </svg>
      </section>

      {/* MISSÃO · VISÃO · VALORES */}
      <section className="relative overflow-hidden">
        {/* fundo vermelho/vinho com brilhos */}
        <div className="absolute inset-0 [background:var(--section-grad)]" />
        <div className="absolute inset-0 opacity-40 pointer-events-none">
          <div className="absolute -top-32 -left-20 w-96 h-96 rounded-full bg-red-600/30 blur-3xl" />
          <div className="absolute -bottom-32 -right-20 w-96 h-96 rounded-full bg-amber-500/20 blur-3xl" />
        </div>

        <div className="relative px-6 md:px-14 py-20 max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 mb-4">
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-white">
                Nosso DNA
              </span>
            </div>
            <h2 className="heading-display text-3xl md:text-5xl font-light text-white tracking-tight drop-shadow-lg">
              Missão · Visão · Valores
            </h2>
            <div className="h-1 w-20 bg-gradient-to-r from-amber-400 to-red-300 rounded-full mx-auto mt-4" />
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Compass,
                tag: "Missão",
                text: "Construir embarcações com qualidade e tecnologia, buscando a melhoria contínua, prezando a Segurança e o Meio Ambiente.",
                border: "border-white/70",
                tagColor: "text-white",
                iconColor: "text-white/80",
                glowA: "bg-white/25",
                glowB: "bg-white/10",
              },
              {
                icon: Anchor,
                tag: "Visão",
                text: "Ser reconhecida como uma empresa de referência no setor da construção naval e estar entre os melhores estaleiros da região norte, priorizando a confiabilidade e qualidade nos produtos e serviços, sempre almejando a satisfação do cliente.",
                border: "border-amber-400/80",
                tagColor: "text-amber-300",
                iconColor: "text-amber-300/90",
                glowA: "bg-amber-400/40",
                glowB: "bg-amber-500/15",
              },
              {
                icon: Gem,
                tag: "Valores",
                text: "Comprometimento dos colaboradores, preservação do meio ambiente e segurança do trabalho, ética e transparência no relacionamento com clientes e acionistas.",
                border: "border-red-400/80",
                tagColor: "text-red-300",
                iconColor: "text-red-300/90",
                glowA: "bg-red-500/40",
                glowB: "bg-red-400/15",
              },
            ].map(({ icon: Icon, tag, text, border, tagColor, iconColor, glowA, glowB }) => (
              <article
                key={tag}
                className={`group relative rounded-2xl p-8 bg-black/80 border ${border} shadow-[0_8px_32px_rgba(0,0,0,0.5)] hover:-translate-y-1 hover:bg-black/90 transition-all duration-300 overflow-hidden`}
              >
                {/* glows assimétricos nos cantos */}
                <div className={`pointer-events-none absolute -top-24 -left-24 h-64 w-64 rounded-full blur-3xl ${glowA}`} />
                <div className={`pointer-events-none absolute -bottom-28 -right-16 h-48 w-48 rounded-full blur-3xl ${glowB}`} />
                <div className="flex items-start justify-between mb-4">
                  <div className={`relative text-[11px] font-black uppercase tracking-[0.3em] ${tagColor}`}>
                    {tag}
                  </div>
                  <Icon className={`relative h-5 w-5 shrink-0 ${iconColor}`} />
                </div>
                <p className="relative text-sm leading-relaxed text-white/90 font-medium">
                  {text}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* SOBRE NÓS */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 [background:var(--section-grad-alt)]" />
        <div className="absolute inset-0 opacity-50 pointer-events-none">
          <div className="absolute -top-24 right-1/4 w-[28rem] h-[28rem] rounded-full bg-red-600/30 blur-3xl" />
          <div className="absolute -bottom-24 left-1/4 w-[28rem] h-[28rem] rounded-full bg-amber-500/20 blur-3xl" />
        </div>

        <div className="relative px-6 md:px-14 py-20 max-w-7xl mx-auto">
          <div className="relative grid lg:grid-cols-2 gap-10 items-center rounded-3xl overflow-hidden bg-gradient-to-br from-[#1a0510]/80 to-[#2a0810]/70 backdrop-blur-xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.5)]">
            {/* flares intensos nos cantos */}
            <div className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 rounded-full bg-red-500/50 blur-3xl" />
            <div className="pointer-events-none absolute -top-20 -right-20 w-64 h-64 rounded-full bg-amber-400/40 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-20 w-64 h-64 rounded-full bg-orange-500/40 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -right-24 w-72 h-72 rounded-full bg-red-600/50 blur-3xl" />

            <div className="relative h-72 lg:h-full min-h-[420px]">
              <img src={shipyardImg} alt="Estaleiro DMN às margens do Rio Amazonas" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <div className="absolute bottom-6 left-6 right-6">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-md border border-white/30">
                  <Waves className="h-3 w-3 text-white" />
                  <span className="text-[9px] font-black uppercase tracking-[0.25em] text-white">
                    Margens do Rio Amazonas
                  </span>
                </div>
              </div>
            </div>
            <div className="relative p-8 md:p-12">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-300 mb-3">
                Sobre Nós
              </div>
              <h3 className="heading-display text-3xl md:text-4xl text-white leading-tight tracking-tight mb-5 drop-shadow-lg">
                Uma década forjando a <span className="text-amber-300">indústria naval</span> amazônica
              </h3>
              <p className="text-sm md:text-[15px] leading-relaxed text-white/85 mb-4">
                A DMN Estaleiro nasceu com o propósito de fortalecer a indústria
                naval na Amazônia. Com raízes firmes na região e olhos voltados
                para o futuro, crescemos com ousadia, investindo em tecnologia,
                sustentabilidade e excelência.
              </p>
              <p className="text-sm md:text-[15px] leading-relaxed text-white/85 mb-6">
                Localizada estrategicamente às margens do Rio Amazonas, possuímos
                infraestrutura completa para construção, manutenção e reforma de
                embarcações de grande porte — diques flutuantes, áreas cobertas
                de produção, guindastes e equipamentos de última geração.
              </p>

              <div className="grid grid-cols-3 gap-3 pt-6 border-t border-white/10">
                {[
                  { icon: Building2, n: "10+", l: "Anos" },
                  { icon: Factory, n: "100%", l: "Naval" },
                  { icon: Award, n: "ISO", l: "9001" },
                ].map(({ icon: Icon, n, l }) => (
                  <div key={l} className="text-center">
                    <Icon className="h-5 w-5 text-amber-300 mx-auto mb-1.5" />
                    <div className="text-xl font-black text-white tracking-tight">{n}</div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-white/60">{l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER STRIP */}
      <section className="px-6 md:px-14 pb-12 max-w-7xl mx-auto">
        <div className="[background:var(--cta-grad)] rounded-2xl p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-red-200 mb-2">
              Sistema Integrado de Gestão Modular
            </div>
            <h4 className="heading-display text-2xl md:text-3xl text-white tracking-tight">
              Acesse o Painel SESMT / SGI
            </h4>
          </div>
          <Link
            to="/app/painel"
            className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-white text-[color:var(--on-light-brand)] text-xs font-black uppercase tracking-widest shadow-xl hover:-translate-y-0.5 transition-all"
          >
            Entrar no Painel
            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </section>
    </div>
  );
}
