import { createFileRoute, Link } from "@tanstack/react-router";
import { Anchor, Compass, Gem, ShieldCheck, Leaf, Building2, Award, ArrowRight, Waves, Factory, CalendarCheck2 } from "lucide-react";
import shipyardImg from "@/assets/dmn-shipyard.jpg";
import isoSeal from "@/assets/iso-9001.png";

export const Route = createFileRoute("/app/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-[#f1f5f9]">
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${shipyardImg})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#0b1220]/95 via-[#7f1d1d]/85 to-[#0b1220]/95" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(220,38,38,0.25),transparent_60%)]" />

        <div className="relative px-6 md:px-14 py-16 md:py-24 max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-[1.4fr_1fr] gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm mb-6">
                <Waves className="h-3.5 w-3.5 text-red-200" />
                <span className="text-[10px] font-black uppercase tracking-[0.25em] text-white/90">
                  Construção Naval · Amazônia
                </span>
              </div>
              <h1 className="heading-display text-4xl md:text-6xl lg:text-7xl text-white leading-[1.05] tracking-tight mb-6">
                ESTALEIRO <span className="text-red-300">DMN</span>
              </h1>
              <p className="text-base md:text-lg text-white/85 max-w-2xl leading-relaxed font-light mb-8">
                Há mais de uma década forjando a indústria naval da Amazônia.
                Tecnologia, sustentabilidade e excelência em cada embarcação que
                navega pelos rios do norte do Brasil.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/app/hoje"
                  className="group inline-flex items-center gap-2 px-7 py-4 rounded-xl bg-white text-[#7f1d1d] text-sm font-black uppercase tracking-widest shadow-2xl hover:-translate-y-0.5 transition-all"
                >
                  <CalendarCheck2 className="h-5 w-5" />
                  O que fazer hoje?
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Link>
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
        <div className="absolute inset-0 bg-gradient-to-br from-[#3b0a14] via-[#5b0f1c] to-[#2a060d]" />
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
            <h2 className="heading-display text-3xl md:text-5xl text-white tracking-tight drop-shadow-lg">
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
                accent: "from-red-500 to-red-700",
              },
              {
                icon: Anchor,
                tag: "Visão",
                text: "Ser reconhecida como uma empresa de referência no setor da construção naval e estar entre os melhores estaleiros da região norte, priorizando a confiabilidade e qualidade nos produtos e serviços, sempre almejando a satisfação do cliente.",
                accent: "from-amber-500 to-orange-600",
              },
              {
                icon: Gem,
                tag: "Valores",
                text: "Comprometimento dos colaboradores, preservação do meio ambiente e segurança do trabalho, ética e transparência no relacionamento com clientes e acionistas.",
                accent: "from-slate-300 to-slate-500",
              },
            ].map(({ icon: Icon, tag, text, accent }) => (
              <article
                key={tag}
                className="group relative rounded-2xl p-8 bg-gradient-to-br from-[#1a0510]/80 to-[#2a0810]/70 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] hover:-translate-y-1 hover:border-white/25 transition-all duration-300 overflow-hidden"
              >
                {/* flares intensos nos cantos */}
                <div className="pointer-events-none absolute -top-16 -left-16 w-48 h-48 rounded-full bg-red-500/50 blur-2xl" />
                <div className="pointer-events-none absolute -top-12 -right-12 w-40 h-40 rounded-full bg-amber-400/45 blur-2xl" />
                <div className="pointer-events-none absolute -bottom-16 -right-16 w-48 h-48 rounded-full bg-red-600/50 blur-2xl" />
                <div className="pointer-events-none absolute -bottom-12 -left-12 w-40 h-40 rounded-full bg-orange-500/40 blur-2xl" />
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${accent} rounded-t-2xl z-10`} />
                <div className={`relative inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${accent} text-white shadow-lg mb-5`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className="relative text-[10px] font-black uppercase tracking-[0.25em] text-amber-300/90 mb-2">
                  {tag}
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
        <div className="absolute inset-0 bg-gradient-to-br from-[#2a060d] via-[#5b0f1c] to-[#3b0a14]" />
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
        <div className="bg-gradient-to-r from-[#0b1220] via-[#7f1d1d] to-[#0b1220] rounded-2xl p-8 md:p-10 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-red-200 mb-2">
              Sistema Integrado de Gestão
            </div>
            <h4 className="heading-display text-2xl md:text-3xl text-white tracking-tight">
              Acesse o Painel SESMT / SGI
            </h4>
          </div>
          <Link
            to="/app/painel"
            className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-white text-[#7f1d1d] text-xs font-black uppercase tracking-widest shadow-xl hover:-translate-y-0.5 transition-all"
          >
            Entrar no Painel
            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </section>
    </div>
  );
}
