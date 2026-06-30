import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarClock } from "lucide-react";
import { MinhasPendencias } from "@/components/minhas-pendencias";
import { DossieContratadasCard } from "@/components/dossie-contratadas-card";
import { IntegracaoSemanalCard } from "@/components/hoje/integracao-semanal-card";

export const Route = createFileRoute("/app/hoje")({
  component: HojePage,
});

function HojePage() {
  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="max-w-7xl mx-auto px-6 md:px-14 pt-8">
        <Link
          to="/app"
          className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-[rgba(245,225,225,0.55)] hover:text-brand transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para o início
        </Link>
      </div>

      <MinhasPendencias />

      <DossieContratadasCard />

      <IntegracaoSemanalCard />

      <div className="max-w-7xl mx-auto px-6 md:px-14 pb-12">
        <div className="glass-card p-6">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-[rgba(245,225,225,0.85)]">
              <CalendarClock className="h-5 w-5" />
            </div>
            <div className="text-sm leading-relaxed text-[rgba(245,225,225,0.78)]">
              <strong className="text-[rgba(255,240,242,0.96)] font-bold">Como funciona este painel:</strong> o SIGMO verifica
              automaticamente as rotinas recorrentes (DDS, APR, exames, EPI, requisições) e
              destaca o que precisa de ação <em>hoje</em>. Quando tudo estiver verde, você sabe
              que o dia começou em ordem.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}